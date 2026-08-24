function isSecretField(key) {
    return /apiKey$/i.test(String(key || ''));
}

function splitNode(value) {
    if (Array.isArray(value)) {
        const parts = value.map(splitNode);
        const hasSecrets = parts.some(part => part.secrets !== undefined);
        return {
            publicValue: parts.map(part => part.publicValue),
            secrets: hasSecrets ? parts.map(part => part.secrets) : undefined,
        };
    }
    if (!value || typeof value !== 'object') {
        return { publicValue: value, secrets: undefined };
    }

    const publicValue = {};
    const secrets = {};
    let hasSecrets = false;
    for (const [key, item] of Object.entries(value)) {
        if (isSecretField(key)) {
            publicValue[key] = '';
            secrets[key] = typeof item === 'string' ? item : '';
            hasSecrets = true;
            continue;
        }
        const child = splitNode(item);
        publicValue[key] = child.publicValue;
        if (child.secrets !== undefined) {
            secrets[key] = child.secrets;
            hasSecrets = true;
        }
    }
    return { publicValue, secrets: hasSecrets ? secrets : undefined };
}

function mergeNode(publicValue, secrets) {
    if (Array.isArray(publicValue)) {
        return publicValue.map((item, index) => mergeNode(item, Array.isArray(secrets) ? secrets[index] : undefined));
    }
    if (!publicValue || typeof publicValue !== 'object') return publicValue;

    const merged = {};
    for (const [key, item] of Object.entries(publicValue)) {
        if (isSecretField(key)) {
            merged[key] = typeof secrets?.[key] === 'string' ? secrets[key] : '';
        } else {
            merged[key] = mergeNode(item, secrets?.[key]);
        }
    }
    return merged;
}

function containsNonEmptyNode(value) {
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.some(containsNonEmptyNode);
    if (value && typeof value === 'object') return Object.values(value).some(containsNonEmptyNode);
    return false;
}

export function splitApiSecrets(value) {
    return splitNode(value);
}

export function mergeApiSecrets(publicValue, secrets) {
    return mergeNode(publicValue, secrets);
}

export function containsNonEmptyApiSecrets(secrets) {
    return containsNonEmptyNode(secrets);
}
