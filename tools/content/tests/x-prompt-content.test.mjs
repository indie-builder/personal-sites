import assert from "node:assert/strict";
import test from "node:test";

import { needsCurationAnalysis as needsCurationAnalysisForTest, prepareCurationItem } from "../modules/x-sync/analysis.mjs";
import {
  applyPromptContent,
  applyPromptTranslation,
  buildPromptTranslationPrompt,
  isPredominantlyChinese,
  needsPromptContent,
  parsePromptContentResponse,
  recordPromptContentFailure,
  reusableTranslation,
  translationChunks,
  withFetchedText,
} from "../modules/x-sync/prompt-content.mjs";
import { replyCandidates } from "../modules/x-sync/prompt-source.mjs";

const source = {
  fetchedAt: "2026-10-25T00:00:00.000Z",
  fullText: "Prompt of the day:\n\nYou are a reviewer. Reply with JSON.",
  quoteText: "Original quoted line.",
  replies: [
    {
      author: { handle: "author", name: "Author" },
      id: "2",
      media: [],
      text: "Add: keep output under 200 words.",
      url: "https://x.com/author/status/2",
    },
    {
      author: { handle: "other", name: "Other" },
      id: "3",
      media: [{ type: "photo", url: "https://pbs.twimg.com/media/three.jpg" }],
      text: "I got great results with temperature 0.2.",
      url: "https://x.com/other/status/3",
    },
  ],
};

function promptItem(overrides = {}) {
  return prepareCurationItem({
    ai: { analysis: "旧解析", enrichedAt: "2026-10-01T00:00:00.000Z", summary: "旧摘要", tags: ["提示词", "软件工程提示词"], title: "旧标题" },
    author: { handle: "author", name: "Author" },
    fetchSource: "bookmark",
    id: "1",
    isQuote: true,
    links: [],
    media: [],
    quoteContext: { author: "quoted", authorName: "Quoted", text: "Original quoted line." },
    text: "Prompt of the day: You are a reviewer.",
    tweetUrl: "https://x.com/author/status/1",
    ...overrides,
  });
}

const modelResult = {
  quoteTranslation: "原始引用句。",
  selectedReplies: [
    { id: "2", reason: "原作者补充了输出长度约束。", translation: "补充：输出控制在 200 词以内。" },
    { id: "3", reason: "给出了可复现的参数。", translation: "我用 temperature 0.2 效果很好。" },
  ],
  tags: ["提示词", "软件工程提示词", "代码审查", "temperature"],
  translation: "每日提示词：你是一位审查者。",
};

test("prompt content fills translations and selected replies from fetched candidates", () => {
  const applied = applyPromptContent(promptItem(), modelResult, source, {
    completedAt: "2026-10-25T00:00:00.000Z",
    model: "pi/test",
  });

  assert.deepEqual(applied.ai.prompt, {
    quoteTranslation: "原始引用句。",
    replies: [
      {
        author: { handle: "author", name: "Author" },
        id: "2",
        media: [],
        reason: "原作者补充了输出长度约束。",
        text: "Add: keep output under 200 words.",
        translation: "补充：输出控制在 200 词以内。",
        url: "https://x.com/author/status/2",
      },
      {
        author: { handle: "other", name: "Other" },
        id: "3",
        media: [{ type: "photo", url: "https://pbs.twimg.com/media/three.jpg" }],
        reason: "给出了可复现的参数。",
        text: "I got great results with temperature 0.2.",
        translation: "我用 temperature 0.2 效果很好。",
        url: "https://x.com/other/status/3",
      },
    ],
    translation: "每日提示词：你是一位审查者。",
  });
  // 抓取到的完整正文替换队列短文本，旧策展字段保持不变。
  assert.equal(applied.text, source.fullText);
  assert.equal(applied.quoteContext.text, source.quoteText);
  assert.equal(applied.ai.title, "旧标题");
  assert.equal(applied.ai.analysis, "旧解析");
  // 开放标签保留父标签，不锁固定词表。
  assert.deepEqual(applied.ai.tags, ["提示词", "软件工程提示词", "代码审查", "temperature"]);
  assert.equal(applied.pipeline.stages.prompt.status, "complete");
  assert.equal(applied.pipeline.stages.prompt.inputHash, preparedHash(applied));
  assert.equal(applied.pipeline.stages.editorial.status, "complete");
  // 抓取到更长正文时沿用旧策展解析，不把整条重新排队。
  assert.equal(needsCurationAnalysisForTest(applied), false);
  assert.equal(needsPromptContent(applied), false);
});

function preparedHash(item) {
  return item.pipeline.stages.prompt.inputHash;
}

test("model cannot invent replies or omit translations for non-Chinese text", () => {
  assert.throws(
    () => applyPromptContent(promptItem(), {
      ...modelResult,
      selectedReplies: [{ id: "404", reason: "伪造", translation: "伪造" }],
    }, source),
    /不存在的回复 id/u,
  );
  assert.throws(
    () => applyPromptContent(promptItem(), { ...modelResult, translation: null }, source),
    /原文是非中文/u,
  );
  assert.throws(
    () => applyPromptContent(promptItem(), {
      ...modelResult,
      selectedReplies: [{ id: "3", reason: "缺译文", translation: null }],
    }, source),
    /回复是非中文/u,
  );
});

test("Chinese source text needs no duplicate translation and no replies are valid", () => {
  const chineseSource = {
    fetchedAt: "2026-10-25T00:00:00.000Z",
    fullText: "今天分享一个非常好用的提示词：请先复述需求，再给出方案。",
    quoteText: null,
    replies: [],
  };
  const applied = applyPromptContent(
    promptItem({ isQuote: false, quoteContext: null, text: "今天分享一个非常好用的提示词。" }),
    { quoteTranslation: null, selectedReplies: [], tags: ["提示词", "写作提示词"], translation: null },
    chineseSource,
    { completedAt: "2026-10-25T00:00:00.000Z", model: "pi/test" },
  );

  assert.equal(applied.ai.prompt.translation, null);
  assert.equal(applied.ai.prompt.quoteTranslation, null);
  assert.deepEqual(applied.ai.prompt.replies, []);
  assert.equal(applied.pipeline.stages.prompt.replyCount, 0);
  // 本次模型标签为准；父标签由规范化保证，旧用途子类不残留。
  assert.deepEqual(applied.ai.tags, ["提示词", "写作提示词"]);
});

test("locale number separators do not invalidate an otherwise correct translation", () => {
  const localized = { ...source, fullText: "Budget: 10.000 tokens.", quoteText: null, replies: [] };
  const applied = applyPromptContent(promptItem({ isQuote: false, quoteContext: null }), {
    translation: "预算：10,000 个 token。", selectedReplies: [], tags: ["提示词"],
  }, localized);
  assert.equal(applied.ai.prompt.translation, "预算：10,000 个 token。");
});

test("translation step records a fingerprint and reuses only matching text", () => {
  const base = promptItem();
  const fixture = { ...source, fullText: "Prompt of the day: You are a reviewer." };
  const applied = applyPromptTranslation(base, { translation: "每日提示词：你是一位审查者。", quoteTranslation: "原始引用句。" }, fixture);
  assert.equal(applied.ai.prompt.translation, "每日提示词：你是一位审查者。");
  assert.equal(applied.pipeline.stages.prompt.translatedHash !== undefined, true);
  assert.deepEqual(reusableTranslation(applied), { translation: "每日提示词：你是一位审查者。", quoteTranslation: "原始引用句。" });
  // 抓到更长正文后，旧译文不得再复用。
  const changed = withFetchedText(applied, { ...fixture, fullText: `${fixture.fullText}\nAdded later context.` });
  assert.equal(reusableTranslation(changed), null);
});

test("chunked translation requests always include the quoted post", () => {
  const item = promptItem({ quoteContext: { author: "quoted", authorName: "Quoted", text: "Original quoted line." } });
  const prompt = buildPromptTranslationPrompt(item, { chunk: "First chunk.", index: 0, total: 2 });
  assert.match(prompt, /Original quoted line\./u);
  assert.match(prompt, /第 1\/2 段/u);
});

test("oversized prompts split at line boundaries without losing text", () => {
  const text = `${"A paragraph about prompts. ".repeat(200)}\n${"Another paragraph. ".repeat(200)}\n`;
  const chunks = translationChunks(text);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), text);
  // 只在行边界切分：除最后一块外都以换行结束，超长单行不会被切断。
  assert.ok(chunks.slice(0, -1).every((chunk) => chunk.endsWith("\n")));
  assert.ok(chunks.every((chunk) => chunk.length <= 6_000));
});

test("chunking never splits an open code fence", () => {
  const code = `${"const x = 1;\n".repeat(800)}`;
  const text = `Intro\n\`\`\`js\n${code}\`\`\`\nOutro\n`;
  const chunks = translationChunks(text);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => (chunk.match(/^\s*```/gmu) ?? []).length % 2 === 0));
});

test("a Chinese sentence with an English product name is not treated as foreign", () => {
  assert.equal(isPredominantlyChinese("求推荐 GitHub 上开源的 Awesome Opus 5.5 Video Prompt 集合"), true);
  assert.equal(isPredominantlyChinese("This is a long English sentence about prompt design."), false);
});

test("language detection and selection limits are explicit", () => {
  assert.equal(isPredominantlyChinese("这是中文提示词，直接可用。"), true);
  assert.equal(isPredominantlyChinese("Prompt of the day"), false);
  assert.equal(isPredominantlyChinese(""), true);
  // 日文假名、韩文不是中文，即使汉字占比很高。
  assert.equal(isPredominantlyChinese("これは日本語のプロンプトです。今日は良い天気ですね。"), false);
  assert.equal(isPredominantlyChinese("한국어 프롬프트입니다"), false);
  // 中文里夹英文术语仍是中文；带整段英文则需要译文。
  assert.equal(isPredominantlyChinese("这是一个用于 Code Review 的中文提示词，直接可用。"), true);
  assert.equal(isPredominantlyChinese("中文说明：请先复述需求。\n\nYou are a reviewer. Reply with JSON."), false);
  // 纯表情、代码块和占位符不需要翻译。
  assert.equal(isPredominantlyChinese("🔥🔥🔥"), true);
  assert.equal(isPredominantlyChinese("```js\nconsole.log('hi')\n```"), true);
  assert.equal(isPredominantlyChinese("{{name}} ${value} <SYSTEM_PROMPT> --flag"), true);

  const many = {
    ...source,
    replies: Array.from({ length: 8 }, (_, index) => ({
      author: { handle: `r${index}`, name: `R${index}` },
      id: String(100 + index),
      media: [],
      text: `Reply ${index}`,
      url: `https://x.com/r${index}/status/${100 + index}`,
    })),
  };
  const applied = applyPromptContent(promptItem(), {
    ...modelResult,
    selectedReplies: many.replies.map((reply, index) => ({ id: reply.id, reason: "有价值", translation: `回复 ${index}` })),
  }, many);
  assert.equal(applied.ai.prompt.replies.length, 5);
});

test("candidate extraction keeps author follow-ups first and drops the parent tweet", () => {
  const tweet = (id, username, text) => ({
    _raw: { core: { user_results: { result: { privacy: { protected: false } } } } },
    author: { username, name: username },
    id,
    text,
  });
  const candidates = replyCandidates([
    tweet("1", "author", "parent"),
    tweet("5", "spam", "buy now"),
    tweet("2", "author", "follow-up"),
    tweet("5", "spam", "duplicate"),
    tweet("6", "empty", "   "),
  ], { id: "1", author: { handle: "author" } });

  assert.deepEqual(candidates.map((candidate) => candidate.id), ["2", "5"]);
  assert.equal(candidates[1].url, "https://x.com/spam/status/5");
});

test("response parsing tolerates fences and missing reply lists", () => {
  assert.deepEqual(parsePromptContentResponse('```json\n{"translation":"译文"}\n```'), {
    quoteTranslation: null,
    selectedReplies: [],
    tags: [],
    translation: "译文",
  });
});

test("response parsing rejects wrong types instead of silently emptying fields", () => {
  for (const payload of [
    { tags: [{ name: "提示词" }] },
    { tags: "提示词" },
    { selectedReplies: [{ id: 2, reason: "有价值" }] },
    { selectedReplies: [{ id: "2", reason: "有价值", text: "伪造正文" }] },
    { selectedReplies: {} },
    { translation: { text: "译文" } },
    { quoteTranslation: 42 },
    [1, 2],
  ]) {
    assert.throws(() => parsePromptContentResponse(JSON.stringify(payload)));
  }
});

test("ordinary translated quantities and link punctuation do not invalidate a translation", () => {
  const result = applyPromptContent(promptItem({ isQuote: false, quoteContext: null }), {
    translation: "已有 2.8 亿次安装。详情：https://t.co/example。", selectedReplies: [], tags: ["提示词"],
  }, { ...source, fullText: "Installed 280 million times. Details: https://t.co/example,", quoteText: null, replies: [] });
  assert.match(result.ai.prompt.translation, /2.8 亿/u);
});

test("translations keep prompt literals and refuse object values", () => {
  const sourceWithLiterals = {
    fetchedAt: "2026-10-25T00:00:00.000Z",
    fullText: "Use this prompt:\n```js\nconst model = 'gpt';\n```\nCall {{tool}} with ${arg} and <SYSTEM_PROMPT>, run --max-steps=3 at temperature 0.2.",
    quoteText: null,
    replies: [],
  };
  const translation = "使用这个提示词：\n```js\nconst model = 'gpt';\n```\n用 {{tool}} 调用 ${arg} 和 <SYSTEM_PROMPT>，以 temperature 0.2 运行 --max-steps=3。";
  const applied = applyPromptContent(promptItem({ isQuote: false, quoteContext: null }), {
    quoteTranslation: null,
    selectedReplies: [],
    tags: ["提示词", "软件工程提示词"],
    translation,
  }, sourceWithLiterals, { model: "pi/test" });
  assert.equal(applied.ai.prompt.translation, translation);

  for (const broken of [
    translation.replace("{{tool}}", ""),
    translation.replace("${arg}", ""),
    translation.replace("<SYSTEM_PROMPT>", ""),
    translation.replace("--max-steps=3", ""),
    translation.replace("0.2", ""),
    translation.replace("```js\nconst model = 'gpt';\n```\n", ""),
  ]) {
    assert.throws(() => applyPromptContent(promptItem({ isQuote: false, quoteContext: null }), {
      quoteTranslation: null,
      selectedReplies: [],
      tags: ["提示词"],
      translation: broken,
    }, sourceWithLiterals), /必须原样保留/u);
  }

  // 对象译文不得被 String() 成 [object Object]。
  for (const value of [{ text: "译文" }, 42, ["译文"], "[object Object]"]) {
    assert.throws(() => applyPromptContent(promptItem(), {
      ...modelResult,
      translation: value,
    }, source), /原文译文|无效的对象字符串/u);
  }
});

test("valid model translations survive Chinese-script heuristics", () => {
  // 纯汉字日文会被汉字比例判为中文；模型已给出译文时保留，不强制丢弃。
  const kanjiOnly = {
    fetchedAt: "2026-10-25T00:00:00.000Z",
    fullText: "本日提案。要件定義書。実装方針。",
    quoteText: null,
    replies: [],
  };
  const applied = applyPromptContent(promptItem({ isQuote: false, quoteContext: null }), {
    quoteTranslation: null,
    selectedReplies: [],
    tags: ["提示词"],
    translation: "今天的提议。需求定义书。实现方针。",
  }, kanjiOnly, { model: "pi/test" });
  assert.equal(applied.ai.prompt.translation, "今天的提议。需求定义书。实现方针。");
});

test("prompt stage version bumps force old completed items to rerun", () => {
  const applied = applyPromptContent(promptItem(), modelResult, source, { model: "pi/test" });
  assert.equal(applied.pipeline.stages.prompt.version, 2);
  assert.equal(needsPromptContent(applied), false);

  const oldVersion = {
    ...applied,
    pipeline: {
      ...applied.pipeline,
      stages: { ...applied.pipeline.stages, prompt: { ...applied.pipeline.stages.prompt, version: 1 } },
    },
  };
  assert.equal(needsPromptContent(oldVersion), true);
});

test("deterministic bird failures are skipped while environment failures retry", () => {
  const notFound = recordPromptContentFailure(promptItem(), new Error("bird replies 退出异常（code=1）：Tweet not found in response"));
  assert.equal(notFound.pipeline.stages.prompt.status, "skipped");
  assert.equal(notFound.pipeline.stages.prompt.attempts, 1);
  assert.equal(needsPromptContent(notFound), false);

  const transient = recordPromptContentFailure(promptItem(), new Error("login state expired"));
  assert.equal(transient.pipeline.stages.prompt.status, "error");
  assert.equal(needsPromptContent(transient), true);
});

test("prompt backfill only selects prompt items missing content and keeps old analysis", () => {
  const legacy = promptItem();
  assert.equal(needsPromptContent(legacy), true);
  assert.equal(needsPromptContent(legacy, { refresh: true }), true);
  assert.equal(needsPromptContent({ ...legacy, ai: { ...legacy.ai, tags: ["Agent 工程"] } }), false);

  const applied = applyPromptContent(legacy, modelResult, source, { model: "pi/test" });
  const changed = { ...applied, text: "source changed" };
  assert.equal(needsPromptContent(changed), true);
  assert.equal(applied.ai.analysis, "旧解析");
});
