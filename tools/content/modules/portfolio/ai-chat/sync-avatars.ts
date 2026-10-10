#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { Data, Effect, Schema } from 'effect';
import { attempt, io } from '@site/effect';
import sharp from 'sharp';

class AvatarInputError extends Data.TaggedError('AvatarInput')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '../../../..');

const metadataSchema = Schema.Struct({
  images: Schema.Array(
    Schema.Union([
      Schema.Struct({
        file: Schema.optionalKey(Schema.Unknown),
        gender: Schema.optionalKey(Schema.Unknown),
      }),
      Schema.String,
      Schema.Number,
      Schema.Boolean,
      Schema.Array(Schema.Unknown),
    ]),
  ),
});
const genderSchema = Schema.Literals(['male', 'female']);
const genderMessage = 'Missing avatar gender metadata; no output was changed.';

export interface AvatarSyncOptions {
  /** 头像 WebP 输出目录；默认 apps/web/public/ai-chat/avatars。 */
  directory?: string;
  /** 头像清单写出路径；默认 apps/web/lib/portfolio/chat/avatars.json。 */
  manifest?: string;
}

export function runAvatarSync(archive: string | undefined, options: AvatarSyncOptions = {}) {
  const directory = options.directory ?? path.join(REPO_ROOT, 'apps/web/public/ai-chat/avatars');
  const manifest =
    options.manifest ?? path.join(REPO_ROOT, 'apps/web/lib/portfolio/chat/avatars.json');
  return Effect.gen(function* () {
    if (!archive) {
      return yield* Effect.fail(
        new AvatarInputError({
          message: 'Usage: pnpm portfolio:sync -- avatars -- /path/to/young-avatars-20.zip',
        }),
      );
    }
    const entries = yield* attempt('list', () =>
      execFileSync('unzip', ['-Z1', resolve(archive)], { encoding: 'utf8' })
        .split('\n')
        .filter((name) => /^young-avatars-20\/waker-young-\d{3}\.png$/.test(name))
        .sort(),
    );
    if (
      entries.length !== 20 ||
      entries.some((name, i) => !name.endsWith(`${String(i + 1).padStart(3, '0')}.png`))
    ) {
      return yield* Effect.fail(
        new AvatarInputError({
          message: 'Expected the 20 numbered avatar PNGs; no output was changed.',
        }),
      );
    }
    const metadataJson = yield* attempt('prompts', () =>
      JSON.parse(
        execFileSync('unzip', ['-p', resolve(archive), 'young-avatars-20/prompts.json'], {
          encoding: 'utf8',
        }),
      ),
    );
    const images = yield* Effect.try({
      try: () => {
        const metadata = Schema.decodeUnknownSync(metadataSchema)(metadataJson);
        const genders = new Map(
          metadata.images.map((image) => [
            Reflect.get(Object(image), 'file'),
            Reflect.get(Object(image), 'gender'),
          ]),
        );
        return entries.map((entry, index) => ({
          entry,
          id: index + 1,
          filename: `${String(index + 1).padStart(3, '0')}.webp`,
          gender: Schema.decodeUnknownSync(genderSchema)(genders.get(basename(entry))),
        }));
      },
      catch: (cause) => new AvatarInputError({ message: genderMessage, cause }),
    });
    if (!images.some((image) => image.gender === 'male')) {
      return yield* Effect.fail(new AvatarInputError({ message: genderMessage }));
    }
    yield* io('mkdir', () => mkdir(directory, { recursive: true }));
    const avatars = yield* Effect.all(
      images.map((image) =>
        Effect.gen(function* () {
          const destination = resolve(directory, image.filename);
          const source = yield* attempt(`unzip:${image.entry}`, () =>
            execFileSync('unzip', ['-p', resolve(archive), image.entry], {
              maxBuffer: 8 * 1024 * 1024,
            }),
          );
          yield* io(`webp:${image.filename}`, () =>
            sharp(source)
              .resize(192, 192, { fit: 'cover' })
              .webp({ quality: 90 })
              .withExif({
                IFD0: { ImageDescription: `User-provided ${basename(archive)} / ${image.entry}` },
              })
              .toFile(`${destination}.part`),
          );
          yield* io(`rename:${image.filename}`, () => rename(`${destination}.part`, destination));
          return {
            id: image.id,
            url: `/ai-chat/avatars/${image.filename}`,
            gender: image.gender,
          };
        }),
      ),
      { concurrency: 4 },
    );
    const temporaryManifest = `${manifest}.part`;
    yield* io('manifest:write', () =>
      writeFile(temporaryManifest, `${JSON.stringify(avatars, null, 2)}\n`),
    );
    yield* io('manifest:rename', () => rename(temporaryManifest, manifest));
    console.log(`Synced ${avatars.length} avatars (192px WebP).`);
  });
}

const usage = '用法：node modules/portfolio/ai-chat/sync-avatars.ts <young-avatars-20.zip>\n校验 20 张编号头像与性别元数据后，转 192px WebP 并写公开清单。';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [archive, ...rest] = process.argv.slice(2);
  if (archive === '--help' || archive === '-h') {
    console.log(usage);
  } else if (rest.length > 0) {
    console.error(`未知参数：${rest.join(' ')}\n${usage}`);
    process.exitCode = 2;
  } else {
    const { runCli } = await import('@site/effect/cli');
    runCli(runAvatarSync(archive)).catch((error) => {
      console.error(`AI 问答头像同步失败：${error.message}`);
      process.exitCode = 1;
    });
  }
}
