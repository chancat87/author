import { withApiResources } from '../../lib/api-resource-guard.js';
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

async function handleGET() {
    try {
        const pkgPath = join(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return NextResponse.json(
            { version: pkg.version || '' },
            { headers: { 'Cache-Control': 'public, max-age=3600' } }
        );
    } catch {
        return NextResponse.json(
            { error: '无法读取当前版本号', code: 'CANNOT_READ_VERSION' },
            { status: 500 }
        );
    }
}

export const GET = withApiResources('/api/app-version', handleGET);
