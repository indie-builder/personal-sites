#!/usr/bin/env node
import { copyFile, mkdir, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { Effect } from 'effect';
import { io } from '@site/effect';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// 2026-09-09 截取自 https://default-coder.lovemyrmb.cn/ 的公开首页。
// 更换 assets/home.jpg 后重跑即可更新本地预览，不读取原项目私有数据。

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '../../../../..');

export interface SiteSyncOptions {
  /** 原始素材目录；默认 data/sensitive/portfolio/personal-sites。 */
  inputRoot?: string;
  /** 站点输出目录；默认 apps/web/public/personal-sites。 */
  output?: string;
}

export function runSiteSync(options: SiteSyncOptions = {}) {
  const inputRoot = options.inputRoot ?? path.join(REPO_ROOT, 'data/sensitive/portfolio/personal-sites');
  const output = options.output ?? path.join(REPO_ROOT, 'apps/web/public/personal-sites');
  const pages = Effect.all(
    ['home', 'news', 'curation', 'open-source'].map((name) =>
      io(`webp:${name}`, () =>
        sharp(path.join(inputRoot, 'assets', `${name}.jpg`))
          .resize({ width: name === 'home' ? 1080 : 1512, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(path.join(output, `${name}.webp`)),
      ),
    ),
    // 四页图片互不依赖，并行渲染。
    { concurrency: 4 },
  );

  return Effect.gen(function* () {
    yield* io('mkdir', () => mkdir(output, { recursive: true }));
    yield* pages;
    // Existing profile portrait from the user's personal website.
    yield* io('webp:profile-avatar', () =>
      sharp(path.join(inputRoot, 'assets/profile-avatar.png'))
        .resize(128, 128)
        .webp({ quality: 92 })
        .toFile(path.join(output, 'profile-avatar.webp')),
    );
    // 宣传片由 tools/content 的 portfolio:render 渲染到 promo-out；先渲染，再同步。
    yield* io('copy:promo.mp4', () =>
      copyFile(path.join(inputRoot, 'promo-out/promo.mp4'), path.join(output, 'promo.mp4')),
    );
    yield* io('webp:promo-poster', () =>
      sharp(path.join(inputRoot, 'promo-out/poster.png'))
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(path.join(output, 'promo-poster.webp')),
    );
    yield* Effect.all(
      ['walkthrough.mp4', 'timeline-avatar.webp', 'timeline-avatar-full.webp'].map((name) =>
        io(`rm:${name}`, () => rm(path.join(output, name), { force: true })),
      ),
      { concurrency: 'unbounded' },
    );
  });
}

const usage = '用法：node modules/portfolio/personal-sites/sync.ts\n把 data/sensitive/portfolio/personal-sites 的截图与宣传片产物发布到站点 public。';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
  } else if (args.length > 0) {
    console.error(`未知参数：${args.join(' ')}\n${usage}`);
    process.exitCode = 2;
  } else {
    const { runCli } = await import('@site/effect/cli');
    runCli(runSiteSync()).catch((error) => {
      console.error(`个人站点素材同步失败：${error.message}`);
      process.exitCode = 1;
    });
  }
}
