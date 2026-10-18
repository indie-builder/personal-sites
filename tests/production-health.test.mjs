import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL("../scripts/check-production-health.mjs", import.meta.url));

async function withHealthServer(status, payload, run) {
  const server = createServer((_request, response) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}/api/health/data`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function check(url) {
  const env = { ...process.env, DATA_HEALTH_URL: url, HEALTH_ATTEMPTS: "1", HEALTH_RETRY_MS: "0" };
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [script], { encoding: "utf8", env });
    return { status: 0, stdout, stderr };
  } catch (error) {
    return { status: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

test("successful health with warnings keeps exit 0 and prints the warnings", async () => {
  const warning = "X 策展内容已超过 72 小时未更新；最近同步成功。";
  const result = await withHealthServer(200, { deployment: { commit: "abc123" }, healthy: true, warnings: [warning] }, check);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /生产数据健康：正常（abc123）/);
  assert.match(result.stderr, new RegExp(warning));
});

test("unhealthy health returns 503 and exits nonzero", async () => {
  const result = await withHealthServer(503, { healthy: false, warnings: ["数据库不可用。"] }, check);
  assert.equal(result.status, 1);
});

test("plain healthy payload prints no warnings", async () => {
  const result = await withHealthServer(200, { healthy: true, warnings: [] }, check);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /警告/);
});
