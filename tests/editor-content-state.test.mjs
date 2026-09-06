import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorContentSession, receiveEditorContent, editorContentAction, acceptEditorContent, acknowledgeEditorSave, editorSaveIsObsolete } from '../app/lib/editor-content-state.js';

test('equal-length changes after an identical long prefix are external revisions', () => {
    const old = `<p>${'a'.repeat(80)}old</p>`;
    const next = `<p>${'a'.repeat(80)}new</p>`;
    const session = createEditorContentSession(old, old);
    receiveEditorContent(session, next, next, null);
    assert.equal(editorContentAction(session, old), 'apply');
});

test('empty external content is deferred during focus then applied on blur', () => {
    const session = createEditorContentSession('<p>draft</p>', '<p>draft</p>');
    receiveEditorContent(session, '', '<p></p>', null);
    assert.equal(editorContentAction(session, '<p>draft</p>', { focused: true }), 'defer');
    assert.equal(editorContentAction(session, '<p>draft</p>'), 'apply');
    acceptEditorContent(session, session.pending[0], '<p></p>');
    assert.equal(session.baseContent, '');
    assert.equal(session.pending.length, 0);
});

test('a delayed local save echo never replaces newer typing, including after blur', () => {
    const session = createEditorContentSession('base', 'base');
    acknowledgeEditorSave(session, 'first input', []);
    receiveEditorContent(session, 'first input', 'first input', { sessionId: session.id, html: 'first input' });
    assert.equal(editorContentAction(session, 'second input'), 'none');
});

test('an external revert to a previously saved value is not classified as a local echo', () => {
    const session = createEditorContentSession('base', 'base');
    acknowledgeEditorSave(session, 'first input', []);
    receiveEditorContent(session, 'first input', 'first input', { sessionId: session.id, html: 'first input' });
    receiveEditorContent(session, 'base', 'base', null);
    assert.equal(editorContentAction(session, 'first input'), 'apply');
});

test('composition defers even a conflict until the final input has been committed', () => {
    const session = createEditorContentSession('base', 'base');
    receiveEditorContent(session, 'external', 'external', null);
    assert.equal(editorContentAction(session, '中', { composing: true }), 'defer');
    assert.equal(editorContentAction(session, '中文', { focused: true }), 'conflict');
});

test('later revisions arriving during a save remain pending after its acknowledgement', () => {
    const session = createEditorContentSession('base', 'base');
    receiveEditorContent(session, 'external 1', 'external 1', null);
    const captured = [...session.pending];
    receiveEditorContent(session, 'external 2', 'external 2', null);
    acknowledgeEditorSave(session, 'local', captured);
    assert.deepEqual(session.pending.map(v => v.content), ['external 2']);
    assert.equal(editorContentAction(session, 'new local'), 'conflict');
});

test('a receipt from the outgoing chapter is not accepted by the new chapter', () => {
    const a = createEditorContentSession('A', 'A');
    const b = createEditorContentSession('B', 'B');
    receiveEditorContent(b, 'new B', 'new B', { sessionId: a.id, html: 'new B' });
    assert.equal(editorContentAction(b, 'B'), 'apply');
});

test('clean pending revisions select the latest version and reset the baseline', () => {
    const session = createEditorContentSession('base', 'base');
    receiveEditorContent(session, 'one', 'one', null);
    receiveEditorContent(session, 'two', 'two', null);
    acceptEditorContent(session, session.pending.at(-1), 'two');
    assert.equal(session.savedHtml, 'two');
    assert.equal(session.baseContent, 'two');
    assert.equal(editorContentAction(session, 'two'), 'none');
});

test('metadata-only store changes do not turn a local echo into a conflict', () => {
    const session = createEditorContentSession('base', 'base');
    acknowledgeEditorSave(session, 'local', []);
    receiveEditorContent(session, 'local', 'local', { sessionId: session.id, html: 'local' });
    receiveEditorContent(session, 'local', 'local', null);
    assert.equal(editorContentAction(session, 'new typing'), 'none');
});

test('accepting an external revision invalidates old queued saves but ordinary save acknowledgements do not', () => {
    const session = createEditorContentSession('base', 'base');
    const generation = session.generation;
    acknowledgeEditorSave(session, 'local', []);
    assert.equal(editorSaveIsObsolete(session, generation), false);
    receiveEditorContent(session, 'remote', 'remote', null);
    acceptEditorContent(session, session.pending[0], 'remote');
    assert.equal(editorSaveIsObsolete(session, generation), true);
});

test('a version arriving during persistence must be backed up even after the draft is acknowledged', () => {
    const session = createEditorContentSession('base', 'base');
    session.saving++;
    receiveEditorContent(session, 'remote', 'remote', null);
    acknowledgeEditorSave(session, 'local', []);
    session.saving--;
    assert.equal(editorContentAction(session, 'local'), 'conflict');
});
