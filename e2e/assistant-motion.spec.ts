import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => sessionStorage.setItem("personal-site:opening-loader-played", "true"));
  await page.goto("/curation");
  await expect(page.locator("[data-profile-line]").first()).toBeVisible();
});

test("greeting width does not move the assistant's coordinate origin", async ({ page }) => {
  const drift = await page.evaluate(() => {
    const title = document.getElementById("profile-introduction")!;
    const walker = document.querySelector('[aria-label="和像素助手聊聊"]')!.parentElement!;
    walker.getAnimations().forEach((animation) => animation.pause());
    title.textContent = "Hello,";
    const before = walker.getBoundingClientRect().x;
    title.textContent = "こんにちは、";
    return walker.getBoundingClientRect().x - before;
  });
  expect(Math.abs(drift)).toBeLessThan(1);
});

test("assistant starts at the first biography line instead of the greeting", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const assistant = page.getByRole("button", { name: "和像素助手聊聊" });
  await expect(assistant).toBeEnabled();
  const position = await assistant.evaluate((element) => {
    const character = element.getBoundingClientRect();
    const firstLine = document.querySelector("[data-profile-line]")!.getBoundingClientRect();
    return { x: character.left - firstLine.left, y: firstLine.top - character.bottom, inBody: !!element.closest(".profile-body-assistant") };
  });
  expect(position.inBody).toBe(true);
  expect(Math.abs(position.x)).toBeLessThan(1);
  expect(Math.abs(position.y)).toBeLessThan(3);
});

test("first downward jump survives greeting changes and lands before text recoil", async ({ page }) => {
  const walker = page.locator('[aria-label="和像素助手聊聊"]').locator("..");
  await expect.poll(() => walker.evaluate((element) => element.getAnimations().length)).toBeGreaterThan(0);
  await walker.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
  await expect(walker).toHaveAttribute("data-motion", "jump");
  const result = await walker.evaluate(async (element) => {
    const jump = element.getAnimations()[0];
    jump.pause();
    jump.currentTime = 300;
    const before = element.getBoundingClientRect().top;
    document.getElementById("profile-introduction")!.textContent = "こんにちは、";
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const cancelled = jump.playState === "idle";
    const after = element.getBoundingClientRect().top;
    const line = document.querySelectorAll<HTMLElement>("[data-profile-line]")[1];
    const earlyRecoil = line.getAnimations().length;
    if (!cancelled) jump.finish();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return {
      cancelled, drift: after - before, earlyRecoil,
      landedLane: element.getAttribute("data-lane"),
      footGap: line.getBoundingClientRect().top - element.getBoundingClientRect().bottom,
      recoil: line.getAnimations().length,
    };
  });
  expect(result.cancelled).toBe(false);
  expect(Math.abs(result.drift)).toBeLessThan(1);
  expect(result.earlyRecoil).toBe(0);
  expect(result.landedLane).toBe("1");
  expect(Math.abs(result.footGap)).toBeLessThan(3);
  expect(result.recoil).toBe(1);
});

test("the sprite actually descends on its first jump without inserting text lines", async ({ page }) => {
  const walker = page.locator('[aria-label="和像素助手聊聊"]').locator("..");
  await expect.poll(() => walker.evaluate((element) => element.getAnimations().length)).toBeGreaterThan(0);
  const initial = await walker.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    lines: document.querySelectorAll("[data-profile-line]").length,
  }));
  // Only skip the long horizontal walk; let the entire jump play in real time.
  await walker.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
  await expect(walker).toHaveAttribute("data-motion", "jump");
  await page.locator("#profile-introduction").evaluate((element) => { element.textContent = "こんにちは、"; });
  await expect(walker).toHaveAttribute("data-lane", "1");
  await expect.poll(() => walker.evaluate((element) => Math.abs(
    document.querySelectorAll("[data-profile-line]")[1].getBoundingClientRect().top - element.getBoundingClientRect().bottom,
  ))).toBeLessThan(3);
  expect(await walker.evaluate((element) => element.getBoundingClientRect().top) - initial.top).toBeGreaterThan(15);
  await expect(page.locator("[data-profile-line]")).toHaveCount(initial.lines);
});

test("assistant enters only after the English-to-Chinese introduction finishes", async ({ page }) => {
  await page.goto("/");
  const introduction = page.locator(".curation-home__bio");
  const assistant = page.getByRole("button", { name: "和像素助手聊聊" });
  for (const phase of ["english", "erasing", "chinese"]) {
    await expect(introduction).toHaveAttribute("data-introduction-phase", phase, { timeout: 20_000 });
    await expect(assistant).toHaveCount(0);
  }
  await expect(introduction).toHaveAttribute("data-introduction-phase", "complete", { timeout: 20_000 });
  await expect(assistant).toHaveCount(1);
  await expect(assistant).toBeEnabled();
  const state = await assistant.evaluate((button) => ({
    entered: button.closest("[data-entered]")?.getAttribute("data-entered"),
    transform: getComputedStyle(button.querySelector("svg")!.parentElement!).transform,
  }));
  expect(state.entered).toBe("true");
  expect(state.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
});

for (const closeWith of ["button", "Escape"] as const) {
  test(`assistant resumes walking after closing chat with ${closeWith}`, async ({ page }) => {
    const assistant = page.getByRole("button", { name: "和像素助手聊聊" });
    await assistant.click();
    await expect(page.getByRole("dialog", { name: "问一问" })).toBeVisible();
    if (closeWith === "button") {
      await page.getByRole("button", { name: "关闭问一问" }).click();
    } else {
      await page.mouse.move(0, 0);
      await page.keyboard.press("Escape");
    }
    await expect(assistant).toBeDisabled();
    const initialEntry = await assistant.evaluate((button) => ({
      entered: button.closest("[data-entered]")?.getAttribute("data-entered"),
      position: new DOMMatrixReadOnly(getComputedStyle(button.parentElement!).transform).toFloat64Array().slice(12, 14).join(","),
    }));
    expect(initialEntry.entered).toBe("false");
    expect(initialEntry.position.split(",").every((value) => Math.abs(Number(value)) < 1)).toBe(true);
    await expect(page.getByRole("dialog", { name: "问一问" })).toBeHidden();
    await expect(assistant).toBeEnabled();
    await expect(assistant).toBeFocused();
    const walker = assistant.locator("..");
    await expect.poll(() => walker.evaluate((element) => element.getAnimations().some((animation) => animation.playState === "running")), { timeout: 3000 }).toBe(true);
    const before = await walker.boundingBox();
    await expect.poll(async () => {
      const after = await walker.boundingBox();
      return Math.hypot(after!.x - before!.x, after!.y - before!.y);
    }, { timeout: 3000 }).toBeGreaterThan(2);
  });
}
