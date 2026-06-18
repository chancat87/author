'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useRef, useCallback, memo } from 'react';
import { useI18n } from '../lib/useI18n';

/**
 * MiniMarkdownEditor — 轻量 Tiptap Markdown 编辑器
 * 用于设定集描述字段，替代纯 <textarea>
 *
 * Props:
 *   value        — Markdown 字符串
 *   onChange     — (markdown: string) => void
 *   placeholder  — 占位文字
 *   rows         — 控制最小高度（1 row ≈ 28px）
 *   autoFocus    — 是否自动聚焦
 */
function MiniMarkdownEditor({ value, onChange, placeholder, rows = 3, autoFocus = false, flexGrow = false }) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const isInternalUpdate = useRef(false);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                // 禁用不需要的扩展保持轻量
                horizontalRule: false,
                dropcursor: false,
                gapcursor: false,
            }),
            Placeholder.configure({
                placeholder: placeholder || '',
            }),
            Markdown.configure({
                html: false,
                tightLists: true,
                bulletListMarker: '-',
                transformPastedText: true,
                transformCopiedText: false,
            }),
        ],
        content: value || '',
        autofocus: autoFocus,
        editorProps: {
            attributes: {
                class: 'mini-md-content',
                style: `min-height: ${rows * 28}px`,
            },
        },
        onUpdate: ({ editor }) => {
            isInternalUpdate.current = true;
            const md = editor.storage.markdown.getMarkdown();
            onChangeRef.current(md);
        },
    });

    // 同步外部 value 变化（切换节点时）
    useEffect(() => {
        if (!editor) return;
        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }
        const currentMd = editor.storage.markdown.getMarkdown();
        if ((value || '') !== currentMd) {
            editor.commands.setContent(value || '', false);
        }
    }, [value, editor]);

    // 清理
    useEffect(() => {
        return () => editor?.destroy();
    }, [editor]);

    if (!editor) return null;

    return (
        <div className={`mini-md-editor${flexGrow ? ' mini-md-editor--grow' : ''}`}>
            <MiniToolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}

/**
 * 工具栏 — 紧凑图标按钮
 */
const MiniToolbar = memo(function MiniToolbar({ editor }) {
    const { text } = useI18n();
    const btn = (label, title, action, isActiveCheck) => (
        <button
            key={title}
            type="button"
            className={`mini-md-tb-btn ${isActiveCheck?.() ? 'active' : ''}`}
            title={title}
            onMouseDown={(e) => {
                e.preventDefault(); // 阻止编辑器失焦
                action();
            }}
        >
            {label}
        </button>
    );

    return (
        <div className="mini-md-toolbar">
            {btn('B', text('加粗', 'Bold', 'Жирный'), () => editor.chain().focus().toggleBold().run(), () => editor.isActive('bold'))}
            {btn('I', text('斜体', 'Italic', 'Курсив'), () => editor.chain().focus().toggleItalic().run(), () => editor.isActive('italic'))}
            {btn('S', text('删除线', 'Strikethrough', 'Зачёркивание'), () => editor.chain().focus().toggleStrike().run(), () => editor.isActive('strike'))}
            <span className="mini-md-tb-sep" />
            {btn('H1', text('标题1', 'Heading 1', 'Заголовок 1'), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), () => editor.isActive('heading', { level: 1 }))}
            {btn('H2', text('标题2', 'Heading 2', 'Заголовок 2'), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), () => editor.isActive('heading', { level: 2 }))}
            {btn('H3', text('标题3', 'Heading 3', 'Заголовок 3'), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), () => editor.isActive('heading', { level: 3 }))}
            <span className="mini-md-tb-sep" />
            {btn('•', text('无序列表', 'Bulleted list', 'Маркированный список'), () => editor.chain().focus().toggleBulletList().run(), () => editor.isActive('bulletList'))}
            {btn('1.', text('有序列表', 'Numbered list', 'Нумерованный список'), () => editor.chain().focus().toggleOrderedList().run(), () => editor.isActive('orderedList'))}
            {btn('❝', text('引用', 'Quote', 'Цитата'), () => editor.chain().focus().toggleBlockquote().run(), () => editor.isActive('blockquote'))}
            {btn('⟨⟩', text('代码', 'Code', 'Код'), () => editor.chain().focus().toggleCode().run(), () => editor.isActive('code'))}
        </div>
    );
});

export default MiniMarkdownEditor;
