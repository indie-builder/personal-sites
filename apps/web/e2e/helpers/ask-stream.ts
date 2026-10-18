import type { Browser } from "@e2e-dev/web";
import type { JsonValue } from "e2e";

// 控制公开 Ask SSE 的片段与完成时机，测试无需真实检索或模型。
export function installEmitAskMock(browser: Browser) {
  return browser.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const controls = window as typeof window & { emitAsk: (event: string, data: unknown) => void };
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.endsWith("/api/ask")) return originalFetch(input, init);
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          controls.emitAsk = (event, data) => {
            controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            if (event === "done") controller.close();
          };
        },
      }), { headers: { "Content-Type": "text/event-stream" } }));
    };
  });
}

export function emitAsk(browser: Browser, event: string, data: JsonValue) {
  return browser.evaluate(({ event, data }: { event: string; data: JsonValue }) => {
    (window as typeof window & { emitAsk: (event: string, data: unknown) => void }).emitAsk(event, data);
    return null;
  }, { event, data });
}
