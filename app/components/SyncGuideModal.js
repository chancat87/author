'use client';

import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../lib/useI18n';
import { Download, ExternalLink, Settings, Monitor, X } from 'lucide-react';

export default function SyncGuideModal() {
    const { showSyncGuideModal, setShowSyncGuideModal } = useAppStore();
    const { t } = useI18n();

    if (!showSyncGuideModal) return null;

    return (
        <div className="modal-overlay" onMouseDown={() => setShowSyncGuideModal(false)}>
            <div className="modal-content" style={{ maxWidth: 500 }} onMouseDown={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('cloudSync.guideTitle') || '开启云同步'}</h2>
                    <button className="icon-btn" onClick={() => setShowSyncGuideModal(false)}><X size={20} /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        {t('cloudSync.guideDesc') || '云同步可以在多设备间同步你的作品和设定。'}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* 方式一：下载客户端 */}
                        <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Monitor size={18} style={{ color: 'var(--accent)' }}/>
                                <h3 style={{ margin: 0, fontSize: '15px' }}>方式一：{t('cloudSync.downloadClient') || '下载桌面客户端（推荐）'}</h3>
                            </div>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                                {t('cloudSync.downloadClientDesc') || '内置云同步，无需额外配置。'}
                            </p>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <a 
                                    href="https://github.com/YuanShiJiLoong/author/releases/latest/download/Author-Setup.exe" 
                                    className="btn primary" 
                                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                                    onClick={() => setShowSyncGuideModal(false)}
                                >
                                    <Download size={14} />{t('cloudSync.quickDownload') || '快速下载 (Windows)'}
                                </a>
                                <a 
                                    href="https://github.com/YuanShiJiLoong/author/releases/latest" 
                                    target="_blank" rel="noreferrer"
                                    className="btn secondary" 
                                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                                    onClick={() => setShowSyncGuideModal(false)}
                                >
                                    <ExternalLink size={14} />{t('cloudSync.goToRelease') || '前往 Release 页面'}
                                </a>
                            </div>
                        </div>

                        {/* 方式二：自行配置 */}
                        <div style={{ padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Settings size={18} style={{ color: 'var(--text-secondary)' }}/>
                                <h3 style={{ margin: 0, fontSize: '15px' }}>方式二：{t('cloudSync.configFirebase') || '自行配置 Firebase'}</h3>
                            </div>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                                {t('cloudSync.configFirebaseDesc') || '适合源码部署 / Vercel 部署用户。'}
                            </p>
                            <a 
                                href="https://github.com/YuanShiJiLoong/author#%E4%BA%91%E5%90%8C%E6%AD%A5%E9%85%8D%E7%BD%AE%E8%87%AA%E9%83%A8%E7%BD%B2%E7%94%A8%E6%88%B7" 
                                target="_blank" rel="noreferrer"
                                className="btn outline" 
                                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '13px' }}
                                onClick={() => setShowSyncGuideModal(false)}
                            >
                                <ExternalLink size={14} />{t('cloudSync.viewGuide') || '查看配置指南'}
                            </a>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', paddingTop: '8px' }}>
                        💬 {t('cloudSync.qqGroup') || '遇到问题？加入 QQ 群 1087016949'}
                    </div>
                </div>
            </div>
        </div>
    );
}
