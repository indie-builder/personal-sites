import { DetailLoadingChrome, DetailPage, LoadingDocument } from "@/components/page-shell";

export default function CurationEntryLoading() {
  return (
    <DetailPage mainClassName="curation-home curation-detail curation-detail--spread">
      <article aria-busy="true" aria-live="polite" className="curation-detail__article">
        <DetailLoadingChrome backLabel="返回每日关注" loadingLabel="正在打开每日关注" />
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
