# Privacy Policy

Last updated: July 4, 2026

Happy Browser is a browser extension that helps users navigate websites with previous/next controls, keyboard shortcuts, gestures, and floating buttons.

## Data Processing

Happy Browser analyzes the structure of the web page you are currently viewing to find likely previous, next, and load-more controls. This analysis happens locally inside your browser.

Happy Browser does not send page content, browsing history, URLs, clicks, form values, or navigation analysis to a server operated by Happy Browser.

## Optional Network Requests

Some optional features request public web pages over HTTPS when you are already browsing a supported site. These requests behave like ordinary page loads initiated by the extension, not like telemetry or analytics:

- **Wikipedia link preview** (on `*.wikipedia.org` only): when you hover a Wikipedia article link, the extension may request the public Wikipedia parse API for that article title so it can show a local preview. No Happy Browser server is involved.
- **RA Berlin event filter** (on `ra.co/events/de/berlin` only, when you enable the filter): the extension may request individual public RA event detail pages you can already see listed on the page, so it can classify today's events locally. Requests are rate-limited, stay on `ra.co`, and use your existing browser session cookies only for those public pages. No Happy Browser server is involved.

If you do not use these features, or you are not on those pages, the extension does not make these requests.

## Data Stored

Happy Browser stores local extension preferences, such as whether the floating rail is enabled, whether debug logging is enabled, and whether Happy navigation is currently on.

If you use the attention queue, Happy Browser stores queued-item metadata in local extension storage, such as the page URL, an available post permalink, a short visible text snippet, media identifiers, and the time you queued the item. This queue is used only to help you revisit items later.

These settings are stored using the browser's extension storage APIs. Depending on your browser settings, the browser may sync extension preferences through your browser account.

## Data Sharing

Happy Browser does not sell user data.

Happy Browser does not share user data with advertisers, analytics providers, data brokers, or other third parties.

## Permissions

Happy Browser requests access to `http` and `https` pages because its core feature is to inspect the current page's visible controls and provide navigation assistance across ordinary websites.

Happy Browser requests storage permission to save extension preferences.

## Remote Code

Happy Browser does not load or execute remote code. The extension's logic is packaged with the extension.

## Future Features

Future versions may add opt-in teaching or reporting features. If those features collect or transmit any information, this policy will be updated before release and the product will clearly ask for consent where required.

## Contact

For privacy questions, use the support contact listed on the extension store page or project repository.
