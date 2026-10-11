# 数据同步总览

面向维护者，汇总各内容来源的手动入口、定时调度与清理规则。数据操作直接访问或写入真实数据，不是验证命令，也不经过 Turbo 缓存；执行前先读 [敏感数据说明](sensitive-data.md)。

| 来源 | 手动入口 | 更新路径 |
| --- | --- | --- |
| 每日动态 | `pnpm ai-news:sync` / `pnpm ai-news:backfill` | 24 小时增量或 7 天回填，直接写 Supabase；[同步说明](ai-news-sync.md) |
| X 书签与点赞 | `pnpm curation:sync` | 抓取、解析、设计分类并重建本地公开 SQLite；[同步说明](supabase-x-sync.md) |
| 抖音收藏 | `pnpm douyin:sync`，然后 `pnpm curation:publish` | 发现、下载、转写/OCR、策展；成功入队的条目在重建 SQLite 后公开；[同步说明](douyin-curation.md) |
| GitHub Star | `pnpm github:starred:daily` | 增量检查、补齐中文阅读版并更新本地 SQLite；`github:starred:sync` 仅同步来源；[同步说明](github-starred-sync.md) |
| 作品集 | `pnpm portfolio:sync <来源>`，然后 `pnpm portfolio:project` | 本机工作数据生成公开 SQLite 与目录；媒体和视频制作见[作品集维护](portfolio.md) |

## 定时调度

- Supabase Cron 每 5 分钟触发每日动态增量同步（`POST /api/cron/ai-news`）。
- GitHub Actions 每天北京时间 04:17 回填 7 天（`.github/workflows/ai-news-sync.yml`）。
- GitHub Actions 每 15 分钟探测 `/api/health/data`，连续三次异常才使任务失败（`.github/workflows/data-health.yml`）。
- 本机另配置每天 03:00 的 Codex 自动化执行上述来源；该个人调度不在仓库内，克隆项目不会自动安装。

各来源的失败分别记录，不阻止其他来源继续运行。每日动态的租约、健康状态与本机 launchd 恢复手段见[每日动态同步说明](ai-news-sync.md)。

本机健康入口：`pnpm focus:status` 汇总同步状态、公开 SQLite 与 Ask 索引健康度；`pnpm health:production` 探测线上统一健康端点，失败时最多尝试三次。提交内容或配置前先跑 `pnpm git:safety` 检查敏感数据边界。

## 归档与云端清理

每日历史归档写入根 `data/ai-news.sqlite`，随 Git 合并与部署生效。对应的归档 PR 部署成功后，才允许清理对应的云端记录。
