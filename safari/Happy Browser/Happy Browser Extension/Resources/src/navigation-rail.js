(function attachHappyNavigationRail(globalScope) {
  const RAIL_CSS = `
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createNavigationRail(deps) {
    const documentRef = deps.document || globalScope.document;
    const onNavigate = deps.onNavigate;
    const onToggleHappy = deps.onToggleHappy;
    const versionLabel = deps.versionLabel || "v0.2.5";

    let railHost = null;
    let rail = null;
    let railEnabled = true;
    let happyEnabled = true;
    let debug = false;
    let drag = null;
    let toggleDrag = null;
    let recenterTimer = null;
    let railTopPercent = 50;
    let toggleX = null;
    let toggleY = null;
    let statusTimer = null;

    function createRail() {
      if (railHost && railHost.isConnected && rail) {
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
      style.textContent = RAIL_CSS;

      const railElement = documentRef.createElement("div");
      railElement.id = "happy-browser-rail";
      railElement.dataset.state = "scanning";
      railElement.dataset.showStatus = "true";
      railElement.dataset.idle = "false";
      railElement.dataset.happyEnabled = "true";
      railElement.setAttribute("aria-live", "polite");

      const previous = makeRailButton("previous", "‹", "Happy previous");
      const next = makeRailButton("next", "›", "Happy next");
      const toggle = makeToggleButton();
      const version = documentRef.createElement("div");
      version.className = "happy-browser-version";
      version.textContent = versionLabel;
      version.setAttribute("aria-hidden", "true");
      const status = documentRef.createElement("div");
      status.className = "happy-browser-status";
      status.textContent = "Scanning";
      const inspector = documentRef.createElement("section");
      inspector.className = "happy-browser-inspector";
      inspector.setAttribute("aria-label", "Happy Browser local inspection");
      inspector.innerHTML = "<h2>Local inspection</h2><dl><dt>State</dt><dd>Scanning</dd></dl>";

      railElement.append(previous, next, toggle, version, status, inspector);
      shadow.append(style, railElement);
      documentRef.documentElement.appendChild(host);
      railHost = host;
      rail = railElement;
      applyRailPosition();
      applyTogglePosition();
      applyHappyEnabledState();
      applyDebugState();
      applyRailEnabledState();
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

      drag = {
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
      if (!drag) {
        return;
      }

      const deltaX = Math.abs(event.clientX - drag.startX);
      const deltaY = Math.abs(event.clientY - drag.startY);
      if (deltaX < 4 && deltaY < 4 && !drag.moved) {
        return;
      }

      drag.moved = true;
      drag.button.dataset.dragged = "true";
      railTopPercent = Math.min(88, Math.max(12, (event.clientY / Math.max(1, globalScope.innerHeight)) * 100));
      applyRailPosition();
      wakeRail();
    }

    function stopRailDrag(event) {
      if (!drag) {
        return;
      }

      drag.button.releasePointerCapture(event.pointerId);
      drag.button.removeEventListener("pointermove", onRailDrag);
      drag = null;
    }

    function startToggleDrag(event, button) {
      if (event.button !== 0) {
        return;
      }

      toggleDrag = {
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
      if (!toggleDrag) {
        return;
      }

      const deltaX = Math.abs(event.clientX - toggleDrag.startX);
      const deltaY = Math.abs(event.clientY - toggleDrag.startY);
      if (deltaX < 4 && deltaY < 4 && !toggleDrag.moved) {
        return;
      }

      toggleDrag.moved = true;
      toggleDrag.button.dataset.dragged = "true";
      toggleX = Math.min(globalScope.innerWidth - 72, Math.max(12, event.clientX - 29));
      toggleY = Math.min(globalScope.innerHeight - 52, Math.max(12, event.clientY - 19));
      applyTogglePosition();
    }

    function stopToggleDrag(event) {
      if (!toggleDrag) {
        return;
      }

      toggleDrag.button.releasePointerCapture(event.pointerId);
      toggleDrag.button.removeEventListener("pointermove", onToggleDrag);
      toggleDrag = null;
    }

    function applyRailPosition() {
      if (!rail) {
        return;
      }

      rail.style.setProperty("--happy-button-top", `${railTopPercent}%`);
    }

    function applyTogglePosition() {
      if (!rail || toggleX === null || toggleY === null) {
        return;
      }

      rail.style.setProperty("--happy-toggle-top", `${toggleY}px`);
      rail.style.setProperty("--happy-toggle-right", `${Math.max(12, globalScope.innerWidth - toggleX - 58)}px`);
    }

    function wakeRail() {
      if (rail) {
        rail.dataset.idle = "false";
      }

      globalScope.clearTimeout(recenterTimer);
      recenterTimer = globalScope.setTimeout(() => {
        railTopPercent = 50;
        applyRailPosition();
        if (rail) {
          rail.dataset.idle = "true";
        }
      }, 8000);
    }

    function clickThrough(event) {
      if (!railHost) {
        return;
      }

      railHost.style.setProperty("pointer-events", "none", "important");
      railHost.style.setProperty("display", "none", "important");
      const target = documentRef.elementFromPoint(event.clientX, event.clientY);
      railHost.style.setProperty("display", railEnabled ? "block" : "none", "important");

      if (target) {
        target.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: globalScope,
          clientX: event.clientX,
          clientY: event.clientY
        }));
      }
    }

    function ensureAttached() {
      if (!documentRef.documentElement) {
        return;
      }

      if (!railHost || !railHost.isConnected || !rail) {
        createRail();
        return;
      }

      if (railHost.parentElement !== documentRef.documentElement) {
        documentRef.documentElement.appendChild(railHost);
      }

      railHost.style.setProperty("position", "fixed", "important");
      railHost.style.setProperty("inset", "0", "important");
      railHost.style.setProperty("z-index", "2147483647", "important");
      railHost.style.setProperty("pointer-events", "none", "important");
      railHost.style.setProperty("display", railEnabled ? "block" : "none", "important");
      railHost.style.setProperty("visibility", railEnabled ? "visible" : "hidden", "important");
    }

    function applyRailEnabledState() {
      if (!railHost) {
        return;
      }

      railHost.style.setProperty("display", railEnabled ? "block" : "none", "important");
      railHost.style.setProperty("visibility", railEnabled ? "visible" : "hidden", "important");
    }

    function setRailEnabled(enabled) {
      railEnabled = Boolean(enabled);
      applyRailEnabledState();
    }

    function setHappyEnabled(enabled) {
      happyEnabled = Boolean(enabled);
      applyHappyEnabledState();
    }

    function applyHappyEnabledState() {
      if (rail) {
        rail.dataset.happyEnabled = String(happyEnabled);
      }
    }

    function setDebug(enabled) {
      debug = Boolean(enabled);
      applyDebugState();
    }

    function applyDebugState() {
      if (rail) {
        rail.dataset.debug = String(debug);
      }
    }

    function setRailState(nextState, label) {
      if (!rail) {
        return;
      }

      rail.dataset.state = nextState;
      const status = rail.querySelector(".happy-browser-status");
      status.textContent = label;
      rail.dataset.showStatus = "true";

      globalScope.clearTimeout(statusTimer);
      statusTimer = globalScope.setTimeout(() => {
        if (rail) {
          rail.dataset.showStatus = "false";
        }
      }, nextState === "scanning" ? 1400 : 2200);
    }

    function updateInspector(inspectorHtml) {
      if (!rail || !debug) {
        return;
      }

      const inspector = rail.querySelector(".happy-browser-inspector");
      if (!inspector) {
        return;
      }

      inspector.innerHTML = inspectorHtml;
    }

    function buildInspectorHtml(context) {
      const {
        visualStateLabel,
        analysisState,
        nextCandidate,
        nextConfidence,
        previousCandidate,
        previousConfidence,
        scrollFallbackLabel
      } = context;

      return [
        "<h2>Local inspection</h2>",
        "<dl>",
        inspectionRow("State", visualStateLabel),
        inspectionRow("Analysis", analysisState),
        inspectionRow("Next", formatCandidate(nextCandidate, nextConfidence)),
        inspectionRow("Previous", formatCandidate(previousCandidate, previousConfidence)),
        inspectionRow("Fallback", scrollFallbackLabel),
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

    function getRailHost() {
      return railHost;
    }

    function onMouseActivity(event) {
      if (event.pointerType && event.pointerType !== "mouse") {
        return;
      }

      wakeRail();
    }

    return {
      createRail,
      ensureAttached,
      wakeRail,
      setRailState,
      setRailEnabled,
      setHappyEnabled,
      setDebug,
      updateInspector,
      buildInspectorHtml,
      formatCandidate,
      getRailHost,
      onMouseActivity
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
