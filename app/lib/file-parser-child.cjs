// Separate, disposable Node process. No manuscript or temporary file is written.
const MAX_TEXT_CHARS = 4 * 1024 * 1024;
const MAX_PAGES = 1000;
const resourceError = () => Object.assign(new Error('Parser resource limit'), { code: 'PARSE_RESOURCE_LIMIT' });

async function parsePdf(buffer) {
    const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
    pdfjs.disableWorker = true;
    // Old PDF.js transfers the backing ArrayBuffer and loses Buffer offsets.
    // Give it an owned, zero-offset view, including for small pooled buffers.
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true });
    try {
        if (doc.numPages > MAX_PAGES) throw resourceError();
        const pages = [];
        let characters = 0;
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
            const page = await doc.getPage(pageNumber);
            const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
            const pieces = [];
            let previousY;
            for (const item of content.items) {
                const prefix = previousY !== undefined && previousY !== item.transform?.[5] ? '\n' : '';
                const value = prefix + (item.str || '');
                characters += value.length;
                if (characters > MAX_TEXT_CHARS) throw resourceError();
                pieces.push(value);
                previousY = item.transform?.[5];
            }
            characters += 2;
            pages.push(pieces.join(''));
            page.cleanup();
        }
        return pages.join('\n\n');
    } finally { await doc.destroy(); }
}

process.once('message', async ({ format, buffer }) => {
    let result;
    try {
        let text;
        if (format === 'pdf') text = await parsePdf(buffer);
        else if (format === 'doc') {
            const WordExtractor = require('word-extractor');
            text = (await new WordExtractor().extract(buffer)).getBody() || '';
        } else throw new Error('Invalid format');
        if (text.length > MAX_TEXT_CHARS) throw resourceError();
        result = { text };
    } catch (error) {
        result = { code: error.code === 'PARSE_RESOURCE_LIMIT' ? error.code : 'PARSE_FAILED' };
    }
    process.send(result, () => process.exit(0));
});
process.on('disconnect', () => process.exit(0));
