(function attachHappyNavigationOutcome(globalScope) {
  const FAILED_SELECTOR_TTL_MS = 5000;
  const OUTCOME_OBSERVE_DELAY_MS = 650;
  const BODY_TEXT_ADVANCE_THRESHOLD = 120;

  function capturePageSnapshot(documentRef, locationRef) {
    const documentObject = documentRef || globalScope.document;
    const locationObject = locationRef || globalScope.location;
    const active = documentObject.activeElement;

    return {
      href: locationObject.href,
      title: documentObject.title,
      bodyTextLength: documentObject.body ? documentObject.body.innerText.length : 0,
      activeElementSignature: active
        ? `${active.tagName}:${active.id}:${active.className}:${active.getAttribute("aria-current") || ""}`
        : ""
    };
  }

  function pageAdvanced(before, after) {
    if (!before || !after) {
      return false;
    }

    return (
      before.href !== after.href ||
      before.title !== after.title ||
      Math.abs(before.bodyTextLength - after.bodyTextLength) > BODY_TEXT_ADVANCE_THRESHOLD ||
      before.activeElementSignature !== after.activeElementSignature
    );
  }

  function isVisibleActionableLoadMore(documentRef, selector) {
    const documentObject = documentRef || globalScope.document;
    const element = selector ? documentObject.querySelector(selector) : null;
    if (!element || !element.isConnected) {
      return false;
    }

    const text = String(element.innerText || element.textContent || "").trim().toLowerCase();
    if (text !== "mehr laden" && text !== "load more" && text !== "show more") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const view = documentObject.defaultView || globalScope;
    const getComputedStyle = view.getComputedStyle || globalScope.getComputedStyle;
    if (!getComputedStyle) {
      return false;
    }
    const style = getComputedStyle(element);
    const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    const disabled = element.disabled || element.getAttribute("disabled") !== null || element.getAttribute("aria-disabled") === "true" || element.closest(".disabled, [aria-disabled='true'], [disabled]");

    return visible && !disabled;
  }

  function createOutcomeMemory(options = {}) {
    const documentRef = options.document || globalScope.document;
    const locationRef = options.location || globalScope.location;
    const failedSelectors = new Map();
    let preNavigationSnapshot = null;

    function rememberFailedCandidate(candidate) {
      if (!candidate || !candidate.selector) {
        return;
      }

      failedSelectors.set(candidate.selector, {
        text: candidate.text || "",
        failedAt: Date.now()
      });
    }

    function getExcludedSelectors() {
      return Array.from(failedSelectors.entries())
        .filter(([_selector, failure]) => Date.now() - failure.failedAt < FAILED_SELECTOR_TTL_MS)
        .map(([selector]) => selector);
    }

    function pruneFailedSelectors() {
      const now = Date.now();
      failedSelectors.forEach((failure, selector) => {
        if (now - failure.failedAt > FAILED_SELECTOR_TTL_MS || isVisibleActionableLoadMore(documentRef, selector)) {
          failedSelectors.delete(selector);
        }
      });
    }

    function setPreNavigationSnapshot(snapshot) {
      preNavigationSnapshot = snapshot;
    }

    function getPreNavigationSnapshot() {
      return preNavigationSnapshot;
    }

    function observeNavigationOutcome(params) {
      const {
        direction,
        source,
        candidate,
        onFailedClick,
        onComplete,
        debug = false,
        delayMs = OUTCOME_OBSERVE_DELAY_MS
      } = params;

      globalScope.setTimeout(() => {
        const after = capturePageSnapshot(documentRef, locationRef);
        const before = preNavigationSnapshot;
        const advanced = pageAdvanced(before, after);

        if (debug) {
          console.debug("[Happy Browser] navigation outcome", {
            direction,
            source,
            candidate,
            advanced,
            before,
            after
          });
        }

        if (!advanced && candidate && candidate.selector && candidate.type === "click") {
          rememberFailedCandidate(candidate);
          if (typeof onFailedClick === "function") {
            onFailedClick(candidate);
          }
        }

        if (typeof onComplete === "function") {
          onComplete({ advanced, before, after });
        }
      }, delayMs);
    }

    return {
      rememberFailedCandidate,
      getExcludedSelectors,
      pruneFailedSelectors,
      setPreNavigationSnapshot,
      getPreNavigationSnapshot,
      observeNavigationOutcome
    };
  }

  const api = {
    capturePageSnapshot,
    pageAdvanced,
    isVisibleActionableLoadMore,
    createOutcomeMemory,
    constants: {
      FAILED_SELECTOR_TTL_MS,
      OUTCOME_OBSERVE_DELAY_MS,
      BODY_TEXT_ADVANCE_THRESHOLD
    }
  };

  globalScope.HappyNavigationOutcome = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
