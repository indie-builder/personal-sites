# 技术栈维护 SOP

目标是保持技术栈受支持、可验证、可回退。没有值得升级的项也算完成；不以全部依赖追到 `latest` 为目标。具体版本从仓库和官方发布源实时核对，不在本 SOP 固定。

## 触发与范围

项目 Skill 源文件为 `.agents/skills/maintain-stack/SKILL.md`，Claude Code 通过 `.claude/skills/maintain-stack` 相对链接发现它。

| 输入 | 行为 |
| --- | --- |
| `/maintain-stack` | 盘点全项目，执行适合的常规维护，验证后创建 PR 并按授权合并 |
| `/maintain-stack check` | 只读核查，输出候选和风险；不安装、改锁文件、创建分支、提交、推送或合并 |
| `/maintain-stack web` | 只维护 Web、其依赖闭包及必要的根工具链 |
| `/maintain-stack android` / `ios` / `video` | 只维护对应端或独立工程 |
| `/maintain-stack check android` | 只读核查指定范围 |

范围支持 `web`、`android`、`ios`、`video`，可以组合；无范围为全项目，包含内容工具。只问“有哪些能升级”也按 check 处理。未知参数先澄清，不能悄悄转为全量执行。Claude Code 未发现新 Skill 时，在项目根重开会话；也可以明确要求 Agent 读取技能源文件执行。这个入口不配置定时任务。

## 授权与决策

本项目所有者在建立此流程时明确要求常规维护完成“核查 → 修改 → 验证 → PR → 检查通过后合并”；这是 `AGENTS.md` 所要求的明确合并授权在本流程内的具体适用范围。调用 `/maintain-stack` 执行模式沿用该授权，不需逐个 PR 重问。普通技术咨询、check 模式和其他任务不带合并授权；当次明确的只建 PR、不合并或撤销授权优先。不要将此约定带到其他仓库，也不要从其他人编辑的文件推断新的授权。

| 候选 | 默认动作 |
| --- | --- |
| 稳定补丁、兼容的小版本、安全修复 | 查明兼容要求后实施并验证 |
| 官方要求的局部工具链迁移 | 在现有功能和数据契约可保持、可验证时实施 |
| 主版本升级 | 阅读迁移指南并评估；改动局部且证据充分可按常规维护执行，否则提出方案 |
| 框架替换、数据迁移、公开接口语义变化 | 先明确收益和具体改动，由用户决定 |
| 新增费用、账户授权或扩大采集范围 | 由用户决定，不调用付费接口来试探权限 |
| 预发布版本、无修复版、兼容性未知 | 暂缓，记录原因及再次处理条件 |
| 检查失败、未完成或合并冲突 | 阻止合并，排查或报告具体阻塞，不绕过门禁 |

保留用户既有选择：X 采集暂时保留 bird，不能仅因弃用公告就切换付费 API 或停止采集。强推、直接推默认分支、历史重写、生产数据操作不属于本授权。

## 七步流程

### 1. 确认现场

- 读取根及相关目录的 `AGENTS.md`、平台 README；遵守当前项目约定。修改 Next / Turbo 前读取安装包内匹配版本的文档。
- 检查 `git status`、当前分支和相关 PR，记录既有未提交改动。只处理本轮路径，不提交其他任务的修改。
- 执行模式从最新主分支建立主题分支，或继续同一维护 PR。既有改动阻碍安全切换时，先处理不冲突的范围；不要自动 reset、clean、stash 或合并他人改动。
- check 模式不进行上述 Git 写操作。不要把本机已安装版本、锁文件版本和线上运行版本当成同一事实。

### 2. 完整盘点

核查以下层次，而非只运行一次 outdated：

- 根 Node / pnpm / Turbo / TypeScript / lint 工具链，以及所有 workspace 的声明与锁定依赖。
- Web 框架、组件、动画、数据、模型 SDK 和测试工具；内容管道及共享包依赖。
- Android 版本目录、Gradle wrapper、JDK / SDK；iOS 的 Xcode / Swift 编译器、语言模式和部署目标。
- 存在时检查 `video-promo/remotion` 等独立工程及独立锁文件。忽略目录内结果只能标为本地变更，不能强制加入仓库。
- 直接依赖、间接依赖、安全公告、弃用状态和相关 CI 工具。

JS 使用 `pnpm outdated --recursive --format json`、`pnpm audit --prod --json`、`pnpm audit --json` 辅助检查；独立工程从自己的目录运行。非零退出码可能表示发现告警，要解析结果；网络或解析失败应标为“未核实”，不能报全部最新。

优先查询官方 npm registry、Google Maven、Maven Central、运行时发布计划和官方迁移指南。区分稳定版、LTS、Current、RC / beta。证书或网络失败可以改用正常验证 TLS 的客户端；不关闭 TLS 验证。远端服务的实际运行版本未经访问验证时明确标为未知。

### 3. 判断收益

逐项给出当前版本、目标版本、来源、收益、兼容条件以及“升级 / 暂缓 / 替换评估”。

- 不能把所有包一起升级到 latest；匹配框架、插件、编译器和运行时的兼容矩阵。
- 安全公告同时记录依赖路径、生产或开发范围、影响条件及是否已有补丁；安装了受影响版本不等于已证明实际可利用。
- 优先使用正常依赖更新；上游范围无法解决时才加入最小、兼容的 override，并在后续核查是否仍需要。
- 已停止维护但无替代授权时记录风险，不破坏现有能力。运行时优先部署平台支持的 LTS。
- Node 运行时以部署平台当前支持的最大稳定 major 为上界（Vercel 以官方版本页为准：https://vercel.com/docs/functions/runtimes/node-js/node-js-versions ，具体版本以 manifest 与 README 记录为准），`engines.node` 保留实际所需最低版本并显式带 major 上界（如 `>=24.21.0 <25`），避免范围自动解析到新 major。上界调整按主版本升级规则单独评估，不得改成无界 `>=`、`latest` 或其他缺 major 上界的写法来自动跟进。

### 4. 最小实施

- 按兼容关系分组，保持每个 PR 可独立理解和回退。复用现有实现，不为升级引入并行业务 API、兼容层或新框架。
- 同步 manifest、锁文件及必要文档。已有生成物和安装目录先检查；不混用新旧包管理器依赖树，不保留两个互相矛盾的活动锁文件。
- 独立本地工程的修改与受版本控制的修改分别报告；不发布视频素材、原始数据或凭据。
- 不执行 curation、同步、回填、归档、清理、数据库发布来充当验证。相关边界见 [敏感数据说明](sensitive-data.md)。

### 5. 验证结果

应用代码或配置变更按根 `AGENTS.md` 运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`，并执行受影响端的验证。纯文档 / Skill 指令变更核对路径、链接、参数语义和 `git diff --check`，无需应用构建。

| 范围 | 额外验证 |
| --- | --- |
| 依赖与锁文件 | 验证冻结锁文件安装；检查实际解析版本和必要的原生构建脚本 |
| Web UI / 缓存 | 相关浏览器 e2e 回归（`pnpm test:e2e`）；用 ego lite 检查真实页面、编译问题和浏览器错误；缓存变更验证生产路由分类及 MISS / HIT |
| Android | 按 README 构建 Debug、运行 JVM 单测和仪器测试；核对实际 Kotlin / 插件版本 |
| iOS | 按 README 构建并运行相关测试；不把语言模式当编译器版本 |
| Remotion | 类型检查、Remotion 子包版本一致、实际渲染；渲染器 / 媒体处理升级比较帧数、音轨、节拍同步与已验收产物 |
| 内容工具 | 使用合成数据验证解析、分页、取消及失败保护；不读取私有源数据或运行真实采集 |

已有未提交改动可能影响验证，报告其边界。检查通过后不要无理由重复整套测试；修复了失败或追加相关改动后重跑相应检查。未运行、失败、跳过分别记录，不能用编译成功代替运行测试。

### 6. PR 与合并

- 审查完整 diff，运行 `git diff --check`、`pnpm git:safety`，只暂存本轮已审查路径。
- 按中文 Conventional Commits 提交，并使用执行 Agent 的实际模型署名。PR 描述写清问题、最终行为、验证和剩余限制。
- 本地工程不进入 Git；没有仓库变更时不要创建空 PR。用户只要 check 或只建 PR 时在对应边界停止。
- 等待 PR 对应提交的相关远程检查全部通过，不能只检查 required 子集后忽略其他失败。记录 head SHA；有新提交则重新验证。
- 有授权且检查通过时使用正常合并方式，并用 `--match-head-commit` 等机制绑定已验证提交。失败或冲突需要处理，不能使用 admin bypass、强推或直接写主分支。
- 长检查可后台等待，但“已启动等待/合并命令”不是“已合并”。完成通知后重新读取 PR 状态，确认 merge commit。

### 7. 合并后确认

确认 PR 已合并，检查相关主分支任务和部署结果；Web 部署需要确认发布成功及相关健康检查。只影响 Android 或文档时，说明相应产物和部署是否适用。远端暂不可访问时报告已合并与未验证部署两种状态，不伪造闭环。

回退优先 revert 本轮提交；本地独立工程保留可恢复的原版本信息或产物。数据迁移不是本流程默认动作，不能假定 revert 代码就能恢复数据。

## 结果模板

```text
本轮范围：实际检查的工程，以及未核实部分
完成升级：组件、旧版本 → 新版本、原因
验证结果：通过 / 失败 / 未运行及关键证据
交付状态：本地修改 / PR 待检查 / 已合并 / 部署已确认
遗留事项：影响、暂缓原因、再次处理的触发条件
回退方式：对应提交或本地产物
```

报告保持简洁，提供必要的文件或 PR 链接。版本检查失败、无补丁公告和停止维护的依赖都要保留在结果里。不要承诺会自动定期执行；需要持久调度时另行配置 GitHub Actions 等服务，复用本 SOP 的规则。

## 版本基线（2026-10-09）

README 只保留栈型概述。下表是当日核对的全量版本快照，仅作参考；维护时仍按本文流程从仓库与官方发布源实时核对，精确依赖以各工作区 `package.json`、`pnpm-lock.yaml` 和 `android/gradle/libs.versions.toml` 为准。

| 层 | 版本 |
| --- | --- |
| Web | Next.js 16.4.0（App Router）、React 19.3.0、Tailwind CSS 4.3.3、shadcn CLI 4.21.4 / `@shadcn/react` 0.3.1、Radix UI 1.7.0、Motion 14.0.0、Lucide 1.52.0；部署在 Vercel |
| 运行时与工程工具 | Node.js `>=24.21.0 <25`（LTS，Vercel 支持上限 24.x）、pnpm 12.10.1、TypeScript 7.0.2、Effect 4.0.1、Turbo 2.11.7、oxlint 1.87.0、Portless 0.15.7；测试使用 Vitest 5.0.3、Vite 8.3.3 与 Playwright 1.63.0 |
| 数据与 AI | Supabase JS 2.117.3、better-sqlite3 13.0.3、AI SDK 7.0.134 / Anthropic 4.0.77、Pi 1.0.4、Transformers.js 4.3.1、sqlite-vec 0.1.9 |
| 原生客户端（Android） | AGP 9.4.1、Gradle 9.8.1、Kotlin 2.4.21、Compose BOM 2026.09.00、compileSdk 37.1（minSdk 31，Android 12+）、JDK 17+ |
| 原生客户端（iOS） | Swift 6 语言模式、SwiftUI、iOS 26+，无第三方依赖 |

## 依赖审计遗留

2026-10-09 依赖审计剩余 2 项告警：

- `braces` 3.0.3 高危来自 shadcn CLI 的间接依赖，上游暂无修复版（[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，跟踪 [#73](https://github.com/indie-builder/personal-sites/issues/73)）。
- KaTeX 低危（[GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7)）正常依赖更新无法覆盖修复，跨版本 override 尚待兼容验证，跟踪 [#74](https://github.com/indie-builder/personal-sites/issues/74)。

另有两条运行时约束。Node.js 26.10.0 属 Current 发布线，待部署平台支持后再评估 major 上界升级。`@steipete/bird` 0.8.0 已停止维护且无新版，当前仅用于离线抓取工具，按既有授权保留。
