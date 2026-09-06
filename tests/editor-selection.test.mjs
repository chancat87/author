import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection, NodeSelection, AllSelection } from '@tiptap/pm/state';
import { history, undo, redo, undoDepth } from '@tiptap/pm/history';
import { createEditorPositionRecord, restoreEditorTextSelection } from '../app/lib/editor-selection.js';

const schema = new Schema({ nodes: {
    doc: { content: 'block*' },
    paragraph: { group: 'block', content: 'inline*' },
    blockquote: { group: 'block', content: 'block+' },
    horizontal_rule: { group: 'block', atom: true },
    text: { group: 'inline' },
} });
const paragraph = text => schema.node('paragraph', null, text ? schema.text(text) : null);
const doc = (...nodes) => schema.node('doc', null, nodes);
const normal = doc(paragraph('first'), paragraph('second'));

function textSelection(document, record) {
    const selected = restoreEditorTextSelection(document, record);
    assert.ok(selected instanceof TextSelection);
    assert.equal(selected.$anchor.parent.inlineContent, true);
    assert.equal(selected.$head.parent.inlineContent, true);
    return selected;
}

test('document edges and paragraph boundaries become valid text cursors without warnings', t => {
    const warnings = t.mock.method(console, 'warn', () => {});
    for (const from of [0, 7, normal.content.size, -10, 999, NaN, Infinity, null, undefined]) {
        const selected = textSelection(normal, { from });
        assert.equal(selected.empty, true);
    }
    assert.equal(textSelection(normal, { from: 0 }).from, 1);
    assert.equal(textSelection(normal, { from: 999 }).from, normal.content.size - 1);
    assert.equal(warnings.mock.callCount(), 0);
});

test('empty and shorter replacement documents accept old long-document positions', () => {
    assert.equal(textSelection(doc(paragraph()), { from: 5000, to: 9000 }).from, 1);
    assert.equal(textSelection(doc(paragraph('新稿')), { from: 5000, to: 9000 }).from, 3);
});

test('forward and backward selections survive JSON persistence without losing direction', () => {
    for (const [anchor, head] of [[2, 5], [5, 2], [3, 3]]) {
        const selection = TextSelection.create(normal, anchor, head);
        const saved = createEditorPositionRecord({ anchor: selection.anchor, head: selection.head, from: selection.from, to: selection.to, scrollTop: 84 });
        const restored = textSelection(normal, JSON.parse(JSON.stringify(saved)));
        assert.equal(restored.anchor, anchor);
        assert.equal(restored.head, head);
        assert.equal(saved.scrollTop, 84);
    }
});

test('legacy from/to-only records and nested blocks remain compatible', () => {
    const legacy = textSelection(normal, { from: 2, to: 5 });
    assert.equal(legacy.from, 2);
    assert.equal(legacy.to, 5);
    const nested = doc(schema.node('blockquote', null, [paragraph('quoted')]), paragraph('tail'));
    assert.equal(textSelection(nested, { from: 0 }).from, 2);
    assert.equal(textSelection(normal, { anchor: 5, head: 0 }).head, 1);
});

test('textless documents fall back to a valid node or all selection', () => {
    const atomOnly = doc(schema.node('horizontal_rule'));
    assert.ok(restoreEditorTextSelection(atomOnly, { from: 1 }) instanceof NodeSelection);
    assert.ok(restoreEditorTextSelection(doc(), { from: 0 }) instanceof AllSelection);
});

test('restoring selection changes neither content nor undo/redo history', () => {
    let state = EditorState.create({ doc: normal, plugins: [history()] });
    state = state.apply(state.tr.insertText('new', 2));
    const edited = state.doc;
    assert.equal(undoDepth(state), 1);
    const tr = state.tr.setSelection(restoreEditorTextSelection(state.doc, { from: 0 })).setMeta('addToHistory', false);
    assert.equal(tr.docChanged, false);
    state = state.apply(tr);
    assert.equal(state.doc, edited);
    assert.equal(undoDepth(state), 1);
    assert.equal(undo(state, next => { state = state.apply(next); }), true);
    assert.equal(state.doc.eq(normal), true);
    assert.equal(redo(state, next => { state = state.apply(next); }), true);
    assert.equal(state.doc.eq(edited), true);
});

function componentFixture(document, initialRecord) {
    const source = readFileSync(new URL('../app/components/Editor.js', import.meta.url), 'utf8');
    const functions = source.slice(source.indexOf('function saveEditorPositionSnapshot('), source.indexOf('\nconst Editor = forwardRef'));
    let record = initialRecord;
    let state = EditorState.create({ doc: document, plugins: [history()] });
    const frames = [];
    const view = { get state() { return state; }, dispatch(tr) { state = state.apply(tr); } };
    const editor = { get state() { return state; } };
    const api = new Function('saveEditorPositionRecord', 'loadEditorPositionRecord', 'getMountedEditorView', 'focusMountedEditor', 'restoreEditorTextSelection', 'requestAnimationFrame',
        `${functions}\nreturn { save: saveEditorPositionSnapshot, restore: restoreEditorPositionSnapshot };`)(
        (_work, _chapter, position) => { record = createEditorPositionRecord(position); }, () => record,
        () => view, () => true, restoreEditorTextSelection, callback => frames.push(callback),
    );
    return { ...api, editor, frames, get state() { return state; }, set state(next) { state = next; }, get record() { return record; } };
}

test('the actual component restores a legacy zero position legally and saves reverse direction', t => {
    const warnings = t.mock.method(console, 'warn', () => {});
    const fixture = componentFixture(normal, { from: 0, to: 0 });
    assert.equal(fixture.restore(fixture.editor, 'work-a', 'chapter-a', null), true);
    assert.equal(fixture.state.selection.from, 1);
    assert.equal(warnings.mock.callCount(), 0);
    fixture.state = fixture.state.apply(fixture.state.tr.setSelection(TextSelection.create(normal, 5, 2)));
    fixture.save(fixture.editor, 'work-a', 'chapter-a', { scrollTop: 84 });
    assert.equal(fixture.record.anchor, 5);
    assert.equal(fixture.record.head, 2);
    fixture.restore(fixture.editor, 'work-a', 'chapter-a', null);
    assert.equal(fixture.state.selection.anchor, 5);
    assert.equal(fixture.state.selection.head, 2);
});

test('a late restore frame cannot overwrite another chapter scroll position', () => {
    const fixture = componentFixture(normal, { from: 2, to: 2, scrollTop: 84 });
    const container = { scrollTop: 0 };
    fixture.restore(fixture.editor, 'work-a', 'chapter-a', container);
    assert.equal(container.scrollTop, 84);
    fixture.state = EditorState.create({ doc: doc(paragraph('another chapter')) });
    container.scrollTop = 17;
    fixture.frames.forEach(callback => callback());
    assert.equal(container.scrollTop, 17);
});
