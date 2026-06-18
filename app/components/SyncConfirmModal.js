'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../lib/useI18n';

/**
 * 同步二次确认防误触弹窗
 * @param {boolean} isOpen 是否打开
 * @param {Function} onClose 关闭回调
 * @param {Function} onConfirm 确认回调
 */
export default function SyncConfirmModal({ isOpen, onClose, onConfirm }) {
    const { text } = useI18n();
    const [mounted, setMounted] = useState(false);
    const [skipToday, setSkipToday] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 每次打开时，检查是否已经设置了今日免扰
    useEffect(() => {
        if (isOpen) {
            try {
                const skipStr = localStorage.getItem('author-pull-skip-today');
                if (skipStr) {
                    const skipDate = new Date(parseInt(skipStr, 10));
                    const today = new Date();
                    if (
                        skipDate.getFullYear() === today.getFullYear() &&
                        skipDate.getMonth() === today.getMonth() &&
                        skipDate.getDate() === today.getDate()
                    ) {
                        // 今日已设免扰，直接确认并关闭
                        onConfirm();
                        onClose();
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }
    }, [isOpen, onConfirm, onClose]);

    const handleConfirm = useCallback(() => {
        if (skipToday) {
            localStorage.setItem('author-pull-skip-today', Date.now().toString());
        }
        onConfirm();
        onClose();
    }, [skipToday, onConfirm, onClose]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal" style={{ maxWidth: 420, padding: 0, overflow: 'hidden' }}>
                {/* Header background with warning gradient */}
                <div style={{ 
                    padding: '32px 24px 24px', 
                    background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.1), transparent)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-light)'
                }}>
                    <div style={{ 
                        width: 56, 
                        height: 56, 
                        borderRadius: '50%', 
                        background: 'rgba(239, 68, 68, 0.15)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginBottom: 16,
                        color: '#ef4444'
                    }}>
                        <AlertTriangle size={32} />
                    </div>
                    
                    <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                        {text('高危操作确认', 'High-Risk Operation', 'Опасная операция')}
                    </h2>
                </div>
                
                <div style={{ padding: '24px' }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '4px solid #ef4444',
                        marginBottom: 20
                    }}>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                            {text('您即将执行', 'You are about to run', 'Вы собираетесь выполнить')} <strong>{text('“从云端同步”', '"Sync from Cloud"', '"Синхронизация из облака"')}</strong> {text('操作。', 'operation.', 'операцию.')}<br/>
                            {text('这将使用云端存储的稿件数据', 'This will use manuscript data stored in the cloud to', 'Данные рукописи из облака будут использованы, чтобы')}<strong>{text('永久覆盖并替换', 'permanently overwrite and replace', 'навсегда перезаписать и заменить')}</strong>{text('当前设备所有的本地内容！', 'all local content on this device.', 'всё локальное содержимое на этом устройстве.')}
                        </p>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                        {text('如果当前设备中存在未同步到云端的新撰写内容，此操作将导致它们', 'If this device has newly written content that has not been synced to the cloud, this action will cause it to be', 'Если на этом устройстве есть новый текст, ещё не синхронизированный с облаком, это действие приведёт к его ')}<strong style={{ color: '#ef4444' }}>{text('永远丢失且无法恢复', 'lost permanently and unrecoverably', 'безвозвратной потере')}</strong>{text('。在继续前，请您务必确认是否需要拉取云端数据。', '. Please confirm that you really need to pull cloud data before continuing.', '. Перед продолжением убедитесь, что вам действительно нужно загрузить данные из облака.')}
                    </p>

                    <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: 8, 
                        fontSize: 13, 
                        cursor: 'pointer', 
                        userSelect: 'none',
                        color: 'var(--text-secondary)',
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background 0.2s',
                        marginBottom: 24
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <input 
                            type="checkbox" 
                            checked={skipToday} 
                            onChange={(e) => setSkipToday(e.target.checked)} 
                            style={{ 
                                cursor: 'pointer',
                                width: 16,
                                height: 16,
                                accentColor: '#ef4444'
                            }}
                        />
                        {text('今日内不再弹出此警告', 'Do not show this warning again today', 'Не показывать это предупреждение сегодня')}
                    </label>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button 
                            className="btn btn-secondary" 
                            onClick={onClose}
                            style={{ flex: 1, height: 44, justifyContent: 'center', fontWeight: 500 }}
                        >
                            {text('取消', 'Cancel', 'Отмена')}
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleConfirm}
                            style={{ 
                                flex: 1, 
                                height: 44, 
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                borderColor: '#dc2626',
                                fontWeight: 500,
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                            }}
                        >
                            {text('确认覆盖本地', 'Overwrite Local Data', 'Перезаписать локальные данные')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
