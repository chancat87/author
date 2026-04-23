'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { logFirebasePageView } from '../lib/firebase';

function FirebaseAnalyticsTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!pathname || typeof window === 'undefined' || window.electronAPI) return;

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
