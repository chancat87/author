import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { ApiResourceError } from './api-resource-guard.js';

const run = promisify(execFile);
const MAX_TEXT_CHARS = 4 * 1024 * 1024;
// Keep the fork target as a runtime filesystem path. Turbopack otherwise tries
// to bundle it as a /ROOT import on Linux. next.config.mjs explicitly includes
// the standalone child and its parser dependencies in the deployed output.
const { fork } = process.getBuiltinModule('node:child_process');

async function residentBytes(pid) {
    if (process.platform === 'linux') {
        const status = await readFile(`/proc/${pid}/status`, 'utf8');
        const match = status.match(/^VmRSS:\s+(\d+)\s+kB/m);
        if (!match) throw new Error('Cannot read parser memory');
        return Number(match[1]) * 1024;
    }
    const options = { windowsHide: true, timeout: 2000, maxBuffer: 4096 };
    const { stdout } = process.platform === 'win32'
        ? await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid} -ErrorAction Stop).WorkingSet64`], options)
        : await run('ps', ['-o', 'rss=', '-p', String(pid)], options);
    const value = Number(stdout.trim());
    if (!Number.isFinite(value) || value <= 0) throw new Error('Cannot read parser memory');
    return value * (process.platform === 'win32' ? 1 : 1024);
}

export async function parseFileIsolated(buffer, format, {
    signal, timeoutMs = 20_000, maxResidentBytes = 384 * 1024 * 1024,
    workerPath = path.join(process.cwd(), 'app/lib/file-parser-child.cjs'),
    sampleMemory = residentBytes, sampleIntervalMs = 250,
} = {}) {
    if (signal?.aborted) throw new ApiResourceError('REQUEST_CANCELLED', 499, 'Request cancelled');
    // The child receives no app credentials or deployment environment.
    const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR']
        .filter(key => process.env[key]).map(key => [key, process.env[key]]));
    env.ELECTRON_RUN_AS_NODE = '1';
    let child;
    try {
        child = fork(workerPath, [], {
            execArgv: ['--max-old-space-size=192', '--max-semi-space-size=16', '--disable-proto=throw'],
            serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true, env,
        });
    } catch {
        throw new ApiResourceError('PARSE_UNAVAILABLE', 503, 'Parser could not be started');
    }
    return new Promise((resolve, reject) => {
        let finished = false, result, failure, sampling = false;
        const fail = (code, status, message) => {
            if (finished || failure) return;
            failure = new ApiResourceError(code, status, message);
            child.kill('SIGKILL');
        };
        const abort = () => fail('REQUEST_CANCELLED', 499, 'Request cancelled');
        const timer = setTimeout(() => fail('PARSE_TIMEOUT', 408, 'File parsing timed out'), timeoutMs);
        const inspectMemory = async () => {
            if (sampling || finished || failure) return;
            sampling = true;
            try {
                if (await sampleMemory(child.pid) > maxResidentBytes) fail('PARSE_RESOURCE_LIMIT', 422, 'File exceeds parser resource limits');
            } catch {
                if (!finished && child.exitCode === null && child.signalCode === null) fail('PARSE_UNAVAILABLE', 503, 'Parser memory isolation is unavailable');
            } finally { sampling = false; }
        };
        const monitor = setInterval(inspectMemory, sampleIntervalMs);
        const complete = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timer); clearInterval(monitor);
            signal?.removeEventListener('abort', abort);
            if (failure) reject(failure);
            else if (!result || result.code) reject(new ApiResourceError(result?.code || 'PARSE_RESOURCE_LIMIT', 422, 'File could not be parsed within resource limits'));
            else resolve(result.text);
        };
        child.on('message', message => {
            if (typeof message?.text === 'string' && message.text.length <= MAX_TEXT_CHARS) result = message;
            else if (['PARSE_FAILED', 'PARSE_RESOURCE_LIMIT'].includes(message?.code)) result = message;
            else fail('PARSE_RESOURCE_LIMIT', 422, 'Parser output exceeds the limit');
        });
        child.once('error', () => {
            failure ||= new ApiResourceError('PARSE_UNAVAILABLE', 503, 'Parser could not be started');
            complete();
        });
        child.once('exit', complete);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        else inspectMemory().then(() => {
            if (!failure && !finished) child.send({ format, buffer }, error => { if (error) fail('PARSE_UNAVAILABLE', 503, 'Parser communication failed'); });
        });
    });
}
