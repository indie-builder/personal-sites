# 每日动态同步与 Supabase

`packages/public-data/src/ai-news/` 是上游 AI 资讯聚合接口的同步模块。上游接口匿名只读、无需密钥；同步任务先写入 Supabase；昨日及以前的公开投影每日增量归档到 SQLite，随网站部署。网站不直接请求上游。

| 数据 | 本地 | Supabase | 网站读取 |
| --- | --- | --- | --- |
| 精选 + 24 小时全部动态的原始条目 | 无 | `public.ai_news_items`（RLS 私有表） | 否 |
| 页面展示用的公开投影 | `data/ai-news.sqlite` 永久历史归档 | `public.ai_news_public_items`（RLS 公开只读） | 是 |
| 同步 ETag、租约与健康状态 | 无 | `public.ai_news_sync_state`（仅 service role） | 否 |

公开投影只保留页面需要的字段（标题、摘要、推荐理由、分类、评分、来源名、发布时间、第三方原文链接）。没有第三方原文链接的条目不进入公开表，页面任何位置都不出现上游站点的链接或标识。

## 同步

1. 通过 `pnpm supabase:push` 应用 [迁移](../supabase/migrations/20260814130000_ai_news_storage.sql)（先 `--dry-run` 预演）。
2. 手动执行一次 `pnpm ai-news:sync`（增量）和 `pnpm ai-news:backfill`（7 天回填）验证。
3. 定时任务：
   - Supabase Cron 每 5 分钟通过 `pg_net` 调用 `POST /api/cron/ai-news`，执行 24h 增量同步。Bearer 密钥由迁移随机生成，明文只保存在 Supabase Vault；Vercel 接口读取私有状态表中的 SHA-256 摘要校验请求。
   - `.github/workflows/ai-news-sync.yml`：每天 20:17 UTC（北京时间 04:17）跑 7 天回填，并保留 `workflow_dispatch` 手动增量/回填入口。需在仓库 Actions Secrets 配置 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。
   - `/api/health/data` 的 `aiNews` 返回每日动态的最近成功时间和同步年龄；同一接口同时校验全部公开投影的新鲜度、Ask FTS 一致性与部署 Commit。
   - `askIndex.documents` 是全部文档数，`searchableDocuments` 是当前内容经生产 tokenizer（`unicode61 remove_diacritics 2`）分词后有词项的文档数，`fts` 是实际索引中有词项的文档数（含孤儿）。`missingFts` 统计可检索但无索引词项的文档，`orphanFts` 统计词项指向不存在的文档；`missingPostings` / `extraPostings` 比较词项、文档、列及位置，发现旧词项、部分索引和位置漂移。空文本或纯标点不要求有索引词项；没有词项的孤儿元数据不在此项检查范围内，文档总数为零仍不健康。
   - FTS 检查在同一事务快照内逐次重建 TEMP 预期索引并读取实际 `fts5vocab(instance)`，结束或失败后清理 TEMP；主库保持只读。每次检查的耗时与临时空间随总词项数增长，不缓存证据；连接须允许 TEMP 写入，不能设置 `PRAGMA query_only=ON`。检查不能完成时端点返回 503。
   - 统一公开健康端点只返回状态、计数、年龄、时间及部署版本等公开证据，不返回 `ai_news_sync_state.last_error` 的内部错误正文；本机 `pnpm focus:status` 仍可读取该信息排障。
   - `.github/workflows/data-health.yml` 每 15 分钟探测统一健康端点，连续三次异常才失败并触发 GitHub 通知。
   - 首页与每日动态页面动态渲染：读取部署内的 SQLite 历史，以及归档快照之后的 Supabase 增量；包含迟到记录与旧条目修订，按 id 去重并稳定排序。
   - ETag、4 分钟租约、最后成功/失败和统计统一保存在 `ai_news_sync_state`；Supabase Cron、GitHub Actions、手动 CLI 和本机 launchd 共享同一租约，重复触发会安全跳过。
   - 本机 launchd 只作为故障恢复手段（plist 模板在 `config/` 下，仓库内不含本机路径，安装前需替换占位符）：
     - `ai-news-sync.launchd.plist`：每 5 分钟跑增量（24h 窗口），日志 `var/ai-news/sync.log`；
     - `ai-news-backfill.launchd.plist`：每天 04:17 跑 7 天回填，日志 `var/ai-news/backfill.log`。

     ```bash
     # 先替换占位符：__NODE_BIN__ 为本机 node 所在目录（nvm 路径含版本号，Node 大版本升级后需更新），
     # __REPO_ROOT__ 为仓库绝对路径
     for f in config/ai-news-*.launchd.plist; do
       sed -e "s|__NODE_BIN__|$(dirname "$(command -v node)")|g" \
           -e "s|__REPO_ROOT__|$PWD|g" "$f" > ~/Library/LaunchAgents/"$(basename "$f")"
     done
     launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/site.personal.ai-news-sync.plist
     launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/site.personal.ai-news-backfill.plist
     # 卸载：launchctl bootout gui/$(id -u)/site.personal.ai-news-sync（backfill 同理）
     ```

## 行为约定

- 上游原生时间窗只有 24h 和 7d：增量同步用 24h 窗口（便宜），回填用 7d 窗口（全量分页，上限 60 页）；更早的历史上游不提供。
- 两个 feed：`mode=all`（全部动态）与 `mode=selected`（精选），按 all → selected 顺序处理，同 id 条目的 `selected` 标记以精选为准；selected feed 条件请求命中 304 时，同步会先读出当前精选 id 并在 upsert 后还原，避免被 all feed 的覆盖语义清掉。
- 增量同步带 `If-None-Match` 条件请求（ETag 存于私有状态表），无变化时跳过重写；回填不改写增量 ETag。
- 原始备份仍按内容时间保留 8 天。公开投影不再按年龄直接删除；只有已上线 SQLite 包含完全相同的公开内容，且记录超过 3 天，才可清理。
- 网站服务端通过 `apps/web/lib/ai-news.ts` 合并 SQLite 与 Supabase 增量：列表分页、详情、Ask 检索及 Sitemap 使用同一归档。Supabase 同 id 的新版本覆盖归档版本；详情确认无更新后使用 SQLite。

## 历史归档与发布

- `pnpm ai-news:archive`：只读 Supabase 公开投影，首次收集现有全部历史，之后 upsert 并保留之前归档。北京时间零点为截止时间，缺失发布时间时按同步时间判断。使用稳定 id 游标读完所有分页，校验公开字段与 SQLite 完整性后原子替换 `data/ai-news.sqlite`。不导出原始表、凭据或私有状态。
- 每次导出检查云端全部可归档数据，所以每日 7 天回填带来的修订和迟到数据也会进入归档。归档版本保存 `cutoff`、抓取开始时间 `capturedAt`、条数与 SHA-256 内容摘要。
- `data/ai-news.sqlite` 独立于 `data/curation.sqlite`；运行时只读，更新文件后必须重新部署。零点不会自动切换来源，查询以实际部署的归档版本为准。归档/发布失败时，公开数据继续留在 Supabase。
- 每日工作流先回填，再尝试清理上一版已部署归档，随后导出新归档并创建 topic 分支 PR。GitHub 需允许 Actions 创建 PR。遵循仓库规则，不自动合并或推送默认分支；PR 合并后由 Vercel Git 集成部署。归档 PR 应按顺序发布，避免旧快照覆盖新快照；尚未合并的 PR 不会授权清理。
- `pnpm ai-news:prune` 默认仅预演；`pnpm ai-news:prune -- --apply` 执行清理。脚本固定向生产域名 `/api/health/ai-news/archive` 获取实际部署摘要，和本地归档一致才继续。预览部署不能授权清理。
- 清理保留最近 72 小时。对更早的每条公开记录核对完整公开内容和精选标记，并用 `synced_at` 做条件删除，保护检查之后发生的新写入；对应原始行只删除不晚于该版本的副本。未归档或已修订条目留下待下一次归档。七天回填可能短暂重新写入旧记录，随后同一工作流的清理步骤移除已部署的相同版本。
- 回滚代码/数据时必须带上最新归档文件；旧部署不保证包含已清理的完整历史。Git 保存的已发布 SQLite 是历史恢复来源。

### 首次上线

1. 导出并提交首次归档，运行项目检查，走 PR 合并部署。
2. 核对生产 `/api/health/ai-news/archive` 的 `digest` 与本地一致。
3. 运行 `pnpm ai-news:prune` 查看可清理条数，再运行 `pnpm ai-news:prune -- --apply`。没有一致的线上归档时命令会拒绝删除。
4. 查看 Supabase 用量；减少行数不保证已分配磁盘立即缩小，也不代表出站流量一定低于免费额度。
