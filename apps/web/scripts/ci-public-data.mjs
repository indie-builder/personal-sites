import { createServer } from "node:http";

// CI-only Supabase boundary: no live news changes, so pages use the committed public archive.
// Ask E2E specs intercept /api/ask in the browser and never invoke a model.
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (request.method === "GET" && pathname === "/rest/v1/ai_news_public_items") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("[]");
    return;
  }

  // Fail unexpected reads and all writes instead of masking a new remote dependency.
  console.error(`Unexpected CI data request: ${request.method} ${pathname}`);
  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ message: "Unsupported CI data request" }));
});

server.listen(7101, "127.0.0.1", () => {
  console.log("CI public data fixture listening on http://127.0.0.1:7101");
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close());
}
