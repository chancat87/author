import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { promisifyRequest } from 'idb-keyval';

const moduleUrl = new URL('../app/lib/persistence.js', import.meta.url);
const statusUrl = new URL('../app/lib/local-save-status.js', import.meta.url);
let instance = 0;

async function fixture(t) {
    const id = ++instance;
    const values = new Map();
    const putStarted = Promise.withResolvers();
    const savedGlobals = new Map(['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'author-uid=synthetic-user' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: (key, value) => values.set(key, value) } });
    t.after(() => { for (const [key, descriptor] of savedGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
    const env = {
        promisifyRequest,
        get: async key => { await env.beforeGet?.(key); return values.get(key); },
        set: async (key, value) => { values.set(key, value); },
        authContext: null,
        pushes: [],
        stops: 0,
        store: async (mode, callback) => {
            assert.equal(mode, 'readwrite');
            await env.beforeStore?.();
            let aborted = false;
            let staged;
            const transaction = { error: null, abort() {
                if (aborted) return;
                aborted = true;
                queueMicrotask(() => transaction.onabort?.());
            } };
            env.commit = () => {
                if (aborted) return;
                if (staged) values.set(staged.key, staged.value);
                transaction.oncomplete?.();
            };
            return callback({ transaction, put(value, key) {
                if (env.putError) throw env.putError;
                staged = { key, value };
                putStarted.resolve();
            } });
        },
    };
    const mockUrl = `data:text/javascript,${encodeURIComponent(`
        // fixture ${id}
        let env;
        export const configure = value => { env = value; };
        export const get = key => env.get(key);
        export const set = (key, value) => env.set(key, value);
        export const del = () => { throw new Error('Unexpected delete'); };
        export const createStore = (database, name) => {
            if (database !== 'keyval-store' || name !== 'keyval') throw new Error('Wrong database');
            return (mode, callback) => env.store(mode, callback);
        };
        export const promisifyRequest = request => env.promisifyRequest(request);
        export const isSyncableKey = () => false;
        export const apiPath = path => path;
        export const IS_OFFICIAL_WEB = true;
        export const getCustomAuthContext = () => env.authContext;
        export const assertCustomAuthContext = context => {
            if (!context || context !== env.authContext || context.signal.aborted) {
                const error = new Error('Identity changed');
                error.code = 'AUTH_CONTEXT_CHANGED';
                throw error;
            }
        };
        export const isCustomServerConfigured = () => !!env.authContext;
        export const isCustomSignedIn = () => !!env.authContext;
        export const bindLocalIO = () => {};
        export const pushAllToCloud = async keys => { env.pushes.push(keys); return keys.length; };
        export const stopCustomSync = () => { env.stops++; };
    `)}`;
    (await import(mockUrl)).configure(env);
    const status = await import(`${statusUrl.href}?fixture=persistence-${id}`);
    const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
        if (context.parentURL?.startsWith(moduleUrl.href)) {
            return { url: specifier === './local-save-status' ? `${statusUrl.href}?fixture=persistence-${id}` : mockUrl, shortCircuit: true };
        }
        return nextResolve(specifier, context);
    } });
    t.after(() => hooks.deregister());
    const api = await import(`${moduleUrl.href}?fixture=${id}`);
    return { api, env, values, status, putStarted: putStarted.promise };
}

test('guarded persistence waits for transaction completion before reporting a save', async t => {
    const f = await fixture(t);
    const controller = new AbortController();
    const saving = f.api.persistSet('synthetic-key', { value: 'new' }, { signal: controller.signal });
    await f.putStarted;
    assert.equal(f.values.size, 0);
    assert.equal(f.status.getLocalSaveSnapshot().status, 'saving');
    f.env.commit();
    await saving;
    assert.deepEqual(f.values.get('synthetic-key'), { value: 'new' });
    assert.equal(f.status.getLocalSaveSnapshot().status, 'saved');
});

test('switching identity aborts a staged transaction without reporting unsaved editor data', async t => {
    const f = await fixture(t);
    const controller = new AbortController();
    f.values.set('synthetic-key', 'original');
    const saving = f.api.persistSet('synthetic-key', 'obsolete', { signal: controller.signal });
    const rejected = assert.rejects(saving, { name: 'AbortError' });
    await f.putStarted;
    controller.abort();
    await rejected;
    f.env.commit();
    assert.equal(f.values.get('synthetic-key'), 'original');
    assert.equal(f.status.getLocalSaveSnapshot().pending, 0);
    assert.equal(f.status.getLocalSaveSnapshot().status, 'saved');
    assert.equal(f.status.getLocalSaveSnapshot().lastSavedAt, null);
});

test('identity changes while opening IndexedDB prevent put from being issued', async t => {
    const f = await fixture(t);
    const ready = Promise.withResolvers();
    f.env.beforeStore = () => ready.promise;
    const controller = new AbortController();
    const saving = f.api.persistSet('synthetic-key', 'obsolete', { signal: controller.signal });
    const rejected = assert.rejects(saving, { name: 'AbortError' });
    controller.abort();
    ready.resolve();
    await rejected;
    assert.equal(f.values.size, 0);
    assert.equal(f.status.getLocalSaveSnapshot().status, 'saved');
});

test('genuine IndexedDB failures still report a blocking local save error', async t => {
    const f = await fixture(t);
    f.env.putError = new DOMException('Synthetic quota failure', 'QuotaExceededError');
    await assert.rejects(f.api.persistSet('synthetic-key', 'new', { signal: new AbortController().signal }), { name: 'QuotaExceededError' });
    assert.equal(f.values.size, 0);
    assert.equal(f.status.hasBlockingLocalSave(), true);
    assert.equal(f.status.getLocalSaveSnapshot().error, 'Synthetic quota failure');
});

test('a cancelled cloud write cannot clear a pre-existing local save failure', async t => {
    const f = await fixture(t);
    await assert.rejects(f.status.trackLocalSave(async () => { throw new Error('Earlier local failure'); }));
    const controller = new AbortController();
    const saving = f.api.persistSet('synthetic-key', 'obsolete', { signal: controller.signal });
    const rejected = assert.rejects(saving, { name: 'AbortError' });
    await f.putStarted;
    controller.abort();
    await rejected;
    assert.equal(f.status.getLocalSaveSnapshot().error, 'Earlier local failure');
    assert.equal(f.status.hasBlockingLocalSave(), true);
});

test('ordinary persistence still uses its existing unguarded storage path', async t => {
    const f = await fixture(t);
    await f.api.persistSet('synthetic-key', 'ordinary');
    assert.equal(f.values.get('synthetic-key'), 'ordinary');
    assert.equal(f.status.getLocalSaveSnapshot().status, 'saved');
});

test('manual upload and logout capture identity before reading the works list', async t => {
    for (const method of ['syncToCloud', 'stopCloudSync']) {
        await t.test(method, async t => {
            const f = await fixture(t);
            const reading = Promise.withResolvers();
            const release = Promise.withResolvers();
            f.env.authContext = { userId: 'a', signal: new AbortController().signal };
            f.env.beforeGet = async key => { if (key === 'author-works-index') { reading.resolve(); await release.promise; } };
            const operation = f.api[method]();
            const rejected = assert.rejects(operation, { code: 'AUTH_CONTEXT_CHANGED' });
            await reading.promise;
            f.env.authContext = { userId: 'b', signal: new AbortController().signal };
            release.resolve();
            await rejected;
            assert.deepEqual(f.env.pushes, []);
            assert.equal(f.env.stops, 0);
        });
    }
});

test('only the force-pull operation receives permission to write through the editor pause', async t => {
    const f = await fixture(t);
    window._isAppForcePulling = true;
    await f.api.persistSet('ordinary-key', 'paused');
    assert.equal(f.values.has('ordinary-key'), false);
    await assert.rejects(f.api.persistSet('paused-cloud-key', 'paused', { signal: new AbortController().signal }));
    assert.equal(f.values.has('paused-cloud-key'), false);
    const saving = f.api.persistSet('cloud-key', 'restored', { signal: new AbortController().signal, bypassForcePull: true });
    await f.putStarted;
    f.env.commit();
    await saving;
    assert.equal(f.values.get('cloud-key'), 'restored');
    assert.equal(window._isForcePullingBypass, undefined);
});
