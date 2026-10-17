import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { OperationError } from "@site/effect";
import { Utf8Decoder } from "./sse";

export const SITE_ORIGIN = "https://default-coder.lovemyrmb.cn";
export const PORTFOLIO_ORIGIN = "https://portfolio.default-coder.lovemyrmb.cn";

export function externalUrl(value: string): string {
  const url = value.trim();
  if (/[\s\\]/.test(url) || Array.from(url).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return "";
  const match = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(url);
  if (!match || !/^(?:[a-z\d](?:[a-z\d.-]*[a-z\d])?|\[[a-f\d:]+\])(?::\d{1,5})?$/i.test(match[1] ?? "")) return "";
  return url;
}

export function copyLink(value: string): void {
  const url = externalUrl(value);
  if (!url) {
    wx.showToast({ title: "链接暂不可用", icon: "none" });
    return;
  }
  wx.setClipboardData({
    data: url,
    success: () => wx.showToast({ title: "链接已复制", icon: "success" }),
    fail: () => wx.showToast({ title: "复制失败，请重试", icon: "none" }),
  });
}

export function previewImages(values: string[], current: string): void {
  const urls = values.map(externalUrl).filter(Boolean);
  if (urls.length === 0) {
    wx.showToast({ title: "图片暂不可用", icon: "none" });
    return;
  }
  wx.previewImage({
    urls,
    current: urls.includes(externalUrl(current)) ? externalUrl(current) : urls[0],
    fail: () => wx.showToast({ title: "图片加载失败，请重试", icon: "none" }),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof OperationError) return error.message;
  return "内容暂时无法读取，请重试。";
}

export function run<A, E>(effect: Effect.Effect<A, E>, success?: (value: A) => void, failure?: (error: E) => void): () => void {
  let active = true;
  const cancel = Effect.runCallback(effect, {
    onExit: (exit) => {
      if (!active) return;
      active = false;
      if (Exit.isSuccess(exit)) {
        success?.(exit.value);
      } else if (!Cause.hasInterruptsOnly(exit.cause)) {
        const error = Cause.findError(exit.cause);
        if (Result.isSuccess(error) && failure) failure(error.success);
        else wx.showToast({ title: Result.isSuccess(error) ? errorMessage(error.success) : "操作失败，请重试。", icon: "none" });
      }
    },
  });
  return () => {
    active = false;
    cancel();
  };
}

const HttpError = Schema.Struct({ error: Schema.String });

export function responseError(status: number, data: unknown, ask = false): string {
  let body = data;
  if (body instanceof ArrayBuffer) body = new Utf8Decoder().decode(new Uint8Array(body), true);
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const decoded = Schema.decodeUnknownResult(HttpError)(body);
  if (Result.isSuccess(decoded) && decoded.success.error.trim()) return decoded.success.error;
  if (status === 429) return "请求过于频繁，请稍后再试。";
  return ask ? "暂时无法回答，请稍后再试。" : "内容暂时无法读取，请重试。";
}

export function request<A>(path: string, schema: Schema.ConstraintDecoder<A>, origin = SITE_ORIGIN): Effect.Effect<A, OperationError | Schema.SchemaError> {
  return requestWithCancel(path, schema, origin);
}

export const requestWithCancel = <A>(
  path: string,
  schema: Schema.ConstraintDecoder<A>,
  origin = SITE_ORIGIN,
  registerCancel?: (cancel: () => void) => void,
): Effect.Effect<A, OperationError | Schema.SchemaError> => Effect.gen(function* () {
  if (!path.startsWith("/") || path.startsWith("//") || !externalUrl(origin)) {
    return yield* Effect.fail(new OperationError("http.get", new Error("请求地址无效。")));
  }
  const body = yield* Effect.callback<unknown, OperationError>((resume) => {
    let active = true;
    let task: WechatMiniprogram.RequestTask | undefined;
    const cancel = () => {
      if (!active) return;
      active = false;
      task?.abort();
      resume(Effect.interrupt);
    };
    try {
      task = wx.request({
        url: `${origin}${path}`,
        method: "GET",
        timeout: 20_000,
        dataType: "json",
        success: (response) => {
          if (!active) return;
          active = false;
          resume(response.statusCode >= 200 && response.statusCode < 300
            ? Effect.succeed(response.data)
            : Effect.fail(new OperationError("http.get", new Error(responseError(response.statusCode, response.data)))));
        },
        fail: (error) => {
          if (!active) return;
          active = false;
          resume(Effect.fail(new OperationError("http.get", new Error(error.errMsg.includes("timeout") ? "读取超时，请重试。" : "网络不可用，请检查连接后重试。"))));
        },
      });
      registerCancel?.(cancel);
    } catch {
      active = false;
      resume(Effect.fail(new OperationError("http.get", new Error("网络请求无法启动，请重试。"))));
    }
    return Effect.sync(cancel);
  });
  return yield* Schema.decodeUnknownEffect(schema)(body);
});
