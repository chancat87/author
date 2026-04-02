'use client';

import { useState, useCallback } from 'react';

/**
 * 收拢 Login/Register 的公共认证流程：
 * loading 状态管理 → 调用认证函数 → 云端同步 → 关闭弹窗 → 错误处理
 *
 * @param {Function} closeModal - 关闭弹窗的函数
 * @param {string} fallbackError - 默认错误提示文案
 * @returns {{ loading, error, run }}
 */
export function useAuthAction(closeModal, fallbackError = 'Operation failed') {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const run = useCallback(async (authFn) => {
        setLoading(true);
        setError('');
        try {
            await authFn();
            const { syncFromCloud } = await import('./persistence');
            const merged = await syncFromCloud();
            closeModal();
            if (merged > 0) window.location.reload();
        } catch (err) {
            setError(err.message || fallbackError);
        } finally {
            setLoading(false);
        }
    }, [closeModal, fallbackError]);

    const resetError = useCallback(() => setError(''), []);

    return { loading, error, run, resetError };
}
