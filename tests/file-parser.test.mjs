import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parseFileIsolated } from '../app/lib/file-parser.js';
import { parseFileUpload } from '../app/lib/file-upload.js';
import { makePdf, makeDoc } from './helpers/parser-fixtures.mjs';

const workerPath = fileURLToPath(new URL('./helpers/parser-stress-child.cjs', import.meta.url));

for (const [format, fixture] of [['pdf', makePdf], ['doc', makeDoc]]) test(`real isolated ${format} parser extracts synthetic document text`, async () => {
    const text = await parseFileIsolated(fixture(), format);
    assert.match(text, new RegExp(`A10 synthetic ${format.toUpperCase()} text`));
});

test('CPU-bound parser is terminated while the parent remains responsive', async () => {
    let responsive = false;
    const result = parseFileIsolated(Buffer.alloc(0), 'cpu', { workerPath, timeoutMs: 250, sampleMemory: async () => 0 }).catch(error => error);
    await delay(30); responsive = true;
    assert.equal((await result).code, 'PARSE_TIMEOUT');
    assert.equal(responsive, true);
    assert.match(await parseFileIsolated(makePdf(), 'pdf'), /synthetic PDF/);
});

test('parser RSS limit terminates the child using the real OS memory measurement', async () => {
    await assert.rejects(parseFileIsolated(Buffer.alloc(0), 'cpu', { workerPath, maxResidentBytes: 1, timeoutMs: 5000 }), { code: 'PARSE_RESOURCE_LIMIT' });
});

test('cancelled parse terminates its child', async () => {
    const controller = new AbortController();
    const result = parseFileIsolated(Buffer.alloc(0), 'cpu', { workerPath, signal: controller.signal, sampleMemory: async () => 0 }).catch(error => error);
    await delay(50); controller.abort();
    assert.equal((await result).code, 'REQUEST_CANCELLED');
});

test('initial memory measurement failure prevents parsing and leaves the next parse available', async () => {
    await assert.rejects(parseFileIsolated(makePdf(), 'pdf', {
        sampleMemory: async () => { throw new Error('Synthetic OS measurement failure'); },
    }), { code: 'PARSE_UNAVAILABLE' });
    assert.match(await parseFileIsolated(makePdf(), 'pdf'), /synthetic PDF/);
});

test('the parsing deadline includes a slow initial memory measurement', async () => {
    let releaseMeasurement;
    const pendingMeasurement = new Promise(resolve => { releaseMeasurement = resolve; });
    try {
        await assert.rejects(parseFileIsolated(makePdf(), 'pdf', {
            timeoutMs: 100, sampleMemory: () => pendingMeasurement,
        }), { code: 'PARSE_TIMEOUT' });
    } finally { releaseMeasurement(0); }
});

test('oversized output and child crashes cannot return success', async () => {
    for (const format of ['oversized', 'crash']) {
        await assert.rejects(parseFileIsolated(Buffer.alloc(0), format, { workerPath, sampleMemory: async () => 0 }), { code: 'PARSE_RESOURCE_LIMIT' });
    }
});

test('corrupt files fail inside the child and leave the next parse available', async () => {
    await assert.rejects(parseFileIsolated(Buffer.from('%PDF-1.4\ncorrupt'), 'pdf'), { code: 'PARSE_FAILED' });
    assert.match(await parseFileIsolated(makeDoc(), 'doc'), /synthetic DOC/);
});

test('multipart parser accepts normal browser FormData including Unicode filenames', async () => {
    const form = new FormData(); form.append('file', new Blob([makePdf()]), '合成文档.pdf');
    const response = new Response(form);
    const result = parseFileUpload(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type'));
    assert.equal(result.format, 'pdf'); assert.deepEqual(result.buffer, makePdf());
});

test('multipart parser rejects multiple files, extra fields and mismatched signatures', async () => {
    for (const mode of ['extra-file', 'extra-field', 'signature']) {
        const form = new FormData(); form.append('file', new Blob([mode === 'signature' ? 'invalid' : makePdf()]), 'synthetic.pdf');
        if (mode === 'extra-file') form.append('file', new Blob([makePdf()]), 'second.pdf');
        if (mode === 'extra-field') form.append('field', 'unexpected');
        const response = new Response(form);
        const body = new Uint8Array(await response.arrayBuffer());
        assert.throws(() => parseFileUpload(body, response.headers.get('content-type')), { code: 'INVALID_UPLOAD' });
    }
});
