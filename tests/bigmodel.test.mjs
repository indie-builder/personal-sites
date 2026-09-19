import assert from "node:assert/strict";
import test from "node:test";
import { configureBigModelRuntime, BIGMODEL_BASE_URL, BIGMODEL_DEFAULT_MODEL, BIGMODEL_PROVIDER } from "../lib/bigmodel.mjs";
import { resolvePiModelConfig } from "../lib/pi-runtime.mjs";

test("analysis registers BigModel before resolving credentials, including images", async () => {
  const calls = [];
  const runtime = {
    registerProvider: (id, config) => calls.push({ id, config }),
    setRuntimeApiKey: async (id, key) => calls.push({ id, key }),
  };
  await configureBigModelRuntime(runtime, BIGMODEL_DEFAULT_MODEL, { BIGMODEL_API_KEY: "fixture-key" });
  assert.equal(calls[0].id, BIGMODEL_PROVIDER);
  assert.equal(calls[0].config.baseUrl, BIGMODEL_BASE_URL);
  assert.equal(calls[0].config.api, "anthropic-messages");
  assert.deepEqual(calls[0].config.models[0].input, ["text", "image"]);
  assert.deepEqual(calls[1], { id: BIGMODEL_PROVIDER, key: "fixture-key" });
  assert.deepEqual(resolvePiModelConfig({env: {}}), { provider: BIGMODEL_PROVIDER, model: BIGMODEL_DEFAULT_MODEL });
  await assert.rejects(configureBigModelRuntime(runtime, BIGMODEL_DEFAULT_MODEL, {}), /BIGMODEL_API_KEY/);
});
