const defaults = {
  happyEnabled: true,
  railEnabled: true,
  debug: false
};

const happyEnabled = document.querySelector("#happyEnabled");
const railEnabled = document.querySelector("#railEnabled");
const debug = document.querySelector("#debug");
const status = document.querySelector("#status");

chrome.storage.sync.get(defaults, (settings) => {
  happyEnabled.checked = Boolean(settings.happyEnabled);
  railEnabled.checked = Boolean(settings.railEnabled);
  debug.checked = Boolean(settings.debug);
});

happyEnabled.addEventListener("change", save);
railEnabled.addEventListener("change", save);
debug.addEventListener("change", save);

function save() {
  chrome.storage.sync.set({
    happyEnabled: happyEnabled.checked,
    railEnabled: railEnabled.checked,
    debug: debug.checked
  }, () => {
    status.textContent = "Saved";
    setTimeout(() => {
      status.textContent = "";
    }, 1200);
  });
}
