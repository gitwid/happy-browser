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
    attentionQueue: [],
    linkTray: [],
    linkTrayDragItem: null,
    linkTrayCaptureArmed: false,
    raFilter: {
      enabled: false,
      running: false,
      timer: null,
      lastSignature: "",
      detailCache: new Map(),
      proofResults: new Map(),
      proofHost: null,
      proofHideTimer: null,
      proofActiveElement: null,
      confirmedSignals: {},
      status: null,
      runId: 0,
      userDisabled: false,
      frameFallbacks: 0,
      lastDetailRequestAt: 0,
      mode: "ghost"
    },
    versionLabel: getExtensionVersionLabel()
  };
  const ATTENTION_QUEUE_STORAGE_KEY = "happyAttentionQueue";
  const LINK_TRAY_STORAGE_KEY = "happyLinkTray";
  const LINK_TRAY_MAX_ITEMS = 4;
  const LINK_TRAY_DRAG_MIME = "application/x-happy-browser-link-tray";
  const RA_SIGNAL_CONFIRMATIONS_STORAGE_KEY = "happyRaSignalConfirmations";
  const RA_FILTER_PAGE_STYLE_ID = "happy-browser-ra-filter-style";
  const RA_DETAIL_SCAN_CONCURRENCY = 1;
  const RA_DETAIL_REQUEST_MIN_INTERVAL_MS = 650;
  const RA_LGBTQ_PATTERNS = [
    { label: "sex positive", pattern: /\bsex[\s-]*positive\b/i },
    { label: "awareness team", pattern: /\bawareness\s+team\b/i },
    { label: "queer", pattern: /\bqueer\b/i },
    { label: "lgbtq", pattern: /\blgbtq?\+?\b/i },
    { label: "flinta", pattern: /\bflinta\*?\b/i },
    { label: "trans", pattern: /\btrans\b|\bnon[\s-]?binary\b|\bnot\s+binary\b/i },
    { label: "drag", pattern: /\bdrag\b|\bgogo\b|\bgo-go\b/i },
    { label: "darkroom", pattern: /\bdark\s*room\b|\bdarkroom\b/i },
    { label: "consent", pattern: /\bconsent\b|\bharm\s+reduction\b|\bno\s+racism\b|\bno\s+discrimination\b/i },
    { label: "queer nightlife", pattern: /\b(gegen|lecken|cuntcore|cunt\s*core|tipsy\s+disco|vrau|pleasure\s+patterns|la\s+casita|playgirlparty|fiesta\s+dame)\b/i }
  ];

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

    .happy-browser-link-tray {
      position: fixed;
      left: 14px;
      top: 16px;
      width: min(278px, calc(100vw - 28px));
      max-height: calc(100vh - 32px);
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 8px;
      background: rgba(18, 24, 28, 0.46);
      box-shadow: 0 18px 46px rgba(0, 0, 0, 0.24);
      color: #f8fbff;
      opacity: 0.68;
      overflow: auto;
      pointer-events: auto;
      transform: translateX(calc(-100% + 42px));
      transition: background 160ms ease, border-color 160ms ease, left 180ms ease, opacity 160ms ease, top 180ms ease, transform 180ms ease;
      backdrop-filter: blur(18px);
    }

    .happy-browser-link-tray:hover,
    .happy-browser-link-tray:focus-within,
    #happy-browser-rail[data-link-tray-active="true"] .happy-browser-link-tray,
    #happy-browser-rail[data-link-tray-count]:not([data-link-tray-count="0"]) .happy-browser-link-tray {
      opacity: 0.98;
      transform: translateX(0);
    }

    #happy-browser-rail[data-link-tray-active="true"] .happy-browser-link-tray {
      background: rgba(20, 68, 54, 0.64);
      border-color: rgba(112, 243, 178, 0.72);
    }

    #happy-browser-rail[data-idle="true"] .happy-browser-link-tray {
      left: 8px;
      top: 8px;
      opacity: 0.16;
      transform: translateX(calc(-100% + 22px));
    }

    #happy-browser-rail[data-idle="true"] .happy-browser-link-tray:hover,
    #happy-browser-rail[data-idle="true"] .happy-browser-link-tray:focus-within,
    #happy-browser-rail[data-idle="true"][data-link-tray-active="true"] .happy-browser-link-tray {
      opacity: 0.98;
      transform: translateX(0);
    }

    .happy-browser-link-tray__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 0 8px;
    }

    .happy-browser-link-tray__title {
      margin: 0;
      color: rgba(248, 251, 255, 0.78);
      font-size: 11px;
      font-weight: 760;
      letter-spacing: 0;
      line-height: 1;
      text-transform: uppercase;
    }

    .happy-browser-link-tray__tools {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 0 0 auto;
    }

    .happy-browser-link-tray__capture,
    .happy-browser-link-tray__clear {
      width: 22px;
      height: 22px;
      border: 1px solid rgba(255, 255, 255, 0.26);
      border-radius: 50%;
      background: rgba(18, 24, 28, 0.36);
      color: rgba(248, 251, 255, 0.78);
      cursor: pointer;
      display: none;
      flex: 0 0 auto;
      font-size: 13px;
      font-weight: 760;
      line-height: 1;
      padding: 0;
      transition: background 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease;
    }

    .happy-browser-link-tray__capture {
      display: inline-grid;
      place-items: center;
    }

    #happy-browser-rail[data-link-tray-capture="true"] .happy-browser-link-tray__capture,
    .happy-browser-link-tray__capture:hover,
    .happy-browser-link-tray__capture:focus-visible {
      background: rgba(20, 68, 54, 0.74);
      border-color: rgba(112, 243, 178, 0.82);
      color: #ffffff;
      outline: none;
    }

    .happy-browser-link-tray__clear:hover,
    .happy-browser-link-tray__clear:focus-visible {
      background: rgba(70, 24, 24, 0.74);
      border-color: rgba(255, 132, 132, 0.82);
      color: #ffffff;
      outline: none;
    }

    #happy-browser-rail[data-link-tray-count]:not([data-link-tray-count="0"]) .happy-browser-link-tray__clear {
      display: inline-grid;
      place-items: center;
    }

    .happy-browser-link-tray__list {
      display: grid;
      gap: 8px;
    }

    .happy-browser-link-tray__empty {
      min-height: 76px;
      display: grid;
      place-items: center;
      border: 1px dashed rgba(255, 255, 255, 0.28);
      border-radius: 8px;
      color: rgba(248, 251, 255, 0.66);
      font-size: 12px;
      font-weight: 680;
      line-height: 1.2;
      text-align: center;
    }

    .happy-browser-link-tray__item {
      width: 100%;
      min-height: 88px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      cursor: pointer;
      display: block;
      overflow: hidden;
      text-align: left;
      transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
    }

    .happy-browser-link-tray__item:hover,
    .happy-browser-link-tray__item:focus-visible {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.52);
      outline: none;
      transform: translateY(-1px);
    }

    .happy-browser-link-tray__item[data-review="true"] {
      border-color: rgba(255, 202, 98, 0.74);
    }

    .happy-browser-link-tray__preview {
      height: 88px;
      padding: 8px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.94);
      color: #24292f;
      line-height: 1.25;
    }

    .happy-browser-link-tray__preview * {
      box-sizing: border-box;
      max-width: 100%;
      pointer-events: none;
    }

    .happy-browser-link-tray__snapshot {
      max-height: 72px;
      overflow: hidden;
    }

    .happy-browser-link-tray__fallback-title {
      margin: 0 0 5px;
      color: #24292f;
      font-size: 13px;
      font-weight: 720;
      line-height: 1.18;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .happy-browser-link-tray__fallback-url,
    .happy-browser-link-tray__fallback-snippet {
      margin: 0;
      color: #57606a;
      font-size: 11px;
      line-height: 1.24;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .happy-browser-link-tray__fallback-snippet {
      white-space: normal;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .happy-browser-link-tray__review {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 7px;
      border-top: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(18, 24, 28, 0.28);
    }

    .happy-browser-link-tray__review-status {
      grid-column: 1 / -1;
      color: rgba(248, 251, 255, 0.74);
      font-size: 10px;
      font-weight: 720;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }

    .happy-browser-link-tray__review button {
      min-height: 24px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 8px;
      color: #ffffff;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      line-height: 1;
    }

    .happy-browser-link-tray__accept {
      background: rgba(20, 68, 54, 0.78);
    }

    .happy-browser-link-tray__reject {
      background: rgba(70, 24, 24, 0.78);
    }

    .happy-browser-ra-filter-button {
      position: fixed;
      top: calc(var(--happy-toggle-top, 16px) + 44px);
      right: calc(var(--happy-toggle-right, 16px) + 54px);
      width: 38px;
      height: 38px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      background: rgba(18, 24, 28, 0.48);
      color: #f8fbff;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      display: none;
      font-size: 11px;
      font-weight: 760;
      letter-spacing: 0;
      line-height: 1;
      opacity: 0.72;
      pointer-events: auto;
      transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
      backdrop-filter: blur(16px);
    }

    .happy-browser-ra-filter-button:hover,
    .happy-browser-ra-filter-button:focus-visible {
      opacity: 0.94;
      outline: none;
    }

    .happy-browser-ra-mode,
    .happy-browser-ra-progress {
      position: fixed;
      top: calc(var(--happy-toggle-top, 16px) + 88px);
      right: calc(var(--happy-toggle-right, 16px) + 46px);
      min-width: 58px;
      padding: 4px 7px;
      border: 1px dashed rgba(255, 255, 255, 0.32);
      border-radius: 8px;
      background: rgba(18, 24, 28, 0.5);
      color: #f8fbff;
      display: none;
      font-size: 10px;
      font-weight: 760;
      letter-spacing: 0;
      line-height: 1;
      pointer-events: none;
      text-align: center;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.62);
      text-transform: uppercase;
      backdrop-filter: blur(16px);
    }

    .happy-browser-ra-progress {
      top: calc(var(--happy-toggle-top, 16px) + 112px);
      min-width: 74px;
      border-style: solid;
      text-transform: none;
    }

    #happy-browser-rail[data-ra-page="true"] .happy-browser-ra-filter-button {
      display: block;
    }

    #happy-browser-rail[data-ra-page="true"] .happy-browser-ra-mode,
    #happy-browser-rail[data-ra-page="true"] .happy-browser-ra-progress {
      display: block;
    }

    #happy-browser-rail[data-ra-filter-enabled="true"] .happy-browser-ra-filter-button {
      background: rgba(20, 68, 54, 0.64);
      border-color: rgba(112, 243, 178, 0.72);
    }

    #happy-browser-rail[data-ra-mode="ghost"] .happy-browser-ra-filter-button,
    #happy-browser-rail[data-ra-mode="ghost"] .happy-browser-ra-mode {
      border-style: dashed;
      border-color: rgba(255, 202, 98, 0.78);
    }

    #happy-browser-rail[data-ra-mode="filtered"] .happy-browser-ra-filter-button,
    #happy-browser-rail[data-ra-mode="filtered"] .happy-browser-ra-mode {
      border-style: solid;
      border-color: rgba(112, 243, 178, 0.78);
    }

    #happy-browser-rail[data-ra-mode="all"] .happy-browser-ra-filter-button,
    #happy-browser-rail[data-ra-mode="all"] .happy-browser-ra-mode {
      background: rgba(18, 24, 28, 0.34);
      border-style: dotted;
      border-color: rgba(255, 255, 255, 0.36);
      opacity: 0.72;
    }

    #happy-browser-rail[data-ra-filter-running="true"] .happy-browser-ra-filter-button {
      border-color: rgba(255, 202, 98, 0.74);
    }

    #happy-browser-rail[data-ra-filter-phase="running"] .happy-browser-ra-progress {
      border-style: dashed;
      border-color: rgba(255, 202, 98, 0.82);
      background: rgba(56, 39, 14, 0.68);
      animation: happy-ra-progress-pulse 1200ms ease-in-out infinite;
    }

    #happy-browser-rail[data-ra-filter-phase="done"] .happy-browser-ra-progress {
      border-color: rgba(112, 243, 178, 0.78);
      background: rgba(20, 68, 54, 0.62);
    }

    #happy-browser-rail[data-ra-filter-phase="error"] .happy-browser-ra-progress {
      border-color: rgba(255, 132, 132, 0.82);
      background: rgba(70, 24, 24, 0.68);
    }

    #happy-browser-rail[data-ra-filter-phase="all"] .happy-browser-ra-progress,
    #happy-browser-rail[data-ra-filter-phase="ready"] .happy-browser-ra-progress {
      border-color: rgba(255, 255, 255, 0.34);
      background: rgba(18, 24, 28, 0.42);
      opacity: 0.76;
    }

    @keyframes happy-ra-progress-pulse {
      0%, 100% { opacity: 0.74; }
      50% { opacity: 1; }
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
    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-ra-filter-button,
    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-ra-mode,
    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-ra-progress,
    #happy-browser-rail[data-happy-enabled="false"] .happy-browser-link-tray,
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

      .happy-browser-link-tray {
        left: 8px;
        top: 8px;
        width: min(248px, calc(100vw - 16px));
      }
    }
  `;

  if (window.__happyBrowserTestHooksRequested) {
    window.__HappyBrowserTestHooks = {
      capturePageSnapshot,
      didPageAdvance,
      getAttentionQueueItem,
      getFeedNavigationAction,
      getFeedPosts,
      getFocusedPost,
      getAdjacentPost,
      getRaEventCards,
      getRaFilterStatus: () => state.raFilter.status,
      getRaFilterMode: () => state.raFilter.enabled ? state.raFilter.mode : "all",
      getRaProofCard: () => state.raFilter.proofHost,
      getRaSignalConfirmations,
      isRaBerlinEventsPage,
      parseRaEventDetailHtml,
      readRaFrameDetailWhenReady,
      runRaLgbtqFilter,
      toggleRaFilter,
      queueFocusedPost,
      getAttentionQueue: () => state.attentionQueue,
      queueLinkTrayItem,
      clearLinkTray,
      getLinkTrayItemFromElement,
      getLinkTrayItemFromAnchor,
      getLinkTrayItems: () => state.linkTray,
      getVisibleMediaSignature
    };
  }

  loadSettings();
  loadAttentionQueue();
  loadLinkTray();
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

  function loadAttentionQueue() {
    const localStorageArea = chrome.storage && chrome.storage.local;
    if (!localStorageArea || typeof localStorageArea.get !== "function") {
      state.attentionQueue = [];
      applyQueueState();
      return;
    }

    localStorageArea.get({ [ATTENTION_QUEUE_STORAGE_KEY]: [] }, (settings) => {
      const queue = settings && Array.isArray(settings[ATTENTION_QUEUE_STORAGE_KEY]) ? settings[ATTENTION_QUEUE_STORAGE_KEY] : [];
      state.attentionQueue = queue.filter((item) => item && item.key).slice(0, 100);
      applyQueueState();
      updateInspector();
    });
  }

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
    const queue = makeQueueButton();
    const linkTray = makeLinkTray();
    const raFilter = makeRaFilterButton();
    const raMode = document.createElement("div");
    raMode.className = "happy-browser-ra-mode";
    raMode.textContent = "ghost";
    raMode.setAttribute("aria-hidden", "true");
    const raProgress = document.createElement("div");
    raProgress.className = "happy-browser-ra-progress";
    raProgress.textContent = "ready";
    const version = document.createElement("div");
    version.className = "happy-browser-version";
    version.textContent = state.versionLabel;
    version.setAttribute("title", state.versionLabel);
    version.setAttribute("aria-hidden", "true");
    const status = document.createElement("div");
    status.className = "happy-browser-status";
    status.textContent = "Scanning";
    const inspector = document.createElement("section");
    inspector.className = "happy-browser-inspector";
    inspector.setAttribute("aria-label", "Happy Browser local inspection");
    inspector.innerHTML = "<h2>Local inspection</h2><dl><dt>State</dt><dd>Scanning</dd></dl>";

    rail.append(previous, next, toggle, queue, linkTray, raFilter, raMode, raProgress, version, status, inspector);
    shadow.append(style, rail);
    document.documentElement.appendChild(host);
    state.railHost = host;
    state.rail = rail;
    applyRailPosition();
    applyTogglePosition();
    applyHappyEnabledState();
    applyDebugState();
    applyRailEnabledState();
    applyQueueState();
    applyLinkTrayState();
    updateRaFilterUi();
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

  function makeQueueButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "happy-browser-queue-button";
    button.textContent = "Q";
    button.setAttribute("aria-label", "Queue current item for attention");
    button.setAttribute("title", "Queue current item for attention");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      queueFocusedPost();
    });
    return button;
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

  function getExtensionVersionLabel() {
    try {
      const manifest = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
      if (manifest && manifest.version) {
        return formatExtensionVersionLabel(manifest);
      }
    } catch (error) {
      // Safari can be conservative about extension APIs during early injection.
    }
    return "Trillian v0.3.0";
  }

  function formatExtensionVersionLabel(manifest) {
    const name = String(manifest && manifest.name || "");
    const version = String(manifest && manifest.version || "0.0.0");
    if (/fenchurch/i.test(name)) {
      return `🐬🐬 Fenchurch v${version}`;
    }
    if (/trillian|dev/i.test(name)) {
      return `🛸 Trillian v${version}`;
    }
    return `${name || "Happy Browser"} v${version}`;
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
    document.addEventListener("mousemove", onMouseActivity, true);
    document.addEventListener("mouseover", onRaProofHoverStart, true);
    document.addEventListener("mouseout", onRaProofHoverEnd, true);
    document.addEventListener("pointermove", onMouseActivity, true);
    document.addEventListener("dragstart", onPageDragStart, true);
    document.addEventListener("dragend", onPageDragEnd, true);
    document.addEventListener("wheel", onWheel, { passive: true, capture: true });
    document.addEventListener("click", onLinkTrayCaptureClick, true);
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
    setRailState(visualState, label);
    applyQueueState();
    maybeRunRaFilter();
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

    const feedAction = getFeedNavigationAction(direction);
    if (feedAction) {
      state.preNavigationSnapshot = capturePageSnapshot();
      if (feedAction.type === "carousel" && feedAction.candidate) {
        announce(`Going ${direction}`);
        performCandidate(feedAction.candidate, feedAction.post);
        observeNavigationOutcome(direction, source, feedAction.candidate);
        return;
      }

      if (feedAction.type === "post-scroll" && feedAction.post) {
        announce(direction === "next" ? "Next item" : "Previous item");
        scrollPostIntoFocus(feedAction.post);
        observeNavigationOutcome(direction, source, { type: "scroll", source: "focused-post" });
        return;
      }
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

  function getFeedNavigationAction(direction) {
    const focusedPost = getFocusedPost();
    if (!focusedPost || !scoring) {
      return null;
    }

    const carouselCandidate = getScopedPostCarouselCandidate(focusedPost, direction);
    if (carouselCandidate) {
      return {
        type: "carousel",
        post: focusedPost,
        candidate: carouselCandidate
      };
    }

    const posts = getFeedPosts();
    if (posts.length < 2) {
      return null;
    }

    const adjacentPost = getAdjacentPost(focusedPost, direction, posts);
    if (!adjacentPost) {
      return null;
    }

    return {
      type: "post-scroll",
      post: adjacentPost
    };
  }

  function getScopedPostCarouselCandidate(post, direction) {
    const result = scoring.analyzeNavigation(post, {
      location: window.location,
      excludedSelectors: getExcludedSelectors()
    });
    const directionResult = result && result.directions && result.directions[direction];
    const candidate = directionResult && directionResult.best;
    if (!candidate || candidate.confidence === "none") {
      return null;
    }

    const reasons = candidate.reason || [];
    return reasons.includes("media-carousel-control") ? candidate : null;
  }

  function getFeedPosts() {
    const articlePosts = Array.from(document.querySelectorAll("article, [role='article']"))
      .filter(isPostLikeElement);

    if (articlePosts.length) {
      return sortAndDedupePosts(articlePosts);
    }

    const main = document.querySelector("main, [role='main']");
    const candidates = main ? Array.from(main.querySelectorAll(":scope > article, :scope > section, :scope > div")) : [];
    return sortAndDedupePosts(candidates.filter(isPostLikeElement));
  }

  function sortAndDedupePosts(posts) {
    const deduped = [];
    posts.forEach((post) => {
      if (deduped.some((existing) => existing === post || existing.contains(post))) {
        return;
      }

      const containedIndex = deduped.findIndex((existing) => post.contains(existing));
      if (containedIndex >= 0) {
        deduped.splice(containedIndex, 1, post);
        return;
      }

      deduped.push(post);
    });

    return deduped.sort((a, b) => getElementCenterY(a) - getElementCenterY(b));
  }

  function isPostLikeElement(element) {
    if (!element || element === state.railHost || state.railHost && state.railHost.contains(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (!rect || rect.width < 220 || rect.height < 220 || rect.width * rect.height < 50000) {
      return false;
    }

    return hasLargeMedia(element) || hasMediaCarouselControls(element);
  }

  function hasLargeMedia(element) {
    return Array.from(element.querySelectorAll("img, video, picture, canvas, [role='img']"))
      .slice(0, 32)
      .some((media) => {
        const rect = media.getBoundingClientRect();
        return rect && rect.width >= 180 && rect.height >= 180 && rect.width * rect.height >= 50000;
      });
  }

  function hasMediaCarouselControls(element) {
    return Array.from(element.querySelectorAll("button[aria-label], [role='button'][aria-label]"))
      .some((control) => /(^|[^a-z0-9])(next|previous|prev|go back|arrow-right|arrow-left|chevron-right|chevron-left)([^a-z0-9]|$)/i.test(control.getAttribute("aria-label") || ""));
  }

  function getFocusedPost() {
    const posts = getFeedPosts();
    if (!posts.length) {
      return null;
    }

    const viewportCenter = window.innerHeight / 2;
    const visiblePosts = posts
      .map((post) => ({
        post,
        distance: Math.abs(getElementCenterY(post) - viewportCenter),
        visibleArea: getVisibleArea(post)
      }))
      .filter((item) => item.visibleArea >= 12000);

    const pool = visiblePosts.length ? visiblePosts : posts.map((post) => ({
      post,
      distance: Math.abs(getElementCenterY(post) - viewportCenter),
      visibleArea: 0
    }));

    pool.sort((a, b) => a.distance - b.distance || b.visibleArea - a.visibleArea);
    return pool[0].post;
  }

  function getAdjacentPost(focusedPost, direction, posts = getFeedPosts()) {
    const index = posts.indexOf(focusedPost);
    if (index < 0) {
      return null;
    }

    return direction === "next" ? posts[index + 1] || null : posts[index - 1] || null;
  }

  function scrollPostIntoFocus(post) {
    if (!post || typeof post.scrollIntoView !== "function") {
      return;
    }

    post.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth"
    });
  }

  function getElementCenterY(element) {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2;
  }

  function getVisibleArea(element) {
    const rect = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return width * height;
  }

  function performCandidate(candidate, scope) {
    if (candidate.type === "url" && candidate.href) {
      window.location.href = candidate.href;
      return;
    }

    const element = candidate.selector ? queryCandidateElement(candidate.selector, scope) : null;
    if (element) {
      element.click();
      return;
    }

    if (candidate.href) {
      window.location.href = candidate.href;
    }
  }

  function queryCandidateElement(selector, scope) {
    if (!selector) {
      return null;
    }

    if (scope && scope.querySelector) {
      const scoped = scope.querySelector(selector);
      if (scoped) {
        return scoped;
      }
    }

    return document.querySelector(selector);
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

  function queueFocusedPost() {
    const item = getAttentionQueueItem(getFocusedPost());
    if (!item) {
      announce("Nothing to queue");
      return Promise.resolve(null);
    }

    const nextQueue = [
      item,
      ...state.attentionQueue.filter((queued) => queued.key !== item.key)
    ].slice(0, 100);
    state.attentionQueue = nextQueue;
    applyQueueState();
    updateInspector();

    return persistAttentionQueue().then(() => {
      announce("Queued");
      return item;
    });
  }

  function persistAttentionQueue() {
    const localStorageArea = chrome.storage && chrome.storage.local;
    if (!localStorageArea || typeof localStorageArea.set !== "function") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      localStorageArea.set({ [ATTENTION_QUEUE_STORAGE_KEY]: state.attentionQueue }, resolve);
    });
  }

  function getAttentionQueueItem(post) {
    if (!post) {
      return null;
    }

    const url = getPostUrl(post);
    const snippet = getPostSnippet(post);
    const mediaSignature = getPostMediaSignature(post);
    const key = url || `${window.location.href}#${mediaSignature || snippet}`;
    if (!key) {
      return null;
    }

    return {
      key,
      url,
      sourceUrl: window.location.href,
      title: getPostTitle(post),
      snippet,
      mediaSignature,
      queuedAt: new Date().toISOString()
    };
  }

  function getPostUrl(post) {
    const postLink = Array.from(post.querySelectorAll("a[href]"))
      .map((link) => link.getAttribute("href"))
      .find((href) => href && /\/p\/[^/]+\/?/.test(href));
    if (postLink) {
      try {
        return new URL(postLink, window.location.href).href.split("?")[0];
      } catch (_error) {
        return postLink;
      }
    }

    if (/\/p\/[^/]+\/?/.test(window.location.pathname)) {
      return window.location.href.split("?")[0];
    }

    return "";
  }

  function getPostTitle(post) {
    const profileLink = Array.from(post.querySelectorAll("a[href]"))
      .map((link) => String(link.innerText || link.textContent || "").trim())
      .find((text) => text && text.length <= 80);
    return profileLink || document.title || "Queued item";
  }

  function getPostSnippet(post) {
    return String(post.innerText || post.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
  }

  function getPostMediaSignature(post) {
    return Array.from(post.querySelectorAll("img, video"))
      .slice(0, 4)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return [
          element.currentSrc || element.src || element.poster || "",
          element.getAttribute("alt") || "",
          Math.round(rect.width),
          Math.round(rect.height)
        ].join(":").slice(0, 180);
      })
      .join("|");
  }

  function applyQueueState() {
    if (!state.rail) {
      return;
    }

    const current = getAttentionQueueItem(getFocusedPost());
    const queuedCurrent = Boolean(current && state.attentionQueue.some((item) => item.key === current.key));
    const button = state.rail.querySelector(".happy-browser-queue-button");
    state.rail.dataset.queuedCurrent = String(queuedCurrent);
    state.rail.dataset.queueCount = String(state.attentionQueue.length);

    if (button) {
      const label = queuedCurrent ? `Queued for attention (${state.attentionQueue.length})` : `Queue current item for attention (${state.attentionQueue.length})`;
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    }
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
      inspectionRow("Queue", formatAttentionQueue()),
      inspectionRow("Tray", formatLinkTray()),
      inspectionRow("RA filter", formatRaFilterStatus()),
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

  function formatAttentionQueue() {
    const current = getAttentionQueueItem(getFocusedPost());
    const queuedCurrent = Boolean(current && state.attentionQueue.some((item) => item.key === current.key));
    const label = queuedCurrent ? "current queued" : "current not queued";
    return `${state.attentionQueue.length} item${state.attentionQueue.length === 1 ? "" : "s"}; ${label}`;
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
    if (window.__happyBrowserTestHooksRequested) {
      return;
    }

    const now = Date.now();
    const elapsed = now - (state.raFilter.lastDetailRequestAt || 0);
    if (elapsed > 0 && elapsed < RA_DETAIL_REQUEST_MIN_INTERVAL_MS) {
      await delay(RA_DETAIL_REQUEST_MIN_INTERVAL_MS - elapsed);
    }
    state.raFilter.lastDetailRequestAt = Date.now();
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
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
    const text = [
      doc.title || "",
      doc.body ? getCompactText(doc.body).slice(0, 3000) : "",
      String(html || "").slice(0, 4000)
    ].join("\n");
    return Boolean(
      doc.querySelector("iframe[src*='captcha-delivery.com'], iframe[src*='datadome']") ||
      /captcha-delivery\.com|geo\.captcha|datadome/i.test(String(html || "")) ||
      /captcha|verify\s+that\s+you\s+are\s+human|verify\s+you\s+are\s+human|blocked/i.test(text)
    );
  }

  function makeRaAntiBotError(source) {
    const error = new Error("RA detail blocked by anti-bot challenge");
    error.happyRaSource = source || "blocked";
    error.happyRaAntiBot = true;
    return error;
  }

  function isRaAntiBotError(error) {
    return Boolean(error && error.happyRaAntiBot);
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
    return RA_LGBTQ_PATTERNS
      .filter((entry) => entry.pattern.test(text || ""))
      .map((entry) => entry.label);
  }

  function getRaSignalEvidence(text, signals) {
    const source = String(text || "").replace(/\s+/g, " ").trim();
    if (!source || !Array.isArray(signals) || !signals.length) {
      return [];
    }

    return signals
      .map((signal) => {
        const entry = RA_LGBTQ_PATTERNS.find((item) => item.label === signal);
        const match = entry && source.match(entry.pattern);
        if (!match || match.index === undefined) {
          return null;
        }

        return {
          label: signal,
          match: match[0],
          excerpt: makeRaEvidenceExcerpt(source, match.index, match[0].length)
        };
      })
      .filter(Boolean)
      .slice(0, 4);
  }

  function makeRaEvidenceExcerpt(text, index, length) {
    const radius = 96;
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + length + radius);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < text.length ? "..." : "";
    return `${prefix}${text.slice(start, end).trim()}${suffix}`;
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

    try {
      const raw = window.localStorage && window.localStorage.getItem(RA_SIGNAL_CONFIRMATIONS_STORAGE_KEY);
      state.raFilter.confirmedSignals = raw ? JSON.parse(raw) || {} : {};
    } catch (_error) {
      state.raFilter.confirmedSignals = {};
    }
    return state.raFilter.confirmedSignals;
  }

  function saveRaSignalConfirmations(confirmations) {
    state.raFilter.confirmedSignals = confirmations || {};
    try {
      if (window.localStorage) {
        window.localStorage.setItem(RA_SIGNAL_CONFIRMATIONS_STORAGE_KEY, JSON.stringify(state.raFilter.confirmedSignals));
      }
    } catch (_error) {
      // Confirmation is still reflected in-memory for this page.
    }
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

  function getCompactText(element) {
    return String(element && (element.innerText || element.textContent) || "")
      .replace(/\s+/g, " ")
      .trim();
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
