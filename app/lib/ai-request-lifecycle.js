export const AI_REQUEST_TIMEOUT_MS = 120_000;

export function createGenerationLifecycle(parentSignal, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    let timer;
    const dispose = () => {
        clearTimeout(timer);
        parentSignal?.removeEventListener('abort', onAbort);
    };
    const abort = (reason = new DOMException('Generation cancelled', 'AbortError')) => {
        controller.abort(reason);
        dispose();
    };
    const onAbort = () => abort(new DOMException('Generation cancelled', 'AbortError'));
    if (parentSignal?.aborted) onAbort();
    else {
        parentSignal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => abort(new DOMException('Generation timed out', 'TimeoutError')), timeoutMs);
    }
    return { signal: controller.signal, abort, dispose, streaming: false };
}

export function generationAbortResponse(lifecycle) {
    if (!lifecycle.signal.aborted) return null;
    const timeout = lifecycle.signal.reason?.name === 'TimeoutError';
    return Response.json({
        status: timeout ? 'incomplete' : 'cancelled',
        code: timeout ? 'AI_GENERATION_TIMEOUT' : 'AI_GENERATION_CANCELLED',
        error: timeout ? '生成超时，内容尚未完成。' : '已停止生成。',
    }, { status: timeout ? 504 : 499 });
}
