const defaults = {
  happyEnabled: true,
  railEnabled: true,
  wikiLinkPreviewEnabled: true,
  wikiPeekGlanceOpacity: 0.75,
  debug: false
};

const happyEnabled = document.querySelector("#happyEnabled");
const railEnabled = document.querySelector("#railEnabled");
const wikiLinkPreviewEnabled = document.querySelector("#wikiLinkPreviewEnabled");
const wikiPeekGlanceField = document.querySelector("#wikiPeekGlanceField");
const wikiPeekGlanceOpacity = document.querySelector("#wikiPeekGlanceOpacity");
const wikiPeekGlanceOpacityValue = document.querySelector("#wikiPeekGlanceOpacityValue");
const debug = document.querySelector("#debug");
const status = document.querySelector("#status");

function percentToOpacity(percent) {
  return Math.min(0.92, Math.max(0.08, Number(percent) / 100));
}

function opacityToPercent(opacity) {
  return Math.round(Math.min(0.92, Math.max(0.08, Number(opacity))) * 100);
}

function updateGlanceOpacityLabel() {
  wikiPeekGlanceOpacityValue.textContent = `${wikiPeekGlanceOpacity.value}%`;
}

function syncWikiPeekControls() {
  const enabled = wikiLinkPreviewEnabled.checked;
  wikiPeekGlanceOpacity.disabled = !enabled;
  wikiPeekGlanceField.classList.toggle("is-disabled", !enabled);
}

chrome.storage.sync.get(defaults, (settings) => {
  happyEnabled.checked = Boolean(settings.happyEnabled);
  railEnabled.checked = Boolean(settings.railEnabled);
  wikiLinkPreviewEnabled.checked = Boolean(settings.wikiLinkPreviewEnabled);
  wikiPeekGlanceOpacity.value = String(opacityToPercent(settings.wikiPeekGlanceOpacity));
  debug.checked = Boolean(settings.debug);
  updateGlanceOpacityLabel();
  syncWikiPeekControls();
});

happyEnabled.addEventListener("change", save);
railEnabled.addEventListener("change", save);
wikiLinkPreviewEnabled.addEventListener("change", () => {
  syncWikiPeekControls();
  save();
});
wikiPeekGlanceOpacity.addEventListener("input", () => {
  updateGlanceOpacityLabel();
  save();
});
debug.addEventListener("change", save);

function save() {
  chrome.storage.sync.set({
    happyEnabled: happyEnabled.checked,
    railEnabled: railEnabled.checked,
    wikiLinkPreviewEnabled: wikiLinkPreviewEnabled.checked,
    wikiPeekGlanceOpacity: percentToOpacity(wikiPeekGlanceOpacity.value),
    debug: debug.checked
  }, () => {
    status.textContent = "Saved";
    setTimeout(() => {
      status.textContent = "";
    }, 1200);
  });
}
