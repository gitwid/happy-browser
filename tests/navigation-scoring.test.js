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
    const width = Number(this.getAttribute("data-width")) || 96;
    const height = Number(this.getAttribute("data-height")) || 44;
    const left = Number(this.getAttribute("data-left")) || 0;
    const top = Number(this.getAttribute("data-top")) || 0;
    return { width, height, top, left, right: left + width, bottom: top + height };
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
  `, "https://carousel.example.test/item/abc");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.confidence, "tentative");
  assert.equal(result.directions.next.best.type, "click");
  assert.equal(result.directions.next.best.preflight.jsOnly, true);
});

run("prefers media carousel controls over social comment loading", () => {
  const document = makeDocument(`
    <main>
      <article class="post">
        <section class="media-strip">
          <button aria-label="Go back" data-width="46" data-height="62">‹</button>
          <div role="button" class="media-item">
            <img src="/slide-3.jpg" data-width="479" data-height="599" alt="">
          </div>
          <button aria-label="Next" data-width="46" data-height="62">›</button>
        </section>
        <section class="comments">
          <button data-width="240" data-height="40">Load more comments</button>
          <div role="button" data-width="244" data-height="27">View all 1 replies</div>
        </section>
      </article>
    </main>
  `, "https://social.example.test/p/abc/?img_index=3");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.best.type, "click");
  assert.match(result.directions.next.best.text, /Next/);
  assert.match(result.directions.next.best.reason.join(" "), /media-carousel-control/);
  assert.equal(result.directions.previous.best.type, "click");
  assert.match(result.directions.previous.best.text, /Go back/);
});

run("does not treat social comment expansion as primary navigation", () => {
  const document = makeDocument(`
    <main>
      <article class="post">
        <section class="comments">
          <button data-width="240" data-height="40">Load more comments</button>
          <div role="button" data-width="244" data-height="27">View all 1 replies</div>
        </section>
      </article>
    </main>
  `, "https://social.example.test/p/abc/");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "none");
  assert.equal(result.directions.next.confidence, "none");
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
  `, "https://catalog.example.test/listings/?order=inventory&p=2");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.confidence, "strong");
  assert.equal(result.directions.next.best.type, "url");
  assert.equal(result.directions.next.best.href, "https://catalog.example.test/listings/?order=inventory&p=3");
  assert.equal(result.directions.previous.best.href, "https://catalog.example.test/listings/?order=inventory&p=1");
});

run("detects label-based icon pagination", () => {
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
  `, "https://catalog.example.test/listings/?order=inventory");
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
      <h1>Products</h1>
      <section class="product-grid">
        <button class="load-more">mehr laden</button>
      </section>
    </main>
    <footer class="footer partner-banner">
      <a href="https://partner.example.test/" aria-label="Partner">
        <svg class="feather feather-chevron-right"></svg>
      </a>
    </footer>
  `, "https://loadmore.example.test/listings");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "tentative");
  assert.equal(result.directions.next.best.type, "click");
  assert.match(result.directions.next.best.text, /mehr laden/);
  assert.notEqual(result.directions.next.best.href, "https://partner.example.test/");
});

run("promotes exact load more button", () => {
  const document = makeDocument(`
    <main>
      <div class="MuiGrid2-root">
        <button class="MuiButtonBase-root MuiButton-root MuiButton-text" tabindex="0" type="button">mehr laden</button>
      </div>
    </main>
  `, "https://loadmore.example.test/catalog?pagination%5Bpage%5D=1");
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
        <a class="action next" href="/products/filter/in-stock/?p=2" title="Seite Weiter">
          <span>Seite Weiter</span>
        </a>
        <a href="/products/">Alle Produkte</a>
      </nav>
    </main>
  `, "https://pagination.example.test/products/filter/in-stock/");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.best.href, "https://pagination.example.test/products/filter/in-stock/?p=2");
});

run("prefers numbered pagination over blog weiterlesen links", () => {
  const document = makeDocument(`
    <main>
      <section class="products">
        <article>Product list</article>
        <nav class="pagination">
          <span class="current">1</span>
          <a href="/products?page=2">2</a>
          <a href="/products?page=3">3</a>
        </nav>
      </section>
      <section class="ratgeber blog">
        <article>
          <h2>Generic Buying Guide</h2>
          <a href="/blog/generic-buying-guide">weiterlesen</a>
        </article>
      </section>
    </main>
  `, "https://numbers.example.test/products");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.best.href, "https://numbers.example.test/products?page=2");
});

run("advances from numeric page two to page three", () => {
  const document = makeDocument(`
    <main>
      <section class="products">
        <nav class="pagination">
          <a href="/products?page=1">1</a>
          <span class="current">2</span>
          <a href="/products?page=3">3</a>
        </nav>
      </section>
    </main>
  `, "https://numbers.example.test/products?page=2");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "happy");
  assert.equal(result.directions.next.best.href, "https://numbers.example.test/products?page=3");
  assert.equal(result.directions.previous.best.href, "https://numbers.example.test/products?page=1");
});


run("ignores excluded failed click candidates", () => {
  const document = makeDocument(`
    <main>
      <section class="product-grid">
        <button class="load-more">mehr laden</button>
      </section>
    </main>
  `, "https://loadmore.example.test/listings");
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
  `, "https://loadmore.example.test/listings");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.directions.next.confidence, "none");
});

run("does not treat ordinary wiki links named next as page navigation", () => {
  const document = makeDocument(`
    <main class="article">
      <h1>Long List</h1>
      <p>
        Some pages have content links whose names include directional words.
        <a href="/pmwiki/pmwiki.php/Main/NextTopic">Next Topic</a>
        <a href="/pmwiki/pmwiki.php/Main/PreviousTopic">Previous Topic</a>
      </p>
    </main>
  `, "https://wiki.example.test/pmwiki/pmwiki.php/Main/LongList");
  const result = scoring.analyzeNavigation(document, { location: document.defaultView.location });

  assert.equal(result.state, "none");
  assert.equal(result.directions.next.confidence, "none");
  assert.equal(result.directions.previous.confidence, "none");
});

run("ignores wiki utility chrome on article pages", () => {
  const document = makeDocument(`
    <header class="top-navbar">
      <a href="/pmwiki/pmwiki.php/Main/Topics">Topics</a>
      <a href="/pmwiki/pmwiki.php/Main/LongList?action=source">More Page Source</a>
      <a href="/pmwiki/pmwiki.php/Main/LongList?action=edit">Edit Page</a>
      <a href="/login.php">Login</a>
      <a class="social-facebook" href="https://social.example.test/wiki" aria-label="Follow the wiki on social media">f</a>
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
  `, "https://wiki.example.test/pmwiki/pmwiki.php/Main/LongList");
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
