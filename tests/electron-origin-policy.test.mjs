import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    STABLE_DESKTOP_HOST,
    getDesktopServerUrl,
    isTrustedDesktopUrl,
    selectStableDesktopPort,
} = require('../electron/origin-policy.cjs');

test('desktop storage origin stays on the legacy localhost host', () => {
    assert.equal(STABLE_DESKTOP_HOST, 'localhost');
    assert.equal(getDesktopServerUrl(3000), 'http://localhost:3000');
    assert.equal(isTrustedDesktopUrl('http://localhost:3000/app', 3000), true);
    assert.equal(isTrustedDesktopUrl('http://127.0.0.1:3000/app', 3000), false);
});

test('desktop port policy fails closed instead of changing storage origin', async () => {
    const checked = [];
    const selected = await selectStableDesktopPort(3000, async (port) => {
        checked.push(port);
        return false;
    });

    assert.equal(selected, null);
    assert.deepEqual(checked, [3000]);
});

test('desktop port policy keeps the configured stable port when available', async () => {
    const selected = await selectStableDesktopPort(3000, async () => true);
    assert.equal(selected, 3000);
});
