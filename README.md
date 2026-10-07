# 陈远小站 · 运行中的工程档案

以个人工程身份为锚点，用持续更新的阅读、策展和个人判断呈现真实的工程实践。Web 是主要产品：桌面使用身份轨与连续内容流，手机浏览器使用同一套栏目和公开内容。

另有 [Android](android/README.md)（Kotlin + Jetpack Compose）和 [iOS](ios/README.md)（Swift 6 + SwiftUI，iOS 26+）原生客户端。它们复用站点公开内容 API，并通过 `/api/ask` 使用问答能力；构建与验证以各自 README 为准。

**线上地址：** https://default-coder.lovemyrmb.cn/

## 站点版块

| 版块 | 路径 | 内容 |
| --- | --- | --- |
| 首页 | `/` | 个人简介与内容入口；桌面默认呈现每日动态，手机先呈现完整个人资料 |
| 每日动态 | `/ai-news` | AI 与 Agent 资讯，列表和详情直接读取 Supabase 公开投影 |
| 每日关注 | `/curation` | X 书签与点赞的中文策展、来源和详情 |
| 设计收藏 | `/design` | 从 X 策展中筛出的设计相关内容 |
| 抖音收藏 | `/douyin` | 基于收藏视频转写与屏幕文字整理的关注条目 |
| 开源关注 | `/open-source` | 已选择公开的 GitHub Star，提供原始 README 或仓库结构、中文阅读版与个人判读 |
| 关于我与问一问 | 个人资料区 | 站内履历打印稿；点击像素角色展开基于公开资料的匿名问答，无独立 `/ask` 页面 |

个人资料区还提供 GitHub、语雀和外部作品集入口。
每日动态可按精选或分类筛选，开源关注可按主题筛选；内容流按日期阅读并支持继续加载，详情保留来源出口。

## 技术栈

- **Web**：Next.js 16.3.8（App Router）、React 19.3.0、Tailwind CSS 4.3.3、shadcn CLI 4.21.1 / `@shadcn/react` 0.3.1、Radix UI 1.6.7、Motion 14.0.0、Lucide 1.51.0；部署在 Vercel。
- **运行时与工程工具**：Node.js 24.21.0（最新 LTS；Vercel 支持 24.x）、pnpm 12.9.1、TypeScript 7.0.2、Effect 4.0.0、Turbo 2.11.7、oxlint 1.86.0、Portless 0.15.7；测试使用 Vitest 5.0.3、Vite 8.3.2 与 Playwright 1.63.0。
- **数据与 AI**：Supabase JS 2.117.2、better-sqlite3 13.0.3、AI SDK 7.0.127 / Anthropic 4.0.71、Pi 1.0.2、Transformers.js 4.3.0、sqlite-vec 0.1.9。
- **原生客户端**：Android 使用 AGP 9.4.1、Gradle 9.8.0、Kotlin 2.4.20、Compose BOM 2026.09.00（compileSdk 37.1）；iOS 使用 Xcode 27 / Swift 6.4 工具链、Swift 6 语言模式与 SwiftUI（iOS 26+），无第三方依赖。
- **公开数据**：每日动态从只读 `data/ai-news.sqlite` 历史归档与 Supabase 公开增量合并读取；X、抖音、开源关注与本地问答全文索引从随 Git 部署的只读 `data/curation.sqlite` 读取。
- **问一问**：仅检索已发布的个人简介、每日动态、每日关注和开源资料；使用智谱 GLM 流式回答并附来源。离线策展解析默认通过 Pi 调用智谱 GLM。

以上版本于 2026-10-04 核对稳定发布；精确依赖见各工作区 `package.json`、`pnpm-lock.yaml` 和 `android/gradle/libs.versions.toml`。Node.js 26.10.0 属于 Current 发布线，待部署平台支持后再升级。`@steipete/bird` 0.8.0 已停止维护且无新版，当前仅用于离线抓取工具。

2026-10-04 安全审计已修复所有有补丁的告警；剩余 `braces` 3.0.3 的一条高危告警来自 shadcn CLI 的间接依赖，上游暂无修复版（[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)）。

X / 抖音 / GitHub Star 的抓取与模型结果留在本机忽略目录；只有筛选后的公开投影进入 SQLite。每日动态由上游接口同步到 Supabase 私有表与公开投影，网站不直接请求上游。SQLite 内容需要随 Git 合并并重新部署才会更新；每日动态落库后，下一次页面请求即可读到新内容；每日历史归档 PR 部署成功后才允许清理对应云端记录。

## 代码路径

| 要追踪的功能 | 写入或入口 | 读取与界面 |
| --- | --- | --- |
| 每日动态 | `packages/public-data/src/ai-news/sync.mjs` → Supabase 公开投影 | `apps/web/lib/ai-news.ts` → `apps/web/app/ai-news/`、`apps/web/app/api/ai-news/` 与首页 |
| X / 抖音 / GitHub Star | `tools/content/scripts/` 调度 `tools/content/modules/x-sync/`、`tools/content/modules/douyin-sync/`、`tools/content/modules/github-starred/` → `data/curation.sqlite` | `apps/web/lib/curation.ts`、`apps/web/lib/open-source.ts` → 栏目与公开 GET API |
| 问一问 | `apps/web/app/api/ask/route.ts` → `apps/web/lib/ask-search.server.ts`、`apps/web/lib/ask-session.server.ts` | `apps/web/components/use-ask-conversation.ts` 管会话、`apps/web/components/ask-sse.ts` 解析流；`apps/web/components/ask-chat.tsx` → `apps/web/components/ask-message.tsx` → `apps/web/components/ask-answer.tsx` 渲染抽屉、消息与 OpenUI；原生客户端复用公开 API |
| 本地向量检索 | `tools/content/scripts/local-vectors.mjs` → `tools/content/modules/local-vectors/indexer.mjs`、`tools/content/modules/local-vectors/search.mjs` | 私有文件与公开 Ask 投影只进入本机忽略索引；Web 不读取该索引 |
| 原生客户端 | [Android data](android/app/src/main/java/cn/lovemyrmb/personalsite/data/) 与 [iOS Data](ios/ChenYuanSite/Data/) | 各自原生界面消费公开 GET API 与 `POST /api/ask`；构建命令见各端 README |

页面布局和移动端行为继续以 [前端架构](docs/frontend-architecture.md) 与 [DESIGN.md](DESIGN.md) 为准；私有输入和公开投影的界限见 [敏感数据说明](docs/sensitive-data.md)。

## 本地开发

```bash
pnpm install          # Node.js >= 24.21.0；pnpm@12.9.1
pnpm dev:domain       # https://personal-site.localhost（Turbopack）
pnpm dev              # 不使用域名时的本地端口入口
pnpm typecheck        # TypeScript 7（scripts/tsc7.mjs）
pnpm lint
pnpm test             # Vitest + node:test
pnpm test:e2e         # 浏览器 e2e 回归（e2e 运行器，含无障碍检查）
pnpm test:e2e:touch   # Playwright 留守件（触摸设备与 prefers-reduced-motion CSS 用例）
pnpm build
pnpm focus:status     # 汇总同步状态、公开 SQLite 与 Ask 索引健康度
pnpm health:production # 连续三次探测线上统一健康端点
pnpm git:safety       # 提交内容或配置前检查敏感数据边界
```

环境变量以 [`.env.example`](.env.example) 为准：公开每日动态读取需要 Supabase URL 与 publishable key；问答、会话持久化和同步还需要相应的智谱密钥、会话密钥及服务端 service-role key。凭据仅放服务端或本机忽略文件，不使用 `NEXT_PUBLIC_` 前缀。

## 数据同步

| 来源 | 手动入口 | 更新路径 |
| --- | --- | --- |
| 每日动态 | `pnpm ai-news:sync` / `pnpm ai-news:backfill` | 24 小时增量或 7 天回填，直接写 Supabase；[同步说明](docs/ai-news-sync.md) |
| X 书签与点赞 | `pnpm curation:sync` | 抓取、解析、设计分类并重建本地公开 SQLite；[同步说明](docs/supabase-x-sync.md) |
| 抖音收藏 | `pnpm douyin:sync`，然后 `pnpm curation:publish` | 发现、下载、转写/OCR、策展；成功入队的条目在重建 SQLite 后公开；[同步说明](docs/douyin-curation.md) |
| GitHub Star | `pnpm github:starred:daily` | 增量检查、补齐中文阅读版并更新本地 SQLite；`github:starred:sync` 仅同步来源；[同步说明](docs/github-starred-sync.md) |

Supabase Cron 每 5 分钟触发每日动态增量同步，GitHub Actions 每天北京时间 04:17 回填 7 天。本机另配置每天 03:00 的 Codex 自动化执行上述来源；该个人调度不在仓库内，克隆项目不会自动安装。各来源的失败分别记录，不阻止其他来源继续运行。

公开发现入口包括 `/sitemap.xml`、`/robots.txt`、`/feed.xml` 与全站 Open Graph 图片；RSS 聚合每日动态、每日关注、开源关注的最近更新。

`/api/health/data` 汇总全部公开数据面的新鲜度、Ask 索引一致性与部署 Commit；GitHub Actions 每 15 分钟探测，连续三次异常才使任务失败。

## 数据边界

原始个人资料、X/抖音/GitHub 抓取快照及本地转写只留在被 Git 忽略的敏感目录；浏览器只接触公开投影。匿名问答会话在部署端存于私有 Supabase Storage。提交前有 Git 安全检查；完整边界见 [敏感数据说明](docs/sensitive-data.md)。

## 文档

- [PRODUCT.md](PRODUCT.md) — 产品定位与功能边界
- [GLOSSARY.md](GLOSSARY.md) — 公开内容、收录与问答的领域术语
- [DESIGN.md](DESIGN.md) — 视觉与交互规则
- [前端架构](docs/frontend-architecture.md) — 页面和数据读取职责
- [AGENTS.md](AGENTS.md) — 协作与工程约定

## 工作区

使用 pnpm workspace + Turborepo：`apps/web` 是 Next.js 网站，`tools/content` 是离线同步/分析工具，`packages/public-data` 是共用公开数据代码。根目录 `pnpm dev`、`pnpm build`、`pnpm lint`、`pnpm typecheck`、`pnpm test` 与数据操作命令继续作为统一入口。

路径、缓存规则和 Vercel 配置见 [工作区说明](docs/monorepo.md)。Android、iOS 保留原构建工具及目录。
