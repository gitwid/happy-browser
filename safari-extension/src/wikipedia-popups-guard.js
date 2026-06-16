(function disableWikipediaNativePopups() {
  if (window.top !== window || window.__happyWikiPopupsGuardLoaded) {
    return;
  }

  window.__happyWikiPopupsGuardLoaded = true;

  try {
    localStorage.setItem("mwe-popups-enabled", "0");
  } catch (error) {
    // Storage can be blocked in private browsing.
  }

  const removePopups = () => {
    document.querySelectorAll(
      "#mwe-popups-container, .mwe-popups, .popups-card, .mwe-popups-fade-in-up, .mwe-popups-fade-in-down"
    ).forEach((node) => {
      node.remove();
    });
  };

  removePopups();

  if (document.documentElement) {
    new MutationObserver(removePopups).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } else {
    document.addEventListener("DOMContentLoaded", removePopups, { once: true });
  }
})();
