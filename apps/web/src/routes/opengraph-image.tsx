import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { resolveBundledFontFile } from "@/lib/bundled-file";
import { SITE_NAME } from "@/lib/site";

const SIZE = { width: 1200, height: 630 } as const;

// 内嵌字体的运行时读取：dev 与产物分别按定位链找到磁盘路径。
async function loadOgFont(): Promise<Buffer> {
  return readFile(resolveBundledFontFile("noto-sans-sc-og.ttf"));
}

// 原 next/og ImageResponse 的等价物：satori 出 SVG，resvg 栅格化为 PNG。
// satori 要求每个节点显式 display:flex，样式树与迁移前保持一致。
async function renderOpenGraphImage() {
  const font = await loadOgFont();
  const svg = await satori(
    <div
      style={{
        alignItems: "stretch",
        background: "#f8f8f8",
        color: "#1c1c1e",
        display: "flex",
        fontFamily: "Noto Sans SC",
        height: "100%",
        padding: "72px",
        width: "100%",
      }}
    >
      <div style={{ borderLeft: "2px solid #1c1c1e", display: "flex", flexDirection: "column", justifyContent: "space-between", paddingLeft: "44px", width: "100%" }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: "0.08em" }}>CHEN YUAN · AGENT ENGINEERING</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 600, letterSpacing: "-0.05em" }}>运行中的工程档案</div>
          <div style={{ color: "#656568", display: "flex", fontSize: 30, marginTop: "24px" }}>持续输入 · 独立判断 · 真实构建</div>
        </div>
        <div style={{ display: "flex", fontSize: 24 }}>default-coder.lovemyrmb.cn</div>
      </div>
    </div>,
    {
      ...SIZE,
      fonts: [{ data: font, name: "Noto Sans SC", style: "normal", weight: 600 }],
    },
  );
  return new Resvg(svg, { fitTo: { mode: "width", value: SIZE.width } }).render().asPng();
}

export const Route = createFileRoute("/opengraph-image")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const png = await renderOpenGraphImage();
          // 图片内容随部署冻结：长 CDN 缓存 + 后台再生窗口。
          return new Response(png, {
            headers: {
              "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
              "Content-Type": "image/png",
            },
          });
        } catch (error) {
          console.error("生成站点分享图失败", error);
          return new Response("opengraph image unavailable", { status: 500 });
        }
      },
    },
  },
});
