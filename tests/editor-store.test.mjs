import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const moduleUrl = new URL('../app/store/useAppStore.js', import.meta.url);
let instance = 0;
async function fixture(t) {
    const mockUrl = `data:text/javascript,${encodeURIComponent(`
        export const persistSet = async () => {};
        export const DEFAULT_WRITING_FONT_FAMILY = '';
        export const WRITING_FONT_STORAGE_KEY = 'synthetic-font';
        export const normalizeWritingFontFamily = value => value;
    `)}`;
    const hooks = registerHooks({ resolve(specifier, context, next) {
        if (context.parentURL?.startsWith(moduleUrl.href) && specifier.startsWith('../lib/')) return { url: mockUrl, shortCircuit: true };
        return next(specifier, context);
    } });
    t.after(() => hooks.deregister());
    return (await import(`${moduleUrl.href}?editor-store=${++instance}`)).useAppStore;
}

test('a delayed editor save never patches the newly selected work', async t => {
    const store = await fixture(t);
    const b = { id: 'same-id', content: 'B' };
    store.setState({ activeWorkId: 'b', chapters: [b] });
    store.getState().applyEditorSave('a', { chapter: { id: 'same-id', content: 'A' }, backups: [{ id: 'backup-a' }] }, {}, 'B');
    assert.deepEqual(store.getState().chapters, [b]);
});

test('a save response preserves a newer external store revision and still surfaces its backup', async t => {
    const store = await fixture(t);
    store.setState({ activeWorkId: 'a', chapters: [{ id: 'a1', content: 'new external' }] });
    store.getState().applyEditorSave('a', { chapter: { id: 'a1', content: 'local' }, backups: [{ id: 'copy', content: 'older external' }] }, {}, 'base');
    assert.equal(store.getState().chapters[0].content, 'new external');
    assert.equal(store.getState().chapters[1].content, 'older external');
    assert.equal(store.getState().editorContentReceipt, null);
});

test('a matching save publishes an explicit receipt for the exact updated chapter object', async t => {
    const store = await fixture(t);
    store.setState({ activeWorkId: 'a', chapters: [{ id: 'a1', content: 'base', title: 'New title' }] });
    const receipt = { sessionId: 3, html: 'saved' };
    store.getState().applyEditorSave('a', { chapter: { id: 'a1', content: 'saved', wordCount: 5 }, backups: [] }, receipt, 'base');
    assert.equal(store.getState().chapters[0].title, 'New title');
    assert.equal(store.getState().editorContentReceipt.chapter, store.getState().chapters[0]);
    assert.equal(store.getState().editorContentReceipt.receipt, receipt);
    store.getState().setChapters([{ id: 'a1', content: 'imported' }]);
    assert.equal(store.getState().editorContentReceipt, null);
});
