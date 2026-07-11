const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const DEFAULT_HTML = `
  <!doctype html>
  <main>
    <article data-width="520" data-height="760" data-top="20">
      <img id="slide" src="https://media.example.test/slide-a.jpg" data-width="480" data-height="600" alt="Slide A">
      <img id="avatar" src="https://media.example.test/avatar.jpg" data-width="32" data-height="32" alt="Avatar">
    </article>
  </main>
`;

function makeContentDocument(options = {}) {
  const dom = new JSDOM(options.html || DEFAULT_HTML, {
    url: options.url || "https://social.example.test/p/abc/?img_index=3",
    pretendToBeVisual: true,
    runScripts: "outside-only"
  });

  const { window } = dom;
  const storage = {
    happyAttentionQueue: []
  };

  Object.defineProperty(window, "innerWidth", { configurable: true, value: options.innerWidth || 900 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: options.innerHeight || 900 });
  window.__happyBrowserTestHooksRequested = true;
  if (options.fetch) {
    window.fetch = options.fetch;
  }
  window.HappyNavigationScoring = options.scoring || {
    analyzeNavigation() {
      return emptyAnalysis();
    }
  };
  window.chrome = {
    runtime: {
      getManifest() {
        return { version: "test" };
      },
      sendMessage: options.runtimeSendMessage
    },
    storage: {
      sync: {
        get(defaults, callback) {
          callback(defaults);
        },
        set() {}
      },
      local: {
        get(defaults, callback) {
          const values = {};
          Object.keys(defaults).forEach((key) => {
            values[key] = Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : defaults[key];
          });
          callback(values);
        },
        set(values, callback) {
          Object.assign(storage, values);
          if (callback) {
            callback();
          }
        }
      },
      onChanged: {
        addListener() {}
      }
    }
  };

  window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.hidden || this.hasAttribute("hidden")) {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    }
    const width = Number(this.getAttribute("data-width")) || 96;
    const height = Number(this.getAttribute("data-height")) || 44;
    const left = Number(this.getAttribute("data-left")) || 10;
    const top = Number(this.getAttribute("data-top")) || 10;
    return { width, height, top, left, right: left + width, bottom: top + height };
  };

  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    window.__lastScrolledIntoView = this;
  };

  // Feature modules register onto window.HappyBrowser and must load before content.js,
  // mirroring the manifest content_scripts order.
  const moduleFiles = ["navigation-rail.js", "site-filter.js", "link-tray.js", "work-tree.js", "ra-filter.js", "content.js"];
  for (const file of moduleFiles) {
    window.eval(fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"));
  }
  return { dom, storage };
}

function emptyAnalysis() {
  return {
    state: "none",
    directions: {
      next: { best: null, confidence: "none", candidates: [] },
      previous: { best: null, confidence: "none", candidates: [] }
    }
  };
}

function carouselScoring(documentRef) {
  const analysis = emptyAnalysis();
  const next = documentRef.querySelector("[data-carousel-next]");
  const previous = documentRef.querySelector("[data-carousel-prev]");

  if (next) {
    analysis.state = "tentative";
    analysis.directions.next = {
      best: {
        direction: "next",
        type: "click",
        confidence: "tentative",
        selector: "[data-carousel-next]",
        text: "Next",
        reason: ["media-carousel-control"]
      },
      confidence: "tentative",
      candidates: []
    };
  }

  if (previous) {
    analysis.state = "tentative";
    analysis.directions.previous = {
      best: {
        direction: "previous",
        type: "click",
        confidence: "tentative",
        selector: "[data-carousel-prev]",
        text: "Previous",
        reason: ["media-carousel-control"]
      },
      confidence: "tentative",
      candidates: []
    };
  }

  return analysis;
}

function getHappyRail(dom) {
  return dom.window.document
    .querySelector("#happy-browser-shadow-host")
    .shadowRoot
    .querySelector("#happy-browser-rail");
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function main() {
  await run("media signature changes count as page advancement", () => {
    const { dom } = makeContentDocument();
    const { window } = dom;
    const hooks = window.__HappyBrowserTestHooks;

    assert.ok(hooks);
    const before = hooks.capturePageSnapshot();
    const slide = window.document.querySelector("#slide");
    slide.setAttribute("src", "https://media.example.test/slide-b.jpg");
    slide.setAttribute("alt", "Slide B");
    const after = hooks.capturePageSnapshot();

    assert.notEqual(before.mediaSignature, after.mediaSignature);
    assert.equal(hooks.didPageAdvance(before, after), true);
    dom.window.close();
  });

  await run("chooses focused post by viewport center", () => {
    const { dom } = makeContentDocument({
      html: `
        <!doctype html>
        <main>
          <article id="top-post" data-width="520" data-height="620" data-top="-520">
            <img src="https://media.example.test/top.jpg" data-width="480" data-height="520" data-top="-500">
          </article>
          <article id="center-post" data-width="520" data-height="620" data-top="140">
            <img src="https://media.example.test/center.jpg" data-width="480" data-height="520" data-top="160">
          </article>
          <article id="low-post" data-width="520" data-height="620" data-top="820">
            <img src="https://media.example.test/low.jpg" data-width="480" data-height="520" data-top="840">
          </article>
        </main>
      `
    });

    assert.equal(dom.window.__HappyBrowserTestHooks.getFocusedPost().id, "center-post");
    dom.window.close();
  });

  await run("chooses carousel before next post then scrolls after carousel end", () => {
    const { dom } = makeContentDocument({
      html: `
        <!doctype html>
        <main>
          <article id="first-post" data-width="520" data-height="620" data-top="80">
            <img src="https://media.example.test/first.jpg" data-width="480" data-height="520" data-top="100">
            <button data-carousel-next data-width="44" data-height="62" data-top="300" aria-label="Next"></button>
          </article>
          <article id="second-post" data-width="520" data-height="620" data-top="760">
            <img src="https://media.example.test/second.jpg" data-width="480" data-height="520" data-top="780">
          </article>
        </main>
      `,
      scoring: { analyzeNavigation: carouselScoring }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const firstAction = hooks.getFeedNavigationAction("next");
    assert.equal(firstAction.type, "carousel");
    assert.equal(firstAction.post.id, "first-post");

    dom.window.document.querySelector("[data-carousel-next]").remove();
    const secondAction = hooks.getFeedNavigationAction("next");
    assert.equal(secondAction.type, "post-scroll");
    assert.equal(secondAction.post.id, "second-post");
    dom.window.close();
  });

  await run("queues focused post locally and de-dupes by post key", async () => {
    const { dom, storage } = makeContentDocument({
      html: `
        <!doctype html>
        <main>
          <article id="queued-post" data-width="520" data-height="620" data-top="80">
            <a href="/author/">author.name</a>
            <a href="/p/post-id/">June 11</a>
            <img src="https://media.example.test/queued.jpg" data-width="480" data-height="520" data-top="100" alt="Queued image">
            <p>Important update to revisit later.</p>
          </article>
        </main>
      `
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const first = await hooks.queueFocusedPost();
    const second = await hooks.queueFocusedPost();

    assert.equal(first.key, "https://social.example.test/p/post-id/");
    assert.equal(second.key, first.key);
    assert.equal(storage.happyAttentionQueue.length, 1);
    assert.equal(hooks.getAttentionQueue().length, 1);
    assert.match(storage.happyAttentionQueue[0].snippet, /Important update/);
    dom.window.close();
  });

  await run("captures dragged links from their surrounding rendered row", () => {
    const { dom } = makeContentDocument({
      url: "https://github.com/gitwid/AI-Indexer/pulls",
      html: `
        <!doctype html>
        <main>
          <div class="Box-row" id="pr-row" data-width="760" data-height="94" data-top="80">
            <a class="Link--primary" id="pr-link" href="/gitwid/AI-Indexer/pull/12">Add tray support</a>
            <span>#12 opened by diva</span>
            <p>Dock pull request links for chronological review.</p>
          </div>
        </main>
      `
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const item = hooks.getLinkTrayItemFromAnchor(dom.window.document.querySelector("#pr-link"));

    assert.equal(item.href, "https://github.com/gitwid/AI-Indexer/pull/12");
    assert.equal(item.title, "Add tray support");
    assert.match(item.snippet, /opened by diva/);
    assert.match(item.snapshotHtml, /Dock pull request links/);
    assert.doesNotMatch(item.snapshotHtml, /href=/);
    dom.window.close();
  });

  await run("link tray keeps four newest FIFO entries", async () => {
    const { dom, storage } = makeContentDocument({
      url: "https://github.com/gitwid/AI-Indexer/pulls"
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    for (let index = 1; index <= 5; index += 1) {
      await hooks.queueLinkTrayItem({
        href: `https://github.com/gitwid/AI-Indexer/pull/${index}`,
        title: `PR ${index}`,
        snippet: `Pull request ${index}`,
        snapshotHtml: `<p>PR ${index}</p>`
      });
    }

    const hrefs = Array.from(hooks.getLinkTrayItems(), (item) => item.href);
    assert.deepEqual(hrefs, [
      "https://github.com/gitwid/AI-Indexer/pull/5",
      "https://github.com/gitwid/AI-Indexer/pull/4",
      "https://github.com/gitwid/AI-Indexer/pull/3",
      "https://github.com/gitwid/AI-Indexer/pull/2"
    ]);
    assert.equal(storage.happyLinkTray.length, 4);
    assert.equal(storage.happyLinkTray.some((item) => /\/1$/.test(item.href)), false);

    await hooks.clearLinkTray();
    assert.equal(hooks.getLinkTrayItems().length, 0);
    assert.equal(storage.happyLinkTray.length, 0);
    assert.equal(getHappyRail(dom).dataset.linkTrayCount, "0");
    dom.window.close();
  });

  await run("photographs non-draggable DOM controls into reviewed tray actions", async () => {
    const { dom, storage } = makeContentDocument({
      url: "https://example.test/workflow",
      html: `
        <!doctype html>
        <main>
          <section id="conflict-tools" data-width="420" data-height="120" data-top="80">
            <h2>Conflict choices</h2>
            <button id="accept-incoming" data-width="160" data-height="36" data-top="120">Accept incoming change</button>
          </section>
        </main>
      `
    });

    const { window } = dom;
    const hooks = window.__HappyBrowserTestHooks;
    const button = window.document.querySelector("#accept-incoming");
    const item = hooks.getLinkTrayItemFromElement(button);

    assert.equal(item.type, "dom");
    assert.equal(item.review, "pending");
    assert.equal(item.selfTest.passed, true);
    assert.equal(item.selector, "#accept-incoming");
    assert.match(item.snapshotHtml, /Conflict choices/);

    await hooks.queueLinkTrayItem(item);
    assert.equal(storage.happyLinkTray[0].review, "pending");

    const rail = getHappyRail(dom);
    const accept = rail.querySelector(".happy-browser-link-tray__accept");
    accept.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    assert.equal(hooks.getLinkTrayItems()[0].review, "accepted");
    assert.equal(storage.happyLinkTray[0].review, "accepted");

    const second = hooks.getLinkTrayItemFromElement(button);
    await hooks.queueLinkTrayItem({
      ...second,
      selector: "button:nth-of-type(1)",
      key: "dom:reject-me"
    });
    const reject = rail.querySelector(".happy-browser-link-tray__reject");
    reject.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    assert.equal(hooks.getLinkTrayItems().some((trayItem) => trayItem.key === "dom:reject-me"), false);
    dom.window.close();
  });

  await run("work tree records clicked links and buttons as inspectable steps", () => {
    const { dom } = makeContentDocument({
      url: "https://review.example.test/queue",
      html: `
        <!doctype html>
        <main>
          <a id="open" href="/queue/item-7">Open item 7</a>
          <button id="resolve" type="button">Resolve conflict</button>
          <a id="external" href="https://elsewhere.example.org/docs">Docs</a>
        </main>
      `
    });
    const { window } = dom;
    const hooks = window.__HappyBrowserTestHooks;

    hooks.recordWorkTreeInteraction(window.document.querySelector("#open"));
    hooks.recordWorkTreeInteraction(window.document.querySelector("#resolve"));
    hooks.recordWorkTreeInteraction(window.document.querySelector("#external"));

    const steps = hooks.getWorkTreeSteps();
    assert.equal(steps.length, 3);
    assert.deepEqual(Array.from(steps, (step) => step.kind), ["link", "button", "link"]);
    assert.equal(steps[0].label, "Open item 7");
    // Same-origin link keeps a compact path; cross-origin keeps the full href.
    assert.equal(steps[0].href, "/queue/item-7");
    assert.equal(steps[2].href, "https://elsewhere.example.org/docs");
    assert.equal(getHappyRail(dom).dataset.workTreeCount, "3");

    // A step is rendered into the rail panel and stays inspectable (title attribute).
    const rendered = getHappyRail(dom).querySelectorAll(".happy-browser-work-tree__step");
    assert.equal(rendered.length, 3);
    assert.match(rendered[0].getAttribute("title"), /Open item 7/);
    dom.window.close();
  });

  await run("work tree collapses consecutive identical actions into one counted step", () => {
    const { dom } = makeContentDocument({
      url: "https://review.example.test/queue",
      html: `
        <!doctype html>
        <main>
          <button id="accept" type="button">Accept incoming</button>
          <a id="next" href="/queue/next">Next</a>
        </main>
      `
    });
    const { window } = dom;
    const hooks = window.__HappyBrowserTestHooks;
    const accept = window.document.querySelector("#accept");

    hooks.recordWorkTreeInteraction(accept);
    hooks.recordWorkTreeInteraction(accept);
    hooks.recordWorkTreeInteraction(accept);
    hooks.recordWorkTreeInteraction(window.document.querySelector("#next"));

    const steps = hooks.getWorkTreeSteps();
    assert.equal(steps.length, 2);
    assert.equal(steps[0].count, 3);
    assert.equal(steps[0].label, "Accept incoming");
    assert.equal(steps[1].count, 1);

    const badge = getHappyRail(dom).querySelector(".happy-browser-work-tree__count");
    assert.ok(badge);
    assert.equal(badge.textContent, "×3");

    hooks.clearWorkTree();
    assert.equal(hooks.getWorkTreeSteps().length, 0);
    assert.equal(getHappyRail(dom).dataset.workTreeCount, "0");
    dom.window.close();
  });

  await run("filters RA Berlin cards to this week plus LGBTQ signals from detail pages", async () => {
    const detailPages = {
      "https://ra.co/events/111": raDetail({
        title: "Queer Today",
        startDate: "2026-07-04T22:00:00.000",
        description: "A sex positive floor with an awareness team all night."
      }),
      "https://ra.co/events/222": raDetail({
        title: "Today Without Signal",
        startDate: "2026-07-04T21:00:00.000",
        description: "House and techno in the garden."
      }),
      "https://ra.co/events/333": raDetail({
        title: "Next Week With Signal",
        startDate: "2026-07-06T21:00:00.000",
        description: "Queer collective with awareness team."
      })
    };
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="match" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/111">Queer Today</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="miss" data-width="260" data-height="420" data-top="540">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/222">Today Without Signal</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="tomorrow" data-width="260" data-height="420" data-top="1000">
            <div>MON, 6 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/333">Next Week With Signal</a></h3>
          </div>
        </main>
      `,
      fetch(url) {
        fetchCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(detailPages[url])
        });
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const status = await hooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const rail = getHappyRail(dom);

    assert.equal(status.matched, 1);
    assert.equal(status.today, 2);
    assert.equal(status.sources.direct, 2);
    assert.equal(status.sources["date-skip"], 1);
    assert.equal(rail.dataset.raFilterPhase, "done");
    assert.equal(rail.querySelector(".happy-browser-ra-progress").textContent, "done 1/2");
    assert.equal(dom.window.document.documentElement.dataset.happyRaMode, "ghost");
    assert.equal(dom.window.document.querySelector("#match").dataset.happyRaFilter, "match");
    assert.equal(dom.window.document.querySelector("#match").dataset.happyRaSource, "direct");
    assert.equal(dom.window.document.querySelector("#miss").dataset.happyRaFilter, "miss");
    assert.equal(dom.window.document.querySelector("#tomorrow").dataset.happyRaFilter, "miss");
    assert.equal(fetchCount, 2);

    await hooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    assert.equal(fetchCount, 2);
    dom.window.close();
  });

  await run("filters the Queer Berlin party-menu week into one RA button pass", async () => {
    const detailPages = {
      "https://ra.co/events/9001": raDetail({
        title: "La Casita",
        startDate: "2026-07-09T22:00:00.000",
        description: "La Casita is a queer dance night with an awareness team."
      }),
      "https://ra.co/events/9002": raDetail({
        title: "Gegen Culeo",
        startDate: "2026-07-10T20:00:00.000",
        description: "Queer Mama Awareness Team, harm reduction stand, and bodies that are not binary."
      }),
      "https://ra.co/events/9003": raDetail({
        title: "VRAU",
        startDate: "2026-07-11T23:00:00.000",
        description: "Club night by VRAU."
      }),
      "https://ra.co/events/9004": raDetail({
        title: "Pleasure Patterns",
        startDate: "2026-07-11T22:00:00.000",
        description: "Pleasure Patterns takes over the bar."
      }),
      "https://ra.co/events/9005": raDetail({
        title: "Cuntcore",
        startDate: "2026-07-11T23:59:00.000",
        description: "Cuntcore returns with drag hosts."
      }),
      "https://ra.co/events/9006": raDetail({
        title: "Tipsy Disco",
        startDate: "2026-07-12T14:00:00.000",
        description: "A queer bar explodes into a daytime disco with drag gogo dancers."
      }),
      "https://ra.co/events/9007": raDetail({
        title: "LECKEN Moisturize [OPEN AIR]",
        startDate: "2026-07-12T13:00:00.000",
        description: "A queer erogenous rave with darkroom tide."
      }),
      "https://ra.co/events/9008": raDetail({
        title: "Regular Club Night",
        startDate: "2026-07-11T23:00:00.000",
        description: "House and techno all night."
      })
    };
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="la-casita" data-width="260" data-height="420" data-top="80">
            <div>THU, 9 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9001">La Casita</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="gegen" data-width="260" data-height="420" data-top="540">
            <div>FRI, 10 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9002">Gegen Culeo</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="vrau" data-width="260" data-height="420" data-top="1000">
            <div>SAT, 11 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9003">VRAU</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="pleasure-patterns" data-width="260" data-height="420" data-top="1460">
            <div>SAT, 11 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9004">Pleasure Patterns</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="cuntcore" data-width="260" data-height="420" data-top="1920">
            <div>SAT, 11 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9005">Cuntcore</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="tipsy-disco" data-width="260" data-height="420" data-top="2380">
            <div>SUN, 12 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9006">Tipsy Disco</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="lecken" data-width="260" data-height="420" data-top="2840">
            <div>SUN, 12 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9007">LECKEN Moisturize [OPEN AIR]</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="regular" data-width="260" data-height="420" data-top="3300">
            <div>SAT, 11 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9008">Regular Club Night</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="next-week" data-width="260" data-height="420" data-top="3760">
            <div>MON, 13 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9009">Next Week Queer Night</a></h3>
          </div>
        </main>
      `,
      fetch(url) {
        fetchCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(detailPages[url])
        });
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const status = await hooks.runRaLgbtqFilter({ today: "2026-07-07", force: true });

    assert.equal(status.matched, 7);
    assert.equal(status.today, 8);
    assert.equal(status.hidden, 2);
    assert.equal(status.sources.direct, 8);
    assert.equal(status.sources["date-skip"], 1);
    assert.equal(fetchCount, 8);
    assert.equal(dom.window.document.querySelector("#vrau").dataset.happyRaFilter, "match");
    assert.equal(dom.window.document.querySelector("#regular").dataset.happyRaFilter, "miss");
    assert.equal(dom.window.document.querySelector("#next-week").dataset.happyRaSource, "date-skip");
    dom.window.close();
  });

  await run("shows RA queer proof on matched card hover and stores signal confirmations", async () => {
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="proof-card" data-width="260" data-height="420" data-top="80">
            <div>FRI, 10 JUL</div>
            <a data-pw-test-id="event-image-link" href="/events/9101"><img src="https://img.example.test/gegen.jpg" alt=""></a>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/9101">Gegen Culeo</a></h3>
          </div>
        </main>
      `,
      fetch() {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(raDetail({
            title: "Gegen Culeo",
            startDate: "2026-07-10T20:00:00.000",
            description: "Queer Mama Awareness Team and harm reduction stand for bodies that are not binary."
          }))
        });
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    await hooks.runRaLgbtqFilter({ today: "2026-07-07", force: true });
    const card = dom.window.document.querySelector("#proof-card");
    card.dispatchEvent(new dom.window.MouseEvent("mouseover", {
      bubbles: true,
      relatedTarget: null
    }));

    const proof = hooks.getRaProofCard();
    assert.equal(proof.dataset.visible, "true");
    assert.match(proof.textContent, /Gegen Culeo/);
    assert.match(proof.textContent, /queer/i);
    assert.match(proof.innerHTML, /<mark>Queer<\/mark>/i);
    assert.equal(proof.querySelector("img").getAttribute("src"), "https://img.example.test/gegen.jpg");

    const signal = proof.querySelector("[data-signal='queer']");
    signal.dispatchEvent(new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true
    }));

    const confirmations = hooks.getRaSignalConfirmations();
    assert.ok(confirmations["https://ra.co/events/9101"].queer);
    assert.equal(signal.dataset.confirmed, "true");
    assert.match(signal.textContent, /^OK queer$/);
    dom.window.close();
  });

  await run("cycles RA filter between ghost filtered and all modes", async () => {
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="match" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/777">Matched</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="miss" data-width="260" data-height="420" data-top="540">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/888">Missed</a></h3>
          </div>
        </main>
      `,
      fetch(url) {
        const details = {
          "https://ra.co/events/777": raDetail({
            title: "Matched",
            startDate: "2026-07-04T21:00:00.000",
            description: "Sex positive event with an awareness team."
          }),
          "https://ra.co/events/888": raDetail({
            title: "Missed",
            startDate: "2026-07-04T21:00:00.000",
            description: "Regular club event."
          })
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(details[url])
        });
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    await hooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    assert.equal(hooks.getRaFilterMode(), "ghost");
    assert.equal(dom.window.document.documentElement.dataset.happyRaMode, "ghost");
    assert.equal(dom.window.document.querySelector("#miss").dataset.happyRaFilter, "miss");

    hooks.toggleRaFilter();
    assert.equal(hooks.getRaFilterMode(), "filtered");
    assert.equal(dom.window.document.documentElement.dataset.happyRaMode, "filtered");
    assert.equal(dom.window.document.querySelector("#miss").dataset.happyRaFilter, "miss");

    hooks.toggleRaFilter();
    assert.equal(hooks.getRaFilterMode(), "all");
    assert.equal(dom.window.document.documentElement.dataset.happyRaMode, "all");
    assert.equal(dom.window.document.querySelector("#miss").dataset.happyRaFilter, undefined);

    hooks.toggleRaFilter();
    assert.equal(hooks.getRaFilterMode(), "ghost");
    assert.equal(dom.window.document.documentElement.dataset.happyRaMode, "ghost");
    dom.window.close();
  });

  await run("shows RA filtering progress while detail pages are still loading", async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="slow-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/909">Slow Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        return fetchPromise;
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const runPromise = hooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const rail = getHappyRail(dom);
    const progress = rail.querySelector(".happy-browser-ra-progress");
    assert.equal(rail.dataset.raFilterPhase, "running");
    assert.equal(progress.textContent, "scan 0/1");

    resolveFetch({
      ok: true,
      status: 200,
      text: () => Promise.resolve(raDetail({
        title: "Slow Detail",
        startDate: "2026-07-04T21:00:00.000",
        description: "Queer night with an awareness team."
      }))
    });
    const status = await runPromise;

    assert.equal(status.matched, 1);
    assert.equal(rail.dataset.raFilterPhase, "done");
    assert.equal(progress.textContent, "done 1/1");
    dom.window.close();
  });

  await run("shows none this week when all RA cards are beyond the current week", async () => {
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="future-one" data-width="260" data-height="420" data-top="80">
            <div>MON, 13 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/1001">Future One</a></h3>
          </div>
          <div data-testid="event-upcoming-card" id="future-two" data-width="260" data-height="420" data-top="540">
            <div>TUE, 14 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/1002">Future Two</a></h3>
          </div>
        </main>
      `,
      fetch() {
        fetchCount += 1;
        return Promise.reject(new Error("future cards should not fetch details"));
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-06", force: true });
    const rail = getHappyRail(dom);
    assert.equal(status.today, 0);
    assert.equal(status.hidden, 2);
    assert.equal(status.sources["date-skip"], 2);
    assert.equal(rail.querySelector(".happy-browser-ra-progress").textContent, "none this week");
    assert.equal(fetchCount, 0);
    dom.window.close();
  });

  await run("detects RA event cards without treating controls as cards", () => {
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <button>Load more comments</button>
          <div data-testid="event-upcoming-card" id="event-card" data-width="260" data-height="420" data-top="80">
            <button>Bookmark Unchecked</button>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/444">Signal Event</a></h3>
          </div>
        </main>
      `,
      fetch() {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(raDetail({
            title: "Signal Event",
            startDate: "2026-07-04T21:00:00.000",
            description: "Queer night with awareness team."
          }))
        });
      }
    });

    const cards = dom.window.__HappyBrowserTestHooks.getRaEventCards();
    assert.equal(cards.length, 1);
    assert.equal(cards[0].element.id, "event-card");
    assert.equal(cards[0].href, "https://ra.co/events/444");
    dom.window.close();
  });

  await run("detects RA listing cards and inherits grouped date headings", async () => {
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <ul data-testid="event-listing">
            <li>
              <div>
                <div data-testid="sticky">MON, 6 JUL</div>
                <div data-testid="event-listing-card" id="today-listing-card" data-width="568" data-height="138" data-top="120">
                  <a href="/events/1003">Today Listing Event</a>
                </div>
                <div data-testid="event-listing-card" id="today-listing-card-two" data-width="568" data-height="138" data-top="280">
                  <a href="/events/1004">Second Today Listing Event</a>
                </div>
              </div>
            </li>
          </ul>
        </main>
      `,
      fetch(url) {
        fetchCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(raDetail({
            title: url.endsWith("/1003") ? "Today Listing Event" : "Second Today Listing Event",
            startDate: "2026-07-06T21:00:00.000",
            description: url.endsWith("/1003") ? "A queer night with an awareness team." : "Regular club night."
          }))
        });
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const cards = hooks.getRaEventCards();
    assert.equal(cards.length, 2);
    assert.equal(cards[0].element.id, "today-listing-card");
    assert.equal(cards[0].dateHint, "MON, 6 JUL");
    assert.equal(cards[1].dateHint, "MON, 6 JUL");

    const status = await hooks.runRaLgbtqFilter({ today: "2026-07-06", force: true });
    assert.equal(status.today, 2);
    assert.equal(status.matched, 1);
    assert.equal(status.sources.direct, 2);
    assert.equal(fetchCount, 2);
    dom.window.close();
  });

  await run("uses RA listing row text as queer evidence when detail metadata fails", async () => {
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <ul data-testid="event-listing">
            <li>
              <div>
                <div data-testid="sticky">FRI, 10 JUL</div>
                <div data-testid="event-listing-card" id="gegen-listing-card" data-width="568" data-height="138" data-top="120">
                  <a href="/events/2442746"><img src="https://img.example.test/gegen-row.jpg" alt=""></a>
                  <div>
                    <a href="/events/2442746">Gegen Culeo</a>
                    <p>Buday, Leonor Baesler, Daniela Fuzz, NSPERGER, Venus Melissa, JESUZ X</p>
                    <span>KitKatClub</span>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </main>
      `,
      fetch() {
        fetchCount += 1;
        return Promise.reject(new Error("detail temporarily unavailable"));
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const status = await hooks.runRaLgbtqFilter({ today: "2026-07-07", force: true });
    const card = dom.window.document.querySelector("#gegen-listing-card");

    assert.equal(status.matched, 1);
    assert.equal(status.today, 1);
    assert.equal(status.sources.card, 1);
    assert.equal(fetchCount, 1);
    assert.equal(card.dataset.happyRaFilter, "match");
    assert.equal(card.dataset.happyRaSource, "card");

    card.dispatchEvent(new dom.window.MouseEvent("mouseover", {
      bubbles: true,
      relatedTarget: null
    }));

    const proof = hooks.getRaProofCard();
    assert.equal(proof.dataset.visible, "true");
    assert.match(proof.textContent, /Gegen Culeo/);
    assert.match(proof.innerHTML, /<mark>Gegen<\/mark>/i);
    assert.equal(proof.querySelector("img").getAttribute("src"), "https://img.example.test/gegen-row.jpg");
    dom.window.close();
  });

  await run("skips next-week RA listing groups using inherited date headings", async () => {
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <ul data-testid="event-listing">
            <li>
              <div>
                <div data-testid="sticky">MON, 20 JUL</div>
                <div data-testid="event-listing-card" id="future-listing-card" data-width="568" data-height="138" data-top="120">
                  <a href="/events/1005">Future Listing Event</a>
                </div>
              </div>
            </li>
          </ul>
        </main>
      `,
      fetch() {
        fetchCount += 1;
        return Promise.reject(new Error("future listing card should not fetch details"));
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const cards = hooks.getRaEventCards();
    assert.equal(cards.length, 1);
    assert.equal(cards[0].dateHint, "MON, 20 JUL");

    const status = await hooks.runRaLgbtqFilter({ today: "2026-07-13", force: true });
    assert.equal(status.today, 0);
    assert.equal(status.hidden, 1);
    assert.equal(status.sources["date-skip"], 1);
    assert.equal(fetchCount, 0);
    dom.window.close();
  });

  await run("keeps RA cards visible when detail metadata is unavailable", async () => {
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="blocked-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/555">Needs Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            <!doctype html>
            <title>Verification required</title>
            <p>Please verify that you are human.</p>
          `)
        });
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#blocked-detail");
    assert.equal(status.unknown, 1);
    assert.equal(status.hidden, 0);
    assert.equal(card.dataset.happyRaFilter, "unknown");
    dom.window.close();
  });

  await run("uses extension background fetch when RA detail fetch is blocked", async () => {
    let directFetchCount = 0;
    let backgroundFetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="background-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/808">Background Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        directFetchCount += 1;
        return Promise.reject(new TypeError("Load failed"));
      },
      runtimeSendMessage(message, callback) {
        backgroundFetchCount += 1;
        assert.equal(message.type, "happy-browser-fetch-ra-detail");
        assert.equal(message.href, "https://ra.co/events/808");
        callback({
          ok: true,
          status: 200,
          text: raDetail({
            title: "Background Detail",
            startDate: "2026-07-04T21:00:00.000",
            description: "Sex positive party with an awareness team."
          })
        });
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#background-detail");
    assert.equal(status.matched, 1);
    assert.equal(status.unknown, 0);
    assert.equal(status.sources.background, 1);
    assert.equal(card.dataset.happyRaFilter, "match");
    assert.equal(card.dataset.happyRaSource, "background");
    assert.equal(directFetchCount, 1);
    assert.equal(backgroundFetchCount, 1);
    dom.window.close();
  });

  await run("uses extension background fetch when direct RA detail is an app shell", async () => {
    let directFetchCount = 0;
    let backgroundFetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="shell-then-background-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/809">Shell Then Background</a></h3>
          </div>
        </main>
      `,
      fetch() {
        directFetchCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            <!doctype html>
            <html>
              <head><title>RA shell</title></head>
              <body>
                <main>
                  <h1>Shell Then Background</h1>
                  <p>Generic app shell without event-specific metadata.</p>
                </main>
              </body>
            </html>
          `)
        });
      },
      runtimeSendMessage(message, callback) {
        backgroundFetchCount += 1;
        assert.equal(message.type, "happy-browser-fetch-ra-detail");
        assert.equal(message.href, "https://ra.co/events/809");
        callback({
          ok: true,
          status: 200,
          text: raDetail({
            title: "Shell Then Background",
            startDate: "2026-07-04T22:00:00.000",
            description: "Queer sex positive event with an awareness team."
          })
        });
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#shell-then-background-detail");
    assert.equal(status.matched, 1);
    assert.equal(status.unknown, 0);
    assert.equal(status.sources.background, 1);
    assert.equal(card.dataset.happyRaFilter, "match");
    assert.equal(card.dataset.happyRaSource, "background");
    assert.equal(directFetchCount, 1);
    assert.equal(backgroundFetchCount, 1);
    dom.window.close();
  });

  await run("does not fallback when direct RA detail is an anti-bot challenge", async () => {
    let directFetchCount = 0;
    let backgroundFetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="challenge-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/810">Challenge Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        directFetchCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            <!doctype html>
            <html>
              <head><title>ra.co</title></head>
              <body>
                <iframe src="https://geo.captcha-delivery.com/interstitial/"></iframe>
                <p>Please verify that you are human.</p>
              </body>
            </html>
          `)
        });
      },
      runtimeSendMessage() {
        backgroundFetchCount += 1;
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#challenge-detail");
    assert.equal(status.matched, 0);
    assert.equal(status.unknown, 1);
    assert.equal(status.sources.blocked, 1);
    assert.equal(card.dataset.happyRaFilter, "unknown");
    assert.equal(card.dataset.happyRaSource, "blocked");
    assert.equal(directFetchCount, 1);
    assert.equal(backgroundFetchCount, 0);
    dom.window.close();
  });

  await run("does not fallback when direct RA detail returns non-ok anti-bot html", async () => {
    let directFetchCount = 0;
    let backgroundFetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="non-ok-challenge-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/811">Non OK Challenge Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        directFetchCount += 1;
        return Promise.resolve({
          ok: false,
          status: 403,
          text: () => Promise.resolve(`
            <!doctype html>
            <html>
              <head><title>Just a moment...</title></head>
              <body>
                <iframe src="https://geo.captcha-delivery.com/interstitial/"></iframe>
                <p>Captcha verification required.</p>
              </body>
            </html>
          `)
        });
      },
      runtimeSendMessage() {
        backgroundFetchCount += 1;
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#non-ok-challenge-detail");
    assert.equal(status.matched, 0);
    assert.equal(status.unknown, 1);
    assert.equal(status.sources.blocked, 1);
    assert.equal(card.dataset.happyRaFilter, "unknown");
    assert.equal(card.dataset.happyRaSource, "blocked");
    assert.equal(directFetchCount, 1);
    assert.equal(backgroundFetchCount, 0);
    dom.window.close();
  });

  await run("detects anti-bot html returned by background RA detail fetch", async () => {
    let directFetchCount = 0;
    let backgroundFetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="background-challenge-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/812">Background Challenge Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        directFetchCount += 1;
        return Promise.reject(new TypeError("Load failed"));
      },
      runtimeSendMessage(message, callback) {
        backgroundFetchCount += 1;
        assert.equal(message.type, "happy-browser-fetch-ra-detail");
        assert.equal(message.href, "https://ra.co/events/812");
        callback({
          ok: false,
          status: 403,
          text: `
            <!doctype html>
            <html>
              <head><title>Access denied</title></head>
              <body>
                <iframe src="https://geo.captcha-delivery.com/interstitial/"></iframe>
                <p>Please verify that you are human.</p>
              </body>
            </html>
          `
        });
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#background-challenge-detail");
    assert.equal(status.matched, 0);
    assert.equal(status.unknown, 1);
    assert.equal(status.sources.blocked, 1);
    assert.equal(card.dataset.happyRaFilter, "unknown");
    assert.equal(card.dataset.happyRaSource, "blocked");
    assert.equal(directFetchCount, 1);
    assert.equal(backgroundFetchCount, 1);
    dom.window.close();
  });

  await run("waits for delayed RA iframe event metadata", async () => {
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin"
    });
    const hooks = dom.window.__HappyBrowserTestHooks;
    const iframe = dom.window.document.createElement("iframe");
    let currentDocument = new JSDOM(`
      <!doctype html>
      <html>
        <head><title>RA shell</title></head>
        <body><main>Loading event details...</main></body>
      </html>
    `).window.document;

    Object.defineProperty(iframe, "contentDocument", {
      configurable: true,
      get() {
        return currentDocument;
      }
    });

    const detailPromise = hooks.readRaFrameDetailWhenReady(iframe, "https://ra.co/events/813", {
      timeoutMs: 250,
      intervalMs: 10
    });
    dom.window.setTimeout(() => {
      currentDocument = new JSDOM(raDetail({
        title: "Delayed Frame Detail",
        startDate: "2026-07-04T23:00:00.000",
        description: "A sex positive event with an awareness team."
      })).window.document;
      iframe.dispatchEvent(new dom.window.Event("load"));
    }, 30);

    const detail = await detailPromise;
    assert.equal(detail.hasEventData, true);
    assert.equal(detail.title, "Delayed Frame Detail");
    assert.match(detail.signalText, /sex positive/i);
    assert.match(detail.signalText, /awareness team/i);
    dom.window.close();
  });

  await run("does not match RA app shell text as event-specific signals", async () => {
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="shell-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/919">Regular Event</a></h3>
          </div>
        </main>
      `,
      fetch() {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            <!doctype html>
            <html>
              <head><title>Regular Event</title></head>
              <body>
                <main>
                  <h1>Regular Event</h1>
                  <p>Generic RA shell text mentions queer editorial coverage and an awareness team elsewhere.</p>
                </main>
              </body>
            </html>
          `)
        });
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#shell-detail");
    assert.equal(status.matched, 0);
    assert.equal(status.unknown, 1);
    assert.equal(card.dataset.happyRaFilter, "unknown");
    dom.window.close();
  });

  await run("matches RA event-specific Next data by event id", async () => {
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="next-data-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/920">Structured Event</a></h3>
          </div>
        </main>
      `,
      fetch() {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            <!doctype html>
            <html>
              <head>
                <title>Structured Event</title>
                <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
                  props: {
                    pageProps: {
                      event: {
                        id: 920,
                        title: "Structured Event",
                        description: "Queer collective with an awareness team.",
                        artists: [{ name: "Resident" }]
                      }
                    }
                  }
                })}</script>
              </head>
              <body><main><h1>Structured Event</h1></main></body>
            </html>
          `)
        });
      }
    });

    const status = await dom.window.__HappyBrowserTestHooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    const card = dom.window.document.querySelector("#next-data-detail");
    assert.equal(status.matched, 1);
    assert.equal(status.unknown, 0);
    assert.equal(status.sources.direct, 1);
    assert.equal(card.dataset.happyRaFilter, "match");
    assert.equal(card.dataset.happyRaSource, "direct");
    dom.window.close();
  });

  await run("retries RA filter when current cards are still unknown", async () => {
    let blocked = true;
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="retry-detail" data-width="260" data-height="420" data-top="80">
            <div>SAT, 4 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/666">Retry Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        fetchCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(blocked ? `
            <!doctype html>
            <title>Verification required</title>
            <p>Please verify that you are human.</p>
          ` : raDetail({
            title: "Retry Detail",
            startDate: "2026-07-04T21:00:00.000",
            description: "A sex positive party with an awareness team."
          }))
        });
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const first = await hooks.runRaLgbtqFilter({ today: "2026-07-04" });
    assert.equal(first.unknown, 1);
    assert.equal(dom.window.document.querySelector("#retry-detail").dataset.happyRaFilter, "unknown");

    blocked = false;
    const second = await hooks.runRaLgbtqFilter({ today: "2026-07-04" });
    assert.equal(second.matched, 1);
    assert.equal(fetchCount, 2);
    assert.equal(dom.window.document.querySelector("#retry-detail").dataset.happyRaFilter, "match");
    dom.window.close();
  });

  await run("reruns RA filter when Berlin today changes with unchanged cards", async () => {
    let fetchCount = 0;
    const { dom } = makeContentDocument({
      url: "https://ra.co/events/de/berlin",
      html: `
        <!doctype html>
        <main>
          <div data-testid="event-upcoming-card" id="date-rollover-detail" data-width="260" data-height="420" data-top="80">
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/606">Date Rollover Detail</a></h3>
          </div>
        </main>
      `,
      fetch() {
        fetchCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(raDetail({
            title: "Date Rollover Detail",
            startDate: "2026-07-06T21:00:00.000",
            description: "A queer sex positive event with an awareness team."
          }))
        });
      }
    });

    const hooks = dom.window.__HappyBrowserTestHooks;
    const first = await hooks.runRaLgbtqFilter({ today: "2026-07-05", force: true });
    assert.equal(first.todayISO, "2026-07-05");
    assert.equal(first.matched, 0);
    assert.equal(dom.window.document.querySelector("#date-rollover-detail").dataset.happyRaFilter, "miss");

    const second = await hooks.runRaLgbtqFilter({ today: "2026-07-06" });
    assert.equal(second.todayISO, "2026-07-06");
    assert.equal(second.matched, 1);
    assert.equal(fetchCount, 1);
    assert.equal(dom.window.document.querySelector("#date-rollover-detail").dataset.happyRaFilter, "match");
    dom.window.close();
  });
}

function raDetail({ title, startDate, description }) {
  return `
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <meta name="description" content="${description}">
        <script type="application/ld+json">${JSON.stringify({
          "@context": "http://schema.org",
          "@type": "MusicEvent",
          name: title,
          startDate,
          description
        })}</script>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
      </body>
    </html>
  `;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
