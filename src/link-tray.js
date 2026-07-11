// Happy Browser — Link Tray module.
// Extracted from content.js (single source of truth: src/). Loaded as its own
// content script before content.js; registers window.HappyBrowser.registerLinkTray(ctx),
// which the core calls with its shared state and helpers and gets back the public API.
(function () {
  "use strict";
  const HB = (window.HappyBrowser = window.HappyBrowser || {});
  HB.registerLinkTray = function registerLinkTray(ctx) {
    const {
      state,
      announce,
      updateInspector,
      escapeHtml,
      getCompactText,
      LINK_TRAY_STORAGE_KEY,
      LINK_TRAY_MAX_ITEMS,
      LINK_TRAY_DRAG_MIME
    } = ctx;

  function loadLinkTray() {
    const localStorageArea = chrome.storage && chrome.storage.local;
    if (!localStorageArea || typeof localStorageArea.get !== "function") {
      state.linkTray = [];
      applyLinkTrayState();
      return;
    }

    localStorageArea.get({ [LINK_TRAY_STORAGE_KEY]: [] }, (settings) => {
      const tray = settings && Array.isArray(settings[LINK_TRAY_STORAGE_KEY]) ? settings[LINK_TRAY_STORAGE_KEY] : [];
      state.linkTray = tray.map(normalizeLinkTrayItem).filter(Boolean).slice(0, LINK_TRAY_MAX_ITEMS);
      applyLinkTrayState();
      updateInspector();
    });
  }

  function makeLinkTray() {
    const tray = document.createElement("section");
    tray.className = "happy-browser-link-tray";
    tray.setAttribute("aria-label", "Tray");
    tray.innerHTML = [
      '<div class="happy-browser-link-tray__header">',
      '<h2 class="happy-browser-link-tray__title">Tray</h2>',
      '<div class="happy-browser-link-tray__tools">',
      '<button type="button" class="happy-browser-link-tray__capture" aria-label="Photograph page element" title="Photograph page element">+</button>',
      '<button type="button" class="happy-browser-link-tray__clear" aria-label="Clear tray" title="Clear tray">x</button>',
      '</div>',
      '</div>',
      '<div class="happy-browser-link-tray__list"></div>'
    ].join("");

    const capture = tray.querySelector(".happy-browser-link-tray__capture");
    if (capture) {
      capture.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleLinkTrayCapture();
      });
    }
    const clear = tray.querySelector(".happy-browser-link-tray__clear");
    if (clear) {
      clear.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearLinkTray();
      });
    }
    tray.addEventListener("dragenter", onLinkTrayDragEnter);
    tray.addEventListener("dragover", onLinkTrayDragOver);
    tray.addEventListener("dragleave", onLinkTrayDragLeave);
    tray.addEventListener("drop", onLinkTrayDrop);
    return tray;
  }

  function onPageDragStart(event) {
    const target = event.target && event.target.nodeType === Node.ELEMENT_NODE ? event.target : null;
    const anchor = target && target.closest ? target.closest("a[href]") : null;
    if (!anchor || state.railHost && state.railHost.contains(anchor)) {
      return;
    }

    const item = getLinkTrayItemFromAnchor(anchor);
    if (!item) {
      return;
    }

    state.linkTrayDragItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copyLink";
      try {
        event.dataTransfer.setData(LINK_TRAY_DRAG_MIME, JSON.stringify(item));
        event.dataTransfer.setData("text/uri-list", item.href);
        event.dataTransfer.setData("text/plain", item.href);
      } catch (_error) {
        // Some browsers limit custom drag payloads; the in-memory item still covers same-page drops.
      }
    }
  }

  function onPageDragEnd() {
    state.linkTrayDragItem = null;
    setLinkTrayActive(false);
  }

  function onLinkTrayDragEnter(event) {
    if (!canAcceptLinkTrayDrop(event)) {
      return;
    }

    event.preventDefault();
    setLinkTrayActive(true);
  }

  function onLinkTrayDragOver(event) {
    if (!canAcceptLinkTrayDrop(event)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setLinkTrayActive(true);
  }

  function onLinkTrayDragLeave(event) {
    if (event.currentTarget && event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setLinkTrayActive(false);
  }

  function onLinkTrayDrop(event) {
    if (!canAcceptLinkTrayDrop(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setLinkTrayActive(false);
    const item = getLinkTrayDropItem(event);
    state.linkTrayDragItem = null;
    if (!item) {
      announce("No link found");
      return;
    }

    queueLinkTrayItem(item);
  }

  function toggleLinkTrayCapture() {
    setLinkTrayCaptureArmed(!state.linkTrayCaptureArmed);
    announce(state.linkTrayCaptureArmed ? "Click to photograph" : "Photograph off");
  }

  function setLinkTrayCaptureArmed(armed) {
    state.linkTrayCaptureArmed = Boolean(armed);
    if (state.rail) {
      state.rail.dataset.linkTrayCapture = String(state.linkTrayCaptureArmed);
    }
    setLinkTrayActive(state.linkTrayCaptureArmed);
  }

  function onLinkTrayCaptureClick(event) {
    if (!state.linkTrayCaptureArmed) {
      return;
    }

    const target = event.target && event.target.nodeType === Node.ELEMENT_NODE ? event.target : null;
    if (!target || state.railHost && state.railHost.contains(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setLinkTrayCaptureArmed(false);

    const item = getLinkTrayItemFromElement(target);
    if (!item) {
      announce("Nothing to photograph");
      return;
    }

    queueLinkTrayItem(item);
  }

  function canAcceptLinkTrayDrop(event) {
    if (state.linkTrayDragItem) {
      return true;
    }

    const types = event.dataTransfer && event.dataTransfer.types ? Array.from(event.dataTransfer.types) : [];
    return types.includes(LINK_TRAY_DRAG_MIME) || types.includes("text/uri-list") || types.includes("text/plain");
  }

  function getLinkTrayDropItem(event) {
    const fromDrag = readLinkTrayDragPayload(event);
    if (fromDrag) {
      return fromDrag;
    }

    if (state.linkTrayDragItem) {
      return state.linkTrayDragItem;
    }

    const href = readDroppedHref(event);
    if (!href) {
      return null;
    }

    const anchor = findAnchorByHref(href);
    return anchor ? getLinkTrayItemFromAnchor(anchor) : makeLinkTrayFallbackItem(href);
  }

  function readLinkTrayDragPayload(event) {
    if (!event.dataTransfer || typeof event.dataTransfer.getData !== "function") {
      return null;
    }

    try {
      const raw = event.dataTransfer.getData(LINK_TRAY_DRAG_MIME);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return parsed && parsed.href ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function readDroppedHref(event) {
    if (!event.dataTransfer || typeof event.dataTransfer.getData !== "function") {
      return "";
    }

    const uriList = event.dataTransfer.getData("text/uri-list");
    const uri = String(uriList || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    const raw = uri || event.dataTransfer.getData("text/plain");
    return normalizeLinkTrayHref(raw);
  }

  function findAnchorByHref(href) {
    const normalized = normalizeLinkTrayHref(href);
    if (!normalized) {
      return null;
    }

    return Array.from(document.querySelectorAll("a[href]"))
      .find((anchor) => normalizeLinkTrayHref(anchor.getAttribute("href")) === normalized) || null;
  }

  function queueLinkTrayItem(input) {
    const item = input && input.nodeType === Node.ELEMENT_NODE
      ? getLinkTrayItemFromAnchor(input)
      : normalizeLinkTrayItem(input);
    if (!item) {
      return Promise.resolve(null);
    }

    state.linkTray = [
      item,
      ...state.linkTray.filter((queued) => queued.key !== item.key)
    ].slice(0, LINK_TRAY_MAX_ITEMS);
    applyLinkTrayState();
    updateInspector();

    return persistLinkTray().then(() => {
      announce(`Tray ${state.linkTray.length}/${LINK_TRAY_MAX_ITEMS}`);
      return item;
    });
  }

  function clearLinkTray() {
    if (!state.linkTray.length) {
      return Promise.resolve([]);
    }

    state.linkTray = [];
    applyLinkTrayState();
    updateInspector();

    return persistLinkTray().then(() => {
      announce("Tray cleared");
      return state.linkTray;
    });
  }

  function persistLinkTray() {
    const localStorageArea = chrome.storage && chrome.storage.local;
    if (!localStorageArea || typeof localStorageArea.set !== "function") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      localStorageArea.set({ [LINK_TRAY_STORAGE_KEY]: state.linkTray }, resolve);
    });
  }

  function applyLinkTrayState() {
    if (!state.rail) {
      return;
    }

    state.rail.dataset.linkTrayCount = String(state.linkTray.length);
    const list = state.rail.querySelector(".happy-browser-link-tray__list");
    if (!list) {
      return;
    }

    list.textContent = "";
    if (!state.linkTray.length) {
      const empty = document.createElement("div");
      empty.className = "happy-browser-link-tray__empty";
      empty.textContent = "Drop links";
      list.appendChild(empty);
      return;
    }

    state.linkTray.forEach((item) => {
      list.appendChild(renderLinkTrayEntry(item));
    });
  }

  function renderLinkTrayEntry(item) {
    const entry = document.createElement("div");
    entry.className = "happy-browser-link-tray__item";
    entry.dataset.review = String(item.review === "pending");
    entry.setAttribute("role", item.type === "dom" ? "button" : "link");
    entry.setAttribute("tabindex", "0");
    entry.setAttribute("aria-label", item.title ? `Open ${item.title}` : "Open tray item");
    entry.setAttribute("title", item.href || item.selector || item.key);
    entry.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openLinkTrayItem(item, event);
    });
    entry.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openLinkTrayItem(item, event);
    });

    const preview = document.createElement("div");
    preview.className = "happy-browser-link-tray__preview";
    if (item.snapshotHtml) {
      preview.innerHTML = item.snapshotHtml;
    } else {
      preview.innerHTML = renderLinkTrayFallback(item);
    }
    entry.appendChild(preview);

    if (item.review === "pending") {
      entry.appendChild(renderLinkTrayReview(item));
    }
    return entry;
  }

  function renderLinkTrayReview(item) {
    const review = document.createElement("div");
    review.className = "happy-browser-link-tray__review";

    const status = document.createElement("div");
    status.className = "happy-browser-link-tray__review-status";
    status.textContent = item.selfTest && item.selfTest.passed ? "Self-test passed" : `Self-test: ${item.selfTest && item.selfTest.label || "needs review"}`;

    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "happy-browser-link-tray__accept";
    accept.textContent = "✓";
    accept.setAttribute("aria-label", "Accept photographed item");
    accept.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      acceptLinkTrayItem(item.key);
    });

    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "happy-browser-link-tray__reject";
    reject.textContent = "x";
    reject.setAttribute("aria-label", "Reject photographed item");
    reject.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      rejectLinkTrayItem(item.key);
    });

    review.append(status, accept, reject);
    return review;
  }

  function openLinkTrayItem(item, event) {
    if (!item || item.review === "pending") {
      return;
    }

    if (item.type === "dom") {
      clickLinkTrayDomItem(item);
      return;
    }

    if (!item.href) {
      return;
    }

    if (event && (event.metaKey || event.ctrlKey)) {
      window.open(item.href, "_blank", "noopener");
      return;
    }

    window.location.href = item.href;
  }

  function acceptLinkTrayItem(key) {
    state.linkTray = state.linkTray.map((item) => item.key === key ? {
      ...item,
      review: "accepted"
    } : item);
    applyLinkTrayState();
    updateInspector();
    return persistLinkTray().then(() => announce("Accepted"));
  }

  function rejectLinkTrayItem(key) {
    state.linkTray = state.linkTray.filter((item) => item.key !== key);
    applyLinkTrayState();
    updateInspector();
    return persistLinkTray().then(() => announce("Rejected"));
  }

  function clickLinkTrayDomItem(item) {
    const element = item.selector ? document.querySelector(item.selector) : null;
    if (!element) {
      announce("Target missing");
      return;
    }

    element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  function setLinkTrayActive(active) {
    if (state.rail) {
      state.rail.dataset.linkTrayActive = String(Boolean(active));
    }
  }

  function getLinkTrayItemFromAnchor(anchor) {
    if (!anchor || !anchor.getAttribute) {
      return null;
    }

    const href = normalizeLinkTrayHref(anchor.getAttribute("href"));
    if (!href) {
      return null;
    }

    const context = getLinkTrayContextElement(anchor);
    const title = getLinkTrayTitle(anchor, context);
    const snippet = getLinkTraySnippet(anchor, context);

    return normalizeLinkTrayItem({
      type: "link",
      href,
      sourceUrl: window.location.href,
      sourceTitle: document.title || "",
      title,
      snippet,
      snapshotHtml: context ? buildLinkTraySnapshotHtml(context, anchor) : "",
      capturedAt: new Date().toISOString()
    });
  }

  function getLinkTrayItemFromElement(element) {
    const target = getLinkTrayActionElement(element);
    if (!target) {
      return null;
    }

    const anchor = target.closest && target.closest("a[href]");
    if (anchor) {
      const linkItem = getLinkTrayItemFromAnchor(anchor);
      if (linkItem) {
        return {
          ...linkItem,
          review: "pending",
          selfTest: selfTestLinkTrayItem(linkItem)
        };
      }
    }

    const selector = getStableElementSelector(target);
    if (!selector) {
      return null;
    }

    const context = getLinkTrayContextElement(target);
    const title = getLinkTrayTitle(target, context);
    const item = normalizeLinkTrayItem({
      type: "dom",
      selector,
      sourceUrl: window.location.href,
      sourceTitle: document.title || "",
      title,
      snippet: getLinkTraySnippet(target, context),
      snapshotHtml: context ? buildLinkTraySnapshotHtml(context, target) : "",
      review: "pending",
      capturedAt: new Date().toISOString()
    });
    if (!item) {
      return null;
    }

    return {
      ...item,
      selfTest: selfTestLinkTrayItem(item)
    };
  }

  function normalizeLinkTrayItem(item) {
    if (!item) {
      return null;
    }

    const type = item.type === "dom" || item.selector && !item.href ? "dom" : "link";
    const href = normalizeLinkTrayHref(item.href || "");
    const selector = String(item.selector || "").trim().slice(0, 420);
    if (type === "link" && !href) {
      return null;
    }
    if (type === "dom" && !selector) {
      return null;
    }

    const sourceUrl = normalizeLinkTrayHref(item.sourceUrl || window.location.href) || window.location.href;
    const title = String(item.title || "").replace(/\s+/g, " ").trim().slice(0, 180) || href || selector;
    const key = String(item.key || (href ? `link:${href}` : `dom:${sourceUrl.split("#")[0]}:${selector}:${title}`)).slice(0, 640);

    return {
      key,
      type,
      href,
      selector,
      action: type === "dom" ? "click" : "open",
      sourceTitle: String(item.sourceTitle || document.title || "").slice(0, 180),
      sourceUrl,
      title,
      snippet: String(item.snippet || "").replace(/\s+/g, " ").trim().slice(0, 260),
      snapshotHtml: String(item.snapshotHtml || "").slice(0, 16000),
      review: item.review === "pending" ? "pending" : item.review === "accepted" ? "accepted" : "",
      selfTest: item.selfTest && typeof item.selfTest === "object" ? {
        passed: Boolean(item.selfTest.passed),
        label: String(item.selfTest.label || "").slice(0, 140)
      } : null,
      capturedAt: item.capturedAt || new Date().toISOString()
    };
  }

  function makeLinkTrayFallbackItem(href) {
    const normalized = normalizeLinkTrayHref(href);
    if (!normalized) {
      return null;
    }

    return normalizeLinkTrayItem({
      type: "link",
      href: normalized,
      sourceUrl: window.location.href,
      sourceTitle: document.title || "",
      title: normalized,
      snippet: "",
      snapshotHtml: "",
      capturedAt: new Date().toISOString()
    });
  }

  function getLinkTrayActionElement(element) {
    if (!element || state.railHost && state.railHost.contains(element)) {
      return null;
    }

    const actionable = element.closest([
      "a[href]",
      "button",
      "summary",
      "input[type='button']",
      "input[type='submit']",
      "input[type='reset']",
      "[role='button']",
      "[role='link']",
      "[tabindex]:not([tabindex='-1'])"
    ].join(","));
    return actionable || element;
  }

  function selfTestLinkTrayItem(item) {
    if (!item) {
      return { passed: false, label: "missing item" };
    }

    if (item.type === "link") {
      return item.href ? { passed: true, label: "link captured" } : { passed: false, label: "missing link" };
    }

    const element = item.selector ? document.querySelector(item.selector) : null;
    if (!element) {
      return { passed: false, label: "target not found" };
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    return visible ? { passed: true, label: "target visible" } : { passed: false, label: "target hidden" };
  }

  function getStableElementSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || element === document.documentElement || element === document.body) {
      return "";
    }

    const testId = element.getAttribute("data-testid") || element.getAttribute("data-test-id") || element.getAttribute("data-pw-test-id");
    if (testId) {
      const selector = `${element.tagName.toLowerCase()}[${testId === element.getAttribute("data-testid") ? "data-testid" : testId === element.getAttribute("data-test-id") ? "data-test-id" : "data-pw-test-id"}="${cssEscape(testId)}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    if (element.id) {
      const selector = `#${cssEscape(element.id)}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    const parts = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && node !== document.documentElement && parts.length < 5) {
      parts.unshift(getElementSelectorPart(node));
      const selector = parts.join(" > ");
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (_error) {
        return "";
      }
      node = node.parentElement;
    }

    return parts.join(" > ");
  }

  function getElementSelectorPart(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const classes = Array.from(element.classList || [])
      .filter((className) => /^[a-z0-9_-]{2,40}$/i.test(className))
      .slice(0, 2)
      .map((className) => `.${cssEscape(className)}`)
      .join("");
    const base = `${tag}${role ? `[role="${cssEscape(role)}"]` : ""}${classes}`;
    const parent = element.parentElement;
    if (!parent) {
      return base;
    }

    const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
    if (siblings.length <= 1) {
      return base;
    }

    return `${base}:nth-of-type(${siblings.indexOf(element) + 1})`;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function normalizeLinkTrayHref(href) {
    try {
      const url = new URL(String(href || "").trim(), window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }
      return url.href;
    } catch (_error) {
      return "";
    }
  }

  function getLinkTrayContextElement(anchor) {
    const preferred = anchor.closest([
      ".Box-row",
      "[data-testid*='pull']",
      "[data-testid*='issue']",
      "[role='listitem']",
      "[role='region']",
      "article",
      "section",
      "form",
      "dialog",
      "li",
      "tr"
    ].join(","));
    if (isLinkTrayContextCandidate(preferred, anchor)) {
      return preferred;
    }

    let element = anchor;
    for (let depth = 0; element && depth < 7; depth += 1) {
      if (isLinkTrayContextCandidate(element, anchor)) {
        return element;
      }
      element = element.parentElement;
    }

    return anchor;
  }

  function isLinkTrayContextCandidate(element, anchor) {
    if (!element || element === document.body || element === document.documentElement) {
      return false;
    }

    if (state.railHost && state.railHost.contains(element)) {
      return false;
    }

    if (anchor && !element.contains(anchor)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const text = getCompactText(element);
    return rect.width >= 80 && rect.height >= 20 && text.length >= 2 && text.length <= 1200;
  }

  function getLinkTrayTitle(anchor, context) {
    const anchorText = getCompactText(anchor);
    if (anchorText) {
      return anchorText;
    }

    const heading = context && context.querySelector && context.querySelector("h1, h2, h3, [role='heading']");
    return getCompactText(heading)
      || anchor.getAttribute("aria-label")
      || anchor.getAttribute("title")
      || anchor.getAttribute("value")
      || anchor.href
      || anchor.tagName.toLowerCase();
  }

  function getLinkTraySnippet(anchor, context) {
    const text = getCompactText(context || anchor);
    const title = getCompactText(anchor);
    if (title && text.startsWith(title)) {
      return text.slice(title.length).trim().slice(0, 260);
    }

    return text.slice(0, 260);
  }

  function buildLinkTraySnapshotHtml(context, anchor) {
    try {
      const clone = context.cloneNode(true);
      prepareLinkTraySnapshotNode(context, clone, anchor, 0);
      const html = clone.outerHTML || "";
      return html.length <= 16000 ? html : renderLinkTrayFallback({
        type: anchor && anchor.matches && anchor.matches("a[href]") ? "link" : "dom",
        href: normalizeLinkTrayHref(anchor.getAttribute("href")),
        selector: getStableElementSelector(anchor),
        title: getLinkTrayTitle(anchor, context),
        snippet: getLinkTraySnippet(anchor, context)
      });
    } catch (_error) {
      return "";
    }
  }

  function prepareLinkTraySnapshotNode(source, clone, anchor, depth) {
    if (!source || !clone || clone.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (shouldRemoveLinkTraySnapshotNode(clone)) {
      clone.remove();
      return;
    }

    sanitizeLinkTraySnapshotAttributes(clone);
    inlineLinkTraySnapshotStyle(source, clone, source === anchor || source.contains(anchor));

    const sourceChildren = Array.from(source.children || []);
    const cloneChildren = Array.from(clone.children || []);
    cloneChildren.forEach((child, index) => {
      if (depth > 7 || index > 24) {
        child.remove();
        return;
      }

      prepareLinkTraySnapshotNode(sourceChildren[index], child, anchor, depth + 1);
    });
  }

  function shouldRemoveLinkTraySnapshotNode(element) {
    return /^(script|style|link|iframe|object|embed|canvas|video|audio|template)$/i.test(element.tagName || "");
  }

  function sanitizeLinkTraySnapshotAttributes(element) {
    Array.from(element.attributes || []).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || ["href", "target", "download", "contenteditable", "tabindex", "id"].includes(name)) {
        element.removeAttribute(attribute.name);
      }
    });
  }

  function inlineLinkTraySnapshotStyle(source, clone, containsAnchor) {
    const computed = window.getComputedStyle(source);
    const color = computed.color && computed.color !== "rgba(0, 0, 0, 0)" ? computed.color : "#24292f";
    const background = computed.backgroundColor && computed.backgroundColor !== "rgba(0, 0, 0, 0)" ? computed.backgroundColor : "transparent";
    const styles = {
      display: safeSnapshotDisplay(computed.display),
      "align-items": computed.alignItems,
      "justify-content": computed.justifyContent,
      gap: computed.gap,
      padding: computed.padding,
      margin: computed.margin,
      color,
      "background-color": background,
      "border-color": computed.borderColor,
      "border-style": computed.borderStyle,
      "border-width": computed.borderWidth,
      "border-radius": computed.borderRadius,
      "font-family": computed.fontFamily,
      "font-size": clampSnapshotFontSize(computed.fontSize),
      "font-weight": computed.fontWeight,
      "line-height": computed.lineHeight,
      "text-decoration": computed.textDecorationLine === "none" ? "none" : computed.textDecoration,
      "white-space": computed.whiteSpace === "nowrap" ? "nowrap" : "normal",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      position: "static",
      transform: "none",
      "box-shadow": "none"
    };

    if (containsAnchor) {
      styles.outline = "0";
    }

    clone.setAttribute("style", Object.entries(styles)
      .filter(([_property, value]) => value && value !== "normal normal normal" && value !== "auto")
      .map(([property, value]) => `${property}: ${value}`)
      .join("; "));
  }

  function safeSnapshotDisplay(display) {
    if (["flex", "inline-flex", "grid", "inline-grid", "block", "inline", "inline-block", "table-row", "table-cell"].includes(display)) {
      return display;
    }

    return "block";
  }

  function clampSnapshotFontSize(fontSize) {
    const value = parseFloat(fontSize);
    if (!Number.isFinite(value)) {
      return fontSize;
    }

    return `${Math.max(10, Math.min(14, value))}px`;
  }

  function renderLinkTrayFallback(item) {
    if (!item) {
      return "";
    }

    const urlLabel = (() => {
      if (item.type === "dom") {
        return item.selector || "page element";
      }

      try {
        const url = new URL(item.href);
        return `${url.hostname}${url.pathname}`;
      } catch (_error) {
        return item.href || item.key;
      }
    })();

    return [
      `<p class="happy-browser-link-tray__fallback-title">${escapeHtml(item.title || item.href)}</p>`,
      item.snippet ? `<p class="happy-browser-link-tray__fallback-snippet">${escapeHtml(item.snippet)}</p>` : "",
      `<p class="happy-browser-link-tray__fallback-url">${escapeHtml(urlLabel)}</p>`
    ].join("");
  }

  function formatLinkTray() {
    return `${state.linkTray.length}/${LINK_TRAY_MAX_ITEMS} link${state.linkTray.length === 1 ? "" : "s"}`;
  }

    return {
      loadLinkTray,
      makeLinkTray,
      formatLinkTray,
      applyLinkTrayState,
      onPageDragStart,
      onPageDragEnd,
      onLinkTrayCaptureClick,
      getLinkTrayItemFromAnchor,
      getLinkTrayItemFromElement,
      queueLinkTrayItem,
      clearLinkTray
    };
  };
})();
