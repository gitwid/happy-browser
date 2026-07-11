// Happy Browser — Resident Advisor (RA) queer-event filter module.
// Extracted from content.js (single source of truth: src/). Loaded as its own
// content script before content.js; registers window.HappyBrowser.registerRaFilter(ctx),
// which the core calls with its shared state, constants, and helpers and gets back the
// public API. See docs/product-notes.md for the site-filter direction this seeds.
(function () {
  "use strict";
  const HB = (window.HappyBrowser = window.HappyBrowser || {});
  HB.registerRaFilter = function registerRaFilter(ctx) {
    const {
      state,
      announce,
      updateInspector,
      escapeHtml,
      getCompactText,
      RA_SIGNAL_CONFIRMATIONS_STORAGE_KEY,
      RA_FILTER_PAGE_STYLE_ID,
      RA_DETAIL_SCAN_CONCURRENCY,
      RA_DETAIL_REQUEST_MIN_INTERVAL_MS,
      RA_LGBTQ_PATTERNS
    } = ctx;

    // Site-agnostic primitives shared with future per-site filters. RA supplies its own
    // patterns, storage key, DOM selectors, and state slots; the reusable machinery
    // (pacing, anti-bot fail-fast, evidence excerpts, confirmed-signal storage) lives in
    // window.HappyBrowser.siteFilter.
    const SF = window.HappyBrowser.siteFilter;
    const detailPacer = SF.createRequestPacer({
      minIntervalMs: RA_DETAIL_REQUEST_MIN_INTERVAL_MS,
      getLastAt: () => state.raFilter.lastDetailRequestAt,
      setLastAt: (value) => {
        state.raFilter.lastDetailRequestAt = value;
      },
      skip: () => Boolean(window.__happyBrowserTestHooksRequested)
    });

  function makeRaFilterButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "happy-browser-ra-filter-button";
    button.textContent = "RA";
    button.setAttribute("aria-label", "RA filter ghost mode");
    button.setAttribute("title", "RA filter ghost mode");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleRaFilter();
    });
    return button;
  }

  function toggleRaFilter() {
    if (!isRaBerlinEventsPage()) {
      announce("RA only");
      return;
    }

    if (state.raFilter.mode === "ghost") {
      state.raFilter.mode = "filtered";
      state.raFilter.enabled = true;
      state.raFilter.userDisabled = false;
      setRaFilterPageMode();
      updateRaFilterUi();
      announce("RA filtered");
      scheduleRaFilter(0);
      return;
    }

    if (state.raFilter.mode === "filtered") {
      state.raFilter.mode = "all";
      state.raFilter.enabled = false;
      state.raFilter.userDisabled = true;
      clearRaFilterMarks();
      state.raFilter.status = null;
      setRaFilterPageMode();
      updateRaFilterUi();
      announce("RA all");
      updateInspector();
      return;
    }

    state.raFilter.mode = "ghost";
    state.raFilter.enabled = true;
    state.raFilter.userDisabled = false;
    state.raFilter.lastSignature = "";
    setRaFilterPageMode();
    updateRaFilterUi();
    announce("RA ghost");
    scheduleRaFilter(0);
  }

  function maybeRunRaFilter() {
    updateRaFilterUi();
    if (!isRaBerlinEventsPage()) {
      return;
    }

    if (!state.raFilter.enabled && !state.raFilter.userDisabled) {
      state.raFilter.mode = "ghost";
      state.raFilter.enabled = true;
    }

    setRaFilterPageMode();
    scheduleRaFilter(120);
  }

  function scheduleRaFilter(delay) {
    if (!isRaBerlinEventsPage() || !state.raFilter.enabled || state.raFilter.running) {
      return;
    }

    clearTimeout(state.raFilter.timer);
    state.raFilter.timer = window.setTimeout(() => {
      runRaLgbtqFilter().catch((error) => {
        state.raFilter.running = false;
        state.raFilter.status = {
          state: "error",
          error: error && error.message ? error.message : String(error)
        };
        updateRaFilterUi();
        updateInspector();
      });
    }, delay);
  }

  async function runRaLgbtqFilter(options = {}) {
    if (!isRaBerlinEventsPage() && !options.force) {
      return null;
    }

    if (options.force && !state.raFilter.enabled) {
      state.raFilter.mode = "ghost";
      state.raFilter.enabled = true;
      state.raFilter.userDisabled = false;
    }

    const cards = getRaEventCards();
    const signature = cards.map((card) => card.href).join("|");
    const hasUnknownMarks = cards.some((card) => card.element && card.element.dataset.happyRaFilter === "unknown");
    const today = options.today || getBerlinTodayISO(options.now || new Date());
    const dateWindow = options.dateWindow || getRaFilterDateWindow(today, options.dateScope);
    const dateWindowKey = getRaDateWindowKey(dateWindow);
    if (!options.force && !hasUnknownMarks && signature && signature === state.raFilter.lastSignature && state.raFilter.status && state.raFilter.status.state === "done" && state.raFilter.status.dateWindowKey === dateWindowKey) {
      return state.raFilter.status;
    }

    const runId = state.raFilter.runId + 1;
    state.raFilter.runId = runId;
    state.raFilter.running = true;
    state.raFilter.lastSignature = signature;
    state.raFilter.frameFallbacks = 0;
    state.raFilter.lastDetailRequestAt = 0;
    state.raFilter.status = {
      state: "running",
      total: cards.length,
      scanned: 0,
      matched: 0,
      today: 0,
      hidden: 0,
      unknown: 0,
      errors: 0,
      dateWindow,
      dateWindowKey,
      sources: {}
    };
    ensureRaFilterPageStyle();
    setRaFilterPageMode();
    updateRaFilterUi();

    const detailsByHref = options.detailsByHref || null;
    const results = await scanRaEventCards(cards, {
      today,
      dateWindow,
      detailsByHref,
      runId,
      concurrency: options.concurrency
    });

    if (runId !== state.raFilter.runId) {
      return state.raFilter.status;
    }

    state.raFilter.running = false;
    state.raFilter.status = {
      state: "done",
      total: cards.length,
      scanned: cards.length,
      matched: results.filter((result) => result.matched).length,
      today: results.filter((result) => result.today).length,
      hidden: results.filter((result) => !result.matched && !result.error).length,
      unknown: results.filter((result) => result.error).length,
      errors: results.filter((result) => result.error).length,
      todayISO: today,
      dateWindow,
      dateWindowKey,
      sources: countRaResultSources(results),
      results
    };
    updateRaFilterUi();
    updateInspector();
    return state.raFilter.status;
  }

  async function scanRaEventCards(cards, options) {
    const results = [];
    let index = 0;
    const concurrency = Math.max(1, Math.min(
      options.concurrency || RA_DETAIL_SCAN_CONCURRENCY,
      RA_DETAIL_SCAN_CONCURRENCY,
      cards.length || 1
    ));

    const workers = Array.from({ length: concurrency }, async () => {
      while (index < cards.length) {
        if (options.runId !== state.raFilter.runId) {
          return;
        }

        const card = cards[index];
        index += 1;
        const result = await scanRaEventCard(card, options);
        if (options.runId !== state.raFilter.runId) {
          return;
        }

        results.push(result);
        markRaCard(card.element, getRaFilterCardStatus(result), result);
        state.raFilter.status.scanned += 1;
        state.raFilter.status.today += result.today ? 1 : 0;
        state.raFilter.status.matched += result.matched ? 1 : 0;
        state.raFilter.status.hidden += !result.matched && !result.error ? 1 : 0;
        state.raFilter.status.unknown += result.error ? 1 : 0;
        state.raFilter.status.errors += result.error ? 1 : 0;
        incrementRaSourceCount(state.raFilter.status.sources, result.source || "unknown");
        updateRaFilterUi();
      }
    });

    await Promise.all(workers);
    return results;
  }

  async function scanRaEventCard(card, options) {
    markRaCard(card.element, "loading");
    const dateHintMatches = card.dateHint ? raDateHintInDateWindow(card.dateHint, options.dateWindow) : false;
    const cardSignalText = getRaCardSignalText(card);
    try {
      if (card.dateHint && !dateHintMatches) {
        return {
          href: card.href,
          title: card.title,
          today: false,
          signals: [],
          matched: false,
          source: "date-skip"
        };
      }

      const fixtureDetail = options.detailsByHref && options.detailsByHref[card.href];
      const detail = fixtureDetail || await getRaEventDetail(card.href);
      const source = detail.source || (fixtureDetail ? "fixture" : "unknown");
      const text = [
        cardSignalText,
        detail.title,
        detail.description,
        detail.signalText
      ].join("\n");
      const todayMatch = isRaEventInDateWindow(detail, card, options.dateWindow);
      const signals = getRaLgbtqSignals(text);
      const matched = todayMatch && signals.length > 0;
      return {
        href: card.href,
        title: detail.title || card.title,
        today: todayMatch,
        signals,
        evidence: getRaSignalEvidence(text, signals),
        image: detail.image || getRaCardImage(card.element),
        dateHint: card.dateHint || "",
        cardText: card.text || "",
        matched,
        source
      };
    } catch (error) {
      const cardSignals = dateHintMatches ? getRaLgbtqSignals(cardSignalText) : [];
      if (cardSignals.length) {
        return {
          href: card.href,
          title: getRaCardFallbackTitle(card),
          today: true,
          signals: cardSignals,
          evidence: getRaSignalEvidence(cardSignalText, cardSignals),
          image: getRaCardImage(card.element),
          dateHint: card.dateHint || "",
          cardText: card.text || "",
          matched: true,
          source: "card"
        };
      }

      return {
        href: card.href,
        title: card.title,
        today: dateHintMatches,
        signals: [],
        matched: false,
        error: error && error.message ? error.message : String(error),
        source: error && error.happyRaAntiBot ? "blocked" : "unknown"
      };
    }
  }

  function getRaCardSignalText(card) {
    return [
      card && card.title,
      card && card.text
    ].filter(Boolean).join("\n");
  }

  function getRaCardFallbackTitle(card) {
    if (card && card.title) {
      return card.title;
    }

    const links = Array.from(card && card.element && card.element.querySelectorAll
      ? card.element.querySelectorAll("a[href*='/events/']")
      : []);
    const linkTitle = links.map((link) => getCompactText(link)).find(Boolean);
    if (linkTitle) {
      return linkTitle.slice(0, 160);
    }

    return getCompactText(card && card.element).slice(0, 160) || "RA event";
  }

  function isRaBerlinEventsPage() {
    return /(^|\.)ra\.co$/i.test(window.location.hostname) && /^\/events\/de\/berlin\/?$/.test(window.location.pathname);
  }

  function getRaEventCards(root = document) {
    const anchors = Array.from(root.querySelectorAll([
      "a[data-pw-test-id='event-title-link'][href*='/events/']",
      "a[data-pw-test-id='event-image-link'][href*='/events/']",
      "a[href*='/events/']"
    ].join(",")));
    const cards = [];
    const seen = new Set();

    anchors.forEach((anchor) => {
      const href = normalizeRaEventHref(anchor.getAttribute("href"));
      if (!href || seen.has(href)) {
        return;
      }

      const element = getRaEventCardElement(anchor);
      if (!element || element === document.body || element === document.documentElement) {
        return;
      }

      seen.add(href);
      cards.push({
        href,
        element,
        title: getRaCardTitle(element, anchor),
        text: getCompactText(element),
        dateHint: getRaCardDateHint(element)
      });
    });

    return cards;
  }

  function normalizeRaEventHref(href) {
    if (!href) {
      return "";
    }

    try {
      const url = new URL(href, window.location.href);
      if (!/(^|\.)ra\.co$/i.test(url.hostname) || !/^\/events\/\d+/.test(url.pathname)) {
        return "";
      }
      return `${url.origin}${url.pathname}`;
    } catch (_error) {
      return "";
    }
  }

  function getRaEventCardElement(anchor) {
    const markedCard = anchor.closest("[data-testid='event-upcoming-card'], [data-testid='event-listing-card'], [data-pw-test-id='popular-event-item']");
    if (markedCard) {
      return markedCard;
    }

    let best = null;
    let node = anchor;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (!node.querySelectorAll) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      const eventLinks = node.querySelectorAll("a[href*='/events/']").length;
      const text = getCompactText(node);
      if (rect.width >= 140 && rect.height >= 80 && eventLinks <= 3 && text.length >= 4) {
        best = node;
      }
    }

    return best || anchor.closest("li, article, section, div");
  }

  function getRaCardTitle(card, anchor) {
    const title = card.querySelector("[data-pw-test-id='event-title'], a[data-pw-test-id='event-title-link']");
    return getCompactText(title || anchor).slice(0, 160);
  }

  function getRaCardDateHint(card) {
    const text = getCompactText(card);
    const match = text.match(/\b(?:mon|tue|wed|thu|fri|sat|sun),?\s+\d{1,2}\s+[a-z]{3,9}\b/i);
    if (match) {
      return match[0];
    }

    return getRaGroupedDateHint(card);
  }

  function getRaGroupedDateHint(card) {
    let node = card && card.previousElementSibling;
    for (let depth = 0; node && depth < 60; depth += 1, node = node.previousElementSibling) {
      const text = getCompactText(node);
      const match = text.match(/\b(?:mon|tue|wed|thu|fri|sat|sun),?\s+\d{1,2}\s+[a-z]{3,9}\b/i);
      if (match) {
        return match[0];
      }
    }

    return "";
  }

  async function getRaEventDetail(href) {
    if (state.raFilter.detailCache.has(href)) {
      return state.raFilter.detailCache.get(href);
    }

    let lastError = null;
    await waitForRaDetailRequestPace();
    const directDetail = await getRaEventDetailFromHtmlSource(href, "direct", () => fetchRaEventDetailDirect(href)).catch((error) => {
      lastError = error;
      return null;
    });
    if (isRaAntiBotError(lastError)) {
      throw lastError;
    }
    if (directDetail) {
      state.raFilter.detailCache.set(href, directDetail);
      return directDetail;
    }

    await waitForRaDetailRequestPace();
    const backgroundDetail = await getRaEventDetailFromHtmlSource(href, "background", () => fetchRaEventDetailViaBackground(href)).catch((error) => {
      lastError = isRaAntiBotError(error) ? error : lastError || error;
      return null;
    });
    if (isRaAntiBotError(lastError)) {
      throw lastError;
    }
    if (backgroundDetail) {
      state.raFilter.detailCache.set(href, backgroundDetail);
      return backgroundDetail;
    }

    if (state.raFilter.frameFallbacks >= 3) {
      throw lastError || new Error("RA detail missing event metadata");
    }

    state.raFilter.frameFallbacks += 1;
    await waitForRaDetailRequestPace();
    const frameDetail = await getRaEventDetailFromFrame(href);
    frameDetail.source = "frame";
    state.raFilter.detailCache.set(href, frameDetail);
    return frameDetail;
  }

  async function waitForRaDetailRequestPace() {
    await detailPacer.wait();
  }

  function delay(ms) {
    return SF.delay(ms);
  }

  async function getRaEventDetailFromHtmlSource(href, source, fetchHtml) {
    const html = await fetchHtml();
    const detail = parseRaEventDetailHtml(html, href);
    if (detail.antiBotBlocked) {
      throw makeRaAntiBotError(source);
    }
    if (detail.hasEventData) {
      detail.source = source;
      return detail;
    }

    return null;
  }

  function countRaResultSources(results) {
    const counts = {};
    results.forEach((result) => incrementRaSourceCount(counts, result.source || "unknown"));
    return counts;
  }

  function incrementRaSourceCount(counts, source) {
    counts[source] = (counts[source] || 0) + 1;
  }

  async function fetchRaEventDetailDirect(href) {
    const response = await fetch(href, { credentials: "include" });
    const text = await response.text();
    if (!response.ok && !text) {
      throw new Error(`RA detail ${response.status}`);
    }
    return text;
  }

  function fetchRaEventDetailViaBackground(href) {
    if (!/^https:\/\/ra\.co\/events\/\d+\/?$/.test(String(href || ""))) {
      return Promise.reject(new Error("Unsupported RA detail URL"));
    }

    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
      return Promise.reject(new Error("RA background fetch unavailable"));
    }

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("RA background fetch timed out")), 10000);
      try {
        chrome.runtime.sendMessage({
          type: "happy-browser-fetch-ra-detail",
          href
        }, (response) => {
          window.clearTimeout(timeout);
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || String(runtimeError)));
            return;
          }

          if (!response) {
            reject(new Error(response && response.error || `RA detail ${response && response.status || "unavailable"}`));
            return;
          }

          if (!response.ok && !response.text) {
            reject(new Error(response.error || `RA detail ${response.status || "unavailable"}`));
            return;
          }

          resolve(String(response.text || ""));
        });
      } catch (error) {
        window.clearTimeout(timeout);
        reject(error);
      }
    });
  }

  function getRaEventDetailFromFrame(href) {
    if (window.__happyBrowserTestHooksRequested && !window.__happyBrowserAllowFrameFallback) {
      return Promise.reject(new Error("RA detail missing event metadata"));
    }

    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.src = href;
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      iframe.style.cssText = [
        "position:absolute",
        "width:1px",
        "height:1px",
        "left:-9999px",
        "top:0",
        "opacity:0",
        "pointer-events:none"
      ].join(";");
      document.documentElement.appendChild(iframe);
      readRaFrameDetailWhenReady(iframe, href)
        .then(resolve)
        .catch(reject)
        .finally(() => iframe.remove());
    });
  }

  function readRaFrameDetailWhenReady(iframe, href, options = {}) {
    const timeoutMs = options.timeoutMs || 6000;
    const intervalMs = options.intervalMs || 200;

    return new Promise((resolve, reject) => {
      let settled = false;
      let pollTimer = 0;
      const timeout = window.setTimeout(() => finish(null), timeoutMs);
      const poll = () => {
        if (settled) {
          return;
        }

        let html = "";
        try {
          const doc = iframe.contentDocument;
          html = doc && doc.documentElement ? doc.documentElement.outerHTML : "";
        } catch (_error) {
          html = "";
        }

        if (html) {
          const detail = parseRaEventDetailHtml(html, href);
          if (detail.antiBotBlocked) {
            finish(null, makeRaAntiBotError("frame"));
            return;
          }
          if (detail.hasEventData) {
            finish(detail);
            return;
          }
        }

        pollTimer = window.setTimeout(poll, intervalMs);
      };

      iframe.addEventListener("load", poll);
      iframe.addEventListener("error", () => finish(null));
      poll();

      function finish(detail, error) {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        window.clearTimeout(pollTimer);
        if (error) {
          reject(error);
          return;
        }
        if (!detail) {
          reject(new Error("RA detail missing event metadata"));
          return;
        }
        resolve(detail);
      }
    });
  }

  function parseRaEventDetailHtml(html, href = "") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const jsonEvents = Array.from(doc.querySelectorAll("script[type='application/ld+json']"))
      .flatMap((script) => parseJsonLdEvents(script.textContent));
    const event = jsonEvents.find((item) => /event/i.test(String(item && item["@type"] || ""))) || {};
    const metaDescription = doc.querySelector("meta[name='description'], meta[property='og:description']");
    const metaImage = doc.querySelector("meta[property='og:image'], meta[name='twitter:image']");
    const nextDataText = extractRaNextDataEventText(doc, href);
    const trustedDomText = getRaTrustedEventDetailText(doc);
    const title = event.name || doc.querySelector("h1") && getCompactText(doc.querySelector("h1")) || doc.title || "";
    const description = event.description || metaDescription && metaDescription.getAttribute("content") || "";
    const image = getRaEventImageUrl(event.image) || metaImage && metaImage.getAttribute("content") || "";
    const eventJsonText = getRaJsonEventText(event);
    const signalText = [
      eventJsonText,
      description,
      nextDataText,
      trustedDomText
    ].join("\n").slice(0, 9000);
    const hasEventData = Boolean(event.startDate || event.name || event.description || nextDataText || trustedDomText);

    return {
      href,
      title,
      startDate: event.startDate || "",
      description,
      image,
      signalText,
      antiBotBlocked: isRaAntiBotDetailHtml(doc, html),
      hasEventData
    };
  }

  function isRaAntiBotDetailHtml(doc, html) {
    return SF.isAntiBotHtml(doc, html);
  }

  function makeRaAntiBotError(source) {
    const error = SF.makeAntiBotError(source);
    // Preserve the RA-specific aliases existing RA code reads directly.
    error.happyRaSource = error.happyAntiBotSource;
    error.happyRaAntiBot = true;
    return error;
  }

  function isRaAntiBotError(error) {
    return SF.isAntiBotError(error);
  }

  function extractRaNextDataEventText(doc, href) {
    const script = doc.querySelector("script#__NEXT_DATA__");
    if (!script || !script.textContent) {
      return "";
    }

    try {
      const parsed = JSON.parse(script.textContent);
      const eventId = getRaEventIdFromHref(href);
      const eventObject = findRaEventObject(parsed, eventId);
      return eventObject ? getRaJsonEventText(eventObject).slice(0, 7000) : "";
    } catch (_error) {
      return "";
    }
  }

  function getRaEventIdFromHref(href) {
    const match = String(href || "").match(/\/events\/(\d+)/);
    return match ? match[1] : "";
  }

  function getRaEventImageUrl(image) {
    if (!image) {
      return "";
    }

    if (typeof image === "string") {
      return image;
    }

    if (Array.isArray(image)) {
      return image.map(getRaEventImageUrl).find(Boolean) || "";
    }

    if (typeof image === "object") {
      return image.url || image.contentUrl || "";
    }

    return "";
  }

  function findRaEventObject(value, eventId, depth = 0, seen = new Set()) {
    if (!value || typeof value !== "object" || depth > 12 || seen.has(value)) {
      return null;
    }
    seen.add(value);

    if (!Array.isArray(value) && isMatchingRaEventObject(value, eventId)) {
      return value;
    }

    const children = Array.isArray(value) ? value : Object.values(value);
    for (const child of children) {
      const match = findRaEventObject(child, eventId, depth + 1, seen);
      if (match) {
        return match;
      }
    }

    return null;
  }

  function isMatchingRaEventObject(value, eventId) {
    if (!eventId) {
      return false;
    }

    const ids = [
      value.id,
      value.eventId,
      value.event_id,
      value.contentId
    ].map((item) => String(item || ""));
    const urls = [
      value.url,
      value.href,
      value.path,
      value.slug
    ].map((item) => String(item || ""));

    return ids.includes(eventId) || urls.some((url) => url.includes(`/events/${eventId}`));
  }

  function getRaJsonEventText(value, depth = 0, seen = new Set()) {
    if (!value || depth > 6 || seen.has(value)) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value !== "object") {
      return "";
    }

    seen.add(value);
    const parts = [];
    const preferredKeys = new Set([
      "name",
      "title",
      "description",
      "summary",
      "content",
      "lineup",
      "venue",
      "location",
      "promoter",
      "organizer",
      "performer",
      "artists",
      "tags"
    ]);

    Object.entries(value).forEach(([key, child]) => {
      if (preferredKeys.has(key) || (child && typeof child === "object")) {
        parts.push(getRaJsonEventText(child, depth + 1, seen));
      }
    });

    return parts.filter(Boolean).join("\n");
  }

  function getRaTrustedEventDetailText(doc) {
    const selectors = [
      "[data-testid='event-description']",
      "[data-testid='event-details']",
      "[data-pw-test-id='event-description']",
      "[data-pw-test-id='event-details']",
      "[class*='EventDescription']",
      "[class*='eventDescription']",
      "[class*='EventDetails']",
      "[class*='eventDetails']"
    ];

    return selectors
      .flatMap((selector) => Array.from(doc.querySelectorAll(selector)))
      .map((element) => getCompactText(element))
      .filter(Boolean)
      .join("\n")
      .slice(0, 7000);
  }

  function parseJsonLdEvents(text) {
    if (!text) {
      return [];
    }

    try {
      const parsed = JSON.parse(text);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values.flatMap((value) => {
        if (value && Array.isArray(value["@graph"])) {
          return value["@graph"];
        }
        return value ? [value] : [];
      });
    } catch (_error) {
      return [];
    }
  }

  function isRaEventInDateWindow(detail, card, dateWindow) {
    if (detail && detail.startDate && isoDateInRaDateWindow(String(detail.startDate).slice(0, 10), dateWindow)) {
      return true;
    }

    if (!card || !card.dateHint) {
      return false;
    }

    return raDateHintInDateWindow(card.dateHint, dateWindow);
  }

  function raDateHintMatchesToday(dateHint, today) {
    return raDateHintInDateWindow(dateHint, getRaFilterDateWindow(today, "today"));
  }

  function raDateHintInDateWindow(dateHint, dateWindow) {
    const hintDate = parseRaDateHintISO(dateHint, dateWindow);
    return isoDateInRaDateWindow(hintDate, dateWindow);
  }

  function parseRaDateHintISO(dateHint, dateWindow) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const match = String(dateHint).toLowerCase().match(/\b(\d{1,2})\s+([a-z]{3})/);
    if (!match) {
      return "";
    }

    const month = monthNames.indexOf(match[2]) + 1;
    if (!month || !dateWindow || !dateWindow.startISO) {
      return "";
    }

    const day = Number(match[1]);
    const startYear = Number(dateWindow.startISO.slice(0, 4));
    const candidates = [startYear, startYear - 1, startYear + 1]
      .map((year) => formatISODate(year, month, day));
    return candidates.find((candidate) => isoDateInRaDateWindow(candidate, dateWindow)) || candidates[0] || "";
  }

  function getRaFilterDateWindow(today, scope) {
    if (scope === "today") {
      return {
        startISO: today,
        endISO: today,
        label: "today"
      };
    }

    const date = parseISODateAsUTC(today);
    if (!date) {
      return {
        startISO: today,
        endISO: today,
        label: "week"
      };
    }

    const daysUntilSunday = (7 - date.getUTCDay()) % 7;
    return {
      startISO: today,
      endISO: addDaysISO(today, daysUntilSunday),
      label: daysUntilSunday === 0 ? "today" : "week"
    };
  }

  function getRaDateWindowKey(dateWindow) {
    return `${dateWindow && dateWindow.startISO || ""}:${dateWindow && dateWindow.endISO || ""}`;
  }

  function isoDateInRaDateWindow(isoDate, dateWindow) {
    const value = String(isoDate || "").slice(0, 10);
    return Boolean(value && dateWindow && value >= dateWindow.startISO && value <= dateWindow.endISO);
  }

  function addDaysISO(isoDate, days) {
    const date = parseISODateAsUTC(isoDate);
    if (!date) {
      return isoDate;
    }
    date.setUTCDate(date.getUTCDate() + days);
    return formatISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  function parseISODateAsUTC(isoDate) {
    const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function formatISODate(year, month, day) {
    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  function getRaLgbtqSignals(text) {
    return SF.matchSignals(text, RA_LGBTQ_PATTERNS);
  }

  function getRaSignalEvidence(text, signals) {
    return SF.collectEvidence(text, signals, RA_LGBTQ_PATTERNS, 4);
  }

  function makeRaEvidenceExcerpt(text, index, length) {
    return SF.makeEvidenceExcerpt(text, index, length);
  }

  function getRaCardImage(card) {
    const image = card && card.querySelector && card.querySelector("img[src], picture img[src]");
    return image ? image.currentSrc || image.src || image.getAttribute("src") || "" : "";
  }

  function getBerlinTodayISO(now) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const values = {};
    parts.forEach((part) => {
      values[part.type] = part.value;
    });
    return `${values.year}-${values.month}-${values.day}`;
  }

  function ensureRaFilterPageStyle() {
    if (document.getElementById(RA_FILTER_PAGE_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = RA_FILTER_PAGE_STYLE_ID;
    style.textContent = `
      html[data-happy-ra-mode="filtered"] [data-happy-ra-filter="miss"] {
        display: none !important;
      }

      html[data-happy-ra-mode="ghost"] [data-happy-ra-filter="miss"] {
        display: flex !important;
        opacity: 0.16 !important;
        filter: grayscale(1) saturate(0.2) !important;
        outline: 2px dashed rgba(255, 255, 255, 0.42) !important;
        outline-offset: 3px !important;
      }

      html[data-happy-ra-mode="ghost"] [data-happy-ra-filter="miss"] img,
      html[data-happy-ra-mode="ghost"] [data-happy-ra-filter="miss"] picture,
      html[data-happy-ra-mode="ghost"] [data-happy-ra-filter="miss"] video {
        opacity: 0.18 !important;
      }

      html[data-happy-ra-mode="all"] [data-happy-ra-filter] {
        display: revert !important;
        filter: none !important;
        opacity: 1 !important;
        outline: none !important;
      }

      [data-happy-ra-filter="loading"] {
        opacity: 0.45 !important;
      }

      [data-happy-ra-filter="unknown"] {
        opacity: 0.78 !important;
        outline: 2px solid rgba(255, 202, 98, 0.76) !important;
        outline-offset: 3px !important;
      }

      [data-happy-ra-filter="match"] {
        outline: 2px solid rgba(20, 190, 120, 0.88) !important;
        outline-offset: 3px !important;
      }

      #happy-browser-ra-proof {
        position: fixed !important;
        z-index: 2147483646 !important;
        width: min(390px, calc(100vw - 24px)) !important;
        max-height: min(520px, calc(100vh - 24px)) !important;
        border: 1px solid rgba(160, 255, 206, 0.44) !important;
        border-radius: 8px !important;
        background: rgba(14, 18, 18, 0.94) !important;
        box-shadow: 0 20px 56px rgba(0, 0, 0, 0.34) !important;
        color: #f5fff9 !important;
        display: none !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        overflow: hidden !important;
        pointer-events: auto !important;
        backdrop-filter: blur(18px) !important;
      }

      #happy-browser-ra-proof[data-visible="true"] {
        display: block !important;
      }

      .happy-browser-ra-proof__media {
        width: 100% !important;
        height: 128px !important;
        background: linear-gradient(135deg, rgba(30, 64, 56, 0.92), rgba(60, 32, 72, 0.82)) !important;
        object-fit: cover !important;
      }

      .happy-browser-ra-proof__body {
        display: grid !important;
        gap: 10px !important;
        padding: 12px !important;
      }

      .happy-browser-ra-proof__meta {
        color: rgba(245, 255, 249, 0.68) !important;
        font-size: 11px !important;
        font-weight: 680 !important;
        letter-spacing: 0 !important;
        text-transform: uppercase !important;
      }

      .happy-browser-ra-proof__title {
        margin: 0 !important;
        color: #ffffff !important;
        font-size: 18px !important;
        font-weight: 760 !important;
        line-height: 1.18 !important;
      }

      .happy-browser-ra-proof__signals {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
      }

      .happy-browser-ra-proof__signal {
        border: 1px solid rgba(148, 236, 185, 0.52) !important;
        border-radius: 999px !important;
        background: rgba(31, 83, 60, 0.64) !important;
        color: #effff5 !important;
        cursor: pointer !important;
        font: inherit !important;
        font-size: 11px !important;
        font-weight: 760 !important;
        line-height: 1 !important;
        padding: 7px 9px !important;
      }

      .happy-browser-ra-proof__signal[data-confirmed="true"] {
        background: rgba(164, 255, 198, 0.92) !important;
        border-color: rgba(218, 255, 226, 0.95) !important;
        color: #10261b !important;
      }

      .happy-browser-ra-proof__excerpt {
        margin: 0 !important;
        border-left: 2px solid rgba(148, 236, 185, 0.62) !important;
        padding: 0 0 0 9px !important;
        color: rgba(245, 255, 249, 0.86) !important;
        font-size: 12px !important;
        line-height: 1.42 !important;
      }

      .happy-browser-ra-proof__excerpt mark {
        border-radius: 4px !important;
        background: rgba(255, 227, 116, 0.88) !important;
        color: #1b1807 !important;
        padding: 0 2px !important;
      }

      .happy-browser-ra-proof__footer {
        color: rgba(245, 255, 249, 0.58) !important;
        font-size: 11px !important;
        line-height: 1.35 !important;
      }
    `;
    document.documentElement.appendChild(style);
    setRaFilterPageMode();
  }

  function setRaFilterPageMode() {
    if (!document.documentElement) {
      return;
    }

    document.documentElement.dataset.happyRaMode = state.raFilter.enabled ? state.raFilter.mode : "all";
  }

  function markRaCard(element, status, result) {
    if (!element) {
      return;
    }

    element.dataset.happyRaFilter = status;
    if (result) {
      element.dataset.happyRaToday = String(result.today);
      element.dataset.happyRaSignals = result.signals.join(", ");
      element.dataset.happyRaSource = result.source || "";
      if (result.href) {
        element.dataset.happyRaHref = result.href;
        state.raFilter.proofResults.set(result.href, result);
      }
      element.setAttribute("title", getRaFilterCardTitle(result));
    }
  }

  function getRaFilterCardStatus(result) {
    if (result && result.error) {
      return "unknown";
    }

    return result && result.matched ? "match" : "miss";
  }

  function getRaFilterCardTitle(result) {
    if (result.error) {
      return "Happy Browser: detail unavailable";
    }

    const source = result.source ? ` (${result.source})` : "";
    return result.signals.length ? `Happy Browser: ${result.signals.join(", ")}${source}` : `Happy Browser: filtered out${source}`;
  }

  function clearRaFilterMarks() {
    document.querySelectorAll("[data-happy-ra-filter]").forEach((element) => {
      delete element.dataset.happyRaFilter;
      delete element.dataset.happyRaToday;
      delete element.dataset.happyRaSignals;
      delete element.dataset.happyRaSource;
      delete element.dataset.happyRaHref;
      element.removeAttribute("title");
    });
    state.raFilter.proofResults.clear();
    hideRaProofCard();
  }

  function onRaProofHoverStart(event) {
    if (!isRaBerlinEventsPage() || !state.raFilter.enabled) {
      return;
    }

    const card = getRaProofCardFromTarget(event.target);
    if (!card) {
      return;
    }

    const result = getRaProofResultForCard(card);
    if (!result || !result.matched) {
      return;
    }

    clearTimeout(state.raFilter.proofHideTimer);
    state.raFilter.proofActiveElement = card;
    showRaProofCard(card, result);
  }

  function onRaProofHoverEnd(event) {
    const card = getRaProofCardFromTarget(event.target);
    if (!card) {
      return;
    }

    const related = event.relatedTarget;
    if (related && (card.contains(related) || isInsideRaProofCard(related))) {
      return;
    }

    scheduleRaProofHide();
  }

  function getRaProofCardFromTarget(target) {
    return target && target.closest ? target.closest('[data-happy-ra-filter="match"]') : null;
  }

  function getRaProofResultForCard(card) {
    const href = card && card.dataset ? card.dataset.happyRaHref : "";
    return href ? state.raFilter.proofResults.get(href) : null;
  }

  function ensureRaProofCard() {
    ensureRaFilterPageStyle();
    if (state.raFilter.proofHost && state.raFilter.proofHost.isConnected) {
      return state.raFilter.proofHost;
    }

    const host = document.createElement("aside");
    host.id = "happy-browser-ra-proof";
    host.dataset.visible = "false";
    host.setAttribute("aria-label", "Happy Browser RA queer evidence");
    host.addEventListener("mouseenter", () => clearTimeout(state.raFilter.proofHideTimer));
    host.addEventListener("mouseleave", scheduleRaProofHide);
    host.addEventListener("click", onRaProofClick);
    document.documentElement.appendChild(host);
    state.raFilter.proofHost = host;
    return host;
  }

  function showRaProofCard(card, result) {
    const host = ensureRaProofCard();
    host.innerHTML = renderRaProofCard(result);
    host.dataset.visible = "true";
    positionRaProofCard(host, card);
  }

  function hideRaProofCard() {
    clearTimeout(state.raFilter.proofHideTimer);
    if (state.raFilter.proofHost) {
      state.raFilter.proofHost.dataset.visible = "false";
    }
    state.raFilter.proofActiveElement = null;
  }

  function scheduleRaProofHide() {
    clearTimeout(state.raFilter.proofHideTimer);
    state.raFilter.proofHideTimer = window.setTimeout(hideRaProofCard, 180);
  }

  function isInsideRaProofCard(target) {
    return Boolean(state.raFilter.proofHost && target && state.raFilter.proofHost.contains(target));
  }

  function positionRaProofCard(host, card) {
    const rect = card.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const width = hostRect.width || Math.min(390, Math.max(280, window.innerWidth - 24));
    const height = hostRect.height || 360;
    const gap = 12;
    const rightSpace = window.innerWidth - rect.right;
    const left = rightSpace >= width + gap
      ? rect.right + gap
      : Math.max(12, rect.left - width - gap);
    const top = Math.min(
      Math.max(12, rect.top),
      Math.max(12, window.innerHeight - height - 12)
    );
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(top)}px`;
  }

  function renderRaProofCard(result) {
    const confirmations = getRaSignalConfirmations();
    const confirmed = confirmations[result.href] || {};
    const image = result.image ? `<img class="happy-browser-ra-proof__media" src="${escapeHtml(result.image)}" alt="">` : '<div class="happy-browser-ra-proof__media" aria-hidden="true"></div>';
    const chips = (result.signals || []).map((signal) => {
      const isConfirmed = Boolean(confirmed[signal]);
      return `<button type="button" class="happy-browser-ra-proof__signal" data-signal="${escapeHtml(signal)}" data-confirmed="${isConfirmed}" title="Confirm this signal">${escapeHtml(isConfirmed ? `OK ${signal}` : signal)}</button>`;
    }).join("");
    const excerpts = (result.evidence && result.evidence.length ? result.evidence : [{
      label: "",
      match: "",
      excerpt: result.cardText || "Matched by RA detail metadata."
    }]).map((item) => (
      `<p class="happy-browser-ra-proof__excerpt">${formatRaEvidenceExcerptHtml(item)}</p>`
    )).join("");

    return [
      image,
      '<div class="happy-browser-ra-proof__body">',
      `  <div class="happy-browser-ra-proof__meta">${escapeHtml([result.dateHint, result.source].filter(Boolean).join(" / "))}</div>`,
      `  <h3 class="happy-browser-ra-proof__title">${escapeHtml(result.title || "RA event")}</h3>`,
      `  <div class="happy-browser-ra-proof__signals">${chips}</div>`,
      excerpts,
      '  <div class="happy-browser-ra-proof__footer">Click a signal when the excerpt proves the queer match.</div>',
      "</div>"
    ].join("");
  }

  function formatRaEvidenceExcerptHtml(item) {
    const excerpt = String(item && item.excerpt || "");
    const match = String(item && item.match || "");
    if (!match) {
      return escapeHtml(excerpt);
    }

    const index = excerpt.toLowerCase().indexOf(match.toLowerCase());
    if (index < 0) {
      return escapeHtml(excerpt);
    }

    return [
      escapeHtml(excerpt.slice(0, index)),
      `<mark>${escapeHtml(excerpt.slice(index, index + match.length))}</mark>`,
      escapeHtml(excerpt.slice(index + match.length))
    ].join("");
  }

  function onRaProofClick(event) {
    const button = event.target && event.target.closest ? event.target.closest(".happy-browser-ra-proof__signal") : null;
    if (!button || !state.raFilter.proofActiveElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const result = getRaProofResultForCard(state.raFilter.proofActiveElement);
    const signal = button.dataset.signal || "";
    if (!result || !result.href || !signal) {
      return;
    }

    const confirmations = getRaSignalConfirmations();
    confirmations[result.href] = confirmations[result.href] || {};
    confirmations[result.href][signal] = {
      confirmedAt: new Date().toISOString(),
      title: result.title || "",
      source: result.source || ""
    };
    saveRaSignalConfirmations(confirmations);
    button.dataset.confirmed = "true";
    button.textContent = `OK ${signal}`;
    announce(`Confirmed ${signal}`);
  }

  function getRaSignalConfirmations() {
    if (state.raFilter.confirmedSignals && Object.keys(state.raFilter.confirmedSignals).length) {
      return state.raFilter.confirmedSignals;
    }

    state.raFilter.confirmedSignals = SF.readConfirmations(RA_SIGNAL_CONFIRMATIONS_STORAGE_KEY);
    return state.raFilter.confirmedSignals;
  }

  function saveRaSignalConfirmations(confirmations) {
    state.raFilter.confirmedSignals = confirmations || {};
    SF.writeConfirmations(RA_SIGNAL_CONFIRMATIONS_STORAGE_KEY, state.raFilter.confirmedSignals);
  }

  function updateRaFilterUi() {
    if (!state.rail) {
      return;
    }

    const isRaPage = isRaBerlinEventsPage();
    const status = state.raFilter.status;
    const button = state.rail.querySelector(".happy-browser-ra-filter-button");
    const mode = state.raFilter.enabled ? state.raFilter.mode : "all";
    state.rail.dataset.raPage = String(isRaPage);
    state.rail.dataset.raFilterEnabled = String(isRaPage && state.raFilter.enabled);
    state.rail.dataset.raFilterRunning = String(Boolean(state.raFilter.running));
    state.rail.dataset.raMode = isRaPage ? mode : "";
    state.rail.dataset.raFilterPhase = isRaPage ? getRaFilterPhase(status) : "";
    state.rail.dataset.raFilterMatched = String(status && status.matched || 0);
    state.rail.dataset.raFilterToday = String(status && status.today || 0);
    state.rail.dataset.raFilterHidden = String(status && status.hidden || 0);
    state.rail.dataset.raFilterUnknown = String(status && status.unknown || 0);
    state.rail.dataset.raFilterSources = status && status.sources ? formatRaSourceCounts(status.sources) : "";

    if (button) {
      const label = formatRaFilterButtonLabel(status);
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    }

    const modeChip = state.rail.querySelector(".happy-browser-ra-mode");
    if (modeChip) {
      modeChip.textContent = mode;
    }

    const progressChip = state.rail.querySelector(".happy-browser-ra-progress");
    if (progressChip) {
      const progressLabel = formatRaFilterProgressLabel(status);
      progressChip.textContent = progressLabel;
      progressChip.setAttribute("title", formatRaFilterStatus());
      progressChip.setAttribute("aria-label", `RA filter ${progressLabel}`);
    }
  }

  function getRaFilterPhase(status) {
    if (!state.raFilter.enabled) {
      return "all";
    }

    if (!status) {
      return "ready";
    }

    if (status.state === "running" || status.state === "done" || status.state === "error") {
      return status.state;
    }

    return "ready";
  }

  function formatRaFilterButtonLabel(status) {
    if (!isRaBerlinEventsPage()) {
      return "Filter RA events for this week and LGBTQ signals";
    }

    if (!state.raFilter.enabled) {
      return "RA all events visible";
    }

    if (!status) {
      return state.raFilter.mode === "ghost" ? "RA ghost filter starting" : "RA filter starting";
    }

    if (status.state === "running") {
      return `RA filtering ${status.scanned || 0}/${status.total || 0}`;
    }

    if (status.state === "error") {
      return "RA filter needs retry";
    }

    const modeLabel = state.raFilter.mode === "ghost" ? "ghost" : "filtered";
    if (status.unknown) {
      return `RA ${modeLabel}: ${status.matched || 0} matched; ${status.unknown} unknown`;
    }

    return `RA ${modeLabel}: ${status.matched || 0} matched this week`;
  }

  function formatRaFilterProgressLabel(status) {
    if (!isRaBerlinEventsPage()) {
      return "";
    }

    if (!state.raFilter.enabled) {
      return "all";
    }

    if (!status) {
      return "ready";
    }

    if (status.state === "running") {
      return `scan ${status.scanned || 0}/${status.total || 0}`;
    }

    if (status.state === "error") {
      return "retry";
    }

    if (status.state === "done") {
      if ((status.total || 0) > 0 && (status.today || 0) === 0 && !status.unknown) {
        return "none this week";
      }
      const suffix = status.unknown ? ` ?${status.unknown}` : "";
      return `done ${status.matched || 0}/${status.today || 0}${suffix}`;
    }

    return "ready";
  }

  function formatRaFilterStatus() {
    const status = state.raFilter.status;
    if (!isRaBerlinEventsPage()) {
      return "not on RA Berlin";
    }

    if (!state.raFilter.enabled) {
      return "all visible";
    }

    if (!status) {
      return "starting";
    }

    if (status.state === "error") {
      return escapeHtml(status.error || "error");
    }

    if (status.state === "running") {
      return `${status.scanned || 0}/${status.total || 0} scanned`;
    }

    const sources = status.sources ? `; ${formatRaSourceCounts(status.sources)}` : "";
    return `${status.matched || 0}/${status.today || 0} this week matched; ${status.hidden || 0} hidden; ${status.unknown || 0} unknown${sources}`;
  }

  function formatRaSourceCounts(sources) {
    return ["card", "direct", "background", "frame", "fixture", "date-skip", "blocked", "unknown"]
      .filter((key) => sources[key])
      .map((key) => `${key} ${sources[key]}`)
      .join("; ");
  }

    return {
      makeRaFilterButton,
      toggleRaFilter,
      maybeRunRaFilter,
      updateRaFilterUi,
      formatRaFilterStatus,
      onRaProofHoverStart,
      onRaProofHoverEnd,
      isRaBerlinEventsPage,
      getRaEventCards,
      getRaSignalConfirmations,
      parseRaEventDetailHtml,
      readRaFrameDetailWhenReady,
      runRaLgbtqFilter
    };
  };
})();
