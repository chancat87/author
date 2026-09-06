import { constants, copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pin, verifyArchive } from './gitleaks.mjs';

// Gitleaks 8.30.1's archive detector treats names containing ".br" as Brotli,
// including ordinary .browser.js files. Scan retained copies under safe names
// and restore original paths in reports; never modify packaged resources.
export function snapshotArtifact(root, destination, alreadyExtractedFiles = []) {
    root = realpathSync(root);
    if (destination === root || destination.startsWith(`${root}${path.sep}`)) throw new Error('Artifact snapshot must be outside its input.');
    const excludes = new Set(alreadyExtractedFiles.map(file => {
        const filename = path.resolve(file);
        if (!filename.startsWith(`${root}${path.sep}`) || !lstatSync(filename).isFile()) throw new Error('Excluded archive must be an existing file inside the artifact.');
        return filename;
    }));
    const files = [];
    function walk(source, target) {
        mkdirSync(target, { recursive: true });
        for (const entry of readdirSync(source, { withFileTypes: true })) {
            const filename = path.join(source, entry.name);
            if (excludes.has(filename)) continue;
            // Preserve genuine .br archives; rename only misleading .br substrings.
            const safeName = entry.name.replace(/\.br(?!$)/gi, '.__br__');
            const copied = path.join(target, safeName);
            if (entry.isDirectory()) walk(filename, copied);
            else {
                if (entry.isSymbolicLink()) writeFileSync(copied, readlinkSync(filename), { flag: 'wx' });
                else if (entry.isFile()) copyFileSync(filename, copied, constants.COPYFILE_EXCL);
                else throw new Error('Unsupported entry in packaged resources.');
                files.push({ source: filename, snapshot: copied });
            }
        }
    }
    walk(root, destination);
    return files;
}

export function writeArtifactConfig(projectRoot, reportDirectory) {
    const bytes = readFileSync(path.join(projectRoot, '.tmp/gitleaks', pin.version, 'upstream-gitleaks.toml'));
    verifyArchive(bytes, pin.configSha256);
    const source = bytes.toString('utf8');
    const paths = /^paths = \[\n([^]*?)^\]/m;
    const match = source.match(paths);
    if (!match || !match[1].includes('node_modules')) throw new Error('Unexpected pinned Gitleaks config layout.');
    // Keep only default image/font/binary extension exclusions. Dependency,
    // lockfile, config and vendor directory exclusions do not apply to artifacts.
    const binaryPaths = match[1].split('\n').filter(line => line.includes('(?i)\\.(?:'));
    if (binaryPaths.length !== 3) throw new Error('Unexpected pinned binary exclusions.');
    const config = source.replace(paths, () => `paths = [\n${binaryPaths.join('\n')}\n]`);
    const filename = path.join(reportDirectory, 'artifact-gitleaks.toml');
    writeFileSync(filename, config, { flag: 'wx' });
    return filename;
}
