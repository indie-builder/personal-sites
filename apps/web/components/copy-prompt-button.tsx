"use client";

import { useEffect, useRef, useState } from "react";

/** 提示词复制：按钮就地反馈结果，读屏通过 aria-live 获知。 */
export function CopyPromptButton({ label = "复制提示词", text }: { label?: string; text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2_400);
  };

  return (
    <button
      aria-live="polite"
      className="prompt-copy"
      data-state={state}
      onClick={copy}
      type="button"
    >
      {state === "copied" ? "已复制" : state === "failed" ? "复制失败，请手动选择" : label}
    </button>
  );
}
