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

const firebaseFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const firebaseEnvironment = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'];

// Only the explicitly supplied Firebase web configuration may be public.
// Other Google keys, source/history matches and adjacent credentials stay blocked.
export function expectedFirebaseClientKey(finding, target, env = process.env) {
    if (finding.rule !== 'gcp-api-key' || finding.line !== finding.endLine) return false;
    const expected = firebaseEnvironment.map(name => env[name]);
    if (expected.some(value => typeof value !== 'string' || !value) || !/^AIza[\w-]{35}$/.test(expected[0])) return false;
    const filename = path.resolve(finding.file);
    const relative = path.relative(target, filename).replaceAll('\\', '/');
    if (relative.startsWith('../') || path.isAbsolute(relative) || !/(?:^|\/)\.next\/(?:static\/(?:immutable\/)?chunks|server\/chunks)\/.+\.js$/.test(relative)) return false;
    try {
        const line = readFileSync(filename, 'utf8').split(/\r?\n/)[finding.line - 1] || '';
        const pattern = new RegExp('\\{\\s*' + firebaseFields.map(field => `(?:${field}|"${field}")\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`).join('\\s*,\\s*') + '(?=\\s*[,}])', 'g');
        for (const match of line.matchAll(pattern)) {
            if (!expected.every((value, index) => JSON.parse(match[index + 1]) === value)) continue;
            const valueOffset = match.index + match[0].indexOf(match[1]) + 1;
            const column = Buffer.byteLength(line.slice(0, valueOffset), 'utf8') + 1;
            if (finding.column === column && finding.endColumn >= column + expected[0].length - 1 && finding.endColumn <= column + expected[0].length) return true;
        }
    } catch { /* Unknown layouts fail closed. */ }
    return false;
}
