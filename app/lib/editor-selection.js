import { TextSelection } from '@tiptap/pm/state';

export function clampEditorDocPosition(doc, position) {
    const max = Math.max(0, doc.content.size);
    if (!Number.isFinite(position)) return max;
    return Math.max(0, Math.min(Math.round(position), max));
}

export function createEditorPositionRecord(position) {
    const nonnegative = value => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return {
        from: nonnegative(position.from),
        to: nonnegative(position.to),
        // Keep direction; from/to are sorted and lose a backwards selection.
        anchor: nonnegative(position.anchor ?? position.from),
        head: nonnegative(position.head ?? position.to ?? position.from),
        scrollTop: nonnegative(position.scrollTop),
        updatedAt: Date.now(),
    };
}

export function restoreEditorTextSelection(doc, record) {
    const anchor = clampEditorDocPosition(doc, record.anchor ?? record.from);
    const head = clampEditorDocPosition(doc, record.head ?? record.to ?? record.anchor ?? record.from);
    // A document boundary is in range but is not a text cursor position.
    // between() finds valid text positions, or a node/all selection in textless docs.
    return TextSelection.between(doc.resolve(anchor), doc.resolve(head));
}
