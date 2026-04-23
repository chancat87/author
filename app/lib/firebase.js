'use client';

// ==================== Firebase 初始化 ====================
// 使用环境变量配置，支持 Next.js NEXT_PUBLIC_ 前缀
// 预留 Vertex AI / Analytics / FCM 等升级接口

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// ⬇️ 阶段4（生态）升级预留：内置 AI
// import { getVertexAI } from 'firebase/vertexai';
// ⬇️ 阶段4（生态）升级预留：分析
// import { getAnalytics } from 'firebase/analytics';
// ⬇️ 阶段3（移动端）升级预留：推送
// import { getMessaging } from 'firebase/messaging';

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

// Firebase 是否已配置（用户/开发者是否填好了环境变量）
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const auth = isFirebaseConfigured ? getAuth(app) : null;
export const db = isFirebaseConfigured ? getFirestore(app) : null;

export const isFirebaseAnalyticsConfigured = Boolean(isFirebaseConfigured && firebaseConfig.measurementId);

let analyticsPromise = null;

export async function getFirebaseAnalytics() {
    if (!isFirebaseAnalyticsConfigured) return null;
    if (typeof window === 'undefined' || window.electronAPI) return null;

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
    });
    return true;
}

// ⬇️ 阶段4（生态）升级预留
// export const vertexAI = isFirebaseConfigured ? getVertexAI(app) : null;

export default app;
