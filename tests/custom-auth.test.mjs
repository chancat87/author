import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudFixture, session, jsonResponse, SERVER_A, SERVER_B, PRODUCT, SESSION_KEY, CONFIG_KEY } from './helpers/cloud-fixture.mjs';

test('sessions without a verified server/product binding are not resumed or deleted', async t => {
    for (const saved of [
        { user: session().user, tokens: session().tokens },
        session('user-a', SERVER_B), { ...session(), product: 'another-product' },
    ]) {
        await t.test(JSON.stringify({ server: saved.serverUrl, product: saved.product }), async t => {
            const f = await cloudFixture(t, { saved });
            f.auth.initCustomAuth();
            assert.equal(f.auth.isCustomSignedIn(), false);
            assert.deepEqual(JSON.parse(f.storage.get(SESSION_KEY)), saved);
            await assert.rejects(f.auth.authorizedFetch('/api/free/sync/pull'));
            assert.equal(f.requests.length, 0);
        });
    }
});

test('changing the configured server invalidates the old login before another request', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    assert.equal(f.auth.isCustomSignedIn(), true);
    assert.equal(f.auth.setCloudServerUrl(SERVER_B), true);
    assert.equal(f.auth.isCustomSignedIn(), false);
    assert.equal(f.auth.getAccessToken(), null);
    await assert.rejects(f.auth.authorizedFetch('/api/free/sync/pull'));
    assert.equal(f.requests.length, 0);
});

test('an external configuration change cannot send the old token to the new server', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    f.storage.set(CONFIG_KEY, JSON.stringify({ serverUrl: SERVER_B }));
    await assert.rejects(f.auth.authorizedFetch('/api/free/sync/pull'));
    assert.equal(f.requests.length, 0);
});

test('saving the same normalized server and repeated initialization preserve the session', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    assert.equal(f.auth.setCloudServerUrl(`${SERVER_A}/`), true);
    f.auth.initCustomAuth();
    await f.auth.authorizedFetch('/api/free/sync/pull');
    assert.equal(f.requests[0].options.headers.authorization, `Bearer ${session().tokens.accessToken}`);
    assert.equal(f.requests[0].options.redirect, 'error');
});

test('a late refresh cannot change a newer login', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const started = Promise.withResolvers();
    const release = Promise.withResolvers();
    f.env.fetch = async url => {
        if (url.endsWith('/pull')) return jsonResponse({}, 401);
        if (url.endsWith('/refresh')) { started.resolve(); return release.promise; }
        return jsonResponse({ ok: true, ...session('user-b') });
    };
    const oldRequest = f.auth.authorizedFetch('/api/free/sync/pull');
    const rejected = assert.rejects(oldRequest);
    await started.promise;
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve(jsonResponse({ ok: true, tokens: session('late-user-a').tokens }));
    await rejected;
    assert.equal(f.auth.getCurrentCustomUser().id, 'user-b');
    assert.equal(f.auth.getAccessToken(), session('user-b').tokens.accessToken);
    assert.equal(JSON.parse(f.storage.get(SESSION_KEY)).user.id, 'user-b');
});

test('a late 401 from a previous account cannot refresh or sign out the current account', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const release = Promise.withResolvers();
    f.env.fetch = async url => url.endsWith('/pull') ? release.promise : jsonResponse({ ok: true, ...session('user-b') });
    const previous = f.auth.authorizedFetch('/api/free/sync/pull');
    const rejected = assert.rejects(previous);
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve(jsonResponse({}, 401));
    await rejected;
    assert.equal(f.auth.getCurrentCustomUser().id, 'user-b');
    assert.equal(f.requests.filter(request => request.url.endsWith('/refresh')).length, 0);
});

test('the most recent login attempt wins even when an earlier response arrives last', async t => {
    const f = await cloudFixture(t, { saved: null });
    const release = Promise.withResolvers();
    let calls = 0;
    f.env.fetch = async () => ++calls === 1 ? release.promise : jsonResponse({ ok: true, ...session('user-b') });
    const first = f.auth.signInWithCustomServer('user-a@example.test', 'synthetic password');
    const rejected = assert.rejects(first);
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve(jsonResponse({ ok: true, ...session('user-a') }));
    await rejected;
    assert.equal(f.auth.getCurrentCustomUser().id, 'user-b');
});

test('logout clears the local identity immediately and its late response cannot clear a new login', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const release = Promise.withResolvers();
    f.env.fetch = async url => url.endsWith('/logout') ? release.promise : jsonResponse({ ok: true, ...session('user-b') });
    const leaving = f.auth.signOutCustom();
    assert.equal(f.auth.isCustomSignedIn(), false);
    f.auth.setCloudServerUrl(SERVER_B);
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    release.resolve(jsonResponse({ ok: true }));
    await leaving;
    assert.equal(f.requests[0].url, `${SERVER_A}/api/auth/logout`);
    assert.equal(f.auth.getCurrentCustomUser().id, 'user-b');
    assert.equal(JSON.parse(f.storage.get(SESSION_KEY)).serverUrl, SERVER_B);
});

test('concurrent unauthorized responses share a refresh within the same session', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    let refreshes = 0;
    f.env.fetch = async (url, options) => {
        if (url.endsWith('/refresh')) {
            refreshes++;
            return jsonResponse({ ok: true, tokens: session('rotated').tokens });
        }
        return jsonResponse({ ok: true }, options.headers.authorization === `Bearer ${session('rotated').tokens.accessToken}` ? 200 : 401);
    };
    const results = await Promise.all([f.auth.authorizedFetch('/one'), f.auth.authorizedFetch('/two')]);
    assert.deepEqual(results.map(result => result.status), [200, 200]);
    assert.equal(refreshes, 1);
});

test('Electron stores tokens with the same server and user binding as public session metadata', async t => {
    const f = await cloudFixture(t, { saved: null });
    let encrypted;
    f.window.electronAPI = {
        isElectron: true,
        getCloudSessionTokens: () => ({ success: true, value: encrypted }),
        setCloudSessionTokens: value => { encrypted = value; return { success: true }; },
    };
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    const metadata = JSON.parse(f.storage.get(SESSION_KEY));
    const secured = JSON.parse(encrypted);
    assert.equal(metadata.serverUrl, SERVER_A);
    assert.equal(metadata.product, PRODUCT);
    assert.equal(metadata.tokens, undefined);
    assert.equal(secured.serverUrl, SERVER_A);
    assert.equal(secured.userId, 'user-b');
    assert.equal(secured.tokens.accessToken, session('user-b').tokens.accessToken);
    assert.equal(f.auth.setCloudServerUrl('https://api.author2.com'), false);
});

test('a storage event cancels the old request context', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const release = Promise.withResolvers();
    f.env.fetch = async () => release.promise;
    const pending = f.auth.authorizedFetch('/api/free/sync/pull');
    const rejected = assert.rejects(pending);
    f.storage.set(CONFIG_KEY, JSON.stringify({ serverUrl: SERVER_B }));
    f.fireStorage(CONFIG_KEY);
    assert.equal(f.requests[0].options.signal.aborted, true);
    release.resolve(jsonResponse({ ok: true }));
    await rejected;
    assert.equal(f.auth.isCustomSignedIn(), false);
});

test('an earlier logout action cannot sign out an account that logged in during its save', async t => {
    const f = await cloudFixture(t);
    f.auth.initCustomAuth();
    const authContext = f.auth.getCustomAuthContext();
    await f.auth.signInWithCustomServer('user-b@example.test', 'synthetic password');
    await assert.rejects(f.auth.signOutCustom({ authContext }), { code: 'AUTH_CONTEXT_CHANGED' });
    assert.equal(f.auth.getCurrentCustomUser().id, 'user-b');
    assert.equal(f.requests.some(request => request.url.endsWith('/logout')), false);
});

test('Electron resumes encrypted tokens only when their server, product and user match metadata', async t => {
    for (const mismatch of [null, 'serverUrl', 'product', 'userId']) {
        await t.test(mismatch || 'matching', async t => {
            const metadata = session();
            delete metadata.tokens;
            const f = await cloudFixture(t, { saved: metadata });
            const secured = { serverUrl: SERVER_A, product: PRODUCT, userId: 'user-a', tokens: session().tokens };
            if (mismatch) secured[mismatch] = 'different';
            f.window.electronAPI = {
                isElectron: true,
                getCloudSessionTokens: () => ({ success: true, value: JSON.stringify(secured) }),
                setCloudSessionTokens: () => { throw new Error('Unexpected write'); },
            };
            f.auth.initCustomAuth();
            assert.equal(f.auth.isCustomSignedIn(), mismatch === null);
            assert.deepEqual(JSON.parse(f.storage.get(SESSION_KEY)), metadata);
        });
    }
});
