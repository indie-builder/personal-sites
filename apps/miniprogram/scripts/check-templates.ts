import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { io } from "@site/effect";

const source = fileURLToPath(new URL("../src/", import.meta.url));
const compilerRoot = process.env.WECHAT_COMPILER_ROOT
  ?? "/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec";

const verify = io("miniprogram.templates", async () => {
  const wcc = path.join(compilerRoot, process.platform === "win32" ? "wcc.exe" : "wcc");
  const wcsc = path.join(compilerRoot, process.platform === "win32" ? "wcsc.exe" : "wcsc");
  try { await access(wcc); await access(wcsc); }
  catch { throw new Error("找不到微信模板编译器。安装微信开发者工具，或设置 WECHAT_COMPILER_ROOT 指向 wcc/wcsc 所在目录。"); }
  const pages = (await readdir(path.join(source, "pages"), { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => `./pages/${entry.name}/index`);
  for (const [compiler, arguments_] of [
    [wcc, pages.map(page => `${page}.wxml`)],
    [wcsc, ["-pc", String(pages.length), ...pages.map(page => `${page}.wxss`), "./app.wxss"]],
  ] as const) {
    const process_ = Bun.spawn([compiler, ...arguments_], { cwd: source, stdout: "pipe", stderr: "pipe" });
    const [output, errors, code] = await Promise.all([
      new Response(process_.stdout).text(), new Response(process_.stderr).text(), process_.exited,
    ]);
    if (code !== 0 || /(?:^|\n).*error[:\s]/i.test(errors)) {
      throw new Error(`${path.basename(compiler)} 编译失败 (${code})\n${errors}\n${output.slice(0, 2000)}`);
    }
    if (errors.trim()) console.log(errors.trim());
    console.log(`${path.basename(compiler)}：${pages.length} 个页面编译通过`);
  }
});
await Effect.runPromise(verify);
