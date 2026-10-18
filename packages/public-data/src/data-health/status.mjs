const MINUTE_MS = 60_000;

function ageMinutes(value, now) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, Math.round((now.getTime() - timestamp) / MINUTE_MS)) : null;
}

function sourceStatus(source, now, staleAfterMinutes, warnings, label) {
  const age = ageMinutes(source.latestAt, now);
  const available = source.count > 0 && age !== null;
  const freshness = !available ? "missing" : age > staleAfterMinutes ? "stale" : "fresh";
  const healthy = available && freshness === "fresh";
  if (!available) warnings.push(`${label} 缺少公开内容或有效时间。`);
  else if (freshness === "stale") warnings.push(`${label} 内容已超过 ${Math.round(staleAfterMinutes / 60)} 小时未更新；内容时间不代表同步时间。`);
  return { ...source, ageMinutes: age, freshness, healthy };
}

function xSyncStatus(state, now, warnings) {
  if (!state) {
    warnings.push("X 策展同步状态未知：公开快照尚无同步记录。");
    return { status: "unknown", lastStartedAt: null, lastFinishedAt: null, lastSucceededAt: null, ageMinutes: null, healthy: null };
  }
  const age = ageMinutes(state.lastSucceededAt, now);
  const healthy = state.status !== "failed" && age !== null && age <= 72 * 60;
  if (!healthy) warnings.push(`X 策展同步${state.status === "failed" ? "失败" : "尚无 72 小时内成功记录"}；请检查本机同步并重新部署公开快照。`);
  return { ...state, ageMinutes: age, healthy };
}

export function buildDataHealth({ aiNews, commit = null, insights = null, now = new Date(), publicData }) {
  const warnings = [];
  const database = { healthy: publicData.quickCheck === "ok", quickCheck: publicData.quickCheck };
  if (!database.healthy) warnings.push(`SQLite 完整性检查失败：${database.quickCheck}`);
  const askIndex = {
    documents: publicData.askDocuments,
    searchableDocuments: publicData.askSearchableDocuments,
    fts: publicData.askFts,
    missingFts: publicData.askMissingFts,
    orphanFts: publicData.askOrphanFts,
    missingPostings: publicData.askMissingPostings,
    extraPostings: publicData.askExtraPostings,
    healthy: publicData.askDocuments > 0 && publicData.askSearchableDocuments === publicData.askFts
      && publicData.askMissingFts === 0 && publicData.askOrphanFts === 0
      && publicData.askMissingPostings === 0 && publicData.askExtraPostings === 0,
  };
  if (!askIndex.healthy) warnings.push(`Ask FTS 不一致：文档 ${askIndex.documents}，可检索 ${askIndex.searchableDocuments}，已索引 ${askIndex.fts}，缺失 ${askIndex.missingFts}，孤儿 ${askIndex.orphanFts}，缺失词项位置 ${askIndex.missingPostings}，多余词项位置 ${askIndex.extraPostings}。`);
  const x = sourceStatus(publicData.curation.x, now, 72 * 60, warnings, "X 策展");
  const sync = xSyncStatus(publicData.curation.x.sync, now, warnings);
  const curation = {
    douyin: sourceStatus(publicData.curation.douyin, now, 14 * 24 * 60, warnings, "抖音收藏"),
    x: { ...x, sync, healthy: x.freshness !== "missing" && sync.healthy === true },
  };
  const openSource = sourceStatus(publicData.openSource, now, 14 * 24 * 60, warnings, "开源关注");
  const analysisHealthy = !insights || Number(insights.analysisErrors ?? 0) === 0;
  const healthy = Boolean(aiNews.healthy && database.healthy && askIndex.healthy && curation.x.healthy && curation.douyin.healthy
    && openSource.healthy && analysisHealthy);
  return {
    aiNews,
    askIndex,
    curation,
    database,
    deployment: { commit },
    generatedAt: now.toISOString(),
    healthy,
    insights,
    openSource,
    warnings,
  };
}
