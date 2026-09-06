// Executed from stdin inside the built image. Only synthetic local traffic is used.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { readFile, access, constants } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export async function runDockerSmoke({ mode, pdf, doc }) {
    const checks = [];
    const record = (name, details = {}) => {
        const result = { name, passed: true, ...details };
        checks.push(result);
        console.log(JSON.stringify(result));
    };
    assert.equal(Number(process.versions.node.split('.')[0]), 24);
    assert.notEqual(process.getuid(), 0, 'The image must run as a non-root user');
    await access('/app/data', constants.W_OK);
    record('node24-non-root-writable-data', { version: process.versions.node, uid: process.getuid() });

    const integrated = mode === 'integration';
    const capability = 'a11-synthetic-container-capability';
    process.env.PORT = '3000';
    process.env.HOSTNAME = '127.0.0.1';
    // The optional trusted mode is needed only for a loopback synthetic AI
    // upstream. The separate public run verifies production defaults first.
    if (integrated) {
        process.env.AUTHOR_DESKTOP_CAPABILITY = capability;
        process.env.AUTHOR_ENABLE_FILE_STORAGE = 'true';
        process.env.AUTHOR_ALLOW_ORPHAN_STORAGE_ADOPTION = 'false';
    } else {
        assert.ok(!process.env.AUTHOR_DESKTOP_CAPABILITY);
        assert.ok(!process.env.AUTHOR_ENABLE_FILE_STORAGE);
    }
    const cookie = integrated ? `author-desktop-capability=${capability}; author-uid=a11-synthetic-user` : '';
    const base = 'http://127.0.0.1:3000';
    const request = (pathname, options = {}) => fetch(base + pathname, {
        ...options, headers: { cookie, ...options.headers },
        signal: options.signal || AbortSignal.timeout(10_000),
    });
    const require = createRequire('/app/server.js');
    require('/app/server.js');
    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
        try { const response = await request('/api/app-version'); await response.arrayBuffer(); if (response.ok) { ready = true; break; } }
        catch { /* The server starts asynchronously. */ }
        await delay(50);
    }
    assert.equal(ready, true, 'The packaged server did not become ready');
    assert.equal((await request('/')).status, 200);
    for (const name of ['PRIVACY', 'PRIVACY.zh', 'PRIVACY.ru', 'PRIVACY.ar', 'TERMS', 'TERMS.zh', 'TERMS.ru', 'TERMS.ar']) {
        const response = await request(`/legal/${name}.html`);
        assert.equal(response.status, 200, name);
        assert.match(await response.text(), /<!DOCTYPE html>/i);
    }
    record('startup-page-and-eight-legal-pages');

    if (!integrated) {
        assert.equal((await request('/api/storage?key=a11-synthetic')).status, 403);
        const blocked = await request('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
            systemPrompt: 'synthetic', userPrompt: 'synthetic',
            apiConfig: { apiKey: 'test-api-key', baseUrl: 'http://127.0.0.1:39999/v1', model: 'synthetic' },
        }) });
        assert.equal(blocked.status, 400);
        assert.equal((await blocked.json()).code, 'OUTBOUND_REQUEST_BLOCKED');
        record('public-defaults-storage-disabled-private-upstream-blocked');
        return { mode, passed: true, checks };
    }

    assert.equal((await fetch(base + '/api/app-version', { signal: AbortSignal.timeout(10_000) })).status, 401);
    const value = { manuscript: 'A11 synthetic stored text', revision: 1 };
    assert.equal((await request('/api/storage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'a11-synthetic', value }) })).status, 200);
    assert.deepEqual((await (await request('/api/storage?key=a11-synthetic')).json()).data, value);
    assert.deepEqual(JSON.parse(await readFile('/app/data/a11-synthetic-user/a11-synthetic.json', 'utf8')), value);
    record('capability-and-persistent-data-write-read');

    for (const [format, encoded] of [['pdf', pdf], ['doc', doc]]) {
        const form = new FormData();
        form.append('file', new Blob([Buffer.from(encoded, 'base64')]), `a11-synthetic.${format}`);
        const response = await request('/api/parse-file', { method: 'POST', body: form });
        const data = await response.json();
        assert.equal(response.status, 200, JSON.stringify(data));
        assert.match(data.text, new RegExp(`A10 synthetic ${format.toUpperCase()}`));
        record(`packaged-${format}-parser`);
    }
    const oversized = new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(12 * 1024 * 1024 + 1)); controller.close(); },
    });
    const limited = await request('/api/ai', { method: 'POST', body: oversized, duplex: 'half' });
    assert.equal(limited.status, 413);
    assert.equal((await limited.json()).code, 'REQUEST_TOO_LARGE');
    record('chunked-body-byte-limit');

    let upstreamClosedAt = 0;
    const sse = payload => `data: ${JSON.stringify(payload)}\n\n`;
    const upstream = http.createServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(sse({ choices: [{ delta: { content: 'A11 synthetic stream' } }] }));
        if (body.model === 'a11-cancel') {
            res.on('close', () => { upstreamClosedAt = Date.now(); });
        } else {
            res.end(sse({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n');
        }
    });
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    const generate = model => request('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        systemPrompt: 'synthetic', userPrompt: 'synthetic',
        apiConfig: { apiKey: 'test-api-key', baseUrl: `http://127.0.0.1:${upstream.address().port}/v1`, model },
    }) });
    const completed = await generate('a11-complete');
    assert.equal(completed.status, 200);
    const events = await completed.text();
    assert.match(events, /A11 synthetic stream/);
    assert.match(events, /"status":"done"/);
    assert.match(events, /\[DONE\]/);
    record('sse-completion');

    const cancelled = await generate('a11-cancel');
    assert.equal(cancelled.status, 200);
    const reader = cancelled.body.getReader();
    assert.equal((await reader.read()).done, false);
    const cancelledAt = Date.now();
    await reader.cancel();
    while (!upstreamClosedAt && Date.now() - cancelledAt < 5000) await delay(10);
    assert.ok(upstreamClosedAt, 'Cancelling the client stream must close the upstream connection');
    record('sse-cancellation-closes-upstream', { milliseconds: upstreamClosedAt - cancelledAt });
    return { mode, passed: true, checks };
}
