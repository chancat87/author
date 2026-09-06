import { withApiResources, readBoundedBody, MAX_UPLOAD_BYTES, ApiResourceError, resourceErrorResponse } from '../../lib/api-resource-guard.js';
import { parseFileUpload } from '../../lib/file-upload.js';
import { parseFileIsolated } from '../../lib/file-parser.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function handlePOST(request) {
    try {
        const bytes = await readBoundedBody(request, MAX_UPLOAD_BYTES);
        const { buffer, format } = parseFileUpload(bytes, request.headers.get('content-type'));
        const text = await parseFileIsolated(buffer, format, { signal: request.signal });
        if (!text.trim()) return Response.json({ text: '', warning: '文件中未能提取到文本内容（可能是扫描件或图片PDF）', code: 'PARSE_NO_TEXT' });
        return Response.json({ text });
    } catch (error) {
        if (error instanceof ApiResourceError) return resourceErrorResponse(error);
        console.error('parse-file error:', error?.code || error?.name || 'UNKNOWN');
        return Response.json({ error: '解析失败', code: 'PARSE_FAILED' }, { status: 422 });
    }
}

export const POST = withApiResources('/api/parse-file', handlePOST);
