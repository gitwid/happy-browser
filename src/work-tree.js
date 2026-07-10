// Happy Browser — Automator Work Tree (read-only slice).
//
// A first, deliberately non-replaying slice of the "Automator Work Tree" concept in
// docs/product-notes.md. It passively observes VISIBLE user intent — clicked links,
// buttons, and focusable controls — and renders them as a compact, inspectable work
// tree in the rail. Consecutive identical actions collapse into one grouped step with a
// count (evidence-based collapse: same target signature only), matching the doctrine's
// pill-box / blister-pack shape.
//
// Read-only on purpose: it records and DISPLAYS, and never replays. There is no macro
// execution here, honouring the preview-before-act rule; replay is a later, separate
// slice that will need before/after state signatures and a recovery path.
//
// Seeded by the Link Tray. Registered as window.HappyBrowser.registerWorkTree(ctx).
(function () {
  "use strict";
  const HB = (window.HappyBrowser = window.HappyBrowser || {});
  HB.registerWorkTree = function registerWorkTree(ctx) {
    const { state, announce, updateInspector, escapeHtml } = ctx;
    const WORK_TREE_MAX_STEPS = 24;

    function makeWorkTreePanel() {
      const panel = document.createElement("section");
      panel.className = "happy-browser-work-tree";
      panel.setAttribute("aria-label", "Work tree");
      panel.innerHTML = [
        '<div class="happy-browser-work-tree__header">',
        '<h2 class="happy-browser-work-tree__title">Work tree</h2>',
        '<button type="button" class="happy-browser-work-tree__clear" aria-label="Clear work tree" title="Clear work tree">x</button>',
        '</div>',
        '<ol class="happy-browser-work-tree__list"></ol>'
      ].join("");
      const clear = panel.querySelector(".happy-browser-work-tree__clear");
      if (clear) {
        clear.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          clearWorkTree();
        });
      }
      return panel;
    }

    // Passive, capture-phase observer. Never calls preventDefault — it only watches.
    function onWorkTreeClick(event) {
      const target = event.target && event.target.nodeType === Node.ELEMENT_NODE ? event.target : null;
      if (!target) {
        return;
      }
      // Ignore interactions with Happy Browser's own rail UI.
      if (state.railHost && state.railHost.contains(target)) {
        return;
      }
      const actionable = target.closest(
        "a[href], button, [role='button'], input[type='submit'], input[type='button'], summary"
      );
      if (!actionable) {
        return;
      }
      recordInteraction(actionable);
    }

    function recordInteraction(element) {
      const step = describeStep(element);
      if (!step) {
        return;
      }
      const steps = state.workTree;
      const last = steps[steps.length - 1];
      if (last && last.signature === step.signature) {
        // Collapse follows evidence, not wishful similarity: only identical target
        // signatures merge, and we keep a visible count.
        last.count += 1;
        last.at = step.at;
      } else {
        steps.push(step);
        if (steps.length > WORK_TREE_MAX_STEPS) {
          steps.splice(0, steps.length - WORK_TREE_MAX_STEPS);
        }
      }
      applyWorkTreeState();
      updateInspector();
    }

    function describeStep(element) {
      const kind = getStepKind(element);
      if (!kind) {
        return null;
      }
      const label = getStepLabel(element) || kind;
      const href = kind === "link" ? normalizeHref(element.getAttribute("href")) : "";
      const signature = [kind, label.toLowerCase(), href].join("|");
      return { kind, label, href, signature, count: 1, at: Date.now() };
    }

    function getStepKind(element) {
      const tag = element.tagName ? element.tagName.toLowerCase() : "";
      if (tag === "a" && element.getAttribute("href")) {
        return "link";
      }
      if (tag === "button" || element.getAttribute("role") === "button") {
        return "button";
      }
      if (tag === "summary") {
        return "disclosure";
      }
      if (tag === "input") {
        const type = (element.getAttribute("type") || "").toLowerCase();
        if (type === "submit" || type === "button") {
          return "button";
        }
      }
      return "control";
    }

    function getStepLabel(element) {
      const text = String((element.innerText || element.textContent) || "")
        .replace(/\s+/g, " ")
        .trim();
      if (text) {
        return text.slice(0, 60);
      }
      const aria = element.getAttribute("aria-label") || element.getAttribute("title") || "";
      return aria.replace(/\s+/g, " ").trim().slice(0, 60);
    }

    // Same-origin steps keep a compact path+query; cross-origin keep the full href so the
    // step stays unambiguous when reviewed.
    function normalizeHref(href) {
      if (!href) {
        return "";
      }
      try {
        const url = new URL(href, window.location.href);
        return url.origin === window.location.origin ? url.pathname + url.search : url.href;
      } catch (_error) {
        return String(href);
      }
    }

    function clearWorkTree() {
      state.workTree = [];
      applyWorkTreeState();
      updateInspector();
      announce("Work tree cleared");
    }

    function applyWorkTreeState() {
      if (!state.rail) {
        return;
      }
      state.rail.dataset.workTreeCount = String(state.workTree.length);
      const list = state.rail.querySelector(".happy-browser-work-tree__list");
      if (!list) {
        return;
      }
      list.textContent = "";
      if (!state.workTree.length) {
        const empty = document.createElement("li");
        empty.className = "happy-browser-work-tree__empty";
        empty.textContent = "Watching…";
        list.appendChild(empty);
        return;
      }
      state.workTree.forEach((step, index) => {
        list.appendChild(renderWorkTreeStep(step, index));
      });
    }

    function renderWorkTreeStep(step, index) {
      const item = document.createElement("li");
      item.className = "happy-browser-work-tree__step";
      item.dataset.kind = step.kind;
      const detail = step.href
        ? `<span class="happy-browser-work-tree__href">${escapeHtml(step.href)}</span>`
        : "";
      const count = step.count > 1
        ? `<span class="happy-browser-work-tree__count" title="Repeated ${step.count} times">×${step.count}</span>`
        : "";
      item.innerHTML = [
        `<span class="happy-browser-work-tree__index">${index + 1}</span>`,
        '<span class="happy-browser-work-tree__body">',
        `<span class="happy-browser-work-tree__kind">${escapeHtml(step.kind)}</span>`,
        `<span class="happy-browser-work-tree__label">${escapeHtml(step.label)}</span>`,
        detail,
        '</span>',
        count
      ].join("");
      const title = `${step.kind}: ${step.label}${step.href ? " → " + step.href : ""}` +
        `${step.count > 1 ? " (×" + step.count + ")" : ""}`;
      item.setAttribute("title", title);
      return item;
    }

    function formatWorkTree() {
      const steps = state.workTree;
      const total = steps.reduce((sum, step) => sum + step.count, 0);
      const extra = total !== steps.length ? ` (${total} actions)` : "";
      return `${steps.length} step${steps.length === 1 ? "" : "s"}${extra}`;
    }

    function getWorkTreeSteps() {
      return state.workTree.map((step) => ({ ...step }));
    }

    return {
      makeWorkTreePanel,
      applyWorkTreeState,
      onWorkTreeClick,
      recordInteraction,
      clearWorkTree,
      formatWorkTree,
      getWorkTreeSteps
    };
  };
})();
