# pnpm / Turborepo 工作区

| 目录 | 包名 | 所有权 |
| --- | --- | --- |
| `apps/web` | `@site/web` | Next.js 页面、API、组件、Web 单测与 Playwright |
| `tools/content` | `@site/content` | 抓取、离线分析、同步、归档、向量索引与 Node 测试 |
| `packages/effect` | `@site/effect` | Effect I/O 错误边界与公共 Schema 基础约束 |
| `packages/public-data` | `@site/public-data` | 公开数据 schema、SQLite 工具、每日动态同步/归档、健康检查 |
| `scripts`、`config`、`tests` | 根工作区 | 仓库保护、TS7 入口、共享公开配置、Git/打包边界测试 |
| `android`、`ios` | 原生工程 | 保持 Gradle / Xcode 构建与各自 CI |

Web 和内容管道通过 `workspace:*` 依赖 `@site/public-data`，使用显式子路径导入。公共包不得反向引用 Web 或离线分析工具；`@site/effect` 只依赖 Effect，业务执行约定见 [Effect 开发规则](effect-architecture.md)；Pi、Transformers、sqlite-vec、bird 仅由内容管道持有。共同的智谱端点/模型默认值仍由根 `config/bigmodel.mjs` 提供，Pi 适配器归内容管道。

## 命令

```bash
pnpm install --frozen-lockfile
pnpm dev:domain                              # https://personal-site.localhost
pnpm dev                                     # 默认端口 Web 开发
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm --filter @site/web exec vitest run tests/ai-news-hybrid.test.ts
pnpm --filter @site/content test
pnpm exec turbo run build test --dry=json     # 只看任务依赖，不运行任务
```

Web 源码直接位于 `apps/web/app/`、`apps/web/components/`、`apps/web/lib/`；内容工具位于 `tools/content/modules/`、`tools/content/lib/`、`tools/content/scripts/`。查找未知文件先从所属目录的 `rg --files` 定位；第三方依赖从实际消费它的 workspace 解析，不假定在根 `node_modules` 可见。

同一 `apps/web` 目录只运行一个 Next dev 实例，实时验证复用已有服务。Playwright 独占 7100 端口，`pnpm test:e2e` 默认自己构建并启动生产服务，这次成功构建可计入交付验证。若刚对同一份未变化源码执行过 `pnpm build`，可用 `PLAYWRIGHT_REUSE_BUILD=1 pnpm test:e2e` 只启动该产物；源码变化后重新构建。该开关不复用其他进程、不跳过测试，也不能在缺少生产产物时使用。

TS7 入口仍在 `scripts/tsc7.mjs`；lint 使用 oxlint，不改 TypeScript 版本或既有 peer exceptions。数据操作命令例如 `pnpm ai-news:archive`、`pnpm curation:sync`、`pnpm github:starred:daily` 保留在根目录，转发给内容管道；它们会访问或写入真实数据，不是验证命令，不挂到 Turbo 的 build/test 依赖中。

## 数据与环境变量

- 根 `data/curation.sqlite` 和 `data/ai-news.sqlite` 是唯一提交的公开快照。`apps/web/scripts/prepare-data.mjs` 在 dev/build/test 前将这两个明确列出的文件复制到被忽略的 `apps/web/data/`，缺少任一文件就失败。不会递归复制 `data/`，也不会打包敏感目录。
- Web 运行时只读自己的 `data/` 副本；修改根快照后要重新启动 dev 或重新 build/deploy。
- 根 `.env.local` 继续作为本机配置。Web 命令在 Next 启动前通过 `--import ./scripts/load-env.mjs` 复用现有 env loader 加载，线上使用平台注入的环境变量；内容脚本继续使用现有本机 env loader。凭据不复制到 apps/packages，也不进入 Git 或缓存输出。
- 本机 Ask 历史继续使用根 `var/ask-sessions/`，保留既有会话；线上仍使用 Supabase Storage。函数追踪显式排除私有数据、会话和 Smaug 目录。
- 内容脚本从自身路径计算仓库根目录，发布、队列、配置、Smaug 嵌套仓库仍使用原来的根目录位置。

## 缓存与 CI

- lint/typecheck/test 由 Turbo 根据工作区依赖排序，并复用本地缓存；根 `config/**`、TS7 入口、oxlint 配置参与失效判定。数据测试和 Web build 另外将两份根 SQLite 作为输入，确保仅更新归档也能触发构建。
- 根 Git 保护测试依赖 Git 状态，不缓存。Web build 会预渲染来自 Supabase 的 Sitemap，外部数据变化不体现在 Git，因此 build 关闭缓存。只有消除或显式版本化外部构建输入后才能开启。
- 同步、归档、清理、数据库推送、部署等有副作用的命令直接通过 pnpm 执行，不使用 Turbo 缓存。
- 暂不开启远程缓存。Web `.next` 可能包含构建时读取的外部内容；不要把私有队列、原始资料或凭据加入任何缓存 outputs。
- GitHub Code quality 调用根类型检查、lint、单测，并构建一次后运行关键 Web E2E。`apps/web/scripts/ci-public-data.mjs` 只在 CI 启动，提供空新闻增量，配合已提交的公开 SQLite；不使用生产数据库或模型凭据。Ask 回归在浏览器拦截模型请求；失败保存 trace。原生工程保留各自操作系统和路径触发规则。
- 根 `tests/agent-environment.test.mjs` 随 `pnpm test` 检查已跟踪技能的相对软链接、核心导航文档的本地链接/路径及明确列出的 pnpm 命令，避免机械性漂移。事实和领域语义仍需评审核对。每日动态工作流调用内容工具脚本，归档仍为根 `data/ai-news.sqlite`。

## Vercel

项目 Root Directory 改为 `apps/web`，开启构建时包含根目录之外的源文件（公共包、根配置和两份 SQLite）。`apps/web/vercel.json` 固定 Install Command 为 `pnpm install --frozen-lockfile --filter @site/web...`，避免安装离线分析依赖；Build Command 使用 `pnpm build`（此目录下为 Web 包脚本），Framework 仍是 Next.js，Output Directory 使用默认 `.next`。

`next.config.ts` 的 `outputFileTracingRoot` 和 `turbopack.root` 指向仓库根；函数的显式数据追踪只包含 Web 自己的两个 SQLite 副本。移除此前可能设置的根级构建/输出覆盖。环境变量继续保存在现有 Vercel 项目中。

这是部署项目设置的迁移条件；在旧代码仍为默认分支时不要提前修改生产项目的 Root Directory。合并迁移与切换 Root Directory 需一并安排。本机可以通过 `pnpm build` 和 `pnpm --filter @site/web start` 验证迁移后的完整应用。
