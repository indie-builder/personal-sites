export function compactText(value) {
  return String(value ?? "")
    .replaceAll("\0", "")
    .replace(/data:[^,\s"'<>]+;base64,[A-Za-z0-9+/_=-]+/giu, "[embedded media]")
    .replace(/data%3A[^&)\s"'<>]+/giu, "[embedded media]")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Keep chunks below BGE's 512-token ceiling without owning a tokenizer-aware
 * splitter. ponytail: 420 code points is conservative for Chinese/Markdown;
 * switch to token-based chunking only if retrieval evaluation shows truncation.
 */
export function splitText(value, maximumCharacters = 420, overlapCharacters = 60) {
  if (maximumCharacters <= overlapCharacters || overlapCharacters < 0) {
    throw new Error("分块参数无效：maximumCharacters 必须大于 overlapCharacters。");
  }

  const text = compactText(value);
  if (!text) return [];

  const chunks = [];
  let current = "";
  const pushCurrent = () => {
    if (current) chunks.push(current);
    current = "";
  };

  for (const paragraph of text.split("\n\n")) {
    const characters = Array.from(paragraph);
    if (characters.length > maximumCharacters) {
      pushCurrent();
      for (let start = 0; start < characters.length;) {
        const end = Math.min(start + maximumCharacters, characters.length);
        chunks.push(characters.slice(start, end).join("").trim());
        if (end === characters.length) break;
        start = end - overlapCharacters;
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (Array.from(candidate).length > maximumCharacters) pushCurrent();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  pushCurrent();
  return chunks.filter(Boolean);
}

export function isUsefulVectorChunk(value) {
  return (compactText(value).match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 20;
}

export function mergeRankings(vectorRows, keywordRows, limit = 8) {
  const scores = new Map();
  for (const rows of [vectorRows, keywordRows]) {
    rows.forEach((row, index) => {
      const current = scores.get(row.id) ?? 0;
      scores.set(row.id, current + 1 / (60 + index + 1));
    });
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score || left.id - right.id)
    .slice(0, limit);
}

export function publicAskVectorSource(row) {
  return `${row.source_scope}/${row.source_id}/${row.id}`;
}
