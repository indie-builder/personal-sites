/** Set/delete params in place ('' deletes) and return `path` or `path?query`. */
export function paramsHref(path: string, params: URLSearchParams, updates: Record<string, string>) {
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `${path}${params.size ? `?${params}` : ''}`;
}
