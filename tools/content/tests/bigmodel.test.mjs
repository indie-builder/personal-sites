import { Effect } from "effect";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { BIGMODEL_BASE_URL, BIGMODEL_PROVIDER, resolveBigModel } from "../../../config/bigmodel.mjs";
import { resolvePiModelConfig, configureBigModelRuntime } from "../lib/pi-runtime.mjs";

test("analysis registers BigModel before resolving credentials, including images", async () => {
  assert.equal(resolveBigModel(), "glm-5.3-flash");
  const calls = [];
  const runtime = {
    registerProvider: (id, config) => calls.push({ id, config }),
    setRuntimeApiKey: async (id, key) => calls.push({ id, key }),
  };
  await Effect.runPromise(
    configureBigModelRuntime(runtime, resolveBigModel(), { BIGMODEL_API_KEY: "fixture-key" }),
  );
  assert.equal(calls[0].id, BIGMODEL_PROVIDER);
  assert.equal(calls[0].config.baseUrl, BIGMODEL_BASE_URL);
  assert.equal(calls[0].config.api, "anthropic-messages");
  assert.deepEqual(calls[0].config.models[0].input, ["text", "image"]);
  assert.deepEqual(calls[1], { id: BIGMODEL_PROVIDER, key: "fixture-key" });
  assert.deepEqual(resolvePiModelConfig({ env: {} }), {
    provider: BIGMODEL_PROVIDER,
    model: resolveBigModel(),
  });
  await assert.rejects(
    Effect.runPromise(configureBigModelRuntime(runtime, resolveBigModel(), {})),
    /BIGMODEL_API_KEY/,
  );
});

test("installed Pi SDK creates an isolated BigModel session with no tools", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "site-pi-sdk-"));
  let session;
  try {
    const runtime = await ModelRuntime.create({
      authPath: path.join(directory, "auth.json"),
      modelsPath: null,
      modelsStorePath: path.join(directory, "models-cache.json"),
      allowModelNetwork: false,
      refreshOnCreate: false,
    });
    await Effect.runPromise(
      configureBigModelRuntime(runtime, resolveBigModel(), { BIGMODEL_API_KEY: "fixture-key" }),
    );
    const model = runtime.getModel(BIGMODEL_PROVIDER, resolveBigModel());
    assert.ok(model);
    const resourceLoader = new DefaultResourceLoader({
      cwd: directory,
      agentDir: directory,
      noContextFiles: true,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
    });
    await resourceLoader.reload();
    ({ session } = await createAgentSession({
      cwd: directory,
      agentDir: directory,
      model,
      modelRuntime: runtime,
      noTools: "all",
      resourceLoader,
      sessionManager: SessionManager.inMemory(directory),
      settingsManager: SettingsManager.inMemory(),
      thinkingLevel: "off",
    }));
    assert.deepEqual(session.getActiveToolNames(), []);
    assert.deepEqual(session.messages, []);
  } finally {
    session?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
