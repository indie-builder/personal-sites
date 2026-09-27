import { mkdir } from "node:fs/promises";

import { env, pipeline } from "@huggingface/transformers";

import { MODEL_DTYPE, MODEL_ID, modelCachePath, VECTOR_DIMENSIONS } from "./config.mjs";

async function createEmbedder() {
  env.cacheDir = modelCachePath;
  await mkdir(modelCachePath, { recursive: true });
  return pipeline("feature-extraction", MODEL_ID, {
    device: "cpu",
    dtype: MODEL_DTYPE,
  });
}

// 模块级复用：加载 ONNX 模型是秒级开销，索引与每次 search 共享同一实例。
let embedderPromise = null;

export function getEmbedder() {
  embedderPromise ??= createEmbedder();
  return embedderPromise;
}

export async function embed(embedder, texts) {
  const output = await embedder(texts, {
    normalize: true,
    pooling: "cls",
    truncation: true,
  });
  const vectors = output.tolist();
  if (vectors.some((vector) => vector.length !== VECTOR_DIMENSIONS)) {
    throw new Error(`模型输出维度不是预期的 ${VECTOR_DIMENSIONS}。`);
  }
  return vectors;
}
