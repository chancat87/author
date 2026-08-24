import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = '127.0.0.1';
const nextCli = require.resolve('next/dist/bin/next');
const electronExecutable = require('electron');

let ownedNextProcess = null;
let electronProcess = null;
let shuttingDown = false;

function isPortOpen() {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host, port });
        const finish = (open) => {
            socket.destroy();
            resolve(open);
        };
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
        socket.setTimeout(750, () => finish(false));
    });
}

function isAuthorServer() {
    return new Promise((resolve) => {
        const request = http.get({ host, port, path: '/', timeout: 1500 }, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                if (body.length < 512 * 1024) body += chunk;
            });
            response.on('end', () => resolve(
                response.statusCode === 200 && /<title>Author(?:<|\s|-)/i.test(body),
            ));
        });
        request.once('error', () => resolve(false));
        request.once('timeout', () => {
            request.destroy();
            resolve(false);
        });
    });
}

async function waitForAuthorServer(timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await isAuthorServer()) return true;
        if (ownedNextProcess?.exitCode !== null) return false;
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
}

function stopOwnedServer() {
    if (ownedNextProcess && ownedNextProcess.exitCode === null && !ownedNextProcess.killed) {
        ownedNextProcess.kill();
    }
}

function shutdown(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    stopOwnedServer();
    process.exitCode = exitCode;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
        if (electronProcess && electronProcess.exitCode === null && !electronProcess.killed) {
            electronProcess.kill();
        }
        shutdown(0);
    });
}

const existingAuthorServer = await isAuthorServer();
if (existingAuthorServer) {
    console.log(`[electron:dev] 使用现有 Author 开发服务器: http://${host}:${port}`);
} else {
    if (await isPortOpen()) {
        throw new Error(`端口 ${port} 已被其他程序占用，无法安全启动 Author Electron。`);
    }

    console.log(`[electron:dev] 正在启动 Author 开发服务器: http://${host}:${port}`);
    ownedNextProcess = spawn(process.execPath, [nextCli, 'dev', '--hostname', host, '--port', String(port)], {
        cwd: projectRoot,
        env: process.env,
        stdio: 'inherit',
    });
    ownedNextProcess.once('error', (error) => {
        console.error(`[electron:dev] Next.js 启动失败: ${error.message}`);
    });

    if (!await waitForAuthorServer()) {
        stopOwnedServer();
        throw new Error('Author 开发服务器未能在 120 秒内就绪。');
    }
}

console.log('[electron:dev] 正在打开 Electron 桌面窗口...');
electronProcess = spawn(electronExecutable, ['.', '--dev'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
});

electronProcess.once('error', (error) => {
    console.error(`[electron:dev] Electron 启动失败: ${error.message}`);
    shutdown(1);
});

electronProcess.once('exit', (code, signal) => {
    if (signal) console.log(`[electron:dev] Electron 已由信号 ${signal} 结束。`);
    shutdown(code ?? 0);
});
