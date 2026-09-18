/** 统计 needle 在 text 中的出现次数；调用方负责先把两边都归一成小写。 */
export function occurrences(text: string, needle: string) {
  let count = 0;
  let start = 0;
  while (true) {
    const index = text.indexOf(needle, start);
    if (index < 0) return count;
    count += 1;
    start = index + needle.length;
  }
}

/** 检索结果排序：分数高者在前，同分时发布时间新者在前。 */
export function byScoreThenRecency(left: { publishedAt: string | null; score: number }, right: { publishedAt: string | null; score: number }) {
  return right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
}
