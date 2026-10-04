// Compile-only contracts against the installed SDKs; never execute model requests.
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { Effect, Schedule } from "effect";
import { runPiPrompt, withModelTimeout } from "../modules/analysis/model-runner.mjs";
import { withModelRetry } from "../modules/analysis/retry.mjs";

declare const session: AgentSession;
declare const options: Parameters<typeof runPiPrompt>[0];

session.prompt("Describe the image", {
  images: [{ type: "image", data: "cGl4ZWw=", mimeType: "image/png" }],
});
session.prompt("Describe the image", {
  // @ts-expect-error Pi images require flat data/mimeType, not the provider's nested source shape.
  images: [{ type: "image", source: { type: "base64", data: "cGl4ZWw=", media_type: "image/png" } }],
});
session.prompt("Describe the image", {
  // @ts-expect-error The Pi contract requires mimeType, not our input adapter's mediaType.
  images: [{ type: "image", data: "cGl4ZWw=", mediaType: "image/png" }],
});

Effect.retry(Effect.succeed("ok"), { times: 1, schedule: Schedule.spaced("5 seconds") });
// @ts-expect-error Effect 4 does not export Schedule.both.
Schedule.both(Schedule.spaced("5 seconds"), Schedule.recurs(1));

runPiPrompt({ ...options, images: [{ data: "cGl4ZWw=", mediaType: "image/png" }] });
// @ts-expect-error Model-runner's public image boundary must preserve string data.
runPiPrompt({ ...options, images: [{ data: 42, mediaType: "image/png" }] });
// @ts-expect-error The timeout wrapper must preserve its success type.
const wrongResult: Effect.Effect<number, Error> = withModelTimeout(Effect.succeed("ok"), 1000);
// @ts-expect-error Retrying must preserve the original success type.
const wrongRetry: Effect.Effect<number> = withModelRetry(Effect.succeed("ok"));
void [wrongResult, wrongRetry];
