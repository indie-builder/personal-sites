# 数据同步总览

面向维护者，汇总各内容来源的手动入口、定时调度与清理规则。数据操作直接访问或写入真实数据，不是验证命令，也不经过 Turbo 缓存；执行前先读 [敏感数据说明](sensitive-data.md)。

| 来源 | 手动入口 | 更新路径 |
| --- | --- | --- |
| 每日动态 | `bun run ai-news:sync` / `bun run ai-news:backfill` | 24 小时增量或 7 天回填，直接写 Supabase；[同步说明](ai-news-sync.md) |
| X 书签与点赞 | `bun run curation:sync` | 抓取、解析、设计分类并重建本地公开 SQLite；[同步说明](supabase-x-sync.md) |
| 抖音收藏 | `bun run douyin:sync`，然后 `bun run curation:publish` | 发现、下载、转写/OCR、策展；成功入队的条目在重建 SQLite 后公开；[同步说明](douyin-curation.md) |
| GitHub Star | `bun run github:starred:daily` | 增量检查、补齐中文阅读版并更新本地 SQLite；`github:starred:sync` 仅同步来源；[同步说明](github-starred-sync.md) |

## 定时调度

- Supabase Cron 每 5 分钟触发每日动态增量同步（`POST /api/cron/ai-news`）。
- GitHub Actions 每天北京时间 04:17 回填 7 天（`.github/workflows/ai-news-sync.yml`）。
- GitHub Actions 每 15 分钟探测 `/api/health/data`，连续三次异常才使任务失败（`.github/workflows/data-health.yml`）。
- 曾使用每天 03:00 的 Codex 自动化执行上述来源；2026-10-18 检查时，本机实时调度库已无该任务。它不在仓库内，不能把旧配置或历史执行记录当作正在生效的调度；恢复后需核实启用状态、下一次时间与实际运行结果。

各来源的失败分别记录，不阻止其他来源继续运行。每日动态的租约、健康状态与本机 launchd 恢复手段见[每日动态同步说明](ai-news-sync.md)。2026-10-18 的调度诊断、X 补同步及剩余限制见[X 同步恢复记录](x-sync-recovery.md)。

本机健康入口：`bun run focus:status` 汇总同步状态、公开 SQLite 与 Ask 索引健康度；`bun run health:production` 探测线上统一健康端点，失败时最多尝试三次。提交内容或配置前先跑 `bun run git:safety` 检查敏感数据边界。

`/api/health/data` 仅对 X 将内容新鲜度与同步结果分开：X 内容超过 72 小时产生 `freshness: "stale"` 提醒；抖音或 GitHub Star 内容超过 14 天仍判定不健康并返回 503。X 的 `sync` 来自公开 SQLite 中完整同步的真实运行记录，最近成功超过 72 小时、最新尝试失败、或无记录（`status: "unknown"`）仍返回 503；内容为空、SQLite/Ask 索引损坏、每日动态同步失败也继续返回 503。线上看到的是部署时的快照，重新同步后需提交并部署数据库才能更新该状态。

## 归档与云端清理

每日历史归档写入根 `data/ai-news.sqlite`，随 Git 合并与部署生效。对应的归档 PR 部署成功后，才允许清理对应的云端记录。
