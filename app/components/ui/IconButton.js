'use client';

import Tooltip from './Tooltip';

/**
 * IconButton — 统一的图标按钮组件
 * 自带 Tooltip + aria-label，确保可访问性
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - lucide-react 图标元素
 * @param {string} props.label - 按钮说明文字（用于 tooltip 和 aria-label）
 * @param {string} [props.shortcut] - 快捷键提示
 * @param {Function} [props.onClick] - 点击回调
 * @param {string} [props.className] - 额外 CSS class
 * @param {string} [props.id] - 元素 ID
 * @param {'top'|'bottom'|'left'|'right'} [props.tooltipSide] - tooltip 方向
 * @param {Object} [props.style] - 内联样式
 * @param {React.Ref} [props.buttonRef] - ref 转发
 */
export default function IconButton({
    icon, label, shortcut, onClick, className = '', id,
    tooltipSide = 'top', style, buttonRef, ...rest
}) {
    return (
        <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
            <button
                ref={buttonRef}
                id={id}
                className={`icon-btn ${className}`}
                onClick={onClick}
                aria-label={label}
                style={style}
                {...rest}
            >
                {icon}
            </button>
        </Tooltip>
    );
}
