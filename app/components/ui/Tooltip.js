'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Tooltip 组件 — 悬停延迟显示的浮动提示框
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

    const show = useCallback(() => {
        timerRef.current = setTimeout(() => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const tipEl = tooltipRef.current;

            let x, y;
            // 先设 visible 后在 effect 里精确定位，此处给一个初始值
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
    }, [side, delay]);

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

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                style={{ display: 'inline-flex' }}
            >
                {children}
            </span>
            {visible && (
                <div
                    ref={tooltipRef}
                    className="ui-tooltip"
                    role="tooltip"
                    style={{ opacity: 0 }}
                >
                    <span className="ui-tooltip-text">{content}</span>
                    {shortcut && <kbd className="ui-tooltip-kbd">{shortcut}</kbd>}
                </div>
            )}
        </>
    );
}
