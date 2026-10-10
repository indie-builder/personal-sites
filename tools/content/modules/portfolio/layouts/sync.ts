#!/usr/bin/env node
/**
 * 同步上游 350-layout-compositions 的图片资产。
 * tarball 与解压目录可复用，已有非空 WebP 跳过。
 * 默认从 PNG 生成 720px / q82 缩略图，--with-images 另生成无损高清图。
 * corrections.json 修正上游 v2 图文错位，以 v1 补齐缺图；missing 条目保留。
 * 目录与修正表以本模块内的跟踪种子为准；上游 tarball 留在 data/sensitive。
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { Data, Effect } from 'effect';
import { OperationError, io } from '@site/effect';
/** 上游 catalog.json 单条记录（与上游字段保持一致）。 */
interface LayoutItem {
  id: string;
  name: string;
  category: string;
  category_slug: string;
  subcategory: string;
  subcategory_slug: string;
  image: string;
  thumbnail: string;
  width: number;
  height: number;
  sha256: string;
}
import { downloadTarball } from './download.ts';

class ConversionFailures extends Data.TaggedError('ConversionFailures')<{
  readonly count: number;
  readonly message: string;
}> {}

type Corrections = Record<string, { v2?: string; v1?: string; missing?: boolean }>;
type ConversionResult = 'converted' | 'skipped' | 'missing' | 'failed';
type Source = { image: string; sha256: string | null };

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '../../../..');

const execFileAsync = promisify(execFile);

export interface LayoutSyncOptions {
  /** catalog.json 与 corrections.json 所在目录；默认本模块的跟踪种子。 */
  seedDir?: string;
  /** tarball 与解压目录；默认 data/sensitive/portfolio/layout-compositions-upstream。 */
  upstreamDir?: string;
  /** WebP 输出根目录；默认 apps/web/public/layout-compositions。 */
  outBase?: string;
  withImages?: boolean;
  concurrency?: number;
}

function resolveSource(
  item: LayoutItem,
  corrections: Corrections,
  catalogById: Map<string, LayoutItem>,
) {
  return Effect.gen(function* () {
    const correction = corrections[item.id];
    if (!correction) return { image: item.image, sha256: item.sha256 } satisfies Source;
    if (correction.missing) return null;
    if (correction.v1) {
      return { image: path.join('images', `layout-${correction.v1}.png`), sha256: null };
    }
    const source = correction.v2 ? catalogById.get(correction.v2) : undefined;
    if (!source) {
      return yield* Effect.fail(
        new OperationError(
          'corrections',
          new Error(`corrections.json: ${item.id} 引用了不存在的文件 ${correction.v2}`),
        ),
      );
    }
    return { image: source.image, sha256: source.sha256 } satisfies Source;
  });
}

function sha256(filePath: string) {
  return Effect.scoped(
    Effect.gen(function* () {
      const stream = yield* Effect.acquireRelease(
        Effect.sync(() => createReadStream(filePath)),
        (stream) => Effect.sync(() => stream.destroy()),
      );
      return yield* io(`sha256:${filePath}`, async () => {
        const hash = createHash('sha256');
        for await (const chunk of stream) hash.update(chunk);
        return hash.digest('hex');
      });
    }),
  );
}

function writeWebp(srcImage: string, output: string, thumbnail: boolean) {
  const tmpPath = `${output}.part`;
  return Effect.scoped(
    Effect.gen(function* () {
      const resource = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const image = sharp(srcImage);
          if (thumbnail) image.resize({ width: 720 }).webp({ quality: 82 });
          else image.webp({ lossless: true });
          return { image, transfer: image.toFile(tmpPath) };
        }),
        ({ image, transfer }) =>
          io(`cleanup:${output}`, async () => {
            image.destroy();
            await Promise.allSettled([transfer]);
            await rm(tmpPath, { force: true });
          }).pipe(Effect.orDie),
      );
      yield* io(`webp:${output}`, () => resource.transfer);
      // 中断不会留下被“存在且非空”判定为已完成的截断图。
      yield* io(`rename:${output}`, () => rename(tmpPath, output));
    }),
  );
}

function convertOne(
  root: string,
  item: LayoutItem,
  corrections: Corrections,
  catalogById: Map<string, LayoutItem>,
  outBase: string,
  withImages: boolean,
): Effect.Effect<ConversionResult, OperationError> {
  return Effect.gen(function* () {
    const source = yield* resolveSource(item, corrections, catalogById);
    if (!source) return 'missing' as const;
    const imageOut = path.join(outBase, 'images', item.category_slug, `${item.id}.webp`);
    const thumbOut = path.join(outBase, 'thumbnails', item.category_slug, `${item.id}.webp`);
    const { imageDone, thumbDone } = yield* io(`stat:${item.id}`, async () => ({
      imageDone: !withImages || (existsSync(imageOut) && statSync(imageOut).size > 0),
      thumbDone: existsSync(thumbOut) && statSync(thumbOut).size > 0,
    }));
    if (imageDone && thumbDone) return 'skipped' as const;
    const srcImage = path.join(root, source.image);
    if (source.sha256) {
      const digest = yield* sha256(srcImage);
      if (digest !== source.sha256) {
        return yield* Effect.fail(
          new OperationError(
            `sha256:${item.id}`,
            new Error(`sha256 校验失败: ${item.id} ${item.name} (${digest} != ${source.sha256})`),
          ),
        );
      }
    }
    yield* io(`mkdir:${item.id}`, async () => {
      await mkdir(path.dirname(imageOut), { recursive: true });
      await mkdir(path.dirname(thumbOut), { recursive: true });
    });
    const jobs = [];
    if (!imageDone) jobs.push(writeWebp(srcImage, imageOut, false));
    // 缩略图从 PNG 缩放，避免再次压缩上游 JPG。
    if (!thumbDone) jobs.push(writeWebp(srcImage, thumbOut, true));
    yield* Effect.all(jobs, { concurrency: 2 });
    return 'converted' as const;
  });
}

const TARBALL_URL =
  'https://codeload.github.com/nevertoday/350-layout-compositions/tar.gz/refs/heads/main';

export function runLayoutSync(options: LayoutSyncOptions = {}) {
  const seedDir = options.seedDir ?? MODULE_DIR;
  const upstreamDir =
    options.upstreamDir ??
    path.join(REPO_ROOT, 'data/sensitive/portfolio/layout-compositions-upstream');
  const outBase = options.outBase ?? path.join(REPO_ROOT, 'apps/web/public/layout-compositions');
  const withImages = options.withImages ?? false;
  const concurrency = options.concurrency ?? 8;
  const tarballPath = path.join(upstreamDir, 'repo.tar.gz');
  const extractDir = path.join(upstreamDir, 'extracted');

  const prepareTarball = Effect.gen(function* () {
    const size = yield* io('stat:tarball', async () =>
      existsSync(tarballPath) ? statSync(tarballPath).size : 0,
    );
    if (size > 1024 * 1024) {
      console.log(`[sync] 复用已下载的 tarball (${(size / 1e6).toFixed(0)}MB)`);
      return;
    }
    yield* io('mkdir:upstream', () => mkdir(upstreamDir, { recursive: true }));
    console.log('[sync] 下载上游 tarball (~700MB) ...');
    yield* downloadTarball(TARBALL_URL, tarballPath);
    console.log('[sync] 下载完成');
  });

  const extractTarball = Effect.gen(function* () {
    const extracted = yield* io('stat:extracted', async () =>
      existsSync(extractDir) && readdirSync(extractDir).length > 0,
    );
    if (extracted) {
      console.log('[sync] 复用已解压的上游仓库');
      return;
    }
    yield* io('mkdir:extracted', () => mkdir(extractDir, { recursive: true }));
    console.log('[sync] 解压 tarball ...');
    yield* Effect.tryPromise({
      try: (signal) => execFileAsync('tar', ['-xzf', tarballPath, '-C', extractDir], { signal }),
      catch: (cause) =>
        new OperationError('tar', new Error(`解压失败: ${String(cause)}`)),
    });
    console.log('[sync] 解压完成');
  });

  return Effect.gen(function* () {
    const catalog = (yield* io('read:catalog', async () =>
      JSON.parse(await readFile(path.join(seedDir, 'catalog.json'), 'utf8')),
    )) as LayoutItem[];
    const corrections = (yield* io('read:corrections', async () =>
      JSON.parse(await readFile(path.join(seedDir, 'corrections.json'), 'utf8')),
    )) as Corrections;
    const catalogById = new Map(catalog.map((item) => [item.id, item]));
    yield* prepareTarball;
    yield* extractTarball;
    const root = yield* io('repoRoot', async () => {
      const entries = readdirSync(extractDir);
      const entry = entries[0];
      if (entries.length !== 1 || !entry) {
        throw new Error(`解压目录结构异常: ${entries.join(', ')}`);
      }
      return path.join(extractDir, entry);
    });
    console.log(`[sync] 共 ${catalog.length} 条，开始转换 (并发 ${concurrency})`);
    const counts: Record<ConversionResult, number> = {
      converted: 0,
      skipped: 0,
      missing: 0,
      failed: 0,
    };
    let done = 0;
    yield* Effect.all(
      catalog.map((item) =>
        Effect.gen(function* () {
          const result = yield* convertOne(
            root,
            item,
            corrections,
            catalogById,
            outBase,
            withImages,
          ).pipe(
            Effect.catchTag('OperationError', (error) =>
              Effect.sync(() => {
                console.warn(`[sync] 转换失败: ${item.id} ${item.name}: ${error.message}`);
                return 'failed' as const;
              }),
            ),
          );
          counts[result] += 1;
          done += 1;
          if (done % 40 === 0 || done === catalog.length) {
            console.log(`[sync] 进度 ${done}/${catalog.length}`);
          }
        }),
      ),
      { concurrency, discard: true },
    );
    console.log(
      `[sync] 完成: 新转换 ${counts.converted}，跳过 ${counts.skipped}，上游缺失 ${counts.missing}，失败 ${counts.failed}`,
    );
    if (Object.values(counts).reduce((sum, count) => sum + count, 0) !== catalog.length) {
      return yield* Effect.fail(new OperationError('count', new Error('条目数不匹配')));
    }
    if (counts.failed > 0) {
      return yield* Effect.fail(
        new ConversionFailures({ count: counts.failed, message: `${counts.failed} 条转换失败` }),
      );
    }
  });
}

const usage = `用法：node modules/portfolio/layouts/sync.ts [--with-images]
  --with-images  另生成无损高清图（默认只出 720px 缩略图）`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
  } else {
    const { runCli } = await import('@site/effect/cli');
    const unknown = args.filter((arg) => arg !== '--with-images');
    if (unknown.length > 0) {
      console.error(`未知参数：${unknown.join(' ')}\n${usage}`);
      process.exitCode = 2;
    } else {
      runCli(runLayoutSync({ withImages: args.includes('--with-images') })).catch((error) => {
        console.error(`布局图鉴同步失败：${error.message}`);
        process.exitCode = 1;
      });
    }
  }
}
