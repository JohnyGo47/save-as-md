/**
 * Per-site adapters.
 *
 * IMPORTANT: every selector here is validated at load time. If a selector is
 * syntactically invalid it is dropped and reported loudly in the console
 * instead of silently disabling the whole extension.
 *
 * The site-specific selectors below were captured from each site's live DOM;
 * the snapshots backing them are in docs/dom-captures/ and the reasoning is
 * in SITE-STATUS.md. They will still break on a redesign — see
 * DEVTOOLS-CHECKLIST.md for how to recapture the markup and fix them.
 *
 * Any host without an entry here falls back to the generic adapter, which is
 * what makes the extension work on sites that were never tuned for.
 */

(function (global) {
  const LOG = '[save-as-md]';

  /** Drop invalid selectors, warn about them, return a usable selector string. */
  function safeSelectorList(selectors, label) {
    const valid = [];
    for (const s of selectors) {
      try {
        document.querySelector(s);
        valid.push(s);
      } catch (err) {
        console.warn(LOG + ' invalid selector dropped in ' + label + ': ' + s);
      }
    }
    // An empty INPUT (e.g. the generic adapter's intentionally-empty
    // containerSelectors, which relies on findMessageContainerGeneric
    // instead) is not a failure - only warn when selectors were actually
    // supplied and every one of them turned out to be invalid.
    if (selectors.length && !valid.length) {
      console.warn(LOG + ' no valid selectors left in ' + label);
    }
    return valid.join(',');
  }

  const GENERIC_COPY_SELECTORS = [
    'button[aria-label="copy" i]',
    'button[aria-label*="copy" i]',
    'button[title="copy" i]',
    'button[title*="copy" i]',
    'button[data-testid*="copy" i]',
    '[role="button"][aria-label*="copy" i]'
  ];

  const GENERIC_COPY_SELECTOR = safeSelectorList(GENERIC_COPY_SELECTORS, 'generic');

  /**
   * A copy button belonging to a CODE BLOCK rather than to the whole response.
   * These must be skipped, or every snippet gets its own .md button.
   */
  function isCodeBlockCopyButton(btn) {
    if (btn.closest('pre, code, [class*="code-block" i], [class*="codeblock" i]')) return true;
    const wrapper = btn.closest('div');
    if (wrapper && wrapper.parentElement) {
      const p = wrapper.parentElement;
      if (p.querySelector(':scope > pre') && p.querySelectorAll('p, h1, h2, h3, ul, ol').length === 0) {
        return true;
      }
    }
    return false;
  }

  /** Does this element hold real response prose (not just a toolbar)? */
  function looksLikeMessageBody(el) {
    const blocks = el.querySelectorAll('p, h1, h2, h3, li, pre, blockquote, table');
    if (blocks.length === 0) return false;
    // Reject nodes that are mostly interactive chrome (action bars).
    const buttons = el.querySelectorAll('button, [role="button"]').length;
    return blocks.length >= buttons;
  }

  /** Climb from the copy button to the smallest ancestor that looks like a full message. */
  function findMessageContainerGeneric(copyBtn) {
    let el = copyBtn;
    for (let i = 0; i < 10 && el; i++) {
      el = el.parentElement;
      if (!el || el === document.body) break;
      if (looksLikeMessageBody(el)) return el;
    }
    // Fallback: nearest ancestor with a reasonable amount of text.
    el = copyBtn.parentElement;
    let best = null;
    for (let i = 0; i < 10 && el && el !== document.body; i++) {
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length > 40) { best = el; break; }
      el = el.parentElement;
    }
    return best;
  }

  function findToolbarGeneric(copyBtn) {
    let el = copyBtn.parentElement;
    for (let i = 0; i < 3 && el; i++) {
      if (el.querySelectorAll('button, [role="button"]').length >= 1) return el;
      el = el.parentElement;
    }
    return copyBtn.parentElement;
  }

  function makeAdapter(cfg) {
    const copySel = safeSelectorList(cfg.copySelectors.concat(GENERIC_COPY_SELECTORS), cfg.name);
    const containerSel = safeSelectorList(cfg.containerSelectors, cfg.name + ':container');
    return {
      name: cfg.name,
      copySel: cfg.copySelDescription || copySel,
      findCopyButtons: cfg.findCopyButtons || function (root) {
        if (!copySel) return [];
        return Array.from(root.querySelectorAll(copySel)).filter(function (b) {
          return !isCodeBlockCopyButton(b);
        });
      },
      getMessageContainer: function (copyBtn) {
        // A "specific" match only counts if it actually contains some
        // message prose. On Qwen, closest() hits `.message-hoc-container`
        // before it reaches the real content — that node wraps only the
        // action-button footer, so accepting it blindly yields an empty
        // download. Just check for the presence of real content blocks here
        // (not a blocks-vs-buttons ratio like looksLikeMessageBody uses for
        // the generic climb below): once our own .samd-btn is injected into
        // the toolbar it counts as a button too, and on short responses that
        // would push a perfectly good container over the ratio threshold and
        // reject it right after injection - i.e. only once the button is
        // actually clickable.
        const specific = containerSel ? copyBtn.closest(containerSel) : null;
        if (specific && specific.querySelectorAll('p, h1, h2, h3, li, pre, blockquote, table').length > 0) {
          return specific;
        }
        return findMessageContainerGeneric(copyBtn);
      },
      getToolbar: cfg.getToolbar || findToolbarGeneric
    };
  }

  const adapters = {
    'claude.ai': makeAdapter({
      name: 'Claude',
      copySelectors: ['button[data-testid="action-bar-copy"]'],
      containerSelectors: ['[data-testid="message"]', '.font-claude-message']
    }),
    'chatgpt.com': makeAdapter({
      name: 'ChatGPT',
      copySelectors: ['button[data-testid="copy-turn-action-button"]'],
      containerSelectors: ['[data-message-author-role="assistant"]']
    }),
    // Kimi renders each action as <div class="icon-button"> whose only
    // distinguishing feature is a child <svg name="Copy">. CSS can't select a
    // parent by its child, so this adapter finds the svg then climbs to the
    // clickable div.
    'www.kimi.com': (function () {
      function kimiCopyButtons(root) {
        const svgs = root.querySelectorAll('svg[name="Copy"]');
        const out = [];
        svgs.forEach(function (svg) {
          const btn = svg.closest('.icon-button, [class*="icon-button" i]');
          if (btn && !isCodeBlockCopyButton(btn)) out.push(btn);
        });
        return out;
      }
      return makeAdapter({
        name: 'Kimi',
        copySelectors: [],
        copySelDescription: 'svg[name="Copy"] -> .icon-button',
        findCopyButtons: kimiCopyButtons,
        containerSelectors: ['.chat-content-item-assistant', '[class*="segment-content" i]'],
        // Toolbar is the row of icon-buttons; insert alongside the copy div.
        getToolbar: function (copyBtn) {
          return copyBtn.closest('.segment-assistant-actions-content') || copyBtn.parentElement;
        }
      });
    })(),
    'grok.com': makeAdapter({
      name: 'Grok',
      copySelectors: ['button[aria-label="Copy response" i]'],
      // NB: do not use [class*="response"] — Grok puts "last-response" on the
      // copy button itself, so closest() would match the button, not the body.
      containerSelectors: ['[class*="message-row" i]', '[class*="message-bubble" i]', '[class*="markdown" i]']
    }),
    // Qwen's aria-label is localized ("Копировать" on a Russian UI), so match
    // the stable class instead of the label.
    'chat.qwen.ai': makeAdapter({
      name: 'Qwen',
      copySelectors: ['[class*="action-control-container-copy" i][role="button"]'],
      containerSelectors: ['[class*="message-hoc-container" i]', '[class*="markdown" i]'],
      getToolbar: function (copyBtn) {
        return copyBtn.closest('[class*="action-control-icons" i]') || copyBtn.parentElement;
      }
    })
  };
  adapters['qwen.ai'] = adapters['chat.qwen.ai'];
  adapters['www.qwen.ai'] = adapters['chat.qwen.ai'];
  adapters['chat.openai.com'] = adapters['chatgpt.com'];
  adapters['kimi.com'] = adapters['www.kimi.com'];
  adapters['grok.x.com'] = adapters['grok.com'];
  adapters['x.com'] = adapters['grok.com'];

  const genericAdapter = makeAdapter({ name: 'Generic', copySelectors: [], containerSelectors: [] });

  global.MDDownloadAdapters = {
    getAdapterForHost: function (h) { return adapters[h] || genericAdapter; },
    isCodeBlockCopyButton: isCodeBlockCopyButton,
    GENERIC_COPY_SELECTOR: GENERIC_COPY_SELECTOR
  };
})(window);
