'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    User, MapPin, Globe, Gem, ClipboardList, Ruler, BookOpen,
    Plus, Pencil, Check, X, FolderOpen, FileText, Settings as SettingsIcon,
    Sparkles, Heart, Star, Shield, Zap, Feather, Compass, Flag, Tag, Layers
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getSettingsNodes, getActiveWorkId } from '../lib/settings';
import { useI18n } from '../lib/useI18n';
import { getIconByName } from './SettingsCategoryPanel';

// 分类图标映射
const CAT_ICONS = {
    bookInfo: BookOpen, character: User, location: MapPin, world: Globe,
    object: Gem, plot: ClipboardList, rules: Ruler, custom: SettingsIcon,
};

// 分类颜色
const CAT_COLORS = {
    bookInfo: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    character: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    location: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    world: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    object: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    plot: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    rules: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    custom: { color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

// 分类中文名
const CAT_LABELS = {
    bookInfo: '作品信息', character: '人物设定', location: '空间/地点',
    world: '世界观', object: '物品/道具', plot: '大纲', rules: '写作规则',
};

// ==================== 样式定义（全部内联，避免 Tailwind 重置） ====================

const styles = {
    backdrop: {
        position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.08)',
    },
    popover: {
        position: 'fixed', zIndex: 9991, width: 300,
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-light, #e5e7eb)',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        animation: 'popover-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
    },
    title: {
        fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #1f2937)', letterSpacing: '-0.01em',
    },
    editBtn: {
        width: 30, height: 30, border: 'none', borderRadius: 8,
        background: 'transparent', color: 'var(--text-muted, #9ca3af)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
    },
    editBtnActive: {
        background: 'var(--accent-light, rgba(59,130,246,0.1))', color: 'var(--accent, #3b82f6)',
    },
    hint: {
        fontSize: 11, color: 'var(--text-muted, #9ca3af)',
        padding: '0 16px 10px', lineHeight: '1.4',
    },
    gridScroll: {
        maxHeight: 340, overflowY: 'auto', padding: '0 12px 12px',
    },
    grid: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
    },
    item: {
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8, padding: '14px 6px 12px',
        borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent', borderRadius: 14,
        background: 'var(--bg-secondary, #f9fafb)',
        cursor: 'pointer', transition: 'all 0.18s ease', textAlign: 'center',
        minHeight: 80,
    },
    itemHover: {
        background: 'var(--bg-hover, #f3f4f6)',
        borderColor: 'var(--border-light, #e5e7eb)', borderWidth: 1, borderStyle: 'solid',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    },
    itemPinned: {
        borderColor: 'var(--accent, #3b82f6)', borderWidth: 1, borderStyle: 'solid',
        background: 'var(--accent-light, rgba(59,130,246,0.08))',
    },
    iconWrap: {
        width: 40, height: 40, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    label: {
        fontSize: 11, color: 'var(--text-secondary, #6b7280)',
        lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', maxWidth: '100%', fontWeight: 500,
    },
    count: {
        position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18,
        padding: '0 5px', borderRadius: 9,
        background: 'var(--text-muted, #9ca3af)', color: '#fff',
        fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    check: {
        position: 'absolute', top: 5, right: 5, width: 18, height: 18,
        borderRadius: 5, borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-medium, #d1d5db)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary, #fff)', transition: 'all 0.15s',
    },
    checkChecked: {
        borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--accent, #3b82f6)', background: 'var(--accent, #3b82f6)', color: '#fff',
    },
    addItem: {
        borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'var(--border-medium, #d1d5db)', background: 'transparent',
    },
    fullBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        width: '100%', padding: '11px 16px', border: 'none',
        borderTop: '1px solid var(--border-light, #e5e7eb)',
        background: 'transparent', color: 'var(--text-muted, #9ca3af)',
        fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
    },
};

// ==================== Pinned 分类持久化 ====================

const PINNED_KEY = 'author-pinned-categories';
const DEFAULT_PINNED = ['character', 'location', 'world', 'object', 'plot', 'rules'];

export function getPinnedCategories() {
    if (typeof window === 'undefined') return DEFAULT_PINNED;
    try {
        const raw = localStorage.getItem(PINNED_KEY);
        if (!raw) return DEFAULT_PINNED;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : DEFAULT_PINNED;
    } catch { return DEFAULT_PINNED; }
}

export function savePinnedCategories(list) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PINNED_KEY, JSON.stringify(list));
}

/**
 * 设定分类缩略图弹出面板（3×3 宫格，高级卡片风格）
 */
export default function SettingsCategoryPopover({ anchorRef, onClose, onOpenCategory, onAddCategory }) {
    const { t } = useI18n();
    const popoverRef = useRef(null);
    const [mounted, setMounted] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [categories, setCategories] = useState([]);
    const [itemCounts, setItemCounts] = useState({});
    const [hoveredId, setHoveredId] = useState(null);
    const [pinnedList, setPinnedList] = useState(() => getPinnedCategories());

    // 加载分类列表
    useEffect(() => {
        setMounted(true);
        const loadCategories = async () => {
            const workId = getActiveWorkId();
            if (!workId) return;
            const nodes = await getSettingsNodes(workId);
            const catFolders = nodes.filter(n =>
                (n.type === 'folder' || n.type === 'special') && n.parentId === workId
            );
            const counts = {};
            catFolders.forEach(folder => {
                const countDescendants = (pid) => {
                    let count = 0;
                    nodes.filter(n => n.parentId === pid).forEach(child => {
                        if (child.type === 'item') count++;
                        else count += countDescendants(child.id);
                    });
                    return count;
                };
                counts[folder.category] = countDescendants(folder.id);
            });
            setItemCounts(counts);
            setCategories(catFolders);
        };
        loadCategories();
    }, []);

    // 定位弹出面板
    useLayoutEffect(() => {
        if (!mounted || !anchorRef?.current) return;
        const positionPopover = () => {
            const popover = popoverRef.current;
            const anchor = anchorRef.current;
            if (!popover || !anchor) return;
            const rect = anchor.getBoundingClientRect();
            const popoverW = popover.offsetWidth;
            const popoverH = popover.offsetHeight;
            const vh = window.innerHeight;
            const vw = window.innerWidth;
            let left = rect.right + 10;
            let top = rect.top - 20;
            if (left + popoverW > vw - 12) left = Math.max(12, rect.left - popoverW - 10);
            if (top + popoverH > vh - 12) top = vh - popoverH - 12;
            if (top < 12) top = 12;
            popover.style.left = left + 'px';
            popover.style.top = top + 'px';
        };
        requestAnimationFrame(positionPopover);
    }, [mounted, anchorRef, categories.length]);

    const handleCategoryClick = useCallback((category) => {
        if (editMode) {
            // 编辑模式: 切换 pin 状态
            setPinnedList(prev => {
                if (prev.includes(category)) {
                    const next = prev.filter(c => c !== category);
                    savePinnedCategories(next);
                    return next;
                }
                if (prev.length >= 10) return prev; // 最多 10 个
                const next = [...prev, category];
                savePinnedCategories(next);
                return next;
            });
            return;
        }
        onOpenCategory?.(category);
        onClose?.();
    }, [editMode, onOpenCategory, onClose]);

    if (!mounted) return null;

    return createPortal(
        <>
            {/* 背景遮罩 */}
            <div style={styles.backdrop} onMouseDown={onClose} />
            {/* 弹出卡片 */}
            <div ref={popoverRef} style={styles.popover}>
                {/* 标题栏 */}
                <div style={styles.header}>
                    <span style={styles.title}>
                        {editMode ? '编辑导航栏' : '设定集'}
                    </span>
                    <button
                        style={{ ...styles.editBtn, ...(editMode ? styles.editBtnActive : {}) }}
                        onClick={() => setEditMode(!editMode)}
                        title={editMode ? '完成' : '编辑导航栏显示'}
                        onMouseEnter={e => { if (!editMode) e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)'; }}
                        onMouseLeave={e => { if (!editMode) e.currentTarget.style.background = 'transparent'; }}
                    >
                        {editMode ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                </div>

                {editMode && (
                    <div style={styles.hint}>勾选的分类将显示在左侧导航栏</div>
                )}

                {/* 网格 */}
                <div style={styles.gridScroll}>
                    <div style={styles.grid}>
                        {categories.map(cat => {
                            const Icon = (cat.icon && getIconByName(cat.icon)) || CAT_ICONS[cat.category] || FileText;
                            const colors = CAT_COLORS[cat.category] || CAT_COLORS.custom;
                            const count = itemCounts[cat.category] || 0;
                            const isHovered = hoveredId === cat.id;

                            return (
                                <div
                                    key={cat.id}
                                    style={{
                                        ...styles.item,
                                        ...(isHovered ? styles.itemHover : {}),
                                    }}
                                    onClick={() => handleCategoryClick(cat.category)}
                                    onMouseEnter={() => setHoveredId(cat.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    title={cat.name}
                                >
                                    <span style={{ ...styles.iconWrap, color: colors.color, background: colors.bg }}>
                                        <Icon size={20} />
                                    </span>
                                    <span style={styles.label}>{cat.name}</span>
                                    {editMode ? (
                                        <span style={{
                                            ...styles.check,
                                            ...(pinnedList.includes(cat.category) ? styles.checkChecked : {}),
                                        }}>
                                            {pinnedList.includes(cat.category) && <Check size={10} />}
                                        </span>
                                    ) : (
                                        count > 0 && <span style={styles.count}>{count}</span>
                                    )}
                                </div>
                            );
                        })}

                        {/* 新建分类 */}
                        {!editMode && (
                            <div
                                style={{
                                    ...styles.item,
                                    ...styles.addItem,
                                    ...(hoveredId === '_add' ? { background: 'var(--bg-secondary, #f9fafb)', borderColor: 'var(--accent, #3b82f6)' } : {}),
                                }}
                                onClick={() => { onAddCategory?.(); onClose?.(); }}
                                onMouseEnter={() => setHoveredId('_add')}
                                onMouseLeave={() => setHoveredId(null)}
                                title="新建分类"
                            >
                                <span style={{ ...styles.iconWrap, color: 'var(--text-muted, #9ca3af)', background: 'var(--bg-hover, #f3f4f6)' }}>
                                    <Plus size={20} />
                                </span>
                                <span style={styles.label}>新建分类</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 底部按钮 */}
                {!editMode && (
                    <button
                        style={styles.fullBtn}
                        onClick={() => {
                            const { setShowSettings } = useAppStore.getState();
                            setShowSettings('settings');
                            onClose?.();
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)'; e.currentTarget.style.color = 'var(--accent, #3b82f6)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'; }}
                    >
                        <SettingsIcon size={13} />
                        <span>打开完整设定面板</span>
                    </button>
                )}
            </div>
        </>,
        document.body
    );
}
