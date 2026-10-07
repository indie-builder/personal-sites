import { expect, test } from "./helpers/loader-key.ts";
import type { Browser } from "@e2e-dev/web";

const LONG_MEDIA_DETAIL_PATH = "/curation/2093968800316293400";

// 框架 locator 无 evaluate：布局读取走 browser.evaluate，页内自带单匹配校验，
// 与旧 locator 的严格单元素解析同语义。
async function readSpreadLayout(browser: Browser) {
  return browser.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".curation-detail__body")!;
    const evidence = document.querySelector<HTMLElement>(".curation-detail__evidence")!;
    const reading = document.querySelector<HTMLElement>(".curation-detail__reading")!;
    if (!body || !evidence || !reading) throw new Error("spread layout nodes missing");
    const evidenceBox = evidence.getBoundingClientRect();
    const readingBox = reading.getBoundingClientRect();
    const evidenceStyle = getComputedStyle(evidence);

    return {
      bodyColumns: getComputedStyle(body).gridTemplateColumns,
      evidence: {
        bottom: evidenceBox.bottom,
        clientHeight: evidence.clientHeight,
        overflowY: evidenceStyle.overflowY,
        position: evidenceStyle.position,
        scrollHeight: evidence.scrollHeight,
        width: evidenceBox.width,
        x: evidenceBox.x,
        y: evidenceBox.y,
      },
      reading: {
        width: readingBox.width,
        x: readingBox.x,
        y: readingBox.y,
      },
    };
  });
}

test("curation spread uses one column until 1200px, then restores sticky facing pages", async ({ app, browser }) => {
  for (const width of [901, 1_199]) {
    await browser.setViewport({ height: 900, width });
    await app.open(LONG_MEDIA_DETAIL_PATH);
    await expect(browser.locator(".curation-detail__body")).toBeVisible();

    const layout = await readSpreadLayout(browser);
    expect(layout.bodyColumns.trim().split(/\s+/u)).toHaveLength(1);
    expect(layout.evidence.position).toBe("static");
    expect(layout.evidence.overflowY).toBe("visible");
    expect(layout.evidence.clientHeight).toBe(layout.evidence.scrollHeight);
    expect(layout.reading.y).toBeGreaterThan(layout.evidence.bottom);
    expect(layout.reading.x).toBeCloseTo(layout.evidence.x, 1);
    expect(layout.reading.width).toBeCloseTo(layout.evidence.width, 1);
  }

  for (const width of [1_200, 1_440]) {
    await browser.setViewport({ height: 900, width });
    await app.open(LONG_MEDIA_DETAIL_PATH);
    await expect(browser.locator(".curation-detail__body")).toBeVisible();

    const layout = await readSpreadLayout(browser);
    expect(layout.bodyColumns.trim().split(/\s+/u)).toHaveLength(2);
    expect(layout.evidence.position).toBe("sticky");
    expect(layout.evidence.overflowY).toBe("auto");
    expect(layout.evidence.scrollHeight).toBeGreaterThan(layout.evidence.clientHeight);
    expect(layout.reading.x).toBeGreaterThan(layout.evidence.x + layout.evidence.width);
    expect(layout.reading.y).toBeCloseTo(layout.evidence.y, 1);
  }
});

test("intermediate spread widths keep wheel scrolling on the document", async ({ app, browser }) => {
  await browser.setViewport({ height: 900, width: 901 });
  await app.open(LONG_MEDIA_DETAIL_PATH);

  const evidence = browser.locator(".curation-detail__evidence");
  const evidenceBox = await evidence.boundingBox();
  expect(evidenceBox).not.toBeNull();
  if (!evidenceBox) return;

  await browser.mouse.move(evidenceBox.x + evidenceBox.width / 2, Math.min(evidenceBox.y + 120, 760));
  await browser.mouse.wheel(0, 700);
  await expect.poll(() => browser.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await browser.evaluate(() => {
    const matches = document.querySelectorAll(".curation-detail__evidence");
    if (matches.length !== 1) throw new Error(`expected exactly one evidence pane, found ${matches.length}`);
    return (matches[0] as HTMLElement).scrollTop;
  })).toBe(0);
  // 框架无 toHaveCSS：computed style 经 poll 重读，与旧断言的重试语义一致。
  await expect.poll(() => browser.evaluate(() => {
    const matches = document.querySelectorAll(".curation-detail__article");
    if (matches.length !== 1) throw new Error(`expected exactly one article, found ${matches.length}`);
    return getComputedStyle(matches[0]).overflow;
  })).toBe("visible");
});

for (const path of [LONG_MEDIA_DETAIL_PATH, "/open-source"] as const) {
  test(`${path} keeps native BODY PageDown scrolling`, async ({ app, browser }) => {
    await browser.setViewport({ height: 640, width: 1_440 });
    await app.open(path);
    if (path === "/open-source") {
      await browser.locator('a[href^="/open-source/"]').first().click();
      await expect(browser.locator(".curation-open-source__article")).toBeVisible();
    }

    await expect.poll(() => browser.evaluate(() => document.scrollingElement!.scrollHeight)).toBeGreaterThan(640);
    await expect.poll(() => browser.evaluate(() => document.activeElement === document.body)).toBe(true);
    await browser.keyboard.press("PageDown");
    await expect.poll(() => browser.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
}

test("single-column spread keeps its layout in dark theme and on mobile", async ({ app, browser }) => {
  await browser.setViewport({ height: 900, width: 1_199 });
  await app.open(LONG_MEDIA_DETAIL_PATH);
  await browser.locator(".curation-home__profile .curation-theme-toggle").click();
  await expect(browser.locator("html")).toHaveAttribute("data-curation-theme", "dark");
  expect((await readSpreadLayout(browser)).evidence.position).toBe("static");

  await browser.setViewport({ height: 844, width: 390 });
  await browser.reload();
  const layout = await readSpreadLayout(browser);
  expect(layout.evidence.position).toBe("static");
  expect(layout.reading.y).toBeGreaterThan(layout.evidence.bottom);
  await expect(browser.locator(".curation-home__profile")).toBeHidden();
  expect(await browser.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
