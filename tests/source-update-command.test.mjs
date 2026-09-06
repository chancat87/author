import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { resolveNpmCommand } from '../app/lib/source-update-command.mjs';
import { redactSensitiveText } from '../app/lib/server-security.mjs';

const nodePath = 'C:\\Program Files\\Node & Tools\\node.exe';
const npmPath = 'C:\\User Tools\\npm & cli\\bin\\npm-cli.js';
function windowsNpm(env = { npm_execpath: npmPath }, available = [npmPath]) {
    return resolveNpmCommand({ platform: 'win32', execPath: nodePath, env, fileExists: file => available.includes(file) });
}

test('Windows uses the npm lifecycle CLI with paths containing spaces and shell characters intact', () => {
    assert.deepEqual(windowsNpm(), { cmd: nodePath, args: [npmPath] });
});

test('Windows direct-node startup finds npm beside node.exe without npm environment variables', () => {
    const bundled = path.win32.join(path.win32.dirname(nodePath), 'node_modules/npm/bin/npm-cli.js');
    assert.deepEqual(windowsNpm({}, [bundled]), { cmd: nodePath, args: [bundled] });
});

test('Windows finds a separate npm installation on a quoted, case-insensitive Path', () => {
    const cli = 'D:\\Separate npm\\node_modules\\npm\\bin\\npm-cli.js';
    assert.deepEqual(windowsNpm({ Path: 'relative;;"D:\\Separate npm"' }, [cli]), { cmd: nodePath, args: [cli] });
});

test('an unrelated package-manager or stale lifecycle entry falls back to installed npm', () => {
    const bundled = path.win32.join(path.win32.dirname(nodePath), 'node_modules/npm/bin/npm-cli.js');
    for (const entry of ['C:\\tools\\yarn.js', 'npm-cli.js', 'C:\\missing\\npm-cli.js', 'C:\\tools\\npm.cmd']) {
        assert.deepEqual(windowsNpm({ npm_execpath: entry }, [entry, bundled].filter(file => !file.includes('missing'))), {
            cmd: nodePath, args: [bundled],
        });
    }
});

test('Windows reports a missing npm installation without trying a shell or relative PATH entries', () => {
    assert.throws(() => windowsNpm({ Path: '.;node_modules/.bin' }, []), { code: 'SOURCE_UPDATE_NPM_NOT_FOUND' });
});

test('Linux and macOS retain normal npm executable lookup', () => {
    for (const platform of ['linux', 'darwin']) {
        assert.deepEqual(resolveNpmCommand({ platform, fileExists: () => assert.fail('unneeded lookup') }), { cmd: 'npm', args: [] });
    }
});

// Load the actual routes, replacing only their imports with controlled services.
// No update command or user-data operation is executed by these route tests.
function routeFixture(kind, { authorized = true, missingNpm = false, upToDate = false, failedCall = 0, spawnThrows = false } = {}) {
    const calls = [];
    let resolutions = 0;
    const fail = () => new Error('Synthetic npm failure');
    const output = index => index === 1 ? (upToDate ? 'Already up to date.\n' : 'Updating synthetic checkout\n') : 'Synthetic command completed\n';
    const context = {
        Response, NextResponse: { json: (data, options) => Response.json(data, options) },
        ReadableStream, TextEncoder, setTimeout, clearTimeout,
        process: { cwd: () => 'synthetic-source-checkout', env: {} },
        existsSync: () => true, readFileSync: () => '{"version":"1.2.55"}', join: path.join,
        withApiResources: (_route, handler) => handler,
        authorizeSourceUpdate: () => ({ ok: authorized, status: 403, code: 'SOURCE_UPDATE_DISABLED' }),
        redactSensitiveText,
        resolveNpmCommand: () => {
            resolutions++;
            return windowsNpm({}, missingNpm ? [] : [path.win32.join(path.win32.dirname(nodePath), 'node_modules/npm/bin/npm-cli.js')]);
        },
        execFileSync: (cmd, args, options) => {
            calls.push({ cmd, args: [...args], options });
            if (calls.length === failedCall) throw fail();
            return output(calls.length);
        },
        spawn: (cmd, args, options) => {
            calls.push({ cmd, args: [...args], options });
            if (spawnThrows) throw fail();
            const child = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.kill = () => assert.fail('these synthetic commands must finish without timeout');
            const index = calls.length;
            queueMicrotask(() => {
                child.stdout.emit('data', output(index));
                if (index === failedCall) {
                    child.stderr.emit('data', 'Authorization: Bearer test-sensitive');
                    child.emit('close', 1);
                } else child.emit('close', 0);
            });
            return child;
        },
    };
    const filename = new URL(`../app/api/${kind}/route.js`, import.meta.url);
    const source = readFileSync(filename, 'utf8').replace(/^import .+;\r?$/gm, '')
        .replace('export const POST =', 'const POST =');
    const POST = vm.runInNewContext(`${source}\nPOST;`, context, { filename: filename.pathname });
    return {
        calls, resolutions: () => resolutions,
        async run() {
            const response = await POST(new Request('http://localhost/api/test-update', { method: 'POST' }));
            if (response.headers.get('content-type')?.includes('text/event-stream')) {
                const raw = await response.text();
                const events = raw.split('\n\n').filter(Boolean).map(line => JSON.parse(line.slice(6)));
                return { status: response.status, events, body: events.at(-1), raw };
            }
            const body = await response.json();
            return { status: response.status, body, raw: JSON.stringify(body) };
        },
    };
}

for (const kind of ['update-source', 'update-source-stream']) {
    test(`${kind}: authorization blocks resolution and all child processes`, async () => {
        const fixture = routeFixture(kind, { authorized: false });
        assert.equal((await fixture.run()).status, 403);
        assert.equal(fixture.resolutions(), 0);
        assert.deepEqual(fixture.calls, []);
    });

    test(`${kind}: missing npm fails before pulling source`, async () => {
        const fixture = routeFixture(kind, { missingNpm: true });
        const result = await fixture.run();
        assert.equal(result.body.success, false);
        assert.match(result.raw, /Cannot find npm-cli\.js/);
        assert.deepEqual(fixture.calls, []);
    });

    test(`${kind}: install and build use Node plus npm CLI, without a shell`, async () => {
        const fixture = routeFixture(kind);
        const result = await fixture.run();
        assert.equal(result.body.success, true);
        assert.equal(result.body.alreadyUpToDate, false);
        const cli = path.win32.join(path.win32.dirname(nodePath), 'node_modules/npm/bin/npm-cli.js');
        assert.deepEqual(fixture.calls.map(({ cmd, args }) => [cmd, args]), [
            ['git', ['pull']], [nodePath, [cli, 'install']], [nodePath, [cli, 'run', 'build']],
        ]);
        for (const { options } of fixture.calls) {
            assert.ok(!options.shell);
            assert.equal(options.windowsHide, true);
            assert.equal(options.cwd, 'synthetic-source-checkout');
        }
        assert.equal(fixture.resolutions(), 1);
    });

    test(`${kind}: an up-to-date checkout does not install or build`, async () => {
        const fixture = routeFixture(kind, { upToDate: true });
        const result = await fixture.run();
        assert.equal(result.body.success, true);
        assert.equal(result.body.alreadyUpToDate, true);
        assert.equal(fixture.calls.length, 1);
    });

    for (const [step, failedCall] of [['pull', 1], ['install', 2], ['build', 3]]) {
        test(`${kind}: ${step} failure stops the sequence and reports failure`, async () => {
            const fixture = routeFixture(kind, { failedCall });
            const result = await fixture.run();
            assert.equal(result.body.success, false);
            assert.equal(fixture.calls.length, failedCall);
            assert.doesNotMatch(result.raw, /test-sensitive/);
            if (kind === 'update-source') assert.equal(result.status, 500);
            else {
                assert.equal(result.body.code, 'UPDATE_STEP_FAILED');
                assert.equal(result.body.step, failedCall);
            }
        });
    }
}

test('streaming update closes with a failure event if spawning throws synchronously', async () => {
    const fixture = routeFixture('update-source-stream', { spawnThrows: true });
    const result = await fixture.run();
    assert.equal(result.body.success, false);
    assert.match(result.body.error, /Synthetic npm failure/);
    assert.equal(fixture.calls.length, 1);
});

test('resolved npm really starts through both process APIs (version query only)', async () => {
    const { cmd, args } = resolveNpmCommand();
    const options = { shell: false, windowsHide: true, env: { ...process.env, npm_config_update_notifier: 'false', npm_config_logs_max: '0' } };
    const syncVersion = execFileSync(cmd, [...args, '--version'], { ...options, encoding: 'utf8', timeout: 15000 }).trim();
    assert.match(syncVersion, /^\d+\.\d+\.\d+/);
    const asyncVersion = await new Promise((resolve, reject) => {
        const child = spawn(cmd, [...args, '--version'], options);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`npm --version failed (${code}): ${stderr}`)));
    });
    assert.equal(asyncVersion, syncVersion);
});
