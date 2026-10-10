import { Effect } from "effect";

import {
  layoutUpstream,
  layoutEntries,
  personalSitePromo,
  portfolioProducts,
  readLayoutCategories,
  readToolCategories,
  type LayoutEntry,
} from "@site/public-data/portfolio/products.mjs";
import { categoryLabel } from "@site/public-data/portfolio/labels.mjs";
import { readMuseCardsPage, readMuseDetail, readMuseTabs } from "@site/public-data/portfolio/muse.mjs";

import { matchesSearch } from "@/lib/portfolio/browse-context";
import { getPortfolioDatabase } from "@/lib/portfolio/data.server";

// 公开只读投影。绝不序列化提供方记录或内部载荷；媒体地址相对同源时按请求起点绝对化。
export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const url = new URL(request.url);
  const absolute = (value: string | null | undefined) =>
    value ? new URL(value, url.origin).href : "";
  const ok = (body: unknown) =>
    Response.json(body, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  const missing = () => Response.json({ error: "未找到内容" }, { status: 404 });
  const integer = (key: string, fallback: number, max: number) => {
    const raw = url.searchParams.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;
  };
  const offset = integer("offset", 0, 1_000_000);
  const limit = integer("limit", 24, 60);
  if (offset === null || limit === null || limit < 1)
    return Response.json({ error: "offset/limit 无效" }, { status: 400 });
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length > 200) return Response.json({ error: "搜索词过长" }, { status: 400 });
  const cat = url.searchParams.get("cat") ?? "";
  const theme = url.searchParams.get("theme") ?? "";
  const database = getPortfolioDatabase();

  const layout = (item: LayoutEntry) => ({
    id: item.id,
    title: item.name,
    category: item.category,
    topic: item.subcategory,
    author: "",
    text: "",
    sourceURL: layoutUpstream.url,
    thumbnail: item.image ? absolute(item.thumb) : "",
    media: item.image
      ? [
          {
            id: item.id,
            kind: "image" as const,
            url: absolute(item.image),
            poster: absolute(item.thumb),
            width: item.width,
            height: item.height,
          },
        ]
      : [],
  });

  if (path.length === 0)
    return ok({
      items: portfolioProducts.map((product) => ({
        id: product.slug,
        name: product.name,
        summary: product.tagline,
        description: product.description,
        date: product.date,
        dateLabel: product.dateLabel,
        cover: absolute(product.cover),
      })),
    });
  switch (path[0]) {
    case "layouts": {
      if (path.length === 2) {
        const item = layoutEntries.find((entry) => entry.id === (path[1] ?? ""));
        return item ? ok({ item: layout(item) }) : missing();
      }
      if (path.length !== 1) return missing();
      const categories = Effect.runSync(readLayoutCategories());
      const filtered = layoutEntries.filter(
        (item) =>
          (!cat || item.categorySlug === cat) &&
          (!theme || item.subcategorySlug === theme) &&
          matchesSearch(q, [item.name, item.category, item.subcategory]),
      );
      return ok({
        total: filtered.length,
        hasMore: offset + limit < filtered.length,
        items: filtered.slice(offset, offset + limit).map(layout),
        categories: categories.map((category) => ({
          id: category.slug,
          name: categoryLabel(category.name),
          count: category.count,
        })),
        topics: categories
          .filter((category) => !cat || category.slug === cat)
          .flatMap((category) =>
            category.subcategories.map((topic) => ({ id: topic.slug, name: topic.name, count: topic.count })),
          ),
        attribution: `图鉴改编自 ${layoutUpstream.author}/${layoutUpstream.name} · ${layoutUpstream.license}`,
      });
    }
    case "muse": {
      if (path.length === 2) {
        const post = await Effect.runPromise(readMuseDetail(database, path[1] ?? ""));
        if (!post) return missing();
        return ok({
          item: {
            id: post.slug,
            title: post.title,
            category: categoryLabel(post.category ?? "未分类"),
            topic: "",
            author: post.creatorName ?? "",
            text: post.description ?? "",
            sourceURL: post.sourceUrl ?? "",
            thumbnail: absolute(post.firstThumbnail),
            media: post.media.map((media) => ({
              id: media.id,
              kind: media.type,
              url: absolute(media.src),
              poster: absolute(media.poster),
              width: media.width ?? 4,
              height: media.height ?? 3,
            })),
          },
        });
      }
      if (path.length !== 1) return missing();
      const [page, tabs] = await Effect.runPromise(
        Effect.all([readMuseCardsPage(database, { q, category: cat || "全部", offset, limit }), readMuseTabs(database)]),
      );
      return ok({
        ...page,
        items: page.items.map((item) => ({
          id: item.key,
          title: item.name,
          category: categoryLabel(item.category),
          topic: "",
          author: item.lead ?? "",
          text: "",
          sourceURL: "",
          thumbnail: absolute(item.poster || item.src),
          media: item.src
            ? [
                {
                  id: item.key,
                  kind: item.kind,
                  url: absolute(item.kind === "image" ? item.fullSrc || item.src : item.src),
                  poster: absolute(item.poster),
                  width: item.width,
                  height: item.height,
                },
              ]
            : [],
        })),
        categories: tabs.map((tab) => ({ id: tab.name, name: categoryLabel(tab.name), count: tab.count })),
        topics: [],
        attribution: "",
      });
    }
    case "tools":
      if (path.length !== 1) return missing();
      return ok({
        categories: Effect.runSync(readToolCategories()).map((category) => ({
          id: category.id,
          name: categoryLabel(category.id),
          tools: category.tools.map((tool) => ({
            name: tool.name,
            url: tool.url,
            icon: absolute(tool.icon),
          })),
        })),
      });
    case "site":
      if (path.length !== 1) return missing();
      return ok({
        video: absolute(personalSitePromo.video),
        poster: absolute(personalSitePromo.poster),
        website: absolute(personalSitePromo.website),
        description: personalSitePromo.description,
      });
    default:
      return missing();
  }
}
