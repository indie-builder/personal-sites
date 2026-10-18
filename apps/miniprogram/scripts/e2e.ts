import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { createAppService } from "./e2e/app-service";
import { verifyAsk } from "./e2e/ask";
import { verifyHome } from "./e2e/home";
import { root, verifyPackage } from "./e2e/package";
import { verifyPortfolio } from "./e2e/portfolio";

async function verifyAppService() {
  verifyPackage();
  const harness = createAppService();
  try {
    harness.loadAll();
    console.log("PASS eight page bundles registered; shared CommonJS runtime initialized once without browser globals");
    await verifyHome(harness);
    await verifyAsk(harness);
    await verifyPortfolio(harness);
  } finally {
    harness.close();
  }
}

if (import.meta.main) {
  console.log("AppService contract harness, not real simulator. Deterministic public fixtures; no live Ask request.");
  const build = Bun.spawn([process.execPath, "scripts/build.ts"], { cwd: root, stdout: "inherit", stderr: "inherit" });
  assert.equal(await build.exited, 0, "miniprogram build failed");
  assert(existsSync(path.join(root, "dist/lib/runtime.js")), "build did not emit shared runtime");
  await verifyAppService();
  console.log("PASS AppService contract harness, not real simulator");
}
