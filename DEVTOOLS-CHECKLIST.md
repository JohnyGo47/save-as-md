# DevTools checklist — capturing real selectors

The selectors in `src/adapters.js` are guesses. This file tells you exactly
what to capture so they can be replaced with verified ones.

Do this **once per site**: claude.ai, chatgpt.com, www.kimi.com.

---

## Step 0 — load the extension first

Install unpacked (see README), open the site, send any message so a full
response with a code block is on screen. Open DevTools (`F12` / `Cmd+Opt+I`).

## Step 1 — run the built-in diagnostic

In the **Console** tab, type:

```js
__samd()
```

Copy the entire output. It tells us four things at once:

| Line | Meaning |
| --- | --- |
| `adapter=` | Which adapter matched the hostname |
| `selector=` | The selector string actually in use |
| `copy buttons matched: N` | **N should equal the number of AI responses on screen.** 0 = selectors are wrong. Too high = code-block buttons still leaking through |
| `buttons injected: N` | Should equal the line above. Lower = insertion is being blocked or reverted |
| `first container:` | Hover it in the console — the site should highlight the **whole response**, not one paragraph and not the entire page |
| `container text length:` | Should be roughly the response's character count |

If `__samd is not defined`, the content script never ran — report that instead;
everything below is unnecessary.

## Step 2 — capture the response toolbar

Hover a response so its action bar (Copy / Retry / thumbs) appears.
Right-click the **Copy** button → **Inspect**.

In the Elements panel, select the `<button>` node →
right-click → **Copy** → **Copy outerHTML**. Paste it into the report.

Then select its **parent** element (press `↑` once in Elements) and copy that
outerHTML too. This is the toolbar the button gets inserted into.

## Step 3 — capture the message container

Keep climbing with `↑` in the Elements panel until the highlighted region
covers exactly one full response — all its paragraphs, lists and code blocks,
but not the next message and not the input box.

Copy that element's **opening tag only** (its attributes are what matter, not
its contents). Note which attribute looks stable: `data-testid`,
`data-message-author-role`, a semantic class, etc. Hashed classes like
`css-1x9z8ab` are useless — they change on every deploy.

## Step 4 — capture a code-block copy button

Right-click the Copy button **inside a code block** → Inspect → Copy outerHTML.
Also copy its parent's opening tag.

This is what `isCodeBlockCopyButton()` must reject. If the code toolbar sits
*outside* the `<pre>` on this site, the current heuristic may miss it.

## Step 5 — sanity checks to report

- [ ] Does the `.md` button appear? If yes, is it directly right of Copy?
- [ ] Any **red console errors** after clicking it? (`removeChild`, CSP, etc.)
- [ ] Does the downloaded file open as valid Markdown?
- [ ] Are code blocks fenced with the right language?
- [ ] Are tables intact?
- [ ] Any UI junk in the file — model name, "Retry", timestamps, duplicated math?
- [ ] Does the filename reflect the response's first line?
- [ ] Scroll a long conversation — does typing/streaming feel slower?

---

## Report template

```
SITE: claude.ai
DATE: 2026-08-02

__samd() output:
<paste>

Response Copy button outerHTML:
<paste>

Toolbar (parent) outerHTML:
<paste>

Message container opening tag:
<paste>

Code-block Copy button outerHTML:
<paste>

Console errors:
<paste or "none">

Checklist: appeared=Y/N  position=Y/N  file-valid=Y/N  code=Y/N  tables=Y/N
Junk in output: <describe>
```

Three of these — one per site — and every guess in `adapters.js` gets replaced
with something verified.
