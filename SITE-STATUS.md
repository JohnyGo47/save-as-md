# Per-site status (verified against captured DOM, 2026-08-02)

| Site | Copy button found via | Container anchor | Status |
| --- | --- | --- | --- |
| **Claude** | `data-testid="action-bar-copy"` | `[data-testid="message"]` | ✅ works |
| **ChatGPT** | `data-testid="copy-turn-action-button"` | `[data-message-author-role="assistant"]` | ✅ verified |
| **Grok** | `aria-label="Copy response"` | `.message-row` (NOT `response` — that class also lives on the button) | ✅ verified |
| **Kimi** | `svg[name="Copy"]` → `.icon-button` | `.segment-content` | ✅ verified |
| **Qwen** | `[class*="action-control-container-copy"]` (label is localized) | `.message-hoc-container` | ✅ verified |

## Notes captured while fixing

- **Kimi** was invisible before because its copy control is a `<div class="icon-button">`
  with no `role="button"` and no `aria-label`; the only signal is a child
  `<svg name="Copy">`. Handled by a custom `findCopyButtons` that selects the
  svg and climbs to `.icon-button`.
- **Grok** container: `[class*="response"]` is a trap — Grok stamps
  `last-response` onto the copy button itself, so `closest()` matched the
  button. Use `.message-row` instead.
- **ChatGPT / Grok tooltip clipping:** both action bars apply a
  `linear-gradient` mask on their top edge. A tooltip placed *above* the
  button gets cut off, so the tooltip now sits *below* the button.
  Follow-up: the mask on the action bar (`mask-image`) also creates a new
  CSS stacking context, so a nested tooltip's `z-index` is trapped inside
  it and can still be covered by unrelated page chrome (e.g. a sticky
  composer bar) regardless of how high the z-index is. Fixed by appending
  the tooltip to `document.body` and positioning it with
  `getBoundingClientRect()`, same as the selection popup, instead of
  nesting it in the button.
- **Qwen download silently did nothing:** `closest('[class*="message-hoc-
  container"]')` matched a node that wraps only the action-button footer
  (Copy/Like/Share), not the response text — see `qwen.md`. After stripping
  buttons/svgs, nothing was left to convert, so the click produced an empty
  result. `getMessageContainer` now rejects a "specific" match that has no
  real message blocks (`looksLikeMessageBody`) and falls back to the
  generic ancestor climb, which finds the real container.
- **Icon size** is now controlled by CSS (18px) instead of a hardcoded SVG
  attribute, so it matches each site's native 16–20px icons.

- **Claude action bar hidden until hover:** Claude fades its response action
  bar in on hover / focus-within, so the injected button was invisible until
  the message was hovered. Fixed in CSS by forcing `opacity` / `visibility` /
  `pointer-events` on the ancestors of `.samd-btn` (up to 3 levels), keyed off
  the injected button rather than a hashed Claude class so it survives
  redesigns. **Scoped to Claude only** via `html[data-samd-site="claude"]` —
  the attribute is set in `content.js` from the adapter name, so every other
  site keeps its native reveal-on-hover behaviour.
- **Selection popup vs. Claude's own control:** Claude shows a "reply to
  selection" button centred above the highlight. Our popup used to be centred
  too and covered it. It is now left-aligned with the *start* of the selection,
  anchored on `range.getClientRects()[0]` rather than the bounding box (for a
  multi-line selection the bounding box starts at the paragraph's left edge,
  not where the highlight actually begins).

## Qwen — if the button doesn't appear

Run `__samd()`. Qwen's copy control is:
`<div role="button" aria-label="Копировать" class="...container-copy...">`
so a language-independent selector would be
`[class*="container-copy" i]`. Add it to a Qwen adapter if the generic
`aria-label` match fails (aria-label is localized, so on a Russian UI it says
"Копировать", not "Copy").
