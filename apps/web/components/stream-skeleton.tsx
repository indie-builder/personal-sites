export function StreamSkeletonLines() {
  return <><span /><span className="is-medium" /><span className="is-short" /></>;
}

/** 流式列表加载更多时的共用状态行：骨架 + 失败重试；完成文案由各板块自带。 */
export function StreamLoadStatus({ isLoading, loadError, loadMore }: {
  isLoading: boolean;
  loadError: string | null;
  loadMore: () => void;
}) {
  return <>
    {isLoading ? (
      <>
        <span className="sr-only">正在加载更多内容</span>
        <div aria-hidden="true" className="curation-home__stream-skeleton"><StreamSkeletonLines /></div>
      </>
    ) : null}
    {loadError ? (
      <>
        <span>{loadError}</span>
        <button onClick={() => void loadMore()} type="button">重试</button>
      </>
    ) : null}
  </>;
}
