const OFFICIAL_AUTHOR_DOMAIN = 'author2.com';

export function normalizeCloudServerUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        if (parsed.username || parsed.password) return '';
        return parsed.toString().replace(/\/+$/, '');
    } catch {
        return '';
    }
}

export function isOfficialAuthorCloudUrl(value) {
    const normalized = normalizeCloudServerUrl(value);
    if (!normalized) return false;
    const hostname = new URL(normalized).hostname.toLowerCase().replace(/\.$/, '');
    return hostname === OFFICIAL_AUTHOR_DOMAIN || hostname.endsWith(`.${OFFICIAL_AUTHOR_DOMAIN}`);
}

export function resolveCloudServerUrl({ configuredUrl, defaultUrl, isElectron = false } = {}) {
    const configured = normalizeCloudServerUrl(configuredUrl);
    if (configured && (!isElectron || !isOfficialAuthorCloudUrl(configured))) {
        return configured;
    }
    if (isElectron) return '';
    return normalizeCloudServerUrl(defaultUrl);
}
