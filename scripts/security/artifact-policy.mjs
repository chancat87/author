import { readFileSync } from 'node:fs';
import path from 'node:path';

// These are real, build-generated Next.js runtime keys, not user/provider credentials.
// Keep them in reports. Do not allow an entire file, directory, rule, or source/history match.
export function expectedNextRuntimeKey(finding, target) {
    if (finding.rule !== 'generic-api-key') return false;
    const filename = path.resolve(finding.file);
    const relative = path.relative(target, filename).replaceAll('\\', '/');
    if (relative.startsWith('../') || path.isAbsolute(relative)) return false;
    let pattern;
    if (/(?:^|\/)\.next\/prerender-manifest\.json$/.test(relative)) {
        pattern = /^\s*"(previewModeSigningKey|previewModeEncryptionKey)":\s*"[a-f0-9]{64}"[,]?\s*$/;
    } else if (/(?:^|\/)\.next\/server\/server-reference-manifest\.json$/.test(relative)) {
        pattern = /^\s*"encryptionKey":\s*"[A-Za-z0-9+/]{43}="[,]?\s*$/;
    } else return false;
    try {
        const contents = readFileSync(filename, 'utf8');
        if (!pattern.test(contents.split(/\r?\n/)[finding.line - 1] || '')) return false;
        const nextRoot = filename.slice(0, filename.lastIndexOf(`${path.sep}.next${path.sep}`));
        const actions = JSON.parse(readFileSync(path.join(nextRoot, '.next/server/server-reference-manifest.json'), 'utf8'));
        // Enabling Server Actions requires revisiting the distribution/key policy.
        if (!actions.node || !actions.edge || Object.keys(actions.node).length || Object.keys(actions.edge).length) return false;
        return true;
    } catch {
        return false;
    }
}
