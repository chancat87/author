import assert from 'node:assert/strict';
import test from 'node:test';

import {
    isOfficialAuthorCloudUrl,
    normalizeCloudServerUrl,
    resolveCloudServerUrl,
} from '../app/lib/cloud-server-policy.mjs';

test('recognizes every Author official domain without matching lookalikes', () => {
    assert.equal(isOfficialAuthorCloudUrl('https://api.author2.com'), true);
    assert.equal(isOfficialAuthorCloudUrl('https://free.author2.com/app/'), true);
    assert.equal(isOfficialAuthorCloudUrl('https://author2.com'), true);
    assert.equal(isOfficialAuthorCloudUrl('https://author2.com.attacker.example'), false);
    assert.equal(isOfficialAuthorCloudUrl('https://my-author.example'), false);
});

test('Electron rejects official defaults and official addresses saved as self-hosted', () => {
    assert.equal(resolveCloudServerUrl({
        configuredUrl: '',
        defaultUrl: 'https://api.author2.com',
        isElectron: true,
    }), '');
    assert.equal(resolveCloudServerUrl({
        configuredUrl: 'https://api.author2.com/',
        defaultUrl: '',
        isElectron: true,
    }), '');
    assert.equal(resolveCloudServerUrl({
        configuredUrl: 'https://sync.example.com/',
        defaultUrl: 'https://api.author2.com',
        isElectron: true,
    }), 'https://sync.example.com');
});

test('official web builds retain their configured Author Cloud endpoint', () => {
    assert.equal(resolveCloudServerUrl({
        defaultUrl: 'https://api.author2.com/',
        isElectron: false,
    }), 'https://api.author2.com');
});

test('server URLs require HTTP(S) and reject embedded credentials', () => {
    assert.equal(normalizeCloudServerUrl('file:///tmp/server'), '');
    assert.equal(normalizeCloudServerUrl('https://user:pass@example.com'), '');
    assert.equal(normalizeCloudServerUrl('https://sync.example.com/base/'), 'https://sync.example.com/base');
});
