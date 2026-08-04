# Save as MD

A small open-source browser extension that saves content straight to a
Markdown file — no copy-pasting, no asking the model to reformat.

Two ways to use it:

- **Response button** — a folder "Save as MD" button next to the existing Copy
  button on AI chat responses (Claude, ChatGPT, Grok, Kimi, Qwen, and any other
  site whose Copy button the generic heuristic recognises).
- **Selection popup** — select any text **on any website**, not just the AI
  chat sites above — a "Save as MD" popup appears right at the start of the
  highlight; click it to download just that selection as its own `.md` file.
  This works everywhere because the extension runs on all `http(s)` pages;
  see [Site access](#site-access).

## Install (unpacked, Chrome/Edge/Brave)

1. Download or clone this folder.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Two things to try:
   - On a chat site, hover a response — a folder icon appears directly to the
     right of Copy. Hovering it shows "Save as MD"; clicking it downloads that
     response as a `.md` file.
   - On **any** page — this README on GitHub, a Wikipedia article, an email —
     select some text. A "Save as MD" popup appears at the start of the
     selection; click it to download just that text as Markdown.

### Site access

The content script runs on **all `http(s)` sites** (`matches: http://*/*`,
`https://*/*`), so the selection popup and the generic Copy-button detection
work everywhere, not only on the hand-tuned sites. Chrome will show the
extension's site access as "On all sites". There is still no `permissions`
entry: no network access, no `downloads`, no storage.

Trade-off of running everywhere: the generic detector keys off buttons
labelled "copy", so an occasional non-AI site may show a Save-as-MD button
next to an unrelated Copy control. Per-site adapters in `src/adapters.js`
take priority wherever they exist.

Firefox: rename `manifest.json`'s `content_scripts` block should work as-is
under `about:debugging` → "Load Temporary Add-on" (select `manifest.json`).
Full AMO packaging isn't set up yet — PRs welcome.

## How it works

- `src/adapters.js` — per-site logic for finding the existing Copy button and
  the response's content container. Falls back to a generic heuristic
  (any button labeled "copy", walking up the DOM for the message container)
  if a site's specific selectors don't match — so it degrades gracefully
  when a site ships a redesign, but works best once tuned.
- `src/content.js` — watches the page for new responses (MutationObserver),
  injects the button into the same toolbar as Copy, and on click clones the
  response HTML, converts it to Markdown with [Turndown](https://github.com/mixmark-io/turndown)
  (+ GFM plugin for tables/strikethrough), and downloads it as a `.md` file.
- `src/button.css` — button, tooltip and selection-popup styling. Site-specific
  fixes are scoped through the `data-samd-site` attribute that `content.js`
  sets on `<html>`, so a fix for one site can never affect another. Currently
  one such fix exists: on Claude the response action bar fades in on hover, and
  the rule forces the ancestors of the injected button to stay visible.
- No `downloads` permission needed — it just triggers a normal `<a download>`
  click, same as any webpage-initiated download.
- No network requests, no analytics, no declared permissions at all.

## Per-site status

The selectors for ChatGPT, Claude, Grok, Kimi and Qwen were captured from each
site's live DOM — see **SITE-STATUS.md** for the current state, the reasoning
behind each selector, and the traps found along the way. The raw captures live
in `docs/dom-captures/`.

If a button stops appearing, run `__samd()` in the browser console: it reports
which adapter matched, how many Copy buttons were found, how many buttons were
injected, and the container it resolved. **DEVTOOLS-CHECKLIST.md** covers how
to recapture the markup.

## Repo layout

```
manifest.json          MV3 manifest (content script, no permissions)
src/adapters.js        per-site Copy-button + container selectors
src/content.js         injection, Markdown conversion, selection popup
src/button.css         button, tooltip, popup, per-site fixes
vendor/                Turndown + GFM plugin (MIT, vendored, unmodified)
docs/dom-captures/     DevTools snapshots backing the selectors
SITE-STATUS.md         what works per site and why
DEVTOOLS-CHECKLIST.md  how to capture markup for a new/broken site
```

## Known limitations / good first issues

- Selectors in `adapters.js` are best-effort and **will** break when a site
  redesigns its UI. If the button stops appearing, that's almost always the
  fix needed — update or add a selector for that site.
- Filenames are derived from the first line of the converted Markdown; feel
  free to improve the heuristic (e.g. use conversation title from the page).
- Only tested on desktop Chrome. Firefox/Safari packaging not done yet.
- Images/code blocks: Turndown handles fenced code blocks and GFM tables;
  inline math (LaTeX) rendering varies by site and may need a custom rule.

## Contributing

Open an issue or PR. If a site's button stopped appearing, include:
1. The site + rough date you noticed it break.
2. A screenshot or the outerHTML snippet around the Copy button (DevTools →
   right-click the button → Copy → Copy outerHTML).

## License

MIT — see `LICENSE`.

`vendor/turndown.js` and `vendor/turndown-plugin-gfm.js` are vendored
unmodified from [Turndown](https://github.com/mixmark-io/turndown) by Dom
Christie, also MIT. They are committed rather than installed so the folder can
be loaded unpacked with no build step.
