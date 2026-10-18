import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Effect, Schema } from "effect";
import { io, type OperationError } from "@site/effect";
import { runCli } from "@site/effect/cli";
import { context } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "src");
const destination = path.join(root, "dist");
const maximumBytes = 2 * 1024 * 1024;
const manifest = Schema.fromJsonString(Schema.Struct({
  pages: Schema.Array(Schema.String.check(Schema.isPattern(/^pages\/[a-z-]+\/index$/))),
}));

export const stagingDirectory = Effect.acquireRelease(
  io("miniprogram.stage", () => mkdtemp(path.join(root, ".dist-next-"))),
  (directory) => io("miniprogram.cleanup", () => rm(directory, { recursive: true, force: true })).pipe(Effect.orDie),
);

const files = Effect.fn("miniprogram.files")(function* (directory: string): Effect.fn.Return<string[], OperationError> {
  const entries = yield* io("miniprogram.readdir", () => readdir(directory, { withFileTypes: true }));
  const nested = yield* Effect.forEach(entries, (entry) => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : Effect.succeed([path.join(directory, entry.name)]), { concurrency: 4 });
  return nested.flat();
});

const bundle = Effect.fn("miniprogram.bundle")(function* (entry: string, outfile: string, external: string[] = [], banner?: string) {
  // Bun.build and esbuild.transform cannot cancel work; a context owns the complete transform.
  const compiler = yield* Effect.acquireRelease(
    io("miniprogram.compiler", () => context({
      entryPoints: [entry], outfile, bundle: true, platform: "browser", format: "cjs", minify: true,
      target: "es2018", supported: { bigint: true },
      // WeChat supports native BigInt; its ES5/Babel lowering to Math.pow breaks Effect.
      define: { "process.env.NODE_ENV": '"production"' },
      external, banner: banner ? { js: banner } : undefined,
      plugins: external.length ? [{
        name: "shared-miniprogram-runtime",
        setup(builder) {
          builder.onResolve({ filter: /\/lib\/runtime$/ }, () => ({
            path: "../../lib/runtime.js", external: true,
          }));
        },
      }] : [],
    })),
    (compiler) => io("miniprogram.compiler.cancel", () => compiler.cancel()).pipe(
      Effect.ensuring(io("miniprogram.compiler.dispose", () => compiler.dispose()).pipe(Effect.orDie)),
      Effect.orDie,
    ),
  );
  yield* io("miniprogram.compile", () => compiler.rebuild());
}, Effect.scoped);

const build = Effect.gen(function* () {
  const output = yield* stagingDirectory;
  yield* bundle(path.join(source, "encoding.ts"), path.join(output, "encoding.js"));
  yield* bundle(path.join(source, "lib/runtime.ts"), path.join(output, "lib/runtime.js"), [], 'require("../encoding.js");');
  yield* bundle(path.join(source, "app.ts"), path.join(output, "app.js"), [], 'require("./encoding.js");');
  const app = yield* Schema.decodeUnknownEffect(manifest)(yield* io("miniprogram.manifest", () => readFile(path.join(source, "app.json"), "utf8")));
  for (const page of app.pages) {
    yield* bundle(path.join(source, `${page}.ts`), path.join(output, `${page}.js`), ["../../lib/runtime", "../lib/runtime"]);
    for (const extension of ["json", "wxml", "wxss"]) {
      yield* io("miniprogram.copy.page", () => cp(path.join(source, `${page}.${extension}`), path.join(output, `${page}.${extension}`)));
    }
  }
  for (const name of ["app.json", "app.wxss", "theme.json", "sitemap.json"]) {
    yield* io("miniprogram.copy.manifest", () => cp(path.join(source, name), path.join(output, name)));
  }
  yield* io("miniprogram.assets", () => mkdir(path.join(output, "assets"), { recursive: true }));
  yield* io("miniprogram.copy.avatar", () => cp(new URL("../../../ios/ChenYuanSite/Assets.xcassets/profile_avatar.imageset/profile_avatar.png", import.meta.url), path.join(output, "assets/avatar.png")));
  yield* io("miniprogram.navigation", () => mkdir(path.join(output, "assets/navigation"), { recursive: true }));
  for (const name of ["home", "ask", "portfolio", "about"]) {
    for (const tone of ["muted", "light", "dark"]) {
      yield* io("miniprogram.copy.navigation", () => cp(path.join(source, `assets/navigation/${name}-${tone}.png`), path.join(output, `assets/navigation/${name}-${tone}.png`)));
    }
  }
  let bytes = 0;
  for (const file of yield* files(output)) bytes += (yield* io("miniprogram.size", () => stat(file))).size;
  if (bytes > maximumBytes) return yield* Effect.fail(new Error(`小程序包 ${bytes} 字节，超过主包 2 MiB 限制`));
  // Finish the small publication step before honoring cancellation.
  yield* Effect.gen(function* () {
    yield* io("miniprogram.replace", () => rm(destination, { recursive: true, force: true }));
    yield* io("miniprogram.publish", () => rename(output, destination));
  }).pipe(Effect.uninterruptible);
  console.log(`微信小程序已构建：${destination} (${(bytes / 1024).toFixed(1)} KiB / 2048 KiB)`);
}).pipe(Effect.scoped);

if (import.meta.main) await runCli(build);
