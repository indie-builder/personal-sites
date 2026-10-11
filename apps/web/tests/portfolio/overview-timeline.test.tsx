import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { portfolioProducts } from "@site/public-data/portfolio/products.mjs";

import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";

// 预览组件的可见性与动效策略依赖 IntersectionObserver / matchMedia；jsdom 未实现，用不触发的桩。
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
});

afterEach(cleanup);

describe("作品集总览时间线", () => {
  it("按日期升序排开作品，同日作品共用一个日期节点", () => {
    const { container } = render(<PortfolioOverview musePreviews={[{ src: "/muse.webp", alt: "" }]} />);

    const dates = [...container.querySelectorAll("time")].map((node) => node.dateTime);
    const uniqueDates = [...new Set(portfolioProducts.map((product) => product.date))].sort();
    expect(dates).toEqual(uniqueDates);

    const hrefs = portfolioProducts.map((product) => product.href);
    const links = portfolioProducts.map((product) => screen.getByRole("link", { name: `打开${product.name}` }));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(hrefs);
    // 可见顺序即时间顺序：DOM 中链接按注册表（日期升序）先后排开。
    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(hrefs);
  });

  it("轨迹以「未完待续」收尾", () => {
    render(<PortfolioOverview musePreviews={[{ src: "/muse.webp", alt: "" }]} />);
    expect(screen.getByText("未完待续")).toBeTruthy();
  });
});
