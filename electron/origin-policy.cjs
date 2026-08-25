'use strict';

const STABLE_DESKTOP_HOST = 'localhost';

function normalizeDesktopPort(port) {
    const parsed = Number.parseInt(String(port), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error('Invalid desktop port');
    }
    return parsed;
}

function getDesktopServerUrl(port, host = STABLE_DESKTOP_HOST) {
    return `http://${host}:${normalizeDesktopPort(port)}`;
}

function isTrustedDesktopUrl(rawUrl, port) {
    try {
        return new URL(rawUrl).origin === getDesktopServerUrl(port);
    } catch {
        return false;
    }
}

async function selectStableDesktopPort(basePort, isAvailable) {
    const port = normalizeDesktopPort(basePort);
    if (typeof isAvailable !== 'function') {
        throw new Error('Port availability check is required');
    }
    return await isAvailable(port) ? port : null;
}

module.exports = {
    STABLE_DESKTOP_HOST,
    getDesktopServerUrl,
    isTrustedDesktopUrl,
    selectStableDesktopPort,
};
