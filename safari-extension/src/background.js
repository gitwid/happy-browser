chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "happy-browser-fetch-ra-detail") {
    return false;
  }

  fetchRaDetail(message.href)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    });
  return true;
});

async function fetchRaDetail(href) {
  const url = normalizeRaDetailUrl(href);
  if (!url) {
    throw new Error("Unsupported RA detail URL");
  }

  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store"
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text
  };
}

function normalizeRaDetailUrl(href) {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.hostname !== "ra.co" || !/^\/events\/\d+\/?$/.test(url.pathname)) {
      return "";
    }
    url.search = "";
    url.hash = "";
    return url.href;
  } catch (_error) {
    return "";
  }
}
