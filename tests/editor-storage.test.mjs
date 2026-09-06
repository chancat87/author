import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

let instance = 0;
async function fixture(t) {
    const values = new Map([['author-chapters-a', [{ id: 'a1', title: 'Chapter A', content: 'base' }]], ['author-chapters-b', [{ id: 'b1', content: 'B' }]]]);
    const env = { values, writes: [], fail: false };
    const mockUrl = `data:text/javascript,${encodeURIComponent(`
        // ${++instance}
        let env;
        export const configure = value => { env = value; };
        export const persistGet = async key => structuredClone(env.values.get(key));
        export const persistSet = async (key, value) => {
            if (env.fail) throw new Error('Synthetic write failure');
            env.writes.push({key, value: structuredClone(value)});
            env.values.set(key, structuredClone(value));
        };
        export const persistDel = () => { throw new Error('Unexpected delete'); };
    `)}`;
    (await import(mockUrl)).configure(env);
    const moduleUrl = new URL('../app/lib/storage.js', import.meta.url);
    const hooks = registerHooks({ resolve(specifier, context, next) {
        if (context.parentURL?.startsWith(moduleUrl.href) && specifier === './persistence') return { url: mockUrl, shortCircuit: true };
        return next(specifier, context);
    } });
    t.after(() => hooks.deregister());
    const api = await import(`${moduleUrl.href}?editor=${instance}`);
    return { api, env, values };
}

const draft = (overrides = {}) => ({ content: 'local', wordCount: 5, baseContent: 'base', backupSuffix: 'External backup', ...overrides });

test('a concurrent persisted revision is preserved alongside the current draft in one write', async t => {
    const f = await fixture(t);
    f.values.get('author-chapters-a')[0].content = 'remote';
    const result = await f.api.saveEditorChapter('a1', draft(), 'a');
    assert.equal(result.chapter.content, 'local');
    assert.deepEqual(result.backups.map(b => b.content), ['remote']);
    assert.equal(result.backups[0].numberingIgnored, true);
    assert.equal(f.env.writes.length, 1);
    assert.deepEqual(f.env.writes[0].value.map(ch => ch.content), ['local', 'remote']);
    assert.equal(f.values.get('author-chapters-b')[0].content, 'B');
});

test('all pending external versions including an empty body survive a local save', async t => {
    const f = await fixture(t);
    const result = await f.api.saveEditorChapter('a1', draft({ externalVersions: ['remote one', '', 'remote two', 'remote one'] }), 'a');
    assert.deepEqual(result.backups.map(b => b.content), ['remote one', '', 'remote two']);
});

test('matching base content is an ordinary save and creates no backups', async t => {
    const f = await fixture(t);
    const result = await f.api.saveEditorChapter('a1', draft(), 'a');
    assert.equal(result.backups.length, 0);
});

test('failed persistence preserves the old chapter and retry does not duplicate backups', async t => {
    const f = await fixture(t);
    f.values.get('author-chapters-a')[0].content = 'remote';
    f.env.fail = true;
    await assert.rejects(f.api.saveEditorChapter('a1', draft(), 'a'), /Synthetic write failure/);
    assert.deepEqual(f.values.get('author-chapters-a').map(ch => ch.content), ['remote']);
    f.env.fail = false;
    await f.api.saveEditorChapter('a1', draft(), 'a');
    await f.api.saveEditorChapter('a1', draft({ externalVersions: ['remote'] }), 'a');
    assert.deepEqual(f.values.get('author-chapters-a').map(ch => ch.content), ['local', 'remote']);
});

test('a delayed save never recreates a removed chapter or writes into another work', async t => {
    const f = await fixture(t);
    f.values.set('author-chapters-a', []);
    await assert.rejects(f.api.saveEditorChapter('a1', draft(), 'a'), /no longer exists/);
    assert.equal(f.env.writes.length, 0);
    assert.equal(f.values.get('author-chapters-b')[0].content, 'B');
});
