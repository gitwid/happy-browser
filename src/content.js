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
    attentionQueue: [],
    linkTray: [],
    linkTrayDragItem: null,
    linkTrayCaptureArmed: false,
    workTree: [],
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

    .happy-browser-work-tree {
      position: fixed;
      left: 14px;
      bottom: 16px;
      width: min(278px, calc(100vw - 28px));
      max-height: calc(50vh - 24px);
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 8px;
      background: rgba(18, 24, 28, 0.46);
      box-shadow: 0 18px 46px rgba(0, 0, 0, 0.24);
      color: #f8fbff;
      opacity: 0.62;
      overflow: auto;
      pointer-events: auto;
      transform: translateX(calc(-100% + 42px));
      transition: background 160ms ease, border-color 160ms ease, bottom 180ms ease, left 180ms ease, opacity 160ms ease, transform 180ms ease;
      backdrop-filter: blur(18px);
    }

    .happy-browser-work-tree:hover,
    .happy-browser-work-tree:focus-within,
    #happy-browser-rail[data-work-tree-count]:not([data-work-tree-count="0"]) .happy-browser-work-tree {
      opacity: 0.98;
      transform: translateX(0);
    }

    #happy-browser-rail[data-idle="true"] .happy-browser-work-tree {
      left: 8px;
      opacity: 0.14;
      transform: translateX(calc(-100% + 22px));
    }

    #happy-browser-rail[data-idle="true"] .happy-browser-work-tree:hover,
    #happy-browser-rail[data-idle="true"] .happy-browser-work-tree:focus-within {
      opacity: 0.98;
      transform: translateX(0);
    }

    .happy-browser-work-tree__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 0 8px;
    }

    .happy-browser-work-tree__title {
      margin: 0;
      color: rgba(248, 251, 255, 0.78);
      font-size: 11px;
      font-weight: 760;
      line-height: 1;
      text-transform: uppercase;
    }

    .happy-browser-work-tree__clear {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.06);
      color: #f8fbff;
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
    }

    .happy-browser-work-tree__clear:hover,
    .happy-browser-work-tree__clear:focus-visible {
      background: rgba(70, 24, 24, 0.6);
      outline: none;
    }

    .happy-browser-work-tree__list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .happy-browser-work-tree__empty {
      color: rgba(248, 251, 255, 0.5);
      font-size: 11px;
      font-style: italic;
    }

    .happy-browser-work-tree__step {
      display: flex;
      align-items: baseline;
      gap: 7px;
      padding: 5px 7px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 11px;
      line-height: 1.25;
    }

    .happy-browser-work-tree__index {
      flex: 0 0 auto;
      min-width: 16px;
      color: rgba(248, 251, 255, 0.5);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .happy-browser-work-tree__body {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .happy-browser-work-tree__kind {
      color: rgba(112, 243, 178, 0.86);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .happy-browser-work-tree__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .happy-browser-work-tree__href {
      color: rgba(248, 251, 255, 0.5);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .happy-browser-work-tree__count {
      flex: 0 0 auto;
      align-self: center;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(112, 243, 178, 0.18);
      color: rgba(112, 243, 178, 0.96);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
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

  const linkTray = window.HappyBrowser.registerLinkTray({
    state,
    announce,
    updateInspector,
    escapeHtml,
    getCompactText,
    LINK_TRAY_STORAGE_KEY,
    LINK_TRAY_MAX_ITEMS,
    LINK_TRAY_DRAG_MIME
  });

  const raFilter = window.HappyBrowser.registerRaFilter({
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
  });

  const workTree = window.HappyBrowser.registerWorkTree({
    state,
    announce,
    updateInspector,
    escapeHtml
  });

  if (window.__happyBrowserTestHooksRequested) {
    window.__HappyBrowserTestHooks = {
      capturePageSnapshot,
      didPageAdvance,
      getAttentionQueueItem,
      getFeedNavigationAction,
      getFeedPosts,
      getFocusedPost,
      getAdjacentPost,
      getRaEventCards: raFilter.getRaEventCards,
      getRaFilterStatus: () => state.raFilter.status,
      getRaFilterMode: () => state.raFilter.enabled ? state.raFilter.mode : "all",
      getRaProofCard: () => state.raFilter.proofHost,
      getRaSignalConfirmations: raFilter.getRaSignalConfirmations,
      isRaBerlinEventsPage: raFilter.isRaBerlinEventsPage,
      parseRaEventDetailHtml: raFilter.parseRaEventDetailHtml,
      readRaFrameDetailWhenReady: raFilter.readRaFrameDetailWhenReady,
      runRaLgbtqFilter: raFilter.runRaLgbtqFilter,
      toggleRaFilter: raFilter.toggleRaFilter,
      queueFocusedPost,
      getAttentionQueue: () => state.attentionQueue,
      queueLinkTrayItem: linkTray.queueLinkTrayItem,
      clearLinkTray: linkTray.clearLinkTray,
      getLinkTrayItemFromElement: linkTray.getLinkTrayItemFromElement,
      getLinkTrayItemFromAnchor: linkTray.getLinkTrayItemFromAnchor,
      getLinkTrayItems: () => state.linkTray,
      recordWorkTreeInteraction: workTree.recordInteraction,
      getWorkTreeSteps: workTree.getWorkTreeSteps,
      clearWorkTree: workTree.clearWorkTree,
      getVisibleMediaSignature
    };
  }

  loadSettings();
  loadAttentionQueue();
  linkTray.loadLinkTray();
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
    const linkTrayEl = linkTray.makeLinkTray();
    const workTreeEl = workTree.makeWorkTreePanel();
    const raFilterEl = raFilter.makeRaFilterButton();
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

    rail.append(previous, next, toggle, queue, linkTrayEl, workTreeEl, raFilterEl, raMode, raProgress, version, status, inspector);
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
    linkTray.applyLinkTrayState();
    workTree.applyWorkTreeState();
    raFilter.updateRaFilterUi();
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
    document.addEventListener("mouseover", raFilter.onRaProofHoverStart, true);
    document.addEventListener("mouseout", raFilter.onRaProofHoverEnd, true);
    document.addEventListener("pointermove", onMouseActivity, true);
    document.addEventListener("dragstart", linkTray.onPageDragStart, true);
    document.addEventListener("dragend", linkTray.onPageDragEnd, true);
    document.addEventListener("wheel", onWheel, { passive: true, capture: true });
    document.addEventListener("click", linkTray.onLinkTrayCaptureClick, true);
    document.addEventListener("click", workTree.onWorkTreeClick, true);
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
    applyQueueState();
    raFilter.maybeRunRaFilter();
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
      inspectionRow("Tray", linkTray.formatLinkTray()),
      inspectionRow("Work tree", workTree.formatWorkTree()),
      inspectionRow("RA filter", raFilter.formatRaFilterStatus()),
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

  function getCompactText(element) {
    return String(element && (element.innerText || element.textContent) || "")
      .replace(/\s+/g, " ")
      .trim();
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
