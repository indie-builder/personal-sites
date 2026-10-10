import { cleanup, fireEvent, render, renderHook, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskChat } from "@/components/ask-chat";
import { ASK_CHAT_STORAGE_KEY } from "@/components/ask-chat-snapshot";

import { useAskConversation } from "@/components/use-ask-conversation";

// Count renders while keeping the real OpenUI renderer.
const rendererInstances = vi.hoisted(() => new Map<string, number>());

vi.mock("@openuidev/react-lang", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openuidev/react-lang")>();
  const react = await import("react");
  return {
    ...actual,
    Renderer: function CountingRenderer(props: React.ComponentProps<typeof actual.Renderer>) {
      const id = react.useId();
      rendererInstances.set(id, (rendererInstances.get(id) ?? 0) + 1);
      return <actual.Renderer {...props} />;
    },
  };
});

function openuiText(text: string) {
  return `root = Stack([TextContent(${JSON.stringify(text)})])`;
}

function seedCompletedConversation(failed = false) {
  window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
    format: "openui",
    messages: [
      { citations: [], content: "第一轮的问题", id: "user-1", isComplete: true, role: "user" },
      { citations: [], content: openuiText("第一轮已完成的回答"), id: "assistant-1", isComplete: true, role: "assistant" },
      { citations: [], content: "第二轮的问题", id: "user-2", isComplete: true, role: "user" },
      { citations: [], content: openuiText("第二轮已完成的回答"), id: "assistant-2", interruption: failed ? { kind: "error", message: "连接中断" } : undefined, isComplete: true, role: "assistant" },
    ],
    question: "",
  }));
}

describe("AskChat stable historical message rendering", () => {
  let stream: ReadableStreamDefaultController<Uint8Array>;
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    rendererInstances.clear();
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

  async function emit(event: string, data: unknown) {
    await act(async () => stream.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)));
  }

  it("returns submission completion and blocks synchronous duplicate requests", async () => {
    const onStarted = vi.fn();
    const { result } = renderHook(() => useAskConversation(onStarted));
    let completion: Promise<void>;
    let completed = false;
    act(() => {
      completion = result.current.submit("第一问");
      void completion.then(() => { completed = true; });
      void result.current.submitQuestion("重复提交");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(completed).toBe(false);
    expect(onStarted).toHaveBeenCalledTimes(1);
    await act(async () => {
      stream.close();
      await completion;
    });
    expect(completed).toBe(true);
    act(() => { void result.current.submitQuestion("下一问"); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => stream.close());
  });

  it.each([false, true])("does not re-render historical answers while typing a draft (failed=%s)", async (failed) => {
    seedCompletedConversation(failed);
    render(<AskChat />);
    await waitFor(() => expect(screen.getByText("第二轮已完成的回答")).toBeTruthy());
    expect(rendererInstances.size).toBe(2);
    const baseline = new Map(rendererInstances);

    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "输入问题" });
    for (const character of "新草稿") {
      fireEvent.change(input, { target: { value: input.value + character } });
    }
    expect(input.value).toBe("新草稿");
    expect(screen.getByText("第一轮已完成的回答")).toBeTruthy();
    for (const [id, count] of baseline) {
      expect(rendererInstances.get(id)).toBe(count);
    }
  });

  it("keeps historical answers frozen while a new answer streams", async () => {
    seedCompletedConversation();
    render(<AskChat />);
    await waitFor(() => expect(screen.getByText("第二轮已完成的回答")).toBeTruthy());
    const baselineIds = new Set(rendererInstances.keys());

    fireEvent.change(screen.getByRole("textbox", { name: "输入问题" }), { target: { value: "第三轮的问题" } });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await emit("text", { delta: 'root = Stack([TextContent("第三轮' });
    // 开始流式后取基线：此后每个流式增量只更新正在生成的回答。
    const duringStream = new Map(rendererInstances);
    const streamedId = [...duringStream.keys()].find((id) => !baselineIds.has(id));

    await emit("text", { delta: '正在流式输出")])' });
    for (const [id, count] of duringStream) {
      if (id === streamedId) continue;
      expect(rendererInstances.get(id)).toBe(count);
    }

    await emit("done", {});
    await act(async () => stream.close());
    await waitFor(() => expect(screen.getByRole("button", { name: "发送问题" })).toBeTruthy());
    expect(screen.getByText("第三轮正在流式输出")).toBeTruthy();
    // 流式结束只允许一次真实属性变化引起的重渲染（追问回调恢复）。
    for (const [id, count] of duringStream) {
      if (id === streamedId) continue;
      expect(rendererInstances.get(id)).toBe(count + 1);
    }
    expect(rendererInstances.get(streamedId as string)).toBeGreaterThan(duringStream.get(streamedId as string) as number);
  });
});
