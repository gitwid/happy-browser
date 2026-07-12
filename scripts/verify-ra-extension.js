#!/usr/bin/env node

const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PACKAGED_EXTENSION = path.join(ROOT, "dist", "chrome");
const EXTENSION_PATH = fs.existsSync(path.join(PACKAGED_EXTENSION, "manifest.json")) ? PACKAGED_EXTENSION : ROOT;
const RA_URL = "https://ra.co/events/de/berlin";
const CONTROL_HTML = `<!doctype html><title>Happy Browser verifier</title><main><a href="/next">Next</a></main>`;
const BROWSER_PATH = process.env.HAPPY_VERIFY_BROWSER ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});

async function main() {
  if (!fs.existsSync(BROWSER_PATH)) {
    throw new Error(`Browser not found at ${BROWSER_PATH}`);
  }

  const port = await getFreePort();
  const controlServer = await startControlServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "happy-browser-ra-profile-"));
  const browserArgs = [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    `--load-extension=${EXTENSION_PATH}`,
    "--enable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-features=DisableLoadExtensionCommandLineSwitch,Translate",
    RA_URL
  ];
  if (process.env.HAPPY_VERIFY_LOAD_ONLY !== "1") {
    browserArgs.splice(2, 0, `--disable-extensions-except=${EXTENSION_PATH}`);
  }
  const chrome = childProcess.spawn(BROWSER_PATH, browserArgs, {
    detached: false,
    stdio: ["ignore", "ignore", "pipe"]
  });

  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += String(chunk);
    if (stderr.length > 12000) {
      stderr = stderr.slice(-12000);
    }
  });

  try {
    await waitForDevTools(port, 30000);
    const control = await verifyControlPage(port, controlServer.url);
    if (process.env.HAPPY_VERIFY_CONTROL_ONLY === "1") {
      console.log(JSON.stringify({
        extensionPath: EXTENSION_PATH,
        browserPath: BROWSER_PATH,
        control,
        targets: await listTargetSummary(port)
      }, null, 2));
      return;
    }
    const target = await waitForRaTarget(port, 45000);
    const client = await connectCdp(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Page.bringToFront");
      let result = await evaluateWithRetry(client, {
        expression: `(${pollRaFilter.toString()})()`,
        awaitPromise: true,
        returnByValue: true,
        timeout: 100000
      });
      let value = result.result && result.result.value;
      if (!value || !value.hasHappy || !value.hasHost) {
        await injectHappyBrowser(client);
        result = await evaluateWithRetry(client, {
          expression: `(${pollRaFilter.toString()})()`,
          awaitPromise: true,
          returnByValue: true,
          timeout: 100000
        });
        value = result.result && result.result.value;
        if (value) {
          value.mode = "cdp-injected-content-scripts";
        }
      } else {
        value.mode = "unpacked-extension";
      }
      value.extensionPath = EXTENSION_PATH;
      value.browserPath = BROWSER_PATH;
      value.control = control;
      value.targets = await listTargetSummary(port);
      console.log(JSON.stringify(value, null, 2));

      if (value.antiBotBlocked) {
        throw new Error("RA blocked the automated verification profile with an anti-bot challenge.");
      }
      if (!value || !value.hasHappy || !value.hasHost) {
        throw new Error("Happy Browser content script did not load on RA, even after verifier injection.");
      }
      if (!value.railState || value.railState.raPage !== "true" || value.railState.enabled !== "true") {
        throw new Error("RA filter rail state was not enabled.");
      }
      if (value.marked < 1) {
        throw new Error("RA filter did not mark any event cards.");
      }
      if (value.visibleMisses !== 0) {
        throw new Error("RA filter left nonmatching cards visible.");
      }
    } finally {
      client.close();
    }
  } catch (error) {
    if (stderr) {
      console.error(stderr);
    }
    throw error;
  } finally {
    chrome.kill();
    controlServer.close();
  }
}

function startControlServer() {
  return new Promise((resolve, reject) => {
    const server = require("node:http").createServer((request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(CONTROL_HTML);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close() {
          server.close();
        }
      });
    });
  });
}

async function verifyControlPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const target = await response.json();
  const client = await connectCdp(target.webSocketDebuggerUrl);
  try {
    await client.send("Runtime.enable");
    await delay(1500);
    const result = await client.send("Runtime.evaluate", {
      expression: "({ href: location.href, hasHappy: Boolean(window.__happyBrowserLoaded), hasHost: Boolean(document.querySelector('#happy-browser-shadow-host')) })",
      returnByValue: true
    });
    return result.result && result.result.value || null;
  } finally {
    client.close();
  }
}

function pollRaFilter() {
  return new Promise((resolve) => {
    const deadline = Date.now() + 90000;
    let firstDoneAt = 0;
    let lastStableKey = "";
    let stableTicks = 0;
    const readState = () => {
      const host = document.querySelector("#happy-browser-shadow-host");
      const rail = host && host.shadowRoot && host.shadowRoot.querySelector("#happy-browser-rail");
      const button = rail && rail.querySelector(".happy-browser-ra-filter-button");
      const cards = Array.from(document.querySelectorAll("[data-testid='event-upcoming-card']")).slice(0, 160).map((card) => ({
        mark: card.getAttribute("data-happy-ra-filter") || "",
        today: card.getAttribute("data-happy-ra-today") || "",
        signals: card.getAttribute("data-happy-ra-signals") || "",
        display: getComputedStyle(card).display,
        text: (card.innerText || "").replace(/\s+/g, " ").trim().slice(0, 220)
      }));
      const matches = cards.filter((card) => card.mark === "match");
      const misses = cards.filter((card) => card.mark === "miss");
      const unknown = cards.filter((card) => card.mark === "unknown");
      const visibleMisses = misses.filter((card) => card.display !== "none");
      return {
        href: location.href,
        title: document.title,
        hasHappy: Boolean(window.__happyBrowserLoaded),
        hasHost: Boolean(host),
        railState: rail ? {
          raPage: rail.dataset.raPage,
          enabled: rail.dataset.raFilterEnabled,
          running: rail.dataset.raFilterRunning,
          matched: rail.dataset.raFilterMatched,
          today: rail.dataset.raFilterToday,
          hidden: rail.dataset.raFilterHidden,
          unknown: rail.dataset.raFilterUnknown,
          title: button && button.getAttribute("title")
        } : null,
        cardCount: cards.length,
        marked: cards.filter((card) => card.mark).length,
        matches: matches.length,
        misses: misses.length,
        unknown: unknown.length,
        visibleMatches: matches.filter((card) => card.display !== "none").length,
        visibleMisses: visibleMisses.length,
        visibleUnknown: unknown.filter((card) => card.display !== "none").length,
        samples: matches.slice(0, 12),
        unknownSamples: unknown.slice(0, 12),
        visibleUnmarked: cards.filter((card) => !card.mark && card.display !== "none").slice(0, 12),
        antiBotBlocked: Boolean(
          document.querySelector("iframe[src*='captcha-delivery.com'], iframe[src*='datadome']") ||
          /captcha|verify you are human|datadome/i.test(document.title || "") ||
          /captcha|verify you are human|datadome/i.test((document.body && document.body.innerText || "").slice(0, 2000))
        )
      };
    };

    const timer = setInterval(() => {
      const state = readState();
      if (state.antiBotBlocked) {
        clearInterval(timer);
        resolve(state);
        return;
      }

      const done = state.hasHappy &&
        state.hasHost &&
        state.railState &&
        state.railState.raPage === "true" &&
        state.railState.enabled === "true" &&
        state.railState.running !== "true" &&
        state.marked > 0;
      if (done) {
        if (!firstDoneAt) {
          firstDoneAt = Date.now();
        }
        const stableKey = [
          state.railState.title,
          state.marked,
          state.matches,
          state.misses,
          state.unknown,
          state.visibleMatches,
          state.visibleMisses,
          state.visibleUnknown
        ].join("|");
        if (stableKey === lastStableKey) {
          stableTicks += 1;
        } else {
          lastStableKey = stableKey;
          stableTicks = 0;
        }
      }

      if ((done && Date.now() - firstDoneAt > 2500 && stableTicks >= 1) || Date.now() > deadline) {
        clearInterval(timer);
        resolve(state);
      }
    }, 1000);
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForDevTools(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Chrome is still starting.
    }
    await delay(350);
  }
  throw new Error("Timed out waiting for Chrome DevTools.");
}

async function waitForRaTarget(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await response.json();
    const target = targets.find((entry) => entry.type === "page" && entry.url && entry.url.startsWith(RA_URL)) ||
      targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
    if (target && target.webSocketDebuggerUrl) {
      return target;
    }
    await delay(350);
  }
  throw new Error("Timed out waiting for RA tab.");
}

async function listTargetSummary(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await response.json();
    return targets.map((entry) => ({
      type: entry.type,
      title: entry.title,
      url: String(entry.url || "").slice(0, 180)
    }));
  } catch (_error) {
    return [];
  }
}

async function injectHappyBrowser(client) {
  // Content scripts in manifest order: feature modules register onto
  // window.HappyBrowser and must load before content.js.
  const scriptFiles = ["navigation-scoring.js", "navigation-rail.js", "site-filter.js", "link-tray.js", "work-tree.js", "ra-filter.js", "content.js"];
  await evaluateOrThrow(client, {
    expression: `
      window.chrome = window.chrome || {};
      window.chrome.runtime = window.chrome.runtime || {};
      window.chrome.runtime.getManifest = function getManifest() {
        return { version: "verify" };
      };
      window.chrome.runtime.sendMessage = function sendMessage(message, callback) {
        if (!message || message.type !== "happy-browser-fetch-ra-detail") {
          if (callback) callback({ ok: false, error: "Unsupported verifier message" });
          return;
        }
        fetch(message.href, { credentials: "include" })
          .then(async (response) => {
            const text = await response.text();
            if (callback) callback({ ok: response.ok, status: response.status, text: response.ok ? text : "" });
          })
          .catch((error) => {
            if (callback) callback({ ok: false, error: error && error.message ? error.message : String(error) });
          });
      };
      window.chrome.storage = {
        sync: {
          get(defaults, callback) { callback(defaults || {}); },
          set() {}
        },
        local: {
          get(defaults, callback) { callback(defaults || {}); },
          set(_values, callback) { if (callback) callback(); }
        },
        onChanged: {
          addListener() {}
        }
      };
      true;
    `,
    awaitPromise: true,
    returnByValue: true
  });
  for (const file of scriptFiles) {
    const source = fs.readFileSync(path.join(EXTENSION_PATH, "src", file), "utf8");
    await evaluateOrThrow(client, {
      expression: `eval(${JSON.stringify(`${source}\n//# sourceURL=happy-browser-${file}`)})`,
      awaitPromise: true,
      returnByValue: true
    });
  }
}

async function evaluateOrThrow(client, params) {
  const result = await client.send("Runtime.evaluate", params);
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    const text = details.exception && details.exception.description || details.text || "Runtime evaluation failed";
    throw new Error(text);
  }
  return result;
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
    } else {
      resolve(message.result || {});
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((sendResolve, sendReject) => {
            pending.set(id, { resolve: sendResolve, reject: sendReject });
          });
        },
        close() {
          socket.close();
        }
      });
    });
    socket.addEventListener("error", () => reject(new Error("Failed to connect to Chrome DevTools.")), { once: true });
  });
}

async function evaluateWithRetry(client, params) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (attempt > 0) {
        await delay(2500);
      }
      return await client.send("Runtime.evaluate", params);
    } catch (error) {
      lastError = error;
      if (!/context was destroyed|Cannot find context|Inspected target navigated/i.test(error.message || "")) {
        throw error;
      }
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
