import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudFixture, session, jsonResponse, SERVER_A, SERVER_B } from './helpers/cloud-fixture.mjs';

const KEY = 'author-chapters-work-test';
const remote = { kind: 'chapter', workId: 'work-test', itemId: 'c1', value: { id: 'c1', content: 'old account response' }, serverSeq: 7 };
const stateEntries = f => [...f.storage.entries()].filter(([key]) => key.startsWith('author-cloud-sync-state-v2:'));

test('a late response body cannot write data or a cursor after an account change', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const sync = await f.loadSync();
    const reading = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.fetch = async url => {
        if (url.includes('/pull')) {
            const response = jsonResponse({});
            response.json = async () => { reading.resolve(); return release.promise; };
            return response;
        }
        return jsonResponse({ ok: true, ...session('user-b') });
    };
    const pulling = sync.pullFromCloud();
    await reading.promise;
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve({ ok: true, items: [remote], nextSince: 7 });
    await pulling;
    assert.equal(f.values.has(KEY), false);
    assert.ok(stateEntries(f).every(([, value]) => JSON.parse(value).cursor !== 7));
});

test('sync cursors are isolated by server even when account IDs are identical', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const sync = await f.loadSync();
    f.env.fetch = async url => {
        if (url.includes('/pull')) return jsonResponse({ ok: true, items: [], nextSince: url.startsWith(SERVER_A) ? 7 : 11 });
        return jsonResponse({ ok: true, ...session('user-a', SERVER_B) });
    };
    await sync.pullFromCloud();
    f.auth.setCloudServerUrl(SERVER_B);
    await f.auth.signInWithCustomServer('user-a@example.test', 'synthetic password');
    await sync.pullFromCloud();
    const pulls = f.requests.filter(request => request.url.includes('/pull'));
    assert.equal(new URL(pulls[1].url).searchParams.get('since'), '0');
    assert.deepEqual(stateEntries(f).map(([, value]) => JSON.parse(value).cursor).sort((a, b) => a - b), [7, 11]);
});

test('stopping sync aborts its request and ignores a late body', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const sync = await f.loadSync();
    const reading = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.fetch = async () => {
        const response = jsonResponse({});
        response.json = async () => { reading.resolve(); return release.promise; };
        return response;
    };
    const pulling = sync.pullFromCloud();
    await reading.promise;
    sync.stopCustomSync();
    const aborted = f.requests[0].options.signal.aborted;
    release.resolve({ ok: true, items: [remote], nextSince: 7 });
    await pulling;
    assert.equal(aborted, true);
    assert.equal(f.values.has(KEY), false);
});

test('a queued local write checks the original identity again at commit time', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const sync = await f.loadSync();
    const writing = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.beforeWrite = async key => { if (key === KEY) { writing.resolve(); await release.promise; } };
    f.env.fetch = async url => url.includes('/pull')
        ? jsonResponse({ ok: true, items: [remote], nextSince: 7 })
        : jsonResponse({ ok: true, ...session('user-b') });
    const pulling = sync.pullFromCloud();
    await writing.promise;
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve();
    await pulling;
    assert.equal(f.values.has(KEY), false);
});

test('an upload waiting for local data cannot continue with another account credentials', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const sync = await f.loadSync();
    f.values.set(KEY, [{ id: 'c1', content: 'local synthetic draft' }]);
    const reading = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.beforeRead = async key => { if (key === KEY) { reading.resolve(); await release.promise; } };
    f.env.fetch = async () => jsonResponse({ ok: true, ...session('user-b', SERVER_B) });
    sync.customEnqueue(KEY);
    const uploading = sync.flushSync();
    await reading.promise;
    f.auth.setCloudServerUrl(SERVER_B);
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve();
    await uploading;
    assert.equal(f.requests.some(request => request.url.includes('/push')), false);
});

test('a sync queued under the previous account never starts after the account changes', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const sync = await f.loadSync();
    const reading = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.fetch = async url => {
        if (!url.includes('/pull')) return jsonResponse({ ok: true, ...session('user-b') });
        const response = jsonResponse({});
        response.json = async () => { reading.resolve(); return release.promise; };
        return response;
    };
    const first = sync.pullFromCloud();
    const second = sync.pullFromCloud();
    const rejected = assert.rejects(second, { code: 'AUTH_CONTEXT_CHANGED' });
    await reading.promise;
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve({ ok: true, items: [remote], nextSince: 7 });
    await first;
    await rejected;
    assert.equal(f.requests.filter(request => request.url.includes('/pull')).length, 1);
    assert.equal(f.values.has(KEY), false);
});

test('a cancelled force pull cannot overwrite local data or advance another account cursor', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const sync = await f.loadSync();
    f.values.set(KEY, [{ id: 'c1', content: 'current local draft' }]);
    const reading = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.fetch = async url => {
        if (!url.includes('/pull')) return jsonResponse({ ok: true, ...session('user-b') });
        const response = jsonResponse({});
        response.json = async () => { reading.resolve(); return release.promise; };
        return response;
    };
    const pulling = sync.forcePullFromCloud();
    const rejected = assert.rejects(pulling, { code: 'AUTH_CONTEXT_CHANGED' });
    await reading.promise;
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve({ ok: true, items: [remote], nextSince: 7 });
    await rejected;
    assert.equal(f.values.get(KEY)[0].content, 'current local draft');
    assert.ok(stateEntries(f).every(([, value]) => JSON.parse(value).cursor !== 7));
});
