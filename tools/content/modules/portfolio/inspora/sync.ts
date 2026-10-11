#!/usr/bin/env node
/**
 * 灵感集同步入口 —— 一条管线适配三类数据源：
 *
 * - inspora：inspora.design（列表/详情走 RSC 抓取，需 Playwright，
 *   Vercel checkpoint 时回退 ego-browser），媒体只下缩略图/海报/头像。
 *   见 source-inspora.ts。
 * - bestx：Best Designs on X（bestdesignsonx.com，公开 Supabase REST +
 *   CDN 热链，无需浏览器、无本地媒体）。见 source-bestx.ts。
 * - collectui：Collect UI（collectui.com），复用公开 REST 管线，同一原作多行媒体合并。
 *
 * 各源互相独立：一个失败不影响其他源写入；同一原作（X 推文）读取侧仅保留一份。
 *
 * 用法：
 *   sync.ts                      # 三个源都增量（日常）
 *   sync.ts --full               # 三个源全量 backfill（首次）
 *   sync.ts --source=collectui   # 只跑一个源（inspora | bestx | collectui）
 *   sync.ts --max-pages N        # inspora 分类翻页上限（调试）
 */
import { mkdir } from 'node:fs/promises';
import { Data, Effect, Result } from 'effect';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase, withTransaction, database, databaseError, type Db } from './db.ts';
import { syncInspora } from './source-inspora.ts';
import { syncBestx, tweetIdOf } from './source-bestx.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
// 原始工作库留在 data/sensitive/portfolio；公开产物由 project.mjs 另行发布。
const DEFAULT_DB_PATH = path.join(REPO_ROOT, 'data/sensitive/portfolio/inspora.db');
const SOURCES = ['inspora', 'bestx', 'collectui'] as const;
type SourceName = (typeof SOURCES)[number];

class SyncError extends Data.TaggedError('Sync')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** 老的 inspora 行详情补全时才会写 tweet_id；每次同步前从 source_url 直接补齐，跨源去重才能覆盖存量 */
function backfillTweetIds(db: Db['db']) {
  return Effect.gen(function* () {
    const rows = yield* database(
      () =>
        db
          .prepare(
            "SELECT id, source_url FROM posts WHERE source = 'inspora' AND tweet_id IS NULL AND source_url LIKE '%/status/%'",
          )
          .all() as { id: string; source_url: string }[],
    );
    const update = yield* database(() => db.prepare('UPDATE posts SET tweet_id = ? WHERE id = ?'));
    yield* Effect.tryPromise({
      try: () =>
        withTransaction(db, () => {
          for (const row of rows) {
            const tweetId = tweetIdOf(row.source_url);
            if (tweetId) update.run(tweetId, row.id);
          }
        }),
      catch: (cause) => databaseError(cause),
    });
    if (rows.length > 0) console.log(`已回填 ${rows.length} 条 inspora 行的原作推文 id`);
  });
}

export interface InsporaSyncOptions {
  full?: boolean;
  maxPages?: number;
  only?: SourceName | null;
  /** 原始工作库路径；默认 data/sensitive/portfolio/inspora.db。 */
  dbPath?: string;
}

export function runInsporaSync(options: InsporaSyncOptions = {}) {
  const full = options.full ?? false;
  const maxPages = options.maxPages ?? Infinity;
  const only = options.only ?? null;
  const dbPath = options.dbPath ?? DEFAULT_DB_PATH;
  const sources = [
    { name: 'bestx', run: ({ db, stmts }: Db) => syncBestx({ db, stmts, full }) },
    {
      name: 'collectui',
      run: ({ db, stmts }: Db) => syncBestx({ db, stmts, full, source: 'collectui' }),
    },
    {
      name: 'inspora',
      run: ({ db, stmts }: Db) => syncInspora({ db, stmts, full, maxPages }),
    },
  ].filter((source) => !only || source.name === only);

  return Effect.gen(function* () {
    if (only && !SOURCES.includes(only)) {
      console.error(`未知来源: ${only}（可选 inspora | bestx | collectui）`);
      process.exitCode = 2;
      return;
    }
    // 全新 checkout 时 data/sensitive/portfolio 可能不存在，先建父目录再开库。
    yield* Effect.promise(() => mkdir(path.dirname(dbPath), { recursive: true }));
    const { db, stmts } = yield* Effect.acquireRelease(
      database(() => openDatabase(dbPath)),
      ({ db }) => Effect.sync(() => db.close()),
    );
    yield* backfillTweetIds(db);
    const results = yield* Effect.all(
      sources.map((source) =>
        Effect.gen(function* () {
          console.log(`\n=== 同步源 ${source.name} ===`);
          const result = yield* source.run({ db, stmts });
          console.log(`${source.name} 完成:`, JSON.stringify(result));
          return source.name;
        }).pipe(
          Effect.mapError(
            (error) =>
              new SyncError({ message: `${source.name} 失败: ${error.message}`, cause: error }),
          ),
          Effect.tapError((error) => Effect.sync(() => console.error(error.message))),
        ),
      ),
      { concurrency: 1, mode: 'result' },
    );
    const failed = results.flatMap((result, index) =>
      Result.isFailure(result) ? [sources[index]!.name] : [],
    );
    const total = yield* database(() =>
      db.prepare('SELECT source, COUNT(*) AS c FROM posts GROUP BY source').all(),
    );
    const totalMedia = yield* database(() => db.prepare('SELECT COUNT(*) AS c FROM media').get()!.c);
    console.log(`\n完成。posts=${JSON.stringify(total)} media=${totalMedia}`);
    if (failed.length > 0) {
      return yield* Effect.fail(
        new SyncError({ message: `以下来源未同步成功，下次运行会继续: ${failed.join(', ')}` }),
      );
    }
  }).pipe(Effect.scoped);
}

const usage = `用法：node modules/portfolio/inspora/sync.ts [--full] [--source=<inspora|bestx|collectui>] [--max-pages N] [--db <path>]
  --db  原始工作库路径（默认 data/sensitive/portfolio/inspora.db）`;

interface InsporaArgs {
  full: boolean;
  maxPages: number;
  only: SourceName | null;
  dbPath?: string;
  error?: string;
}

function parseArgs(args: string[]): InsporaArgs {
  const parsed: InsporaArgs = { full: false, maxPages: Infinity, only: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--full') parsed.full = true;
    else if (arg.startsWith('--source=')) parsed.only = arg.split('=')[1] as SourceName;
    else if (arg === '--max-pages') {
      const value = Number(args[index + 1]);
      if (!/^\d+$/u.test(args[index + 1] ?? '') || value < 1) {
        return { ...parsed, error: '--max-pages 需要一个正整数。' };
      }
      parsed.maxPages = value;
      index += 1;
    } else if (arg === '--db') {
      if (!args[index + 1] || args[index + 1]!.startsWith('--')) {
        return { ...parsed, error: '--db 需要一个路径。' };
      }
      parsed.dbPath = args[index + 1];
      index += 1;
    } else return { ...parsed, error: `未知参数：${arg}` };
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
  } else {
    const parsed = parseArgs(args);
    if (parsed.error) {
      console.error(`${parsed.error}\n${usage}`);
      process.exitCode = 2;
    } else {
      const { runCli } = await import('@site/effect/cli');
      runCli(
        runInsporaSync({
          full: parsed.full,
          maxPages: parsed.maxPages,
          only: parsed.only,
          dbPath: parsed.dbPath,
        }),
      ).catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    }
  }
}
