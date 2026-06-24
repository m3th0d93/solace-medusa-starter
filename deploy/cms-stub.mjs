import http from "node:http";

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
const jakdorFaq = {
  data: {
    FAQSection: [
      {
        id: 1,
        Title: "Jakdor FAQ",
        Bookmark: "jakdor-faq",
        Question: [
          {
            id: 1,
            Title: "How long does delivery take?",
            Text: "On stock sizes, Jakdor offer a next day delivery service on most panels ordered before 12pm. Where stock is unavailable or the panels need to be manufactured, please allow 7-10 days prior to arrival on site.",
          },
          {
            id: 2,
            Title: "How do I order a bespoke size?",
            Text: "If we do not offer a stock size which meets your requirements we can manufacture to any size you need. Just drop us an email and one of our sales representatives will get back to you. Bespoke sizes generally have a turnaround of between 5 to 7 days depending on quantity and requirements. We can also manufacture more specialist panels such as air tight, sound insulated and much more. If in doubt, give our sales department a phone call or drop us an email.",
          },
          {
            id: 3,
            Title: "What type of access panel do I need?",
            Text: "Jakdor offer 4 main types of panels: picture frame, beaded frame, tile faced and plasterboard door. Picture frames are installed directly into a wall and screwed into position. Beaded frames allow for tape and jointing on site with a wet finish; this provides a flush access panel with no visible frame. Tiled doors also come with a beaded frame but are manufactured to fit discreetly into a tiled area. Plasterboard doors also come with a beaded frame but are manufactured for use in jointless plasterboard walls. In addition to the above we also offer 1-hour and 2-hour fire rated versions as well as metal, metal budget and plastic alternatives.",
          },
          {
            id: 4,
            Title: "How do I install the panels?",
            Text: "Download our installation instructions: https://jakdor.co.uk/image/catalog/pdf/Fittinginstructions.pdf",
          },
          {
            id: 5,
            Title: "Need to know more?",
            Text: "If you have more questions, send us a message and we will answer you as soon as possible. Or give us a phone call: +44 (0) 1922 711185.",
          },
        ],
      },
    ],
  },
};

const responses = [
  [/^\/api\/homepage\b/, emptyPage],
  [/^\/api\/collections\b/, emptyList],
  [/^\/api\/blogs\b/, emptyPaginatedList],
  [/^\/api\/blog-post-categories\b/, emptyPaginatedList],
  [/^\/api\/product-variants-colors\b/, emptyList],
  [/^\/api\/about-us\b/, emptyPage],
  [/^\/api\/faq\b/, jakdorFaq],
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
