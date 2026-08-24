// 本地存储工具 - 使用持久化适配器管理核心数据 (章节、摘要)
// 优先服务端文件系统，fallback 到浏览器 IndexedDB
// 章节按作品(workId)隔离存储

import { persistGet, persistSet, persistDel } from './persistence';

const LEGACY_STORAGE_KEY = 'author-chapters';
const chapterOperationQueues = new Map();

function getStorageKey(workId) {
    return workId ? `author-chapters-${workId}` : LEGACY_STORAGE_KEY;
}

function enqueueChapterOperation(workId, operation) {
    const key = getStorageKey(workId);
    const previous = chapterOperationQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    chapterOperationQueues.set(key, current);

    return current.finally(() => {
        if (chapterOperationQueues.get(key) === current) {
            chapterOperationQueues.delete(key);
        }
    });
}

async function readChapters(key) {
    const chapters = await persistGet(key);
    return Array.isArray(chapters) ? chapters : [];
}

async function writeChapters(key, chapters) {
    await persistSet(key, chapters);
}

// 生成唯一ID
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 一次性迁移：将旧的全局 author-chapters 剪切到当前活跃作品
 * 调用方在 page.js initData 中负责调用
 */
export async function migrateGlobalChapters(workId) {
    if (typeof window === 'undefined' || !workId) return;
    try {
        await enqueueChapterOperation(workId, async () => {
            const perWorkData = await persistGet(getStorageKey(workId));
            if (perWorkData) return; // 该作品已有数据，不迁移

            const globalData = await persistGet(LEGACY_STORAGE_KEY);
            if (globalData && Array.isArray(globalData) && globalData.length > 0) {
                await writeChapters(getStorageKey(workId), globalData);
                await persistDel(LEGACY_STORAGE_KEY);
            }
        });
    } catch {
        // Keep the legacy global chapters untouched if migration fails.
    }
}

// 获取所有章节 (Async)
export async function getChapters(workId) {
    if (typeof window === 'undefined') return [];
    const key = getStorageKey(workId);
    try {
        const pending = chapterOperationQueues.get(key);
        if (pending) await pending.catch(() => undefined);
        return await readChapters(key);
    } catch {
        return [];
    }
}

// 保存所有章节 (Async)
export async function saveChapters(chapters, workId) {
    if (typeof window === 'undefined') return;
    await enqueueChapterOperation(workId, () => writeChapters(getStorageKey(workId), chapters));
}

// 创建新章节 (Async)
export async function createChapter(title = '未命名章节', workId) {
    return enqueueChapterOperation(workId, async () => {
        const key = getStorageKey(workId);
        const chapters = await readChapters(key);
        const newChapter = {
            id: generateId(),
            title,
            content: '',
            wordCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        chapters.push(newChapter);
        await writeChapters(key, chapters);
        return newChapter;
    });
}

// 在指定条目后插入新章节 (Async)
export async function insertChapterAfter(title = '未命名章节', afterId, workId) {
    return enqueueChapterOperation(workId, async () => {
        const key = getStorageKey(workId);
        const chapters = await readChapters(key);
        const newChapter = {
            id: generateId(),
            title,
            content: '',
            wordCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const index = chapters.findIndex(ch => ch.id === afterId);
        chapters.splice(index === -1 ? chapters.length : index + 1, 0, newChapter);
        await writeChapters(key, chapters);
        return { chapter: newChapter, chapters };
    });
}

// 更新章节 (Async)
export async function updateChapter(id, updates, workId) {
    return enqueueChapterOperation(workId, async () => {
        const key = getStorageKey(workId);
        const chapters = await readChapters(key);
        const index = chapters.findIndex(ch => ch.id === id);
        if (index === -1) return null;

        chapters[index] = {
            ...chapters[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        await writeChapters(key, chapters);
        return chapters[index];
    });
}

// 删除章节 (Async)
export async function deleteChapter(id, workId) {
    return enqueueChapterOperation(workId, async () => {
        const key = getStorageKey(workId);
        const chapters = await readChapters(key);
        const newChapters = chapters.filter(ch => ch.id !== id);
        await writeChapters(key, newChapters);
        return newChapters;
    });
}

// 创建分卷 (Async) — afterId: 插入到该 id 之后；null 且无分卷时插入顶部；null 且有分卷时追加末尾
export async function createVolume(title = '第一卷', workId, afterId) {
    return enqueueChapterOperation(workId, async () => {
        const key = getStorageKey(workId);
        const chapters = await readChapters(key);
        const vol = {
            id: generateId(),
            title,
            type: 'volume',
            collapsed: false,
            createdAt: new Date().toISOString(),
        };
        const hasVolumes = chapters.some(c => c.type === 'volume');
        if (afterId) {
            const idx = chapters.findIndex(c => c.id === afterId);
            // 如果 afterId 是分卷，插入到该分卷的所有子章节之后
            let insertAt = idx + 1;
            if (idx !== -1 && chapters[idx].type === 'volume') {
                while (insertAt < chapters.length && (chapters[insertAt].type || 'chapter') !== 'volume') {
                    insertAt++;
                }
            }
            chapters.splice(insertAt === -1 ? chapters.length : insertAt, 0, vol);
        } else if (!hasVolumes) {
            chapters.unshift(vol);
        } else {
            chapters.push(vol);
        }
        await writeChapters(key, chapters);
        return { vol, chapters };
    });
}

// 在指定分卷下末尾插入新章节 (Async)
export async function insertChapterInVolume(title, volumeId, workId) {
    return enqueueChapterOperation(workId, async () => {
        const key = getStorageKey(workId);
        const chapters = await readChapters(key);
        const volIdx = chapters.findIndex(c => c.id === volumeId);
        const newChapter = {
            id: generateId(),
            title,
            content: '',
            wordCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        let insertIdx = chapters.length;
        if (volIdx !== -1) {
            insertIdx = volIdx + 1;
            while (insertIdx < chapters.length && (chapters[insertIdx].type || 'chapter') !== 'volume') {
                insertIdx++;
            }
        }

        chapters.splice(insertIdx, 0, newChapter);
        await writeChapters(key, chapters);
        return { chapter: newChapter, chapters };
    });
}

// 按拖拽后的新 ID 顺序重排 (Async)
export async function reorderItems(orderedIds, workId) {
    return enqueueChapterOperation(workId, async () => {
        const key = getStorageKey(workId);
        const chapters = await readChapters(key);
        const map = new Map(chapters.map(c => [c.id, c]));
        const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
        const orderedIdSet = new Set(orderedIds);
        for (const ch of chapters) {
            if (!orderedIdSet.has(ch.id)) reordered.push(ch);
        }
        await writeChapters(key, reordered);
        return reordered;
    });
}

// 获取单个章节 (Async)
export async function getChapter(id, workId) {
    const chapters = await getChapters(workId);
    return chapters.find(ch => ch.id === id) || null;
}

// 通用下载辅助：优先使用 File System Access API（弹出系统另存为对话框），
// 回退到 data URL（兼容旧浏览器）
async function downloadTextFile(content, fileName) {
    // 方式一：File System Access API（Chrome/Edge 86+）
    if (typeof window !== 'undefined' && window.showSaveFilePicker) {
        try {
            const ext = fileName.split('.').pop() || 'txt';
            const mimeType = ext === 'md' ? 'text/markdown' : 'text/plain';
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: ext.toUpperCase() + ' File',
                    accept: { [mimeType]: ['.' + ext] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return;
        } catch (e) {
            if (e.name === 'AbortError') return; // 用户取消
            console.warn('showSaveFilePicker fallback:', e);
            // 降级到方式二
        }
    }
    // 方式二：data URL
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 导出为 Markdown
export function exportToMarkdown(chapter) {
    const md = `# ${chapter.title}\n\n${chapter.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')}`;
    downloadTextFile(md, `${chapter.title || '未命名'}.md`);
}

// 导出所有章节
export function exportAllToMarkdown(chapters) {
    const md = chapters.map(ch => {
        const text = ch.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
        return `# ${ch.title}\n\n${text}`;
    }).join('\n\n---\n\n');

    downloadTextFile(md, '全部章节.md');
}

// ==================== 章节摘要缓存 ====================

const SUMMARY_PREFIX = 'author-chapter-summary-';

// 获取章节摘要 (Async)
export async function getChapterSummary(id) {
    if (typeof window === 'undefined') return null;
    try {
        const summary = await persistGet(SUMMARY_PREFIX + id);
        return summary || null;
    } catch {
        return null;
    }
}

// 保存章节摘要 (Async)
export async function saveChapterSummary(id, summary) {
    if (typeof window === 'undefined') return;
    await persistSet(SUMMARY_PREFIX + id, summary);
}
