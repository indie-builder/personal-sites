# X 同步与本地 SQLite

`tools/content/modules/x-sync/` 包含 X 抓取/导入后的编排、链接取证、模型提示和公开 SQLite 投影；`tools/content/scripts/x-curation-enrich.mjs` 只负责本地队列、模型调用与落盘。本机仍保留原始抓取文件、策展队列和生成后的 JSON，全部位于被 Git 忽略的 `data/sensitive/x-curation/`。

同步后的职责如下：

| 数据 | 本地 | Git | 网站读取 |
| --- | --- | --- | --- |
| 原始 X 抓取与完整队列 | `data/sensitive/x-curation/` | 禁止 | 否 |
| Pi/智谱 GLM 或 Codex CLI 生成结果 | `data/sensitive/x-curation/` | 禁止 | 否 |
| 已完成解析且已公开的统一每日关注内容 | `data/curation.sqlite` | 提交 | 是 |

## 配置

X 数据解析默认经 Pi 运行时直连智谱，需在被 Git 忽略的 `.env.local` 中配置：

```bash
BIGMODEL_API_KEY=<bigmodel-key>
```

`data/curation.sqlite` 只能由本机 `tools/content/scripts/build-curation-sqlite.mjs` 通过 `better-sqlite3` 从 X 策展队列与已批准的抖音待审队列生成。它是只读公开投影，不包含抓取快照、视频、转写、游标或凭据；Vercel 在部署中随 Git 文件读取，运行时不写入它。

抓取后的分析采用可版本化阶段：确定性事实提取、视觉理解、策展解析与设计分类分别记录状态、输入 hash、模型和版本。事实层不调用模型；视觉 OCR/场景、隐藏检索信号与编辑结果写回私有队列，公开投影只携带可公开的派生字段。相同媒体输入在条目内重跑时会复用已持久化的视觉事实。

私有队列与生成备份使用临时文件原子替换，进程中止不会截断现有 JSON。如果队列本身已经丢失或损坏，可在确认公开生成备份与原始证据完整后执行 `pnpm curation:recover -- --force` 重建；恢复命令默认拒绝覆盖非空队列。

## 初始化与同步

两类同步使用同一套 X 抓取、敏感备份和 SQLite 发布流程，仅解析引擎不同；Pi / 智谱 GLM 是默认引擎，CLI 为显式选项：

```bash
# 默认 Pi / 智谱 GLM（15 并发）
pnpm curation:sync

# 同一智谱路径的显式快捷命令
pnpm curation:sync:glm

# 只补“已有策展、缺少设计判断”的历史条目，不改写原解析
pnpm curation:classify-design

# 分批刷新旧条目的新版检索信号与视觉事实
pnpm curation:enrich -- --refresh --limit 20
```

同步命令可以在 `--` 后继续传 `--source`、`--limit`、`--design-concurrency` 或 `--no-media` 等公共参数，例如 `pnpm curation:sync -- --source bookmarks --limit 20`。媒体元数据默认抓取，供设计分类与站内视频播放使用；Codex 的历史设计回填默认使用已验证的 40 并发，可通过 `--design-concurrency` 降档。

1. 执行其中一个同步命令：抓取媒体与正文 → 为新条目生成完整策展及设计分类 → 只为已有解析但缺分类的历史条目补设计判断 → 本地敏感生成备份 → 生成 `data/curation.sqlite`。历史补分类不会重写已有标题、摘要、标签或深度解析。底层仍保留 `--engine codex-cli|pi`，用于显式切换解析引擎。
2. 只暂存 `data/curation.sqlite` 与本次明确的代码/文档变更，运行 `pnpm git:safety` 后提交并推送；Vercel 的 Git 集成会创建新部署。
3. `pnpm curation:publish` 只重建 SQLite，不会访问远端数据库；结束时固定报告设计收录、排除、未分类及可播放视频数量。

全量策展、项目档案和 GitHub Star 三个公开 SQLite 写入口共享压实规则：空闲页达到 32 页时才执行 `VACUUM`，减少 Git 二进制与部署体积，同时避免每次微小更新都重写数据库。

每次生成策展内容时还会在私有目录写入 `data/sensitive/x-curation/generated/insights.json` 与便于人工阅读的 `insights.md`，包含数据健康度、来源分布、高频概念、工具、近期上升主题与 taxonomy 建议。按内容摘要去重的历史快照保存在 `generated/insight-snapshots/`；这些文件都不会进入 Git 或网站运行时。

前端只在 Node.js 服务端从 SQLite 读取，绝不向浏览器暴露数据库文件。`apps/web/next.config.ts` 的输出文件追踪会将它随每个函数部署；Edge Runtime 不支持这一读取路径。

`ask_documents` 同时维护 SQLite FTS5 索引；搜索文本包含标题、正文、引用、确定性事实、工具、语义检索信号和视觉 OCR。运行时优先使用 FTS5 排序，异常或短查询继续使用进程内子字符串评分。

## 设计相关性分类

每日关注沿用 `tags` 做主题筛选，菜单计数来自全库 X 公开投影，API 通过 `tag` 参数在分页前筛选。「提示词」优先收录可复用 Prompt、系统/角色提示词、图像/视频配方、提示词合集和编写优化方法；仅在工具或框架介绍中顺带提到 Prompt 不算。模型解析词表与分类说明同时包含这一口径。历史条目依据已公开的正文、引用和视觉事实补标，只增加标签并保留原有主题；标签同时写回本机队列，以免下次发布丢失。数据库随部署更新。

「技能」专指 AI Agent Skills，包括具体技能、技能合集、SKILL.md 编写，以及技能发现、安装、管理、评估与安全。仅顺带提到框架支持 Skills 或一般职业/游戏技能不收录；同时分享提示词的技能可有多个标签。

提示词根据现有公开内容按用途细分：视频制作、软件工程、图像创作、写作、学习、研究、通用助手，对应「视频提示词」「软件工程提示词」「图像提示词」「写作提示词」「学习提示词」「研究提示词」「助手提示词」。代码生成视频按视频用途归类，附带视频的编码教程按软件工程用途归类；纯生图与视频配方分开，通用聊天整理和角色指令也不因使用 Codex 而被划入软件工程。确有多种用途的具体提示词或资源时可交叉归类，证据不足时保留总类，不猜测。

每个用途子类同时保留「提示词」总标签；词表中除总类外以「提示词」结尾的主题都视为用途子类。新解析最多保留四个标签，归一化时优先保留总类、子类与「技能」。菜单将总类、用途子类和技能置顶，其他主题按数量排列。历史补标基于已公开证据写回本机队列及生成备份，重建公开 SQLite 与 Ask 索引。

模型解析每条 X 内容时，同时读取原文、引用、展开后的外链正文，以及最多 5 张图片或视频代表帧。视频帧只写入系统临时目录，判断结束立即删除；原视频、抽帧和私有队列都不会进入公开 SQLite。

分类输出包含 `relevant`、`confidence`、设计子类、证据和理由，由本地代码统一决策：模型判断为相关的内容直接进入 `/design`，判断为不相关的直接排除，不存在人工复核的中间状态；`confidence` 只作为模型自报信息留档。旧条目缺少分类时会在后续 `curation:enrich` / `curation:sync` 批次中重新解析，可用 `--limit` 分批回填。

## 迁移后的远端清理

旧 Supabase 的 X、策展与 Ask 表已经通过收敛迁移删除；当前流程不会再创建或写入这些结构。
