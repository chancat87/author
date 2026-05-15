'use client';

// ==================== 用户活跃心跳 ====================
// 每个登录用户每天只向 Firestore 写一次心跳，用于统计 DAU/MAU。
// 路径：users/{uid}/data/heartbeat
// 同一 UID 天然去重（文档 ID = 固定 key），同一天内 localStorage 防重。
// 支持 Web / Electron 桌面端 / 移动端（移动端需在 Flutter 侧实现对应逻辑）。

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getCurrentUser } from './auth';

const HEARTBEAT_DATE_KEY = 'author-heartbeat-date';
const HEARTBEAT_DOC_KEY = 'heartbeat';

/**
 * 检测当前平台
 * @returns {'desktop' | 'web'}
 */
function detectPlatform() {
    if (typeof window !== 'undefined' && window.electronAPI) return 'desktop';
    return 'web';
}

/**
 * 获取应用版本号（从 package.json 注入或 Electron userAgent 中读取）
 * @returns {string}
 */
async function getAppVersion() {
    if (typeof window !== 'undefined' && window.electronAPI?.getAppVersion) {
        try {
            return await window.electronAPI.getAppVersion();
        } catch { }
    }
    // Electron 桌面端 —— 从 userAgent 中提取 Author/x.x.x
    if (typeof navigator !== 'undefined') {
        const match = navigator.userAgent.match(/Author\/([\d.]+)/);
        if (match) return match[1];
    }
    // Web 端 —— 编译时由 Next.js 注入
    return process.env.NEXT_PUBLIC_APP_VERSION || '';
}

/**
 * 获取今天的日期字符串（UTC），用于去重
 * @returns {string} e.g. "2026-05-12"
 */
function getTodayUTC() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * 发送每日心跳到 Firestore
 * 同一用户每天只写一次，多设备/多平台只保留最后一次的平台信息。
 * 由 auth 模块在 onAuthStateChanged 时调用。
 */
export async function sendDailyHeartbeat() {
    if (typeof window === 'undefined') return;
    if (!isFirebaseConfigured || !db) return;

    const user = getCurrentUser();
    if (!user) return;

    const today = getTodayUTC();

    // 同一天 + 同一 UID 不重复写
    try {
        const cached = localStorage.getItem(HEARTBEAT_DATE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.date === today && parsed.uid === user.uid) return;
        }
    } catch { /* 缓存读取失败就继续写入 */ }

    try {
        const ref = doc(db, 'users', user.uid, 'data', HEARTBEAT_DOC_KEY);
        await setDoc(ref, {
            value: {
                platform: detectPlatform(),
                appVersion: await getAppVersion(),
                lastActiveDate: today,
            },
            updatedAt: serverTimestamp(),
        }, { merge: true });

        // 写入成功后缓存日期，防止今天再次写入
        localStorage.setItem(HEARTBEAT_DATE_KEY, JSON.stringify({
            date: today,
            uid: user.uid,
        }));
    } catch (err) {
        // 心跳失败不应影响正常使用，静默吞掉
        console.warn('[heartbeat] failed:', err.message);
    }
}
