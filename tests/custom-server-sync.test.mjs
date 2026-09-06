import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import { fingerprint } from '../app/lib/custom-sync-core.js';
import { isSyncableKey } from '../app/lib/sync-key-policy.js';

const SERVER_URL = 'https://sync.example.test';
const STATE_KEY = `author-cloud-sync-state-v2:${encodeURIComponent(JSON.stringify([SERVER_URL, 'author_free', 'test-account']))}`;
const KEY = 'author-chapters-work-test';
const moduleUrl = new URL('../app/lib/custom-server-sync.js', import.meta.url);
let instance = 0;
const initializedContexts = new WeakSet();

const chapter = (id, content) => ({ id, content });
const cloudItem = (value, serverSeq = 2) => ({
    kind: 'chapter', workId: 'work-test', itemId: value.id, value, serverSeq,
});
const acknowledgement = (item, accepted = true, reason) => ({
    kind: item.kind, workId: item.workId, itemId: item.itemId, accepted, reason,
});
const response = body => ({ ok: true, json: async () => structuredClone(body) });

async function fixture(t, { local = [], baseline = [], storage = new Map(), values = new Map() } = {}) {
    if (!storage.has(STATE_KEY)) {
        storage.set(STATE_KEY, JSON.stringify({
            accountId: 'test-account', serverUrl: SERVER_URL, product: 'author_free', cursor: 1,
            keys: { [KEY]: Object.fromEntries(baseline.map(item => [item.id, { hash: fingerprint(item) }])) },
        }));
        values.set(KEY, structuredClone(local));
    }
    if (!initializedContexts.has(t)) {
        initializedContexts.add(t);
        const originalGlobals = new Map(['window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
        t.after(() => {
            for (const [key, descriptor] of originalGlobals) {
                if (descriptor) Object.defineProperty(globalThis, key, descriptor);
                else delete globalThis[key];
            }
        });
        t.mock.method(globalThis, 'setInterval', () => 1);
        t.mock.method(globalThis, 'clearInterval', () => {});
        t.mock.method(globalThis, 'setTimeout', () => 1);
        t.mock.method(globalThis, 'clearTimeout', () => {});
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
    } });
    const requests = [];
    const statuses = [];
    const env = {
        authContext: { serverUrl: SERVER_URL, product: 'author_free', userId: 'test-account', epoch: 0, signal: new AbortController().signal },
        request: async (path, options) => {
            requests.push({ path, options: structuredClone(options) });
            if (path.endsWith('/push')) return env.push(options.body.items);
            return env.pull(options.query);
        },
        push: async items => response({ ok: true, results: items.map(item => acknowledgement(item)) }),
        pull: async () => response({ ok: true, items: [], nextSince: 2, hasMore: false }),
    };
    const authUrl = `data:text/javascript,${encodeURIComponent(`
        // fixture ${++instance}
        let env;
        export function configure(value) { env = value; }
        export function isCustomSignedIn() { return true; }
        export function getCurrentCustomUser() { return { id: 'test-account' }; }
        export function getCustomAuthContext() { return env.authContext; }
        export function isCustomAuthContextCurrent(context) { return context === env.authContext && !context.signal.aborted; }
        export function assertCustomAuthContext(context) { if (!isCustomAuthContextCurrent(context)) throw new Error('Session changed'); }
        export function authorizedFetch(path, options) { return env.request(path, options); }
    `)}`;
    (await import(authUrl)).configure(env);
    const hooks = registerHooks({
        resolve(specifier, context, nextResolve) {
            if (context.parentURL?.startsWith(moduleUrl.href)) {
                if (specifier === './custom-auth') return { url: authUrl, shortCircuit: true };
                if (specifier.startsWith('./')) {
                    return nextResolve(new URL(`${specifier}.js`, moduleUrl).href, context);
                }
            }
            return nextResolve(specifier, context);
        },
    });
    let sync;
    try { sync = await import(`${moduleUrl.href}?test=${instance}`); }
    finally { hooks.deregister(); }
    sync.bindLocalIO(
        async key => structuredClone(values.get(key)),
        async (key, value) => {
            if (env.failBackup && key.includes('conflict-backup')) throw new Error('Backup unavailable');
            values.set(key, structuredClone(value));
            if (key.includes('conflict-backup')) await env.onBackup?.();
        },
    );
    sync.onCustomSyncStatusChange(status => statuses.push(status));
    return {
        sync, env, requests, statuses, values, storage,
        state: () => JSON.parse(storage.get(STATE_KEY)),
        backups: () => [...values.entries()].filter(([key]) => key.includes('conflict-backup')),
    };
}

test('stale rejection preserves the local draft and baseline through pull and restart', async t => {
    const base = chapter('c1', 'base');
    const local = chapter('c1', 'local draft');
    const remote = chapter('c1', 'remote draft');
    const f = await fixture(t, { baseline: [base], local: [local] });
    f.env.push = async items => response({ ok: true, results: items.map(item => acknowledgement(item, false, 'stale')) });
    f.env.pull = async () => response({ ok: true, items: [cloudItem(remote)], nextSince: 2, hasMore: false });
    f.sync.customEnqueue(KEY);
    await f.sync.flushSync();
    assert.deepEqual(f.values.get(KEY), [local]);
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(base));
    assert.equal(f.state().cursor, 2);
    assert.equal(f.backups().length, 1);
    assert.equal(isSyncableKey(f.backups()[0][0]), false);
    assert.match(JSON.stringify(f.backups()[0][1]), /local draft/);
    assert.match(JSON.stringify(f.backups()[0][1]), /remote draft/);
    assert.ok(f.statuses.at(-1).pending > 0);
    assert.ok(f.statuses.at(-1).error);

    const restarted = await fixture(t, { storage: f.storage, values: f.values });
    restarted.env.pull = f.env.pull;
    await restarted.sync.pullFromCloud();
    assert.deepEqual(restarted.values.get(KEY), [local]);
    await restarted.sync.flushSync({ throwOnError: true });
    const upload = restarted.requests.find(request => request.path.endsWith('/push'));
    assert.deepEqual(upload.options.body.items[0].value, local);
    assert.equal(restarted.state().keys[KEY].c1.hash, fingerprint(local));
});

test('only explicitly accepted items advance their baseline in a mixed response', async t => {
    const base = [chapter('c1', 'base 1'), chapter('c2', 'base 2')];
    const local = [chapter('c1', 'edit 1'), chapter('c2', 'edit 2')];
    const f = await fixture(t, { baseline: base, local });
    f.env.push = async items => response({ ok: true, results: [
        acknowledgement(items[1], false, 'stale'), acknowledgement(items[0]),
    ] });
    f.sync.customEnqueue(KEY);
    await assert.rejects(f.sync.flushSync({ throwOnError: true }));
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(local[0]));
    assert.equal(f.state().keys[KEY].c2.hash, fingerprint(base[1]));
    f.env.push = async items => {
        assert.deepEqual(items.map(item => item.itemId), ['c2']);
        return response({ ok: true, results: items.map(item => acknowledgement(item)) });
    };
    await f.sync.flushSync({ throwOnError: true });
});

test('empty, missing, malformed and ambiguous acknowledgements never mean success', async t => {
    const cases = [
        { ok: true }, { ok: true, results: [] }, null,
        { ok: true, results: [{}] },
        { ok: true, results: [{ itemId: 'other', accepted: true }] },
        { ok: true, results: [{ itemId: 'c1', workId: 'another-work', accepted: true }] },
        { ok: true, results: [{ workId: 'another-work', accepted: true }] },
        { ok: true, results: [{ itemId: 'c1', accepted: true }, { itemId: 'c1', accepted: true }] },
        { ok: false, results: [{ itemId: 'c1', accepted: true }] },
    ];
    for (const data of cases) {
        await t.test(JSON.stringify(data), async t => {
            const base = chapter('c1', 'base');
            const f = await fixture(t, { baseline: [base], local: [chapter('c1', 'edit')] });
            f.env.push = async () => response(data);
            f.sync.customEnqueue(KEY);
            await assert.rejects(f.sync.flushSync({ throwOnError: true }));
            assert.equal(f.state().keys[KEY].c1.hash, fingerprint(base));
            assert.ok(f.statuses.at(-1).pending > 0);
        });
    }
});

test('a complete ordered legacy response still requires acceptance for every item', async t => {
    const f = await fixture(t, { local: [chapter('c1', 'one'), chapter('c2', 'two')] });
    f.env.push = async () => response({ ok: true, results: [{ accepted: true }, { accepted: false, reason: 'invalid' }] });
    f.sync.customEnqueue(KEY);
    await assert.rejects(f.sync.flushSync({ throwOnError: true }));
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(chapter('c1', 'one')));
    assert.equal(f.state().keys[KEY].c2, undefined);
});

test('a rejected deletion is not resurrected by the subsequent pull', async t => {
    const base = chapter('c1', 'base');
    const f = await fixture(t, { baseline: [base], local: [] });
    f.env.push = async items => response({ ok: true, results: items.map(item => acknowledgement(item, false, 'stale')) });
    f.env.pull = async () => response({ ok: true, items: [cloudItem(chapter('c1', 'remote'))], nextSince: 2 });
    f.sync.customDel(KEY);
    await f.sync.flushSync();
    assert.deepEqual(f.values.get(KEY), []);
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(base));
    assert.equal(f.backups().length, 1);
});

test('a rejected works index is not overwritten by the automatic pull', async t => {
    const f = await fixture(t);
    const key = 'author-works-index';
    const local = [{ id: 'work-test', name: 'Local work' }];
    f.values.set(key, local);
    f.env.push = async items => response({ ok: true, results: items.map(item => acknowledgement(item, false, 'stale')) });
    f.env.pull = async () => response({ ok: true, items: [{
        kind: 'works_index', workId: '_index', itemId: '_index', value: [], serverSeq: 2,
    }], nextSince: 2 });
    f.sync.customEnqueue(key);
    await f.sync.flushSync();
    assert.deepEqual(f.values.get(key), local);
    assert.equal(f.backups().length, 1);
});

test('a conflict backup failure cannot advance the pull cursor', async t => {
    const base = chapter('c1', 'base');
    const local = chapter('c1', 'edit');
    const f = await fixture(t, { baseline: [base], local: [local] });
    f.env.failBackup = true;
    f.env.push = async items => response({ ok: true, results: items.map(item => acknowledgement(item, false, 'stale')) });
    f.env.pull = async () => response({ ok: true, items: [cloudItem(chapter('c1', 'remote'))], nextSince: 2 });
    f.sync.customEnqueue(KEY);
    await f.sync.flushSync();
    assert.equal(f.state().cursor, 1);
    assert.deepEqual(f.values.get(KEY), [local]);
});

test('an unconfirmed create followed by a local delete retries an explicit tombstone', async t => {
    const f = await fixture(t, { local: [chapter('c1', 'new')] });
    f.env.push = async () => response({ ok: true, results: [] });
    f.sync.customEnqueue(KEY);
    await f.sync.flushSync();
    f.values.set(KEY, []);
    f.sync.customDel(KEY);
    f.env.push = async items => {
        assert.equal(items.length, 1);
        assert.equal(items[0].deleted, true);
        return response({ ok: true, results: items.map(item => acknowledgement(item)) });
    };
    await f.sync.flushSync({ throwOnError: true });
    assert.deepEqual(f.state().keys[KEY].c1, { deleted: true });
});

test('a later batch failure keeps earlier confirmations and retries the remainder after restart', async t => {
    const local = Array.from({ length: 101 }, (_, index) => chapter(`c${index}`, 'new'));
    const f = await fixture(t, { local });
    let batch = 0;
    f.env.push = async items => {
        if (++batch > 1) throw new Error('Network unavailable');
        return response({ ok: true, results: items.map(item => acknowledgement(item)) });
    };
    f.sync.customEnqueue(KEY);
    await assert.rejects(f.sync.flushSync({ throwOnError: true }), /Network unavailable/);
    assert.equal(Object.keys(f.state().keys[KEY]).length, 100);
    const restarted = await fixture(t, { storage: f.storage, values: f.values });
    restarted.env.push = async items => {
        assert.deepEqual(items.map(item => item.itemId), ['c100']);
        return response({ ok: true, results: items.map(item => acknowledgement(item)) });
    };
    await restarted.sync.flushSync({ throwOnError: true });
    assert.equal(Object.keys(restarted.state().keys[KEY]).length, 101);
});

test('an upload cannot start until its retry state is saved', async t => {
    const local = chapter('c1', 'new');
    const f = await fixture(t, { local: [local] });
    t.mock.method(globalThis.localStorage, 'setItem', () => { throw new Error('State storage unavailable'); });
    f.sync.customEnqueue(KEY);
    await assert.rejects(f.sync.flushSync({ throwOnError: true }), /State storage unavailable/);
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.values.get(KEY), [local]);
});

test('a pending edit survives a remote deletion', async t => {
    const base = chapter('c1', 'base');
    const local = chapter('c1', 'local edit');
    const f = await fixture(t, { baseline: [base], local: [local] });
    f.env.push = async items => response({ ok: true, results: items.map(item => acknowledgement(item, false, 'stale')) });
    f.env.pull = async () => response({ ok: true, items: [{ ...cloudItem(base), deleted: true, value: undefined }], nextSince: 2 });
    f.sync.customEnqueue(KEY);
    await f.sync.flushSync();
    assert.deepEqual(f.values.get(KEY), [local]);
    assert.equal(f.backups()[0][1].remote.deleted, true);
});

test('edits made while saving a conflict backup survive the merge of unrelated remote items', async t => {
    const base = [chapter('c1', 'base 1'), chapter('c2', 'base 2')];
    const local = [chapter('c1', 'local edit'), base[1]];
    const latest = chapter('c1', 'typed while saving backup');
    const remoteSecond = chapter('c2', 'remote edit');
    const f = await fixture(t, { baseline: base, local });
    f.env.push = async items => response({ ok: true, results: items.map(item => acknowledgement(item, false, 'stale')) });
    f.env.pull = async () => response({ ok: true, items: [cloudItem(chapter('c1', 'conflicting edit')), cloudItem(remoteSecond, 3)], nextSince: 3 });
    f.env.onBackup = () => { f.values.set(KEY, [latest, base[1]]); };
    f.sync.customEnqueue(KEY);
    await f.sync.flushSync();
    assert.deepEqual(f.values.get(KEY), [latest, remoteSecond]);
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(base[0]));
    assert.equal(f.state().keys[KEY].c2.hash, fingerprint(remoteSecond));
});

test('a pull already in flight finishes before an upload can confirm a newer local version', async t => {
    const base = chapter('c1', 'base');
    const local = chapter('c1', 'local edit');
    const remote = chapter('c1', 'remote edit');
    const f = await fixture(t, { baseline: [base], local: [base] });
    const started = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.pull = async () => {
        started.resolve();
        await release.promise;
        return response({ ok: true, items: [cloudItem(remote)], nextSince: 2 });
    };
    const pulling = f.sync.pullFromCloud();
    await started.promise;
    f.values.set(KEY, [local]);
    f.sync.customEnqueue(KEY);
    const uploading = f.sync.flushSync({ throwOnError: true });
    await Promise.resolve();
    assert.equal(f.requests.filter(request => request.path.endsWith('/push')).length, 0);
    release.resolve();
    await pulling;
    await uploading;
    assert.deepEqual(f.values.get(KEY), [local]);
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(local));
});

test('an acknowledgement confirms the sent version, not an edit made during upload', async t => {
    const base = chapter('c1', 'base');
    const sent = chapter('c1', 'sent edit');
    const newer = chapter('c1', 'newer edit');
    const f = await fixture(t, { baseline: [base], local: [sent] });
    f.env.push = async items => {
        f.values.set(KEY, [newer]);
        f.sync.customEnqueue(KEY);
        return response({ ok: true, results: items.map(item => acknowledgement(item)) });
    };
    f.sync.customEnqueue(KEY);
    await f.sync.flushSync({ throwOnError: true });
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(sent));
    f.env.pull = async () => response({ ok: true, items: [cloudItem(sent)], nextSince: 2 });
    await f.sync.pullFromCloud();
    assert.deepEqual(f.values.get(KEY), [newer]);
    f.env.push = async items => {
        assert.deepEqual(items[0].value, newer);
        return response({ ok: true, results: items.map(item => acknowledgement(item)) });
    };
    await f.sync.flushSync({ throwOnError: true });
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(newer));
});

test('a failed cursor save is retried from the previous cursor in the same session', async t => {
    const f = await fixture(t);
    const setItem = globalThis.localStorage.setItem;
    let fail = true;
    t.mock.method(globalThis.localStorage, 'setItem', (key, value) => {
        if (fail) { fail = false; throw new Error('State storage unavailable'); }
        return setItem(key, value);
    });
    await f.sync.pullFromCloud();
    await f.sync.pullFromCloud();
    assert.deepEqual(f.requests.map(request => request.options.query.since), [1, 1]);
    assert.equal(f.state().cursor, 2);
});

test('a clean remote update still applies and does not produce a conflict backup', async t => {
    const base = chapter('c1', 'base');
    const remote = chapter('c1', 'remote edit');
    const f = await fixture(t, { baseline: [base], local: [base] });
    f.env.pull = async () => response({ ok: true, items: [cloudItem(remote)], nextSince: 2 });
    assert.equal(await f.sync.pullFromCloud(), 1);
    assert.deepEqual(f.values.get(KEY), [remote]);
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(remote));
    assert.equal(f.backups().length, 0);
});

test('revisions across pull pages apply the newest value and commit that exact baseline', async t => {
    const base = chapter('c1', 'base');
    const newest = chapter('c1', 'newest');
    const f = await fixture(t, { baseline: [base], local: [base] });
    f.env.pull = async ({ since }) => response(since === 1
        ? { ok: true, items: [cloudItem(chapter('c1', 'middle'), 2)], nextSince: 2, hasMore: true }
        : { ok: true, items: [cloudItem(newest, 4), cloudItem(chapter('c1', 'older'), 3)], nextSince: 4, hasMore: false });
    assert.equal(await f.sync.pullFromCloud(), 1);
    assert.deepEqual(f.values.get(KEY), [newest]);
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(newest));
    assert.equal(f.state().cursor, 4);
});

test('an unpushed local deletion survives pull and restart and is queued for upload', async t => {
    const base = chapter('c1', 'base');
    const f = await fixture(t, { baseline: [base], local: [] });
    f.env.pull = async () => response({ ok: true, items: [cloudItem(chapter('c1', 'remote edit'), 2)], nextSince: 2 });
    await f.sync.pullFromCloud();
    assert.deepEqual(f.values.get(KEY), []);
    assert.deepEqual(f.state().pending[KEY].c1, { deleted: true });
    assert.equal(f.state().keys[KEY].c1.hash, fingerprint(base));
    assert.equal(f.backups()[0][1].local.deleted, true);
    const restarted = await fixture(t, { storage: f.storage, values: f.values });
    restarted.env.push = async items => {
        assert.equal(items.length, 1);
        assert.equal(items[0].deleted, true);
        return response({ ok: true, results: items.map(item => acknowledgement(item)) });
    };
    await restarted.sync.flushSync({ throwOnError: true });
    assert.ok(restarted.requests.some(request => request.path.endsWith('/push')));
    assert.deepEqual(restarted.values.get(KEY), []);
});

test('a local deletion made while pull waits for a later page remains deleted', async t => {
    const base = chapter('c1', 'base');
    const f = await fixture(t, { baseline: [base], local: [base] });
    f.env.pull = async ({ since }) => {
        if (since === 1) return response({ ok: true, items: [cloudItem(base, 2)], nextSince: 2, hasMore: true });
        f.values.set(KEY, []);
        return response({ ok: true, items: [cloudItem(chapter('c1', 'latest remote'), 3)], nextSince: 3 });
    };
    await f.sync.pullFromCloud();
    assert.deepEqual(f.values.get(KEY), []);
    assert.deepEqual(f.state().pending[KEY].c1, { deleted: true });
});

test('force pull reflects the final remote deletion rather than an earlier create', async t => {
    const base = chapter('c1', 'base');
    const f = await fixture(t, { baseline: [base], local: [base] });
    f.env.pull = async () => response({ ok: true, items: [
        cloudItem(chapter('c1', 'created remotely'), 2),
        { kind: 'chapter', workId: 'work-test', itemId: 'c1', deleted: true, serverSeq: 3 },
    ], nextSince: 3 });
    await f.sync.forcePullFromCloud();
    assert.deepEqual(f.values.get(KEY), []);
    assert.deepEqual(f.state().keys[KEY].c1, { deleted: true });
});

test('failure to preserve an unpushed deletion conflict leaves the cursor unchanged', async t => {
    const base = chapter('c1', 'base');
    const f = await fixture(t, { baseline: [base], local: [] });
    f.env.failBackup = true;
    f.env.pull = async () => response({ ok: true, items: [cloudItem(chapter('c1', 'remote edit'), 2)], nextSince: 2 });
    await f.sync.pullFromCloud();
    assert.deepEqual(f.values.get(KEY), []);
    assert.equal(f.state().cursor, 1);
    assert.deepEqual(f.state().pending[KEY].c1, { deleted: true });
});

test('newly discovered local deletion state must be durable before pull can advance', async t => {
    const base = chapter('c1', 'base');
    const f = await fixture(t, { baseline: [base], local: [] });
    t.mock.method(globalThis.localStorage, 'setItem', () => { throw new Error('State storage unavailable'); });
    f.env.pull = async () => response({ ok: true, items: [cloudItem(chapter('c1', 'remote edit'), 2)], nextSince: 2 });
    await f.sync.pullFromCloud();
    assert.equal(f.state().cursor, 1);
    assert.deepEqual(f.values.get(KEY), []);
    assert.equal(f.backups().length, 0);
});

test('force pull clears a local key when the remote batch contains only a tombstone', async t => {
    const base = chapter('c1', 'base');
    const f = await fixture(t, { baseline: [base], local: [base] });
    f.env.pull = async () => response({ ok: true, items: [
        { kind: 'chapter', workId: 'work-test', itemId: 'c1', deleted: true, serverSeq: 3 },
    ], nextSince: 3 });
    await f.sync.forcePullFromCloud();
    assert.deepEqual(f.values.get(KEY), []);
    assert.deepEqual(f.state().keys[KEY].c1, { deleted: true });
});
