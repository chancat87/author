'use client';

// ==================== Firestore 同步层 ====================
// 本地优先 + 云端智能同步
// 数据变化时启动同步，5分钟无变化后停止定时器，直到下次变化

import {
    collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getCurrentUser } from './auth';
import { isSyncableKey } from './sync-key-policy';

// ==================== 配置 ====================

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 分钟
const IDLE_TIMEOUT = 5 * 60 * 1000;  // 5 分钟无变化后停止自动同步
const COLLECTION_NAME = 'data';       // users/{uid}/data/{key}
const CHUNK_COLLECTION_NAME = 'chunks';
const FIRESTORE_BATCH_LIMIT = 450;
const MAX_INLINE_DOC_BYTES = 850 * 1024;
const CHUNK_MAX_BYTES = 700 * 1024;

// ==================== 同步队列 ====================

const _pendingWrites = new Map();    // key → { value, timestamp }
let _syncTimer = null;
let _isSyncing = false;
let _activeFlushPromise = null;
let _idleTimer = null;               // 空闲检测定时器
let _lastDataChange = 0;             // 最后一次数据变化时间
let _firstSyncAfterLogin = true;     // 登录后第一次同步标志（强制真实同步）

// 同步状态回调
let _syncStatusCallback = null;
export function onSyncStatusChange(callback) {
    _syncStatusCallback = callback;
}

function getJsonByteLength(value) {
    return new TextEncoder().encode(value).length;
}

function splitStringByBytes(value, maxBytes) {
    const encoder = new TextEncoder();
    const chunks = [];
    let current = '';
    let currentBytes = 0;

    for (const char of value) {
        const charBytes = encoder.encode(char).length;
        if (current && currentBytes + charBytes > maxBytes) {
            chunks.push(current);
            current = '';
            currentBytes = 0;
        }
        current += char;
        currentBytes += charBytes;
    }

    if (current) chunks.push(current);
    return chunks;
}

function deepClean(obj) {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepClean);
    const cleanObj = {};
    for (const k in obj) {
        const v = deepClean(obj[k]);
        if (v !== undefined) cleanObj[k] = v;
    }
    return cleanObj;
}

async function deleteChunkDocs(ref) {
    const chunkSnap = await getDocs(collection(ref, CHUNK_COLLECTION_NAME));
    if (chunkSnap.empty) return;

    const docs = chunkSnap.docs;
    for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const chunkDoc of docs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
            batch.delete(chunkDoc.ref);
        }
        await batch.commit();
    }
}

async function writeCloudValue(ref, value) {
    const json = JSON.stringify(value);
    if (getJsonByteLength(json) <= MAX_INLINE_DOC_BYTES) {
        await deleteChunkDocs(ref);
        await setDoc(ref, {
            value,
            updatedAt: serverTimestamp(),
        });
        return;
    }

    const chunks = splitStringByBytes(json, CHUNK_MAX_BYTES);
    await deleteChunkDocs(ref);

    for (let i = 0; i < chunks.length; i += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(db);
        chunks.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((chunk, offset) => {
            const index = i + offset;
            const chunkRef = doc(collection(ref, CHUNK_COLLECTION_NAME), String(index).padStart(5, '0'));
            batch.set(chunkRef, { index, data: chunk });
        });
        await batch.commit();
    }

    await setDoc(ref, {
        chunked: true,
        encoding: 'json-v1',
        chunkCount: chunks.length,
        updatedAt: serverTimestamp(),
    });
}

async function deleteCloudValue(ref) {
    await deleteChunkDocs(ref);
    await deleteDoc(ref);
}

async function readCloudValue(docSnap) {
    const cloudData = docSnap.data();
    if (!cloudData?.chunked) return cloudData?.value;

    const chunkSnap = await getDocs(collection(docSnap.ref, CHUNK_COLLECTION_NAME));
    const chunks = chunkSnap.docs
        .map(chunkDoc => chunkDoc.data())
        .sort((a, b) => (a.index || 0) - (b.index || 0));

    if (cloudData.chunkCount !== undefined && chunks.length !== cloudData.chunkCount) {
        throw new Error(`Chunked cloud value is incomplete for ${docSnap.id}`);
    }

    return JSON.parse(chunks.map(chunk => chunk.data || '').join(''));
}

function notifySyncStatus(status) {
    if (_syncStatusCallback) {
        _syncStatusCallback({
            ...status,
            keys: Array.from(_pendingWrites.keys())
        });
    }
}

// ==================== 读写接口 ====================

/**
 * 从 Firestore 读取数据
 * @param {string} key - 存储键名
 * @returns {Promise<any>} 数据值，不存在返回 undefined
 */
export async function firestoreGet(key) {
    const user = getCurrentUser();
    if (!isFirebaseConfigured || !db || !user) return undefined;
    if (!isSyncableKey(key)) return undefined;

    try {
        const ref = doc(db, 'users', user.uid, COLLECTION_NAME, key);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return await readCloudValue(snap);
        }
        return undefined;
    } catch {
        console.warn('[firestore] GET failed');
        return undefined;
    }
}

/**
 * 将数据加入同步队列（不立即写入 Firestore）
 * 同时启动/重置空闲检测定时器
 * @param {string} key - 存储键名
 * @param {any} value - 要存储的值
 */
export function firestoreEnqueue(key, value) {
    const user = getCurrentUser();
    if (!isFirebaseConfigured || !db || !user) return;
    if (!isSyncableKey(key)) return;

    _pendingWrites.set(key, { value, timestamp: Date.now() });
    _lastDataChange = Date.now();
    notifySyncStatus({ pending: _pendingWrites.size });

    // 启动定时同步（如果还没启动）
    ensureSyncTimer();

    // 重置空闲检测
    resetIdleTimer();
}

/**
 * 启动同步定时器（如果未运行）
 */
function ensureSyncTimer() {
    if (!_syncTimer) {
        _syncTimer = setInterval(flushSync, SYNC_INTERVAL);
    }
}

/**
 * 停止同步定时器
 */
function clearSyncTimer() {
    if (_syncTimer) {
        clearInterval(_syncTimer);
        _syncTimer = null;
    }
}

/**
 * 重置空闲检测定时器
 * 每次数据变化时调用；5 分钟无新变化则停止自动同步
 */
function resetIdleTimer() {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => {
        // 5 分钟无变化，先做一次最终同步，然后停止定时器
        flushSync().then(() => {
            clearSyncTimer();
            notifySyncStatus({
                syncing: false,
                pending: 0,
                lastSync: Date.now(),
                idle: true,
            });
        });
    }, IDLE_TIMEOUT);
}

/**
 * 立即从 Firestore 删除数据
 * @param {string} key - 存储键名
 */
export async function firestoreDel(key) {
    const user = getCurrentUser();
    if (!isFirebaseConfigured || !db || !user) return;
    if (!isSyncableKey(key)) return;

    // 不再立即删除，而是加入延迟队列中，跟普通的写入保持同一步调
    _pendingWrites.set(key, { value: '_AUTHOR_DELETE_' });

    // 每次发生写操作，都会重置空闲定时器
    if (!_isSyncing && !_syncTimer) {
        ensureSyncTimer();
    }
    resetIdleTimer();
}

// ==================== 批量同步 ====================

/**
 * 将队列中的数据批量写入 Firestore
 * 由定时器自动调用，也可手动调用（如退出登录前）
 */
export async function flushSync(options = {}) {
    const { throwOnError = false } = options;
    const user = getCurrentUser();
    if (!isFirebaseConfigured || !db || !user) return;

    // 若已有同步正在进行，优先等待其完成，避免在队列已被取走时误判为“无待同步数据”
    // 例如退出前点击“同步后退出”时，需要等当前 flush 真正落盘后再继续关闭流程
    if (_isSyncing) {
        if (_activeFlushPromise) {
            try {
                return await _activeFlushPromise;
            } catch (err) {
                if (throwOnError) throw err;
                return;
            }
        }
        return;
    }

    // 登录后第一次同步 — 强制执行真实同步（即使队列为空）
    if (_firstSyncAfterLogin) {
        _firstSyncAfterLogin = false;
        if (_pendingWrites.size === 0) {
            // 队列为空但是首次 → 标记为正在同步，给 UI 反馈
            notifySyncStatus({ syncing: true, pending: 0 });
            // 短暂延迟让 UI 看到同步动画
            await new Promise(r => setTimeout(r, 800));
            notifySyncStatus({ syncing: false, pending: 0, lastSync: Date.now() });
            return;
        }
    } else if (_pendingWrites.size === 0) {
        // 非首次且无待同步数据 — 仅反馈 UI
        notifySyncStatus({ syncing: false, pending: 0, lastSync: Date.now() });
        return;
    }

    _isSyncing = true;
    notifySyncStatus({ syncing: true, pending: _pendingWrites.size });

    // 取出当前队列快照
    const entries = Array.from(_pendingWrites.entries());
    _pendingWrites.clear();

    _activeFlushPromise = (async () => {
        for (let i = 0; i < entries.length; i += FIRESTORE_BATCH_LIMIT) {
            const chunk = entries.slice(i, i + FIRESTORE_BATCH_LIMIT);

            for (const [key, { value }] of chunk) {
                if (!isSyncableKey(key)) continue;
                const ref = doc(db, 'users', user.uid, COLLECTION_NAME, key);
                
                if (value === '_AUTHOR_DELETE_') {
                    try {
                        await deleteCloudValue(ref);
                    } catch (batchErr) {
                        console.error('[firestore] delete failed');
                        throw batchErr;
                    }
                    continue;
                }

                const cleanValue = deepClean(value);

                try {
                    await writeCloudValue(ref, cleanValue);
                } catch (batchErr) {
                    console.error('[firestore] write failed');
                    throw batchErr;
                }
            }
        }

        notifySyncStatus({ syncing: false, pending: 0, lastSync: Date.now() });
    })()
        .catch((err) => {
            console.error('[firestore] batch sync failed:', err.message);
            // 失败的写回队列，等下次重试
            for (const [key, data] of entries) {
                if (!_pendingWrites.has(key)) {
                    _pendingWrites.set(key, data);
                }
            }
            notifySyncStatus({ syncing: false, pending: _pendingWrites.size, error: err.message });
            throw err;
        })
        .finally(() => {
            _isSyncing = false;
            _activeFlushPromise = null;
        });

    try {
        return await _activeFlushPromise;
    } catch (err) {
        if (throwOnError) throw err;
    }
}

/**
 * 首次登录时，从 Firestore 拉取全部数据并合并到本地
 * @param {Function} localGet - 本地读取函数 (key) => value
 * @param {Function} localSet - 本地写入函数 (key, value) => void
 * @returns {Promise<number>} 合并的数据条数
 */
export async function pullAllFromCloud(localGet, localSet) {
    const user = getCurrentUser();
    if (!isFirebaseConfigured || !db || !user) return 0;

    try {
        const colRef = collection(db, 'users', user.uid, COLLECTION_NAME);
        const snapshot = await getDocs(colRef);

        let merged = 0;
        for (const docSnap of snapshot.docs) {
            const key = docSnap.id;
            if (!isSyncableKey(key)) continue;
            const cloudData = docSnap.data();
            const cloudValue = await readCloudValue(docSnap);
            const localData = await localGet(key);

            // 判断本地数据是否实质上为空或仅包含初始默认结构
            const isLocalEmptyOrDefault = (key, data) => {
                if (data === undefined || data === null) return true;
                if (Array.isArray(data)) {
                    if (data.length === 0) return true;
                    if (key.startsWith('author-chapters')) {
                        // 初始项目可能会自动生成“第一卷”和“未命名章节”
                        // 只要没有任何章节有实际内容，就认为是空状态
                        const hasContent = data.some(item => 
                            item.type !== 'volume' && 
                            ((item.content && item.content.trim() !== '') || (item.wordCount > 0) || (item.title && item.title !== '未命名章节'))
                        );
                        return !hasContent;
                    }
                    if (key.startsWith('author-settings-nodes')) {
                        // 初始设定的文件夹不包含任何实质 item，且作品信息（special）也为空
                        const hasItems = data.some(item => item.type === 'item');
                        const hasSpecialContent = data.some(node => 
                            node.type === 'special' && 
                            (node.content?.title || node.content?.synopsis)
                        );
                        return !hasItems && !hasSpecialContent;
                    }
                    if (key === 'author-works-index') {
                        // 只有一个默认的书籍，说明是全新初始化
                        if (data.length === 1 && data[0].id === 'work-default' && data[0].name === '默认作品') {
                            return true;
                        }
                    }
                    return false;
                }
                if (typeof data === 'object') {
                    if (Object.keys(data).length === 0) return true;
                }
                if (typeof data === 'string' && data.trim() === '') return true;
                return false;
            };

            // 简单合并策略：如果本地确实没有实质数据，则用云端的覆盖
            // 解决新设备登录时，由于本地存在默认初始化的空章节/设定导致无法拉取云端数据的问题
            if (isLocalEmptyOrDefault(key, localData)) {
                await localSet(key, cloudValue);
                merged++;
            } else if (Array.isArray(localData) && Array.isArray(cloudValue)) {
                // 基于 id 和 updatedAt 的智能合并
                let isIdBased = false;
                const localMap = new Map();
                for (const item of localData) {
                    if (item && item.id) {
                        isIdBased = true;
                        localMap.set(item.id, { ...item });
                    }
                }
                
                if (isIdBased) {
                    let hasDeltas = false;
                    for (const item of cloudValue) {
                        if (item && item.id) {
                            const localItem = localMap.get(item.id);
                            if (!localItem) {
                                localMap.set(item.id, { ...item });
                                hasDeltas = true;
                            } else {
                                const localTime = new Date(localItem.updatedAt || 0).getTime();
                                const cloudTime = new Date(item.updatedAt || 0).getTime();
                                if (cloudTime > localTime) {
                                    localMap.set(item.id, { ...item });
                                    hasDeltas = true;
                                }
                            }
                        }
                    }
                    if (hasDeltas) {
                        await localSet(key, Array.from(localMap.values()));
                        merged++;
                    }
                }
            } else if (cloudData.updatedAt) {
                // 原有逻辑保持（尽力而为）
            }
        }

        return merged;
    } catch {
        console.warn('[firestore] pull failed');
        return 0;
    }
}

/**
 * 强制从云端拉取全部数据，无视本地状态直接覆盖
 * 用户手动点击“从云端同步”时调用
 * @param {Function} localSet - 本地写入函数 (key, value) => void或Promise
 * @returns {Promise<number>} 覆盖的数据条数
 */
export async function forcePullFromCloud(localSet) {
    const user = getCurrentUser();
    if (!isFirebaseConfigured || !db || !user) return 0;

    notifySyncStatus({ syncing: true, pending: 0 });
    try {
        const colRef = collection(db, 'users', user.uid, COLLECTION_NAME);
        const snapshot = await getDocs(colRef);

        let pulledCount = 0;
        for (const docSnap of snapshot.docs) {
            const key = docSnap.id;
            if (!isSyncableKey(key)) continue;
            const cloudValue = await readCloudValue(docSnap);
            
            // 无条件覆盖本地
            if (cloudValue !== undefined) {
                await localSet(key, cloudValue);
                pulledCount++;
            }
        }
        
        notifySyncStatus({ syncing: false, pending: 0, lastSync: Date.now() });
        return pulledCount;
    } catch (err) {
        console.error('[firestore] force pull failed:', err.message);
        notifySyncStatus({ syncing: false, pending: 0, error: err.message });
        throw err;
    }
}

// ==================== 清理 ====================

/**
 * 停止同步定时器（退出登录时调用）
 */
export function stopSync() {
    clearSyncTimer();
    if (_idleTimer) {
        clearTimeout(_idleTimer);
        _idleTimer = null;
    }
    _pendingWrites.clear();
    _firstSyncAfterLogin = true; // 下次登录后重新强制首次同步
    notifySyncStatus({ pending: 0, syncing: false });
}

/**
 * 页面卸载前，尝试同步剩余数据
 */
export function setupBeforeUnloadSync() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
        if (_pendingWrites.size > 0) {
            // 使用 sendBeacon 或同步请求尝试最后一次同步
            // 注意：这不可靠，但能提高数据安全性
            flushSync().catch(() => { });
        }
    });
}
