import assert from 'node:assert/strict';
import test from 'node:test';

import {
    containsNonEmptyApiSecrets,
    mergeApiSecrets,
    splitApiSecrets,
} from '../app/lib/api-secret-storage.js';

test('API keys are removed from public configuration at every nesting level', () => {
    const source = {
        apiKey: 'main-secret',
        embedApiKey: 'embed-secret',
        providerConfigs: {
            alpha: { apiKey: 'provider-secret', baseUrl: 'https://example.com/v1' },
        },
        searchConfig: { apiKey: 'search-secret', tool: 'tavily' },
    };
    const split = splitApiSecrets(source);

    assert.equal(split.publicValue.apiKey, '');
    assert.equal(split.publicValue.embedApiKey, '');
    assert.equal(split.publicValue.providerConfigs.alpha.apiKey, '');
    assert.equal(split.publicValue.searchConfig.apiKey, '');
    assert.equal(JSON.stringify(split.publicValue).includes('secret'), false);
    assert.equal(containsNonEmptyApiSecrets(split.secrets), true);
    assert.deepEqual(mergeApiSecrets(split.publicValue, split.secrets), source);
});

test('empty secret fields stay empty and do not count as legacy plaintext', () => {
    const split = splitApiSecrets({ apiKey: '', providerConfigs: {} });
    assert.equal(containsNonEmptyApiSecrets(split.secrets), false);
    assert.deepEqual(mergeApiSecrets(split.publicValue, split.secrets), { apiKey: '', providerConfigs: {} });
});
