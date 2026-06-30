const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const outcome = require("../src/navigation-outcome.js");

function makeDocument(html, url = "https://example.com/page/2/") {
  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true
  });

  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    }
  });

  dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 120, height: 40, top: 0, left: 0, right: 120, bottom: 40 };
  };

  return {
    document: dom.window.document,
    location: dom.window.location
  };
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("capturePageSnapshot records href, title, and body length", () => {
  const { document, location } = makeDocument(`
    <html><head><title>Page Two</title></head>
    <body>Hello navigation kernel</body></html>
  `);

  const snapshot = outcome.capturePageSnapshot(document, location);
  assert.equal(snapshot.href, "https://example.com/page/2/");
  assert.equal(snapshot.title, "Page Two");
  assert.ok(snapshot.bodyTextLength > 0);
});

run("pageAdvanced detects href change", () => {
  const before = { href: "https://example.com/a", title: "A", bodyTextLength: 100, activeElementSignature: "" };
  const after = { href: "https://example.com/b", title: "A", bodyTextLength: 100, activeElementSignature: "" };
  assert.equal(outcome.pageAdvanced(before, after), true);
});

run("pageAdvanced detects body text growth above threshold", () => {
  const before = { href: "https://example.com/a", title: "A", bodyTextLength: 100, activeElementSignature: "" };
  const after = { href: "https://example.com/a", title: "A", bodyTextLength: 300, activeElementSignature: "" };
  assert.equal(outcome.pageAdvanced(before, after), true);
});

run("pageAdvanced ignores small body text drift", () => {
  const before = { href: "https://example.com/a", title: "A", bodyTextLength: 100, activeElementSignature: "" };
  const after = { href: "https://example.com/a", title: "A", bodyTextLength: 150, activeElementSignature: "" };
  assert.equal(outcome.pageAdvanced(before, after), false);
});

run("outcome memory tracks and excludes failed selectors", () => {
  const { document, location } = makeDocument("<body></body>");
  const memory = outcome.createOutcomeMemory({ document, location });

  memory.rememberFailedCandidate({ selector: "#bad-next", text: "Next", type: "click" });
  assert.deepEqual(memory.getExcludedSelectors(), ["#bad-next"]);
});

run("pruneFailedSelectors drops expired failures", () => {
  const { document, location } = makeDocument("<body></body>");
  const memory = outcome.createOutcomeMemory({ document, location });
  const ttl = outcome.constants.FAILED_SELECTOR_TTL_MS;

  memory.rememberFailedCandidate({ selector: "#old", text: "Next", type: "click" });
  const originalNow = Date.now;
  Date.now = () => originalNow() + ttl + 1;

  try {
    memory.pruneFailedSelectors();
    assert.deepEqual(memory.getExcludedSelectors(), []);
  } finally {
    Date.now = originalNow;
  }
});

run("isVisibleActionableLoadMore detects visible load-more buttons", () => {
  const { document } = makeDocument(`<button id="more">Load more</button>`);
  assert.equal(outcome.isVisibleActionableLoadMore(document, "#more"), true);
});

run("isVisibleActionableLoadMore ignores unrelated buttons", () => {
  const { document } = makeDocument(`<button id="menu">Menu</button>`);
  assert.equal(outcome.isVisibleActionableLoadMore(document, "#menu"), false);
});
