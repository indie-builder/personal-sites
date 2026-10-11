# 作品集公开读取接口

Web、Android 与 iOS 使用主站 `https://default-coder.lovemyrmb.cn` 的公开 GET 接口。Web 与接口共享 `@site/public-data/portfolio` 的公开查询，不读取原作品集部署。媒体返回主站或既有 CDN 的绝对地址。响应缓存为 `public, max-age=60, stale-while-revalidate=300`。

| 路径 | 内容 |
| --- | --- |
| `/api/portfolio` | `items` 作品索引，包含 id、名称、简介、说明、日期和封面 |
| `/api/portfolio/layouts` | 图鉴分页、分类、主题及署名，图片已应用修正表 |
| `/api/portfolio/layouts/:id` | 单个图鉴，缺图时保留元数据与空 media |
| `/api/portfolio/muse` | 去重后的灵感分页及分类 |
| `/api/portfolio/muse/:slug` | 标题、作者、说明、全部媒体及原作 URL |
| `/api/portfolio/tools` | 分类、工具名称、官网 URL 与图标 |
| `/api/portfolio/site` | 网站说明、宣传片、海报与主站地址 |

集合参数 `offset` 默认 0，`limit` 默认 24，范围 1–60。`q` 最长 200 字，`cat` 使用响应中的分类 id。布局还支持主题参数 `theme`。集合响应包含 `items`、`total`、`hasMore`、`categories`、`topics` 和 `attribution`；详情响应为 `{item}`。无效分页返回 400，未知资源返回 404。原始载荷、同步信息和媒体大小不进入响应。

作品索引包含七个产品。布局和灵感提供集合 API，工具和网站介绍提供对应读取接口。词典、AI 问答与文字游乐场使用 `/products/<id>` Web 页面；原生客户端按产品 id 选择已有原生页面或正确的 Web 地址。

本机运行 `pnpm dev` 后可通过 `http://127.0.0.1:3000/api/portfolio` 联调。iOS Debug 保留 `PORTFOLIO_BASE_URL` 覆盖，Release 与主站 API 同源。自动化覆盖见 `apps/web/e2e/portfolio-integrated.e2e.ts`，内容维护见[作品集维护](portfolio.md)。
