export async function copyTextToClipboard(text) {
    const value = text == null ? '' : String(text);

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            // Fall back below for web builds where clipboard permission/focus is denied.
        }
    }

    if (typeof document === 'undefined' || !document.body) return false;

    const activeElement = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    try {
        textarea.focus({ preventScroll: true });
    } catch {
        textarea.focus();
    }
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    try {
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        document.body.removeChild(textarea);
        if (activeElement && typeof activeElement.focus === 'function') {
            try {
                activeElement.focus({ preventScroll: true });
            } catch {
                activeElement.focus();
            }
        }
    }
}
