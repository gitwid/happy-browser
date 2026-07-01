(function initializeHappyBrowser() {
  if (window.top !== window || window.__happyBrowserLoaded) {
    return;
  }

  window.__happyBrowserLoaded = true;

  const scoring = window.HappyNavigationScoring;
  const state = {
    analysis: null,
    loadedAt: Date.now(),
    gestureDelta: 0,
    lastGestureAt: 0,
    lastNavigateAt: 0,
    debug: false,
    railEnabled: true,
    happyEnabled: true,
    railHost: null,
    rail: null,
    failedSelectors: new Map(),
    drag: null,
    toggleDrag: null,
    recenterTimer: null,
    railTopPercent: 50,
    toggleX: null,
    toggleY: null,
    statusTimer: null,
    observerTimer: null,
    preNavigationSnapshot: null,
    versionLabel: getExtensionVersionLabel()
  };

  const railCss = `
    #happy-browser-rail {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .happy-browser-button {
      position: fixed;
      top: var(--happy-button-top, 50%);
      width: 64px;
      height: 112px;
      border: 1px solid rgba(255, 255, 255, 0.36);
      border-radius: 8px;
      background: rgba(18, 24, 28, 0.56);
      color: #f8fbff;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.24);
      cursor: pointer;
      font-size: 34px;
      line-height: 1;
      pointer-events: auto;
      transform: translateY(-50%);
      transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
      backdrop-filter: blur(16px);
    }

    .happy-browser-button:hover,
    .happy-browser-button:focus-visible {
      background: rgba(18, 24, 28, 0.86);
      border-color: rgba(255, 255, 255, 0.7);
      outline: none;
    }

    .happy-browser-button:active {
      transform: translateY(-50%) scale(0.98);
    }

    .happy-browser-button[data-direction="previous"] {
      left: 14px;
    }

    .happy-browser-button[data-direction="next"] {
      right: 14px;
    }

    .happy-browser-toggle {
      position: fixed;
      top: var(--happy-toggle-top, 16px);
      right: var(--happy-toggle-right, 16px);
      width: 58px;
      height: 38px;
      border: 1px solid rgba(255, 255, 255, 0.38);
      border-radius: 999px;
      background: rgba(18, 24, 28, 0.38);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 10px 28px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      opacity: 0.72;
      pointer-events: auto;
      transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
      backdrop-filter: blur(16px);
    }

    .happy-browser-toggle::before {
      content: "";
      position: absolute;
      width: 28px;
      height: 28px;
      left: 5px;
      top: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
      transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), background 160ms ease;
    }

    .happy-browser-toggle:hover,
    .happy-browser-toggle:focus-visible {
      opacity: 0.94;
      outline: none;
    }

    .happy-browser-version {
      position: fixed;
      top: calc(var(--happy-toggle-top, 16px) + 42px);
      right: var(--happy-toggle-right, 16px);
      width: 58px;
      color: rgba(248, 251, 255, 0.64);
      font-size: 10px;
      font-weight: 650;
      letter-spacing: 0;
      line-height: 1;
      text-align: center;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.62);
      opacity: 0.56;
      pointer-events: none;
      user-select: none;
    }

    #happy-browser-rail[data-happy-enabled="true"] .happy-browser-toggle {
      background: rgba(20, 68, 54, 0.58);
      border-color: rgba(112, 243, 178, 0.62);
    }

    #happy-browser-rail[data-happy-enabled="true"] .happy-browser-toggle::before {
      transform: translateX(20px);
      background: rgba(112, 243, 178, 0.94);
    }

    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-button,
    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-status,
    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-inspector {
      display: none;
    }

    #happy-browser-rail[data-idle="true"] .happy-browser-button {
      opacity: 0.16;
    }

    #happy-browser-rail[data-idle="true"] .happy-browser-button[data-direction="previous"] {
      transform: translateY(-50%) translateX(-42px);
    }

    #happy-browser-rail[data-idle="true"] .happy-browser-button[data-direction="next"] {
      transform: translateY(-50%) translateX(42px);
    }

    #happy-browser-rail[data-state="none"] .happy-browser-button {
      opacity: 0.28;
    }

    #happy-browser-rail[data-state="scanning"] .happy-browser-button {
      opacity: 0.42;
    }

    #happy-browser-rail[data-state="tentative"] .happy-browser-button {
      border-color: rgba(255, 202, 98, 0.7);
    }

    #happy-browser-rail[data-state="scroll"] .happy-browser-button {
      border-color: rgba(136, 190, 218, 0.72);
      opacity: 0.58;
    }

    #happy-browser-rail[data-state="happy"] .happy-browser-button {
      border-color: rgba(112, 243, 178, 0.74);
    }

    #happy-browser-rail[data-state="end"] .happy-browser-button {
      border-color: rgba(136, 190, 218, 0.72);
      opacity: 0.58;
    }

    .happy-browser-status {
      position: fixed;
      left: 50%;
      bottom: 18px;
      min-width: 112px;
      max-width: min(320px, calc(100vw - 32px));
      padding: 8px 12px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 8px;
      background: rgba(18, 24, 28, 0.72);
      color: #f8fbff;
      font-size: 12px;
      font-weight: 650;
      letter-spacing: 0;
      line-height: 1.2;
      text-align: center;
      opacity: 0;
      pointer-events: none;
      transform: translateX(-50%) translateY(8px);
      transition: opacity 160ms ease, transform 160ms ease;
      backdrop-filter: blur(16px);
    }

    .happy-browser-inspector {
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: min(360px, calc(100vw - 32px));
      max-height: min(420px, calc(100vh - 32px));
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 8px;
      background: rgba(18, 24, 28, 0.82);
      color: #f8fbff;
      font-size: 11px;
      line-height: 1.35;
      opacity: 0;
      overflow: auto;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 160ms ease, transform 160ms ease;
      backdrop-filter: blur(18px);
    }

    #happy-browser-rail[data-debug="true"] .happy-browser-inspector {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .happy-browser-inspector h2 {
      margin: 0 0 8px;
      font-size: 12px;
      line-height: 1.2;
    }

    .happy-browser-inspector dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 8px;
      margin: 0;
    }

    .happy-browser-inspector dt {
      color: rgba(248, 251, 255, 0.62);
      font-weight: 650;
    }

    .happy-browser-inspector dd {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }

    .happy-browser-inspector code {
      color: #b7f7d7;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px;
    }

    #happy-browser-rail[data-show-status="true"] .happy-browser-status {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    @media (max-width: 720px) {
      .happy-browser-button {
        width: 52px;
        height: 88px;
        font-size: 28px;
      }

      .happy-browser-button[data-direction="previous"] {
        left: 8px;
      }

      .happy-browser-button[data-direction="next"] {
        right: 8px;
      }
    }
  `;

  if (window.__happyBrowserTestHooksRequested) {
    window.__HappyBrowserTestHooks = {
      capturePageSnapshot,
      didPageAdvance,
      getVisibleMediaSignature
    };
  }

  loadSettings();
  createRail();
  setRailState("scanning", "Scanning");
  scheduleAnalyze(80);
  installListeners();
  installRailWatchdog();

  function loadSettings() {
    if (!chrome.storage || !chrome.storage.sync) {
      return;
    }

    chrome.storage.sync.get({ debug: false, railEnabled: true, happyEnabled: true }, (settings) => {
      state.debug = Boolean(settings.debug);
      state.railEnabled = Boolean(settings.railEnabled);
      state.happyEnabled = Boolean(settings.happyEnabled);
      applyHappyEnabledState();
      applyDebugState();
      applyRailEnabledState();
    });
  }

  function createRail() {
    if (state.railHost && state.railHost.isConnected && state.rail) {
      return;
    }

    const host = document.createElement("div");
    host.id = "happy-browser-shadow-host";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";
    host.style.display = "block";
    host.style.visibility = "visible";
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("inset", "0", "important");
    host.style.setProperty("z-index", "2147483647", "important");
    host.style.setProperty("pointer-events", "none", "important");
    host.style.setProperty("display", "block", "important");
    host.style.setProperty("visibility", "visible", "important");

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = railCss;

    const rail = document.createElement("div");
    rail.id = "happy-browser-rail";
    rail.dataset.state = "scanning";
    rail.dataset.showStatus = "true";
    rail.dataset.idle = "false";
    rail.dataset.happyEnabled = "true";
    rail.setAttribute("aria-live", "polite");

    const previous = makeRailButton("previous", "‹", "Happy previous");
    const next = makeRailButton("next", "›", "Happy next");
    const toggle = makeToggleButton();
    const version = document.createElement("div");
    version.className = "happy-browser-version";
    version.textContent = state.versionLabel;
    version.setAttribute("aria-hidden", "true");
    const status = document.createElement("div");
    status.className = "happy-browser-status";
    status.textContent = "Scanning";
    const inspector = document.createElement("section");
    inspector.className = "happy-browser-inspector";
    inspector.setAttribute("aria-label", "Happy Browser local inspection");
    inspector.innerHTML = "<h2>Local inspection</h2><dl><dt>State</dt><dd>Scanning</dd></dl>";

    rail.append(previous, next, toggle, version, status, inspector);
    shadow.append(style, rail);
    document.documentElement.appendChild(host);
    state.railHost = host;
    state.rail = rail;
    applyRailPosition();
    applyTogglePosition();
    applyHappyEnabledState();
    applyDebugState();
    applyRailEnabledState();
  }

  function makeToggleButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "happy-browser-toggle";
    button.setAttribute("aria-label", "Toggle Happy Browser");
    button.setAttribute("title", "Toggle Happy Browser (Alt+Shift+H). Drag to move.");
    button.addEventListener("pointerdown", (event) => startToggleDrag(event, button));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.dataset.dragged === "true") {
        button.dataset.dragged = "false";
        return;
      }
      toggleHappyEnabled();
    });
    return button;
  }

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

  function makeRailButton(direction, text, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "happy-browser-button";
    button.dataset.direction = direction;
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", "Drag to move. Shift-click to click through.");
    button.addEventListener("pointerdown", (event) => startRailDrag(event, button));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) {
        clickThrough(event);
        return;
      }
      if (button.dataset.dragged === "true") {
        button.dataset.dragged = "false";
        return;
      }
      navigate(direction, "rail");
    });
    return button;
  }

  function startRailDrag(event, button) {
    if (event.shiftKey || event.button !== 0) {
      return;
    }

    state.drag = {
      button,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    button.setPointerCapture(event.pointerId);
    button.addEventListener("pointermove", onRailDrag);
    button.addEventListener("pointerup", stopRailDrag, { once: true });
    button.addEventListener("pointercancel", stopRailDrag, { once: true });
  }

  function onRailDrag(event) {
    if (!state.drag) {
      return;
    }

    const deltaX = Math.abs(event.clientX - state.drag.startX);
    const deltaY = Math.abs(event.clientY - state.drag.startY);
    if (deltaX < 4 && deltaY < 4 && !state.drag.moved) {
      return;
    }

    state.drag.moved = true;
    state.drag.button.dataset.dragged = "true";
    const nextPercent = Math.min(88, Math.max(12, (event.clientY / Math.max(1, window.innerHeight)) * 100));
    state.railTopPercent = nextPercent;
    applyRailPosition();
    wakeRail();
  }

  function stopRailDrag(event) {
    if (!state.drag) {
      return;
    }

    state.drag.button.releasePointerCapture(event.pointerId);
    state.drag.button.removeEventListener("pointermove", onRailDrag);
    state.drag = null;
  }

  function startToggleDrag(event, button) {
    if (event.button !== 0) {
      return;
    }

    state.toggleDrag = {
      button,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    button.setPointerCapture(event.pointerId);
    button.addEventListener("pointermove", onToggleDrag);
    button.addEventListener("pointerup", stopToggleDrag, { once: true });
    button.addEventListener("pointercancel", stopToggleDrag, { once: true });
  }

  function onToggleDrag(event) {
    if (!state.toggleDrag) {
      return;
    }

    const deltaX = Math.abs(event.clientX - state.toggleDrag.startX);
    const deltaY = Math.abs(event.clientY - state.toggleDrag.startY);
    if (deltaX < 4 && deltaY < 4 && !state.toggleDrag.moved) {
      return;
    }

    state.toggleDrag.moved = true;
    state.toggleDrag.button.dataset.dragged = "true";
    state.toggleX = Math.min(window.innerWidth - 72, Math.max(12, event.clientX - 29));
    state.toggleY = Math.min(window.innerHeight - 52, Math.max(12, event.clientY - 19));
    applyTogglePosition();
  }

  function stopToggleDrag(event) {
    if (!state.toggleDrag) {
      return;
    }

    state.toggleDrag.button.releasePointerCapture(event.pointerId);
    state.toggleDrag.button.removeEventListener("pointermove", onToggleDrag);
    state.toggleDrag = null;
  }

  function applyRailPosition() {
    if (!state.rail) {
      return;
    }

    state.rail.style.setProperty("--happy-button-top", `${state.railTopPercent}%`);
  }

  function applyTogglePosition() {
    if (!state.rail || state.toggleX === null || state.toggleY === null) {
      return;
    }

    state.rail.style.setProperty("--happy-toggle-top", `${state.toggleY}px`);
    state.rail.style.setProperty("--happy-toggle-right", `${Math.max(12, window.innerWidth - state.toggleX - 58)}px`);
  }

  function wakeRail() {
    if (state.rail) {
      state.rail.dataset.idle = "false";
    }

    clearTimeout(state.recenterTimer);
    state.recenterTimer = setTimeout(() => {
      state.railTopPercent = 50;
      applyRailPosition();
      if (state.rail) {
        state.rail.dataset.idle = "true";
      }
    }, 8000);
  }

  function clickThrough(event) {
    if (!state.railHost) {
      return;
    }

    state.railHost.style.setProperty("pointer-events", "none", "important");
    state.railHost.style.setProperty("display", "none", "important");
    const target = document.elementFromPoint(event.clientX, event.clientY);
    state.railHost.style.setProperty("display", state.railEnabled ? "block" : "none", "important");

    if (target) {
      target.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: event.clientX,
        clientY: event.clientY
      }));
    }
  }

  function installListeners() {
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousemove", onMouseActivity, true);
    document.addEventListener("pointermove", onMouseActivity, true);
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
          applyDebugState();
          updateInspector();
        }

        if (changes.happyEnabled) {
          state.happyEnabled = Boolean(changes.happyEnabled.newValue);
          applyHappyEnabledState();
        }

        if (changes.railEnabled) {
          state.railEnabled = Boolean(changes.railEnabled.newValue);
          applyRailEnabledState();
        }
      });
    }

    const observer = new MutationObserver(() => {
      ensureRailAttached();
      clearTimeout(state.observerTimer);
      state.observerTimer = setTimeout(() => scheduleAnalyze(0), 400);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    wakeRail();
  }

  function onMouseActivity(event) {
    if (event.pointerType && event.pointerType !== "mouse") {
      return;
    }

    wakeRail();
  }

  function installRailWatchdog() {
    window.setInterval(() => {
      ensureRailAttached();
      applyRailEnabledState();
    }, 700);
  }

  function ensureRailAttached() {
    if (typeof document === "undefined" || !document.documentElement) {
      return;
    }

    if (!state.railHost || !state.railHost.isConnected || !state.rail) {
      createRail();
      setRailState(state.analysis ? state.analysis.state : "scanning", state.analysis ? getStateLabel(state.analysis.state) : "Scanning");
      return;
    }

    if (state.railHost.parentElement !== document.documentElement) {
      document.documentElement.appendChild(state.railHost);
    }

    state.railHost.style.setProperty("position", "fixed", "important");
    state.railHost.style.setProperty("inset", "0", "important");
    state.railHost.style.setProperty("z-index", "2147483647", "important");
    state.railHost.style.setProperty("pointer-events", "none", "important");
    state.railHost.style.setProperty("display", state.railEnabled ? "block" : "none", "important");
    state.railHost.style.setProperty("visibility", state.railEnabled ? "visible" : "hidden", "important");
  }

  function applyRailEnabledState() {
    if (!state.railHost) {
      return;
    }

    state.railHost.style.setProperty("display", state.railEnabled ? "block" : "none", "important");
    state.railHost.style.setProperty("visibility", state.railEnabled ? "visible" : "hidden", "important");
  }

  function toggleHappyEnabled() {
    setHappyEnabled(!state.happyEnabled);
  }

  function setHappyEnabled(enabled) {
    state.happyEnabled = Boolean(enabled);
    applyHappyEnabledState();

    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ happyEnabled: state.happyEnabled });
    }

    if (state.happyEnabled) {
      announce("Happy on");
      scheduleAnalyze(0);
    }
  }

  function applyHappyEnabledState() {
    if (state.rail) {
      state.rail.dataset.happyEnabled = String(state.happyEnabled);
    }
  }

  function applyDebugState() {
    if (state.rail) {
      state.rail.dataset.debug = String(state.debug);
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
      setRailState("none", "Unavailable");
      return;
    }

    pruneFailedSelectors();
    state.analysis = scoring.analyzeNavigation(document, {
      location: window.location,
      excludedSelectors: getExcludedSelectors()
    });
    const visualState = getVisualState();
    const label = getVisualStateLabel(visualState);
    setRailState(visualState, label);
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
    state.preNavigationSnapshot = capturePageSnapshot();

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
    window.setTimeout(() => {
      const after = capturePageSnapshot();
      const before = state.preNavigationSnapshot;
      const advanced = didPageAdvance(before, after);

      if (state.debug) {
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
        announce("Noted");
      }

      scheduleAnalyze(40);
    }, 650);
  }

  function capturePageSnapshot() {
    const active = document.activeElement;
    return {
      href: window.location.href,
      title: document.title,
      bodyTextLength: document.body ? getBodyTextLength() : 0,
      activeElementSignature: active ? `${active.tagName}:${active.id}:${active.className}:${active.getAttribute("aria-current") || ""}` : "",
      mediaSignature: getVisibleMediaSignature()
    };
  }

  function getBodyTextLength() {
    return String(document.body.innerText || document.body.textContent || "").length;
  }

  function didPageAdvance(before, after) {
    return Boolean(before && after && (
      before.href !== after.href ||
      before.title !== after.title ||
      Math.abs(before.bodyTextLength - after.bodyTextLength) > 120 ||
      before.activeElementSignature !== after.activeElementSignature ||
      before.mediaSignature !== after.mediaSignature
    ));
  }

  function getVisibleMediaSignature() {
    const pieces = [];
    document.querySelectorAll("main img, main video, article img, article video, [role='main'] img, [role='main'] video, img, video").forEach((element) => {
      if (pieces.length >= 6) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      if (visibleArea < 30000) {
        return;
      }

      const source = element.currentSrc || element.src || element.poster || "";
      const alt = element.getAttribute("alt") || "";
      pieces.push([
        element.tagName,
        source.slice(0, 180),
        alt.slice(0, 80),
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.width),
        Math.round(rect.height),
        Math.round(visibleArea)
      ].join(":"));
    });

    return pieces.join("|");
  }

  function rememberFailedCandidate(candidate) {
    state.failedSelectors.set(candidate.selector, {
      text: candidate.text || "",
      failedAt: Date.now()
    });
  }

  function getExcludedSelectors() {
    return Array.from(state.failedSelectors.entries())
      .filter(([_selector, failure]) => Date.now() - failure.failedAt < 5000)
      .map(([selector]) => selector);
  }

  function pruneFailedSelectors() {
    const now = Date.now();
    state.failedSelectors.forEach((failure, selector) => {
      if (now - failure.failedAt > 5000 || isVisibleActionableLoadMore(selector)) {
        state.failedSelectors.delete(selector);
      }
    });
  }

  function isVisibleActionableLoadMore(selector) {
    const element = selector ? document.querySelector(selector) : null;
    if (!element || !element.isConnected) {
      return false;
    }

    const text = String(element.innerText || element.textContent || "").trim().toLowerCase();
    if (text !== "mehr laden" && text !== "load more" && text !== "show more") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    const disabled = element.disabled || element.getAttribute("disabled") !== null || element.getAttribute("aria-disabled") === "true" || element.closest(".disabled, [aria-disabled='true'], [disabled]");

    return visible && !disabled;
  }

  function setRailState(nextState, label) {
    if (!state.rail) {
      return;
    }

    state.rail.dataset.state = nextState;
    const status = state.rail.querySelector(".happy-browser-status");
    status.textContent = label;
    state.rail.dataset.showStatus = "true";

    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
      if (state.rail) {
        state.rail.dataset.showStatus = "false";
      }
    }, nextState === "scanning" ? 1400 : 2200);
  }

  function announce(label) {
    setRailState(state.analysis ? state.analysis.state : "scanning", label);
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
    if (!state.rail || !state.debug) {
      return;
    }

    const inspector = state.rail.querySelector(".happy-browser-inspector");
    if (!inspector) {
      return;
    }

    const analysis = state.analysis;
    const next = analysis && analysis.directions.next;
    const previous = analysis && analysis.directions.previous;
    const visualState = getVisualState();
    const nextBest = next && next.best;
    const previousBest = previous && previous.best;

    inspector.innerHTML = [
      "<h2>Local inspection</h2>",
      "<dl>",
      inspectionRow("State", getVisualStateLabel(visualState)),
      inspectionRow("Analysis", analysis ? analysis.state : "scanning"),
      inspectionRow("Next", formatCandidate(nextBest, next && next.confidence)),
      inspectionRow("Previous", formatCandidate(previousBest, previous && previous.confidence)),
      inspectionRow("Fallback", formatScrollFallback()),
      "</dl>"
    ].join("");
  }

  function inspectionRow(label, value) {
    return `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`;
  }

  function formatCandidate(candidate, confidence) {
    if (!candidate) {
      return "none";
    }

    const target = candidate.href || candidate.selector || candidate.text || "unknown";
    const reasons = (candidate.reason || []).slice(0, 4).join(", ");
    const pieces = [
      escapeHtml(`${confidence || candidate.confidence} ${candidate.type}`),
      `<code>${escapeHtml(target)}</code>`
    ];

    if (reasons) {
      pieces.push(escapeHtml(reasons));
    }

    return pieces.join("<br>");
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    if (maxScroll >= window.innerHeight * 0.35 && canScrollRange(scrollTop, maxScroll, direction)) {
      targets.push({
        type: "window",
        score: 100 + visibleAreaScore(window.innerWidth, window.innerHeight)
      });
    }

    document.querySelectorAll("main, [role='main'], section, div, ul, ol").forEach((element) => {
      if (element === state.railHost || state.railHost && state.railHost.contains(element)) {
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
