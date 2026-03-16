'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * RadarStatsChart — 交互式雷达图（纯SVG）
 *
 * Props:
 *   stats      — [{ name: '智力', value: 50 }, ...]
 *   onChange   — (newStats) => void
 *   color      — 主题色
 *   size       — SVG 尺寸（默认 220）
 */

const DEFAULT_STATS = [
    { name: '智力', value: 50 },
    { name: '武力', value: 50 },
    { name: '魅力', value: 50 },
    { name: '防御', value: 50 },
    { name: '速度', value: 50 },
    { name: '运气', value: 50 },
];

export default function RadarStatsChart({ stats, onChange, color, size = 220 }) {
    const catColor = color || '#5b7bde';
    const rgb = `${parseInt(catColor.slice(1,3),16)},${parseInt(catColor.slice(3,5),16)},${parseInt(catColor.slice(5,7),16)}`;
    const svgRef = useRef(null);
    const [dragging, setDragging] = useState(null);
    const [editingIdx, setEditingIdx] = useState(null);
    const [renamingIdx, setRenamingIdx] = useState(null);

    // Use stats directly, or fall back to defaults
    const currentStats = (stats && stats.length >= 3) ? stats.map(s => ({
        name: s.name || '???',
        value: Math.max(0, Math.min(100, s.value || 0)),
    })) : DEFAULT_STATS;

    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) - 32;
    const n = currentStats.length;
    const angleStep = (Math.PI * 2) / n;
    const startAngle = -Math.PI / 2;

    const getPoint = useCallback((index, value) => {
        const angle = startAngle + index * angleStep;
        const r = (value / 100) * radius;
        return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
        };
    }, [cx, cy, radius, angleStep, startAngle]);

    const gridLevels = [20, 40, 60, 80, 100];

    const getPolygonPoints = useCallback((values) => {
        return values.map((v, i) => {
            const p = getPoint(i, v);
            return `${p.x},${p.y}`;
        }).join(' ');
    }, [getPoint]);

    // ===== Drag handling =====
    const handlePointerDown = useCallback((e, index) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(index);
    }, []);

    const handlePointerMove = useCallback((e) => {
        if (dragging === null) return;
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        const angle = startAngle + dragging * angleStep;
        const dx = mx - cx;
        const dy = my - cy;
        const projection = dx * Math.cos(angle) + dy * Math.sin(angle);
        const value = Math.round(Math.max(0, Math.min(100, (projection / radius) * 100)));
        const newStats = currentStats.map((s, i) => i === dragging ? { ...s, value } : s);
        onChange(newStats);
    }, [dragging, cx, cy, radius, angleStep, startAngle, currentStats, onChange]);

    const handlePointerUp = useCallback(() => { setDragging(null); }, []);

    useEffect(() => {
        if (dragging !== null) {
            window.addEventListener('mousemove', handlePointerMove);
            window.addEventListener('mouseup', handlePointerUp);
            window.addEventListener('touchmove', handlePointerMove);
            window.addEventListener('touchend', handlePointerUp);
            return () => {
                window.removeEventListener('mousemove', handlePointerMove);
                window.removeEventListener('mouseup', handlePointerUp);
                window.removeEventListener('touchmove', handlePointerMove);
                window.removeEventListener('touchend', handlePointerUp);
            };
        }
    }, [dragging, handlePointerMove, handlePointerUp]);

    // ===== Value change =====
    const handleInputChange = (index, rawValue) => {
        const value = Math.max(0, Math.min(100, parseInt(rawValue) || 0));
        const newStats = currentStats.map((s, i) => i === index ? { ...s, value } : s);
        onChange(newStats);
    };

    // ===== Rename dimension =====
    const handleRename = (index, newName) => {
        if (!newName.trim()) return;
        const newStats = currentStats.map((s, i) => i === index ? { ...s, name: newName.trim() } : s);
        onChange(newStats);
    };

    // ===== Add dimension =====
    const handleAdd = () => {
        const newStats = [...currentStats, { name: `维度${currentStats.length + 1}`, value: 50 }];
        onChange(newStats);
    };

    // ===== Delete dimension (min 3) =====
    const handleDelete = (index) => {
        if (currentStats.length <= 3) return;
        const newStats = currentStats.filter((_, i) => i !== index);
        onChange(newStats);
    };

    const getLabelPos = (index) => {
        const angle = startAngle + index * angleStep;
        const r = radius + 18;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            {/* SVG Radar */}
            <svg
                ref={svgRef}
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{ cursor: dragging !== null ? 'grabbing' : 'default', userSelect: 'none' }}
            >
                {/* Grid */}
                {gridLevels.map(level => (
                    <polygon
                        key={level}
                        points={getPolygonPoints(Array(n).fill(level))}
                        fill="none"
                        stroke="var(--border-light, #d0d5dd)"
                        strokeWidth={level === 100 ? 1 : 0.5}
                        opacity={level === 100 ? 0.8 : 0.5}
                    />
                ))}

                {/* Axis lines */}
                {currentStats.map((_, i) => {
                    const p = getPoint(i, 100);
                    return (
                        <line
                            key={`axis-${i}`}
                            x1={cx} y1={cy} x2={p.x} y2={p.y}
                            stroke="var(--border-light, #d0d5dd)"
                            strokeWidth={0.5} opacity={0.5}
                        />
                    );
                })}

                {/* Data polygon */}
                <polygon
                    points={getPolygonPoints(currentStats.map(s => s.value))}
                    fill={catColor} fillOpacity={0.35}
                    stroke={catColor} strokeWidth={2} strokeLinejoin="round"
                />

                {/* Data points */}
                {currentStats.map((stat, i) => {
                    const p = getPoint(i, stat.value);
                    return (
                        <g key={`point-${i}`}>
                            <circle cx={p.x} cy={p.y} r={12} fill="transparent"
                                style={{ cursor: 'grab' }}
                                onMouseDown={(e) => handlePointerDown(e, i)}
                                onTouchStart={(e) => handlePointerDown(e, i)}
                            />
                            <circle cx={p.x} cy={p.y} r={6}
                                fill={`rgba(${rgb},0.18)`}
                                style={{ filter: dragging === i ? `drop-shadow(0 0 8px ${catColor})` : 'none' }}
                            />
                            <circle cx={p.x} cy={p.y} r={3.5}
                                fill={catColor} stroke="var(--bg-card, #fff)" strokeWidth={1.5}
                                style={{ cursor: 'grab' }}
                                onMouseDown={(e) => handlePointerDown(e, i)}
                                onTouchStart={(e) => handlePointerDown(e, i)}
                            />
                            {stat.value > 0 && (
                                <text x={p.x} y={p.y - 10} textAnchor="middle"
                                    fill={catColor} fontSize={9} fontWeight={700}
                                    fontFamily="var(--font-ui)" opacity={0.85}
                                >{stat.value}</text>
                            )}
                        </g>
                    );
                })}

                {/* Labels */}
                {currentStats.map((stat, i) => {
                    const pos = getLabelPos(i);
                    return (
                        <text
                            key={`label-${i}`} x={pos.x} y={pos.y}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="var(--text-muted)" fontSize={10} fontWeight={600}
                            fontFamily="var(--font-ui)" letterSpacing="0.04em"
                        >{stat.name}</text>
                    );
                })}
            </svg>

            {/* Input rows: name + value + delete */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                width: '100%', maxWidth: size + 40,
            }}>
                {currentStats.map((stat, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 4px', borderRadius: 6,
                        background: editingIdx === i || renamingIdx === i ? `rgba(${rgb},0.05)` : 'transparent',
                        transition: 'background 0.15s',
                    }}>
                        {/* Editable name */}
                        <input
                            type="text"
                            value={stat.name}
                            onChange={(e) => handleRename(i, e.target.value)}
                            onFocus={() => setRenamingIdx(i)}
                            onBlur={() => setRenamingIdx(null)}
                            style={{
                                flex: 1, minWidth: 0,
                                padding: '2px 4px',
                                border: 'none', borderBottom: renamingIdx === i ? `1px solid ${catColor}` : '1px solid transparent',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                fontSize: 11, fontWeight: 600,
                                outline: 'none',
                                transition: 'border-color 0.15s',
                            }}
                        />
                        {/* Value input */}
                        <input
                            type="number" min={0} max={100}
                            value={stat.value}
                            onChange={(e) => handleInputChange(i, e.target.value)}
                            onFocus={() => setEditingIdx(i)}
                            onBlur={() => setEditingIdx(null)}
                            style={{
                                width: 44, padding: '2px 4px',
                                border: '1px solid var(--border-light)',
                                borderRadius: 6, background: 'transparent',
                                color: 'var(--text-primary)',
                                fontSize: 12, fontWeight: 600,
                                fontFamily: 'var(--font-mono, monospace)',
                                textAlign: 'center', outline: 'none',
                                transition: 'border-color 0.15s',
                            }}
                            onFocusCapture={(e) => e.target.style.borderColor = catColor}
                            onBlurCapture={(e) => e.target.style.borderColor = 'var(--border-light)'}
                        />
                        {/* Delete button */}
                        <button
                            onClick={() => handleDelete(i)}
                            disabled={currentStats.length <= 3}
                            style={{
                                border: 'none', background: 'transparent',
                                color: currentStats.length <= 3 ? 'var(--border-light)' : 'var(--text-muted)',
                                cursor: currentStats.length <= 3 ? 'not-allowed' : 'pointer',
                                padding: 2, borderRadius: 4, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { if (currentStats.length > 3) e.target.style.color = '#e55'; }}
                            onMouseLeave={(e) => { e.target.style.color = currentStats.length <= 3 ? 'var(--border-light)' : 'var(--text-muted)'; }}
                            title={currentStats.length <= 3 ? '至少保留3个维度' : '删除维度'}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}

                {/* Add dimension button */}
                <button
                    onClick={handleAdd}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '4px 8px', marginTop: 2,
                        border: '1px dashed var(--border-light)',
                        borderRadius: 6, background: 'transparent',
                        color: 'var(--text-muted)', fontSize: 11, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = catColor; e.currentTarget.style.color = catColor; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <Plus size={12} /> 添加维度
                </button>
            </div>
        </div>
    );
}
