import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";

loadLocalEnv(fileURLToPath(new URL("../../../", import.meta.url)));

// 有 key 却收集到零个可运行用例时必须显式失败（NO_TESTS）；--pass-with-no-tests 只服务缺 key 的整层跳过。
const passWithNoTests = process.env.BIGMODEL_API_KEY?.trim() ? [] : ["--pass-with-no-tests"];
const cli = fileURLToPath(new URL("../node_modules/.bin/e2e", import.meta.url));
const result = spawnSync(cli, ["run", ...passWithNoTests, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, E2E_TELEMETRY_DISABLED: "1" },
});
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
