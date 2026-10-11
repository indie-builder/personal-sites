// 作品集公共数据：唯一作品注册表、灵感集(Muse)读取与小型目录投影。
// 业务读取返回 Effect；共享包不依赖 Web 与离线工具。

import { Effect } from "effect";

import rawLayouts from "./data/layouts.json" with { type: "json" };
import rawTools from "./data/tools.json" with { type: "json" };

/** 作品 id 与路由一一对应；路由文件存在性由测试校验。 */
export const portfolioProducts = [
  {
    slug: "word-arcade",
    name: "文字游乐场",
    tagline: "五款文字小游戏",
    description: "打砖块、贪吃蛇、文字射击、飞字打靶与文字跑酷。",
    date: "2026-09-29",
    href: "/products/word-arcade",
    cover: "",
  },
  {
    slug: "personal-sites",
    name: "个人网站",
    tagline: "工程记录、每日关注与开源收藏",
    description: "陈远的个人工程档案，记录工程经历、每日动态、内容收藏与开源关注。",
    date: "2026-09-09",
    href: "/products/personal-sites",
    cover: "/personal-sites/home.webp",
  },
  {
    slug: "layout-compositions",
    name: "布局参考",
    tagline: "350 种排版构图图鉴",
    description:
      "从经典构图、视觉原则到出版广告、字体网格、网页 UI、影视画面、中国传统构图与演示文稿，按 8 个分类与 33 个主题组织的排版知识图鉴。",
    date: "2026-09-03",
    href: "/products/layout-compositions",
    cover: "/layout-compositions/thumbnails/01-composition-logic/001.webp",
  },
  {
    slug: "muse",
    name: "灵感集",
    tagline: "图像、界面与动效灵感",
    description: "浏览图像、界面与动效，发现值得参考的设计与创作者。",
    date: "2026-09-03",
    href: "/products/muse",
    cover: "/inspora/thumbnails/54c9d760-395c-4ff7-8446-4432034d9f44.webp",
  },
  {
    slug: "design-engineer-tools",
    name: "设计工程工具",
    tagline: "设计工程师常用工具目录",
    description: "按灵感、AI 编程、组件、动效、三维与研究等分类整理的工具入口。",
    date: "2026-09-04",
    href: "/products/design-engineer-tools",
    cover: "",
  },
  {
    slug: "ai-coding-dictionary",
    name: "AI Coding 词典",
    tagline: "在知识网中探索 AI Coding 术语",
    description: "通过可搜索的知识网阅读 AI Coding 术语，在详情中英对照。",
    date: "2026-09-25",
    href: "/products/ai-coding-dictionary",
    cover: "",
  },
  {
    slug: "ai-chat",
    name: "AI 问答",
    tagline: "和智能体一起，把问题想清楚",
    description: "选择或创建智能体，用文字、表格和交互卡片展开对话。",
    date: "2026-09-26",
    href: "/products/ai-chat",
    cover: "",
  },
].slice().sort((a, b) => a.date.localeCompare(b.date));

/** 上游项目信息（布局图鉴 CC BY 4.0 署名用）。 */
export const layoutUpstream = {
  name: "350-layout-compositions",
  author: "nevertoday",
  url: "https://github.com/nevertoday/350-layout-compositions",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};

/** 个人网站产品：统一后站点即本站，宣传片为本地公共资产。 */
export const personalSitePromo = {
  video: "/personal-sites/promo.mp4",
  poster: "/personal-sites/promo-poster.webp",
  website: "/",
  description:
    "在这里记录工程经历，也整理每天读到的动态、值得回看的内容和持续关注的开源项目。从一条摘要进入完整阅读，再回到原始来源。",
};

/**
 * 布局图鉴公共投影（350 条，顺序与上游一致）。image 为投影时物化的最终地址
 * （本地 WebP 或 jsDelivr CDN 热链），上游缺失的条目为 null。
 */
export const layoutEntries = rawLayouts.map((item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  categorySlug: item.cat,
  subcategory: item.sub,
  subcategorySlug: item.subSlug,
  width: item.width,
  height: item.height,
  image: item.image,
  thumb: item.thumb,
}));

function buildLayoutCategories(items) {
  const categories = [];
  const bySlug = new Map();
  const subBySlug = new Map();
  for (const item of items) {
    let category = bySlug.get(item.categorySlug);
    if (!category) {
      category = { slug: item.categorySlug, name: item.category, count: 0, subcategories: [] };
      bySlug.set(item.categorySlug, category);
      categories.push(category);
    }
    category.count += 1;
    const subKey = `${item.categorySlug}/${item.subcategorySlug}`;
    let subcategory = subBySlug.get(subKey);
    if (!subcategory) {
      subcategory = { slug: item.subcategorySlug, name: item.subcategory, count: 0 };
      subBySlug.set(subKey, subcategory);
      category.subcategories.push(subcategory);
    }
    subcategory.count += 1;
  }
  return categories;
}

const layoutCategories = buildLayoutCategories(layoutEntries);
const layoutById = new Map(layoutEntries.map((item) => [item.id, item]));

/** 全部布局条目（Effect 读取，供 HTTP/RSC 边界执行）。 */
export const readLayoutEntries = () => Effect.succeed(layoutEntries);

/** 布局分类（含二级分类与计数，按上游顺序）。 */
export const readLayoutCategories = () => Effect.succeed(layoutCategories);

export function readLayoutById(id) {
  return Effect.succeed(layoutById.get(id) ?? null);
}

/** 设计工程工具目录（同步产出即公共投影）。 */
export const toolCatalog = rawTools;
export const toolCategories = rawTools.categories;
export const toolPreview = toolCategories.slice(0, 4).flatMap((category) => category.tools.slice(0, 1));

export const readToolCategories = () => Effect.succeed(toolCategories);
