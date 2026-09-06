import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const routeUrl = new URL('../app/api/storage/route.js', import.meta.url);
let instance = 0;
const failure = code => Object.assign(new Error(`Synthetic ${code}`), { code });

async function fixture(t) {
    const id = ++instance;
    const root = path.resolve('synthetic-storage-no-disk-access');
    const target = path.join(root, 'test-user', 'author-chapters-work-a.json');
    const files = new Map([[target, JSON.stringify({ text: 'original' })]]);
    const env = { renames: [], unlinks: [], files, target };
    const fs = {
        mkdir: async () => {},
        writeFile: async (file, value) => { files.set(file, value); },
        readFile: async file => { if (!files.has(file)) throw failure('ENOENT'); return files.get(file); },
        rename: async (from, to) => {
            env.renames.push({ from, to });
            await env.beforeRename?.(from, to);
            if (!files.has(from)) throw failure('ENOENT');
            files.set(to, files.get(from)); files.delete(from);
        },
        unlink: async file => { env.unlinks.push(file); files.delete(file); },
    };
    const mockUrl = `data:text/javascript,${encodeURIComponent(`
        let fs; export const configure = value => { fs = value; };
        export default { mkdir: (...args) => fs.mkdir(...args), writeFile: (...args) => fs.writeFile(...args),
            readFile: (...args) => fs.readFile(...args), rename: (...args) => fs.rename(...args), unlink: (...args) => fs.unlink(...args) };
        export const NextResponse = { json: (data, init) => Response.json(data, init) };
        // fixture ${id}
    `)}`;
    (await import(mockUrl)).configure(fs);
    const previous = new Map(['DATA_DIR', 'AUTHOR_ENABLE_FILE_STORAGE', 'AUTHOR_ALLOW_ORPHAN_STORAGE_ADOPTION'].map(key => [key, process.env[key]]));
    process.env.DATA_DIR = root;
    process.env.AUTHOR_ENABLE_FILE_STORAGE = 'true';
    process.env.AUTHOR_ALLOW_ORPHAN_STORAGE_ADOPTION = 'false';
    const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
        if (context.parentURL?.startsWith(routeUrl.href) && ['fs/promises', 'next/server'].includes(specifier)) return { url: mockUrl, shortCircuit: true };
        return nextResolve(specifier, context);
    } });
    let api;
    try { api = await import(`${routeUrl.href}?fixture=${id}`); }
    finally {
        hooks.deregister();
        for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
    t.mock.method(globalThis, 'setTimeout', callback => { queueMicrotask(callback); return 1; });
    t.mock.method(console, 'error', () => {});
    const request = (method, value) => new Request('https://storage.example.test/api/storage?key=author-chapters-work-a', {
        method, headers: { cookie: 'author-uid=test-user', 'content-type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ key: 'author-chapters-work-a', value }) } : {}),
    });
    return { env, api, request, files, target };
}

test('failed replacement preserves the original file and the completed temporary draft', async t => {
    const f = await fixture(t);
    f.env.beforeRename = async () => { throw failure('EPERM'); };
    const response = await f.api.POST(f.request('POST', { text: 'new draft' }));
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(f.files.get(f.target)), { text: 'original' });
    assert.equal(f.env.renames.length, 5);
    assert.deepEqual(f.env.unlinks, []);
    assert.deepEqual(JSON.parse(f.files.get(f.env.renames[0].from)), { text: 'new draft' });
});

test('a transient file lock never exposes a missing original to readers', async t => {
    const f = await fixture(t);
    f.env.beforeRename = async () => {
        const read = await f.api.GET(f.request('GET'));
        assert.deepEqual(await read.json(), { data: { text: 'original' } });
        if (f.env.renames.length < 3) throw failure('EBUSY');
    };
    const response = await f.api.POST(f.request('POST', { text: 'new draft' }));
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(f.files.get(f.target)), { text: 'new draft' });
    assert.deepEqual(f.env.unlinks, []);
});

test('non-retryable replacement errors retain both copies and report failure', async t => {
    const f = await fixture(t);
    f.env.beforeRename = async () => { throw failure('EIO'); };
    assert.equal((await f.api.POST(f.request('POST', { text: 'new draft' }))).status, 500);
    assert.equal(f.env.renames.length, 1);
    assert.equal(f.files.size, 2);
    assert.deepEqual(JSON.parse(f.files.get(f.target)), { text: 'original' });
});

test('a newer save waits for an earlier replacement retry instead of being overwritten by it', async t => {
    const f = await fixture(t);
    const started = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.beforeRename = async () => {
        if (f.env.renames.length === 1) { started.resolve(); await release.promise; throw failure('EBUSY'); }
    };
    const first = f.api.POST(f.request('POST', { text: 'first' }));
    await started.promise;
    const second = f.api.POST(f.request('POST', { text: 'second' }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.env.renames.length, 1);
    release.resolve();
    assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 200]);
    assert.deepEqual(JSON.parse(f.files.get(f.target)), { text: 'second' });
});

test('deletion waits for an in-flight save, so that save cannot resurrect the file', async t => {
    const f = await fixture(t);
    const started = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.beforeRename = async () => { started.resolve(); await release.promise; };
    const saving = f.api.POST(f.request('POST', { text: 'first' }));
    await started.promise;
    const deleting = f.api.DELETE(f.request('DELETE'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.env.unlinks, []);
    release.resolve();
    assert.deepEqual((await Promise.all([saving, deleting])).map(r => r.status), [200, 200]);
    assert.equal(f.files.has(f.target), false);
});

test('a failed replacement does not block the following save', async t => {
    const f = await fixture(t);
    f.env.beforeRename = async () => { if (f.env.renames.length === 1) throw failure('EIO'); };
    const responses = await Promise.all([
        f.api.POST(f.request('POST', { text: 'failed' })),
        f.api.POST(f.request('POST', { text: 'recovered' })),
    ]);
    assert.deepEqual(responses.map(r => r.status), [500, 200]);
    assert.deepEqual(JSON.parse(f.files.get(f.target)), { text: 'recovered' });
    assert.deepEqual(JSON.parse(f.files.get(f.env.renames[0].from)), { text: 'failed' });
});
