import type { ChatMessage } from "@/components/ask-chat-snapshot";
import type { AskSource } from "@/lib/ask-types";

export type AskStreamEvent = {
  data: Record<string, unknown>;
  event: string;
};

/** 把 SSE 文本缓冲切分为完整事件，返回剩余的不完整尾巴留待下个数据块。 */
export function parseEvents(buffer: string) {
  const chunks = buffer.split("\n\n");
  const remainder = chunks.pop() ?? "";
  const events = chunks.flatMap((chunk) => {
    const event = /^event:\s*(.+)$/m.exec(chunk)?.[1];
    const data = /^data:\s*(.+)$/m.exec(chunk)?.[1];
    if (!event || !data) return [];
    try {
      return [{ data: JSON.parse(data) as Record<string, unknown>, event }];
    } catch {
      return [];
    }
  });
  return { events, remainder };
}

// SSE 事件按类型收敛到单处：返回应用事件后的消息；无法识别或不合法的事件原样返回。
export function applyStreamEvent(message: ChatMessage, event: AskStreamEvent): ChatMessage {
  switch (event.event) {
    case "done":
      return { ...message, isComplete: true };
    case "error":
      return {
        ...message,
        interruption: {
          kind: "error",
          message: typeof event.data.message === "string" ? event.data.message : "回答暂时不可用，请稍后重试。",
        },
        isComplete: true,
      };
    case "sources":
      return Array.isArray(event.data.sources)
        ? { ...message, citations: event.data.sources as AskSource[] }
        : message;
    case "text":
      return typeof event.data.delta === "string"
        ? { ...message, content: `${message.content}${event.data.delta}` }
        : message;
    default:
      return message;
  }
}
