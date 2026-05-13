import { NextResponse } from 'next/server';

const RELEASE_API = 'https://api.github.com/repos/YuanShiJiLoong/author/releases/latest';
const RELEASE_PAGE = 'https://github.com/YuanShiJiLoong/author/releases/latest';

export const dynamic = 'force-dynamic';

function findAndroidAsset(assets = []) {
    return assets.find((asset) => {
        const name = String(asset?.name || '').toLowerCase();
        return name.startsWith('author-mobile-') && name.endsWith('.apk');
    }) || assets.find((asset) => String(asset?.name || '').toLowerCase().endsWith('.apk'));
}

export async function GET() {
    try {
        const res = await fetch(RELEASE_API, {
            headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'Author-App',
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
            const release = await res.json();
            const asset = findAndroidAsset(release.assets);
            if (asset?.browser_download_url) {
                return NextResponse.redirect(asset.browser_download_url, 302);
            }
        }
    } catch {
        // Fall through to the release page when GitHub API is unavailable.
    }

    return NextResponse.redirect(RELEASE_PAGE, 302);
}
