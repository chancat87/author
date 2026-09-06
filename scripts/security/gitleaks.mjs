import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const pin = JSON.parse(readFileSync(new URL('./gitleaks-version.json', import.meta.url), 'utf8'));

export function verifyArchive(bytes, expectedHash) {
    if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
        throw new Error('Gitleaks archive SHA-256 mismatch; refusing to execute it.');
    }
}

export async function installArtifactConfig(root = process.cwd()) {
    const cache = path.join(root, '.tmp', 'gitleaks', pin.version);
    mkdirSync(cache, { recursive: true });
    const config = path.join(cache, 'upstream-gitleaks.toml');
    if (!existsSync(config)) {
        const response = await fetch(`https://raw.githubusercontent.com/gitleaks/gitleaks/v${pin.version}/config/gitleaks.toml`, {
            signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) throw new Error(`Gitleaks config download failed: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        verifyArchive(bytes, pin.configSha256);
        writeFileSync(config, bytes, { flag: 'wx' });
    }
    verifyArchive(readFileSync(config), pin.configSha256);
    return config;
}

// Keep the verified download in the ignored workspace cache. Never install globally.
export async function installGitleaks(root = process.cwd()) {
    const platform = `${process.platform}-${process.arch}`;
    const asset = pin.archives[platform];
    if (!asset) throw new Error(`Unsupported scanner platform: ${platform}`);
    const cache = path.join(root, '.tmp', 'gitleaks', pin.version, platform);
    mkdirSync(cache, { recursive: true });
    const archive = path.join(cache, asset.name);
    if (!existsSync(archive)) {
        const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${pin.version}/${asset.name}`, {
            signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) throw new Error(`Gitleaks download failed: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        verifyArchive(bytes, asset.sha256);
        writeFileSync(archive, bytes, { flag: 'wx' });
    }
    verifyArchive(readFileSync(archive), asset.sha256);
    const filename = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
    // Extract only the executable to memory; no archive paths are written to disk.
    const extracted = spawnSync('tar', ['-xOf', archive, filename], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    if (extracted.error || extracted.status !== 0 || !extracted.stdout?.length) {
        throw new Error('Unable to extract the verified Gitleaks executable (tar is required).');
    }
    const executable = path.join(cache, filename);
    if (existsSync(executable)) {
        if (!readFileSync(executable).equals(extracted.stdout)) throw new Error('Cached Gitleaks executable has changed.');
    } else {
        writeFileSync(executable, extracted.stdout, { flag: 'wx', mode: 0o755 });
    }
    if (process.platform !== 'win32') chmodSync(executable, 0o755);
    return executable;
}
