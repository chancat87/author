import { spawnSync } from 'node:child_process';

export function git(root, args) {
    const result = spawnSync('git', ['-c', `safe.directory=${root}`, ...args], {
        cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true,
    });
    if (result.error || result.status !== 0) throw new Error(`Git ${args[0]} failed (${result.error?.code || result.status}).`);
    return result.stdout;
}

// Include tracked files even when an ignore rule matches, plus nonignored new files.
export function repositoryFiles(root = process.cwd()) {
    return [...new Set(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort();
}
