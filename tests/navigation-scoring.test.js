const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const scoring = require("../src/navigation-scoring.js");

function makeDocument(html, url = "https://example.com/gallery/page/2/") {
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
    if (this.hidden || this.hasAttribute("hidden")) {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    }
    return { width: 96, height: 44, top: 0, left: 0, right: 96, bottom: 44 };
  };

  return dom.window.document;
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

run("finds strong rel next and previous links", () => {
  const document = makeDocument(`
    <nav class="pagination">
      <a rel="prev" href="/gallery/page/1/">Previous</a>
      <a rel="next" href="/gallery/page/3/">Next</a>
    </nav>
  `);
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.confidence, "strong");
  assert.equal(result.directions.previous.confidence, "strong");
  assert.equal(result.directions.next.best.href, "https://example.com/gallery/page/3/");
});

run("treats javascript-only carousel controls as tentative", () => {
  const document = makeDocument(`
    <section class="product carousel">
      <button aria-label="Previous image">‹</button>
      <button aria-label="Next image">›</button>
    </section>
  `, "https://shop.example.com/item/abc");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.confidence, "tentative");
  assert.equal(result.directions.next.best.type, "click");
  assert.equal(result.directions.next.best.preflight.jsOnly, true);
});

run("avoids unrelated menu and form controls", () => {
  const document = makeDocument(`
    <form class="filters">
      <button>Next size</button>
    </form>
    <main>
      <article>Nothing to page through here.</article>
    </main>
  `, "https://example.com/products");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "none");
  assert.equal(result.directions.next.confidence, "none");
});

run("uses high-confidence query pagination fallback as tentative", () => {
  const document = makeDocument(`
    <main>
      <article>Results without visible pagination.</article>
    </main>
  `, "https://example.com/search?q=desk&page=2");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.best.href, "https://example.com/search?q=desk&page=3");
  assert.equal(result.directions.previous.best.href, "https://example.com/search?q=desk&page=1");
});

run("promotes query pagination when total page text is visible", () => {
  const document = makeDocument(`
    <main>
      <button>Zurück</button>
      <section class="products">Product cards...</section>
      <nav class="pagination">
        <span>2 von 25</span>
      </nav>
    </main>
  `, "https://www.gruenhorn.de/live-bestand/?order=live-bestand-bluten&p=2");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.confidence, "strong");
  assert.equal(result.directions.next.best.type, "url");
  assert.equal(result.directions.next.best.href, "https://www.gruenhorn.de/live-bestand/?order=live-bestand-bluten&p=3");
  assert.equal(result.directions.previous.best.href, "https://www.gruenhorn.de/live-bestand/?order=live-bestand-bluten&p=1");
});

run("detects Shopware label-based icon pagination", () => {
  const document = makeDocument(`
    <nav aria-label="pages">
      <ul class="pagination">
        <li class="page-item page-prev disabled"></li>
        <li class="page-item active"><span>1 von 32</span></li>
        <li class="page-item page-next">
          <input type="radio" name="p" id="p-next-bottom" value="2" class="d-none">
          <label class="page-link" for="p-next-bottom">
            <span class="icon icon-feather icon-feather-chevron-right icon-xs">
              <svg class="feather feather-chevron-right"></svg>
            </span>
          </label>
        </li>
      </ul>
    </nav>
  `, "https://www.gruenhorn.de/live-bestand/?order=live-bestand-bluten");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.confidence, "tentative");
  assert.equal(result.directions.next.best.type, "click");
  assert.match(result.directions.next.best.selector, /label/);
  assert.equal(result.directions.next.best.preflight.jsOnly, true);
});

run("prefers load more over footer partner links", () => {
  const document = makeDocument(`
    <main>
      <h1>Extrakte</h1>
      <section class="product-grid">
        <button class="load-more">mehr laden</button>
      </section>
    </main>
    <footer class="footer partner-banner">
      <a href="https://hanfverband.de/" aria-label="Hanfverband">
        <svg class="feather feather-chevron-right"></svg>
      </a>
    </footer>
  `, "https://flowzz.com/extract");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.best.type, "click");
  assert.match(result.directions.next.best.text, /mehr laden/);
  assert.notEqual(result.directions.next.best.href, "https://hanfverband.de/");
});

run("promotes exact Flowzz load more button", () => {
  const document = makeDocument(`
    <main>
      <div class="MuiGrid2-root">
        <button class="MuiButtonBase-root MuiButton-root MuiButton-text" tabindex="0" type="button">mehr laden</button>
      </div>
    </main>
  `, "https://flowzz.com/cannatree-rats-apotheke?pagination%5Bpage%5D=1");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.best.type, "click");
  assert.match(result.directions.next.best.reason.join(" "), /exact-load-more-button/);
});

run("detects German page-next pagination links", () => {
  const document = makeDocument(`
    <main>
      <ol class="products">
        <li>Product</li>
      </ol>
      <nav class="pages">
        <a class="action next" href="/cannabis-blueten/filter/lagerbestand-in/?p=2" title="Seite Weiter">
          <span>Seite Weiter</span>
        </a>
        <a href="/cannabis-blueten/">Alle Produkte</a>
      </nav>
    </main>
  `, "https://www.bluetenbude.de/cannabis-blueten/filter/lagerbestand-in/");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.best.href, "https://www.bluetenbude.de/cannabis-blueten/filter/lagerbestand-in/?p=2");
});

run("prefers numbered pagination over blog weiterlesen links", () => {
  const document = makeDocument(`
    <main>
      <section class="products">
        <article>Product list</article>
        <nav class="pagination">
          <span class="current">1</span>
          <a href="/extrakte?page=2">2</a>
          <a href="/extrakte?page=3">3</a>
        </nav>
      </section>
      <section class="ratgeber blog">
        <article>
          <h2>Das Endocannabinoid-System</h2>
          <a href="/blog/das-endocannabinoid-system-ecs-jeder-mensch-braucht-cannabinoide">weiterlesen</a>
        </article>
      </section>
    </main>
  `, "https://bavarian-cannabis.com/extrakte");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.best.href, "https://bavarian-cannabis.com/extrakte?page=2");
});

run("advances from numeric page two to page three", () => {
  const document = makeDocument(`
    <main>
      <section class="products">
        <nav class="pagination">
          <a href="/extrakte?page=1">1</a>
          <span class="current">2</span>
          <a href="/extrakte?page=3">3</a>
        </nav>
      </section>
    </main>
  `, "https://bavarian-cannabis.com/extrakte?page=2");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.best.href, "https://bavarian-cannabis.com/extrakte?page=3");
  assert.equal(result.directions.previous.best.href, "https://bavarian-cannabis.com/extrakte?page=1");
});


run("ignores excluded failed click candidates", () => {
  const document = makeDocument(`
    <main>
      <section class="product-grid">
        <button class="load-more">mehr laden</button>
      </section>
    </main>
  `, "https://flowzz.com/extract");
  const first = scoring.analyzeNavigation(document, { location: document.defaultView.location });
  const second = scoring.analyzeNavigation(document, {
    location: document.defaultView.location,
    excludedSelectors: [first.directions.next.best.selector]
  });

  assert.equal(first.directions.next.confidence, "tentative");
  assert.equal(second.directions.next.confidence, "none");
});

run("ignores disabled load more controls", () => {
  const document = makeDocument(`
    <main>
      <section class="product-grid">
        <button class="load-more disabled" aria-disabled="true">mehr laden</button>
      </section>
    </main>
  `, "https://flowzz.com/extract");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.directions.next.confidence, "none");
});

run("does not treat ordinary content links named next as page navigation", () => {
  const document = makeDocument(`
    <main class="article">
      <h1>Long List</h1>
      <p>
        Some pages have content links whose names include directional words.
        <a href="/pmwiki/pmwiki.php/Main/NextSundayAD">Next Sunday A.D.</a>
        <a href="/pmwiki/pmwiki.php/Main/PreviousTropes">Previous Tropes</a>
      </p>
    </main>
  `, "https://tvtropes.org/pmwiki/pmwiki.php/Main/LongList");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "none");
  assert.equal(result.directions.next.confidence, "none");
  assert.equal(result.directions.previous.confidence, "none");
});

run("ignores TV Tropes utility chrome on article pages", () => {
  const document = makeDocument(`
    <header class="top-navbar">
      <a href="/pmwiki/pmwiki.php/Main/Tropes">Tropes</a>
      <a href="/pmwiki/pmwiki.php/Main/LongList?action=source">More Page Source</a>
      <a href="/pmwiki/pmwiki.php/Main/LongList?action=edit">Edit Page</a>
      <a href="/login.php">Login</a>
      <a class="social-facebook" href="https://www.facebook.com/tvtropes" aria-label="Follow TV Tropes on Facebook">f</a>
    </header>
    <main class="article">
      <h1>Long List</h1>
      <p>A comedy trope where a person rattles off an absurdly long list of things.</p>
    </main>
    <aside class="sidebar">
      <a href="/pmwiki/pmwiki.php/Main/Browse">Browse</a>
      <a href="/pmwiki/pmwiki.php/Main/GoAdFree">Go Ad Free!</a>
      <a href="/pmwiki/pmwiki.php/Main/ImportantLinks">More</a>
    </aside>
  `, "https://tvtropes.org/pmwiki/pmwiki.php/Main/LongList");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "none");
  assert.equal(result.directions.next.confidence, "none");
  assert.equal(result.directions.previous.confidence, "none");
});

run("still accepts next links inside navigation regions", () => {
  const document = makeDocument(`
    <main>
      <article>Gallery item</article>
      <nav class="pager">
        <a href="/gallery/page/1/">Previous</a>
        <a href="/gallery/page/3/">Next</a>
      </nav>
    </main>
  `);
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.best.href, "https://example.com/gallery/page/3/");
  assert.equal(result.directions.previous.best.href, "https://example.com/gallery/page/1/");
});
