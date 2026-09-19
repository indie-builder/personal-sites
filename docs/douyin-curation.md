# 抖音收藏接入每日关注

抖音只作为关注来源。原始视频、转写、OCR 与模型结果保存在本机敏感层；条目在 sync 成功后直接入队，运行 `pnpm curation:publish` 后写入 `data/curation.sqlite`，并同步成为"问一问"的公开检索资料。队列里的条目没有人工审核门禁，全部可用于发布。

模型证据边界：抖音条目只用语音转写与屏幕文字 OCR 的文本通道，关键帧只作为私有证据留存，不进入模型。转写或 OCR 过长时按时间截断，并在提示词中声明模型实际可见的覆盖范围。

## 准备输入

使用 [`jiji262/douyin-downloader`](https://github.com/jiji262/douyin-downloader) 下载当前账号收藏。配置至少开启视频下载；建议同时开启 JSON 和 SQLite 去重。Cookie 只保存在本机，不进入本仓库。

输出目录根部应包含 `download_manifest.jsonl`。每条视频的 `file_paths` 必须能定位到本地视频文件。

## 视频转写

项目固定调用 `mcp-video-analyzer@0.10.0`。它会优先复用视频旁的 `.vtt`/`.srt`，否则按以下顺序寻找转写能力：

1. `WHISPER_HF_MODEL` 指定的本地 JS 模型；
2. `whisper` CLI（`pip install -U openai-whisper`）；
3. `OPENAI_API_KEY` 对应的转写接口。

中文视频建议使用本地 Whisper `small` 或 `medium`：

```bash
export WHISPER_MODEL=small
```

语言参数不全局固定（部分收藏是英文内容，固定 `zh` 会误伤）。Whisper 自动检测在音乐多、口播少的短视频上可能误判，导致转写为空；这类条目会进失败清单，单独重跑时可临时加 `WHISPER_LANGUAGE=zh`（见"常见故障与恢复"）。

## 同步与发布

先用 dry-run 看清待处理集，不读取视频、不调用模型、不落盘：

```bash
pnpm douyin:curation -- sync --dry-run
pnpm douyin:curation -- sync \
  --manifest /绝对路径/Downloaded/download_manifest.jsonl \
  --dry-run --limit 5
```

正式同步（`--limit` 优先取收藏顺序最靠前的最新收藏，而不是清单文件顺序）：

```bash
pnpm douyin:curation -- sync \
  --manifest /绝对路径/Downloaded/download_manifest.jsonl \
  --limit 5
```

默认 `pi` 引擎使用统一的智谱 Anthropic 端点与 `BIGMODEL_API_KEY`，模型取 `BIGMODEL_MODEL`（默认 `glm-5.3-flash`），不再依赖旧供应商账号。`zcode` 和 Codex CLI 仅在显式选择时使用各自的本机 CLI 配置：

```bash
pnpm douyin:curation -- sync \
  --manifest /绝对路径/Downloaded/download_manifest.jsonl \
  --limit 5 \
  --engine pi
```

条目生成成功后即入队；运行 `pnpm curation:publish` 重建公开投影。模型返回的 tags 会被分类白名单（`config/douyin-curation.json` 的 `taxonomy`）归一化，完全对不上的条目按失败处理；JSON 解析失败会先做一次"修复为 JSON"的廉价重试，不重新分析视频。

`sync` 可重复运行，已处理条目默认跳过；需要重新分析时加 `--force`。`--refresh-only` 不需要 manifest：不读取视频、不调用模型，只回填收藏顺序。每次运行结束时打印成功/失败计数和按原因聚合的失败摘要；失败明细保存在 `analysis-failures.json`。

## 全量发现与增量检查点

本机 sidecar 安装完成后，由 `scripts/douyin-favorites-discover.py` 通过已登录收藏页滚动建立私有索引。它不会输出标题、Cookie 或收藏正文，只输出数量统计，并生成：

- `favorite-index.json`：当前完整收藏索引与首次/最近发现时间；
- `pending-video-urls.json`：尚未出现在下载 manifest 中的视频；
- `config-incremental.yml`：只包含本次待下载视频的 sidecar 配置。

下载 manifest、分析 raw 目录和自动批准队列分别充当下载、视频理解和策展阶段的检查点；任一阶段中断后都从尚未完成的条目继续。收藏页的显示顺序会写入公开投影，最新点赞始终排在最前。

完整的全量/增量入口是：

```bash
pnpm douyin:sync
```

它每次都会重新发现收藏页，只下载 manifest 中不存在的视频，再只解析自动批准队列中尚未完成的条目。并发默认值以 `douyin:curation` 的引擎感知配置为唯一来源（zcode 8、pi 2、codex-cli 20），本地 Whisper/OCR 6 并发提取证据；每个本地转写进程限制约 2 个 CPU 线程。`--analyze-limit 20` 控制单次批量，`--discover-only` 只刷新收藏索引，`--dry-run` 只报告两阶段的待处理量（不启动 sidecar、不下载、不调用模型）。

## 发布与抽检

```bash
pnpm curation:publish && pnpm focus:status
```

- `pnpm focus:status` 输出每日关注 X/抖音条目数、Ask 索引与 SQLite 健康状态，作为同步后的固定验收步骤。
- 发布即上线，不设审核门禁；可选地抽读最近发布条目核对标题、摘要与摘录是否忠于原视频，失真条目从队列删除后按 `--force` 重跑或手工修正，不影响其余条目。
- 发布脚本会列出跨来源（X/抖音）疑似重复条目对，仅作提示，不影响发布；是否清理由发布者自行决定。
- 切换或升级分析引擎时，固定抽取 20 条同一批视频分别整理，对比成功率、单条耗时与抽检质量，再决定是否更换默认引擎。

## 常见故障与恢复

| 现象 | 原因 | 恢复 |
| --- | --- | --- |
| 探活失败：CLI 登录态/端点不可用 | `claude` 未登录或模型端点配置失效 | 重新完成 CLI 登录与端点配置，或 `--engine` 切换后重跑 |
| 转写为空，条目进失败清单 | 短视频口播少，语言自动检测误判 | 单独重跑该条并临时设置 `WHISPER_LANGUAGE=zh`（必要时先删除该视频旁的错误 `.vtt`/`.srt`） |
| 下载 0 条或触发风控 | Cookie 过期 | 在 sidecar 中重新登录后重跑 `pnpm douyin:sync` |
| 大量「模型返回缺少 …」失败 | 模型输出不稳定 | 直接重跑 sync，未完成条目会自动重试 |
| 中断后续跑 | — | 直接重跑即可；三个检查点保证只处理未完成条目 |

## 数据位置

| 数据 | 路径 | 公开 |
| --- | --- | --- |
| 分析 JSON、关键帧与时间线 | `data/sensitive/douyin-curation/raw/` | 否 |
| 队列条目与项目候选 | `data/sensitive/douyin-curation/review-queue.json` | 否 |
| 自动批准后的统一每日关注投影 | `data/curation.sqlite` | 是 |

实体候选不会自动写入"开源关注"；无法唯一核验的项目名继续保留在私有资料中。抖音条目解析完成后即入队，并在下一次 `pnpm curation:publish` 进入公开投影，其中提到的项目身份仍可能存在误差。
