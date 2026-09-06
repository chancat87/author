# API 请求与文件解析限制

所有 `app/api/**/route.js` 的 HTTP 方法都必须通过 `withApiResources` 导出。
它先检查桌面访问凭据、请求频率和并发名额，再读取请求体，最后调用业务处理器。
API 路径不经过 Next Proxy，避免 Proxy 预先复制请求体。页面的桌面访问检查仍在 Proxy 中执行。

## 默认限制

1 MiB = 1,048,576 字节。请求频率采用 60 秒固定窗口，同一路径前缀及其子路径共用配额。

| API 前缀 | 每个可信 IP 每分钟请求数 | 请求体上限 | 每进程并发数 |
| --- | ---: | ---: | ---: |
| `/api/parse-file` | 10 | 52 MiB | 1 |
| `/api/ai` | 60 | 12 MiB | 8 |
| `/api/storage` | 600 | 5 MiB | 16 |
| `/api/sync/lan` | 30 | 12 MiB | 4 |
| `/api/sync/webdav` | 120 | 12 MiB | 4 |
| `/api/tts` | 60 | 12 MiB | 4 |
| `/api/embed` | 120 | 12 MiB | 8 |
| `/api/tools/search` | 60 | 2 MiB | 4 |
| `/api/desktop-handshake` | 30 | 0 | 4 |
| `/api/update-source`、`/api/update-source-stream`（各自） | 3 | 1 KiB | 1 |
| 其他 API（共用配额） | 120 | 2 MiB | 8 |

每进程最多保留 5,000 个限流桶、同时接纳 24 个请求。每种策略另有每分钟个人配额十倍的总请求上限。
限流桶满时拒绝新增身份，不淘汰尚未到期的身份；大量伪造地址不能无限增加内存。
所有有请求体的在途请求按各自策略上限预留容量，总和不超过 96 MiB。这是接纳预算，
不是进程 RSS 上限：框架、文本解码和解析器仍有额外分配。
SSE 请求直到流结束或取消才释放名额；普通请求在处理器结束后释放。

请求体按实际读取字节数检查，包括没有 `Content-Length` 的分块传输。
声明长度不合法或与实际长度不符时返回 400；超过上限返回 413；压缩请求体返回 415。
读取请求体最多 30 秒，超时返回 408 并取消读取。限流返回 429，并发或容量不足返回 503，
两者带 `Retry-After`。非法、失败及繁忙请求也会消耗频率配额。

## 可信客户端地址

应用不使用客户端自行提交的 `X-Real-IP` 或 `X-Forwarded-For` 识别限流身份。

使用随仓库提供的 Caddy Compose 部署时，在 Compose 读取的 `.env` 或启动环境中设置
`AUTHOR_PROXY_TOKEN`，使用至少 32 个字符的随机值。Compose 将同一值单独传给 Author 和 Caddy；
这里不要仅放在 `.env.local`，因为 Compose 的变量插值默认读取 `.env`。
Caddy 覆盖 `X-Author-Proxy-Token` 和 `X-Author-Client-IP`，应用仅在令牌验证通过时接受地址。
令牌是服务间凭据，不可使用 `NEXT_PUBLIC_` 前缀或交给浏览器。
Compose 只向内部网络开放应用 3000 端口，公网入口应保持在 Caddy；其他反向代理需要同样覆盖专用头。
Caddy 前再加代理时，本配置按连接到 Caddy 的地址限流；要保留终端 IP，必须单独配置并验证可信代理链。

仅在 Vercel 平台标记 `VERCEL=1` 时，应用接受平台的 `X-Vercel-Forwarded-For`。
平台说明该头不会接受外部覆盖，见 [Vercel 请求头文档](https://vercel.com/docs/headers/request-headers)。
自部署环境不要伪设 `VERCEL=1`。
无法验证地址时，所有请求共用 `shared-unverified` 身份，仍执行频率、并发和容量限制。

这些计数保存在单个 Node 进程内。多实例、不同函数实例和进程重启不共享配额；
公网多实例部署还需要入口层或共享存储的整体限流。本文限制不能替代主机或容器资源配额。

## PDF / DOC 解析

`/api/parse-file` 只接受一个名为 `file` 的 multipart 文件部分，格式为 PDF 或旧版 DOC。
文件最大 50 MiB，包含 multipart 封装的整个请求最大 52 MiB；不接受额外字段或多个文件。
文件扩展名与签名均会校验，multipart 头部最大 16 KiB。
TXT、Markdown、EPUB 和 DOCX 的客户端导入流程不经过该接口。

每次解析使用一个独立、用后退出的 Node 子进程，不写入稿件或临时文件，也不继承应用凭据。
解析最多 20 秒，PDF 最多 1,000 页，输出最多 4,194,304 个 JavaScript 字符单位。
子进程设置 V8 old-space 192 MiB、semi-space 16 MiB，并以 384 MiB RSS 为终止阈值进行内存采样。
采样目标间隔为 250 ms，不重叠执行；Windows 查询可能更慢。因此 RSS 阈值是检测后终止，
不是操作系统保证的瞬时硬上限。Linux 读取 `/proc`，Windows 使用隐藏的 PowerShell 查询，其他平台使用 `ps`。
部署应另配容器或主机内存限制，以覆盖采样间隙和原生库分配。

请求取消、解析超时或检测到超限会终止解析子进程，并在其退出后释放名额。
不支持启动子进程或读取内存用量时返回 503，不退回主进程解析。
损坏文件或资源超限返回 422；解析超时返回 408。扫描件没有可提取文字时仍返回空文本提示。

Standalone 输出必须包含 `app/lib/file-parser-child.cjs` 及 PDF/DOC 解析依赖。
`next.config.mjs` 的 `/api/parse-file` tracing includes 显式包含这些文件，
运行时工作目录须为 standalone 根目录（桌面端和生成的 `server.js` 已按此运行）。

## 入口与平台上限

Caddy 的 `request_body.max_size` 为 54,525,952 字节，与应用 52 MiB 请求上限一致。
应用仍独立计数字节；参见 [Caddy request_body 文档](https://caddyserver.com/docs/caddyfile/directives/request_body)。
`serverActions.bodySizeLimit` 只影响 Server Actions，不能用来配置 Route Handler 上传。
本项目的 Server Actions 和非 API Proxy 复制上限均为 1 MiB。

上游平台可能更早拒绝请求。2026-09-06 核对的 Vercel 文档规定函数请求体及响应体上限为 4.5 MB，
因此 Vercel 部署不能通过调整 Next 配置实现 50 MiB 上传；见 [Vercel Functions 限制](https://vercel.com/docs/functions/limitations#request-body-size)。
完整的 50 MiB 上传边界适用于允许该大小的桌面端或自部署 Node 入口。

## 验证

`tests/api-resource-guard.test.mjs` 覆盖实际字节计数、慢请求与取消、可信身份、桶数量、并发预算及路由接入约束。
`tests/file-parser.test.mjs` 使用合成 PDF/DOC 检查正常解析、超时、内存超限、崩溃与后续恢复。
构建后应在独立输出中再次执行 PDF/DOC 上传，确认子进程文件和依赖已被打包。
