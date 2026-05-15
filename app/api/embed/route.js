// Gemini 原生 API & OpenAI 兼容 API — 文本向量化 (Text Embeddings)

export const runtime = 'nodejs';

import { proxyFetch } from '../../lib/proxy-fetch';
import { rotateKey } from '../../lib/keyRotator';

function readErrorDetail(errorText) {
    try {
        const parsed = JSON.parse(errorText);
        const detail = parsed?.error?.message || parsed?.error || parsed?.message;
        if (!detail) return errorText;
        return typeof detail === 'string' ? detail : JSON.stringify(detail);
    } catch {
        return errorText;
    }
}

async function embeddingErrorResponse(response, { provider, model }) {
    const errorText = await response.text();
    const detail = readErrorDetail(errorText);
    let hint = '';

    if (response.status === 401 || response.status === 403) {
        hint = '请检查 Embedding API Key 是否正确，并确认该 Key 有调用当前嵌入模型的权限。';
    } else if (response.status === 404) {
        hint = '请检查 Embedding API 地址是否正确。OpenAI 兼容地址通常需要包含 /v1，最终会请求 /embeddings。';
    } else if (response.status === 429) {
        hint = '请求过于频繁或额度不足，请稍后重试，或降低重建频率。';
    }

    const prefix = `${provider || 'Embedding'} 模型 ${model || '未指定'} 调用失败 (${response.status})`;
    const message = [prefix, detail, hint].filter(Boolean).join('：');
    return new Response(JSON.stringify({ error: message }), { status: response.status });
}

function invalidEmbeddingResponse(provider, model) {
    return new Response(JSON.stringify({
        error: `${provider || 'Embedding'} 模型 ${model || '未指定'} 没有返回有效向量，请确认选择的是 Embedding 模型而不是对话模型。`,
    }), { status: 502 });
}

function normalizeOpenAIBaseUrl(rawBaseUrl) {
    let base = String(rawBaseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return base;

    const endpointSuffixes = [
        '/chat/completions',
        '/embeddings',
        '/responses',
        '/models',
    ];

    let changed = true;
    while (changed) {
        changed = false;
        const lower = base.toLowerCase();
        for (const suffix of endpointSuffixes) {
            if (lower.endsWith(suffix)) {
                base = base.slice(0, -suffix.length).replace(/\/+$/, '');
                changed = true;
                break;
            }
        }
    }

    return base;
}

export async function POST(request) {
    try {
        const { text, apiConfig } = await request.json();
        const proxyUrl = apiConfig?.proxyUrl || '';

        const isCustomEmbed = apiConfig?.useCustomEmbed;
        // 多实例架构下，apiConfig.provider 可能是实例 key，需回退到 providerType
        const rawProvider = isCustomEmbed ? apiConfig.embedProvider : (apiConfig?.providerType || apiConfig?.provider || 'zhipu');
        const provider = rawProvider;
        const apiKey = rotateKey(isCustomEmbed ? (apiConfig.embedApiKey || apiConfig?.apiKey) : apiConfig?.apiKey);

        // 自动识别默认填写或遗留的智谱URL并矫正为对应官方URL
        let defaultBaseUrl = ['gemini-native', 'custom-gemini'].includes(provider) ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://open.bigmodel.cn/api/paas/v4';

        let rawBaseUrl;
        if (isCustomEmbed) {
            rawBaseUrl = apiConfig.embedBaseUrl;
        } else {
            // 如果是自定义提供商且没开独立Embed，默认继承对聊的baseUrl
            rawBaseUrl = apiConfig?.baseUrl || defaultBaseUrl;
        }

        if (!rawBaseUrl || (['gemini-native', 'custom-gemini'].includes(provider) && rawBaseUrl.includes('open.bigmodel.cn'))) {
            rawBaseUrl = defaultBaseUrl;
        }

        const baseUrl = ['gemini-native', 'custom-gemini'].includes(provider)
            ? rawBaseUrl.replace(/\/$/, '')
            : normalizeOpenAIBaseUrl(rawBaseUrl);

        let embedModelName;
        if (isCustomEmbed) {
            embedModelName = apiConfig.embedModel || 'embedding-3';
        } else if (provider === 'custom') {
            // 如果没开独立embed，但选了custom，默认用text-embedding-v3-small或用户主模型
            embedModelName = 'text-embedding-v3-small';
        } else {
            embedModelName = provider === 'zhipu' ? 'embedding-3' : 'text-embedding-v3-small';
        }

        if (!apiKey) {
            return new Response(JSON.stringify({ error: isCustomEmbed ? '请在API配置中填写独立的 Embedding API Key' : '请先配置 API Key' }), { status: 400 });
        }

        if (!text || typeof text !== 'string') {
            return new Response(JSON.stringify({ error: '无效的文本输入' }), { status: 400 });
        }

        let embeddings = [];

        if (['gemini-native', 'custom-gemini'].includes(provider)) {
            const geminiModel = embedModelName || 'text-embedding-004';
            const url = `${baseUrl}/models/${geminiModel}:embedContent?key=${apiKey}`;
            // API Key 已在 URL 中，不打印完整 URL 以防泄露
            const res = await proxyFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: `models/${geminiModel}`,
                    content: { parts: [{ text }] }
                })
            }, proxyUrl);

            if (!res.ok) {
                return embeddingErrorResponse(res, { provider, model: geminiModel });
            }
            const data = await res.json();
            embeddings = data?.embedding?.values;
            if (!Array.isArray(embeddings) || embeddings.length === 0) {
                return invalidEmbeddingResponse(provider, geminiModel);
            }
        } else {
            // OpenAI 兼容格式
            const urls = baseUrl.endsWith('/v1') || baseUrl.endsWith('/v1beta')
                ? [`${baseUrl}/embeddings`]
                : [`${baseUrl}/embeddings`, `${baseUrl}/v1/embeddings`];
            let lastErrorResponse = null;

            for (const url of urls) {
                const res = await proxyFetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        input: text,
                        model: embedModelName
                    })
                }, proxyUrl);

                if (!res.ok) {
                    lastErrorResponse = res;
                    if (res.status !== 404) break;
                    continue;
                }

                const data = await res.json();
                embeddings = data?.data?.[0]?.embedding;
                if (!Array.isArray(embeddings) || embeddings.length === 0) {
                    return invalidEmbeddingResponse(provider, embedModelName);
                }
                break;
            }

            if (!Array.isArray(embeddings) || embeddings.length === 0) {
                if (lastErrorResponse) {
                    return embeddingErrorResponse(lastErrorResponse, { provider, model: embedModelName });
                }
                return invalidEmbeddingResponse(provider, embedModelName);
            }
        }

        return new Response(JSON.stringify({ embedding: embeddings }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Embedding API Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
