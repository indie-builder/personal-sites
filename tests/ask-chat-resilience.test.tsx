import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskChat } from "@/components/ask-chat";
import { ASK_CHAT_STORAGE_KEY, readAskChatSnapshot } from "@/components/ask-chat-snapshot";

vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: { load: async () => ({ get: async () => ({ visitorId: "test-visitor-123456789" }) }) },
}));
vi.mock("next/dynamic", () => ({ default: () => ({ source }: { source: string }) => <div>{source}</div> }));

const source = {
  content: "公开关注资料", id: "source-1", publishedAt: null, scope: "daily",
  section: null, sourceId: "project", sourceUrl: "/curation/source", title: "项目来源",
};

describe("AskChat interrupted reading and session continuity", () => {
  let stream: ReadableStreamDefaultController<Uint8Array>;
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    fetchMock.mockReset().mockImplementation((_url: string, init: RequestInit) => Promise.resolve(new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller;
          init.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
        },
      }),
    )));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      addEventListener: vi.fn(), removeEventListener: vi.fn(), matches: query.includes("reduced-motion"), media: query,
    })));
    vi.stubGlobal("ResizeObserver", class {
      observe() {} disconnect() {} unobserve() {}
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  async function sendQuestion() {
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "项目有什么进展？" } });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  }

  async function emit(event: string, data: unknown) {
    await act(async () => stream.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)));
  }

  it("keeps partial text and sources when stopped, without successful-answer followups", async () => {
    render(<AskChat />);
    await sendQuestion();
    await emit("sources", { sources: [source] });
    await emit("text", { delta: "已经收到的部分回答。" });
    fireEvent.click(screen.getByRole("button", { name: "停止生成" }));

    expect(await screen.findByText("已停止生成。")).toBeTruthy();
    expect(screen.getByText("已经收到的部分回答。")).toBeTruthy();
    expect(screen.getByRole("link", { name: /项目来源/ }).getAttribute("href")).toBe("/curation/source");
    expect(screen.queryByText("继续问")).toBeNull();
    expect(readAskChatSnapshot()?.messages.at(-1)?.content).toBe("已经收到的部分回答。");
  });

  it("preserves text on stream error and resends the original question on retry", async () => {
    render(<AskChat />);
    await sendQuestion();
    await emit("text", { delta: "先完成的部分。" });
    await emit("error", { message: "回答中断，请重试。" });
    await act(async () => stream.close());

    expect(await screen.findByText("先完成的部分。")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("回答中断，请重试。");
    expect(screen.queryByText("继续问")).toBeNull();
    // 重试不吞掉输入框里正在编辑的草稿。
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "正在写的新问题" } });
    fireEvent.click(screen.getByRole("button", { name: "重新提问" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).question).toBe("项目有什么进展？");
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("正在写的新问题");
  });

  it("resends the seeded question after restoring a failed turn from storage", async () => {
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
      messages: [
        { citations: [], content: "恢复后的提问", id: "user-1", isComplete: true, role: "user" },
        { citations: [], content: "", id: "assistant-1", interruption: { kind: "error", message: "回答中断，请重试。" }, isComplete: true, role: "assistant" },
      ],
      question: "",
    }));
    render(<AskChat />);

    fireEvent.click(screen.getByRole("button", { name: "重新提问" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).question).toBe("恢复后的提问");
  });

  it("restores completed answers and draft after reopening the drawer", async () => {
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
      messages: [
        { citations: [], content: "项目？", id: "user-1", isComplete: true, role: "user" },
        { citations: [source], content: "已经完成的回答", id: "assistant-1", isComplete: true, role: "assistant" },
      ],
      question: "正在核对资料的草稿",
    }));
    const view = render(<AskChat />);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("正在核对资料的草稿");
    expect(screen.queryByRole("button", { name: /检索范围/ })).toBeNull();
    expect(screen.getByText("已经完成的回答")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "更新后的草稿" } });
    view.unmount();
    render(<AskChat />);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("更新后的草稿");
    expect(screen.queryByRole("button", { name: "清空对话" })).toBeNull();
  });

  it("does not submit Enter while composing Chinese or Shift+Enter", () => {
    render(<AskChat />);
    const input = screen.getByRole("textbox", { name: "输入问题" });
    fireEvent.change(input, { target: { value: "正在选字" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((input as HTMLTextAreaElement).value).toBe("正在选字");
  });

  it("ignores corrupt storage and continues when session storage is unavailable", () => {
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, "not-json");
    render(<AskChat />);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "仍然可以输入" } });
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("仍然可以输入");
    write.mockRestore();
  });
});
