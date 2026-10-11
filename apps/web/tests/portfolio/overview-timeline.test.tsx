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

describe("作品集总览图版流", () => {
  it("按日期升序排开作品，每段图版带自己的日期题注", () => {
    const { container } = render(<PortfolioOverview musePreviews={[{ src: "/muse.webp", alt: "" }]} />);

    const dates = [...container.querySelectorAll("time")].map((node) => node.dateTime);
    expect(dates).toEqual(portfolioProducts.map((product) => product.date));
    expect(dates).toEqual([...dates].sort());

    const hrefs = portfolioProducts.map((product) => product.href);
    const links = portfolioProducts.map((product) => screen.getByRole("link", { name: `打开${product.name}` }));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(hrefs);
    // 可见顺序即时间顺序：DOM 中链接按注册表（日期升序）先后排开。
    expect([...container.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(hrefs);
    // 预览在题注之前：媒体是图版主体，名称与日期是其题注。
    for (const link of links) {
      const [first, second] = [...(link?.children ?? [])];
      expect(first?.className).toContain("media");
      expect(second?.className).toContain("caption");
    }
  });

  it("轨迹以「未完待续」收尾", () => {
    render(<PortfolioOverview musePreviews={[{ src: "/muse.webp", alt: "" }]} />);
    expect(screen.getByText("未完待续")).toBeTruthy();
  });
});
