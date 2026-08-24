/**
 * 带代理支持的 fetch 封装
 * Node.js Runtime 下，如果指定了 proxyUrl，使用 undici 的 ProxyAgent
 */
import { Agent } from 'undici';
import {
    assertSafeOutboundUrl,
    OutboundRequestBlockedError,
    redactSensitiveText,
    rejectOfficialProxy,
    secureDnsLookup,
} from './server-security.mjs';

let secureDispatcher;

function getSecureDispatcher() {
    secureDispatcher ||= new Agent({ connect: { lookup: secureDnsLookup } });
    return secureDispatcher;
}

export async function proxyFetch(url, options = {}, proxyUrl, policy = {}) {
    // Electron's proxy.js gate authenticates every request with a per-launch
    // HttpOnly capability before route code can run. Other deployments stay
    // public-network-only unless a narrowly scoped caller opts in.
    const allowPrivateNetwork = policy?.allowPrivateNetwork === true
        || Boolean(process.env.AUTHOR_DESKTOP_CAPABILITY);
    await assertSafeOutboundUrl(url, { allowPrivateNetwork });

    if (!allowPrivateNetwork) {
        rejectOfficialProxy(proxyUrl);
        if (String(proxyUrl || '').trim()) {
            throw new OutboundRequestBlockedError('未授权的请求不能使用自定义代理');
        }
        return fetch(url, { ...options, dispatcher: getSecureDispatcher() });
    }

    if (proxyUrl) {
        try {
            const { ProxyAgent } = await import('undici');
            const agent = new ProxyAgent(proxyUrl);
            return fetch(url, { ...options, dispatcher: agent });
        } catch (e) {
            console.warn('[proxy-fetch] ProxyAgent 创建失败，回退到直连:', redactSensitiveText(e?.message || e, 200));
            return fetch(url, options);
        }
    }
    return fetch(url, options);
}
