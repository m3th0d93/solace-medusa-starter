import http from "node:http";

const emptyList = { data: [] };
const emptyPage = { data: {} };

const responses = [
  [/^\/api\/homepage\b/, emptyPage],
  [/^\/api\/collections\b/, emptyList],
  [/^\/api\/blogs\b/, emptyList],
  [/^\/api\/blog-post-categories\b/, emptyList],
  [/^\/api\/product-variants-colors\b/, emptyList],
  [/^\/api\/about-us\b/, emptyPage],
  [/^\/api\/faq\b/, emptyPage],
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://cms-stub");
  const match = responses.find(([pattern]) => pattern.test(url.pathname));
  const payload = match?.[1] ?? emptyPage;

  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
});

server.listen(1337, "0.0.0.0", () => {
  console.log("cms-stub listening on 1337");
});
