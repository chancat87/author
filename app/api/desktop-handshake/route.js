import { createHmac } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request) {
    const capability = String(process.env.AUTHOR_DESKTOP_CAPABILITY || '');
    const challenge = new URL(request.url).searchParams.get('challenge') || '';

    if (!capability || !/^[A-Za-z0-9_-]{32,128}$/.test(challenge)) {
        return Response.json({ error: 'Not found' }, {
            status: 404,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    const proof = createHmac('sha256', capability).update(challenge).digest('hex');
    return Response.json({ proof }, { headers: { 'Cache-Control': 'no-store' } });
}
