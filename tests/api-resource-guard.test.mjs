import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile, readdir } from 'node:fs/promises';
import { acquireApiResources, createResourceState, requestClientId, readBoundedBody, withApiResources, desktopRequestAllowed, MiB } from '../app/lib/api-resource-guard.js';

const req = (body, headers = {}, signal) => new Request('https://author.example.test/api/test', {
    method: 'POST', headers, body, signal, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
});

test('forged forwarding headers cannot create new rate identities', () => {
    const state = createResourceState();
    for (let i = 0; i < 60; i++) {
        const request = req('{}', { 'x-real-ip': `192.0.2.${i}`, 'x-forwarded-for': `192.0.2.${i}`, 'x-author-client-ip': `192.0.2.${i}` });
        assert.equal(requestClientId(request, {}), 'shared-unverified');
        acquireApiResources(request, '/api/ai', { state, env: {} }).release();
    }
    assert.throws(() => acquireApiResources(req('{}', { 'x-real-ip': '203.0.113.1' }), '/api/ai', { state, env: {} }), { status: 429 });
    assert.equal(state.buckets.size, 2);
});

test('only authenticated ingress or the Vercel platform header identifies an IP', () => {
    const token = 'test-proxy-'.repeat(4);
    const request = req('{}', { 'x-author-proxy-token': token, 'x-author-client-ip': '2001:db8:0:0::1', 'x-real-ip': '1.2.3.4' });
    assert.equal(requestClientId(request, { AUTHOR_PROXY_TOKEN: token }), '[2001:db8::1]');
    assert.equal(requestClientId(request, { AUTHOR_PROXY_TOKEN: 'wrong' }), 'shared-unverified');
    assert.equal(requestClientId(req('{}', { 'x-vercel-forwarded-for': '203.0.113.2' }), { VERCEL: '1' }), '203.0.113.2');
    assert.equal(requestClientId(req('{}', { 'x-vercel-forwarded-for': '203.0.113.2' }), {}), 'shared-unverified');
});

test('live rate buckets never exceed the cardinality limit or evict an active identity', () => {
    const state = createResourceState(), token = 'test-proxy-'.repeat(4);
    for (let i = 1; i <= 20; i++) {
        try { acquireApiResources(req('{}', { 'x-author-proxy-token': token, 'x-author-client-ip': `192.0.2.${i}` }), '/api/ai', { state, env: { AUTHOR_PROXY_TOKEN: token }, maxBuckets: 8, now: 0 }).release(); }
        catch (error) { assert.equal(error.status, 429); }
        assert.ok(state.buckets.size <= 8);
    }
    assert.ok(state.buckets.has('/api/ai:192.0.2.1'));
    acquireApiResources(req('{}'), '/api/ai', { state, env: {}, maxBuckets: 8, now: 60_001 }).release();
    assert.ok(state.buckets.size <= 8);
});

test('global concurrency and reserved body bytes are enforced across routes', () => {
    const state = createResourceState();
    const first = acquireApiResources(req('{}'), '/api/ai', { state, env: {}, maxConcurrent: 1 });
    assert.throws(() => acquireApiResources(req('{}'), '/api/tools/search', { state, env: {}, maxConcurrent: 1 }), { code: 'SERVER_BUSY' });
    first.release(); first.release();
    assert.equal(state.active, 0); assert.equal(state.reservedBytes, 0);
    assert.throws(() => acquireApiResources(req('{}'), '/api/parse-file', { state, env: {}, maxReservedBytes: 50 * MiB }), { code: 'SERVER_BUSY' });
});

test('only one expensive file parse is admitted at a time', () => {
    const state = createResourceState();
    const first = acquireApiResources(req('{}'), '/api/parse-file', { state, env: {} });
    assert.throws(() => acquireApiResources(req('{}'), '/api/parse-file', { state, env: {} }), { code: 'SERVER_BUSY' });
    first.release();
    acquireApiResources(req('{}'), '/api/parse-file', { state, env: {} }).release();
});

test('streamed bodies are limited by bytes even with no length or a forged low length', async () => {
    for (const headers of [{}, { 'content-length': '1' }]) {
        let cancelled = false, pulls = 0;
        const body = new ReadableStream({ pull(c) { pulls++; c.enqueue(new Uint8Array(11)); }, cancel() { cancelled = true; } });
        await assert.rejects(readBoundedBody(req(body, headers), 10), { status: 413 });
        assert.equal(cancelled, true); assert.ok(pulls <= 2);
    }
});

test('body limits accept the exact threshold and count multi-byte UTF-8 correctly', async () => {
    assert.equal((await readBoundedBody(req('你你'), 6)).length, 6);
    await assert.rejects(readBoundedBody(req('你你'), 5), { status: 413 });
    await assert.rejects(readBoundedBody(req('abc', { 'content-length': '2' }), 10), { code: 'INVALID_REQUEST' });
});

test('empty and pre-aborted requests are validated before entering the handler', async () => {
    const state = createResourceState();
    const handler = withApiResources('/api/app-version', () => { throw new Error('Must not reach handler'); }, { state, env: {} });
    const controller = new AbortController();
    controller.abort();
    assert.equal((await handler(new Request('https://example.test', { signal: controller.signal }))).status, 499);
    assert.equal((await handler(new Request('https://example.test', { headers: { 'content-length': '1' } }))).status, 400);
    assert.equal((await handler(new Request('https://example.test', { headers: { 'content-encoding': 'gzip' } }))).status, 415);
    assert.equal(state.active, 0);
});

test('slow request timeout cancels reading and releases admission', async () => {
    const state = createResourceState();
    let cancelled = false, called = false;
    const body = new ReadableStream({ cancel() { cancelled = true; } });
    const handler = withApiResources('/api/ai', () => { called = true; return Response.json({}); }, { state, env: {}, bodyTimeoutMs: 10 });
    assert.equal((await handler(req(body))).status, 408);
    assert.equal(cancelled, true); assert.equal(called, false); assert.equal(state.active, 0);
});

test('aborted uploads do not reach the handler and release admission', async () => {
    const state = createResourceState(), controller = new AbortController();
    let cancelled = false;
    const body = new ReadableStream({ cancel() { cancelled = true; } });
    const handler = withApiResources('/api/ai', () => { throw new Error('Must not reach handler'); }, { state, env: {} });
    const result = handler(req(body, {}, controller.signal));
    controller.abort();
    assert.equal((await result).status, 499); assert.equal(state.active, 0); assert.equal(cancelled, true);
});

test('streaming admission remains held until cancellation and forwards abort after body buffering', async () => {
    const state = createResourceState(), controller = new AbortController();
    let signal, cancelled = false;
    const handler = withApiResources('/api/ai', request => {
        signal = request.signal;
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
    }, { state, env: {} });
    const response = await handler(req('{}', {}, controller.signal));
    assert.equal(state.active, 1);
    controller.abort();
    await response.body.cancel(); await delay(0);
    assert.equal(signal.aborted, true); assert.equal(cancelled, true); assert.equal(state.active, 0);
});

test('desktop capability remains required at API handlers while handshake is reachable', async () => {
    const state = createResourceState(), env = { AUTHOR_DESKTOP_CAPABILITY: 'synthetic-capability' };
    assert.equal(desktopRequestAllowed(req('{}'), env), false);
    assert.throws(() => acquireApiResources(req('{}'), '/api/app-version', { state, env }), { status: 401 });
    acquireApiResources(new Request('https://example.test'), '/api/desktop-handshake', { state, env }).release();
    acquireApiResources(req('{}', { cookie: 'author-desktop-capability=synthetic-capability' }), '/api/ai', { state, env }).release();
});

test('every API method is covered when API routes bypass Next Proxy body cloning', async () => {
    async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const location = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
            if (entry.isDirectory()) await visit(location);
            else if (entry.name === 'route.js') {
                const source = await readFile(location, 'utf8');
                assert.doesNotMatch(source, /export (?:async )?function (?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\(/, location.href);
                const methods = [...source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*=\s*([^\n]+)/g)];
                assert.ok(methods.length > 0, location.href);
                for (const method of methods) assert.match(method[2], /^withApiResources\(/, location.href);
            }
        }
    }
    await visit(new URL('../app/api/', import.meta.url));
});
