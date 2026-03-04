import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// 数据持久化 API — 将所有用户数据存储到本地文件系统
// 每个用户有独立的目录（通过 userId cookie 隔离）

const DATA_ROOT = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// 从请求中提取或创建用户ID
function getUserId(request) {
    // 优先从 cookie 读取
    const cookies = request.headers.get('cookie') || '';
    const match = cookies.match(/author-uid=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return null;
}

// 确保目录存在
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (e) {
        if (e.code !== 'EEXIST') throw e;
    }
}

// key → 文件路径映射（防止路径穿越）
function resolveFilePath(userId, key) {
    // 仅允许字母、数字、连字符、下划线、斜杠、点
    const safeKey = key.replace(/[^a-zA-Z0-9\-_./]/g, '');
    if (!safeKey || safeKey.includes('..')) {
        throw new Error('Invalid storage key');
    }
    const userDir = path.join(DATA_ROOT, userId);
    const filePath = path.join(userDir, safeKey + '.json');

    // 安全检查：确保路径在用户目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedUserDir = path.resolve(userDir);
    if (!resolvedPath.startsWith(resolvedUserDir)) {
        throw new Error('Path traversal detected');
    }

    return filePath;
}

// GET /api/storage?key=xxx — 读取数据
export async function GET(request) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'No user ID' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        const filePath = resolveFilePath(userId, key);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return NextResponse.json({ data: JSON.parse(content) });
        } catch (e) {
            if (e.code === 'ENOENT') {
                return NextResponse.json({ data: null });
            }
            throw e;
        }
    } catch (error) {
        console.error('Storage GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/storage — 写入数据 { key, value }
export async function POST(request) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'No user ID' }, { status: 401 });
        }

        const { key, value } = await request.json();
        if (!key) {
            return NextResponse.json({ error: 'Missing key' }, { status: 400 });
        }

        const filePath = resolveFilePath(userId, key);
        await ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Storage POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/storage?key=xxx — 删除数据
export async function DELETE(request) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'No user ID' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        const filePath = resolveFilePath(userId, key);

        try {
            await fs.unlink(filePath);
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Storage DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
