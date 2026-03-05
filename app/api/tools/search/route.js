// 统一搜索 API — 支持 Google Custom Search / Bing Search / Tavily
// 供 Function Calling 搜索循环调用

export const runtime = 'edge';

export async function POST(request) {
    try {
        const { query, searchConfig } = await request.json();

        if (!query) {
            return Response.json({ error: '搜索关键词不能为空' }, { status: 400 });
        }
        if (!searchConfig?.provider || !searchConfig?.apiKey) {
            return Response.json({ error: '请先配置搜索引擎 API Key（设置 → API配置 → 搜索工具）' }, { status: 400 });
        }

        let results = [];

        switch (searchConfig.provider) {

            case 'tavily': {
                const res = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: searchConfig.apiKey,
                        query,
                        max_results: 5,
                        include_answer: false,
                    }),
                });
                if (!res.ok) {
                    const err = await res.text();
                    console.error('Tavily Search error:', res.status, err);
                    return Response.json({ error: `Tavily 搜索失败 (${res.status})` }, { status: res.status });
                }
                const data = await res.json();
                results = (data.results || []).map(item => ({
                    title: item.title || '',
                    url: item.url || '',
                    snippet: item.content || '',
                }));
                break;
            }

            default:
                return Response.json({ error: `不支持的搜索引擎: ${searchConfig.provider}` }, { status: 400 });
        }

        return Response.json({ results });
    } catch (error) {
        console.error('搜索接口错误:', error);
        return Response.json({ error: '搜索请求失败' }, { status: 500 });
    }
}
