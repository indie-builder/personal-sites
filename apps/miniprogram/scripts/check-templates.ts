import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import { runCli } from "@site/effect/cli";

const source = fileURLToPath(new URL("../src/", import.meta.url));
const compilerRoot = process.env.WECHAT_COMPILER_ROOT
  ?? "/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec";

export const compilerProcess = (command: string[]) => Effect.acquireRelease(
  attempt("miniprogram.compiler.spawn", () => Bun.spawn(command, { cwd: source, stdin: "ignore", stdout: "pipe", stderr: "pipe" })),
  (child) => Effect.gen(function* () {
    // Force termination so an interrupted check cannot leave a hung native compiler behind.
    if (child.exitCode === null && child.signalCode === null) yield* attempt("miniprogram.compiler.kill", () => child.kill("SIGKILL"));
    yield* io("miniprogram.compiler.reap", () => child.exited);
  }).pipe(Effect.orDie),
);

const compile = Effect.fn("miniprogram.templates.compile")(function* (compiler: string, arguments_: string[], count: number) {
  const child = yield* compilerProcess([compiler, ...arguments_]);
  const [output, errors, code] = yield* Effect.all([
    io("miniprogram.compiler.stdout", () => new Response(child.stdout).text()),
    io("miniprogram.compiler.stderr", () => new Response(child.stderr).text()),
    io("miniprogram.compiler.exit", () => child.exited),
  ], { concurrency: 3 });
  if (code !== 0 || /(?:^|\n).*error[:\s]/i.test(errors)) {
    return yield* Effect.fail(new Error(`${path.basename(compiler)} 编译失败 (${code})\n${errors}\n${output.slice(0, 2000)}`));
  }
  if (errors.trim()) console.log(errors.trim());
  console.log(`${path.basename(compiler)}：${count} 个页面编译通过`);
}, Effect.scoped);

const verify = Effect.gen(function* () {
  const wcc = path.join(compilerRoot, process.platform === "win32" ? "wcc.exe" : "wcc");
  const wcsc = path.join(compilerRoot, process.platform === "win32" ? "wcsc.exe" : "wcsc");
  yield* Effect.all([wcc, wcsc].map((compiler) => io("miniprogram.compiler.access", () => access(compiler))), { concurrency: 2 }).pipe(
    Effect.mapError(() => new Error("找不到微信模板编译器。安装微信开发者工具，或设置 WECHAT_COMPILER_ROOT 指向 wcc/wcsc 所在目录。")),
  );
  const pages = (yield* io("miniprogram.templates.pages", () => readdir(path.join(source, "pages"), { withFileTypes: true })))
    .filter(entry => entry.isDirectory()).map(entry => `./pages/${entry.name}/index`);
  yield* compile(wcc, pages.map(page => `${page}.wxml`), pages.length);
  yield* compile(wcsc, ["-pc", String(pages.length), ...pages.map(page => `${page}.wxss`), "./app.wxss"], pages.length);
});

if (import.meta.main) await runCli(verify);
