import Link from "next/link";
import type { Route } from "next";
import { Effect } from "effect";
import {
  ArrowUpRight,
  Gamepad2,
  Globe,
  Images,
  Library,
  MessagesSquare,
  Network,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  portfolioProducts,
  readLayoutCategories,
  toolPreview,
  type PortfolioProduct,
} from "@site/public-data/portfolio/products.mjs";

import { AiChatPreview } from "./ai-chat-preview";
import { MotionVideo } from "./motion-video";
import { OverviewBookPreview } from "./overview-book-preview";
import { OverviewToolPreview } from "./overview-tool-preview";
import { WordArcadePreview } from "./word-arcade-preview";
import { PortfolioGallery } from "./portfolio-gallery";
import { PreviewStation } from "./preview-playback";
import styles from "./portfolio-overview.module.css";

export type MusePreview = { src: string; alt: string; videoSrc?: string };

const mediaShapes: Record<string, string> = {
  "word-arcade": styles.mediaArcade,
  "ai-chat": styles.mediaChat,
  "personal-sites": styles.mediaWindow,
  muse: styles.mediaMuse,
  "layout-compositions": styles.mediaShelf,
  "ai-coding-dictionary": styles.mediaGraph,
  "design-engineer-tools": styles.mediaTools,
};

/** 每个作品一枚语义图标（pawr.link/max 式模块头），不引入新的领域事实。 */
const productIcons: Record<PortfolioProduct["slug"], LucideIcon> = {
  "word-arcade": Gamepad2,
  "personal-sites": Globe,
  "layout-compositions": Library,
  muse: Images,
  "design-engineer-tools": Wrench,
  "ai-coding-dictionary": Network,
  "ai-chat": MessagesSquare,
};

const graphNodes = [
  { name: "Model", x: 58, y: 55, r: 12, color: "#bdced9" },
  { name: "Token", x: 147, y: 32, r: 10, color: "#bdced9" },
  { name: "Agent", x: 162, y: 102, r: 18, color: "#c7d6c1" },
  { name: "Harness", x: 68, y: 148, r: 11, color: "#bdced9" },
  { name: "Context", x: 261, y: 64, r: 14, color: "#c7d6c1" },
  { name: "MCP", x: 267, y: 157, r: 10, color: "#e2d3be" },
];

function DictionaryGraph() {
  return (
    <div aria-hidden="true" className={styles.graph}>
      <svg viewBox="0 0 320 196">
        <g className={styles.graphEdges}>
          {graphNodes
            .filter((node) => node.name !== "Agent")
            .map((node) => <line key={node.name} x1={162} x2={node.x} y1={102} y2={node.y} />)}
          <path d="M58 55 Q106 8 147 32 M147 32 Q211 23 261 64 M68 148 Q161 179 267 157" />
        </g>
        {graphNodes.map((node) => (
          <g key={node.name}>
            <circle cx={node.x} cy={node.y} fill={node.color} r={node.r} />
            <text textAnchor="middle" x={node.x} y={node.y - node.r - 6}>
              {node.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SiteWindow() {
  return (
    <div aria-hidden="true" className={styles.siteWindow}>
      <div className={styles.siteBar}>
        <span className={styles.dots}>
          <i />
          <i />
          <i />
        </span>
        <span className={styles.address}>default-coder.lovemyrmb.cn</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- Local committed screenshot. */}
      <img alt="" className={styles.siteShot} loading="lazy" src="/personal-sites/home.webp" />
    </div>
  );
}

function MuseMedia({ previews }: { previews: readonly MusePreview[] }) {
  const video = previews.find((preview) => preview.videoSrc);
  if (video?.videoSrc) {
    return <MotionVideo aria-hidden="true" className={styles.museVideo} poster={video.src} src={video.videoSrc} />;
  }
  const cover = previews[0];
  if (!cover) return null;
  // eslint-disable-next-line @next/next/no-img-element -- Local committed preview assets.
  return <img alt="" className={styles.museVideo} loading="lazy" src={cover.src} />;
}

function previewFor(
  product: PortfolioProduct,
  musePreviews: readonly MusePreview[],
  layoutCategories: { name: string; count: number }[],
) {
  switch (product.slug) {
    case "word-arcade":
      return <WordArcadePreview />;
    case "ai-chat":
      return <AiChatPreview compact />;
    case "ai-coding-dictionary":
      return <DictionaryGraph />;
    case "personal-sites":
      return <SiteWindow />;
    case "design-engineer-tools":
      return <OverviewToolPreview tools={toolPreview} />;
    case "muse":
      return <MuseMedia previews={musePreviews} />;
    case "layout-compositions":
      return <OverviewBookPreview categories={layoutCategories} />;
    default:
      return null;
  }
}

// 作品集总览：七个独立成块的完整链接模块（pawr.link/max 式），日期随模块各自显示；
// 模块头是语义图标 + 名称 + 右上箭头，正文左侧标语与日期、右侧真实微缩预览。
// 整个模块是一枚链接（无嵌套交互），可访问名保持「打开${name}」；不虚构阶段与数据。
export function PortfolioOverview({ musePreviews }: { musePreviews: readonly MusePreview[] }) {
  const layoutCategories = Effect.runSync(readLayoutCategories());
  return (
    <PortfolioGallery>
      {portfolioProducts.map((product) => {
        const Icon = productIcons[product.slug];
        return (
          <li className={styles.item} data-portfolio-item={product.slug} key={product.slug}>
            <Link
              aria-label={`打开${product.name}`}
              className={styles.work}
              data-portfolio-work={product.slug}
              href={product.href as Route}
              id={`portfolio-work-${product.slug}`}
            >
              <span className={styles.head}>
                <span aria-hidden="true" className={styles.badge}>
                  <Icon aria-hidden="true" size={20} strokeWidth={1.6} />
                </span>
                <h2 className={styles.title}>{product.name}</h2>
                <ArrowUpRight aria-hidden="true" className={styles.enter} size={16} strokeWidth={1.6} />
              </span>
              <span className={styles.body}>
                <span className={styles.tagline}>{product.tagline}</span>
                <time className={styles.date} dateTime={product.date}>
                  {product.date.replaceAll("-", ".")}
                </time>
              </span>
              <span className={`${styles.media} ${mediaShapes[product.slug] ?? ""}`}>
                <PreviewStation slug={product.slug}>{previewFor(product, musePreviews, layoutCategories)}</PreviewStation>
              </span>
            </Link>
          </li>
        );
      })}
    </PortfolioGallery>
  );
}
