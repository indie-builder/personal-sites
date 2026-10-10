import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { Data, Effect, Schedule } from 'effect';

export class DownloadError extends Data.TaggedError('Download')<{
  readonly url: string;
  readonly cause: unknown;
}> {}

export const defaultRetrySchedule = Schedule.exponential(1000, 2).pipe(Schedule.upTo({ times: 2 }));

export function downloadTarball(
  url: string,
  target: string,
  {
    timeoutMs = 10 * 60 * 1000,
    schedule = defaultRetrySchedule,
  }: { timeoutMs?: number; schedule?: typeof defaultRetrySchedule } = {},
) {
  const tmpPath = `${target}.part`;
  const attempt = Effect.scoped(
    Effect.gen(function* () {
      const resource = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const controller = new AbortController();
          const transfer = (async () => {
            const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
            const response = await fetch(url, { redirect: 'follow', signal });
            if (!response.ok || !response.body) {
              await response.body?.cancel();
              throw new Error(`HTTP ${response.status}`);
            }
            // fetch 的全局 ReadableStream 与 node:stream/web 声明存在泛型方差差异，桥接为节点类型。
            const body = response.body as unknown as NodeWebReadableStream<Uint8Array>;
            await pipeline(Readable.fromWeb(body), createWriteStream(tmpPath), { signal });
          })();
          return { controller, transfer };
        }),
        ({ controller, transfer }) =>
          Effect.tryPromise({
            try: async () => {
              controller.abort();
              // 等待被取消的传输释放文件句柄，再删除临时文件，避免和下一次尝试竞争。
              await Promise.allSettled([transfer]);
              await rm(tmpPath, { force: true });
            },
            catch: (cause) => new DownloadError({ url, cause }),
          }).pipe(Effect.orDie),
      );
      yield* Effect.tryPromise({
        try: () => resource.transfer,
        catch: (cause) => new DownloadError({ url, cause }),
      });
      yield* Effect.tryPromise({
        try: () => rename(tmpPath, target),
        catch: (cause) => new DownloadError({ url, cause }),
      });
    }),
  );
  return attempt.pipe(Effect.retry(schedule));
}
