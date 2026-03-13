'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip 组件 — 悬停延迟显示的浮动提示框
 * 使用 React Portal 渲染到 document.body，确保不受父级 overflow/flex 影响
 * 使用 display:contents 包裹，不影响子元素的 position/layout
 * 
 * @param {Object} props
 * @param {string} props.content - 提示文本
 * @param {string} [props.shortcut] - 快捷键提示（如 "Ctrl+J"）
 * @param {'top'|'bottom'|'left'|'right'} [props.side='top'] - 弹出方向
 * @param {number} [props.delay=400] - 悬停延迟（ms）
 * @param {React.ReactNode} props.children - 触发元素
 */
export default function Tooltip({ content, shortcut, side = 'top', delay = 400, children }) {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const timerRef = useRef(null);
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // 获取触发元素的 rect（优先用第一个子元素，因为 display:contents 没有自己的盒模型）
    const getTriggerRect = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return null;
        // display:contents 元素没有盒模型，取第一个子元素的 rect
        const child = el.firstElementChild;
        if (child) return child.getBoundingClientRect();
        return el.getBoundingClientRect();
    }, []);

    const show = useCallback(() => {
        timerRef.current = setTimeout(() => {
            const rect = getTriggerRect();
            if (!rect) return;

            let x, y;
            switch (side) {
                case 'bottom':
                    x = rect.left + rect.width / 2;
                    y = rect.bottom + 6;
                    break;
                case 'left':
                    x = rect.left - 6;
                    y = rect.top + rect.height / 2;
                    break;
                case 'right':
                    x = rect.right + 6;
                    y = rect.top + rect.height / 2;
                    break;
                default: // top
                    x = rect.left + rect.width / 2;
                    y = rect.top - 6;
            }
            setPos({ x, y });
            setVisible(true);
        }, delay);
    }, [side, delay, getTriggerRect]);

    const hide = useCallback(() => {
        clearTimeout(timerRef.current);
        setVisible(false);
    }, []);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    // 精确定位（考虑 tooltip 自身尺寸）
    useEffect(() => {
        if (!visible || !tooltipRef.current) return;
        const tip = tooltipRef.current;
        const tipRect = tip.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let { x, y } = pos;

        switch (side) {
            case 'bottom':
                x -= tipRect.width / 2;
                break;
            case 'left':
                x -= tipRect.width;
                y -= tipRect.height / 2;
                break;
            case 'right':
                y -= tipRect.height / 2;
                break;
            default: // top
                x -= tipRect.width / 2;
                y -= tipRect.height;
        }

        // 边界修正
        if (x < 4) x = 4;
        if (x + tipRect.width > vw - 4) x = vw - tipRect.width - 4;
        if (y < 4) y = 4;
        if (y + tipRect.height > vh - 4) y = vh - tipRect.height - 4;

        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
        tip.style.opacity = '1';
    }, [visible, pos, side]);

    if (!content) return children;

    const tooltipEl = visible ? (
        <div
            ref={tooltipRef}
            className="ui-tooltip"
            role="tooltip"
            style={{ opacity: 0 }}
        >
            <span className="ui-tooltip-text">{content}</span>
            {shortcut && <kbd className="ui-tooltip-kbd">{shortcut}</kbd>}
        </div>
    ) : null;

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                style={{ display: 'contents' }}
            >
                {children}
            </span>
            {mounted && tooltipEl && createPortal(tooltipEl, document.body)}
        </>
    );
}
