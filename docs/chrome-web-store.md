# Chrome Web Store Submission Draft

## Listing

Name: Happy Browser

Short description:

Navigate pages with arrows, gestures, and large next/previous controls.

Detailed description:

Happy Browser makes ordinary websites easier to move through.

It adds simple previous and next controls to pages such as search results, listings, galleries, archives, and paginated articles. Use the left and right arrow keys, horizontal two-finger scroll gestures, or the large floating buttons.

Happy Browser analyzes each page locally to find likely navigation controls such as next, previous, and load-more buttons. When it is not confident, it avoids claiming the page is ready.

Features:

- Left/right keyboard navigation.
- Horizontal gesture navigation.
- Large draggable page controls.
- Draggable on/off toggle.
- Local detection of next, previous, and load-more controls.
- Scroll fallback when a page has no reliable navigation target.
- Options for visibility and debug logging.

## Single Purpose

Happy Browser helps users move through paginated web pages using keyboard shortcuts, gestures, and floating previous/next controls.

## Permission Justification

Storage:

Used to save extension preferences, including whether Happy navigation is enabled, whether the floating rail is shown, and whether debug logging is enabled.

Site access for `http://*/*` and `https://*/*` content scripts:

Required so Happy Browser can inspect visible page structure locally and find previous, next, and load-more controls on ordinary websites. This analysis happens inside the browser. Happy Browser does not transmit page content, browsing history, URLs, clicks, form values, or navigation analysis to a server.

## Privacy Practices Answers

Data collection:

Happy Browser does not collect user data.

Data sale or transfer:

Happy Browser does not sell user data and does not share user data with advertisers, analytics providers, data brokers, or other third parties.

Remote code:

Happy Browser does not load or execute remote code. The extension logic is packaged with the extension.

Privacy policy URL:

Use the public URL for `PRIVACY.md` or the project website privacy-policy page. The page should match the current `PRIVACY.md` text before submission.

## First Publication Recommendation

Submit as unlisted for the first review if available. Use the unlisted item for tester install and review feedback before switching to public discovery.
