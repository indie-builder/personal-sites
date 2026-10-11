import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { portfolioProducts } from "@site/public-data/portfolio/products.mjs";

import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/muse", useRouter: () => ({}) }));

// 预览与模块列表依赖 IntersectionObserver / matchMedia；jsdom 未实现，用不触发的桩。
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
    disconnect() {}
  }) as unknown as typeof ResizeObserver;
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

describe("作品集总览模块", () => {
  it("渲染七个独立模块：日期逐模块显示（同日不合并），链接与锚点 id 齐全", () => {
    const { container } = renderOverview();

    const items = [...container.querySelectorAll("li[data-portfolio-item]")];
    expect(items).toHaveLength(portfolioProducts.length);
    expect(container.querySelector("ol[data-portfolio-list]")).toBeTruthy();
    expect(container.querySelector("[data-portfolio-gallery]")).toBeTruthy();

    // 每个模块都有自己的日期（不分组、不去重），datetime 与数据源一致。
    const shownDates = items.map((item) => item.querySelector("time"));
    expect(shownDates).toHaveLength(portfolioProducts.length);
    portfolioProducts.forEach((product, index) => {
      expect(shownDates[index]?.getAttribute("datetime")).toBe(product.date);
      expect(shownDates[index]?.textContent).toBe(product.date.replaceAll("-", "."));
    });

    const hrefs = portfolioProducts.map((product) => product.href);
    const links = portfolioProducts.map((product) => screen.getByRole("link", { name: `打开${product.name}` }));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(hrefs);
    links.forEach((link, index) => {
      expect(link.id).toBe(`portfolio-work-${portfolioProducts[index].slug}`);
      expect(link.getAttribute("data-portfolio-work")).toBe(portfolioProducts[index].slug);
      expect(link.querySelector("h2")?.textContent).toContain(portfolioProducts[index].name);
      expect(link.querySelector("[data-preview-station]")).toBeTruthy();
    });
  });

  it("没有时间轴尾结点：列表仅含作品模块，无「未完待续」", () => {
    const { container } = renderOverview();
    expect(container.querySelectorAll("ol[data-portfolio-list] > li")).toHaveLength(portfolioProducts.length);
    expect(container.querySelector("li[data-timeline-end]")).toBeNull();
    expect(screen.queryByText("未完待续")).toBeNull();
  });

  it("模块外壳：无横向控制/帮助/字幕，仅保留右上角暂停预览", () => {
    renderOverview();
    expect(screen.queryByRole("region", { name: "作品列表" })).toBeTruthy();
    expect(screen.queryByText("左右滑动或拖动浏览作品，也可使用左右方向键。")).toBeNull();
    expect(screen.queryByRole("button", { name: "向前浏览作品" })).toBeNull();
    expect(screen.queryByRole("button", { name: "向后浏览作品" })).toBeNull();
    expect(screen.getByRole("button", { name: "暂停预览" })).toBeTruthy();
  });

  it("阅读线命中的可见模块成为唯一活动预览，模块本身无活动态 UI", async () => {
    const { container } = renderOverview();
    const items = [...container.querySelectorAll("li[data-portfolio-item]")];
    // jsdom 无布局：前两个模块滚过阅读线，第三个横跨阅读线，其余在下方。
    items.forEach((item, index) => {
      vi.spyOn(item, "getBoundingClientRect").mockImplementation(() =>
        index < 2 ? rect(-600, -100) : index === 2 ? rect(100, 500) : rect(600, 1000),
      );
    });

    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    const root = container.querySelector("[data-portfolio-gallery]") as HTMLElement;
    expect(root.getAttribute("data-active-preview")).toBe(portfolioProducts[2].slug);
    // 活动选择只驱动预览播放资格，不给模块加任何活动态视觉标记。
    expect(container.querySelectorAll('li[data-active="true"]')).toHaveLength(0);
    expect(container.querySelectorAll("li[data-seen]")).toHaveLength(0);

    const playing = [...container.querySelectorAll('[data-preview-playing="true"]')];
    expect(playing).toHaveLength(1);
    expect(playing[0].getAttribute("data-preview-station")).toBe(portfolioProducts[2].slug);
  });

  it("阅读线位于模块间隙时选择距离更近的可见模块", async () => {
    const { container } = renderOverview();
    const items = [...container.querySelectorAll("li[data-portfolio-item]")];
    const line = window.innerHeight * 0.35;
    items.forEach((item, index) => {
      vi.spyOn(item, "getBoundingClientRect").mockImplementation(() =>
        index === 0 ? rect(-100, line - 55) : index === 1 ? rect(line + 1, line + 300) : rect(2000, 2400),
      );
    });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(container.querySelector("[data-portfolio-gallery]")?.getAttribute("data-active-preview")).toBe("muse");
  });

  it("视口内没有可见模块时不设活动预览", async () => {
    const { container } = renderOverview();
    const items = [...container.querySelectorAll("li[data-portfolio-item]")];
    items.forEach((item) => {
      vi.spyOn(item, "getBoundingClientRect").mockImplementation(() => rect(-800, -100));
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(container.querySelector("[data-portfolio-gallery]")?.getAttribute("data-active-preview")).toBeNull();
    expect(container.querySelectorAll('[data-preview-playing="true"]')).toHaveLength(0);
  });

  it("暂停后活动模块的预览失去播放资格", async () => {
    const { container } = renderOverview();
    const items = [...container.querySelectorAll("li[data-portfolio-item]")];
    items.forEach((item, index) => {
      vi.spyOn(item, "getBoundingClientRect").mockImplementation(() =>
        index === 2 ? rect(100, 500) : rect(-600, -100),
      );
    });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(container.querySelectorAll('[data-preview-playing="true"]')).toHaveLength(1);

    await act(async () => {
      screen.getByRole("button", { name: "暂停预览" }).click();
    });
    expect(container.querySelectorAll('[data-preview-playing="true"]')).toHaveLength(0);
  });
});

describe("作品页返回出口", () => {
  it("productSlug 渲染唯一「返回作品集」锚点，直达对应模块", () => {
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
