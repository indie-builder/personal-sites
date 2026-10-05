import { runCli } from "@site/effect/cli";

/** CLI 入口收尾；label 不带「失败：」后缀，由这里统一拼接。 */
export function runCliScript(program, label) {
  runCli(program).catch((error) => {
    console.error(`${label}失败：${error.message}`);
    process.exitCode = 1;
  });
}
