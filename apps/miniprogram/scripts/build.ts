import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Effect } from "effect";
import { io } from "@site/effect";
import { transform } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "src");
const output = path.join(root, ".dist-next");
const destination = path.join(root, "dist");
const maximumBytes = 2 * 1024 * 1024;

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}

async function bundle(entry: string, outfile: string, external: string[] = [], banner?: string) {
  const result = await Bun.build({
    entrypoints: [entry], target: "browser", format: "cjs", minify: true,
    external, banner, env: "disable",
    plugins: external.length ? [{
      name: "shared-miniprogram-runtime",
      setup(builder) {
        builder.onResolve({ filter: /\/lib\/runtime$/ }, () => ({
          path: "../../lib/runtime.js", external: true,
        }));
      },
    }] : [],
  });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  const transformed = await transform(await result.outputs[0].text(), {
    target: "es2018", format: "cjs", minify: true,
    // WeChat supports native BigInt; its ES5/Babel lowering to Math.pow breaks Effect.
    logOverride: { "bigint": "silent" },
  });
  await mkdir(path.dirname(outfile), { recursive: true });
  await writeFile(outfile, transformed.code);
}

const build = io("miniprogram.build", async () => {
  await rm(output, { recursive: true, force: true });
  try {
    await mkdir(path.join(output, "lib"), { recursive: true });
    await bundle(path.join(source, "encoding.ts"), path.join(output, "encoding.js"));
    await bundle(path.join(source, "lib/runtime.ts"), path.join(output, "lib/runtime.js"), [], 'require("../encoding.js");');
    await bundle(path.join(source, "app.ts"), path.join(output, "app.js"), [], 'require("./encoding.js");');
    const app = JSON.parse(await readFile(path.join(source, "app.json"), "utf8"));
    for (const page of app.pages) {
      await bundle(path.join(source, `${page}.ts`), path.join(output, `${page}.js`), ["../../lib/runtime", "../lib/runtime"]);
      for (const extension of ["json", "wxml", "wxss"]) {
        await cp(path.join(source, `${page}.${extension}`), path.join(output, `${page}.${extension}`));
      }
    }
    for (const name of ["app.json", "app.wxss", "theme.json", "sitemap.json"]) {
      await cp(path.join(source, name), path.join(output, name));
    }
    await mkdir(path.join(output, "assets"), { recursive: true });
    await cp(new URL("../../../ios/ChenYuanSite/Assets.xcassets/profile_avatar.imageset/profile_avatar.png", import.meta.url), path.join(output, "assets/avatar.png"));
    await mkdir(path.join(output, "assets/navigation"), { recursive: true });
    for (const name of ["home", "ask", "portfolio", "about"]) {
      for (const tone of ["muted", "light", "dark"]) {
        await cp(path.join(source, `assets/navigation/${name}-${tone}.png`), path.join(output, `assets/navigation/${name}-${tone}.png`));
      }
    }
    let bytes = 0;
    for (const file of await files(output)) bytes += (await stat(file)).size;
    if (bytes > maximumBytes) throw new Error(`小程序包 ${bytes} 字节，超过主包 2 MiB 限制`);
    await rm(destination, { recursive: true, force: true });
    await rename(output, destination);
    console.log(`微信小程序已构建：${destination} (${(bytes / 1024).toFixed(1)} KiB / 2048 KiB)`);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

await Effect.runPromise(build);
