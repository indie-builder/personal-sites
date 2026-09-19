import { createCurationEntryRoute } from "@/components/curation-entry";

const { EntryPage, generateMetadata } = createCurationEntryRoute("design");

export { generateMetadata };

export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

// 注意：本路由不能添加 loading.tsx。设计板块会为 design 状态非 include 的条目
// 抛出 notFound()，该检查依赖"响应未开始流式"才能返回真实 404（ISR 也不应缓存
// 软 404）；loading.tsx 会立即使响应以 200 开始流式，状态码无法再变更
//（见 Next 16 loading 文档 Status Codes 一节）。e2e/curation-isr.spec.ts 守护此契约。

export default EntryPage;
