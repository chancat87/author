import { getChapters, saveChapters } from './storage';
import { getSettingsNodes, saveSettingsNodes, getActiveWorkId, setActiveWorkId } from './settings';
import { getChapterMemoryGroups, saveChapterMemoryGroups } from './chapter-memory-groups';
import { loadSessionStore, saveSessionStore } from './chat-sessions';
import { persistGet, persistSet } from './persistence';
import { del, get, set } from 'idb-keyval';
import { useAppStore } from '../store/useAppStore';

const LEGACY_SNAPSHOTS_KEY = 'author-snapshots';
const SNAPSHOT_INDEX_KEY = 'author-snapshots-index-v2';
const SNAPSHOT_DATA_PREFIX = 'author-snapshot-data-v2:';
const RESTORE_JOURNAL_KEY = 'author-snapshot-restore-pending-v1';
const MAX_AUTO_SNAPSHOTS = 50;
const PREVIEW_CHAPTER_LIMIT = 10;
let snapshotWriteQueue = Promise.resolve();
let nextSnapshotSequence = 0;

function serializeSnapshotWrite(operation) {
    const result = snapshotWriteQueue.then(operation);
    snapshotWriteQueue = result.catch(() => {});
    return result;
}

function newSnapshotId() {
    const suffix = globalThis.crypto?.randomUUID?.() || `${++nextSnapshotSequence}-${Math.random().toString(36).slice(2)}`;
    return `snap-${Date.now()}-${suffix}`;
}

function getCurrentLanguage() {
    if (typeof window === 'undefined') return 'zh';
    return useAppStore.getState().language || localStorage.getItem('author-lang') || 'zh';
}

function text(zh, en, ru = en) {
    const lang = getCurrentLanguage();
    if (lang === 'en') return en;
    if (lang === 'ru') return ru || en;
    return zh;
}

async function flushPendingEditorBeforeSnapshot() {
    const flushPendingLocalSave = useAppStore.getState().flushPendingLocalSave;
    if (typeof flushPendingLocalSave === 'function') {
        await flushPendingLocalSave();
    }
}

function isValidSessionStore(store) {
    return store && typeof store === 'object' && Array.isArray(store.sessions);
}

async function getChatSessionsForSnapshot(strictRead = false) {
    const inMemoryStore = useAppStore.getState().sessionStore;
    if (isValidSessionStore(inMemoryStore)) {
        if (!strictRead) await saveSessionStore(inMemoryStore);
        return structuredClone(inMemoryStore);
    }
    const persistedStore = strictRead ? await persistGet('author-chat-sessions') : await loadSessionStore();
    if (strictRead && persistedStore != null && !isValidSessionStore(persistedStore)) {
        throw new Error(text('无法读取对话，尚未开始恢复。', 'Cannot read conversations. Restore has not started.'));
    }
    return isValidSessionStore(persistedStore)
        ? persistedStore
        : { activeSessionId: null, sessions: [] };
}

function getSnapshotDataKey(snapshotId) {
    return `${SNAPSHOT_DATA_PREFIX}${snapshotId}`;
}

function createChapterPreview(chapters = []) {
    if (!Array.isArray(chapters)) return [];
    return chapters.slice(0, PREVIEW_CHAPTER_LIMIT).map(ch => ({
        id: ch?.id,
        title: ch?.title || '',
    }));
}

function createSnapshotIndexEntry(snapshot) {
    return {
        id: snapshot.id,
        timestamp: snapshot.timestamp,
        label: snapshot.label,
        type: snapshot.type,
        workId: snapshot.data?.workId,
        stats: snapshot.stats || {},
        data: {
            chapters: createChapterPreview(snapshot.data?.chapters),
        },
        storageVersion: 2,
    };
}

function applySnapshotRetention(snapshots, protectedIds = new Set()) {
    const kept = [];
    const removed = [];
    let autoCount = 0;

    for (const snapshot of snapshots) {
        if (snapshot?.type === 'auto') {
            autoCount += 1;
            if (autoCount > MAX_AUTO_SNAPSHOTS && !protectedIds.has(snapshot.id)) {
                removed.push(snapshot.id);
                continue;
            }
        }
        kept.push(snapshot);
    }

    return { kept, removed };
}

async function migrateLegacySnapshots() {
    const legacySnapshots = await get(LEGACY_SNAPSHOTS_KEY);
    if (!Array.isArray(legacySnapshots)) return [];

    const { kept } = applySnapshotRetention(legacySnapshots);
    const index = kept.map(createSnapshotIndexEntry);

    try {
        for (const snapshot of kept) {
            await set(getSnapshotDataKey(snapshot.id), snapshot);
        }
        await set(SNAPSHOT_INDEX_KEY, index);
        await del(LEGACY_SNAPSHOTS_KEY);
        console.info(`[snapshots] Migrated ${index.length} snapshots to split storage.`);
    } catch (e) {
        console.warn('[snapshots] Legacy snapshot migration failed; keeping legacy storage:', e);
        return legacySnapshots.map(createSnapshotIndexEntry);
    }

    return index;
}

async function getSnapshotIndex() {
    const index = await get(SNAPSHOT_INDEX_KEY);
    if (Array.isArray(index)) return index;
    return migrateLegacySnapshots();
}

async function saveSnapshotIndex(index) {
    await set(SNAPSHOT_INDEX_KEY, index);
}

async function getSnapshotById(snapshotId) {
    const splitSnapshot = await get(getSnapshotDataKey(snapshotId));
    if (splitSnapshot) return splitSnapshot;

    const legacySnapshots = await get(LEGACY_SNAPSHOTS_KEY);
    if (Array.isArray(legacySnapshots)) {
        return legacySnapshots.find(s => s?.id === snapshotId) || null;
    }

    return null;
}

async function restoreWorksIndexForSnapshot(workId, worksIndex) {
    const current = await persistGet('author-works-index');
    if (current != null && !Array.isArray(current)) throw new Error('Cannot read the current works list');
    const currentWorks = Array.isArray(current) ? current : [];
    const savedWork = Array.isArray(worksIndex) ? worksIndex.find(work => work?.id === workId) : null;
    const currentWork = currentWorks.find(work => work?.id === workId);
    if (currentWork) {
        if (!savedWork) return;
        const restoredWork = { ...currentWork, ...savedWork, id: workId };
        // Keep the current position; a snapshot may refer to a folder that no longer exists.
        for (const key of ['parentId', 'order']) {
            if (Object.hasOwn(currentWork, key)) restoredWork[key] = currentWork[key];
        }
        if (restoredWork.parentId && !currentWorks.some(work => work?.id === restoredWork.parentId)) {
            restoredWork.parentId = null;
        }
        await persistSet('author-works-index', currentWorks.map(work => work?.id === workId ? restoredWork : work));
        return;
    }

    const now = new Date().toISOString();
    await persistSet('author-works-index', [
        ...currentWorks,
        {
            name: text('恢复的作品', 'Restored Work', 'Восстановленное произведение'),
            type: 'work',
            category: 'work',
            icon: '',
            order: currentWorks.length,
            createdAt: now,
            updatedAt: now,
            ...savedWork,
            id: workId,
            parentId: savedWork?.parentId && currentWorks.some(work => work?.id === savedWork.parentId) ? savedWork.parentId : null,
        },
    ]);
}

/**
 * 获取所有快照（从本地 IndexedDB 读取，不走云同步）
 * @returns {Promise<Array>} 快照列表（按时间倒序）
 */
export async function getSnapshots() {
    try {
        // 读取轻量索引，完整快照按需读取，避免每次都克隆整份历史数据。
        const snapshots = await getSnapshotIndex();
        return Array.isArray(snapshots) ? snapshots : [];
    } catch (e) {
        console.error('Failed to get snapshots:', e);
        return [];
    }
}

/**
 * 创建新快照
 * @param {string} label - 快照标签描述
 * @param {string} type - 'auto' | 'manual'
 * @returns {Promise<object>}
 */
export function createSnapshot(label, type = 'auto', options = {}) {
    const workId = options.workId || getActiveWorkId() || 'work-default';
    return serializeSnapshotWrite(() => createSnapshotNow(label, type, { ...options, workId }));
}

async function readBackupArray(key) {
    const value = await persistGet(key);
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error(text('无法读取当前作品，尚未开始恢复。', 'Cannot read the current work. Restore has not started.'));
    return value;
}

async function createSnapshotNow(label, type, { workId, strictRead = false, protectedIds: extraProtectedIds = [] }) {
    try {
        await flushPendingEditorBeforeSnapshot();
        const chapters = strictRead ? await readBackupArray(`author-chapters-${workId}`) : await getChapters(workId);
        const settingsNodes = strictRead ? await readBackupArray(`author-settings-nodes-${workId}`) : await getSettingsNodes(workId);
        const chapterMemoryGroups = strictRead ? await readBackupArray(`author-chapter-memory-groups-${workId}`) : await getChapterMemoryGroups(workId);
        const worksIndex = await persistGet('author-works-index');
        if (strictRead && worksIndex != null && !Array.isArray(worksIndex)) throw new Error('Cannot read the current works list');
        const chatSessions = await getChatSessionsForSnapshot(strictRead);
        const chatMessageCount = chatSessions.sessions.reduce((sum, session) => (
            sum + (Array.isArray(session.messages) ? session.messages.length : 0)
        ), 0);

        const snapshot = {
            id: newSnapshotId(),
            timestamp: Date.now(),
            label: label || (type === 'auto'
                ? text('自动存档', 'Auto Snapshot', 'Автоснимок')
                : text('手动存档', 'Manual Snapshot', 'Ручной снимок')),
            type,
            stats: {
                chapterCount: chapters.length,
                totalWords: chapters.reduce((acc, ch) => acc + (ch.wordCount || 0), 0),
                settingCount: settingsNodes.length,
                chapterMemoryGroupCount: chapterMemoryGroups.length,
                chatSessionCount: chatSessions.sessions.length,
                chatMessageCount,
            },
            data: {
                workId,
                worksIndex: Array.isArray(worksIndex) ? worksIndex.filter(work => work?.id === workId) : null,
                chapters,
                settingsNodes,
                chapterMemoryGroups,
                chatSessions,
            }
        };

        const existingIndex = await getSnapshotIndex();
        const nextIndex = [
            createSnapshotIndexEntry(snapshot),
            ...existingIndex.filter(s => s?.id !== snapshot.id),
        ];
        const pending = await getPendingSnapshotRestore();
        const protectedIds = new Set([...extraProtectedIds, ...(pending ? [pending.snapshotId, pending.backupId] : [])]);
        const { kept, removed } = applySnapshotRetention(nextIndex, protectedIds);

        // 完整快照按 ID 分开保存，新增快照不再重写整个历史数组。
        await set(getSnapshotDataKey(snapshot.id), snapshot);
        await saveSnapshotIndex(kept);
        await Promise.all(removed.map(id => del(getSnapshotDataKey(id)).catch(() => { })));

        // 快照只保存在本机 IndexedDB。完整快照经常超过 Firestore 单文档 1MiB
        // 限制；云同步只同步作品索引、章节和设定集节点。

        return snapshot;
    } catch (e) {
        console.error('Failed to create snapshot:', e);
        throw e;
    }
}

/**
 * 恢复到指定快照
 * @param {string} snapshotId
 * @returns {Promise<boolean>}
 */
export function restoreSnapshot(snapshotId) {
    return serializeSnapshotWrite(() => restoreSnapshotNow(snapshotId));
}

export async function getPendingSnapshotRestore() {
    const journal = await get(RESTORE_JOURNAL_KEY);
    return journal && journal.phase !== 'completed' ? journal : null;
}

function mergeRestoredSessions(current, saved, restoreId) {
    const sessions = structuredClone(current.sessions);
    const restoredIds = new Map();
    for (const session of saved.sessions) {
        if (!session || typeof session.id !== 'string') continue;
        const existing = sessions.find(item => item.id === session.id);
        if (!existing) {
            sessions.push(structuredClone(session));
            restoredIds.set(session.id, session.id);
        } else if (JSON.stringify(existing) === JSON.stringify(session)) {
            restoredIds.set(session.id, session.id);
        } else {
            // Conversation history is global. Keep later edits and restore older versions as copies.
            const id = `restored-${restoreId}-${session.id}`;
            if (!sessions.some(item => item.id === id)) {
                sessions.push({ ...structuredClone(session), id, title: text('恢复的对话：', 'Restored conversation: ', 'Восстановленный диалог: ') + (session.title || '') });
            }
            restoredIds.set(session.id, id);
        }
    }
    return { ...current, sessions, activeSessionId: restoredIds.get(saved.activeSessionId) || current.activeSessionId };
}

async function restoreSnapshotNow(snapshotId) {
    let journal;
    try {
        const target = await getSnapshotById(snapshotId);
        if (!target) throw new Error('Snapshot not found');
        const data = target.data || {};
        const workId = data.workId || getActiveWorkId() || 'work-default';
        if (!Array.isArray(data.chapters) || !Array.isArray(data.settingsNodes)) {
            throw new Error(text('快照内容不完整，未修改作品。', 'Snapshot is incomplete. No work was changed.'));
        }
        const pending = await getPendingSnapshotRestore();
        if (pending && snapshotId !== pending.snapshotId && snapshotId !== pending.backupId) {
            throw new Error(text('请先重试上次恢复，或恢复其备份。', 'Retry the unfinished restore or restore its backup first.'));
        }
        if (pending?.snapshotId === snapshotId) {
            if (pending.workId !== workId || !await getSnapshotById(pending.backupId)) {
                throw new Error(text('找不到恢复前的备份，已停止恢复。', 'The backup before restore is missing. Restore stopped.'));
            }
            journal = { ...pending, phase: 'applying' };
        } else {
            const backup = await createSnapshotNow(text('恢复前的备份', 'Backup before restore', 'Резервная копия перед восстановлением'), 'manual', { workId, strictRead: true, protectedIds: [snapshotId] });
            journal = { id: newSnapshotId(), snapshotId, backupId: backup.id, workId, phase: 'applying', startedAt: Date.now() };
        }
        // Persist recovery information before changing any work data, including on retries.
        await set(RESTORE_JOURNAL_KEY, journal);

        const previousAwaitServerWrite = window._forcePersistAwaitServerWrite;
        window._forcePersistAwaitServerWrite = true;
        try {
            await saveChapters(data.chapters, workId);
            await saveSettingsNodes(data.settingsNodes, workId);
            if (Array.isArray(data.chapterMemoryGroups)) {
                await saveChapterMemoryGroups(data.chapterMemoryGroups, workId);
            }
            if (isValidSessionStore(data.chatSessions)) {
                const current = await getChatSessionsForSnapshot(true);
                const restored = mergeRestoredSessions(current, data.chatSessions, journal.id);
                // The usual chat save helper suppresses errors; recovery must observe write failures.
                await persistSet('author-chat-sessions', restored);
                useAppStore.getState().setSessionStore(restored);
            }
            await restoreWorksIndexForSnapshot(workId, data.worksIndex);
            await set(RESTORE_JOURNAL_KEY, { ...journal, phase: 'completed', completedAt: Date.now() });
            setActiveWorkId(workId);
        } finally {
            window._forcePersistAwaitServerWrite = previousAwaitServerWrite;
        }

        return true;
    } catch (e) {
        if (journal) {
            // If this update also fails, the durable "applying" record still supports recovery.
            await set(RESTORE_JOURNAL_KEY, { ...journal, phase: 'failed' }).catch(() => {});
        }
        console.error('Failed to restore snapshot:', e);
        throw e;
    }
}

/**
 * 删除指定快照
 */
export function deleteSnapshot(snapshotId) {
    return serializeSnapshotWrite(() => deleteSnapshotNow(snapshotId));
}

async function deleteSnapshotNow(snapshotId) {
    const pending = await getPendingSnapshotRestore();
    if (pending && [pending.snapshotId, pending.backupId].includes(snapshotId)) {
        throw new Error(text('此快照用于完成上次恢复，暂时不能删除。', 'This snapshot is needed for the unfinished restore and cannot be deleted yet.'));
    }
    const snapshots = await getSnapshotIndex();
    const remaining = snapshots.filter(s => s.id !== snapshotId);
    await saveSnapshotIndex(remaining);
    await del(getSnapshotDataKey(snapshotId)).catch(() => { });
    return remaining;
}
