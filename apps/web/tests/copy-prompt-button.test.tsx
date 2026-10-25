import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyPromptButton } from "@/components/copy-prompt-button";

const writeText = vi.fn<() => Promise<void>>();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  writeText.mockReset();
});

function stubClipboard(implementation: () => Promise<void>) {
  writeText.mockImplementation(implementation);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

describe("CopyPromptButton", () => {
  it("copies the full prompt text and reports success", async () => {
    stubClipboard(async () => {});
    render(<CopyPromptButton text={"Review this.\nKeep {{input}}."} />);
    fireEvent.click(screen.getByRole("button", { name: "复制提示词" }));
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("已复制"));
    expect(writeText).toHaveBeenCalledWith("Review this.\nKeep {{input}}.");
  });

  it("tells the reader to copy manually when the clipboard is unavailable", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    render(<CopyPromptButton text="prompt" />);
    fireEvent.click(screen.getByRole("button", { name: "复制提示词" }));
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("复制失败，请手动选择"));
  });
});
