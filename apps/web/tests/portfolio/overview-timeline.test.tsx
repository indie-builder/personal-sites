import { cleanup, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { portfolioProducts } from "@site/public-data/portfolio/products.mjs";

import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/muse", useRouter: () => ({}) }));

// 预览与时间轴依赖 IntersectionObserver / matchMedia；jsdom 未实现，用不触发的桩。
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
  }) as unknown as typeof window.ResizeObserver;
  // 身份轨的问答入口用 WAAPI；jsdom 未实现，给一个立即完成的桩。
  Element.prototype.animate ??= (() =>
    ({ finished: Promise.resolve(), cancel() {}, play() {}, pause() {} })) as unknown as typeof Element.prototype.animate;
});

afterEach(() => {
  cleanup();
});

function renderOverview() {
  return render(<PortfolioOverview musePreviews={[{ src: "/muse.webp", alt: "" }]} />);
}

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, height: bottom - top, width: 300, left: 0, right: 300, x: 0, y: top } as DOMRect;
}

describe("作品集总览时间线", () => {
  it("日期按组升序唯一显示，同日续作用短刻度衔接，链接按日期升序", () => {
    const { container } = renderOverview();

    const stops = [...container.querySelectorAll("li[data-timeline-stop]")];
    expect(stops).toHaveLength(portfolioProducts.length);

    // 每个日期只显示一次（停靠的直接子 time），顺序与数据升序一致。
    const uniqueDates = [...new Set(portfolioProducts.map((product) => product.date))];
    const shownTimes = stops.map((stop) => [...stop.children].find((child) => child.tagName === "TIME"));
    expect(shownTimes.filter(Boolean)).toHaveLength(uniqueDates.length);
    expect(shownTimes.filter(Boolean).map((time) => time?.getAttribute("datetime"))).toEqual(uniqueDates);
    uniqueDates.forEach((date, index) => {
      expect(shownTimes.filter(Boolean)[index]?.textContent).toBe(date.replaceAll("-", "."));
    });

    // 同日续作：不重复日期，改用横跨轨迹的短刻度。
    const continuationSlugs = portfolioProducts
      .filter((product, index) => index > 0 && portfolioProducts[index - 1]?.date === product.date)
      .map((product) => product.slug);
    for (const slug of continuationSlugs) {
      const stop = container.querySelector(`li[data-timeline-stop="${slug}"]`);
      expect(stop?.hasAttribute("data-continue")).toBe(true);
      expect(stop?.querySelector("time")).toBeNull();
      expect(
        [...(stop?.children ?? [])].some((child) => child.getAttribute("aria-hidden") === "true"),
      ).toBe(true);
    }

    const hrefs = portfolioProducts.map((product) => product.href);
    const links = portfolioProducts.map((product) => screen.getByRole("link", { name: `打开${product.name}` }));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(hrefs);
    links.forEach((link, index) => {
      expect(link.id).toBe(`portfolio-work-${portfolioProducts[index].slug}`);
      expect(link.getAttribute("data-portfolio-work")).toBe(portfolioProducts[index].slug);
      expect(link.querySelector("h2")?.textContent).toContain(portfolioProducts[index].name);
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

  it("纵向外壳：无横向控制/帮助/字幕，仅保留右上角暂停预览", () => {
    renderOverview();
    expect(screen.queryByRole("region", { name: "作品时间轴" })).toBeTruthy();
    expect(screen.queryByText("左右滑动或拖动浏览作品，也可使用左右方向键。")).toBeNull();
    expect(screen.queryByRole("button", { name: "向前浏览作品" })).toBeNull();
    expect(screen.queryByRole("button", { name: "向后浏览作品" })).toBeNull();
    expect(screen.getByRole("button", { name: "暂停预览" })).toBeTruthy();
  });

  it("阅读线命中的可见停靠成为唯一活动站，其预览具备播放资格", async () => {
    const { container } = renderOverview();
    const stops = [...container.querySelectorAll("li[data-timeline-stop]")];
    // jsdom 无布局：前两站滚过阅读线，第三站横跨阅读线，其余在下方。
    stops.forEach((stop, index) => {
      vi.spyOn(stop, "getBoundingClientRect").mockImplementation(() =>
        index < 2 ? rect(-600, -100) : index === 2 ? rect(100, 500) : rect(600, 1000),
      );
    });

    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    const root = container.querySelector("[data-portfolio-timeline]") as HTMLElement;
    expect(root.getAttribute("data-active-station")).toBe(portfolioProducts[2].slug);
    expect(stops[2].getAttribute("data-active")).toBe("true");
    expect(stops.filter((stop) => stop.getAttribute("data-active") === "true")).toHaveLength(1);
    expect(stops.slice(0, 3).map((stop) => stop.getAttribute("data-seen"))).toEqual(["true", "true", "true"]);
    expect(stops.slice(3).every((stop) => stop.hasAttribute("data-seen"))).toBe(false);

    const playing = [...container.querySelectorAll('[data-preview-playing="true"]')];
    expect(playing).toHaveLength(1);
    expect(playing[0].getAttribute("data-preview-station")).toBe(portfolioProducts[2].slug);
  });

  it("阅读线位于作品间隙时选择距离更近的可见停靠", async () => {
    const { container } = renderOverview();
    const stops = [...container.querySelectorAll("li[data-timeline-stop]")];
    const line = window.innerHeight * 0.35;
    stops.forEach((stop, index) => {
      vi.spyOn(stop, "getBoundingClientRect").mockImplementation(() =>
        index === 0 ? rect(-100, line - 55) : index === 1 ? rect(line + 1, line + 300) : rect(2000, 2400),
      );
    });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(container.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station")).toBe("muse");
  });

  it("视口内没有可见停靠时不设活动站", async () => {
    const { container } = renderOverview();
    const stops = [...container.querySelectorAll("li[data-timeline-stop]")];
    stops.forEach((stop) => {
      vi.spyOn(stop, "getBoundingClientRect").mockImplementation(() => rect(-800, -100));
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(container.querySelector("[data-portfolio-timeline]")?.getAttribute("data-active-station")).toBeNull();
    expect(container.querySelectorAll('li[data-active="true"]')).toHaveLength(0);
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
