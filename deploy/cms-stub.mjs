import http from "node:http";

import { jakdorGoldenContent } from "./jakdor-golden-content.mjs";

const emptyPagination = {
  pagination: {
    page: 1,
    pageSize: 1000,
    pageCount: 0,
    total: 0,
  },
};

const emptyList = { data: [] };
const emptyPaginatedList = { data: [], meta: emptyPagination };
const emptyPage = { data: {} };
const emptyContentPage = {
  data: {
    PageContent: "## Content pending\n\nThis staging page is awaiting CMS content.",
  },
};
const responses = [
  [/^\/api\/homepage\b/, emptyPage],
  [/^\/api\/collections\b/, emptyList],
  [/^\/api\/blogs\b/, emptyPaginatedList],
  [/^\/api\/blog-post-categories\b/, emptyPaginatedList],
  [/^\/api\/product-variants-colors\b/, emptyList],
  [/^\/api\/about-us\b/, jakdorGoldenContent.about],
  [/^\/api\/faq\b/, jakdorGoldenContent.faq],
  [/^\/api\/privacy-policy\b/, emptyContentPage],
  [/^\/api\/terms-and-condition\b/, emptyContentPage],
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
