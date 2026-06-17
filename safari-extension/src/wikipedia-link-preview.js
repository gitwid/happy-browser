(function initializeHappyWikipediaLinkPreview(globalScope) {
  const HOVER_DELAY_MS = 180;
  const HIDE_DELAY_MS = 900;
  const COMMIT_PEEK_FADE_MS = 340;
  const COMMIT_TITLE_FADE_MS = 380;
  const COMMIT_TITLE_MORPH_MS = 680;
  const COMMIT_IFRAME_TIMEOUT_MS = 4500;
  const NAV_PULSE_MS = 320;
  const DEFAULT_GLANE_OPACITY = 0.75;
  const MIN_GLANE_OPACITY = 0.08;
  const MAX_GLANE_OPACITY = 0.92;
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const EXCLUDED_PREFIX = /^(File|Help|Wikipedia|Template|Category|Special|Talk|User|Portal|Draft|Module|MediaWiki|TimedText|Book|Education|Draft talk|Gadget|Gadget definition|Media|Topic):/i;

  const state = {
    enabled: true,
    shell: null,
    card: null,
    hoverTimer: null,
    activeLink: null,
    activeRequest: null,
    popupObserver: null,
    popupKiller: null,
    engaged: false,
    exploreMode: false,
    committing: false,
    engageTimer: null,
    glanceOpacity: DEFAULT_GLANE_OPACITY,
    pointer: { x: 0, y: 0 },
    navStack: [],
    currentArticle: null,
    cache: new Map()
  };

  const previewCss = `
    #happy-wiki-preview-host {
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      pointer-events: none;
      transition: background 320ms ease, backdrop-filter 320ms ease;
    }

    #happy-wiki-preview-host[data-explore="true"] {
      pointer-events: auto;
      background: rgba(8, 16, 12, 0.42);
      backdrop-filter: blur(3px);
    }

    .happy-wiki-peek-shell {
      position: fixed;
      z-index: 2147483647;
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px) scale(0.985);
      overflow: visible;
      transition:
        opacity 160ms ease,
        transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
        left 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
        top 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
        width 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
        max-height 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
        height 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .happy-wiki-peek-shell[data-visible="true"] {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    .happy-wiki-peek-shell[data-explore="true"] {
      transform: translateY(0) scale(1);
    }

    .happy-wiki-peek-shell[data-nav-pulse="true"] {
      animation: happy-wiki-peek-nav-pulse 320ms ease;
    }

    @keyframes happy-wiki-peek-nav-pulse {
      0% { transform: scale(1); }
      38% { transform: scale(0.984); }
      100% { transform: scale(1); }
    }

    .happy-wiki-peek-shell[data-title-morph="true"] {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 340ms ease;
    }

    #happy-wiki-preview-host[data-title-morph="true"] {
      background: transparent !important;
      backdrop-filter: none !important;
      transition: background 340ms ease, backdrop-filter 340ms ease;
    }

    #happy-wiki-peek-morph-layer {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      overflow: visible;
    }

    .happy-wiki-chapter-title {
      position: fixed;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      pointer-events: none;
      color: #000;
      white-space: nowrap;
      overflow: visible;
      transform: none;
      will-change: left, top, font-size, opacity;
      font-family: "Linux Libertine", Georgia, "Times New Roman", Times, serif;
      font-size: clamp(1.65rem, 3.6vw, 2.35rem);
      font-weight: 400;
      line-height: 1.18;
      letter-spacing: 0;
      z-index: 2;
      opacity: 0;
    }

    .happy-wiki-peek-commit-frame {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      border: 0;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    }

    .happy-wiki-peek-halo,
    .happy-wiki-peek-ring {
      position: absolute;
      pointer-events: none;
      border-radius: 14px;
    }

    .happy-wiki-peek-halo {
      inset: -22px;
      z-index: 0;
      border-radius: 24px;
      background:
        radial-gradient(ellipse at 50% 0%, rgba(255, 228, 150, 0.42), transparent 58%),
        radial-gradient(ellipse at 50% 100%, rgba(112, 243, 178, 0.34), transparent 62%),
        radial-gradient(ellipse at 50% 50%, rgba(42, 125, 79, 0.28), transparent 72%);
      opacity: 0.72;
      animation: happy-wiki-glow-breathe 3.6s ease-in-out infinite;
    }

    .happy-wiki-peek-shell[data-engaged="true"] .happy-wiki-peek-halo {
      opacity: 1;
      animation-name: happy-wiki-glow-breathe-strong;
    }

    .happy-wiki-peek-ring {
      inset: -3px;
      z-index: 1;
      border: 2px solid rgba(255, 236, 168, 0.92);
      box-shadow:
        0 0 0 1px rgba(112, 243, 178, 0.72),
        0 0 16px rgba(112, 243, 178, 0.62),
        0 0 32px rgba(255, 214, 120, 0.38),
        0 0 48px rgba(112, 243, 178, 0.28),
        inset 0 0 14px rgba(255, 236, 168, 0.22);
      animation: happy-wiki-ring-pulse 3.8s ease-in-out infinite;
    }

    .happy-wiki-peek-shell[data-engaged="true"] .happy-wiki-peek-ring {
      border-color: rgba(255, 244, 196, 0.98);
      box-shadow:
        0 0 0 1px rgba(112, 243, 178, 0.92),
        0 0 22px rgba(112, 243, 178, 0.82),
        0 0 40px rgba(255, 214, 120, 0.48),
        0 0 64px rgba(112, 243, 178, 0.34),
        inset 0 0 18px rgba(255, 236, 168, 0.34);
    }

    @keyframes happy-wiki-glow-breathe {
      0%, 100% { opacity: 0.58; transform: scale(0.992); }
      50% { opacity: 0.88; transform: scale(1.018); }
    }

    @keyframes happy-wiki-glow-breathe-strong {
      0%, 100% { opacity: 0.82; transform: scale(0.996); }
      50% { opacity: 1; transform: scale(1.024); }
    }

    @keyframes happy-wiki-ring-pulse {
      0%, 100% {
        box-shadow:
          0 0 0 1px rgba(112, 243, 178, 0.62),
          0 0 14px rgba(112, 243, 178, 0.52),
          0 0 28px rgba(255, 214, 120, 0.32),
          0 0 42px rgba(112, 243, 178, 0.22),
          inset 0 0 12px rgba(255, 236, 168, 0.18);
      }
      50% {
        box-shadow:
          0 0 0 1px rgba(112, 243, 178, 0.88),
          0 0 22px rgba(112, 243, 178, 0.78),
          0 0 38px rgba(255, 214, 120, 0.46),
          0 0 58px rgba(112, 243, 178, 0.32),
          inset 0 0 18px rgba(255, 236, 168, 0.3);
      }
    }

    .happy-wiki-peek {
      position: relative;
      z-index: 2;
      width: 100%;
      height: 100%;
      max-height: inherit;
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(112, 243, 178, 0.34);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.58);
      color: #202122;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
      opacity: 1;
      overflow: hidden;
      backdrop-filter: blur(10px);
      transition:
        background 160ms ease,
        border-color 160ms ease,
        backdrop-filter 160ms ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Liberation Sans", sans-serif;
    }

    .happy-wiki-peek-shell[data-visible="true"] .happy-wiki-peek {
      opacity: var(--happy-wiki-glance-opacity, 0.75);
    }

    .happy-wiki-peek-shell[data-visible="true"][data-engaged="true"] .happy-wiki-peek {
      opacity: 1;
      background: #fff;
      border-color: rgba(112, 243, 178, 0.72);
      backdrop-filter: blur(0);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95);
    }

    .happy-wiki-peek__chrome {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 14px 8px;
      border-bottom: 1px solid #eaecf0;
      background: linear-gradient(#fff, #f8f9fa);
    }

    .happy-wiki-peek__back {
      flex: 0 0 auto;
      width: 30px;
      height: 30px;
      border: 1px solid #c8ccd1;
      border-radius: 6px;
      background: #fff;
      color: #202122;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
    }

    .happy-wiki-peek__back:hover {
      background: #f8f9fa;
      border-color: #2a7d4f;
    }

    .happy-wiki-peek__title-wrap {
      flex: 1 1 auto;
      min-width: 0;
    }

    .happy-wiki-peek__title {
      margin: 0;
      font-family: "Linux Libertine", Georgia, "Times New Roman", Times, serif;
      font-size: 1.35rem;
      font-weight: 400;
      line-height: 1.2;
      letter-spacing: 0;
      color: #000;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .happy-wiki-peek__title-button {
      display: block;
      width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }

    .happy-wiki-peek__title-button:hover .happy-wiki-peek__title {
      color: #1f5f3f;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .happy-wiki-peek__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .happy-wiki-peek__open {
      padding: 5px 10px;
      border: 1px solid #2a7d4f;
      border-radius: 6px;
      background: #eaf7ef;
      color: #1f5f3f;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      white-space: nowrap;
    }

    .happy-wiki-peek__open:hover {
      background: #d8f0e2;
    }

    .happy-wiki-peek-shell:not([data-explore="true"]) .happy-wiki-peek__open,
    .happy-wiki-peek-shell:not([data-explore="true"]) .happy-wiki-peek__back {
      display: none;
    }

    .happy-wiki-peek__badge {
      flex: 0 0 auto;
      padding: 3px 8px;
      border: 1px solid #2a7d4f;
      border-radius: 2px;
      background: #eaf7ef;
      color: #1f5f3f;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .happy-wiki-peek__scroll {
      flex: 1 1 auto;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 12px 16px 16px;
      background: #fff;
    }

    .happy-wiki-peek__loading {
      padding: 28px 16px;
      color: #54595d;
      font-size: 13px;
      line-height: 1.5;
    }

    .happy-wiki-peek__footer {
      padding: 8px 14px 10px;
      border-top: 1px solid #eaecf0;
      background: #f8f9fa;
      color: #54595d;
      font-size: 11px;
      line-height: 1.35;
    }

    .happy-wiki-peek .mw-parser-output {
      font-size: 0.875rem;
      line-height: 1.65;
      color: #202122;
      overflow-wrap: anywhere;
    }

    .happy-wiki-peek .mw-parser-output::after {
      content: "";
      display: block;
      clear: both;
    }

    .happy-wiki-peek .mw-parser-output p {
      margin: 0.55em 0;
    }

    .happy-wiki-peek .mw-parser-output a {
      color: #3366cc;
      text-decoration: none;
    }

    .happy-wiki-peek .mw-parser-output a:hover {
      text-decoration: underline;
    }

    .happy-wiki-peek .mw-parser-output .infobox,
    .happy-wiki-peek .mw-parser-output .sidebar,
    .happy-wiki-peek .mw-parser-output .vertical-navbox,
    .happy-wiki-peek .mw-parser-output .thumb.tright,
    .happy-wiki-peek .mw-parser-output .thumb.tleft {
      max-width: 46%;
    }

    @media (min-width: 420px) {
      .happy-wiki-peek .mw-parser-output .infobox {
        float: right;
        clear: right;
        width: 18em;
        margin: 0 0 0.8em 1em;
        border: 1px solid #a2a9b1;
        background: #f8f9fa;
        font-size: 88%;
      }
    }

    .happy-wiki-peek .mw-parser-output .infobox td,
    .happy-wiki-peek .mw-parser-output .infobox th {
      padding: 0.25em 0.45em;
      vertical-align: top;
    }

    .happy-wiki-peek .mw-parser-output .infobox-title {
      font-size: 115%;
      font-weight: 700;
      text-align: center;
      padding: 0.35em;
    }

    .happy-wiki-peek .mw-parser-output .thumb {
      margin: 0.6em 0 0.8em;
      border: 1px solid #c8ccd1;
      background: #f8f9fa;
      padding: 3px;
      transition: transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 420ms ease;
    }

    .happy-wiki-peek .mw-parser-output .thumb.tright {
      float: right;
      clear: right;
      margin-left: 1em;
    }

    .happy-wiki-peek .mw-parser-output .thumb.tleft {
      float: left;
      clear: left;
      margin-right: 1em;
    }

    .happy-wiki-peek[data-visible="true"] .mw-parser-output .thumb {
      animation: happy-wiki-thumb-float 5.2s ease-in-out infinite;
    }

    @keyframes happy-wiki-thumb-float {
      0%, 100% { transform: translateY(0); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04); }
      50% { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08); }
    }

    .happy-wiki-peek .mw-parser-output img {
      display: block;
      max-width: 100%;
      height: auto;
    }

    .happy-wiki-peek .mw-parser-output .thumbcaption,
    .happy-wiki-peek .mw-parser-output figcaption {
      padding: 4px 6px 6px;
      font-size: 0.82rem;
      line-height: 1.35;
      color: #202122;
    }

    .happy-wiki-peek .mw-parser-output .shortdescription,
    .happy-wiki-peek .mw-parser-output .mw-empty-elt,
    .happy-wiki-peek .mw-parser-output .metadata,
    .happy-wiki-peek .mw-parser-output .infobox,
    .happy-wiki-peek .mw-parser-output .sidebar {
      max-height: min(42vh, 360px);
      overflow: auto;
    }

    .happy-wiki-peek .mw-parser-output .navbox,
    .happy-wiki-peek .mw-parser-output .reference,
    .happy-wiki-peek .mw-parser-output .mw-references-wrap,
    .happy-wiki-peek .mw-parser-output style {
      display: none !important;
    }

    .happy-wiki-peek .mw-parser-output h2,
    .happy-wiki-peek .mw-parser-output h3 {
      display: none;
    }
  `;

  function isWikipediaArticleHost(hostname) {
    return /\.wikipedia\.org$/i.test(String(hostname || ""));
  }

  function parseWikiArticleLink(href, pageHostname) {
    if (!href) {
      return null;
    }

    let url;
    try {
      url = new URL(href, `https://${pageHostname || "en.wikipedia.org"}`);
    } catch (error) {
      return null;
    }

    if (!isWikipediaArticleHost(url.hostname)) {
      return null;
    }

    const match = url.pathname.match(/^\/wiki\/([^#?]+)/);
    if (!match) {
      return null;
    }

    const title = decodeURIComponent(match[1].replace(/_/g, " "));
    if (!title || EXCLUDED_PREFIX.test(title)) {
      return null;
    }

    const lang = url.hostname.split(".")[0] || "en";
    return {
      lang,
      title,
      href: url.href.split("#")[0]
    };
  }

  function cacheKey(lang, title) {
    return `${lang}:${title.toLowerCase()}`;
  }

  function readCache(lang, title) {
    const entry = state.cache.get(cacheKey(lang, title));
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
      state.cache.delete(cacheKey(lang, title));
      return null;
    }

    return entry.value;
  }

  function writeCache(lang, title, value) {
    state.cache.set(cacheKey(lang, title), {
      storedAt: Date.now(),
      value
    });
  }

  function buildParseUrl(lang, title) {
    const params = new URLSearchParams({
      action: "parse",
      page: title.replace(/ /g, "_"),
      prop: "text|displaytitle",
      section: "0",
      format: "json"
    });
    return `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
  }

  function stripHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    return template.content.textContent.replace(/\s+/g, " ").trim();
  }

  function normalizePreviewHtml(html, lang) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(html || "");

    wrapper.querySelectorAll("script, link, meta").forEach((node) => node.remove());

    wrapper.querySelectorAll(".nomobile.noexcerpt, .noprint.searchaux, .shortdescription").forEach((node) => {
      node.remove();
    });

    wrapper.querySelectorAll("a[href]").forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (href.startsWith("./") || href.startsWith("/wiki/")) {
        anchor.setAttribute("href", `https://${lang}.wikipedia.org/wiki/${href.replace(/^\.\/|\/wiki\//, "")}`);
      } else if (href.startsWith("//")) {
        anchor.setAttribute("href", `https:${href}`);
      }

      anchor.setAttribute("tabindex", "-1");
    });

    wrapper.querySelectorAll("img[src]").forEach((image) => {
      const src = image.getAttribute("src") || "";
      if (src.startsWith("//")) {
        image.setAttribute("src", `https:${src}`);
      }
    });

    wrapper.querySelectorAll("img[srcset]").forEach((image) => {
      const srcset = image.getAttribute("srcset") || "";
      image.setAttribute(
        "srcset",
        srcset
          .split(",")
          .map((entry) => entry.trim().replace(/^\/\//, "https://"))
          .join(", ")
      );
    });

    return wrapper.innerHTML;
  }

  async function fetchArticlePeek(lang, title, signal) {
    const cached = readCache(lang, title);
    if (cached) {
      return cached;
    }

    const response = await fetch(buildParseUrl(lang, title), {
      signal
    });

    if (!response.ok) {
      throw new Error(`parse ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.parse || !payload.parse.text) {
      throw new Error("parse empty");
    }

    const peek = {
      title: stripHtml(payload.parse.displaytitle || payload.parse.title || title),
      html: normalizePreviewHtml(payload.parse.text["*"], lang),
      href: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
    };

    writeCache(lang, title, peek);
    return peek;
  }

  function ensureHost() {
    if (state.host && state.host.isConnected && state.card) {
      return;
    }

    if (!document.getElementById("happy-wiki-preview-styles")) {
      const style = document.createElement("style");
      style.id = "happy-wiki-preview-styles";
      style.textContent = previewCss;
      document.documentElement.appendChild(style);
    }

    const host = document.createElement("div");
    host.id = "happy-wiki-preview-host";

    const shell = document.createElement("div");
    shell.className = "happy-wiki-peek-shell";
    shell.dataset.visible = "false";
    shell.dataset.engaged = "false";
    shell.dataset.loading = "false";

    const halo = document.createElement("div");
    halo.className = "happy-wiki-peek-halo";
    halo.setAttribute("aria-hidden", "true");

    const ring = document.createElement("div");
    ring.className = "happy-wiki-peek-ring";
    ring.setAttribute("aria-hidden", "true");

    const card = document.createElement("article");
    card.className = "happy-wiki-peek";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML = [
      '<header class="happy-wiki-peek__chrome">',
      '  <button type="button" class="happy-wiki-peek__back" aria-label="Back in peek" hidden>←</button>',
      '  <div class="happy-wiki-peek__title-wrap">',
      '    <button type="button" class="happy-wiki-peek__title-button">',
      '      <h1 class="happy-wiki-peek__title"></h1>',
      "    </button>",
      "  </div>",
      '  <div class="happy-wiki-peek__actions">',
      '    <button type="button" class="happy-wiki-peek__open">Open article</button>',
      '    <span class="happy-wiki-peek__badge">Happy peek</span>',
      "  </div>",
      "</header>",
      '<div class="happy-wiki-peek__scroll">',
      '  <div class="happy-wiki-peek__loading">Loading article…</div>',
      '  <div class="mw-parser-output happy-wiki-peek__content" hidden></div>',
      "</div>",
      '<footer class="happy-wiki-peek__footer">Glance · click peek to explore · links dig deeper · Open article when ready.</footer>'
    ].join("");

    card.querySelector(".happy-wiki-peek__back").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      peekBack();
    });

    card.querySelector(".happy-wiki-peek__open").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void commitToPage();
    });

    card.querySelector(".happy-wiki-peek__title-button").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.exploreMode) {
        void commitToPage();
        return;
      }
      enterExploreMode();
    });

    card.addEventListener("click", (event) => {
      if (state.committing || !isPreviewVisible()) {
        return;
      }

      if (event.target.closest("a[href], button, .happy-wiki-peek__title-button")) {
        return;
      }

      if (!state.exploreMode) {
        event.preventDefault();
        enterExploreMode();
      }
    });

    card.addEventListener("mouseenter", () => {
      setEngaged(true);
      clearHideTimer();
    });
    card.addEventListener("mouseleave", onPreviewMouseLeave);

    host.addEventListener("click", (event) => {
      if (!state.exploreMode || state.committing) {
        return;
      }

      if (event.target === host) {
        exitExploreMode();
      }
    });

    host.appendChild(shell);
    shell.append(halo, ring, card);
    document.documentElement.appendChild(host);
    state.host = host;
    state.shell = shell;
    state.card = card;
  }

  function setShellState(next) {
    if (!state.shell) {
      return;
    }

    if (next.visible !== undefined) {
      state.shell.dataset.visible = String(next.visible);
    }
    if (next.engaged !== undefined) {
      state.shell.dataset.engaged = String(next.engaged);
    }
    if (next.loading !== undefined) {
      state.shell.dataset.loading = String(next.loading);
    }
    if (next.explore !== undefined) {
      state.shell.dataset.explore = String(next.explore);
      if (state.host) {
        state.host.dataset.explore = String(next.explore);
      }
    }
    if (next.commit !== undefined) {
      state.shell.dataset.commit = String(next.commit);
      if (state.host) {
        state.host.dataset.commit = String(next.commit);
      }
    }
  }

  function waitMs(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function updateFooterHint() {
    if (!state.card) {
      return;
    }

    const footer = state.card.querySelector(".happy-wiki-peek__footer");
    if (!footer) {
      return;
    }

    if (state.exploreMode) {
      footer.textContent = "Follow links to dig deeper · Open article or click title to continue on Wikipedia.";
      return;
    }

    footer.textContent = "Glance · click peek to explore · links dig deeper · Open article when ready.";
  }

  function updateChromeActions() {
    if (!state.card) {
      return;
    }

    const backButton = state.card.querySelector(".happy-wiki-peek__back");
    if (backButton) {
      backButton.hidden = state.navStack.length === 0;
    }
  }

  function layoutShell() {
    if (!state.shell) {
      return;
    }

    if (state.exploreMode || state.committing) {
      centerExploreShell();
      return;
    }

    if (state.activeLink) {
      positionCard(state.activeLink);
    }
  }

  function centerExploreShell() {
    if (!state.shell) {
      return;
    }

    const width = Math.min(Math.round(window.innerWidth * 0.88), 980);
    const height = Math.min(Math.round(window.innerHeight * 0.86), window.innerHeight - 32);
    const left = Math.max(12, Math.round((window.innerWidth - width) / 2));
    const top = Math.max(12, Math.round((window.innerHeight - height) / 2));

    state.shell.style.left = `${left}px`;
    state.shell.style.top = `${top}px`;
    state.shell.style.width = `${width}px`;
    state.shell.style.height = `${height}px`;
    state.shell.style.maxHeight = `${height}px`;
  }

  function enterExploreMode() {
    if (state.exploreMode || state.committing || !isPreviewVisible()) {
      return;
    }

    state.exploreMode = true;
    markPinned();
    setEngaged(true);
    clearHideTimer();
    setShellState({ explore: true, engaged: true });
    layoutShell();
    updateFooterHint();
    updateChromeActions();
  }

  function exitExploreMode() {
    if (!state.exploreMode || state.committing) {
      return;
    }

    state.exploreMode = false;
    setShellState({ explore: false, commit: false });
    if (state.host) {
      state.host.dataset.commit = "false";
    }
    setEngaged(true);
    layoutShell();
    updateFooterHint();
    updateChromeActions();
  }

  function resetExploreState() {
    state.exploreMode = false;
    state.committing = false;
    state.navStack = [];
    state.currentArticle = null;
    setShellState({ explore: false, commit: false, navPulse: false });
    if (state.host) {
      state.host.dataset.explore = "false";
      state.host.dataset.commit = "false";
    }
    if (state.shell) {
      delete state.shell.dataset.navPulse;
      state.shell.style.height = "";
    }
    updateFooterHint();
    updateChromeActions();
  }

  function pulseNavAnimation() {
    if (!state.shell) {
      return;
    }

    state.shell.dataset.navPulse = "true";
    window.setTimeout(() => {
      if (state.shell) {
        delete state.shell.dataset.navPulse;
      }
    }, NAV_PULSE_MS);
  }

  function attachPeekLinkHandlers(content, lang) {
    content.querySelectorAll("a[href]").forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (state.committing) {
          return;
        }

        const linkMeta = parseWikiArticleLink(anchor.getAttribute("href"), `${lang}.wikipedia.org`);
        if (!linkMeta) {
          return;
        }

        if (!state.exploreMode) {
          enterExploreMode();
        }

        void navigatePeekTo(linkMeta);
      });
    });
  }

  async function navigatePeekTo(linkMeta) {
    if (!state.enabled || state.committing || !state.card) {
      return;
    }

    if (
      state.currentArticle
      && state.currentArticle.lang === linkMeta.lang
      && state.currentArticle.title.toLowerCase() === linkMeta.title.toLowerCase()
    ) {
      return;
    }

    if (state.currentArticle) {
      state.navStack.push({ ...state.currentArticle });
    }

    pulseNavAnimation();
    updateChromeActions();
    renderLoading(linkMeta, { keepExplore: true });

    if (state.activeRequest) {
      state.activeRequest.abort();
    }

    const controller = new AbortController();
    state.activeRequest = controller;

    try {
      const peek = await fetchArticlePeek(linkMeta.lang, linkMeta.title, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      renderPeek(peek, linkMeta);
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }

      if (state.card) {
        state.card.querySelector(".happy-wiki-peek__loading").hidden = false;
        state.card.querySelector(".happy-wiki-peek__loading").textContent = "Could not load article preview.";
        state.card.querySelector(".happy-wiki-peek__content").hidden = true;
        state.card.dataset.loading = "false";
      }
    } finally {
      if (state.activeRequest === controller) {
        state.activeRequest = null;
      }
    }
  }

  function peekBack() {
    if (state.navStack.length === 0 || state.committing) {
      return;
    }

    const previous = state.navStack.pop();
    updateChromeActions();
    pulseNavAnimation();
    renderPeek(
      {
        title: previous.title,
        html: previous.html,
        href: previous.href
      },
      {
        lang: previous.lang,
        title: previous.rawTitle || previous.title,
        href: previous.href
      },
      { fromStack: true }
    );
  }

  async function commitToPage() {
    if (state.committing || !state.currentArticle || !state.shell) {
      return;
    }

    state.committing = true;
    markPinned();
    setEngaged(true);

    const href = state.currentArticle.href;
    const titleText = state.currentArticle.title;
    const targetFramePromise = loadCommitTargetDocument(href);

    const morphLayer = document.createElement("div");
    morphLayer.id = "happy-wiki-peek-morph-layer";
    document.documentElement.appendChild(morphLayer);

    const chapterTitle = createFloatingChapterTitle(titleText);
    if (!chapterTitle) {
      window.location.assign(href);
      return;
    }

    morphLayer.appendChild(chapterTitle);
    positionChapterTitleEntry(chapterTitle);

    if (state.shell) {
      state.shell.dataset.titleMorph = "true";
    }
    if (state.host) {
      state.host.dataset.titleMorph = "true";
    }

    await Promise.all([
      waitMs(COMMIT_PEEK_FADE_MS),
      fadeInChapterTitle(chapterTitle, COMMIT_TITLE_FADE_MS)
    ]);

    let targetFrame = null;
    try {
      targetFrame = await Promise.race([
        targetFramePromise,
        waitMs(COMMIT_IFRAME_TIMEOUT_MS).then(() => null)
      ]);
    } catch (error) {
      targetFrame = null;
    }

    const targetTitle = targetFrame ? findCommitTitleTarget(targetFrame.doc) : null;

    if (targetTitle) {
      const targetRect = targetTitle.getBoundingClientRect();
      const targetStyles = targetFrame.doc.defaultView.getComputedStyle(targetTitle);

      if (targetRect.width >= 4 && targetRect.height >= 4) {
        await animateTitleToTarget(
          chapterTitle,
          targetRect,
          targetStyles,
          COMMIT_TITLE_MORPH_MS
        );
      }
    }

    morphLayer.remove();
    cleanupCommitArtifacts(targetFrame);
    window.location.assign(href);
  }

  function waitForNextFrames(count) {
    return new Promise((resolve) => {
      let remaining = count;
      const step = () => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function loadCommitTargetDocument(href) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.className = "happy-wiki-peek-commit-frame";
      iframe.src = href;
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("tabindex", "-1");
      document.documentElement.appendChild(iframe);

      const finish = (handler) => {
        iframe.removeEventListener("load", onLoad);
        iframe.removeEventListener("error", onError);
        handler();
      };

      const onLoad = () => {
        try {
          const doc = iframe.contentDocument;
          if (!doc || !doc.body) {
            finish(() => reject(new Error("commit iframe empty")));
            return;
          }

          waitForNextFrames(2).then(() => {
            finish(() => resolve({ iframe, doc }));
          });
        } catch (error) {
          finish(() => reject(error));
        }
      };

      const onError = () => {
        finish(() => reject(new Error("commit iframe failed")));
      };

      iframe.addEventListener("load", onLoad, { once: true });
      iframe.addEventListener("error", onError, { once: true });
    });
  }

  function cleanupCommitArtifacts(targetFrame) {
    targetFrame?.iframe?.remove();
  }

  function findCommitTitleTarget(targetDoc) {
    if (!targetDoc) {
      return null;
    }

    return targetDoc.querySelector("#firstHeading")
      || targetDoc.querySelector(".mw-page-title-main")
      || targetDoc.querySelector("h1.firstHeading");
  }

  function createFloatingChapterTitle(titleText) {
    const text = String(titleText || "").trim();
    if (!text) {
      return null;
    }

    const el = document.createElement("div");
    el.className = "happy-wiki-chapter-title";
    el.textContent = text;
    return el;
  }

  function positionChapterTitleEntry(titleEl) {
    titleEl.style.visibility = "hidden";
    titleEl.style.opacity = "1";

    const width = titleEl.offsetWidth;
    const left = Math.max(16, Math.round((window.innerWidth - width) / 2));
    const top = Math.round(window.innerHeight * 0.34);

    titleEl.style.left = `${left}px`;
    titleEl.style.top = `${top}px`;
    titleEl.style.visibility = "";
    titleEl.style.opacity = "0";
  }

  function fadeInChapterTitle(titleEl, duration) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        titleEl.style.transition = `opacity ${duration}ms ease`;
        titleEl.style.opacity = "1";
        window.setTimeout(resolve, duration);
      });
    });
  }

  function animateTitleToTarget(titleEl, toRect, targetStyles, duration) {
    const waftCurve = "cubic-bezier(0.22, 1.08, 0.36, 1)";
    const toFontSize = parseFloat(targetStyles.fontSize)
      || parseFloat(getComputedStyle(titleEl).fontSize)
      || 28;

    titleEl.style.transition = "none";

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        titleEl.style.transition = [
          `left ${duration}ms ${waftCurve}`,
          `top ${duration}ms ${waftCurve}`,
          `font-size ${duration}ms ${waftCurve}`
        ].join(", ");
        titleEl.style.left = `${toRect.left}px`;
        titleEl.style.top = `${toRect.top}px`;
        titleEl.style.fontSize = `${toFontSize}px`;
        window.setTimeout(resolve, duration);
      });
    });
  }

  let hideTimer = null;
  let wheelDismissTimer = null;

  function clearHideTimer() {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  function holdPreviewOpen() {
    clearHideTimer();
  }

  function isPointerOnActiveLink(x, y) {
    if (!state.activeLink || !state.activeLink.isConnected) {
      return false;
    }

    const rect = state.activeLink.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return false;
    }

    const pad = 4;
    return x >= rect.left - pad
      && x <= rect.right + pad
      && y >= rect.top - pad
      && y <= rect.bottom + pad;
  }

  function shouldKeepPreviewOpen(x, y) {
    if (!isPreviewVisible() || state.exploreMode || state.committing) {
      return true;
    }

    const hovered = document.elementFromPoint(x, y);
    if (hovered && isInsidePreview(hovered)) {
      return true;
    }

    if (isPointerOnActiveLink(x, y)) {
      return true;
    }

    if (isPointerInHoverCorridor(x, y)) {
      return true;
    }

    return false;
  }

  function updateDismissFromPointer(x, y) {
    if (!isPreviewVisible() || state.exploreMode || state.committing) {
      return;
    }

    if (shouldKeepPreviewOpen(x, y)) {
      holdPreviewOpen();

      const hovered = document.elementFromPoint(x, y);
      if (hovered && isInsidePreview(hovered)) {
        setEngaged(true);
      } else if (isPointerInHoverCorridor(x, y)) {
        setEngaged(false);
      }
      return;
    }

    setEngaged(false);
    scheduleHide();
  }

  function scheduleHide() {
    if (state.exploreMode || state.committing) {
      return;
    }

    clearHideTimer();
    hideTimer = setTimeout(hidePreview, HIDE_DELAY_MS);
  }

  function onPreviewMouseLeave(event) {
    if (state.exploreMode || state.committing) {
      return;
    }

    const related = event.relatedTarget;
    if (related && state.activeLink && state.activeLink.contains(related)) {
      return;
    }

    const x = Number.isFinite(event.clientX) ? event.clientX : state.pointer.x;
    const y = Number.isFinite(event.clientY) ? event.clientY : state.pointer.y;
    updateDismissFromPointer(x, y);
  }

  function hidePreview() {
    clearTimeout(state.hoverTimer);
    clearTimeout(wheelDismissTimer);
    wheelDismissTimer = null;
    state.hoverTimer = null;
    state.activeLink = null;
    setEngaged(false);
    resetExploreState();

    if (state.activeRequest) {
      state.activeRequest.abort();
      state.activeRequest = null;
    }

    if (!state.shell || !state.card) {
      return;
    }

    state.card.dataset.loading = "false";
    state.card.setAttribute("aria-hidden", "true");
    setShellState({ visible: false, engaged: false, loading: false, explore: false, commit: false });
    stopPopupKiller();
  }

  function isInsidePreview(node) {
    return Boolean(node && state.shell && (state.shell === node || state.shell.contains(node)));
  }

  function isPreviewVisible() {
    return Boolean(state.shell && state.shell.dataset.visible === "true");
  }

  function getPreviewScroller() {
    return state.card ? state.card.querySelector(".happy-wiki-peek__scroll") : null;
  }

  function getPreviewRect() {
    return state.shell ? state.shell.getBoundingClientRect() : null;
  }

  function getActiveLinkRect() {
    if (!state.activeLink || !state.activeLink.isConnected) {
      return null;
    }

    return state.activeLink.getBoundingClientRect();
  }

  function isPointerInHoverCorridor(x, y) {
    const cardRect = getPreviewRect();
    const linkRect = getActiveLinkRect();
    if (!cardRect || !linkRect) {
      return false;
    }

    const pad = 28;
    const left = Math.min(linkRect.left, cardRect.left) - pad;
    const right = Math.max(linkRect.right, cardRect.right) + pad;
    const top = Math.min(linkRect.top, cardRect.top) - pad;
    const bottom = Math.max(linkRect.bottom, cardRect.bottom) + pad;

    return x >= left && x <= right && y >= top && y <= bottom;
  }

  function markPinned() {
    holdPreviewOpen();
  }

  function setEngaged(engaged) {
    state.engaged = Boolean(engaged);
    setShellState({ engaged: state.engaged });
    clearTimeout(state.engageTimer);

    if (state.engaged) {
      return;
    }

    state.engageTimer = window.setTimeout(() => {
      if (state.shell && !state.engaged) {
        setShellState({ engaged: false });
      }
    }, 0);
  }

  function engageBriefly() {
    setEngaged(true);
    clearTimeout(state.engageTimer);
    state.engageTimer = window.setTimeout(() => {
      if (state.card && !isInsidePreview(document.elementFromPoint(state.pointer.x, state.pointer.y))) {
        setEngaged(false);
      }
    }, 1600);
  }

  function positionCard(anchor) {
    if (!state.shell) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const cardWidth = Math.min(520, window.innerWidth - 28);
    const cardHeight = Math.min(window.innerHeight * 0.78, 720);
    const margin = 14;
    const gap = 6;

    let left = rect.right + gap;
    if (left + cardWidth > window.innerWidth - margin) {
      left = Math.max(margin, rect.left - cardWidth - gap);
    }

    let top = Math.max(margin, rect.top - 8);
    top = Math.min(top, window.innerHeight - cardHeight - margin);

    state.shell.style.left = `${left}px`;
    state.shell.style.top = `${top}px`;
    state.shell.style.width = `${cardWidth}px`;
    state.shell.style.maxHeight = `${cardHeight}px`;
  }

  function renderLoading(linkMeta, options = {}) {
    ensureHost();
    const title = state.card.querySelector(".happy-wiki-peek__title");
    const loading = state.card.querySelector(".happy-wiki-peek__loading");
    const content = state.card.querySelector(".happy-wiki-peek__content");

    title.textContent = linkMeta.title;
    loading.hidden = false;
    loading.textContent = "Loading article…";
    content.hidden = true;
    content.innerHTML = "";
    state.card.dataset.loading = "true";
    setShellState({ visible: true, engaged: state.exploreMode || options.keepExplore, loading: true });
    state.card.setAttribute("aria-hidden", "false");

    if (options.keepExplore || state.exploreMode) {
      setEngaged(true);
    } else {
      setEngaged(false);
    }

    markPinned();
    startPopupKiller();
    layoutShell();
    updateFooterHint();
    updateChromeActions();
  }

  function renderPeek(peek, linkMeta, options = {}) {
    ensureHost();
    const title = state.card.querySelector(".happy-wiki-peek__title");
    const loading = state.card.querySelector(".happy-wiki-peek__loading");
    const content = state.card.querySelector(".happy-wiki-peek__content");
    const lang = linkMeta?.lang || state.currentArticle?.lang || "en";

    title.textContent = peek.title;
    loading.hidden = true;
    content.hidden = false;
    content.innerHTML = peek.html;
    attachPeekLinkHandlers(content, lang);

    state.currentArticle = {
      lang,
      rawTitle: linkMeta?.title || peek.title,
      title: peek.title,
      html: peek.html,
      href: peek.href || linkMeta?.href
    };

    if (!options.fromStack && state.navStack.length === 0 && !state.exploreMode) {
      state.navStack = [];
    }

    state.card.dataset.loading = "false";
    setShellState({
      visible: true,
      engaged: state.exploreMode,
      loading: false,
      explore: state.exploreMode
    });
    state.card.setAttribute("aria-hidden", "false");

    if (state.exploreMode) {
      setEngaged(true);
    } else {
      setEngaged(false);
    }

    markPinned();
    startPopupKiller();
    layoutShell();
    updateFooterHint();
    updateChromeActions();

    const scroller = getPreviewScroller();
    if (scroller) {
      scroller.scrollTop = 0;
    }
  }

  function isPreviewableLink(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const anchor = element.closest("a[href]");
    if (!anchor || !anchor.href || anchor.closest("#happy-browser-shadow-host, #happy-wiki-preview-host")) {
      return null;
    }

    const inContent = anchor.closest(
      "#mw-content-text, #bodyContent, .mw-body-content, .mw-parser-output, .vector-body, main, article"
    );
    if (!inContent) {
      return null;
    }

    if (anchor.classList.contains("external") || anchor.classList.contains("extiw")) {
      return null;
    }

    return parseWikiArticleLink(anchor.getAttribute("href"), window.location.hostname) ? anchor : null;
  }

  function schedulePreview(anchor) {
    clearTimeout(state.hoverTimer);
    state.hoverTimer = setTimeout(() => {
      if (!anchor.isConnected) {
        return;
      }

      const { x, y } = state.pointer;
      if (!isPointerOnActiveLink(x, y)) {
        return;
      }

      void showPreviewForLink(anchor);
    }, HOVER_DELAY_MS);
  }

  function isSameArticle(linkMeta) {
    const current = parseWikiArticleLink(window.location.pathname, window.location.hostname);
    return Boolean(
      current
      && current.lang === linkMeta.lang
      && current.title.toLowerCase() === linkMeta.title.toLowerCase()
    );
  }

  async function showPreviewForLink(anchor) {
    const linkMeta = parseWikiArticleLink(anchor.getAttribute("href"), window.location.hostname);
    if (!linkMeta || !state.enabled || isSameArticle(linkMeta)) {
      return;
    }

    if (state.exploreMode) {
      return;
    }

    if (state.activeLink && state.activeLink !== anchor) {
      resetExploreState();
    }

    state.activeLink = anchor;
    renderLoading(linkMeta);

    if (state.activeRequest) {
      state.activeRequest.abort();
    }

    const controller = new AbortController();
    state.activeRequest = controller;

    try {
      const peek = await fetchArticlePeek(linkMeta.lang, linkMeta.title, controller.signal);
      if (state.activeLink !== anchor) {
        return;
      }
      renderPeek(peek, linkMeta);
      updateDismissFromPointer(state.pointer.x, state.pointer.y);
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      if (state.activeLink === anchor && state.card) {
        state.card.querySelector(".happy-wiki-peek__loading").hidden = false;
        state.card.querySelector(".happy-wiki-peek__loading").textContent = "Could not load article preview.";
        state.card.querySelector(".happy-wiki-peek__content").hidden = true;
        state.card.dataset.loading = "false";
      }
    } finally {
      if (state.activeRequest === controller) {
        state.activeRequest = null;
      }
    }
  }

  function isMouseLikeEvent(event) {
    return !event.pointerType || event.pointerType === "mouse";
  }

  function onLinkHoverStart(event) {
    if (!state.enabled || !isMouseLikeEvent(event) || state.exploreMode) {
      return;
    }

    const anchor = isPreviewableLink(event.target);
    if (!anchor) {
      return;
    }

    if (state.activeLink === anchor && isPreviewVisible()) {
      clearHideTimer();
      setEngaged(false);
      return;
    }

    clearHideTimer();
    setEngaged(false);
    schedulePreview(anchor);
  }

  function onLinkHoverEnd(event) {
    if (!isMouseLikeEvent(event)) {
      return;
    }

    const fromAnchor = isPreviewableLink(event.target);
    if (!fromAnchor) {
      return;
    }

    const x = Number.isFinite(event.clientX) ? event.clientX : state.pointer.x;
    const y = Number.isFinite(event.clientY) ? event.clientY : state.pointer.y;
    state.pointer.x = x;
    state.pointer.y = y;

    const related = event.relatedTarget;
    if (related && (fromAnchor.contains(related) || isInsidePreview(related))) {
      return;
    }

    clearTimeout(state.hoverTimer);
    state.hoverTimer = null;
    updateDismissFromPointer(x, y);
  }

  function onMouseMove(event) {
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;

    if (!isPreviewVisible()) {
      return;
    }

    updateDismissFromPointer(event.clientX, event.clientY);
  }

  function onWheel(event) {
    if (!state.enabled || !isPreviewVisible() || state.exploreMode || state.committing) {
      return;
    }

    if (isInsidePreview(event.target)) {
      engageBriefly();
      holdPreviewOpen();
      return;
    }

    const scroller = getPreviewScroller();
    if (!scroller) {
      return;
    }

    const canScroll = scroller.scrollHeight > scroller.clientHeight + 2;
    if (!canScroll) {
      updateDismissFromPointer(state.pointer.x, state.pointer.y);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    scroller.scrollTop += event.deltaY;
    engageBriefly();
    holdPreviewOpen();

    clearTimeout(wheelDismissTimer);
    wheelDismissTimer = window.setTimeout(() => {
      updateDismissFromPointer(state.pointer.x, state.pointer.y);
    }, 350);
  }

  function onDocumentMouseLeave(event) {
    if (!isPreviewVisible() || state.exploreMode || state.committing) {
      return;
    }

    if (!event.relatedTarget) {
      hidePreview();
    }
  }

  function onKeyDown(event) {
    if (!isPreviewVisible()) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      if (state.committing) {
        return;
      }

      if (state.navStack.length > 0) {
        peekBack();
        return;
      }

      if (state.exploreMode) {
        exitExploreMode();
        return;
      }

      hidePreview();
    }
  }

  function clampGlanceOpacity(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_GLANE_OPACITY;
    }

    return Math.min(MAX_GLANE_OPACITY, Math.max(MIN_GLANE_OPACITY, numeric));
  }

  function applyGlanceOpacity(value) {
    state.glanceOpacity = clampGlanceOpacity(value);
    document.documentElement.style.setProperty(
      "--happy-wiki-glance-opacity",
      String(state.glanceOpacity)
    );
  }

  function loadSettings() {
    applyGlanceOpacity(DEFAULT_GLANE_OPACITY);

    if (!globalScope.chrome || !globalScope.chrome.storage || !globalScope.chrome.storage.sync) {
      return;
    }

    globalScope.chrome.storage.sync.get({
      wikiLinkPreviewEnabled: true,
      wikiPeekGlanceOpacity: DEFAULT_GLANE_OPACITY
    }, (settings) => {
      state.enabled = Boolean(settings.wikiLinkPreviewEnabled);
      applyGlanceOpacity(settings.wikiPeekGlanceOpacity);
      setNativePopupsBlocked(state.enabled);
      if (!state.enabled) {
        hidePreview();
      }
    });

    globalScope.chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      if (changes.wikiLinkPreviewEnabled) {
        state.enabled = Boolean(changes.wikiLinkPreviewEnabled.newValue);
        setNativePopupsBlocked(state.enabled);
        if (!state.enabled) {
          hidePreview();
        }
      }

      if (changes.wikiPeekGlanceOpacity) {
        applyGlanceOpacity(changes.wikiPeekGlanceOpacity.newValue);
      }
    });
  }

  function installListeners() {
    document.addEventListener("mouseover", onLinkHoverStart, true);
    document.addEventListener("mouseout", onLinkHoverEnd, true);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseleave", onDocumentMouseLeave, true);
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", () => {
      if (!state.exploreMode && !state.committing) {
        hidePreview();
      }
    });
  }

  function disableNativePopupsStorage() {
    try {
      localStorage.setItem("mwe-popups-enabled", "0");
    } catch (error) {
      // Private browsing can block storage.
    }
  }

  function removeNativePopupNodes() {
    document.querySelectorAll(
      "#mwe-popups-container, .mwe-popups, .popups-card, .mwe-popups-fade-in-up, .mwe-popups-fade-in-down"
    ).forEach((node) => {
      if (!node.closest("#happy-wiki-preview-host")) {
        node.remove();
      }
    });
  }

  function startPopupKiller() {
    stopPopupKiller();
    removeNativePopupNodes();
    state.popupKiller = window.setInterval(removeNativePopupNodes, 48);
  }

  function stopPopupKiller() {
    if (state.popupKiller) {
      window.clearInterval(state.popupKiller);
      state.popupKiller = null;
    }
  }

  function setNativePopupsBlocked(block) {
    if (block) {
      disableNativePopupsStorage();
      suppressNativePopups();
      return;
    }

    stopPopupKiller();

    if (state.popupObserver) {
      state.popupObserver.disconnect();
      state.popupObserver = null;
    }

    document.getElementById("happy-wiki-preview-native-suppress")?.remove();
    delete document.documentElement.dataset.happyWikiPeek;
  }

  function suppressNativePopups() {
    disableNativePopupsStorage();

    if (!document.getElementById("happy-wiki-preview-native-suppress")) {
      const style = document.createElement("style");
      style.id = "happy-wiki-preview-native-suppress";
      style.textContent = [
        "#mwe-popups-container,",
        ".mwe-popups,",
        ".popups-card,",
        ".popups-icon,",
        ".mwe-popups-fade-in-up,",
        ".mwe-popups-fade-in-down {",
        "  display: none !important;",
        "  visibility: hidden !important;",
        "  pointer-events: none !important;",
        "  opacity: 0 !important;",
        "}"
      ].join(" ");
      document.documentElement.appendChild(style);
    }

    removeNativePopupNodes();

    if (!state.popupObserver) {
      state.popupObserver = new MutationObserver(removeNativePopupNodes);
      state.popupObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function whenDocumentElementReady(callback) {
    if (document.documentElement) {
      callback();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        observer.disconnect();
        callback();
      }
    });
    observer.observe(document, { childList: true });
  }

  function injectMainWorldPopupsGuard() {
    const runtime = globalScope.chrome?.runtime || globalScope.browser?.runtime;
    if (!runtime?.getURL) {
      return;
    }

    whenDocumentElementReady(() => {
      const root = document.documentElement;
      if (!root || root.dataset.happyWikiMainGuard === "1") {
        return;
      }

      root.dataset.happyWikiMainGuard = "1";

      const script = document.createElement("script");
      script.src = runtime.getURL("src/wikipedia-popups-guard.js");
      script.async = false;
      script.onload = () => script.remove();
      script.onerror = () => {
        delete root.dataset.happyWikiMainGuard;
      };
      root.appendChild(script);
    });
  }

  function markActive() {
    whenDocumentElementReady(() => {
      document.documentElement.dataset.happyWikiPeek = "active";
    });
  }

  function boot() {
    if (!isWikipediaArticleHost(window.location.hostname)) {
      return;
    }

    injectMainWorldPopupsGuard();
    whenDocumentElementReady(() => {
      suppressNativePopups();
      markActive();
    });
    loadSettings();

    const start = () => {
      suppressNativePopups();
      installListeners();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  const api = {
    parseWikiArticleLink,
    buildParseUrl,
    normalizePreviewHtml,
    stripHtml,
    clampGlanceOpacity,
    isWikipediaArticleHost,
    findCommitTitleTarget,
    createFloatingChapterTitle
  };

  globalScope.HappyWikipediaLinkPreview = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  const canBootInPage = typeof document !== "undefined"
    && typeof window !== "undefined"
    && window.top === window
    && !window.__happyWikiPreviewLoaded;

  if (canBootInPage) {
    window.__happyWikiPreviewLoaded = true;
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
