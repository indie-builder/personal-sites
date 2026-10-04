import { mkdir } from "node:fs/promises";
import { env, pipeline } from "@huggingface/transformers";
import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import { MODEL_DTYPE, MODEL_ID, modelCachePath, VECTOR_DIMENSIONS } from "./config.mjs";

// Allocation is synchronous; model loading stays lazy and is shared by indexing and search.
export const loadEmbedder = Effect.runSync(
  Effect.cached(
    Effect.gen(function* () {
      env.cacheDir = modelCachePath;
      yield* io("vectors.cache", () => mkdir(modelCachePath, { recursive: true }));
      return yield* io("vectors.model", () =>
        pipeline("feature-extraction", MODEL_ID, { device: "cpu", dtype: MODEL_DTYPE }),
      );
    }),
  ),
);

export function embed(embedder, texts) {
  return io("vectors.embed", () => embedder(texts, { normalize: true, pooling: "cls", truncation: true })).pipe(
    Effect.flatMap((output) =>
      attempt("vectors.dimensions", () => {
        const vectors = output.tolist();
        if (vectors.some((vector) => vector.length !== VECTOR_DIMENSIONS))
          throw new Error(`模型输出维度不是预期的 ${VECTOR_DIMENSIONS}。`);
        return vectors;
      }),
    ),
  );
}
