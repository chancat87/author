import { statSync } from 'node:fs';
import { win32 } from 'node:path';

function isFile(file) {
    try { return statSync(file).isFile(); } catch { return false; }
}

// Windows cannot launch npm.cmd without a shell. Run npm's JavaScript entry
// with the current Node executable instead, keeping paths and arguments separate.
export function resolveNpmCommand({
    platform = process.platform,
    execPath = process.execPath,
    env = process.env,
    fileExists = isFile,
} = {}) {
    if (platform !== 'win32') return { cmd: 'npm', args: [] };

    const pathKey = Object.keys(env).sort().find(key => key.toLowerCase() === 'path');
    const pathDirectories = String(env[pathKey] || '').split(';')
        .map(value => value.trim().replace(/^"(.*)"$/, '$1'))
        .filter(value => win32.isAbsolute(value));
    const candidates = [
        // npm start / npm run dev supplies the exact npm installation in use.
        env.npm_execpath,
        ...pathDirectories.map(directory => win32.join(directory, 'node_modules', 'npm', 'bin', 'npm-cli.js')),
        // Also support starting Next directly with node.exe.
        win32.join(win32.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ];
    const entry = candidates.find(candidate => typeof candidate === 'string'
        && win32.isAbsolute(candidate)
        && win32.basename(candidate).toLowerCase() === 'npm-cli.js'
        && fileExists(candidate));
    if (!entry) {
        const error = new Error('Cannot find npm-cli.js. Start the server with npm or repair the Node.js/npm installation.');
        error.code = 'SOURCE_UPDATE_NPM_NOT_FOUND';
        throw error;
    }
    return { cmd: execPath, args: [entry] };
}
