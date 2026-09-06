import { ApiResourceError, MAX_FILE_BYTES } from './api-resource-guard.js';

// This endpoint accepts exactly one browser FormData file. Parse only a bounded
// header and expose a slice of the already bounded body, avoiding formData()'s
// allocation of arbitrary numbers of attacker-supplied fields/files.
export function parseFileUpload(bytes, contentType) {
    const fail = () => { throw new ApiResourceError('INVALID_UPLOAD', 400, 'Expected one PDF or DOC file'); };
    if (!/^multipart\/form-data\s*;/i.test(contentType || '')) fail();
    const boundaryMatch = contentType.match(/(?:^|;)\s*boundary=(?:"([^"\r\n]+)"|([^;\s]+))/i);
    const boundary = boundaryMatch?.[1] || boundaryMatch?.[2] || '';
    if (!/^[\x20-\x7e]{1,70}$/.test(boundary)) fail();
    const body = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const start = Buffer.from(`--${boundary}\r\n`);
    if (!body.subarray(0, start.length).equals(start)) fail();
    const headerEnd = body.indexOf('\r\n\r\n', start.length);
    if (headerEnd < 0 || headerEnd - start.length > 16 * 1024) fail();
    const headers = body.subarray(start.length, headerEnd).toString('utf8').split('\r\n');
    const dispositions = headers.filter(line => /^content-disposition:/i.test(line));
    if (dispositions.length !== 1 || !/^content-disposition:\s*form-data\s*;/i.test(dispositions[0])) fail();
    const disposition = dispositions[0];
    if (!/;\s*name="file"(?:;|$)/i.test(disposition)) fail();
    const name = disposition.match(/;\s*filename="([^"\r\n]*)"(?:;|$)/i)?.[1];
    if (!name) fail();
    const format = name.toLowerCase().endsWith('.pdf') ? 'pdf' : name.toLowerCase().endsWith('.doc') ? 'doc' : '';
    if (!format) throw new ApiResourceError('UNSUPPORTED_FORMAT', 400, 'Unsupported file format');
    const delimiter = Buffer.from(`\r\n--${boundary}`);
    const end = body.indexOf(delimiter, headerEnd + 4);
    if (end < 0) fail();
    if (body.length - end - delimiter.length > 4) fail();
    const tail = body.subarray(end + delimiter.length).toString('ascii');
    if (tail !== '--\r\n' && tail !== '--') fail();
    const buffer = body.subarray(headerEnd + 4, end);
    if (buffer.length > MAX_FILE_BYTES) throw new ApiResourceError('FILE_TOO_LARGE', 413, 'File is too large');
    const signatureValid = format === 'pdf'
        ? buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))
        : buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    if (!signatureValid) throw new ApiResourceError('INVALID_UPLOAD', 400, 'File content does not match its format');
    return { buffer, format };
}
