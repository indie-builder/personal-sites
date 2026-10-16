// vmThreads 池的 VM 上下文只带 jsdom 的全局：Node 侧的 web 流与编解码器不会自动
// 注入，而 jsdom 自身也不提供。这里按缺补齐（node:stream/web 的 ReadableStream
// 与 undici 的 Response 使用同一实现，身份一致），threads 池下全部已存在、零影响。
import { ReadableStream, TransformStream, WritableStream } from "node:stream/web";
import { TextDecoder, TextEncoder } from "node:util";

const bridged = globalThis as unknown as Record<string, unknown>;

bridged.ReadableStream ??= ReadableStream;
bridged.WritableStream ??= WritableStream;
bridged.TransformStream ??= TransformStream;
bridged.TextEncoder ??= TextEncoder;
bridged.TextDecoder ??= TextDecoder;
