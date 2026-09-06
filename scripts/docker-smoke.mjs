import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { makePdf, makeDoc } from '../tests/helpers/parser-fixtures.mjs';

const image = process.argv[2];
if (!image || image.startsWith('-')) throw new Error('Usage: node scripts/docker-smoke.mjs <local-image-tag>');
const inspected = spawnSync('docker', ['image', 'inspect', image], { encoding: 'utf8', windowsHide: true });
assert.equal(inspected.status, 0, inspected.stderr || inspected.error?.message);
const config = JSON.parse(inspected.stdout)[0].Config;
assert.deepEqual(config.Cmd, ['node', 'server.js']);
assert.equal(config.User, 'node');
assert.equal(config.WorkingDir, '/app');
assert.ok(!config.Env.some(item => /^(AUTHOR_DESKTOP_CAPABILITY|AUTHOR_ENABLE_FILE_STORAGE)=.+/.test(item)));

const source = await readFile(new URL('./docker-smoke-runtime.mjs', import.meta.url), 'utf8');
const fixtures = { pdf: makePdf().toString('base64'), doc: makeDoc().toString('base64') };
const stamp = `${Date.now()}-${process.pid}`;
for (const mode of ['public', 'integration']) {
    const name = `author-smoke-${stamp}-${mode}`;
    console.log(`Testing ${image} in ${name}; no external network, host ports or host files are mounted.`);
    // These finite test containers finish when the harness exits. Keep the
    // stopped containers and their anonymous data volumes for inspection.
    // No docker stop/rm/prune or automatic volume removal is performed.
    const args = ['run', '--interactive', '--name', name, '--network', 'none',
        '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
        '--memory', '768m', '--cpus', '2', '--pids-limit', '128',
        '--entrypoint', 'node', image, '--input-type=module'];
    const input = source + `\nsetTimeout(() => {
        console.error('Docker smoke test exceeded its 120-second deadline.');
        process.exit(1);
    }, 120_000).unref();
    runDockerSmoke(${JSON.stringify({ mode, ...fixtures })})
        .then(result => { console.log(JSON.stringify(result)); process.exit(0); })
        .catch(error => { console.error(error); process.exit(1); });\n`;
    const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    assert.equal(result.status, 0, result.error?.message || `Container ${name} failed; retained for inspection.`);
}
console.log('Docker smoke checks passed. Stopped containers and synthetic data volumes are retained.');
