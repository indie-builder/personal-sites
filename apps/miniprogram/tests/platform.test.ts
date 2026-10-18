import { beforeEach, describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { mockPlatform } from "./platform-fixture";
import * as Schema from "effect/Schema";
import { OperationError } from "@site/effect";
import { copyLink, externalUrl, previewImages, request, run } from "../src/lib/platform";

let platform: ReturnType<typeof mockPlatform>;
beforeEach(() => { platform = mockPlatform(); });

describe("wx Effect adapter", () => {
  test("validates successful data and HTTP/JSON boundary failures", async () => {
    const promise = Effect.runPromise(request("/api/test", Schema.Struct({ value: Schema.String })));
    expect(platform.latest().options.timeout).toBe(20_000);
    platform.latest().success({ value: "内容" });
    expect(await promise).toEqual({ value: "内容" });
    const invalid = Effect.runPromiseExit(request("/api/test", Schema.Struct({ value: Schema.String })));
    platform.latest().success({ value: 3 });
    expect((await invalid)._tag).toBe("Failure");
    const denied = Effect.runPromise(request("/api/test", Schema.Unknown).pipe(Effect.flip));
    platform.latest().success({ error: "暂不可用" }, 503);
    expect(await denied).toBeInstanceOf(OperationError);
    expect((await denied).message).toBe("暂不可用");
  });

  test("run cancellation aborts the task and suppresses all late callbacks", () => {
    let succeeded = false;
    let failed = false;
    const cancel = run(request("/api/test", Schema.Unknown), () => { succeeded = true; }, () => { failed = true; });
    const task = platform.latest();
    cancel();
    expect(task.aborted).toBe(true);
    task.success({ late: true });
    task.fail();
    expect(succeeded).toBe(false);
    expect(failed).toBe(false);
  });

  test("rejects non-http URLs and keeps source actions safe", () => {
    for (const value of ["javascript:alert(1)", "/pages/ask/index", "//evil.com", "https://a.com\\evil", "https://a.com\nevil", "https://name:pass@a.com", "https://"]) expect(externalUrl(value)).toBe("");
    expect(externalUrl(" https://example.com/path?q=1#ok ")).toBe("https://example.com/path?q=1#ok");
    copyLink("javascript:alert(1)");
    copyLink("https://example.com");
    previewImages(["javascript:bad", "https://example.com/1.jpg"], "javascript:bad");
    expect(platform.copied).toEqual(["https://example.com"]);
    expect(platform.previewed).toEqual([["https://example.com/1.jpg"]]);
    expect(platform.toasts).toContain("链接暂不可用");
  });
});
