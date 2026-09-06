import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

export const MiB = 1024 * 1024;
export const MAX_FILE_BYTES = 50 * MiB;
export const MAX_UPLOAD_BYTES = 52 * MiB;
const HANDSHAKE_PATH = '/api/desktop-handshake';
const policies = [
    { prefix: HANDSHAKE_PATH, limit: 30, maxBytes: 0, concurrency: 4 },
    { prefix: '/api/parse-file', limit: 10, maxBytes: MAX_UPLOAD_BYTES, concurrency: 1 },
    { prefix: '/api/storage', limit: 600, maxBytes: 5 * MiB, concurrency: 16 },
    { prefix: '/api/sync/lan', limit: 30, maxBytes: 12 * MiB, concurrency: 4 },
    { prefix: '/api/sync/webdav', limit: 120, maxBytes: 12 * MiB, concurrency: 4 },
    { prefix: '/api/ai', limit: 60, maxBytes: 12 * MiB, concurrency: 8 },
    { prefix: '/api/tts', limit: 60, maxBytes: 12 * MiB, concurrency: 4 },
    { prefix: '/api/embed', limit: 120, maxBytes: 12 * MiB, concurrency: 8 },
    { prefix: '/api/tools/search', limit: 60, maxBytes: 2 * MiB, concurrency: 4 },
    { prefix: '/api/update-source-stream', limit: 3, maxBytes: 1024, concurrency: 1 },
    { prefix: '/api/update-source', limit: 3, maxBytes: 1024, concurrency: 1 },
];
const defaultPolicy = { prefix: '/api/other', limit: 120, maxBytes: 2 * MiB, concurrency: 8 };
const bodyCache = new WeakMap();

export class ApiResourceError extends Error {
    constructor(code, status, message, retryAfter) {
        super(message);
        Object.assign(this, { code, status, retryAfter });
    }
}

export function resourceErrorResponse(error) {
    return Response.json({ error: error.message, code: error.code }, {
        status: error.status,
        headers: { 'Cache-Control': 'no-store', ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) },
    });
}

function equalSecret(actual, expected) {
    const a = Buffer.from(actual || ''), b = Buffer.from(expected || '');
    return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function desktopRequestAllowed(request, env = process.env) {
    const expected = env.AUTHOR_DESKTOP_CAPABILITY || '';
    if (!expected) return true;
    const cookie = (request.headers.get('cookie') || '').split(';')
        .map(part => part.trim()).find(part => part.startsWith('author-desktop-capability='));
    return equalSecret(cookie?.slice('author-desktop-capability='.length), expected);
}

export function requestClientId(request, env = process.env) {
    // Arbitrary forwarding headers are never client identity. Self-hosted
    // ingress overwrites both dedicated headers and shares a private token.
    let ip = '';
    const token = env.AUTHOR_PROXY_TOKEN || '';
    if (token.length >= 32 && equalSecret(request.headers.get('x-author-proxy-token'), token)) {
        ip = request.headers.get('x-author-client-ip') || '';
    } else if (env.VERCEL === '1') {
        ip = request.headers.get('x-vercel-forwarded-for') || '';
    }
    ip = ip.trim();
    if (ip.length > 45 || !isIP(ip)) return 'shared-unverified';
    return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
}

export function createResourceState() {
    return { buckets: new Map(), active: 0, activeByPolicy: new Map(), reservedBytes: 0 };
}
const stateKey = Symbol.for('author.api.resources');
const sharedState = globalThis[stateKey] ||= createResourceState();

function policyFor(pathname) {
    return policies.find(p => pathname === p.prefix || pathname.startsWith(p.prefix + '/')) || defaultPolicy;
}

export function acquireApiResources(request, pathname, {
    state = sharedState, env = process.env, now = Date.now(), maxBuckets = 5000,
    maxConcurrent = 24, maxReservedBytes = 96 * MiB,
} = {}) {
    if (pathname !== HANDSHAKE_PATH && !desktopRequestAllowed(request, env)) {
        throw new ApiResourceError('DESKTOP_CAPABILITY_REQUIRED', 401, 'Desktop capability required');
    }
    const policy = policyFor(pathname);
    const clientKey = `${policy.prefix}:${requestClientId(request, env)}`;
    const globalKey = `global:${policy.prefix}`;
    // Hard cardinality bound: never evict a live bucket to admit a new identity.
    if (state.buckets.size >= maxBuckets - 2) {
        for (const [key, bucket] of state.buckets) if (bucket.resetAt <= now) state.buckets.delete(key);
    }
    for (const [key, limit] of [[globalKey, policy.limit * 10], [clientKey, policy.limit]]) {
        let bucket = state.buckets.get(key);
        if (!bucket) {
            if (state.buckets.size >= maxBuckets) throw new ApiResourceError('RATE_LIMITED', 429, 'Too many requests', 60);
            bucket = { count: 0, resetAt: now + 60_000 };
            state.buckets.set(key, bucket);
        } else if (bucket.resetAt <= now) {
            bucket.count = 0; bucket.resetAt = now + 60_000;
        }
        if (bucket.count >= limit) throw new ApiResourceError('RATE_LIMITED', 429, 'Too many requests', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
        bucket.count++;
    }
    const reservedBytes = request.body ? policy.maxBytes : 0;
    const active = state.activeByPolicy.get(policy.prefix) || 0;
    if (state.active >= maxConcurrent || active >= policy.concurrency || state.reservedBytes + reservedBytes > maxReservedBytes) {
        throw new ApiResourceError('SERVER_BUSY', 503, 'Server is busy; please retry shortly', 1);
    }
    state.active++;
    state.reservedBytes += reservedBytes;
    state.activeByPolicy.set(policy.prefix, active + 1);
    let released = false;
    return { policy, release() {
        if (released) return;
        released = true;
        state.active--;
        state.reservedBytes -= reservedBytes;
        state.activeByPolicy.set(policy.prefix, state.activeByPolicy.get(policy.prefix) - 1);
    } };
}

export async function readBoundedBody(request, maxBytes, timeoutMs = 30_000) {
    const fail = (code, status, message) => new ApiResourceError(code, status, message);
    if (request.signal?.aborted) {
        request.body?.cancel().catch(() => {});
        throw fail('REQUEST_CANCELLED', 499, 'Request cancelled');
    }
    if (bodyCache.has(request)) return bodyCache.get(request);
    const length = request.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw fail('INVALID_REQUEST', 400, 'Invalid Content-Length');
    if (length !== null && Number(length) > maxBytes) {
        request.body?.cancel().catch(() => {});
        throw fail('REQUEST_TOO_LARGE', 413, 'Request body is too large');
    }
    if (!['', 'identity'].includes(request.headers.get('content-encoding') || '')) throw fail('UNSUPPORTED_ENCODING', 415, 'Compressed request bodies are not supported');
    if (!request.body) {
        if (Number(length) > 0) throw fail('INVALID_REQUEST', 400, 'Content-Length does not match the body');
        return Buffer.alloc(0);
    }
    const reader = request.body.getReader();
    const chunks = [];
    let bytes = 0, timer, rejectRead;
    const interruption = new Promise((_, reject) => { rejectRead = reject; });
    const interrupt = error => { rejectRead(error); reader.cancel(error).catch(() => {}); };
    const abort = () => interrupt(fail('REQUEST_CANCELLED', 499, 'Request cancelled'));
    request.signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => interrupt(fail('REQUEST_TIMEOUT', 408, 'Request body timed out')), timeoutMs);
    if (request.signal?.aborted) abort();
    try {
        while (true) {
            const { done, value } = await Promise.race([reader.read(), interruption]);
            if (request.signal?.aborted) throw fail('REQUEST_CANCELLED', 499, 'Request cancelled');
            if (done) break;
            bytes += value.byteLength;
            if (bytes > maxBytes) throw fail('REQUEST_TOO_LARGE', 413, 'Request body is too large');
            chunks.push(value);
        }
        if (length !== null && bytes !== Number(length)) throw fail('INVALID_REQUEST', 400, 'Content-Length does not match the body');
        return Buffer.concat(chunks, bytes);
    } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', abort);
        reader.cancel().catch(() => {});
    }
}

function holdStreamingResponse(response, release, signal) {
    const reader = response.body.getReader();
    const abort = () => { reader.cancel(signal.reason).catch(() => {}); };
    const finish = () => { signal?.removeEventListener('abort', abort); release(); };
    signal?.addEventListener('abort', abort, { once: true });
    reader.closed.then(finish, finish);
    if (signal?.aborted) abort();
    return new Response(new ReadableStream({
        async pull(controller) {
            try {
                const next = await reader.read();
                if (next.done) controller.close(); else controller.enqueue(next.value);
            } catch (error) { controller.error(error); finish(); }
        },
        async cancel(reason) { try { await reader.cancel(reason); } finally { finish(); } },
    }), { status: response.status, statusText: response.statusText, headers: response.headers });
}

// Every API method uses this wrapper. API paths bypass Next Proxy's implicit
// body cloning, so admission and byte limits run before body buffering/parsing.
export function withApiResources(pathname, handler, options) {
    return async (request, context) => {
        let lease, streaming = false, detachAbort;
        const release = () => { detachAbort?.(); lease?.release(); };
        try {
            lease = acquireApiResources(request, pathname, options);
            const bytes = await readBoundedBody(request, lease.policy.maxBytes, options?.bodyTimeoutMs);
            if (request.body) {
                // Keep the original Request and controller reachable until the
                // response completes. Native Request signal forwarding uses
                // weak references and can otherwise disappear during GC.
                const original = request;
                const controller = new AbortController();
                const abort = () => controller.abort(original.signal.reason);
                original.signal.addEventListener('abort', abort, { once: true });
                detachAbort = () => original.signal.removeEventListener('abort', abort);
                if (original.signal.aborted) abort();
                request = new Request(request.url, { method: request.method, headers: request.headers, body: bytes, signal: controller.signal });
                bodyCache.set(request, bytes);
            }
            if (request.signal.aborted) throw new ApiResourceError('REQUEST_CANCELLED', 499, 'Request cancelled');
            const response = await handler(request, context);
            if (response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
                streaming = true;
                return holdStreamingResponse(response, release, request.signal);
            }
            return response;
        } catch (error) {
            if (error instanceof ApiResourceError) return resourceErrorResponse(error);
            throw error;
        } finally {
            if (!streaming) release();
        }
    };
}
