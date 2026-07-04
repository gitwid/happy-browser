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

  const contentPath = path.join(__dirname, "..", "src", "content.js");
  window.eval(fs.readFileSync(contentPath, "utf8"));
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

  await run("filters RA Berlin cards to today plus LGBTQ signals from detail pages", async () => {
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
        title: "Tomorrow With Signal",
        startDate: "2026-07-05T21:00:00.000",
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
            <div>SUN, 5 JUL</div>
            <h3 data-pw-test-id="event-title"><a data-pw-test-id="event-title-link" href="/events/333">Tomorrow With Signal</a></h3>
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
    assert.equal(rail.dataset.raFilterPhase, "done");
    assert.equal(rail.querySelector(".happy-browser-ra-progress").textContent, "done 1/2");
    assert.equal(dom.window.document.documentElement.dataset.happyRaMode, "ghost");
    assert.equal(dom.window.document.querySelector("#match").dataset.happyRaFilter, "match");
    assert.equal(dom.window.document.querySelector("#miss").dataset.happyRaFilter, "miss");
    assert.equal(dom.window.document.querySelector("#tomorrow").dataset.happyRaFilter, "miss");
    assert.equal(fetchCount, 2);

    await hooks.runRaLgbtqFilter({ today: "2026-07-04", force: true });
    assert.equal(fetchCount, 2);
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
    assert.equal(card.dataset.happyRaFilter, "match");
    assert.equal(directFetchCount, 1);
    assert.equal(backgroundFetchCount, 1);
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
    assert.equal(card.dataset.happyRaFilter, "match");
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
