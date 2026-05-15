'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { logFirebaseEvent, logFirebasePageView, setFirebaseAnalyticsUserContext } from '../lib/firebase';

function FirebaseAnalyticsTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let cancelled = false;
        const appSurface = window.electronAPI?.isElectron ? 'desktop_client' : 'web';

        (async () => {
            let appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '';
            if (window.electronAPI?.getAppVersion) {
                try {
                    appVersion = await window.electronAPI.getAppVersion();
                } catch { }
            }
            if (cancelled) return;

            await setFirebaseAnalyticsUserContext({
                properties: {
                    app_surface: appSurface,
                    app_version: appVersion || 'web',
                },
            });
            await logFirebaseEvent('author_app_open', {
                app_surface: appSurface,
                app_version: appVersion || 'web',
                page_location: window.location.href,
            });
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!pathname || typeof window === 'undefined') return;

        const query = searchParams?.toString();
        const pagePath = `${pathname}${query ? `?${query}` : ''}`;
        const pageLocation = `${window.location.origin}${pagePath}${window.location.hash || ''}`;

        logFirebasePageView({
            pageTitle: document.title,
            pageLocation,
            pagePath,
        });
    }, [pathname, searchParams]);

    return null;
}

export default function FirebaseAnalytics() {
    return (
        <Suspense fallback={null}>
            <FirebaseAnalyticsTracker />
        </Suspense>
    );
}
