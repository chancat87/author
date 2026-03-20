/**
 * 自定义输入弹窗 — 替代 window.prompt()
 * Electron 不支持 window.prompt()，所以使用 DOM 弹窗实现。
 * 用法：const value = await promptInput('请输入名称：', '默认值');
 *       if (value === null) return; // 用户取消
 */
export function promptInput(message, defaultValue = '') {
    return new Promise((resolve) => {
        // 遮罩
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', zIndex: '99999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        });

        // 面板
        const panel = document.createElement('div');
        Object.assign(panel.style, {
            background: 'var(--bg-primary, #fff)', borderRadius: '16px',
            padding: '24px 28px', minWidth: '340px', maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: '16px',
            animation: 'fadeIn 0.15s ease',
        });

        // 标题
        const label = document.createElement('div');
        label.textContent = message;
        Object.assign(label.style, {
            fontSize: '14px', fontWeight: '600',
            color: 'var(--text-primary, #1a1a1a)',
        });

        // 输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        Object.assign(input.style, {
            width: '100%', padding: '10px 14px', fontSize: '14px',
            border: '1.5px solid var(--border-medium, #d1d5db)',
            borderRadius: '10px', outline: 'none', boxSizing: 'border-box',
            background: 'var(--bg-secondary, #f9fafb)',
            color: 'var(--text-primary, #1a1a1a)',
            transition: 'border-color 0.15s',
        });
        input.addEventListener('focus', () => { input.style.borderColor = 'var(--accent, #6366f1)'; });
        input.addEventListener('blur', () => { input.style.borderColor = 'var(--border-medium, #d1d5db)'; });

        // 按钮行
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
        });

        const btnCancel = document.createElement('button');
        btnCancel.textContent = '取消';
        Object.assign(btnCancel.style, {
            padding: '8px 20px', border: '1px solid var(--border-light, #e5e7eb)',
            borderRadius: '10px', background: 'var(--bg-secondary, #f9fafb)',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            color: 'var(--text-secondary, #6b7280)', transition: 'all 0.15s',
        });

        const btnOk = document.createElement('button');
        btnOk.textContent = '确定';
        Object.assign(btnOk.style, {
            padding: '8px 20px', border: 'none', borderRadius: '10px',
            background: 'var(--accent, #6366f1)', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', color: '#fff',
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)', transition: 'all 0.15s',
        });

        const cleanup = () => document.body.removeChild(overlay);

        btnCancel.onclick = () => { cleanup(); resolve(null); };
        btnOk.onclick = () => { cleanup(); resolve(input.value); };
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) { cleanup(); resolve(null); }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { cleanup(); resolve(input.value); }
            if (e.key === 'Escape') { cleanup(); resolve(null); }
        });

        btnRow.append(btnCancel, btnOk);
        panel.append(label, input, btnRow);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => { input.focus(); input.select(); });
    });
}
