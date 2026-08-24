import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { authorizeSourceUpdate, redactSensitiveText } from '../../lib/server-security.mjs';

/**
 * POST /api/update-source
 * 一键更新源码部署：git pull → npm install → npm run build
 * 仅在本地源码部署（存在 .git 目录）时可用
 */
export async function POST(request) {
    const authorization = authorizeSourceUpdate(request);
    if (!authorization.ok) {
        return NextResponse.json(
            { error: 'Source update is not authorized', code: authorization.code },
            { status: authorization.status, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const cwd = process.cwd();
    const gitDir = join(cwd, '.git');

    if (!existsSync(gitDir)) {
        return NextResponse.json(
            { error: '非源码部署环境，无法执行自动更新', code: 'NOT_SOURCE_DEPLOY' },
            { status: 400 }
        );
    }

    const logs = [];
    const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

    try {
        // Step 1: git pull
        log('🔄 正在拉取最新代码...');
        const pullResult = execFileSync('git', ['pull'], { cwd, encoding: 'utf-8', timeout: 60000 });
        log(pullResult.trim() || 'git pull 完成');

        // 检查是否已经是最新
        if (pullResult.includes('Already up to date') || pullResult.includes('已经是最新')) {
            log('✅ 当前已是最新版本，无需更新');
            return NextResponse.json({ success: true, alreadyUpToDate: true, logs });
        }

        // Step 2: npm install
        log('📦 正在安装依赖...');
        const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const installResult = execFileSync(npmCommand, ['install'], { cwd, encoding: 'utf-8', timeout: 300000 });
        // 只保留最后几行，避免输出过长
        const installLines = installResult.trim().split('\n');
        log(installLines.slice(-3).join('\n') || 'npm install 完成');

        // Step 3: npm run build
        log('🔨 正在构建项目...');
        const buildResult = execFileSync(npmCommand, ['run', 'build'], { cwd, encoding: 'utf-8', timeout: 300000 });
        const buildLines = buildResult.trim().split('\n');
        log(buildLines.slice(-5).join('\n') || 'npm run build 完成');

        log('✅ 更新完成！请刷新页面或重启服务以应用更新。');
        return NextResponse.json({ success: true, alreadyUpToDate: false, logs });
    } catch (err) {
        log(`❌ 更新失败: ${redactSensitiveText(err?.message)}`);
        if (err.stdout) log(`stdout: ${redactSensitiveText(err.stdout.toString(), 500)}`);
        if (err.stderr) log(`stderr: ${redactSensitiveText(err.stderr.toString(), 500)}`);
        return NextResponse.json(
            { success: false, error: 'Source update failed', logs },
            { status: 500 }
        );
    }
}
