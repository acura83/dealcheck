# DealCheck: a guide to your files

## TrackPin price history update

Upload `history.js` and `trackpin.cjs` alongside the updated `index.html`, `search.js`, `styles.css`, and `server.cjs`. Keep all existing app files too. Set `TRACKPIN_API_KEY` in Render Environment; it stays on the server. No new packages are required.

Amazon results now have a history button. Direct Amazon.com product URLs supply an exact ASIN. If the shopping result has no Amazon product ID, paste the full Amazon.com product URL into the history control. Short links and name-only guesses are not used. Other retailers do not get Amazon history attached.

History shows TrackPin's recorded minimum, time-weighted average, normal price, latest recorded price, history span, and observation date when available. Missing fields stay unavailable. It does not change shopping prices or sorting, and does not claim a historical low is currently purchasable. Check the product title, size, seller, condition, and date before comparing.

Requests are on demand, cached for one hour per product, and simultaneous identical requests share one provider call. A 90-call daily per-process guard resets on UTC day changes or server restarts; it is not a persistent account-wide budget. TrackPin's account quota still applies. No tracking of new products or paid live checks is requested.

Run `node --test trackpin.test.cjs` in this folder for offline integration checks. A real hosted test with your key is still required; the key was not accessed during implementation.

This version organizes the existing AI-assisted app for learning. Refactoring does not change who wrote the original code. Keep an honest record of your own changes and AI assistance.

## Where to look

| File | Purpose | Start here |
| --- | --- | --- |
| `index.html` | Headings, search controls, results area, comparison tab | Find `Good deals. Clear decisions.` |
| `styles.css` | Colors, spacing, grids, phone layout | Find `.layout` or `#comparison-panel` |
| `search.js` | Search requests, price sorting, matching, recent searches | Find `readListedPrice`, then `rankOffers` |
| `comparison.js` | Selected items, prices, store links, comparison panel | Find `offerCosts`, then `renderSelectedOffers` |
| `page.js` | Back-to-top button | Read `updateBackTop` |
| `server.cjs` | Serves public files and calls SerpApi | Find `/api/search` |
| `package.json` | Defines how the server starts | Look at `scripts` |

## How a search works

1. Someone submits the HTML search form.
2. `search.js` sends the item name to `/api/search`.
3. `server.cjs` calls SerpApi using the private environment key.
4. `search.js` sorts and filters the returned offers, then creates the result cards.
5. A checked offer is added to `selectedOffers`; `comparison.js` redraws the bottom panel.

The browser files share some functions and variables. Their script tags must stay in this order: `search.js`, `comparison.js`, `page.js`. This is a simple organization for learning, not a change to JavaScript modules.

## Editing and previewing

- Open files in a text editor to read or edit them.
- Save and refresh the browser after making a change.
- Opening `index.html` directly previews the layout. Live shopping searches require the local server or hosted site.
- CSS rules stay in their original order to preserve the appearance. A later rule can override an earlier rule; media queries adjust the layout on smaller screens.

## Updating the hosted app

Upload **all** of these together to your existing repository: `index.html`, `styles.css`, `search.js`, `comparison.js`, `page.js`, `server.cjs`, and `package.json`. Uploading only the HTML will no longer be enough. Keep the existing `SERPAPI_KEY` in Render environment settings, never in these browser files.

The original files are backed up in the sibling `dealcheck-before-refactor` folder. That folder is a reference copy; do not deploy it as part of the app.

## Your first learning exercise

1. Open `page.js` and explain what `window.scrollY < 400` checks.
2. Predict what changing `400` to `200` will do.
3. Make that change yourself, save, scroll the page, and test your prediction.
4. Write down the change, the result, and any help you used.

Next, read the lowest-price sorting in `rankOffers`. Practice writing your own small sorting function with sample prices before modifying the live search logic.
