import { NextResponse } from 'next/server';

const CAPABILITY_COOKIE = 'author-desktop-capability';
const HANDSHAKE_PATH = '/api/desktop-handshake';
const rateBuckets = globalThis.__AUTHOR_REQUEST_RATE_BUCKETS__ || new Map();
globalThis.__AUTHOR_REQUEST_RATE_BUCKETS__ = rateBuckets;

const API_POLICIES = [
    { prefix: HANDSHAKE_PATH, limit: 30, windowMs: 60_000, maxBytes: 0 },
    { prefix: '/api/parse-file', limit: 10, windowMs: 60_000, maxBytes: 52 * 1024 * 1024 },
    { prefix: '/api/sync/lan', limit: 30, windowMs: 60_000, maxBytes: 12 * 1024 * 1024 },
    { prefix: '/api/sync/webdav', limit: 120, windowMs: 60_000, maxBytes: 12 * 1024 * 1024 },
    { prefix: '/api/ai', limit: 60, windowMs: 60_000, maxBytes: 12 * 1024 * 1024 },
    { prefix: '/api/tts', limit: 60, windowMs: 60_000, maxBytes: 12 * 1024 * 1024 },
    { prefix: '/api/embed', limit: 60, windowMs: 60_000, maxBytes: 12 * 1024 * 1024 },
    { prefix: '/api/tools/search', limit: 60, windowMs: 60_000, maxBytes: 2 * 1024 * 1024 },
    { prefix: '/api/update-source', limit: 3, windowMs: 60_000, maxBytes: 0 },
];

function constantTimeTextEqual(left, right) {
    const a = String(left || '');
    const b = String(right || '');
    const length = Math.max(a.length, b.length);
    let mismatch = a.length ^ b.length;
    for (let index = 0; index < length; index++) {
        mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
    }
    return mismatch === 0;
}

function requestClientId(request) {
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return 'unknown-client';
}

function enforceApiPolicy(request) {
    const pathname = request.nextUrl.pathname;
    const policy = API_POLICIES.find(candidate => pathname.startsWith(candidate.prefix));
    if (!policy) return null;

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (policy.maxBytes > 0 && Number.isFinite(contentLength) && contentLength > policy.maxBytes) {
        return NextResponse.json(
            { error: 'Request body is too large', code: 'REQUEST_TOO_LARGE' },
            { status: 413, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const now = Date.now();
    if (rateBuckets.size > 5000) {
        for (const [key, bucket] of rateBuckets) {
            if (bucket.resetAt <= now) rateBuckets.delete(key);
        }
    }
    const bucketKey = `${requestClientId(request)}:${policy.prefix}`;
    let bucket = rateBuckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + policy.windowMs };
        rateBuckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    if (bucket.count > policy.limit) {
        return NextResponse.json(
            { error: 'Too many requests', code: 'RATE_LIMITED' },
            {
                status: 429,
                headers: {
                    'Cache-Control': 'no-store',
                    'Retry-After': String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
                },
            },
        );
    }
    return null;
}

export function proxy(request) {
    const expected = String(process.env.AUTHOR_DESKTOP_CAPABILITY || '');
    if (expected && request.nextUrl.pathname !== HANDSHAKE_PATH) {
        const actual = request.cookies.get(CAPABILITY_COOKIE)?.value || '';
        if (!constantTimeTextEqual(actual, expected)) {
            if (request.nextUrl.pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Desktop capability required', code: 'DESKTOP_CAPABILITY_REQUIRED' },
                    { status: 401, headers: { 'Cache-Control': 'no-store' } },
                );
            }

            return new NextResponse('Unauthorized', {
                status: 401,
                headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }
    }

    return enforceApiPolicy(request) || NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
