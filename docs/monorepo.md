# Bun / Turborepo 工作区

| 目录 | 包名 | 所有权 |
| --- | --- | --- |
| `apps/web` | `@site/web` | TanStack Start 页面、API、组件、Web 单测与浏览器 e2e（e2e 运行器 + Playwright 留守件） |
| `tools/content` | `@site/content` | 抓取、离线分析、同步、归档、向量索引与 Bun/Node 测试 |
| `packages/effect` | `@site/effect` | Effect I/O 错误边界与公共 Schema 基础约束 |
| `packages/public-data` | `@site/public-data` | 公开数据 schema、SQLite 工具、每日动态同步/归档、健康检查 |
| `scripts`、`config`、`tests` | 根工作区 | 仓库保护、TS7 入口、共享公开配置、Git/打包边界测试 |
| `android`、`ios` | 原生工程 | 保持 Gradle / Xcode 构建与各自 CI |

Web 和内容管道通过 `workspace:*` 依赖 `@site/public-data`，使用显式子路径导入。公共包不得反向引用 Web 或离线分析工具；`@site/effect` 只依赖 Effect，业务执行约定见 [Effect 开发规则](effect-architecture.md)；Pi、Transformers、sqlite-vec、bird 仅由内容管道持有。共同的智谱端点/模型默认值仍由根 `config/bigmodel.mjs` 提供，Pi 适配器归内容管道。

## 包管理与运行时

- Bun 是包管理器与默认脚本/测试运行时：`bun install` 生成 `bun.lock`（从 `pnpm-lock.yaml` 迁移时保留既有精确版本），任务经 `bun run`/`bun run --filter <pkg>` 执行；`bun install` 使用 isolated 布局，保持 pnpm 同款的严格依赖隔离（无幻影依赖）。
- 根 `package.json` 的 `trustedDependencies` 显式列出允许运行安装脚本的依赖（better-sqlite3、esbuild、sharp、onnxruntime-node、@huggingface/tokenizers）；`overrides` 从 `package.json` 全局生效。pnpm 的 `minimumReleaseAgeExclude`（发布冷却期）与 `allowBuilds` 黑名单没有 Bun 等价物——版本由 `bun.lock` 全量锁定，升级时人工核对发布时间与变更面。
- 仍需 Node.js `>=24.21.0 <25`：Web 的 `build`/`start` 启动器（`node --import ./scripts/load-env.mjs ...`，与 Vercel 函数运行时对齐）、`apps/web` 的 Vitest（jsdom），以及 `tools/content` 三个依赖 `node:module` `registerHooks` 的 `*.node-test.mjs` 套件；其余脚本与 `bun test` 套件默认跑在 Bun 运行时，`dev` 服务器也由 Bun 启动。

## 命令

```bash
bun install --frozen-lockfile
bun run dev:domain                          # https://personal-site.localhost
bun run dev                                 # 默认端口 Web 开发
bun run typecheck
bun run lint
bun run test
bun run build
bun run test:e2e
bun run test:e2e:touch
cd apps/web && bunx vitest run tests/ai-news-hybrid.test.ts
bun run --filter @site/content test
bunx turbo run build test --dry=json        # 只看任务依赖，不运行任务
```

Web 源码直接位于 `apps/web/src/routes/`（TanStack Start 文件路由，页面与 server routes）、`apps/web/src/functions/`（页面数据 server functions，SQLite/Supabase 读取的唯一入口）、`apps/web/components/`、`apps/web/lib/`；内容工具位于 `tools/content/modules/`、`tools/content/lib/`、`tools/content/scripts/`。查找未知文件先从所属目录的 `rg --files` 定位；第三方依赖从实际消费它的 workspace 解析，不假定在根 `node_modules` 可见。

同一 `apps/web` 目录只运行一个 Vite dev 实例，实时验证复用已有服务。浏览器 e2e 有两个入口，都独占 7100 端口：`bun run test:e2e` 走 e2e 运行器，先构建再自起生产服务并全量收集 `e2e/*.e2e.ts`，这次成功构建可计入交付验证；`bun run test:e2e:touch` 走 Playwright 只收集 `e2e/*.spec.ts` 留守件（触摸设备与 `prefers-reduced-motion` CSS 用例），默认自建自启生产服务。若刚对同一份未变化源码执行过 `bun run build`，可用 `PLAYWRIGHT_REUSE_BUILD=1 bun run test:e2e:touch` 只启动该产物；源码变化后重新构建。该开关只作用于 Playwright 入口，不复用其他进程、不跳过测试，也不能在缺少生产产物时使用。

TS7 入口仍在 `scripts/tsc7.mjs`；lint 使用 oxlint，不改 TypeScript 版本（Bun 对 peer 范围不匹配只告警，不再需要 pnpm 的 peer exceptions）。数据操作命令例如 `bun run ai-news:archive`、`bun run curation:sync`、`bun run github:starred:daily` 保留在根目录，转发给内容管道；它们会访问或写入真实数据，不是验证命令，不挂到 Turbo 的 build/test 依赖中。各来源的手动入口与定时调度汇总见[数据同步总览](data-sync.md)。

## 功能到代码路径

| 要追踪的功能 | 写入或入口 | 读取与界面 |
| --- | --- | --- |
| 每日动态 | `packages/public-data/src/ai-news/sync.mjs` → Supabase 公开投影 | `apps/web/lib/ai-news.ts`（经 `src/functions/content.ts` 的 server functions）→ `apps/web/src/routes/ai-news/`、`apps/web/src/routes/api/ai-news.ts` 与首页 |
| X / 抖音 / GitHub Star | `tools/content/scripts/` 调度 `tools/content/modules/x-sync/`、`tools/content/modules/douyin-sync/`、`tools/content/modules/github-starred/` → `data/curation.sqlite` | `apps/web/lib/curation.ts`、`apps/web/lib/open-source.ts` → 栏目与公开 GET API |
| 问一问 | `apps/web/src/routes/api/ask.ts` → `apps/web/lib/ask-search.server.ts`、`apps/web/lib/ask-session.server.ts` | `apps/web/components/use-ask-conversation.ts` 管会话、`apps/web/components/ask-sse.ts` 解析流；`apps/web/components/ask-chat.tsx` → `apps/web/components/ask-message.tsx` → `apps/web/components/ask-answer.tsx` 渲染抽屉、消息与 OpenUI；原生客户端复用公开 API |
| 本地向量检索 | `tools/content/scripts/local-vectors.mjs` → `tools/content/modules/local-vectors/indexer.mjs`、`tools/content/modules/local-vectors/search.mjs` | 私有文件与公开 Ask 投影只进入本机忽略索引；Web 不读取该索引 |
| 原生客户端 | [Android data](../android/app/src/main/java/cn/lovemyrmb/personalsite/data/) 与 [iOS Data](../ios/ChenYuanSite/Data/) | 各自原生界面消费公开 GET API 与 `POST /api/ask`；构建命令见各端 README |

页面布局和移动端行为以[前端架构](frontend-architecture.md)与 [DESIGN.md](../DESIGN.md)为准；私有输入和公开投影的界限见[敏感数据说明](sensitive-data.md)。

## 数据与环境变量

- 根 `data/curation.sqlite` 和 `data/ai-news.sqlite` 是唯一提交的公开快照。`apps/web/scripts/prepare-data.mjs` 在 dev/build/test 前将这两个明确列出的文件复制到被忽略的 `apps/web/data/`（dev/vitest 运行时读取）与 `apps/web/assets/data/`（部署打包输入）；缺少任一文件就失败。不会递归复制 `data/`，也不会打包敏感目录。
- Web 运行时按定位链读取数据文件（cwd 相对 `data/` → 部署产物内副本，见 `apps/web/lib/bundled-file.ts`）；修改根快照后要重新启动 dev 或重新 build/deploy。
- 根 `.env.local` 继续作为本机配置。Web 命令在启动前通过 `--import ./scripts/load-env.mjs` 复用现有 env loader 加载，线上使用平台注入的环境变量；内容脚本继续使用现有本机 env loader。凭据不复制到 apps/packages，也不进入 Git 或缓存输出。
- 本机 Ask 历史继续使用根 `var/ask-sessions/`，保留既有会话；线上仍使用 Supabase Storage。部署产物只显式包含两份公开 SQLite 与 OG 字体（`apps/web/scripts/bundle-server-assets.mjs`），私有数据、会话和 Smaug 目录不会进入产物。
- 内容脚本从自身路径计算仓库根目录，发布、队列、配置、Smaug 嵌套仓库仍使用原来的根目录位置。

## 缓存与 CI

- lint/typecheck/test 由 Turbo 根据工作区依赖排序，并复用本地缓存；根 `config/**`、TS7 入口、oxlint 配置参与失效判定。数据测试和 Web build 另外将两份根 SQLite 作为输入，确保仅更新归档也能触发构建。
- 根 Git 保护测试依赖 Git 状态，不缓存。Web build 已不再读取外部数据（页面在请求期 SSR，构建期无 Supabase/SQLite 读取），未来可在显式版本化输入后重新评估 build 缓存；当前保持关闭以缩小本次迁移面。
- 同步、归档、清理、数据库推送、部署等有副作用的命令直接通过 bun 执行，不使用 Turbo 缓存。
- 暂不开启远程缓存。Web `.output` 包含两份公开 SQLite 副本；不要把私有队列、原始资料或凭据加入任何缓存 outputs。
- GitHub Code quality 调用根类型检查、lint、单测，并构建一次后运行关键 Web E2E。`apps/web/scripts/ci-public-data.mjs` 只在 CI 启动，提供空新闻增量，配合已提交的公开 SQLite；不使用生产数据库或模型凭据。Ask 回归在浏览器拦截模型请求；失败保存 trace。原生工程保留各自操作系统和路径触发规则。
- 根 `tests/agent-environment.test.mjs` 随 `bun run test` 检查 `.claude/skills` 目录软链接与技能内容的唯一跟踪目录、核心导航文档的本地链接/路径、明确列出的 bun 命令以及 Bun 工件（`bun.lock` 存在、pnpm 工件不存在），避免机械性漂移。事实和领域语义仍需评审核对。每日动态工作流调用内容工具脚本，归档仍为根 `data/ai-news.sqlite`。

## Vercel

项目 Root Directory 改为 `apps/web`，开启构建时包含根目录之外的源文件（公共包、根配置和两份 SQLite）。`apps/web/vercel.json` 固定 Install Command 为 `bun install --frozen-lockfile`（整仓安装，Bun 的 isolated 布局不影响构建产物）；Build Command 使用 `bun run build`（此目录下为 Web 包脚本），不声明 Framework（Vercel 平台的 `VERCEL=1` 环境让 Nitro 自动选择 Vercel preset，产物为 `.output/`）。线上函数运行时仍由 `engines.node` 锁定为 Node 24.x。

`vite.config.ts` 的 nitro 插件经 routeRules 下发全站安全头与 `/images` 缓存；页面级 CDN 缓存由各路由的 `Cache-Control`（`s-maxage` + `stale-while-revalidate`，见 `apps/web/lib/page-cache.ts`）承担，替代原 Next ISR。`scripts/bundle-server-assets.mjs` 在构建后把两份公开 SQLite 与 OG 字体拷进 `.output/server/`，函数运行时经 `apps/web/lib/bundled-file.ts` 定位，不依赖函数 cwd。环境变量继续保存在现有 Vercel 项目中。

这是部署项目设置的迁移条件；在旧代码仍为默认分支时不要提前修改生产项目的 Root Directory。合并迁移与切换 Root Directory 需一并安排。本机可以通过 `bun run build` 和 `bun run --filter @site/web start` 验证迁移后的完整应用；首次 Vercel 部署后需验证页面缓存头（`Cache-Control` MISS→HIT）与 `/api` 契约。
