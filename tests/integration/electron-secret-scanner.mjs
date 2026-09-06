import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { brotliCompressSync } from 'node:zlib';
import { createPackage } from '@electron/asar';

function fixture() {
    const root = path.resolve('.tmp/electron-secret-tests');
    mkdirSync(root, { recursive: true });
    const fixture = mkdtempSync(path.join(root, 'run-'));
    const source = path.join(fixture, 'source');
    const app = path.join(fixture, 'win-unpacked');
    const resources = path.join(app, 'resources');
    mkdirSync(source);
    mkdirSync(path.join(resources, 'standalone'), { recursive: true });
    writeFileSync(path.join(source, 'main.js'), '// synthetic main\n');
    writeFileSync(path.join(resources, 'standalone/server.js'), '// synthetic runtime\n');
    return { source, app, resources };
}

function put(root, name, content) {
    const filename = path.join(root, name);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, content);
}

function scan(fixture, canaries = []) {
    const result = spawnSync(process.execPath, ['scripts/check-electron-secrets.mjs', fixture.app], {
        encoding: 'utf8', timeout: 120_000, windowsHide: true,
    });
    assert.equal(result.error, undefined);
    for (const canary of canaries) assert.equal(`${result.stdout}${result.stderr}`.includes(canary), false);
    const reports = [...result.stdout.matchAll(/Metadata report: (.+)/g)].map(match => JSON.parse(readFileSync(match[1].trim(), 'utf8')));
    for (const canary of canaries) assert.equal(JSON.stringify(reports).includes(canary), false);
    return { ...result, reports };
}

async function pack(fixture) {
    await createPackage(fixture.source, path.join(fixture.resources, 'app.asar'));
}

test('clean Electron resources pass without treating browser JavaScript as Brotli', async () => {
    const f = fixture();
    put(f.source, 'node_modules/synthetic/index.browser.js', 'export const value = 1;\n');
    await pack(f);
    const result = scan(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.reports.length, 2);
    assert.equal(result.reports.flatMap(report => report.findings).length, 0);
    assert.equal(result.reports[0].scope.renamedFiles, 1);
});

test('ASAR, dependency browser files, loose resources and config files all detect tokens exactly once', async () => {
    const f = fixture();
    const locations = [
        [f.source, 'main.js'],
        [f.source, 'node_modules/synthetic/index.browser.js'],
        [f.resources, 'standalone/.next/static/chunks/synthetic.js'],
        [f.resources, 'standalone/node_modules/synthetic/index.browser.js'],
        [f.resources, 'app.asar.unpacked/synthetic.txt'],
        [f.resources, '.gitleaks.toml'],
        [f.resources, 'package-lock.json'],
    ];
    const canaries = locations.map(([root, filename]) => {
        const token = ['ghp', randomBytes(18).toString('hex')].join('_');
        put(root, filename, `const token = '${token}'; // gitleaks:allow\n`);
        return token;
    });
    await pack(f);
    const result = scan(f, canaries);
    assert.equal(result.status, 1);
    const findings = result.reports.flatMap(report => report.blockingFindings);
    assert.equal(findings.length, locations.length);
    for (const [, filename] of locations) assert.ok(findings.some(finding => finding.file.endsWith(filename)));
    assert.equal(findings.filter(finding => finding.file.endsWith('main.js')).length, 1, 'ASAR must not be scanned twice');
    assert.equal(findings.filter(finding => finding.file.endsWith('index.browser.js')).length, 2, 'original browser filenames must be restored');
});

const reviewedDoc = 'node_modules/next/dist/docs/01-app/02-guides/environment-variables.md';

test('an exact reviewed documentation placeholder is reported separately from blocking findings', async () => {
    const f = fixture();
    put(f.source, reviewedDoc, readFileSync(reviewedDoc));
    await pack(f);
    const result = scan(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.reports[0].findings.length, 1);
    assert.equal(result.reports[0].reviewedDependencyFindings.length, 1);
    assert.equal(result.reports[0].blockingFindings.length, 0);
});

test('changing a reviewed file or putting the same text elsewhere cannot bypass scanning', async () => {
    const f = fixture();
    const canary = ['ghp', randomBytes(18).toString('hex')].join('_');
    const document = readFileSync(reviewedDoc, 'utf8');
    put(f.source, reviewedDoc, document + `\ntoken = '${canary}'\n`);
    put(f.source, 'custom-document.md', document);
    await pack(f);
    const result = scan(f, [canary]);
    assert.equal(result.status, 1);
    assert.equal(result.reports[0].reviewedDependencyFindings.length, 0);
    assert.ok(result.reports[0].blockingFindings.some(finding => finding.rule === 'github-pat'));
    assert.equal(result.reports[0].blockingFindings.filter(finding => finding.rule === 'private-key').length, 2);
});

test('missing and malformed ASAR files fail the package check', () => {
    const missing = fixture();
    assert.equal(scan(missing).status, 1);
    const malformed = fixture();
    put(malformed.resources, 'app.asar', 'not an ASAR archive');
    const result = scan(malformed);
    assert.equal(result.status, 1);
    assert.equal(result.reports.length, 0);
});

test('archive read errors cannot be reported as a clean scan', async () => {
    const f = fixture();
    put(f.resources, 'broken.br', Buffer.from([255, 255, 255, 255]));
    await pack(f);
    const result = scan(f);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NOT a clean scan/);
});

test('genuine Brotli and nested TAR payloads remain covered with original archive paths', async () => {
    const f = fixture();
    const canary = ['ghp', randomBytes(18).toString('hex')].join('_');
    const payload = path.join(path.dirname(f.source), 'payload');
    const nested = path.join(path.dirname(f.source), 'nested');
    put(payload, 'token.txt', `token = '${canary}'\n`);
    mkdirSync(nested);
    const inner = spawnSync('tar', ['-cf', path.join(nested, 'inner.tar'), '-C', payload, 'token.txt'], { windowsHide: true });
    assert.equal(inner.status, 0);
    const outer = spawnSync('tar', ['-cf', path.join(f.resources, 'outer.tar'), '-C', nested, 'inner.tar'], { windowsHide: true });
    assert.equal(outer.status, 0);
    put(f.resources, 'token.br', brotliCompressSync(Buffer.from(`token = '${canary}'\n`)));
    await pack(f);
    const result = scan(f, [canary]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.reports.length, 2, result.stderr);
    const findings = result.reports[1].blockingFindings;
    assert.ok(findings.some(finding => finding.file.includes('/resources/outer.tar')));
    assert.ok(findings.some(finding => finding.file.includes('/resources/token.br')));
});
