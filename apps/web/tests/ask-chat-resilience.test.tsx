import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskChat } from "@/components/ask-chat";
import { ASK_CHAT_DRAFT_STORAGE_KEY, ASK_CHAT_STORAGE_KEY, readAskChatSnapshot } from "@/components/ask-chat-snapshot";

const source = {
  content: "公开关注资料", id: "source-1", publishedAt: null, scope: "daily",
  section: null, sourceId: "project", sourceUrl: "/curation/source", title: "项目来源",
};

function openuiText(text: string) {
  return `root = Stack([TextContent(${JSON.stringify(text)})])`;
}

describe("AskChat interrupted reading and session continuity", () => {
  let stream: ReadableStreamDefaultController<Uint8Array>;
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
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
    window.localStorage.clear();
  });

  async function sendQuestion() {
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "项目有什么进展？" } });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  }

  async function emit(event: string, data: unknown) {
    await act(async () => stream.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)));
  }

  it("reuses random anonymous identity and conversation after reopening the drawer", async () => {
    const view = render(<AskChat />);
    await sendQuestion();
    const first = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(first.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.conversationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.visitorId).not.toBe(first.conversationId);
    await act(async () => stream.close());
    await waitFor(() => expect(screen.getByRole("button", { name: "发送问题" })).toBeTruthy());
    view.unmount();

    render(<AskChat />);
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "再问一个问题" } });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const next = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(next.visitorId).toBe(first.visitorId);
    expect(next.conversationId).toBe(first.conversationId);
  });

  it("can send and retry with one in-memory identity when browser storage is blocked", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    try {
      render(<AskChat />);
      await sendQuestion();
      const first = JSON.parse(String(fetchMock.mock.calls[0][1].body));
      expect(first.visitorId).toMatch(/^[0-9a-f-]{36}$/);
      expect(first.conversationId).toMatch(/^[0-9a-f-]{36}$/);
      await emit("error", { message: "回答中断，请重试。" });
      await act(async () => stream.close());
      fireEvent.click(await screen.findByRole("button", { name: "重新提问" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const next = JSON.parse(String(fetchMock.mock.calls[1][1].body));
      expect(next.visitorId).toBe(first.visitorId);
      expect(next.conversationId).toBe(first.conversationId);
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });

  it("renders Markdown while streaming and reveals sources only after completion", async () => {
    render(<AskChat />);
    await sendQuestion();
    await emit("text", { delta: 'root = Stack([TextContent("## 进展\\n\\n这是**重点' });
    expect(screen.getByRole("heading", { name: "进展" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "停止生成" })).toBeTruthy();

    await emit("text", { delta: '**。\\n\\n- 第一项\\n- 第二项\\n\\n```ts\\nconst ready = true;\\n```")])' });
    expect(screen.getByText("重点").tagName).toBe("STRONG");
    expect(screen.getByText("第一项").tagName).toBe("LI");
    expect(document.querySelector("pre code")?.textContent).toContain("const ready = true;");
    await emit("sources", { sources: [source] });
    expect(screen.queryByRole("list", { name: "回答来源" })).toBeNull();

    await emit("done", {});
    await act(async () => stream.close());
    const summary = await screen.findByText("参考资料 · 1 篇");
    expect(summary.closest("details")?.open).toBe(false);
    fireEvent.click(summary);
    expect(summary.closest("details")?.open).toBe(true);
    expect(screen.getByRole("list", { name: "回答来源" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /项目来源/ }).getAttribute("href")).toBe("/curation/source");
    fireEvent.click(summary);
    expect(summary.closest("details")?.open).toBe(false);
    expect(screen.getByRole("heading", { name: "进展" })).toBeTruthy();
  });

  it("continues from a default OpenUI button without losing the draft", async () => {
    render(<AskChat />);
    await sendQuestion();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).format).toBe("openui");
    await emit("text", { delta: 'root = Stack([TextContent("回答"), Buttons([Button("继续了解", Action([@ToAssistant("详细介绍工程经历")]))])])' });
    await emit("done", {});
    await act(async () => stream.close());
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "保留我的草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "继续了解" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).question).toBe("详细介绍工程经历");
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("保留我的草稿");
  });

  it("reports malformed OpenUI without exposing the raw program", async () => {
    render(<AskChat />);
    await sendQuestion();
    await emit("text", { delta: "not a valid program" });
    await emit("done", {});
    await act(async () => stream.close());
    expect((await screen.findByRole("alert")).textContent).toContain("回答未能完整显示");
    expect(screen.queryByText("not a valid program")).toBeNull();
  });

  it("keeps partial text and sources when stopped, without successful-answer followups", async () => {
    render(<AskChat />);
    await sendQuestion();
    await emit("sources", { sources: [source] });
    await emit("text", { delta: 'root = Stack([TextContent("已经收到的部分回答。")])' });
    fireEvent.click(screen.getByRole("button", { name: "停止生成" }));

    expect(await screen.findByText("已停止生成。")).toBeTruthy();
    expect(screen.getByText("已经收到的部分回答。")).toBeTruthy();
    fireEvent.click(screen.getByText("参考资料 · 1 篇"));
    expect(screen.getByRole("link", { name: /项目来源/ }).getAttribute("href")).toBe("/curation/source");
    expect(screen.queryByText("继续问")).toBeNull();
    expect(readAskChatSnapshot().messages.at(-1)?.content).toBe('root = Stack([TextContent("已经收到的部分回答。")])');
  });

  it("preserves text on stream error and resends the original question on retry", async () => {
    render(<AskChat />);
    await sendQuestion();
    await emit("text", { delta: 'root = Stack([TextContent("先完成的部分。")])' });
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

  it("typing a draft writes only the draft key, never the conversation", async () => {
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
      messages: [
        { citations: [], content: "项目？", id: "user-1", isComplete: true, role: "user" },
        { citations: [source], content: "已经完成的回答", id: "assistant-1", isComplete: true, role: "assistant" },
      ],
      question: "",
    }));
    render(<AskChat />);
    expect(screen.getByText("已经完成的回答")).toBeTruthy();
    const write = vi.spyOn(Storage.prototype, "setItem");
    write.mockClear();

    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" });
    for (const character of "新草稿") {
      fireEvent.change(input, { target: { value: input.value + character } });
    }

    expect(input.value).toBe("新草稿");
    expect(write.mock.calls.map(([key]) => key)).not.toContain(ASK_CHAT_STORAGE_KEY);
    expect(window.sessionStorage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY)).toBe("新草稿");
    write.mockRestore();
  });

  it("keeps the old combined snapshot untouched when writes fail, then migrates on the next open", async () => {
    const legacy = JSON.stringify({
      format: "openui",
      messages: [
        { citations: [], content: "项目？", id: "user-1", isComplete: true, role: "user" },
        { citations: [source], content: openuiText("已经完成的回答"), id: "assistant-1", isComplete: true, role: "assistant" },
      ],
      question: "迁移前的草稿",
    });
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, legacy);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    let view: ReturnType<typeof render>;
    try {
      view = render(<AskChat />);
      expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("迁移前的草稿");
      expect(screen.getByText("已经完成的回答")).toBeTruthy();
      expect(window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY)).toBe(legacy);
      view.unmount();
    } finally {
      write.mockRestore();
    }

    view = render(<AskChat />);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("迁移前的草稿");
    expect(screen.getByText("已经完成的回答")).toBeTruthy();
    expect(window.sessionStorage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY)).toBe("迁移前的草稿");
    expect(JSON.parse(String(window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY)))).not.toHaveProperty("question");
    view.unmount();
  });

  it.each(["draft key", "aggregate quota"])("preserves the legacy draft when %s rejects extraction but allows a smaller message write", (failure) => {
    const messages = [
      { citations: [], content: "项目？", id: "user-1", isComplete: true, role: "user" },
      { citations: [source], content: openuiText("已经完成的回答"), id: "assistant-1", isComplete: true, role: "assistant" },
    ];
    const legacy = JSON.stringify({ format: "openui", messages, question: "迁移前的草稿" });
    const storage = window.sessionStorage;
    const setItem = Storage.prototype.setItem;
    storage.setItem(ASK_CHAT_STORAGE_KEY, legacy);
    const quota = ASK_CHAT_STORAGE_KEY.length + legacy.length;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      let size = key.length + value.length;
      for (let index = 0; index < this.length; index++) {
        const existingKey = this.key(index)!;
        if (existingKey !== key) size += existingKey.length + this.getItem(existingKey)!.length;
      }
      if (failure === "draft key" ? key === ASK_CHAT_DRAFT_STORAGE_KEY : size > quota) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      setItem.call(this, key, value);
    });
    try {
      // This smaller overwrite is allowed under both failures; deleting question would lose the draft.
      storage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({ format: "openui", messages }));
      setItem.call(storage, ASK_CHAT_STORAGE_KEY, legacy);
      for (let open = 0; open < 2; open++) {
        const view = render(<AskChat />);
        expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("迁移前的草稿");
        expect(screen.getByText("已经完成的回答")).toBeTruthy();
        expect(storage.getItem(ASK_CHAT_STORAGE_KEY)).toBe(legacy);
        expect(storage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY)).toBeNull();
        view.unmount();
      }
    } finally {
      write.mockRestore();
    }
    render(<AskChat />);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("迁移前的草稿");
    expect(screen.getByText("已经完成的回答")).toBeTruthy();
    expect(storage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY)).toBe("迁移前的草稿");
    expect(JSON.parse(String(storage.getItem(ASK_CHAT_STORAGE_KEY)))).not.toHaveProperty("question");
  });

  it("keeps an intentionally cleared draft empty after reopening", async () => {
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
      format: "openui",
      messages: [
        { citations: [], content: "项目？", id: "user-1", isComplete: true, role: "user" },
        { citations: [source], content: openuiText("已经完成的回答"), id: "assistant-1", isComplete: true, role: "assistant" },
      ],
      question: "旧草稿",
    }));
    const view = render(<AskChat />);
    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "" } });
    expect(window.sessionStorage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY)).toBe("");
    // 模拟迁移中途关页：消息键里仍残留旧草稿副本，重开后必须以空草稿键为准。
    window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
      format: "openui",
      messages: [
        { citations: [], content: "项目？", id: "user-1", isComplete: true, role: "user" },
        { citations: [source], content: openuiText("已经完成的回答"), id: "assistant-1", isComplete: true, role: "assistant" },
      ],
      question: "旧草稿",
    }));
    view.unmount();
    render(<AskChat />);
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" }).value).toBe("");
    expect(screen.getByText("已经完成的回答")).toBeTruthy();
  });

  it("shows partial text as stopped after closing mid-stream and reopening", async () => {
    const view = render(<AskChat />);
    await sendQuestion();
    await emit("text", { delta: 'root = Stack([TextContent("关页前收到的部分回答。")])' });
    expect(screen.getByText("关页前收到的部分回答。")).toBeTruthy();
    view.unmount();

    render(<AskChat />);
    expect(screen.getByText("关页前收到的部分回答。")).toBeTruthy();
    expect(screen.getByText("已停止生成。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "发送问题" })).toBeTruthy();
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
