const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

function makeContentDocument() {
  const dom = new JSDOM(`
    <!doctype html>
    <main>
      <article>
        <img id="slide" src="https://media.example.test/slide-a.jpg" data-width="480" data-height="600" alt="Slide A">
        <img id="avatar" src="https://media.example.test/avatar.jpg" data-width="32" data-height="32" alt="Avatar">
      </article>
    </main>
  `, {
    url: "https://social.example.test/p/abc/?img_index=3",
    pretendToBeVisual: true,
    runScripts: "outside-only"
  });

  const { window } = dom;
  window.__happyBrowserTestHooksRequested = true;
  window.HappyNavigationScoring = {
    analyzeNavigation() {
      return {
        state: "none",
        directions: {
          next: { best: null, confidence: "none", candidates: [] },
          previous: { best: null, confidence: "none", candidates: [] }
        }
      };
    }
  };
  window.chrome = {
    runtime: {
      getManifest() {
        return { version: "test" };
      }
    },
    storage: {
      sync: {
        get(defaults, callback) {
          callback(defaults);
        },
        set() {}
      },
      onChanged: {
        addListener() {}
      }
    }
  };

  window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.hidden || this.hasAttribute("hidden")) {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    }
    const width = Number(this.getAttribute("data-width")) || 96;
    const height = Number(this.getAttribute("data-height")) || 44;
    const left = Number(this.getAttribute("data-left")) || 10;
    const top = Number(this.getAttribute("data-top")) || 10;
    return { width, height, top, left, right: left + width, bottom: top + height };
  };

  const contentPath = path.join(__dirname, "..", "src", "content.js");
  window.eval(fs.readFileSync(contentPath, "utf8"));
  return dom;
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("media signature changes count as page advancement", () => {
  const dom = makeContentDocument();
  const { window } = dom;
  const hooks = window.__HappyBrowserTestHooks;

  assert.ok(hooks);
  const before = hooks.capturePageSnapshot();
  const slide = window.document.querySelector("#slide");
  slide.setAttribute("src", "https://media.example.test/slide-b.jpg");
  slide.setAttribute("alt", "Slide B");
  const after = hooks.capturePageSnapshot();

  assert.notEqual(before.mediaSignature, after.mediaSignature);
  assert.equal(hooks.didPageAdvance(before, after), true);
  dom.window.close();
});
