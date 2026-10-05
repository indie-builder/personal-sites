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
import { registerCliMocks } from "./helpers/cli-mock.mjs";

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

test("installed Pi SDK accepts model-runner images in an isolated session with no tools", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "site-pi-sdk-"));
  const runnerUrl = new URL("../modules/analysis/model-runner.mjs", import.meta.url);
  const key = "sitePiImageContract";
  let session;
  let hooks;
  t.mock.method(globalThis, "fetch", () => assert.fail("image contract test must not access the network"));
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
    const data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
    const received = [];
    // Keep the real session.prompt image normalization; stop before model execution.
    t.mock.method(session.agent, "prompt", async (messages) => { received.push(...messages); });
    t.mock.method(session.agent, "continue", () => assert.fail("image contract test must not continue a model run"));
    globalThis[key] = {
      DefaultResourceLoader: class { async reload() {} },
      SessionManager,
      createAgentSession: async () => ({ session }),
      getAgentDir: () => directory,
    };
    hooks = registerCliMocks({
      key,
      scheme: "site-pi-image-contract",
      matches: (parentURL) => parentURL?.startsWith(runnerUrl.href),
      mockExports: new Map([
        ["@earendil-works/pi-coding-agent", ["DefaultResourceLoader", "SessionManager", "createAgentSession", "getAgentDir"]],
      ]),
    });
    const { runPiPrompt } = await import(`${runnerUrl.href}?image-contract`);
    await Effect.runPromise(runPiPrompt({
      cwd: directory,
      images: [{ data, mediaType: "image/png" }],
      model,
      prompt: "Describe this synthetic pixel.",
      runtime,
    }));
    const userMessages = received.filter((message) => message.role === "user");
    assert.equal(userMessages.length, 1);
    assert.deepEqual(userMessages[0].content, [
      { type: "text", text: "Describe this synthetic pixel." },
      { type: "image", data, mimeType: "image/png" },
    ]);
  } finally {
    hooks?.deregister();
    delete globalThis[key];
    session?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
