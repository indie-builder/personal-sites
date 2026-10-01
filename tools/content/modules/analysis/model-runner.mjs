import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import {
  DefaultResourceLoader,
  SessionManager,
  createAgentSession,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

import { getFinalAssistantFailure, getFinalAssistantText } from "../../lib/agent-response.mjs";

export function withModelTimeout(request, timeoutMilliseconds, { label } = {}) {
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1000) {
    return Effect.fail(new Error("模型请求超时必须是不小于 1000 的整数毫秒数。"));
  }
  const requestLabel = label ? `${label} 请求` : "模型请求";
  return request.pipe(
    Effect.timeoutFail({
      duration: timeoutMilliseconds,
      onTimeout: () => new Error(`${requestLabel}超时（${Math.round(timeoutMilliseconds / 1000)} 秒）。`),
    }),
  );
}

/** A scoped Pi session is aborted and disposed on success, failure, or interruption. */
export function runPiPrompt({ cwd, images = [], label = "模型", model, prompt, runtime, timeoutMilliseconds }) {
  return Effect.scoped(
    Effect.gen(function* () {
      const resourceLoader = new DefaultResourceLoader({
        cwd,
        agentDir: getAgentDir(),
        noContextFiles: true,
        noExtensions: true,
        noPromptTemplates: true,
        noSkills: true,
        noThemes: true,
      });
      yield* io("pi.resources", () => resourceLoader.reload());
      const { session } = yield* Effect.acquireRelease(
        io("pi.session", () =>
          createAgentSession({
            cwd,
            model,
            modelRuntime: runtime,
            noTools: "all",
            resourceLoader,
            sessionManager: SessionManager.inMemory(cwd),
            thinkingLevel: "off",
          }),
        ),
        ({ session }) =>
          io("pi.abort", () => session.abort()).pipe(
            Effect.orDie,
            Effect.ensuring(Effect.sync(() => session.dispose())),
          ),
      );
      let answer = "";
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          session.subscribe((event) => {
            if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta")
              answer += event.assistantMessageEvent.delta;
          }),
        ),
        (unsubscribe) => Effect.sync(unsubscribe),
      );
      const request = io("pi.prompt", () =>
        session.prompt(prompt, {
          images: images.map((image) => ({
            source: { data: image.data, mediaType: image.mediaType, type: "base64" },
            type: "image",
          })),
        }),
      );
      yield* timeoutMilliseconds === undefined ? request : withModelTimeout(request, timeoutMilliseconds, { label });
      return yield* attempt("pi.answer", () => {
        const failure = getFinalAssistantFailure(session);
        if (failure) throw new Error(`${label} 请求失败：${failure}`);
        return getFinalAssistantText(session) || answer.trim();
      });
    }),
  );
}
