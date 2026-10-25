import { DetailLoadingChrome, DetailPage, LoadingDocument } from "@/components/page-shell";

/** 剪报簿族详情页的导航加载占位；backLabel/loadingLabel 随板块传入。 */
function CurationEntryLoadingChrome({ backLabel, loadingLabel }: { backLabel: string; loadingLabel: string }) {
  return (
    <DetailPage mainClassName="curation-home curation-detail curation-detail--spread">
      <article aria-busy="true" aria-live="polite" className="curation-detail__article">
        <DetailLoadingChrome backLabel={backLabel} loadingLabel={loadingLabel} />
        <div className="curation-detail__body">
          <section aria-label="正在读取来源摘录" className="curation-detail__evidence">
            <h2 className="curation-detail__eyebrow">来源摘录</h2>
            <LoadingDocument />
          </section>
          <section aria-label="正在读取解析" className="curation-detail__reading">
            <h2 className="curation-detail__eyebrow">深度解析</h2>
            <LoadingDocument />
          </section>
        </div>
      </article>
    </DetailPage>
  );
}

/** 剪报簿族（/curation/$id）详情页的导航加载占位。 */
export function CurationEntryLoading() {
  return <CurationEntryLoadingChrome backLabel="返回每日关注" loadingLabel="正在打开每日关注" />;
}

/** 设计板块变体：返回链接与提示文案指向设计收藏。 */
export function DesignEntryLoading() {
  return <CurationEntryLoadingChrome backLabel="返回设计收藏" loadingLabel="正在打开设计收藏" />;
}

/** 提示词板块变体：返回链接与提示文案指向提示词栏目。 */
export function PromptEntryLoading() {
  return <CurationEntryLoadingChrome backLabel="返回提示词" loadingLabel="正在打开提示词" />;
}
