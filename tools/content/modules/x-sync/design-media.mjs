import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";
import { io } from "@site/effect";

const execFileAsync = promisify(execFile);
const MAX_EVIDENCE_IMAGES = 5;

function frameTimes(durationMs) {
  return typeof durationMs === "number" && durationMs > 0
    ? [0.15, 0.5, 0.85].map((position) => Math.max(0, (durationMs / 1000) * position))
    : [0, 2, 5];
}

/** Evidence files remain available until the caller's Scope closes. */
export function collectDesignEvidenceImages(media, { execute = execFileAsync, temporaryDirectory = os.tmpdir() } = {}) {
  return Effect.gen(function* () {
    const directory = yield* Effect.acquireRelease(
      io("design.temp", () => mkdtemp(path.join(temporaryDirectory, "x-design-evidence-"))),
      (directory) => io("design.cleanup", () => rm(directory, { force: true, recursive: true })).pipe(Effect.orDie),
    );
    const imagePaths = [];
    const collect = (command, args, outputPath) =>
      io("design.extract", (signal) => execute(command, args, { signal })).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            imagePaths.push(outputPath);
          }),
        ),
        // Unavailable photos or frames reduce evidence; the text remains usable.
        Effect.catch(() => Effect.void),
      );
    for (const [mediaIndex, item] of (media ?? []).entries()) {
      if (imagePaths.length >= MAX_EVIDENCE_IMAGES) break;
      if (item.type === "photo" && item.url) {
        const outputPath = path.join(directory, `${mediaIndex}-photo.jpg`);
        yield* collect("curl", ["-fsSL", "--max-time", "20", "--output", outputPath, item.url], outputPath);
        continue;
      }
      if (!item.videoUrl) continue;
      for (const [frameIndex, seconds] of frameTimes(item.durationMs).entries()) {
        if (imagePaths.length >= MAX_EVIDENCE_IMAGES) break;
        const outputPath = path.join(directory, `${mediaIndex}-frame-${frameIndex}.jpg`);
        yield* collect(
          "ffmpeg",
          [
            "-v",
            "error",
            "-ss",
            seconds.toFixed(3),
            "-i",
            item.videoUrl,
            "-frames:v",
            "1",
            "-vf",
            "scale='min(1280,iw)':-2",
            "-q:v",
            "3",
            "-y",
            outputPath,
          ],
          outputPath,
        );
      }
    }
    const images = yield* Effect.forEach(
      imagePaths,
      (imagePath) =>
        io("design.read", () => readFile(imagePath)).pipe(
          Effect.map((contents) => ({
            data: contents.toString("base64"),
            mediaType: "image/jpeg",
            path: imagePath,
            type: "image",
          })),
        ),
      { concurrency: MAX_EVIDENCE_IMAGES },
    );
    return { images };
  });
}
