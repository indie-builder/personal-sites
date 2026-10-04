const MINUTE_MS = 60_000;

function ageMinutes(value, now) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, Math.round((now.getTime() - timestamp) / MINUTE_MS)) : null;
}

function sourceStatus(source, now, staleAfterMinutes, warnings, label) {
  const age = ageMinutes(source.latestAt, now);
  const healthy = source.count > 0 && age !== null && age <= staleAfterMinutes;
  if (!healthy) warnings.push(`${label} 已超过 ${Math.round(staleAfterMinutes / 60)} 小时未更新。`);
  return { ...source, ageMinutes: age, healthy };
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
  const curation = {
    douyin: sourceStatus(publicData.curation.douyin, now, 14 * 24 * 60, warnings, "抖音收藏"),
    x: sourceStatus(publicData.curation.x, now, 72 * 60, warnings, "X 策展"),
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
