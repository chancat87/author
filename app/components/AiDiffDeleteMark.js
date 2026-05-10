'use client';

import { Mark } from '@tiptap/core';

/**
 * Marks original text that would be replaced by an inline AI suggestion.
 * The mark is intentionally transient and stripped before the user accepts.
 */
const AiDiffDeleteMark = Mark.create({
    name: 'aiDiffDelete',

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'ai-diff-delete',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span.ai-diff-delete',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', { ...this.options.HTMLAttributes, ...HTMLAttributes }, 0];
    },
});

export default AiDiffDeleteMark;
