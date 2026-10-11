import { cleanup, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { portfolioProducts } from "@site/public-data/portfolio/products.mjs";

import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/muse", useRouter: () => ({}) }));

// 预览与时间轴依赖 IntersectionObserver / matchMedia / ResizeObserver；jsdom 未实现，用不触发的桩。
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  })) as unknown as typeof window.matchMedia;
  window.IntersectionObserver ??= (class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }) as unknown as typeof IntersectionObserver;
  window.ResizeObserver ??= (class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }) as unknown as typeof ResizeObserver;
  window.scrollTo = scrollToMock as unknown as typeof window.scrollTo;
  // 身份轨的问答入口用 WAAPI；jsdom 未实现，给一个立即完成的桩。
  Element.prototype.animate ??= (() =>
    ({ finished: Promise.resolve(), cancel() {}, play() {}, pause() {} })) as unknown as typeof Element.prototype.animate;
});

beforeEach(() => {
  history.replaceState(null, "");
  window.location.hash = "";
  history.replaceState(null, "");
  sessionStorage.clear();
  scrollToMock.mockClear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const SESSION_KEY = "personal-site:portfolio-return:v1";
const scrollToMock = vi.fn();

function validSnapshot(overrides: Record<string, unknown> = {}) {
  return { v: 1, slug: "muse", offset: 120, viewportWidth: 800, focus: "link", ...overrides };
}

function renderOverview() {
  return render(<PortfolioOverview musePreviews={[{ src: "/muse.webp", alt: "" }]} />);
}

describe("作品集总览时间线", () => {
  it("每个停靠显示自己的真实日期（同日作品也各自成站），链接按日期升序", () => {
    const { container } = renderOverview();

    const stops = [...container.querySelectorAll("li[data-timeline-stop]")];
    expect(stops.map((stop) => stop.querySelector("time")?.getAttribute("datetime"))).toEqual(
      portfolioProducts.map((product) => product.date),
    );
    expect(container.querySelectorAll("li[data-timeline-stop] > time")).toHaveLength(portfolioProducts.length);

    const hrefs = portfolioProducts.map((product) => product.href);
    const links = portfolioProducts.map((product) => screen.getByRole("link", { name: `打开${product.name}` }));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(hrefs);
    links.forEach((link, index) => {
      expect(link.id).toBe(`portfolio-work-${portfolioProducts[index].slug}`);
      expect(link.getAttribute("data-portfolio-work")).toBe(portfolioProducts[index].slug);
    });
  });

  it("轨迹以「未完待续」收尾：无链接、无预览、无日期", () => {
    const { container } = renderOverview();
    const tail = container.querySelector("li[data-timeline-end]");
    expect(tail).toBeTruthy();
    expect(within(tail as HTMLElement).getByText("未完待续")).toBeTruthy();
    expect(tail?.querySelector("a")).toBeNull();
    expect(tail?.querySelector("[data-preview-station]")).toBeNull();
    expect(tail?.querySelector("time")).toBeNull();
  });

  it("外壳契约：region/帮助文本/箭头按钮/字幕，且只有活动停靠的预览具备播放资格", () => {
    const { container } = renderOverview();

    const region = document.getElementById("portfolio-timeline");
    expect(region?.getAttribute("role")).toBe("region");
    expect(region?.getAttribute("aria-label")).toBe("作品时间轴");
    expect(region?.getAttribute("tabindex")).toBe("0");
    const helpId = region?.getAttribute("aria-describedby");
    expect(helpId).toBe("portfolio-timeline-help");
    expect(document.getElementById("portfolio-timeline-help")?.textContent).toBe(
      "左右滑动或拖动浏览作品，也可使用左右方向键。",
    );

    const root = container.querySelector("[data-portfolio-timeline]") as HTMLElement;
    expect(root.getAttribute("data-active-station")).toBe(portfolioProducts[0].slug);
    expect(container.querySelectorAll('li[data-active="true"]')).toHaveLength(1);
    expect(root.querySelector("[data-timeline-caption]")?.textContent).toBe(
      `${portfolioProducts[0].name} · 1 / ${portfolioProducts.length}`,
    );

    const previous = screen.getByRole("button", { name: "向前浏览作品" });
    const next = screen.getByRole("button", { name: "向后浏览作品" });
    for (const button of [previous, next]) {
      expect(button.getAttribute("aria-controls")).toBe("portfolio-timeline");
    }
    expect(previous.getAttribute("data-direction")).toBe("previous");
    expect(next.getAttribute("data-direction")).toBe("next");
    expect((previous as HTMLButtonElement).disabled).toBe(true);

    const playing = [...container.querySelectorAll('[data-preview-playing="true"]')];
    expect(playing).toHaveLength(1);
    expect(playing[0].getAttribute("data-preview-station")).toBe(portfolioProducts[0].slug);
    expect(container.querySelectorAll('[data-preview-playing="false"]')).toHaveLength(portfolioProducts.length - 1);
  });
});

describe("时间轴快照恢复", () => {
  it("挂载（含 Strict Mode 双挂载）不写入初始零位快照", async () => {
    render(
      <StrictMode>
        <PortfolioOverview musePreviews={[{ src: "/muse.webp", alt: "" }]} />
      </StrictMode>,
    );
    await act(async () => {});
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect((history.state as Record<string, unknown> | null)?.portfolioTimeline ?? null).toBeNull();
  });

  it("滚动停稳后写入当前停靠快照", async () => {
    renderOverview();
    const viewport = document.getElementById("portfolio-timeline") as HTMLElement;
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      viewport.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const snapshot = (history.state as Record<string, unknown> | null)?.portfolioTimeline as Record<string, unknown>;
    expect(snapshot?.slug).toBe(portfolioProducts[0].slug);
    expect(snapshot?.focus).toBe("none");
  });

  it("坏存储与无效快照不致崩溃，回到首个停靠", () => {
    sessionStorage.setItem(SESSION_KEY, "{oops");
    history.replaceState(
      {
        portfolioTimeline: { v: 2, slug: "ghost", offset: -5, viewportWidth: 0, pageY: Number.NaN, focus: "sideways" },
      },
      "",
    );
    const { container } = renderOverview();
    expect(container.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station")).toBe(
      portfolioProducts[0].slug,
    );
  });

  it("哈希指向的停靠优先：会话快照 slug 不匹配时对齐哈希站点且不清除记录", () => {
    window.location.hash = "#portfolio-work-muse";
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validSnapshot({ slug: "word-arcade" })));
    const { container } = renderOverview();
    expect(container.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station")).toBe("muse");
    expect(document.activeElement?.id).toBe("portfolio-work-muse");
    expect(sessionStorage.getItem(SESSION_KEY)).toContain("word-arcade");
  });

  it("浏览器后退优先恢复当前历史条目，而非旧哈希与较新的会话记录", () => {
    window.location.hash = "#portfolio-work-muse";
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validSnapshot({ slug: "muse" })));
    history.replaceState({ portfolioTimeline: validSnapshot({ slug: "ai-chat" }) }, "");
    const { container } = renderOverview();
    expect(container.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station")).toBe("ai-chat");
    expect(document.activeElement?.id).toBe("portfolio-work-ai-chat");
  });

  it("宽度变化后的返回按停靠对齐，页面纵向恢复交给浏览器", () => {
    window.location.hash = "#portfolio-work-muse";
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(validSnapshot({ slug: "muse", viewportWidth: 800 })));
    const { container } = renderOverview();
    // jsdom 测得宽度与 800 不符：走站点对齐路径，而不是应用保存的横向偏移。
    expect(container.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station")).toBe("muse");
    expect(document.activeElement?.id).toBe("portfolio-work-muse");
    expect(scrollToMock).not.toHaveBeenCalled();
  });
});

describe("作品页返回出口", () => {
  it("productSlug 渲染唯一「返回作品集」锚点，直达对应停靠", () => {
    render(
      <PortfolioShell label="灵感集" productSlug="muse">
        <p>detail</p>
      </PortfolioShell>,
    );
    const anchor = screen.getByRole("link", { name: "返回作品集" });
    expect(anchor.getAttribute("href")).toBe("/portfolio#portfolio-work-muse");
    expect(anchor.hasAttribute("data-portfolio-return")).toBe(true);
  });

  it("总览自身不渲染返回出口", () => {
    render(
      <PortfolioShell hideMasthead label="作品集">
        <p>overview</p>
      </PortfolioShell>,
    );
    expect(screen.queryByRole("link", { name: "返回作品集" })).toBeNull();
  });
});
