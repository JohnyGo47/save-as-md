# DOM captures

Raw `outerHTML` snapshots of each site's response toolbar, captured from the
live DOM with DevTools. They are the evidence behind the selectors in
`src/adapters.js` — when a site redesigns and the button disappears, recapture
the relevant file and diff it against the old one to see exactly what moved.

See `DEVTOOLS-CHECKLIST.md` in the repo root for the capture procedure, and
`SITE-STATUS.md` for what each capture proved.

| File | Site | Captured |
| --- | --- | --- |
| `gpt.md` | chatgpt.com | 2026-08-02 |
| `grok.md` | grok.com | 2026-08-02 |
| `kimi.md` | www.kimi.com | 2026-08-02 |
| `qwen.md` | chat.qwen.ai | 2026-08-02 |

These are snapshots of publicly rendered UI chrome (buttons, labels, class
names), not conversation content.
