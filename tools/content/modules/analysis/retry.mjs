// @ts-check
import { Effect, Schedule } from "effect";

/** Only explicit transport/service failures justify repeating a paid model request.
 * @param {unknown} error
 */
export function isTransientModelError(error) {
  const messages = [];
  const statuses = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof SyntaxError || ("name" in current && current.name === "AbortError")) return false;
    if ("message" in current) messages.push(String(current.message));
    if ("code" in current) {
      if (current.code === "ABORT_ERR") return false;
      messages.push(String(current.code));
    }
    if ("status" in current) statuses.push(Number(current.status));
    if ("statusCode" in current) statuses.push(Number(current.statusCode));
    current = "cause" in current ? current.cause : null;
  }
  const message = messages.join("\n");
  for (const match of message.matchAll(/\b(?:HTTP(?:\/\d(?:\.\d)?)?|status(?:\s+code)?)[\s:=]+(\d{3})\b/giu)) {
    statuses.push(Number(match[1]));
  }
  // Permanent errors win even if a wrapper also mentions a connection failure.
  if (statuses.some((status) => status >= 400 && status < 500 && ![408, 429].includes(status))) return false;
  if (/unauthorized|forbidden|invalid[_ ]?(?:api[_ ]?key|argument|request)|authentication|configuration|not configured|model not found|context[_ ](?:length|window)|缺少|配置|未找到模型|必须是|登录态/iu.test(message)) return false;
  return statuses.some((status) => [408, 429].includes(status) || (status >= 500 && status <= 599))
    || /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)\b|fetch failed|network (?:error|failure)|connection (?:reset|closed)|socket hang up|rate.?limit|too many requests|service unavailable|bad gateway|gateway timeout|overloaded|请求超时|request timed? ?out/iu.test(message);
}

/** @template A, E, R
 * @param {Effect.Effect<A, E, R>} request
 * @returns {Effect.Effect<A, E, R>}
 */
export function withModelRetry(request) {
  return request.pipe(Effect.retry({
    times: 1,
    schedule: Schedule.spaced("5 seconds"),
    while: isTransientModelError,
  }));
}
