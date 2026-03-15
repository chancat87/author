'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Maximize2, Minimize2, Plus, Search, FolderOpen, ChevronRight, ChevronDown,
    Trash2, EyeOff, FileText, FolderPlus, BookOpen, Upload, Download,
    User, MapPin, Globe, Gem, ClipboardList, Ruler, Settings as SettingsIcon,
    Heart, Star, Shield, Zap, Feather, Compass, Flag, Tag, Layers,
    Bookmark, Crown, Flame, Lightbulb, Music, Palette, Sword, Target,
    Moon, Sun, Cloud, TreePine, Mountain, Waves, Building, Car,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
    getSettingsNodes, addSettingsNode, updateSettingsNode, deleteSettingsNode,
    getActiveWorkId, setActiveWorkId, getAllWorks, addWork, saveSettingsNodes,
} from '../lib/settings';
import { useI18n } from '../lib/useI18n';
import SettingsItemEditor from './SettingsItemEditor';
import { downloadFile, downloadBlob } from '../lib/project-io';
import {
    detectCategory, parseTextToFields, mapFieldsToContent,
    parseMultipleEntries, isStructuredText, parseStructuredText,
    preprocessPdfText,
    exportNodesToTxt, exportNodesToMarkdown,
    exportNodesToDocx, exportSettingsAsPdf, parseDocxToText, parsePdfToText,
} from '../lib/settings-io';

// ==================== 图标库 ====================
const ICON_MAP = {
    FolderOpen, User, MapPin, Globe, Gem, ClipboardList, Ruler,
    Heart, Star, Shield, Zap, Feather, Compass, Flag, Tag, Layers,
    Bookmark, Crown, Flame, Lightbulb, Music, Palette, Sword, Target,
    Moon, Sun, Cloud, TreePine, Mountain, Waves, Building, Car,
    FileText, BookOpen, Settings: SettingsIcon,
};

const ICON_GRID = [
    'FolderOpen', 'User', 'Heart', 'Star', 'Shield', 'Zap',
    'Crown', 'Sword', 'Flag', 'Target', 'Compass', 'Feather',
    'Flame', 'Lightbulb', 'Moon', 'Sun', 'Cloud', 'TreePine',
    'Mountain', 'Waves', 'Building', 'Music', 'Palette', 'Bookmark',
    'MapPin', 'Globe', 'Gem', 'Tag', 'Layers', 'Car',
    'ClipboardList', 'Ruler', 'FileText', 'BookOpen',
];

function getIconComponent(iconName) {
    return ICON_MAP[iconName] || FolderOpen;
}

// ==================== 分类配置 ====================
const CAT_META = {
    bookInfo: { icon: BookOpen, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: '作品信息' },
    character: { icon: User, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: '人物设定' },
    location: { icon: MapPin, color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: '空间/地点' },
    world: { icon: Globe, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: '世界观' },
    object: { icon: Gem, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '物品/道具' },
    plot: { icon: ClipboardList, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: '大纲' },
    rules: { icon: Ruler, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: '写作规则' },
    custom: { icon: SettingsIcon, color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: '自定义' },
};

function getCatMeta(category) {
    return CAT_META[category] || CAT_META.custom;
}

// ==================== 样式 ====================
const S = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    },
    container: {
        background: 'var(--bg-card, #fff)',
        borderRadius: 18,
        boxShadow: '0 32px 100px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
        width: '90%', maxWidth: 980,
        height: '78vh', maxHeight: '86vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'settingsSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    containerFull: {
        position: 'fixed', inset: 0,
        width: '100%', maxWidth: '100%',
        height: '100%', maxHeight: '100%',
        borderRadius: 0,
        background: 'var(--bg-card, #fff)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: 'none',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 22px',
        borderBottom: '1px solid var(--border-light, #e5e7eb)',
        flexShrink: 0,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
    headerIcon: {
        width: 36, height: 36, borderRadius: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    headerTitle: {
        fontSize: 17, fontWeight: 700,
        color: 'var(--text-primary, #1f2937)',
        margin: 0, letterSpacing: '-0.01em',
    },
    headerCount: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12 },
    headerBtn: {
        width: 32, height: 32, border: 'none', borderRadius: 9,
        background: 'transparent', color: 'var(--text-muted, #9ca3af)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
    },
    body: { flex: 1, display: 'flex', overflow: 'hidden' },
    sidebar: {
        width: 260, minWidth: 260,
        borderRight: '1px solid var(--border-light, #e5e7eb)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-secondary, #f9fafb)',
    },
    searchWrap: { padding: '12px 14px', borderBottom: '1px solid var(--border-light, #e5e7eb)' },
    searchBox: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-light, #e5e7eb)',
        borderRadius: 10, transition: 'all 0.2s ease',
    },
    searchInput: {
        flex: 1, border: 'none', outline: 'none',
        background: 'transparent', color: 'var(--text-primary, #1f2937)', fontSize: 13,
    },
    treeList: { flex: 1, overflowY: 'auto', padding: '6px 8px' },
    treeFolder: {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 8px', borderRadius: 9,
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
        color: 'var(--text-primary, #1f2937)',
        transition: 'all 0.12s ease', userSelect: 'none',
    },
    treeItem: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 9,
        cursor: 'pointer', fontSize: 13,
        color: 'var(--text-primary, #1f2937)',
        transition: 'all 0.12s ease', userSelect: 'none',
    },
    treeDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
    treeName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    treeCount: {
        fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 9,
        background: 'var(--bg-hover, #f3f4f6)', color: 'var(--text-muted, #9ca3af)', flexShrink: 0,
    },
    treeAction: {
        opacity: 0, border: 'none', background: 'none',
        cursor: 'pointer', padding: 3, borderRadius: 6,
        color: 'var(--text-muted, #9ca3af)',
        display: 'flex', alignItems: 'center', transition: 'all 0.15s', flexShrink: 0,
    },
    renameInput: {
        flex: 1, minWidth: 0, padding: '2px 8px',
        border: '2px solid var(--accent, #3b82f6)', borderRadius: 6,
        background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #1f2937)',
        fontSize: 13, outline: 'none',
    },
    emptyState: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 14, height: '100%', padding: '40px 20px',
    },
    emptyIcon: {
        width: 48, height: 48, borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7,
    },
    addBtn: {
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '8px 18px', border: '1.5px dashed', borderRadius: 10,
        background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
        transition: 'all 0.18s ease',
    },
    footer: {
        padding: '10px 14px',
        borderTop: '1px solid var(--border-light, #e5e7eb)',
        display: 'flex', gap: 8, alignItems: 'center',
        position: 'relative',
    },
    footerBtn: {
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 14px',
        border: '1px solid var(--border-light, #e5e7eb)', borderRadius: 9,
        background: 'var(--bg-card, #fff)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
        color: 'var(--text-secondary, #6b7280)', transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    },
    editor: { flex: 1, overflowY: 'auto', background: 'var(--bg-primary, #fff)' },
    // 新建菜单
    addMenu: {
        position: 'absolute', bottom: '100%', left: 14, marginBottom: 6,
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-light, #e5e7eb)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        overflow: 'hidden', minWidth: 180, zIndex: 10,
        animation: 'popover-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    addMenuItem: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', width: '100%',
        border: 'none', background: 'transparent',
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
        color: 'var(--text-primary, #1f2937)',
        transition: 'all 0.12s ease', textAlign: 'left',
    },
    addMenuIcon: {
        width: 30, height: 30, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    // 图标选择器
    iconPicker: {
        position: 'absolute', zIndex: 100,
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-light, #e5e7eb)',
        borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
        padding: 12, width: 240,
    },
    iconGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4,
    },
    iconCell: {
        width: 34, height: 34, border: 'none', borderRadius: 8,
        background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s ease',
    },
};

// ==================== 图标选择器 ====================
function IconPicker({ currentIcon, color, bg, onSelect, onClose, anchorRect }) {
    const ref = useRef(null);
    useEffect(() => {
        const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const [hovered, setHovered] = useState(null);

    // Position near anchor
    const style = {
        ...S.iconPicker,
        top: anchorRect ? anchorRect.bottom + 6 : 40,
        left: anchorRect ? Math.max(8, anchorRect.left - 40) : 8,
    };

    return (
        <div ref={ref} style={style} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, padding: '0 2px' }}>选择图标</div>
            <div style={S.iconGrid}>
                {ICON_GRID.map(name => {
                    const Icon = ICON_MAP[name];
                    if (!Icon) return null;
                    const isActive = currentIcon === name;
                    const isHover = hovered === name;
                    return (
                        <button
                            key={name}
                            style={{
                                ...S.iconCell,
                                background: isActive ? bg : isHover ? 'var(--bg-hover, #f3f4f6)' : 'transparent',
                                color: isActive ? color : isHover ? color : 'var(--text-secondary, #6b7280)',
                                outline: isActive ? `2px solid ${color}` : 'none',
                                outlineOffset: -2,
                            }}
                            onClick={() => { onSelect(name); onClose(); }}
                            onMouseEnter={() => setHovered(name)}
                            onMouseLeave={() => setHovered(null)}
                            title={name}
                        >
                            <Icon size={16} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ==================== 新建菜单 ====================
function AddMenu({ onAddFolder, onAddItem, onClose, catColor, catBg }) {
    const ref = useRef(null);
    const [hovered, setHovered] = useState(null);
    useEffect(() => {
        const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    return (
        <div ref={ref} style={S.addMenu}>
            <button
                style={{
                    ...S.addMenuItem,
                    background: hovered === 'folder' ? 'var(--bg-hover, #f3f4f6)' : 'transparent',
                }}
                onClick={() => { onAddFolder(); onClose(); }}
                onMouseEnter={() => setHovered('folder')}
                onMouseLeave={() => setHovered(null)}
            >
                <span style={{ ...S.addMenuIcon, color: catColor, background: catBg }}>
                    <FolderPlus size={16} />
                </span>
                <span>新建分类</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>子分组</span>
            </button>
            <div style={{ height: 1, background: 'var(--border-light, #e5e7eb)', margin: '0 12px' }} />
            <button
                style={{
                    ...S.addMenuItem,
                    background: hovered === 'item' ? 'var(--bg-hover, #f3f4f6)' : 'transparent',
                }}
                onClick={() => { onAddItem(); onClose(); }}
                onMouseEnter={() => setHovered('item')}
                onMouseLeave={() => setHovered(null)}
            >
                <span style={{ ...S.addMenuIcon, color: '#6b7280', background: 'var(--bg-hover, #f3f4f6)' }}>
                    <FileText size={16} />
                </span>
                <span>新建条目</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>设定项</span>
            </button>
        </div>
    );
}

// ==================== 左侧条目列表 ====================
function ItemList({ nodes, rootFolder, category, selectedId, onSelect, onAddFolder, onAddItem, onRename, onChangeIcon, searchQuery }) {
    const meta = getCatMeta(category);
    const [collapsed, setCollapsed] = useState({});
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [hoveredId, setHoveredId] = useState(null);
    const [iconPickerFor, setIconPickerFor] = useState(null);
    const [iconPickerRect, setIconPickerRect] = useState(null);
    const renameInputRef = useRef(null);

    const getChildren = useCallback((parentId) => {
        return nodes.filter(n => n.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [nodes]);

    const matchesSearch = useCallback((node) => {
        if (!searchQuery) return true;
        return node.name?.toLowerCase().includes(searchQuery.toLowerCase());
    }, [searchQuery]);

    const startRename = (node) => {
        setRenamingId(node.id);
        setRenameValue(node.name);
        setTimeout(() => renameInputRef.current?.focus(), 50);
    };

    const finishRename = () => {
        if (renamingId && renameValue.trim()) onRename(renamingId, renameValue.trim());
        setRenamingId(null);
    };

    const handleIconClick = (e, nodeId) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        // Convert to position relative to treeList container
        const listEl = e.currentTarget.closest('[data-tree-list]');
        const listRect = listEl?.getBoundingClientRect() || { top: 0, left: 0 };
        setIconPickerFor(nodeId);
        setIconPickerRect({
            top: rect.top - listRect.top,
            bottom: rect.bottom - listRect.top,
            left: rect.left - listRect.left,
        });
    };

    // Count all items recursively
    const countItems = useCallback((parentId) => {
        const children = nodes.filter(n => n.parentId === parentId);
        let count = 0;
        for (const child of children) {
            if (child.type === 'item') count++;
            else count += countItems(child.id);
        }
        return count;
    }, [nodes]);

    const renderNode = (node, depth = 0) => {
        if (!matchesSearch(node) && node.type === 'item') return null;
        const isFolder = node.type === 'folder';
        const isSelected = selectedId === node.id;
        const isHovered = hoveredId === node.id;
        const isCollapsed = collapsed[node.id];
        const children = getChildren(node.id);
        const indent = depth * 18;

        if (isFolder) {
            if (searchQuery) {
                const hasDescendantMatch = (pid) => {
                    const ch = nodes.filter(n => n.parentId === pid);
                    return ch.some(c => (c.type === 'item' && matchesSearch(c)) || (c.type === 'folder' && hasDescendantMatch(c.id)));
                };
                if (!hasDescendantMatch(node.id)) return null;
            }

            const FolderIcon = node.icon ? getIconComponent(node.icon) : FolderOpen;
            const totalItems = countItems(node.id);

            return (
                <div key={node.id}>
                    <div
                        style={{
                            ...S.treeFolder,
                            paddingLeft: 8 + indent,
                            background: isSelected ? `${meta.color}12` : isHovered ? 'var(--bg-hover, #f3f4f6)' : 'transparent',
                        }}
                        onClick={() => { setCollapsed(p => ({ ...p, [node.id]: !p[node.id] })); onSelect(node.id); }}
                        onMouseEnter={() => setHoveredId(node.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        <span style={{ display: 'flex', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </span>
                        <span
                            style={{ display: 'flex', cursor: 'pointer', flexShrink: 0, color: meta.color, borderRadius: 4, padding: 1 }}
                            onClick={(e) => handleIconClick(e, node.id)}
                            title="点击更换图标"
                        >
                            <FolderIcon size={14} />
                        </span>
                        {renamingId === node.id ? (
                            <input ref={renameInputRef} style={S.renameInput} value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={finishRename}
                                onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setRenamingId(null); }}
                                onClick={e => e.stopPropagation()} />
                        ) : <span style={S.treeName} onDoubleClick={(e) => { e.stopPropagation(); startRename(node); }}>{node.name}</span>}
                        <span style={S.treeCount}>{totalItems}</span>
                        <button
                            style={{ ...S.treeAction, opacity: isHovered ? 1 : 0 }}
                            onClick={e => { e.stopPropagation(); onAddItem(node.id); }}
                            title="新建条目"
                        ><Plus size={12} /></button>
                    </div>
                    {!isCollapsed && children.map(child => renderNode(child, depth + 1))}
                </div>
            );
        }

        // item
        return (
            <div
                key={node.id}
                style={{
                    ...S.treeItem,
                    paddingLeft: 12 + indent,
                    background: isSelected ? `${meta.color}16` : isHovered ? 'var(--bg-hover, #f3f4f6)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                }}
                onClick={() => onSelect(node.id)}
                onDoubleClick={() => startRename(node)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                title={node.name}
            >
                <span style={{ ...S.treeDot, background: isSelected ? meta.color : `${meta.color}60` }} />
                {renamingId === node.id ? (
                    <input ref={renameInputRef} style={S.renameInput} value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={finishRename}
                        onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setRenamingId(null); }}
                        onClick={e => e.stopPropagation()} />
                ) : <span style={S.treeName}>{node.name}</span>}
                {node.enabled === false && <EyeOff size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            </div>
        );
    };

    const rootChildren = rootFolder ? getChildren(rootFolder.id) : [];

    if (rootChildren.length === 0) {
        return (
            <div style={S.treeList} data-tree-list>
                <div style={S.emptyState}>
                    <div style={{ ...S.emptyIcon, color: meta.color, background: meta.bg }}>
                        {(() => { const Icon = meta.icon; return <Icon size={22} />; })()}
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-muted, #9ca3af)', fontWeight: 500 }}>暂无内容</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            style={{ ...S.addBtn, borderColor: `${meta.color}50`, color: meta.color, fontSize: 12, padding: '6px 14px' }}
                            onClick={() => onAddFolder(rootFolder?.id)}
                            onMouseEnter={e => { e.currentTarget.style.background = meta.bg; e.currentTarget.style.borderColor = meta.color; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = `${meta.color}50`; }}
                        >
                            <FolderPlus size={13} /> 新建分类
                        </button>
                        <button
                            style={{ ...S.addBtn, borderColor: 'var(--border-medium, #d1d5db)', color: 'var(--text-secondary, #6b7280)', fontSize: 12, padding: '6px 14px' }}
                            onClick={() => onAddItem(rootFolder?.id)}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border-medium, #d1d5db)'; }}
                        >
                            <FileText size={13} /> 新建条目
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ ...S.treeList, position: 'relative' }} data-tree-list>
            {rootChildren.map(child => renderNode(child, 0))}
            {iconPickerFor && (
                <IconPicker
                    currentIcon={nodes.find(n => n.id === iconPickerFor)?.icon || 'FolderOpen'}
                    color={meta.color}
                    bg={meta.bg}
                    onSelect={(iconName) => onChangeIcon(iconPickerFor, iconName)}
                    onClose={() => setIconPickerFor(null)}
                    anchorRect={iconPickerRect}
                />
            )}
        </div>
    );
}

// ==================== 删除确认 ====================
function DeleteConfirmDialog({ message, onConfirm, onCancel }) {
    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 20001, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
            <div style={{ background: 'var(--bg-card, #fff)', borderRadius: 16, padding: '26px 30px', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', minWidth: 300 }} onClick={e => e.stopPropagation()}>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: '0 0 22px', lineHeight: 1.6, fontWeight: 500 }}>{message}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button style={{ padding: '7px 18px', borderRadius: 9, border: '1px solid var(--border-light, #e5e7eb)', background: 'var(--bg-card, #fff)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }} onClick={onCancel}>取消</button>
                    <button style={{ padding: '7px 18px', borderRadius: 9, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }} onClick={onConfirm}>删除</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ==================== 主组件 ====================
export default function CategorySettingsModal() {
    const {
        openCategoryModal: category,
        setOpenCategoryModal,
        jumpToNodeId,
        setJumpToNodeId,
        incrementSettingsVersion,
    } = useAppStore();

    const { t } = useI18n();
    const [nodes, setNodes] = useState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [searchFocused, setSearchFocused] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [works, setWorks] = useState([]);
    const [activeWorkId, setActiveWorkIdState] = useState(null);
    const [showNewWorkInput, setShowNewWorkInput] = useState(false);
    const [newWorkName, setNewWorkName] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const searchInputRef = useRef(null);
    const importInputRef = useRef(null);

    const meta = getCatMeta(category);

    // 加载作品列表
    useEffect(() => {
        if (category) {
            (async () => {
                const allWorks = await getAllWorks();
                setWorks(allWorks);
                setActiveWorkIdState(getActiveWorkId());
            })();
        }
    }, [category]);

    // 切换作品
    const handleSwitchWork = async (workId) => {
        setActiveWorkIdState(workId);
        setActiveWorkId(workId);
        useAppStore.getState().setActiveWorkId(workId);
        setSelectedNodeId(null);
        const workNodes = await getSettingsNodes(workId);
        setNodes(workNodes);
    };

    // 新建作品
    const handleCreateWork = async () => {
        const trimmed = newWorkName.trim();
        if (!trimmed) return;
        const name = trimmed;
        const newWork = await addWork(name);
        setWorks(prev => [...prev, newWork]);
        setShowNewWorkInput(false);
        setNewWorkName('');
        await handleSwitchWork(newWork.id);
    };

    // 导出当前分类的设定（多格式）
    const handleExportCategory = async (format = 'json') => {
        const catItems = nodes.filter(n => n.category === category && n.type === 'item');
        if (catItems.length === 0) { alert('当前分类没有可导出的条目'); return; }
        setShowExportMenu(false);
        const baseName = meta.label + '-设定';

        if (format === 'txt') {
            const txt = exportNodesToTxt(catItems);
            await downloadFile(txt, `${baseName}.txt`, 'text/plain');
        } else if (format === 'md') {
            const md = exportNodesToMarkdown(catItems);
            await downloadFile(md, `${baseName}.md`, 'text/markdown');
        } else if (format === 'docx') {
            const blob = await exportNodesToDocx(catItems);
            await downloadBlob(blob, `${baseName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        } else if (format === 'pdf') {
            exportSettingsAsPdf(catItems);
        } else {
            // JSON
            const data = {
                type: 'author-category-export',
                version: 1,
                category,
                categoryLabel: meta.label,
                exportedAt: new Date().toISOString(),
                items: catItems.map(({ embedding, ...rest }) => rest),
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${baseName}.json`; a.click();
            URL.revokeObjectURL(url);
        }
    };

    // 导入当前分类的设定（多格式）
    const handleImportCategory = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const ext = file.name.split('.').pop().toLowerCase();
        try {
            const workId = getActiveWorkId();
            const parentFolder = nodes.find(n => n.type === 'folder' && n.category === category);
            const parentId = parentFolder?.id || workId;

            // JSON 导入
            if (ext === 'json') {
                const text = await file.text();
                const data = JSON.parse(text);
                let importItems = [];
                if (data.type === 'author-category-export' && Array.isArray(data.items)) {
                    importItems = data.items;
                } else if (data.type === 'author-settings-export' && Array.isArray(data.nodes)) {
                    importItems = data.nodes.filter(n => n.type === 'item' && n.category === category);
                } else {
                    alert('无法识别的JSON格式'); return;
                }
                if (importItems.length === 0) { alert('未找到可导入的条目'); return; }
                let updatedNodes = [...nodes];
                let count = 0;
                for (const item of importItems) {
                    const nodeId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6) + count;
                    updatedNodes.push({
                        id: nodeId, name: item.name || '导入条目', type: 'item',
                        category, parentId, order: count,
                        content: item.content || {},
                        collapsed: false, enabled: true,
                        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                    });
                    count++;
                }
                await saveSettingsNodes(updatedNodes, workId);
                setNodes(updatedNodes);
                alert(`成功导入 ${count} 个${meta.label}条目`);
                return;
            }

            // TXT/MD/DOCX/PDF 智能导入
            let text;
            if (ext === 'docx') {
                text = await parseDocxToText(file);
            } else if (ext === 'pdf') {
                text = await parsePdfToText(file);
                text = preprocessPdfText(text);
            } else {
                text = await file.text();
            }

            let importedItems = [];
            if (isStructuredText(text)) {
                const parsedEntries = parseStructuredText(text);
                for (const entry of parsedEntries) {
                    // 只导入匹配当前分类的条目
                    if (entry.category && entry.category !== category) continue;
                    const mapped = mapFieldsToContent(entry.fields, category);
                    const nodeName = mapped.name || entry.name || '导入条目';
                    if (Object.keys(mapped.content).length === 0) continue;
                    importedItems.push({ name: nodeName, category, content: mapped.content });
                }
            } else {
                const blocks = parseMultipleEntries(text);
                for (const block of blocks) {
                    const parsed = parseTextToFields(block);
                    if (Object.keys(parsed).length === 0) continue;
                    const mapped = mapFieldsToContent(parsed, category);
                    const nodeName = mapped.name || Object.values(parsed)[0]?.substring(0, 20) || '导入条目';
                    importedItems.push({ name: nodeName, category, content: mapped.content });
                }
            }

            if (importedItems.length === 0) { alert('未能从文件中解析出任何条目'); return; }

            let updatedNodes = [...nodes];
            let count = 0;
            for (const item of importedItems) {
                const nodeId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6) + count;
                updatedNodes.push({
                    id: nodeId, name: item.name, type: 'item',
                    category, parentId, order: count,
                    content: item.content,
                    collapsed: false, enabled: true,
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                });
                count++;
            }
            await saveSettingsNodes(updatedNodes, workId);
            setNodes(updatedNodes);
            alert(`成功导入 ${count} 个${meta.label}条目`);
        } catch (err) {
            alert('导入失败: ' + err.message);
        }
    };

    // 清空当前分类的所有条目
    const handleClearCategory = async () => {
        const catItems = nodes.filter(n => n.category === category && n.type === 'item');
        if (catItems.length === 0) return;
        const workId = getActiveWorkId();
        const updatedNodes = nodes.filter(n => !(n.category === category && n.type === 'item'));
        await saveSettingsNodes(updatedNodes, workId);
        setNodes(updatedNodes);
        setSelectedNodeId(null);
        setShowClearConfirm(false);
    };

    // 加载节点
    const loadNodes = useCallback(async () => {
        const workId = getActiveWorkId();
        if (!workId) return;
        const allNodes = await getSettingsNodes(workId);
        setNodes(allNodes);
    }, []);

    useEffect(() => {
        if (category) {
            loadNodes().then(() => {
                if (jumpToNodeId) {
                    setSelectedNodeId(jumpToNodeId);
                    setJumpToNodeId(null);
                }
            });
            setSearchQuery('');
            setSelectedNodeId(null);
        }
    }, [category, loadNodes, jumpToNodeId, setJumpToNodeId]);

    const rootFolder = useMemo(() => {
        const workId = getActiveWorkId();
        return nodes.find(n => n.parentId === workId && n.category === category) || null;
    }, [nodes, category]);

    // 使用 rootFolder 的自定义图标（如果有的话）
    const CatIcon = (rootFolder?.icon && getIconComponent(rootFolder.icon)) || meta.icon;

    const categoryNodes = useMemo(() => {
        if (!rootFolder) return [];
        const collect = (parentId) => {
            const children = nodes.filter(n => n.parentId === parentId);
            let result = [];
            for (const child of children) {
                result.push(child);
                if (child.type === 'folder') result = result.concat(collect(child.id));
            }
            return result;
        };
        return collect(rootFolder.id);
    }, [nodes, rootFolder]);

    const itemCount = categoryNodes.filter(n => n.type === 'item').length;
    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    // 解析正确的父级 folder：如果 selectedId 是 item，向上找到其所属 folder
    const resolveParentFolder = (explicitParentId) => {
        if (explicitParentId) {
            const node = nodes.find(n => n.id === explicitParentId);
            if (!node) return rootFolder?.id;
            // 如果是 folder，直接作为 parent
            if (node.type === 'folder') return node.id;
            // 如果是 item，使用其 parentId
            return node.parentId || rootFolder?.id;
        }
        return rootFolder?.id;
    };

    // 新建分类（folder）
    const handleAddFolder = async (parentId) => {
        const targetParent = resolveParentFolder(parentId);
        if (!targetParent) return;
        const newNode = await addSettingsNode({
            name: '新分类', type: 'folder', category, parentId: targetParent, icon: 'FolderOpen',
        });
        // 直接追加到现有状态，不重新加载
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    };

    // 新建条目（item）
    const handleAddItem = async (parentId) => {
        const targetParent = resolveParentFolder(parentId);
        if (!targetParent) return;
        const newNode = await addSettingsNode({
            name: '新条目', type: 'item', category, parentId: targetParent, enabled: true,
        });
        // 直接追加到现有状态，不重新加载
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    };

    const handleDeleteNode = async (id) => {
        const node = nodes.find(n => n.id === id);
        if (!node) return;
        setDeleteConfirm({
            message: `确定要删除「${node.name}」吗？${node.type === 'folder' ? '分类内的所有条目也会被删除。' : ''}`,
            onConfirm: async () => {
                setDeleteConfirm(null);
                await deleteSettingsNode(id);
                const updated = await getSettingsNodes();
                setNodes(updated);
                if (selectedNodeId === id) setSelectedNodeId(null);
            },
            onCancel: () => setDeleteConfirm(null),
        });
    };

    const handleRenameNode = async (id, newName) => {
        await updateSettingsNode(id, { name: newName });
        setNodes(prev => prev.map(n => n.id === id ? { ...n, name: newName } : n));
    };

    const handleChangeIcon = async (id, iconName) => {
        await updateSettingsNode(id, { icon: iconName });
        setNodes(prev => prev.map(n => n.id === id ? { ...n, icon: iconName } : n));
    };

    const handleUpdateNode = (id, updates) => {
        const updatedNodes = nodes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n);
        setNodes(updatedNodes);
        updateSettingsNode(id, updates, updatedNodes);
    };

    const onClose = () => {
        setOpenCategoryModal(null);
        incrementSettingsVersion();
    };

    if (!category) return null;

    return createPortal(
        <div style={S.overlay} onMouseDown={e => { e.currentTarget._md = e.target; }} onClick={e => { if (e.currentTarget._md === e.currentTarget) onClose(); }}>
            <div style={isFullscreen ? S.containerFull : S.container} onClick={e => e.stopPropagation()}>
                {/* ===== 头部 ===== */}
                <div style={{ ...S.header, background: `linear-gradient(135deg, ${meta.bg} 0%, var(--bg-card, #fff) 100%)` }}>
                    <div style={S.headerLeft}>
                        <span style={{ ...S.headerIcon, color: meta.color, background: meta.bg, boxShadow: `0 4px 12px ${meta.color}20` }}>
                            <CatIcon size={18} />
                        </span>
                        <h2 style={S.headerTitle}>{meta.label}</h2>
                        <span style={{ ...S.headerCount, color: meta.color, background: `${meta.color}14` }}>{itemCount} 个条目</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button style={S.headerBtn} onClick={() => setIsFullscreen(!isFullscreen)}
                            title={isFullscreen ? '缩小' : '最大化'}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>
                        <button style={S.headerBtn} onClick={onClose}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* ===== 作品切换器 ===== */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 22px',
                    borderBottom: '1px solid var(--border-light, #e5e7eb)',
                    background: 'var(--bg-secondary, #f9fafb)',
                    flexShrink: 0,
                }}>
                    <BookOpen size={14} style={{ color: meta.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)', whiteSpace: 'nowrap', flexShrink: 0 }}>作品</span>
                    <select
                        value={activeWorkId || ''}
                        onChange={e => handleSwitchWork(e.target.value)}
                        style={{
                            padding: '6px 36px 6px 12px',
                            border: `1.5px solid ${meta.color}`,
                            borderRadius: 10,
                            background: 'var(--bg-card, #fff)',
                            color: 'var(--text-primary, #1f2937)',
                            fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', outline: 'none',
                            appearance: 'none', WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(meta.color)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 10l5 5 5-5'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 10px center',
                            boxShadow: `0 1px 4px ${meta.color}12`,
                            transition: 'all 0.15s',
                        }}
                        onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 3px ${meta.color}20`; }}
                        onBlur={e => { e.currentTarget.style.boxShadow = `0 1px 4px ${meta.color}12`; }}
                    >
                        {works.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    {showNewWorkInput ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input style={{ padding: '5px 10px', border: `1.5px solid ${meta.color}`, borderRadius: 10, fontSize: 12, background: 'var(--bg-card, #fff)', color: 'var(--text-primary)', outline: 'none', width: 110 }}
                                value={newWorkName} onChange={e => setNewWorkName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreateWork(); if (e.key === 'Escape') setShowNewWorkInput(false); }}
                                placeholder="作品名称" autoFocus />
                            <button style={{ padding: '4px 10px', border: 'none', borderRadius: 8, background: meta.color, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                                onClick={handleCreateWork}>确定</button>
                            <button style={{ padding: '4px 8px', border: 'none', borderRadius: 8, background: 'var(--bg-hover, #f3f4f6)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
                                onClick={() => setShowNewWorkInput(false)}>取消</button>
                        </div>
                    ) : (
                        <button style={{ padding: '4px 10px', border: '1px dashed var(--border-light, #d1d5db)', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted, #9ca3af)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                            onClick={() => { setNewWorkName(''); setShowNewWorkInput(true); }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.color = meta.color; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light, #d1d5db)'; e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'; }}
                        >+ 新作品</button>
                    )}
                    {/* 右侧操作按钮 */}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center', position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)', padding: '4px 6px', borderRadius: 6, transition: 'all 0.15s' }}
                                onClick={() => setShowExportMenu(!showExportMenu)} title={'导出' + meta.label}
                                onMouseEnter={e => { e.currentTarget.style.color = meta.color; e.currentTarget.style.background = `${meta.color}10`; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'; e.currentTarget.style.background = 'none'; }}
                            ><Upload size={13} /></button>
                            {showExportMenu && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-light)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20, overflow: 'hidden', minWidth: 120 }}>
                                    {[{ key: 'json', label: 'JSON (完整)' }, { key: 'txt', label: 'TXT (纯文本)' }, { key: 'md', label: 'Markdown' }, { key: 'docx', label: 'Word (.docx)' }, { key: 'pdf', label: 'PDF (打印)' }].map(f => (
                                        <button key={f.key} style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', textAlign: 'left', transition: 'background 0.1s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary, #f9fafb)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            onClick={() => handleExportCategory(f.key)}
                                        ><FileText size={12} style={{ marginRight: 6 }} />{f.label}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)', padding: '4px 6px', borderRadius: 6, transition: 'all 0.15s' }}
                            onClick={() => importInputRef.current?.click()} title={'导入' + meta.label}
                            onMouseEnter={e => { e.currentTarget.style.color = meta.color; e.currentTarget.style.background = `${meta.color}10`; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'; e.currentTarget.style.background = 'none'; }}
                        ><Download size={13} /></button>
                        <input ref={importInputRef} type="file" accept=".json,.txt,.md,.markdown,.docx,.pdf" onChange={handleImportCategory} style={{ display: 'none' }} />
                        <div style={{ width: 1, height: 14, background: 'var(--border-light, #e5e7eb)', margin: '0 2px' }} />
                        {showClearConfirm ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11 }}>
                                <span style={{ color: '#ef4444', whiteSpace: 'nowrap' }}>确认清空?</span>
                                <button style={{ padding: '2px 8px', border: 'none', borderRadius: 6, background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                                    onClick={handleClearCategory}>确定</button>
                                <button style={{ padding: '2px 8px', border: 'none', borderRadius: 6, background: 'var(--bg-hover, #f3f4f6)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}
                                    onClick={() => setShowClearConfirm(false)}>取消</button>
                            </div>
                        ) : (
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)', padding: '4px 6px', borderRadius: 6, transition: 'all 0.15s' }}
                                onClick={() => setShowClearConfirm(true)} title={'清空' + meta.label}
                                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'; e.currentTarget.style.background = 'none'; }}
                            ><Trash2 size={13} /></button>
                        )}
                    </div>
                </div>

                {/* ===== 内容区 ===== */}
                <div style={S.body}>
                    {/* 左侧 */}
                    <div style={S.sidebar}>
                        <div style={S.searchWrap}>
                            <div style={{
                                ...S.searchBox,
                                borderColor: searchFocused ? meta.color : 'var(--border-light, #e5e7eb)',
                                boxShadow: searchFocused ? `0 0 0 3px ${meta.color}18` : 'none',
                            }}>
                                <Search size={14} style={{ color: searchFocused ? meta.color : 'var(--text-muted)', flexShrink: 0 }} />
                                <input ref={searchInputRef} style={S.searchInput}
                                    placeholder="搜索条目…" value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setSearchFocused(false)}
                                />
                            </div>
                        </div>

                        <ItemList
                            nodes={nodes} rootFolder={rootFolder} category={category}
                            selectedId={selectedNodeId} onSelect={setSelectedNodeId}
                            onAddFolder={handleAddFolder} onAddItem={handleAddItem}
                            onRename={handleRenameNode} onChangeIcon={handleChangeIcon}
                            searchQuery={searchQuery}
                        />

                        {/* 底部工具栏 */}
                        <div style={S.footer}>
                            <button style={S.footerBtn}
                                onClick={() => setShowAddMenu(!showAddMenu)}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.color = meta.color; e.currentTarget.style.background = meta.bg; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-card, #fff)'; }}
                            >
                                <Plus size={14} /> 新建
                                <ChevronDown size={11} style={{ marginLeft: 2 }} />
                            </button>
                            {selectedNodeId && (
                                <button style={{ ...S.footerBtn, marginLeft: 'auto' }}
                                    onClick={() => handleDeleteNode(selectedNodeId)} title="删除选中"
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-card, #fff)'; }}
                                >
                                    <Trash2 size={13} /> 删除
                                </button>
                            )}
                            {showAddMenu && (
                                <AddMenu
                                    onAddFolder={() => handleAddFolder(selectedNodeId)}
                                    onAddItem={() => handleAddItem(selectedNodeId)}
                                    onClose={() => setShowAddMenu(false)}
                                    catColor={meta.color}
                                    catBg={meta.bg}
                                />
                            )}
                        </div>
                    </div>

                    {/* 右侧编辑器 */}
                    <div style={S.editor}>
                        <SettingsItemEditor
                            selectedNode={selectedNode}
                            allNodes={nodes}
                            onUpdate={handleUpdateNode}
                            onSelect={setSelectedNodeId}
                            onAdd={(parentId, cat) => handleAddItem(parentId)}
                        />
                    </div>
                </div>
            </div>

            {deleteConfirm && (
                <DeleteConfirmDialog
                    message={deleteConfirm.message}
                    onConfirm={deleteConfirm.onConfirm}
                    onCancel={deleteConfirm.onCancel}
                />
            )}
        </div>,
        document.body
    );
}
