// Happy Browser — navigation rail (the blind previous/next control surface).
//
// The second half of the "split navigation kernel" work: the rail's DOM, drag,
// positioning, idle-fade visibility, status pill and debug inspector, lifted out of
// content.js so content.js keeps only page analysis and navigation policy.
//
// The rail is feature-agnostic. It renders the core control surface (previous/next
// buttons, the on/off toggle, the attention-queue button, the version chip, the status
// pill and the inspector) and exposes injection points so content.js can layer its
// feature panels on top without this module knowing about them:
//   - deps.featureCss           extra <style> text appended after the base rail CSS
//   - deps.buildExtraChildren() extra rail children (Link Tray, Work Tree, RA filter…)
//   - deps.extraInspectorRows() extra debug-inspector rows for those panels
//   - deps.afterCreate()        a hook run once the rail element exists, so feature
//                               modules can paint their initial state
//
// It shares content.js's `state` object (state.rail / state.railHost and the drag /
// timer bookkeeping) so the existing feature modules — which read state.rail directly —
// keep working unchanged. Registered as window.HappyNavigationRail, mirroring the other
// navigation kernels (HappyNavigationScoring, HappyNavigationOutcome).
(function attachHappyNavigationRail(globalScope) {
  const BASE_RAIL_CSS = `
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
      top: calc(var(--happy-toggle-top, 16px) + 86px);
      right: var(--happy-toggle-right, 16px);
      max-width: 118px;
      padding: 4px 6px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 8px;
      background: rgba(18, 24, 28, 0.42);
      color: rgba(248, 251, 255, 0.78);
      font-size: 10px;
      font-weight: 720;
      letter-spacing: 0;
      line-height: 1.12;
      text-align: center;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.62);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-4px);
      transition: opacity 140ms ease, transform 140ms ease;
      user-select: none;
      backdrop-filter: blur(14px);
    }

    #happy-browser-rail:hover .happy-browser-version,
    #happy-browser-rail:focus-within .happy-browser-version {
      opacity: 0.98;
      transform: translateY(0);
    }

    .happy-browser-queue-button {
      position: fixed;
      top: calc(var(--happy-toggle-top, 16px) + 44px);
      right: calc(var(--happy-toggle-right, 16px) + 10px);
      width: 38px;
      height: 38px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      background: rgba(18, 24, 28, 0.48);
      color: #f8fbff;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      font-size: 16px;
      font-weight: 760;
      line-height: 1;
      opacity: 0.72;
      pointer-events: auto;
      transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
      backdrop-filter: blur(16px);
    }

    .happy-browser-queue-button:hover,
    .happy-browser-queue-button:focus-visible {
      opacity: 0.94;
      outline: none;
    }

    #happy-browser-rail[data-queued-current="true"] .happy-browser-queue-button {
      background: rgba(20, 68, 54, 0.64);
      border-color: rgba(112, 243, 178, 0.72);
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
    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-queue-button,
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createNavigationRail(deps = {}) {
    const state = deps.state;
    const documentRef = deps.document || globalScope.document;
    const windowRef = deps.window || globalScope;
    const featureCss = typeof deps.featureCss === "string" ? deps.featureCss : "";
    const versionLabel = deps.versionLabel || (state && state.versionLabel) || "";
    const onNavigate = typeof deps.onNavigate === "function" ? deps.onNavigate : () => {};
    const onToggleHappy = typeof deps.onToggleHappy === "function" ? deps.onToggleHappy : () => {};
    const onQueue = typeof deps.onQueue === "function" ? deps.onQueue : () => {};
    const buildExtraChildren = typeof deps.buildExtraChildren === "function" ? deps.buildExtraChildren : () => [];
    const afterCreate = typeof deps.afterCreate === "function" ? deps.afterCreate : () => {};
    const canScrollPage = typeof deps.canScrollPage === "function" ? deps.canScrollPage : () => false;
    const getScrollFallbackLabel = typeof deps.getScrollFallbackLabel === "function" ? deps.getScrollFallbackLabel : () => "none";
    const extraInspectorRows = typeof deps.extraInspectorRows === "function" ? deps.extraInspectorRows : () => [];

    function createRail() {
      if (state.railHost && state.railHost.isConnected && state.rail) {
        return;
      }

      const host = documentRef.createElement("div");
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
      const style = documentRef.createElement("style");
      style.textContent = BASE_RAIL_CSS + featureCss;

      const rail = documentRef.createElement("div");
      rail.id = "happy-browser-rail";
      rail.dataset.state = "scanning";
      rail.dataset.showStatus = "true";
      rail.dataset.idle = "false";
      rail.dataset.happyEnabled = "true";
      rail.setAttribute("aria-live", "polite");

      const previous = makeRailButton("previous", "‹", "Happy previous");
      const next = makeRailButton("next", "›", "Happy next");
      const toggle = makeToggleButton();
      const queue = makeQueueButton();
      const extras = buildExtraChildren(documentRef) || [];
      const version = documentRef.createElement("div");
      version.className = "happy-browser-version";
      version.textContent = versionLabel;
      version.setAttribute("title", versionLabel);
      version.setAttribute("aria-hidden", "true");
      const status = documentRef.createElement("div");
      status.className = "happy-browser-status";
      status.textContent = "Scanning";
      const inspector = documentRef.createElement("section");
      inspector.className = "happy-browser-inspector";
      inspector.setAttribute("aria-label", "Happy Browser local inspection");
      inspector.innerHTML = "<h2>Local inspection</h2><dl><dt>State</dt><dd>Scanning</dd></dl>";

      rail.append(previous, next, toggle, queue, ...extras, version, status, inspector);
      shadow.append(style, rail);
      documentRef.documentElement.appendChild(host);
      state.railHost = host;
      state.rail = rail;
      applyRailPosition();
      applyTogglePosition();
      afterCreate();
    }

    function makeToggleButton() {
      const button = documentRef.createElement("button");
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
        onToggleHappy();
      });
      return button;
    }

    function makeQueueButton() {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "happy-browser-queue-button";
      button.textContent = "Q";
      button.setAttribute("aria-label", "Queue current item for attention");
      button.setAttribute("title", "Queue current item for attention");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onQueue();
      });
      return button;
    }

    function makeRailButton(direction, text, label) {
      const button = documentRef.createElement("button");
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
        onNavigate(direction, "rail");
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
      const nextPercent = Math.min(88, Math.max(12, (event.clientY / Math.max(1, windowRef.innerHeight)) * 100));
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
      state.toggleX = Math.min(windowRef.innerWidth - 72, Math.max(12, event.clientX - 29));
      state.toggleY = Math.min(windowRef.innerHeight - 52, Math.max(12, event.clientY - 19));
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
      state.rail.style.setProperty("--happy-toggle-right", `${Math.max(12, windowRef.innerWidth - state.toggleX - 58)}px`);
    }

    function wakeRail() {
      if (state.rail) {
        state.rail.dataset.idle = "false";
      }

      windowRef.clearTimeout(state.recenterTimer);
      state.recenterTimer = windowRef.setTimeout(() => {
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
      const target = documentRef.elementFromPoint(event.clientX, event.clientY);
      state.railHost.style.setProperty("display", state.railEnabled ? "block" : "none", "important");

      if (target) {
        target.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: windowRef,
          clientX: event.clientX,
          clientY: event.clientY
        }));
      }
    }

    function ensureAttached() {
      // Resolve the document live from the window rather than the cached documentRef.
      // After a window is torn down (jsdom window.close(), or a bfcache-style teardown),
      // a captured document keeps a truthy documentElement, so a cached reference would
      // let the MutationObserver that calls us re-create and re-append the rail forever
      // against a dead document — a runaway that starves the event loop. windowRef.document
      // goes falsy on teardown, matching the pre-extraction code that read the global document.
      const liveDocument = windowRef.document;
      if (!liveDocument || !liveDocument.documentElement) {
        return;
      }

      if (!state.railHost || !state.railHost.isConnected || !state.rail) {
        createRail();
        setRailState(
          state.analysis ? state.analysis.state : "scanning",
          state.analysis ? getStateLabel(state.analysis.state) : "Scanning"
        );
        return;
      }

      if (state.railHost.parentElement !== liveDocument.documentElement) {
        liveDocument.documentElement.appendChild(state.railHost);
      }

      state.railHost.style.setProperty("position", "fixed", "important");
      state.railHost.style.setProperty("inset", "0", "important");
      state.railHost.style.setProperty("z-index", "2147483647", "important");
      state.railHost.style.setProperty("pointer-events", "none", "important");
      state.railHost.style.setProperty("display", state.railEnabled ? "block" : "none", "important");
      state.railHost.style.setProperty("visibility", state.railEnabled ? "visible" : "hidden", "important");
    }

    function setRailState(nextState, label) {
      if (!state.rail) {
        return;
      }

      state.rail.dataset.state = nextState;
      const status = state.rail.querySelector(".happy-browser-status");
      status.textContent = label;
      state.rail.dataset.showStatus = "true";

      windowRef.clearTimeout(state.statusTimer);
      state.statusTimer = windowRef.setTimeout(() => {
        if (state.rail) {
          state.rail.dataset.showStatus = "false";
        }
      }, nextState === "scanning" ? 1400 : 2200);
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

      const rows = [
        "<h2>Local inspection</h2>",
        "<dl>",
        inspectionRow("State", getVisualStateLabel(visualState)),
        inspectionRow("Analysis", analysis ? analysis.state : "scanning"),
        inspectionRow("Next", formatCandidate(nextBest, next && next.confidence)),
        inspectionRow("Previous", formatCandidate(previousBest, previous && previous.confidence)),
        inspectionRow("Fallback", getScrollFallbackLabel())
      ];

      (extraInspectorRows() || []).forEach((row) => {
        rows.push(inspectionRow(row.label, row.value));
      });

      rows.push("</dl>");
      inspector.innerHTML = rows.join("");
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

    return {
      createRail,
      ensureAttached,
      wakeRail,
      setRailState,
      updateInspector,
      getVisualState,
      getVisualStateLabel,
      getStateLabel,
      formatCandidate,
      inspectionRow,
      applyRailPosition,
      applyTogglePosition
    };
  }

  const api = {
    createNavigationRail,
    escapeHtml
  };

  globalScope.HappyNavigationRail = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
