import type { Browser } from "@e2e-dev/web";

export type AvatarMeta = { label: string | null; shape: string | null; state: string | null };

export const readAvatarMeta = async (browser: Browser): Promise<AvatarMeta | null> => {
  const raw = await browser.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(".curation-home__avatar");
    if (!button) return null;
    return {
      label: button.getAttribute("aria-label"),
      shape: button.getAttribute("data-avatar-shape"),
      state: button.getAttribute("data-avatar-state"),
    };
  });
  return raw as AvatarMeta | null;
};

// 画布像素指纹：等值比较证明「同一画面」，不等值证明「真实像素在动」。
export const readCanvasDigest = async (browser: Browser): Promise<string | null> => {
  const raw = await browser.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
    if (!canvas || canvas.width === 0) return null;
    const url = canvas.toDataURL();
    let h = 0x811c9dc5;
    for (let i = 0; i < url.length; i += 1) {
      h ^= url.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  });
  return raw as string | null;
};
