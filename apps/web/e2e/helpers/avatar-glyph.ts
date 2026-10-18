import type { Browser } from "@e2e-dev/web";

export const readCenter = (browser: Browser) => browser.evaluate(() => {
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  if (!canvas || !canvas.width) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.ceil(height * 0.7);
  let ink = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      total += 1;
      if (data[(y * width + x) * 4 + 3] > 0) ink += 1;
    }
  }
  return ink / total;
});

// 相同占据格下的差异格数。
export const gridDistance = (a: string, b: string) => {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff;
};

// 页内绘制字形参照：与组件同系统中文字体栈、同包围盒居中策略，返回
// 12x12 占据格，仅用于比对，不引用组件内部。
export const renderGlyphReference = (browser: Browser, char: string) =>
  browser.evaluate((char: string) => {
    const G = 12;
    const SRC = 200;
    const INSET = 0.1;
    const off = document.createElement("canvas");
    off.width = SRC;
    off.height = SRC;
    const ctx = off.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(SRC * 0.78)}px -apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif`;
    ctx.fillText(char, SRC / 2, SRC / 2);
    const { data } = ctx.getImageData(0, 0, SRC, SRC);
    let minX = SRC;
    let minY = SRC;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < SRC; y += 1) {
      for (let x = 0; x < SRC; x += 1) {
        if (data[(y * SRC + x) * 4 + 3] >= 128) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    const span = 1 - INSET * 2;
    const scale = Math.min(span / (maxX - minX + 1), span / (maxY - minY + 1));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cells = new Array<boolean>(G * G).fill(false);
    // 每格 3x3 采样点，格内有墨即置位，与粒子场的占据语义一致。
    for (let gy = 0; gy < G; gy += 1) {
      for (let gx = 0; gx < G; gx += 1) {
        for (let sy = 0; sy < 3 && !cells[gy * G + gx]; sy += 1) {
          for (let sx = 0; sx < 3; sx += 1) {
            const nx = (gx + (sx + 0.5) / 3) / G;
            const ny = (gy + (sy + 0.5) / 3) / G;
            const px = Math.round(cx + (nx - 0.5) / scale);
            const py = Math.round(cy + (ny - 0.5) / scale);
            if (px < 0 || py < 0 || px >= SRC || py >= SRC) continue;
            if (data[(py * SRC + px) * 4 + 3] >= 128) {
              cells[gy * G + gx] = true;
              break;
            }
          }
        }
      }
    }
    return cells.map((v) => (v ? "1" : "0")).join("");
  }, char);
