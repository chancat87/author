'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { InputRule } from '@tiptap/core';
import katex from 'katex';

// ==================== 公式编辑弹窗（居中大框） ====================
export function openMathEditor(currentLatex, onSave) {
    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.className = 'math-editor-overlay';

    // 创建弹窗
    const dialog = document.createElement('div');
    dialog.className = 'math-editor-dialog';
    dialog.innerHTML = `
        <div class="math-editor-header">
            <span class="math-editor-title">∑ 编辑公式</span>
            <button class="math-editor-close">×</button>
        </div>
        <div class="math-editor-preview"></div>
        <textarea class="math-editor-input" placeholder="输入 LaTeX 公式，如 E = mc^2" spellcheck="false"></textarea>
        <div class="math-editor-footer">
            <span class="math-editor-hint">实时预览 · Enter 换行 · Ctrl+Enter 确认</span>
            <div class="math-editor-actions">
                <button class="math-editor-cancel">取消</button>
                <button class="math-editor-save">确认</button>
            </div>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const textarea = dialog.querySelector('.math-editor-input');
    const preview = dialog.querySelector('.math-editor-preview');
    const closeBtn = dialog.querySelector('.math-editor-close');
    const cancelBtn = dialog.querySelector('.math-editor-cancel');
    const saveBtn = dialog.querySelector('.math-editor-save');

    textarea.value = currentLatex || '';

    // 实时预览
    const updatePreview = () => {
        const val = textarea.value.trim();
        if (!val) {
            preview.innerHTML = '<span class="math-editor-placeholder">此处显示公式预览…</span>';
            return;
        }
        try {
            preview.innerHTML = katex.renderToString(val, {
                throwOnError: false,
                displayMode: true,
            });
        } catch (e) {
            preview.innerHTML = `<span class="math-editor-error">${e.message}</span>`;
        }
    };
    updatePreview();
    textarea.addEventListener('input', updatePreview);

    // 关闭
    const close = () => {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 150);
    };

    // 保存
    const save = () => {
        const val = textarea.value.trim();
        if (val) onSave(val);
        close();
    };

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    saveBtn.addEventListener('click', save);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // 键盘
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { close(); e.preventDefault(); }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { save(); e.preventDefault(); }
    });

    // 聚焦
    requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
}

// ==================== 行内公式节点 $...$ ====================
export const MathInline = Node.create({
    name: 'mathInline',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            latex: { default: '' },
        };
    },

    parseHTML() {
        return [{
            tag: 'span[data-math-inline]',
            getAttrs: (el) => ({ latex: el.getAttribute('data-latex') || '' }),
        }];
    },

    renderHTML({ node }) {
        return ['span', {
            'data-math-inline': '',
            'data-latex': node.attrs.latex,
            class: 'math-inline',
            contenteditable: 'false',
        }];
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('span');
            dom.classList.add('math-inline');
            dom.contentEditable = 'false';

            const render = (latex) => {
                try {
                    dom.innerHTML = katex.renderToString(latex, {
                        throwOnError: false,
                        displayMode: false,
                    });
                } catch {
                    dom.textContent = latex;
                }
            };
            render(node.attrs.latex);

            // 双击打开编辑弹窗
            dom.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openMathEditor(node.attrs.latex, (newLatex) => {
                    const pos = getPos();
                    if (typeof pos === 'number') {
                        editor.chain().focus()
                            .command(({ tr }) => {
                                tr.setNodeMarkup(pos, undefined, { latex: newLatex });
                                return true;
                            })
                            .run();
                    }
                });
            });

            return {
                dom,
                update(updatedNode) {
                    if (updatedNode.type.name !== 'mathInline') return false;
                    render(updatedNode.attrs.latex);
                    return true;
                },
            };
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /(?<!\$)\$([^$\n]+)\$$/,
                handler: ({ state, range, match }) => {
                    const latex = match[1];
                    if (!latex.trim()) return null;
                    const { tr } = state;
                    tr.replaceWith(
                        range.from,
                        range.to,
                        this.type.create({ latex })
                    );
                },
            }),
        ];
    },
});


// ==================== 块级公式节点 $$...$$ ====================
export const MathBlock = Node.create({
    name: 'mathBlock',
    group: 'block',
    atom: true,
    defining: true,

    addAttributes() {
        return {
            latex: { default: '' },
        };
    },

    parseHTML() {
        return [{
            tag: 'div[data-math-block]',
            getAttrs: (el) => ({ latex: el.getAttribute('data-latex') || '' }),
        }];
    },

    renderHTML({ node }) {
        return ['div', {
            'data-math-block': '',
            'data-latex': node.attrs.latex,
            class: 'math-block',
            contenteditable: 'false',
        }];
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('div');
            dom.classList.add('math-block');
            dom.contentEditable = 'false';

            const render = (latex) => {
                try {
                    dom.innerHTML = katex.renderToString(latex, {
                        throwOnError: false,
                        displayMode: true,
                    });
                } catch {
                    dom.textContent = latex;
                }
            };
            render(node.attrs.latex);

            // 双击打开编辑弹窗
            dom.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openMathEditor(node.attrs.latex, (newLatex) => {
                    const pos = getPos();
                    if (typeof pos === 'number') {
                        editor.chain().focus()
                            .command(({ tr }) => {
                                tr.setNodeMarkup(pos, undefined, { latex: newLatex });
                                return true;
                            })
                            .run();
                    }
                });
            });

            return {
                dom,
                update(updatedNode) {
                    if (updatedNode.type.name !== 'mathBlock') return false;
                    render(updatedNode.attrs.latex);
                    return true;
                },
            };
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\$\$([^$]+)\$\$$/,
                handler: ({ state, range, match }) => {
                    const latex = match[1];
                    if (!latex.trim()) return null;
                    const { tr } = state;
                    tr.replaceWith(
                        range.from,
                        range.to,
                        this.type.create({ latex })
                    );
                },
            }),
        ];
    },
});
