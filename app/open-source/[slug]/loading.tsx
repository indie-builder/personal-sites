import { DetailLoadingChrome, DetailPage, LoadingDocument } from "@/components/page-shell";
import styles from "@/components/open-source.module.css";

export default function OpenSourceEntryLoading() {
  return (
    <DetailPage mainClassName="curation-home curation-detail curation-open-source-detail">
      <article aria-busy="true" aria-live="polite" className="curation-detail__article curation-open-source__article">
        <DetailLoadingChrome backLabel="返回开源关注" loadingLabel="正在打开仓库文档" />
        <section aria-label="正在读取中文阅读版" className={`curation-detail__section ${styles.documentSection}`}>
          <div className={styles.documentHeader}>
            <h2 className="curation-detail__eyebrow">仓库文档</h2>
          </div>
          <LoadingDocument />
        </section>
      </article>
    </DetailPage>
  );
}
