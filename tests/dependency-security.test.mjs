import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, symlink, lstat, readlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mergeAttributes } from '@tiptap/core';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import { NodeHfs } from '@humanfs/node';
import uri from 'fast-uri';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import mammoth from 'mammoth';

test('Tiptap rejects JSON prototype attributes while retaining normal formatting', () => {
    const untrusted = JSON.parse('{"__proto__":{"src":"invalid:","onerror":"synthetic"},"class":"imported"}');
    const attrs = mergeAttributes({ class: 'remark', title: 'Synthetic note' }, untrusted);
    assert.equal(Object.getPrototypeOf(attrs), Object.prototype);
    assert.equal('src' in attrs, false);
    assert.equal('onerror' in attrs, false);
    assert.equal(attrs.class, 'remark imported');
    assert.equal(attrs.title, 'Synthetic note');
});

test('xmldom rejects an entity name that would inject XML markup', () => {
    const doc = new DOMImplementation().createDocument(null, 'root', null);
    const serializer = new XMLSerializer();
    assert.equal(serializer.serializeToString(doc.createEntityReference('safe'), { requireWellFormed: true }), '&safe;');
    assert.throws(() => serializer.serializeToString(
        doc.createEntityReference('safe; <injected/> &x'), { requireWellFormed: true },
    ));
});

test('fast-uri resolves international hostnames consistently with the URL consumer', () => {
    const resolved = uri.resolve('https://example.test/base', '//bücher.example/path');
    assert.equal(resolved, 'https://xn--bcher-kva.example/path');
    assert.equal(uri.parse(resolved).host, new URL(resolved).hostname);
    assert.equal(new URL(resolved).hostname, 'xn--bcher-kva.example');
});

test('patched document dependencies preserve paragraphs and Unicode through DOCX import', async () => {
    const doc = new Document({ sections: [{ children: [
        new Paragraph({ children: [new TextRun({ text: '合成文稿 Café', bold: true })] }),
        new Paragraph('Second synthetic paragraph & <text>'),
    ] }] });
    const buffer = await Packer.toBuffer(doc);
    const { value } = await mammoth.convertToHtml({ buffer });
    assert.match(value, /<strong>合成文稿 Café<\/strong>/);
    assert.match(value, /Second synthetic paragraph &amp; &lt;text&gt;/);
    assert.equal((value.match(/<p>/g) || []).length, 2);
});

test('humanfs preserves symlinks instead of copying outside file contents', async (t) => {
    // Only synthetic files are used. Retain the fixture instead of deleting it.
    const root = await mkdtemp(path.join(tmpdir(), 'author-dependency-security-'));
    const source = path.join(root, 'source');
    const destination = path.join(root, 'copy');
    const outside = path.join(root, 'synthetic-outside.txt');
    await mkdir(source);
    await writeFile(outside, 'SYNTHETIC ONLY');
    await writeFile(path.join(source, 'normal.txt'), 'normal');
    try {
        await symlink(outside, path.join(source, 'link.txt'));
    } catch (error) {
        if (process.platform === 'win32' && error.code === 'EPERM') {
            t.skip('Windows denied creation of the synthetic file symlink (EPERM).');
            return;
        }
        throw error;
    }
    await new NodeHfs().copyAll(source, destination);
    assert.equal((await lstat(path.join(destination, 'link.txt'))).isSymbolicLink(), true);
    assert.equal(await readlink(path.join(destination, 'link.txt')), outside);
    assert.equal(await readFile(path.join(destination, 'normal.txt'), 'utf8'), 'normal');
});
