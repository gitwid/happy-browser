// Happy Browser — site-filter primitives.
//
// Site-agnostic building blocks extracted from the Resident Advisor (RA) queer-event
// filter so the next per-site filter (see the "Seam Surfing" / site-filter direction in
// docs/product-notes.md) can reuse the hard parts instead of re-deriving them:
//
//   • createRequestPacer  — rate-limited detail scanning (min interval between requests)
//   • isAntiBotHtml / makeAntiBotError / isAntiBotError — anti-bot fail-fast
//   • matchSignals / collectEvidence / makeEvidenceExcerpt — human-readable evidence
//   • readConfirmations / writeConfirmations — persisted human-confirmed signals
//
// Exposed as window.HappyBrowser.siteFilter. Pure and dependency-free: everything a
// specific site needs (its own DOM selectors, signal patterns, storage keys, state
// slots) is passed in, so this file carries no RA-specific knowledge.
(function () {
  "use strict";
  const HB = (window.HappyBrowser = window.HappyBrowser || {});

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  // Serialize detail requests with a minimum interval between them. The caller owns the
  // "last request at" timestamp (getLastAt/setLastAt) so it can live in the site's state
  // object; skip() lets tests bypass real pacing.
  function createRequestPacer(options) {
    const opts = options || {};
    const minIntervalMs = opts.minIntervalMs || 0;
    const getLastAt = typeof opts.getLastAt === "function" ? opts.getLastAt : () => 0;
    const setLastAt = typeof opts.setLastAt === "function" ? opts.setLastAt : () => {};
    const skip = typeof opts.skip === "function" ? opts.skip : () => false;
    return {
      async wait() {
        if (skip()) {
          return;
        }
        const now = Date.now();
        const elapsed = now - (getLastAt() || 0);
        if (elapsed > 0 && elapsed < minIntervalMs) {
          await delay(minIntervalMs - elapsed);
        }
        setLastAt(Date.now());
      }
    };
  }

  function compactText(node) {
    return String((node && (node.innerText || node.textContent)) || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Heuristic detector for common anti-bot / CAPTCHA interstitials (DataDome et al.).
  function isAntiBotHtml(doc, html) {
    const text = [
      doc.title || "",
      doc.body ? compactText(doc.body).slice(0, 3000) : "",
      String(html || "").slice(0, 4000)
    ].join("\n");
    return Boolean(
      doc.querySelector("iframe[src*='captcha-delivery.com'], iframe[src*='datadome']") ||
      /captcha-delivery\.com|geo\.captcha|datadome/i.test(String(html || "")) ||
      /captcha|verify\s+that\s+you\s+are\s+human|verify\s+you\s+are\s+human|blocked/i.test(text)
    );
  }

  function makeAntiBotError(source) {
    const error = new Error("Site detail blocked by anti-bot challenge");
    error.happyAntiBotSource = source || "blocked";
    error.happyAntiBot = true;
    return error;
  }

  function isAntiBotError(error) {
    return Boolean(error && error.happyAntiBot);
  }

  // patterns: array of { label, pattern } where pattern is a RegExp.
  function matchSignals(text, patterns) {
    if (!Array.isArray(patterns)) {
      return [];
    }
    return patterns
      .filter((entry) => entry.pattern.test(text || ""))
      .map((entry) => entry.label);
  }

  function makeEvidenceExcerpt(text, index, length) {
    const radius = 96;
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + length + radius);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < text.length ? "..." : "";
    return `${prefix}${text.slice(start, end).trim()}${suffix}`;
  }

  // For each matched signal, find where it occurred and return a trimmed excerpt around it.
  function collectEvidence(text, signals, patterns, limit) {
    const source = String(text || "").replace(/\s+/g, " ").trim();
    if (!source || !Array.isArray(signals) || !signals.length) {
      return [];
    }
    const patternList = Array.isArray(patterns) ? patterns : [];
    return signals
      .map((signal) => {
        const entry = patternList.find((item) => item.label === signal);
        const match = entry && source.match(entry.pattern);
        if (!match || match.index === undefined) {
          return null;
        }
        return {
          label: signal,
          match: match[0],
          excerpt: makeEvidenceExcerpt(source, match.index, match[0].length)
        };
      })
      .filter(Boolean)
      .slice(0, typeof limit === "number" ? limit : 4);
  }

  // Persisted human-confirmed signals, keyed per site. Reads/writes localStorage and never
  // throws (private-mode / disabled storage degrades to in-memory at the call site).
  function readConfirmations(storageKey) {
    try {
      const raw = window.localStorage && window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) || {} : {};
    } catch (_error) {
      return {};
    }
  }

  function writeConfirmations(storageKey, confirmations) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(storageKey, JSON.stringify(confirmations || {}));
      }
    } catch (_error) {
      // Caller keeps the in-memory copy; nothing else to do.
    }
  }

  HB.siteFilter = {
    delay,
    createRequestPacer,
    isAntiBotHtml,
    makeAntiBotError,
    isAntiBotError,
    matchSignals,
    makeEvidenceExcerpt,
    collectEvidence,
    readConfirmations,
    writeConfirmations
  };
})();
