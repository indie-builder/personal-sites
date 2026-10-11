// @vitest-environment node
import { expect, test } from "vitest";
import { siteModeFromPathname } from "../lib/site-mode";

test("portfolio mode covers the overview and every product route", () => {
  expect(siteModeFromPathname("/portfolio")).toBe("portfolio");
  expect(siteModeFromPathname("/products/word-arcade")).toBe("portfolio");
  expect(siteModeFromPathname("/products/muse/some-slug")).toBe("portfolio");
});

test("information routes and lookalike prefixes stay on the information side", () => {
  for (const pathname of ["/", "/ai-news", "/curation", "/design", "/douyin", "/open-source", "/portfolio-extra", "/products"]) {
    expect(siteModeFromPathname(pathname), pathname).toBe("information");
  }
});
