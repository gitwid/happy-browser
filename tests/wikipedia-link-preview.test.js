const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const preview = require("../src/wikipedia-link-preview.js");

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("detects wikipedia hosts", () => {
  assert.equal(preview.isWikipediaArticleHost("en.wikipedia.org"), true);
  assert.equal(preview.isWikipediaArticleHost("de.wikipedia.org"), true);
  assert.equal(preview.isWikipediaArticleHost("www.wikiwand.com"), false);
});

run("parses article links and rejects namespaces", () => {
  const article = preview.parseWikiArticleLink("/wiki/Indra%27s_net", "en.wikipedia.org");
  assert.equal(article.lang, "en");
  assert.equal(article.title, "Indra's net");

  assert.equal(preview.parseWikiArticleLink("/wiki/File:Example.jpg", "en.wikipedia.org"), null);
  assert.equal(preview.parseWikiArticleLink("/wiki/Help:Contents", "en.wikipedia.org"), null);
  assert.equal(preview.parseWikiArticleLink("https://de.wikipedia.org/wiki/Berlin", "en.wikipedia.org").lang, "de");
});

run("builds parse urls from titles", () => {
  const url = preview.buildParseUrl("en", "Lorenz system");
  assert.match(url, /action=parse/);
  assert.match(url, /page=Lorenz_system/);
  assert.match(url, /section=0/);
});

run("normalizes preview html links and images", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  global.document = dom.window.document;

  const html = preview.normalizePreviewHtml(
    '<p><a href="./Ubisoft">Ubisoft</a></p><img src="//upload.wikimedia.org/x.png">',
    "en"
  );

  assert.match(html, /href="https:\/\/en\.wikipedia\.org\/wiki\/Ubisoft"/);
  assert.match(html, /src="https:\/\/upload\.wikimedia\.org\/x\.png"/);

  delete global.document;
});

run("strips display titles", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  global.document = dom.window.document;
  assert.equal(preview.stripHtml("<span class=\"mw-page-title-main\">Ubisoft</span>"), "Ubisoft");
  delete global.document;
});

run("clamps glance opacity", () => {
  assert.equal(preview.clampGlanceOpacity(0.75), 0.75);
  assert.equal(preview.clampGlanceOpacity(0.02), 0.08);
  assert.equal(preview.clampGlanceOpacity(0.95), 0.92);
});

run("creates floating chapter title from article name", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  global.document = dom.window.document;

  const title = preview.createFloatingChapterTitle("Strange Attractor (album)");
  assert.equal(title.className, "happy-wiki-chapter-title");
  assert.equal(title.textContent, "Strange Attractor (album)");
  assert.equal(preview.createFloatingChapterTitle("  "), null);

  delete global.document;
});
