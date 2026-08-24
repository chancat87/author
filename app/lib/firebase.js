'use client';

// ==================== Firebase Analytics 初始化 ====================
// Firebase 在网页端仅用于匿名产品分析，不提供登录或云端作品存储。

import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 防止热更新时重复初始化
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const isFirebaseAnalyticsConfigured = Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.measurementId
);

let analyticsPromise = null;

export async function getFirebaseAnalytics() {
    if (!isFirebaseAnalyticsConfigured) return null;
    if (typeof window === 'undefined') return null;

    if (!analyticsPromise) {
        analyticsPromise = (async () => {
            const { initializeAnalytics, getAnalytics, isSupported } = await import('firebase/analytics');
            const supported = await isSupported();
            if (!supported) return null;

            try {
                return initializeAnalytics(app, {
                    config: {
                        send_page_view: false,
                    },
                });
            } catch (err) {
                if (err?.code === 'analytics/already-exists') {
                    return getAnalytics(app);
                }
                throw err;
            }
        })().catch((err) => {
            console.warn('[Firebase Analytics] 初始化失败:', err);
            return null;
        });
    }

    return analyticsPromise;
}

export async function logFirebasePageView({ pageTitle, pageLocation, pagePath } = {}) {
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return false;

    const { logEvent } = await import('firebase/analytics');
    logEvent(analytics, 'page_view', {
        page_title: pageTitle || document.title,
        page_location: pageLocation || window.location.href,
        page_path: pagePath || `${window.location.pathname}${window.location.search}`,
        app_surface: window.electronAPI?.isElectron ? 'desktop_client' : 'web',
    });
    return true;
}

export async function logFirebaseEvent(eventName, params = {}) {
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return false;

    const { logEvent } = await import('firebase/analytics');
    logEvent(analytics, eventName, params);
    return true;
}

export async function setFirebaseAnalyticsUserContext({ userId, properties } = {}) {
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return false;

    const { setUserId, setUserProperties } = await import('firebase/analytics');
    if (userId !== undefined) setUserId(analytics, userId);
    if (properties) setUserProperties(analytics, properties);
    return true;
}

export default app;
