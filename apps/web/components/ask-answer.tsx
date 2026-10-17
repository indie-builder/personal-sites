"use client";

// 随 Ask 面板的懒加载 chunk 一起下发，避免首屏全局 CSS 多背约 34KB(gzip)。
import "@openuidev/react-ui/components.css";
// 公式样式与 overrides 固定的 KaTeX renderer 同版，随 Ask 一起懒加载。
import "katex/dist/katex.min.css";

import { Renderer, type ActionEvent, type OpenUIError, type ParseResult } from "@openuidev/react-lang";
import { ThemeProvider, safeOpenUrl, type Theme } from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";

import { memo, useCallback, useState } from "react";

const theme: Theme = {
  fontBody: "var(--font-sans)",
  fontHeading: "var(--font-sans)",
  fontLabel: "var(--font-sans)",
  textBodyDefault: "400 13px/1.65 var(--font-sans)",
  textBodySm: "400 13px/1.65 var(--font-sans)",
  textHeadingSm: "610 14px/1.45 var(--font-sans)",
  textHeadingMd: "610 14px/1.45 var(--font-sans)",
};

export const AskAnswer = memo(function AskAnswer({ source, isStreaming, onContinue }: {
  source: string;
  isStreaming: boolean;
  onContinue?: (question: string) => void;
}) {
  const [invalid, setInvalid] = useState(false);
  const [hasRoot, setHasRoot] = useState(true);
  const onError = useCallback((errors: OpenUIError[]) => setInvalid(errors.length > 0), []);
  const onParseResult = useCallback((result: ParseResult | null) => setHasRoot(Boolean(result?.root)), []);
  const onAction = (event: ActionEvent) => {
    if (isStreaming) return;
    if (event.type === "open_url" && typeof event.params.url === "string") safeOpenUrl(event.params.url);
    if (event.type === "continue_conversation") {
      const question = event.humanFriendlyMessage.trim();
      if (question.length >= 2 && question.length <= 1_000) onContinue?.(question);
    }
  };

  return (
    <div className="ask-openui">
      <ThemeProvider cssSelector=".ask-openui" lightTheme={theme} mode="light">
        <Renderer
          isStreaming={isStreaming}
          library={openuiLibrary}
          onAction={onAction}
          onError={onError}
          onParseResult={onParseResult}
          publishObservability={false}
          response={source}
        />
      </ThemeProvider>
      {!isStreaming && (invalid || !hasRoot) ? <p role="alert">回答未能完整显示，请重新提问。</p> : null}
    </div>
  );
});
