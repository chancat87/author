let nextSessionId = 0;

// A session belongs to the document actually mounted in ProseMirror. Save
// receipts are explicit, so an old local echo cannot masquerade as an import.
export function createEditorContentSession(content, html) {
    return {
        id: ++nextSessionId,
        generation: 0,
        saving: 0,
        baseContent: content ?? '',
        savedHtml: html,
        receivedContent: content,
        receivedReceipt: null,
        pending: [],
    };
}

export function receiveEditorContent(session, content, html, receipt) {
    if (content === undefined) return false;
    if (session.receivedContent === content) {
        session.receivedReceipt = receipt;
        return false;
    }
    session.receivedContent = content;
    session.receivedReceipt = receipt;
    if (receipt?.sessionId === session.id && receipt.html === content) return false;
    // Keep every distinct concurrent version until a save has preserved it.
    session.pending = session.pending.filter(version => version.content !== content);
    session.pending.push({ content: content ?? '', html, needsBackup: session.saving > 0 });
    return true;
}

export function editorContentAction(session, html, { focused = false, composing = false } = {}) {
    if (!session.pending.length) return 'none';
    if (composing) return 'defer';
    if (html !== session.savedHtml || session.pending.some(version => version.needsBackup)) return 'conflict';
    if (focused) return 'defer';
    return 'apply';
}

export function acceptEditorContent(session, version, html) {
    session.generation++;
    session.baseContent = version.content;
    session.savedHtml = html;
    session.pending = [];
}

export function editorSaveIsObsolete(session, generation) {
    return session.generation !== generation;
}

export function acknowledgeEditorSave(session, html, preservedVersions) {
    session.baseContent = html;
    session.savedHtml = html;
    const preserved = new Set(preservedVersions);
    session.pending = session.pending.filter(version => !preserved.has(version));
}
