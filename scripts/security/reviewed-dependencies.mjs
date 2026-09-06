import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pin } from './gitleaks.mjs';

const reviewed = JSON.parse(readFileSync(new URL('./reviewed-dependency-findings.json', import.meta.url), 'utf8'));

export function createDependencyReviewer(artifactFiles) {
    const originals = new Map(artifactFiles.map(file => [path.resolve(file.snapshot), file.source.replaceAll('\\', '/')]));
    const hashes = new Map();
    return finding => {
        if (reviewed.scannerVersion !== pin.version) return false;
        const filename = path.resolve(finding.file);
        const original = originals.get(filename);
        if (!original) return false;
        const entry = reviewed.files.find(file => original.endsWith(`/${file.file}`));
        if (!entry) return false;
        const expected = entry.findings.find(item => ['rule', 'line', 'endLine', 'column', 'endColumn'].every(key => item[key] === finding[key]));
        if (!expected) return false;
        if (!hashes.has(filename)) hashes.set(filename, createHash('sha256').update(readFileSync(filename)).digest('hex'));
        return hashes.get(filename) === entry.sha256 ? expected.reason : false;
    };
}
