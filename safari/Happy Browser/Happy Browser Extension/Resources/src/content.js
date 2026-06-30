(function initializeHappyBrowser() {
  if (window.top !== window || window.__happyBrowserLoaded) {
    return;
  }

  window.__happyBrowserLoaded = true;

  const scoring = window.HappyNavigationScoring;
  const outcomeApi = window.HappyNavigationOutcome;
  const railApi = window.HappyNavigationRail;

  const state = {
    analysis: null,
    loadedAt: Date.now(),
    gestureDelta: 0,
    lastGestureAt: 0,
    lastNavigateAt: 0,
    debug: false,
    railEnabled: true,
    happyEnabled: true,
    observerTimer: null
  };

  const outcome = outcomeApi.createOutcomeMemory({ document, location: window.location });

  const rail = railApi.createNavigationRail({
    document,
    versionLabel: getExtensionVersionLabel(),
    onNavigate: (direction, source) => navigate(direction, source),
    onToggleHappy: () => toggleHappyEnabled()
  });

  loadSettings();
  rail.createRail();
  rail.setRailState("scanning", "Scanning");
  scheduleAnalyze(80);
  installListeners();
  installRailWatchdog();

  function getExtensionVersionLabel() {
    try {
      const manifest = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
      if (manifest && manifest.version) {
        return `v${manifest.version}`;
      }
    } catch (error) {
      // Safari can be conservative about extension APIs during early injection.
    }
    return "v0.2.5";
  }

  function loadSettings() {
    if (!chrome.storage || !chrome.storage.sync) {
      return;
    }

    chrome.storage.sync.get({ debug: false, railEnabled: true, happyEnabled: true }, (settings) => {
      state.debug = Boolean(settings.debug);
      state.railEnabled = Boolean(settings.railEnabled);
      state.happyEnabled = Boolean(settings.happyEnabled);
      rail.setHappyEnabled(state.happyEnabled);
      rail.setDebug(state.debug);
      rail.setRailEnabled(state.railEnabled);
    });
  }

  function installListeners() {
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousemove", rail.onMouseActivity, true);
    document.addEventListener("pointermove", rail.onMouseActivity, true);
    document.addEventListener("wheel", onWheel, { passive: true, capture: true });
    document.addEventListener("click", () => scheduleAnalyze(320), true);
    document.addEventListener("scroll", () => scheduleAnalyze(120), true);
    window.addEventListener("popstate", () => scheduleAnalyze(120));
    window.addEventListener("hashchange", () => scheduleAnalyze(120));

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync") {
          return;
        }

        if (changes.debug) {
          state.debug = Boolean(changes.debug.newValue);
          rail.setDebug(state.debug);
          updateInspector();
        }

        if (changes.happyEnabled) {
          state.happyEnabled = Boolean(changes.happyEnabled.newValue);
          rail.setHappyEnabled(state.happyEnabled);
        }

        if (changes.railEnabled) {
          state.railEnabled = Boolean(changes.railEnabled.newValue);
          rail.setRailEnabled(state.railEnabled);
        }
      });
    }

    const observer = new MutationObserver(() => {
      ensureRailAttached();
      clearTimeout(state.observerTimer);
      state.observerTimer = setTimeout(() => scheduleAnalyze(0), 400);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    rail.wakeRail();
  }

  function installRailWatchdog() {
    window.setInterval(() => {
      ensureRailAttached();
      rail.setRailEnabled(state.railEnabled);
    }, 700);
  }

  function ensureRailAttached() {
    rail.ensureAttached();
    if (state.analysis) {
      const visualState = getVisualState();
      rail.setRailState(visualState, getVisualStateLabel(visualState));
    }
  }

  function toggleHappyEnabled() {
    setHappyEnabled(!state.happyEnabled);
  }

  function setHappyEnabled(enabled) {
    state.happyEnabled = Boolean(enabled);
    rail.setHappyEnabled(state.happyEnabled);

    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ happyEnabled: state.happyEnabled });
    }

    if (state.happyEnabled) {
      announce("Happy on");
      scheduleAnalyze(0);
    }
  }

  function onKeyDown(event) {
    if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      event.stopPropagation();
      toggleHappyEnabled();
      return;
    }

    if (!state.happyEnabled) {
      return;
    }

    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    if (!isSafeKeyboardContext(event.target)) {
      return;
    }

    const direction = event.key === "ArrowRight" ? "next" : "previous";
    event.preventDefault();
    event.stopPropagation();
    navigate(direction, "keyboard");
  }

  function onWheel(event) {
    if (!state.happyEnabled) {
      return;
    }

    const now = Date.now();
    if (now - state.loadedAt < 1800 || now - state.lastGestureAt < 900 || isNaturallyHorizontallyScrollable(event.target, event.deltaX)) {
      state.gestureDelta = 0;
      return;
    }

    const horizontal = Math.abs(event.deltaX);
    const vertical = Math.abs(event.deltaY);
    if (horizontal < 14 || horizontal < vertical * 1.25) {
      state.gestureDelta = 0;
      return;
    }

    state.gestureDelta += event.deltaX;
    if (Math.abs(state.gestureDelta) >= 180) {
      const direction = state.gestureDelta > 0 ? "next" : "previous";
      state.gestureDelta = 0;
      state.lastGestureAt = now;
      navigate(direction, "gesture");
    }
  }

  function scheduleAnalyze(delay) {
    window.setTimeout(analyze, delay);
  }

  function analyze() {
    if (!state.happyEnabled) {
      return;
    }

    if (!scoring) {
      rail.setRailState("none", "Unavailable");
      return;
    }

    outcome.pruneFailedSelectors();
    state.analysis = scoring.analyzeNavigation(document, {
      location: window.location,
      excludedSelectors: outcome.getExcludedSelectors()
    });
    const visualState = getVisualState();
    const label = getVisualStateLabel(visualState);
    rail.setRailState(visualState, label);
    updateInspector();

    if (state.debug) {
      console.debug("[Happy Browser] analysis", state.analysis);
    }
  }

  function navigate(direction, source) {
    if (!state.happyEnabled) {
      return;
    }

    const now = Date.now();
    if (now - state.lastNavigateAt < 350) {
      return;
    }
    state.lastNavigateAt = now;

    if (!state.analysis) {
      analyze();
    }

    const result = state.analysis && state.analysis.directions[direction];
    const candidate = result && result.best;
    outcome.setPreNavigationSnapshot(outcomeApi.capturePageSnapshot(document, window.location));

    if (candidate && candidate.confidence !== "none") {
      announce(`Going ${direction}`);
      performCandidate(candidate);
      observeNavigationOutcome(direction, source, candidate);
      return;
    }

    if (canScrollPage(direction)) {
      announce(direction === "next" ? "Scrolling" : "Scrolling back");
      scrollPage(direction);
      observeNavigationOutcome(direction, source, { type: "scroll", source: "page-scroll" });
      return;
    }

    if (direction === "next") {
      announce("End reached");
      return;
    }

    announce(`History ${direction}`);
    if (direction === "previous") {
      history.back();
    } else {
      history.forward();
    }
  }

  function performCandidate(candidate) {
    if (candidate.type === "url" && candidate.href) {
      window.location.href = candidate.href;
      return;
    }

    const element = candidate.selector ? document.querySelector(candidate.selector) : null;
    if (element) {
      element.click();
      return;
    }

    if (candidate.href) {
      window.location.href = candidate.href;
    }
  }

  function observeNavigationOutcome(direction, source, candidate) {
    outcome.observeNavigationOutcome({
      direction,
      source,
      candidate,
      debug: state.debug,
      onFailedClick: () => announce("Noted"),
      onComplete: () => scheduleAnalyze(40)
    });
  }

  function announce(label) {
    const visualState = state.analysis ? getVisualState() : "scanning";
    rail.setRailState(visualState, label);
  }

  function getStateLabel(nextState) {
    if (nextState === "happy") {
      return "Reliable target";
    }

    if (nextState === "tentative") {
      return "Tentative target";
    }

    if (nextState === "scroll") {
      return "Scroll fallback";
    }

    return "No reliable target";
  }

  function getVisualState() {
    if (!state.analysis || state.analysis.state !== "none") {
      return state.analysis ? state.analysis.state : "scanning";
    }

    if (canScrollPage("next") || canScrollPage("previous")) {
      return canScrollPage("next") ? "scroll" : "end";
    }

    return "end";
  }

  function getVisualStateLabel(visualState) {
    if (visualState === "end") {
      return "End reached";
    }

    return getStateLabel(visualState);
  }

  function updateInspector() {
    if (!state.debug) {
      return;
    }

    const analysis = state.analysis;
    const next = analysis && analysis.directions.next;
    const previous = analysis && analysis.directions.previous;
    const visualState = getVisualState();
    const nextBest = next && next.best;
    const previousBest = previous && previous.best;

    rail.updateInspector(rail.buildInspectorHtml({
      visualStateLabel: getVisualStateLabel(visualState),
      analysisState: analysis ? analysis.state : "scanning",
      nextCandidate: nextBest,
      nextConfidence: next && next.confidence,
      previousCandidate: previousBest,
      previousConfidence: previous && previous.confidence,
      scrollFallbackLabel: formatScrollFallback()
    }));
  }

  function formatScrollFallback() {
    const nextScroll = getBestScrollableTarget("next");
    const previousScroll = getBestScrollableTarget("previous");

    if (nextScroll && previousScroll) {
      return "page can scroll forward and back";
    }

    if (nextScroll) {
      return "page can scroll forward";
    }

    if (previousScroll) {
      return "page can scroll back";
    }

    return "none";
  }

  function canScrollPage(direction) {
    return Boolean(getBestScrollableTarget(direction));
  }

  function scrollPage(direction) {
    const target = getBestScrollableTarget(direction);
    const delta = Math.max(320, Math.round(window.innerHeight * 0.82));
    const top = direction === "next" ? delta : -delta;

    if (!target || target.type === "window") {
      window.scrollBy({
        top,
        left: 0,
        behavior: "smooth"
      });
      return;
    }

    target.element.scrollBy({
      top,
      left: 0,
      behavior: "smooth"
    });
  }

  function getBestScrollableTarget(direction) {
    const targets = getScrollableTargets(direction);
    targets.sort((a, b) => b.score - a.score);
    return targets[0] || null;
  }

  function getScrollableTargets(direction) {
    const targets = [];
    const railHost = rail.getRailHost();
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    if (maxScroll >= window.innerHeight * 0.35 && canScrollRange(scrollTop, maxScroll, direction)) {
      targets.push({
        type: "window",
        score: 100 + visibleAreaScore(window.innerWidth, window.innerHeight)
      });
    }

    document.querySelectorAll("main, [role='main'], section, div, ul, ol").forEach((element) => {
      if (element === railHost || railHost && railHost.contains(element)) {
        return;
      }

      const style = window.getComputedStyle(element);
      const overflowY = `${style.overflowY} ${style.overflow}`;
      const canOverflow = /(auto|scroll|overlay)/.test(overflowY);
      const maxElementScroll = element.scrollHeight - element.clientHeight;

      if (!canOverflow || maxElementScroll < 160 || !canScrollRange(element.scrollTop, maxElementScroll, direction)) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;

      if (visibleArea < 12000) {
        return;
      }

      targets.push({
        type: "element",
        element,
        score: visibleAreaScore(visibleWidth, visibleHeight) + Math.min(80, maxElementScroll / 20)
      });
    });

    return targets;
  }

  function canScrollRange(scrollTop, maxScroll, direction) {
    if (direction === "next") {
      return scrollTop < maxScroll - 24;
    }

    return scrollTop > 24;
  }

  function visibleAreaScore(width, height) {
    return Math.min(160, (width * height) / 5000);
  }

  function isSafeKeyboardContext(target) {
    const element = target && target.nodeType === Node.ELEMENT_NODE ? target : document.activeElement;
    if (!element) {
      return true;
    }

    if (element.isContentEditable) {
      return false;
    }

    const unsafeSelector = [
      "input",
      "textarea",
      "select",
      "option",
      "video",
      "audio",
      "[contenteditable='true']",
      "[role='textbox']",
      "[role='searchbox']",
      "[role='slider']",
      "[role='spinbutton']",
      "[role='combobox']",
      "[role='listbox']",
      "[role='tablist']",
      "[role='menu']",
      "[role='menubar']"
    ].join(",");

    return !element.closest(unsafeSelector);
  }

  function isNaturallyHorizontallyScrollable(target, deltaX) {
    let element = target && target.nodeType === Node.ELEMENT_NODE ? target : null;

    while (element && element !== document.body && element !== document.documentElement) {
      const style = window.getComputedStyle(element);
      const canScroll = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2;
      if (canScroll) {
        if (deltaX > 0 && element.scrollLeft < element.scrollWidth - element.clientWidth - 2) {
          return true;
        }
        if (deltaX < 0 && element.scrollLeft > 2) {
          return true;
        }
      }
      element = element.parentElement;
    }

    return false;
  }
})();
