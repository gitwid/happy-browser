(function attachHappyNavigationScoring(globalScope) {
  const STRONG_THRESHOLD = 95;
  const TENTATIVE_THRESHOLD = 55;
  const TEXT_LIMIT = 140;

  const POSITIVE_TEXT = {
    next: [
      "next",
      "mehr laden",
      "laden",
      "load more",
      "older",
      "continue",
      "weiter",
      "suivant",
      "volgende",
      "siguiente",
      "chevron-right",
      "arrow-right",
      "page-next",
      "›",
      "»",
      ">",
      "→",
      "next page",
      "seite weiter",
      "seite vor",
      "seite 2",
      "show more"
    ],
    previous: [
      "previous",
      "prev",
      "back",
      "newer",
      "zuruck",
      "zurück",
      "precedent",
      "précédent",
      "vorige",
      "anterior",
      "chevron-left",
      "arrow-left",
      "page-prev",
      "page-previous",
      "‹",
      "«",
      "<",
      "←",
      "previous page"
    ]
  };

  const NEGATIVE_TEXT = [
    "login",
    "sign in",
    "cart",
    "basket",
    "checkout",
    "filter",
    "sort",
    "menu",
    "share",
    "subscribe",
    "newsletter",
    "register",
    "advertisement",
    "adchoices",
    "article",
    "blog",
    "privacy",
    "cookie",
    "close",
    "dismiss",
    "play",
    "pause",
    "volume",
    "download",
    "alle produkte",
    "mehr ratgeber",
    "ratgeber",
    "weiterlesen",
    "edit page",
    "page source",
    "related",
    "history",
    "discussion",
    "to do",
    "follow",
    "facebook",
    "twitter",
    "join",
    "go ad free",
    "random trope",
    "random media",
    "search"
  ];

  const STRUCTURE_HINTS = [
    "pagination",
    "pager",
    "pages",
    "gallery",
    "carousel",
    "slider",
    "slideshow",
    "lightbox",
    "archive",
    "results"
  ];

  function analyzeNavigation(documentRef, options = {}) {
    const documentObject = documentRef || globalScope.document;
    const locationObject = options.location || globalScope.location;
    const directions = {
      next: analyzeDirection(documentObject, locationObject, "next", options),
      previous: analyzeDirection(documentObject, locationObject, "previous", options)
    };
    const state = getReadinessState(directions);

    return {
      state,
      directions,
      summary: {
        hasNext: Boolean(directions.next.best),
        hasPrevious: Boolean(directions.previous.best),
        nextConfidence: directions.next.confidence,
        previousConfidence: directions.previous.confidence
      }
    };
  }

  function analyzeDirection(documentObject, locationObject, direction, options) {
    const candidates = collectCandidates(documentObject, locationObject, direction, options);
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    const confidence = best ? classifyConfidence(best.score) : "none";

    return {
      best,
      confidence,
      candidates: candidates.slice(0, options.maxCandidates || 8)
    };
  }

  function collectCandidates(documentObject, locationObject, direction, options) {
    const candidates = [];
    const seen = new Set();
    const relSelector = direction === "next" ? "a[rel~='next'], link[rel~='next']" : "a[rel~='prev'], a[rel~='previous'], link[rel~='prev'], link[rel~='previous']";

    documentObject.querySelectorAll(relSelector).forEach((element) => {
      addCandidate(candidates, seen, buildCandidate(element, direction, locationObject, {
        baseScore: 120,
        source: "rel"
      }));
    });

    documentObject.querySelectorAll("a[href], button, label[for], [role='button'], [role='link'], input[type='button'], input[type='submit']").forEach((element) => {
      addCandidate(candidates, seen, buildCandidate(element, direction, locationObject, {
        baseScore: 0,
        source: "element"
      }));
    });

    const urlCandidate = buildUrlPatternCandidate(documentObject, locationObject, direction);
    if (urlCandidate) {
      addCandidate(candidates, seen, urlCandidate);
    }

    const excludedSelectors = new Set(options.excludedSelectors || []);

    return candidates.filter((candidate) => candidate.score >= 20 && !excludedSelectors.has(candidate.selector));
  }

  function addCandidate(candidates, seen, candidate) {
    if (!candidate) {
      return;
    }

    const key = candidate.href || candidate.selector || `${candidate.text}:${candidate.direction}:${candidate.source}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push(candidate);
  }

  function buildCandidate(element, direction, locationObject, seed) {
    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    const href = getHref(element, locationObject);
    const text = getElementSignalText(element);
    const normalizedText = normalizeText(text);
    const visibility = getVisibility(element);
    const context = getContextText(element);
    const contextText = normalizeText(context);
    const scoreParts = [];
    let score = seed.baseScore;

    if (!visibility.visible) {
      return null;
    }

    if (visibility.area >= 700) {
      score += 16;
      scoreParts.push("meaningful-size");
    } else if (visibility.area >= 160) {
      score += 8;
      scoreParts.push("small-but-clickable");
    } else if (seed.source !== "rel") {
      score -= 25;
      scoreParts.push("tiny-target");
    }

    if (isDisabled(element)) {
      return null;
    }

    const textScore = scoreText(normalizedText, direction);
    score += textScore.score;
    scoreParts.push(...textScore.reasons);

    const contextScore = scoreStructureContext(element, context, direction);
    score += contextScore.score;
    scoreParts.push(...contextScore.reasons);

    if (href) {
      const urlScore = scoreHref(href, locationObject, direction);
      score += urlScore.score;
      scoreParts.push(...urlScore.reasons);
    } else if (tagName === "button" || element.getAttribute("role") === "button") {
      score += 8;
      scoreParts.push("js-control");
    }

    if (direction === "next" && isLoadMoreControl(normalizedText, contextText)) {
      score += 58;
      scoreParts.push("load-more-control");
      if (tagName === "button" && normalizeText(element.textContent) === "mehr laden") {
        score += 36;
        scoreParts.push("exact-load-more-button");
      }
    }

    const paginationNumberScore = scorePaginationNumberLink(element, href, locationObject, direction, normalizedText, contextText);
    score += paginationNumberScore.score;
    scoreParts.push(...paginationNumberScore.reasons);

    if (isInsideUnrelatedControl(element)) {
      score -= 45;
      scoreParts.push("unrelated-control-region");
    }

    if (isUtilityChromeControl(element, normalizedText, contextText)) {
      score -= 120;
      scoreParts.push("utility-chrome-control");
    }

    if (isDirectionalContentLink(seed.source, href, normalizedText, contextText, scoreParts)) {
      score -= 68;
      scoreParts.push("directional-content-link");
    }

    if (isInsideDocumentTail(element) && !isPaginationOrLoadMore(normalizedText, contextText)) {
      score -= 80;
      scoreParts.push("document-tail-region");
    }

    if (isOutboundHref(href, locationObject) && seed.source !== "rel" && !isPaginationOrLoadMore(normalizedText, contextText)) {
      score -= 100;
      scoreParts.push("outbound-non-navigation");
    }

    if (tagName === "link") {
      score += 15;
      scoreParts.push("document-link");
    }

    if (!href && seed.source !== "rel") {
      score = Math.min(score, STRONG_THRESHOLD - 1);
      scoreParts.push("js-only-cap");
    }

    return {
      direction,
      source: seed.source,
      type: href ? "link" : "click",
      score,
      confidence: classifyConfidence(score),
      href,
      text: text.trim().slice(0, TEXT_LIMIT),
      selector: getSelector(element),
      reason: scoreParts,
      preflight: {
        visible: visibility.visible,
        area: Math.round(visibility.area),
        enabled: !isDisabled(element),
        hasHref: Boolean(href),
        jsOnly: !href
      }
    };
  }

  function getHref(element, locationObject) {
    const rawHref = element.getAttribute && (element.getAttribute("href") || element.getAttribute("data-href"));
    if (!rawHref || rawHref.trim().startsWith("#") || rawHref.trim().toLowerCase().startsWith("javascript:")) {
      return "";
    }

    try {
      return new URL(rawHref, locationObject.href).href;
    } catch (_error) {
      return "";
    }
  }

  function getElementSignalText(element) {
    const pieces = [
      element.innerText,
      element.textContent,
      element.getAttribute && element.getAttribute("aria-label"),
      element.getAttribute && element.getAttribute("title"),
      element.getAttribute && element.getAttribute("alt"),
      element.getAttribute && element.getAttribute("value"),
      element.getAttribute && element.getAttribute("data-testid"),
      element.getAttribute && element.getAttribute("class"),
      element.getAttribute && element.getAttribute("id"),
      getDescendantSignalText(element),
      getLineageSignalText(element)
    ];

    const image = element.querySelector && element.querySelector("img[alt]");
    if (image) {
      pieces.push(image.getAttribute("alt"));
    }

    return pieces.filter(Boolean).join(" ").slice(0, TEXT_LIMIT * 3);
  }

  function getDescendantSignalText(element) {
    if (!element.querySelectorAll) {
      return "";
    }

    return Array.from(element.querySelectorAll("[aria-label], [title], [alt], [class], [id]"))
      .slice(0, 8)
      .map((child) => [
        child.getAttribute("aria-label"),
        child.getAttribute("title"),
        child.getAttribute("alt"),
        child.getAttribute("class"),
        child.getAttribute("id")
      ].filter(Boolean).join(" "))
      .join(" ");
  }

  function getLineageSignalText(element) {
    const pieces = [];
    let current = element;

    while (current && current.nodeType === 1 && pieces.length < 18) {
      pieces.push(
        current.getAttribute("aria-label"),
        current.getAttribute("class"),
        current.getAttribute("id"),
        current.tagName
      );
      current = current.parentElement;
    }

    return pieces.filter(Boolean).join(" ");
  }

  function getContextText(element) {
    return getLineageSignalText(element);
  }

  function scoreText(text, direction) {
    const reasons = [];
    let score = 0;
    const positives = POSITIVE_TEXT[direction];
    const opposites = POSITIVE_TEXT[direction === "next" ? "previous" : "next"];

    positives.forEach((phrase) => {
      if (hasTokenOrSymbol(text, phrase)) {
        score += phrase.length <= 2 ? 28 : 42;
        reasons.push(`text:${phrase}`);
      }
    });

    opposites.forEach((phrase) => {
      if (hasTokenOrSymbol(text, phrase)) {
        score -= phrase.length <= 2 ? 24 : 38;
        reasons.push(`opposite-text:${phrase}`);
      }
    });

    NEGATIVE_TEXT.forEach((phrase) => {
      if (text.includes(phrase)) {
        score -= 18;
        reasons.push(`negative:${phrase}`);
      }
    });

    if (/page\s*\d+/i.test(text)) {
      score += 8;
      reasons.push("page-number-text");
    }

    if (direction === "next" && /\bmehr\s+laden\b|\bload\s+more\b/.test(text)) {
      score += 28;
      reasons.push("text:load-more");
    }

    if (text.includes("weiterlesen")) {
      score -= 60;
      reasons.push("negative:weiterlesen");
    }

    return { score, reasons };
  }

  function scorePaginationNumberLink(element, href, locationObject, direction, text, context) {
    const reasons = [];
    let score = 0;

    if (!href || !/^\d+$/.test(normalizeText(element.textContent))) {
      return { score, reasons };
    }

    if (!/pagination|pager|pages|seiten|seite/.test(context)) {
      return { score, reasons };
    }

    try {
      const current = new URL(locationObject.href);
      const target = new URL(href, current.href);
      const targetNumber = Number(normalizeText(element.textContent));
      const currentNumber = getCurrentPageNumber(current) || getCurrentPageNumberFromDocument(element.ownerDocument) || 1;
      const delta = targetNumber - currentNumber;
      const expected = direction === "next" ? 1 : -1;

      if (Math.sign(delta) === expected) {
        score += Math.abs(delta) === 1 ? 78 : 42;
        reasons.push("pagination-number-direction");
      } else if (delta !== 0) {
        score -= 24;
        reasons.push("pagination-number-opposite");
      }

      if (target.origin === current.origin) {
        score += 12;
        reasons.push("pagination-same-origin");
      }
    } catch (_error) {
      return { score, reasons };
    }

    return { score, reasons };
  }

  function scoreStructureContext(element, context, direction) {
    const reasons = [];
    let score = 0;
    const normalized = normalizeText(context);
    const role = element.getAttribute && element.getAttribute("role");

    if (role === "button" || role === "link") {
      score += 8;
      reasons.push(`role:${role}`);
    }

    STRUCTURE_HINTS.forEach((hint) => {
      if (normalized.includes(hint)) {
        score += 18;
        reasons.push(`context:${hint}`);
      }
    });

    if (element.closest && element.closest("nav, [role='navigation']")) {
      score += 16;
      reasons.push("navigation-region");
    }

    if (direction === "next" && element.closest && element.closest(".page-next, .pagination-next, [class*='page-next']")) {
      if (normalized.includes("page-next") || normalized.includes("pagination-next")) {
        score += 30;
        reasons.push("page-next-region");
      }
    }

    if (direction === "previous" && element.closest && element.closest(".page-prev, .page-previous, .pagination-prev, .pagination-previous, [class*='page-prev'], [class*='page-previous']")) {
      if (normalized.includes("page-prev") || normalized.includes("page-previous") || normalized.includes("pagination-prev") || normalized.includes("pagination-previous")) {
        score += 30;
        reasons.push("page-previous-region");
      }
    }

    return { score, reasons };
  }

  function scoreHref(href, locationObject, direction) {
    const reasons = [];
    let score = 0;

    try {
      const current = new URL(locationObject.href);
      const target = new URL(href, current.href);

      if (target.href === current.href) {
        score -= 50;
        reasons.push("same-url");
      }

      if (target.origin === current.origin) {
        score += 8;
        reasons.push("same-origin");
      } else {
        score -= 30;
        reasons.push("different-origin");
      }

      const pageDelta = comparePageNumbers(current, target);
      if (pageDelta !== 0) {
        const expected = direction === "next" ? 1 : -1;
        if (Math.sign(pageDelta) === expected) {
          score += Math.abs(pageDelta) === 1 ? 35 : 18;
          reasons.push("url-page-direction");
        } else {
          score -= 25;
          reasons.push("url-opposite-page-direction");
        }
      }
    } catch (_error) {
      score -= 5;
      reasons.push("invalid-url");
    }

    return { score, reasons };
  }

  function isLoadMoreControl(text, context) {
    return /\bmehr\s+laden\b|\bload\s+more\b|\bshow\s+more\b/.test(`${text} ${context}`);
  }

  function isPaginationOrLoadMore(text, context) {
    const combined = `${text} ${context}`;
    return /pagination|pager|page-next|page-prev|page-previous|\bmehr\s+laden\b|\bload\s+more\b|\bshow\s+more\b/.test(combined);
  }

  function isUtilityChromeControl(element, text, context) {
    if (!element.closest || isPaginationOrLoadMore(text, context)) {
      return false;
    }

    const combined = `${text} ${context}`;
    const hasUtilityText = /\b(login|sign in|join|edit page|page source|related|history|discussion|to do|follow|facebook|twitter|share|social|random trope|random media|go ad free|search|account|profile)\b|\bmore\b/.test(combined);
    if (!hasUtilityText) {
      return false;
    }

    return Boolean(element.closest("header, [role='banner'], aside, [role='complementary'], [role='menu'], [role='menubar'], [class*='top'], [class*='navbar'], [class*='nav-bar'], [class*='menu'], [class*='toolbar'], [class*='social'], [id*='social'], [class*='account'], [id*='account'], [class*='sidebar'], [id*='sidebar']"));
  }

  function isDirectionalContentLink(source, href, text, context, scoreParts) {
    if (source === "rel" || !href) {
      return false;
    }

    const hasDirectionalText = scoreParts.some((reason) => reason.startsWith("text:") || reason.startsWith("opposite-text:"));
    if (!hasDirectionalText) {
      return false;
    }

    if (isPaginationOrLoadMore(text, context)) {
      return false;
    }

    const hasNavigationContext = scoreParts.some((reason) =>
      reason === "navigation-region" ||
      reason.startsWith("context:") ||
      reason.includes("page-next") ||
      reason.includes("page-previous") ||
      reason.includes("url-page-direction") ||
      reason.includes("pagination-number-direction")
    );

    return !hasNavigationContext;
  }

  function isInsideDocumentTail(element) {
    return Boolean(element.closest && element.closest("footer, [role='contentinfo'], [class*='footer'], [id*='footer'], [class*='newsletter'], [id*='newsletter'], [class*='partner'], [id*='partner'], [class*='banner'], [id*='banner']"));
  }

  function isOutboundHref(href, locationObject) {
    if (!href) {
      return false;
    }

    try {
      return new URL(href, locationObject.href).origin !== new URL(locationObject.href).origin;
    } catch (_error) {
      return false;
    }
  }

  function buildUrlPatternCandidate(documentObject, locationObject, direction) {
    try {
      const current = new URL(locationObject.href);
      const target = new URL(current.href);
      const params = Array.from(target.searchParams.entries());
      const pageParam = params.find(([key, value]) => /^(p|page|paged|start)$/i.test(key) && /^\d+$/.test(value));
      const totalPages = getTotalPageCount(documentObject);

      if (pageParam) {
        const [key, value] = pageParam;
        const currentNumber = Number(value);
        const nextNumber = direction === "next" ? currentNumber + 1 : currentNumber - 1;
        if (nextNumber >= 1 && (!totalPages || nextNumber <= totalPages)) {
          target.searchParams.set(key, String(nextNumber));
          return makeUrlCandidate(direction, target.href, totalPages ? "query-page-pattern-with-total" : "query-page-pattern", totalPages ? 104 : 82);
        }
      }

      const pathMatch = target.pathname.match(/^(.*?\/)(page|p)\/(\d+)\/?$/i);
      if (pathMatch) {
        const currentNumber = Number(pathMatch[3]);
        const nextNumber = direction === "next" ? currentNumber + 1 : currentNumber - 1;
        if (nextNumber >= 1 && (!totalPages || nextNumber <= totalPages)) {
          target.pathname = `${pathMatch[1]}${pathMatch[2]}/${nextNumber}/`;
          return makeUrlCandidate(direction, target.href, totalPages ? "path-page-pattern-with-total" : "path-page-pattern", totalPages ? 104 : 82);
        }
      }
    } catch (_error) {
      return null;
    }

    return null;
  }

  function makeUrlCandidate(direction, href, reason, score) {
    return {
      direction,
      source: "url-pattern",
      type: "url",
      score,
      confidence: classifyConfidence(score),
      href,
      text: "",
      selector: "",
      reason: [reason],
      preflight: {
        visible: true,
        area: 0,
        enabled: true,
        hasHref: true,
        jsOnly: false
      }
    };
  }

  function getTotalPageCount(documentObject) {
    if (!documentObject || !documentObject.body) {
      return 0;
    }

    const text = documentObject.body.textContent || "";
    const totalMatch = text.match(/\b\d+\s+(?:von|of)\s+(\d+)\b/i);
    if (!totalMatch) {
      return 0;
    }

    const total = Number(totalMatch[1]);
    return Number.isFinite(total) ? total : 0;
  }

  function comparePageNumbers(current, target) {
    const currentNumbers = extractUrlNumbers(current);
    const targetNumbers = extractUrlNumbers(target);

    for (const key of Object.keys(targetNumbers)) {
      if (Object.prototype.hasOwnProperty.call(currentNumbers, key)) {
        const delta = targetNumbers[key] - currentNumbers[key];
        if (delta !== 0 && Math.abs(delta) <= 10) {
          return delta;
        }
      }
    }

    return 0;
  }

  function getCurrentPageNumber(url) {
    const numbers = extractUrlNumbers(url);
    const values = Object.values(numbers);
    return values.length ? values[0] : 0;
  }

  function getCurrentPageNumberFromDocument(documentObject) {
    if (!documentObject) {
      return 0;
    }

    const currentElement = documentObject.querySelector(".current, .active, [aria-current='page']");
    const currentText = currentElement ? normalizeText(currentElement.textContent) : "";
    if (/^\d+$/.test(currentText)) {
      return Number(currentText);
    }

    return 0;
  }

  function extractUrlNumbers(url) {
    const numbers = {};

    url.searchParams.forEach((value, key) => {
      if (/^(p|page|paged|start)$/i.test(key) && /^\d+$/.test(value)) {
        numbers[`query:${key.toLowerCase()}`] = Number(value);
      }
    });

    const pathMatch = url.pathname.match(/\/(?:page|p)\/(\d+)\/?$/i);
    if (pathMatch) {
      numbers["path:page"] = Number(pathMatch[1]);
    }

    return numbers;
  }

  function getVisibility(element) {
    if (!element || !element.ownerDocument || !element.ownerDocument.defaultView) {
      return { visible: false, area: 0 };
    }

    if (element.tagName && element.tagName.toLowerCase() === "link") {
      return { visible: true, area: 1000 };
    }

    const win = element.ownerDocument.defaultView;
    const style = win.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);

    const opacity = style.opacity === "" ? 1 : Number(style.opacity);

    return {
      visible: style.display !== "none" && style.visibility !== "hidden" && opacity !== 0 && area > 0,
      area
    };
  }

  function isDisabled(element) {
    return Boolean(
      element.disabled ||
      element.getAttribute("aria-disabled") === "true" ||
      element.getAttribute("disabled") !== null ||
      element.classList && element.classList.contains("disabled") ||
      element.closest && element.closest(".disabled, [aria-disabled='true'], [disabled]")
    );
  }

  function isInsideUnrelatedControl(element) {
    return Boolean(element.closest && element.closest("form, [role='menu'], [role='menubar'], [role='tablist'], aside, [role='complementary'], .ad, .ads, [class*='advert'], [id*='advert'], [class*='filter'], [id*='filter'], [class*='sort'], [id*='sort']"));
  }

  function classifyConfidence(score) {
    if (score >= STRONG_THRESHOLD) {
      return "strong";
    }

    if (score >= TENTATIVE_THRESHOLD) {
      return "tentative";
    }

    return "none";
  }

  function getReadinessState(directions) {
    const confidences = [directions.next.confidence, directions.previous.confidence];
    if (confidences.includes("strong")) {
      return "happy";
    }

    if (confidences.includes("tentative")) {
      return "tentative";
    }

    return "none";
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasTokenOrSymbol(text, phrase) {
    if (phrase.length <= 2 || /[←→‹›«»<>]/.test(phrase)) {
      return text.includes(phrase);
    }

    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}([^a-z0-9]|$)`, "i").test(text);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getSelector(element) {
    if (!element || !element.tagName) {
      return "";
    }

    if (element.id) {
      return `#${cssEscape(element.id)}`;
    }

    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && parts.length < 4) {
      let part = current.tagName.toLowerCase();
      if (current.classList && current.classList.length) {
        part += `.${Array.from(current.classList).slice(0, 2).map(cssEscape).join(".")}`;
      }
      if (!current.id && current.parentElement) {
        const sameTagSiblings = Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName);
        if (sameTagSiblings.length > 1) {
          part += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
        }
      }
      parts.unshift(part);
      current = current.parentElement;
    }

    return parts.join(" > ");
  }

  function cssEscape(value) {
    if (globalScope.CSS && typeof globalScope.CSS.escape === "function") {
      return globalScope.CSS.escape(value);
    }

    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  const api = {
    analyzeNavigation,
    classifyConfidence,
    constants: {
      STRONG_THRESHOLD,
      TENTATIVE_THRESHOLD
    }
  };

  globalScope.HappyNavigationScoring = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
