(function () {
  const LOG = '[save-as-md]';
  const MARK = 'data-samd-done';

  // The script now runs on every http(s) page, so bail out on documents that
  // are not ordinary HTML (standalone SVG/XML, plugin viewers): those have no
  // <body> and the observer below would throw.
  if (!document.body || !window.TurndownService || !window.MDDownloadAdapters) return;

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });
  if (window.turndownPluginGfm && window.turndownPluginGfm.gfm) {
    turndownService.use(window.turndownPluginGfm.gfm);
  } else {
    console.warn(LOG + ' GFM plugin missing - tables will not convert correctly');
  }

  const adapter = window.MDDownloadAdapters.getAdapterForHost(location.hostname);

  // Tag <html> so button.css can scope site-specific fixes without affecting
  // any other site. An attribute (not a class) because sites manage the
  // <html> class list for theming and would clobber ours on re-render.
  document.documentElement.setAttribute('data-samd-site', adapter.name.toLowerCase());

  // Folder icon (matches the "save to folder" metaphor), inherits text color.
  const FOLDER_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
    '<path d="M12 10v5"/><path d="M9.5 12.5 12 15l2.5-2.5"/></svg>';

  /**
   * Unicode-aware slug: keeps Cyrillic / Kazakh / any letters, strips punctuation.
   * Falls back only when there is genuinely nothing usable.
   */
  function slugify(text, fallback) {
    let s = (text || '').replace(/^#+\s*/, '').trim().toLowerCase();
    try {
      s = s.replace(/[^\p{L}\p{N}\s-]/gu, '');
    } catch (e) {
      s = s.replace(/[^\w\s-]/g, ''); // very old browsers
    }
    s = s.trim().replace(/\s+/g, '-').replace(/-+/g, '-');
    return (s || fallback).slice(0, 60);
  }

  function downloadMarkdown(markdown, titleHint) {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const filename = slugify(titleHint, 'response') + '-' + stamp + '.md';
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  // Shared cleanup: strip UI chrome and KaTeX MathML twins, then convert.
  function cleanAndConvert(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(
      'button, [role="button"], .samd-btn, .samd-selection-popup, [class*="toolbar" i], [aria-hidden="true"], svg'
    ).forEach(function (el) { el.remove(); });
    clone.querySelectorAll('.katex-mathml, annotation, math').forEach(function (el) { el.remove(); });
    const md = turndownService.turndown(clone.innerHTML).trim();
    return md || null;
  }

  function extractMarkdown(copyBtn) {
    const container = adapter.getMessageContainer(copyBtn);
    if (!container) {
      console.warn(LOG + ' could not locate the response container');
      return null;
    }
    return cleanAndConvert(container);
  }

  // Shared tooltip element, appended directly to <body>. Host toolbars
  // (ChatGPT, Grok) apply `mask-image` to the action bar for their reveal
  // animation, and CSS masking establishes a new stacking context - any
  // z-index set on a descendant tooltip is then trapped inside that context
  // and can still be painted under later, unrelated page elements (e.g. a
  // sticky composer bar) no matter how high the z-index goes. Positioning
  // the tooltip in body-space, like the selection popup below, sidesteps
  // the whole problem instead of chasing z-index.
  let tooltipEl = null;
  function showTooltip(anchor) {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'samd-tip';
      document.body.appendChild(tooltipEl);
    }
    tooltipEl.textContent = 'Save as MD';
    const rect = anchor.getBoundingClientRect();
    tooltipEl.style.top = (rect.top + window.scrollY - 6) + 'px';
    tooltipEl.style.left = (rect.left + window.scrollX + rect.width / 2) + 'px';
    tooltipEl.classList.add('samd-visible');
  }
  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('samd-visible');
  }

  function makeButton(copyBtn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'samd-btn';
    btn.setAttribute('aria-label', 'Save as MD');
    btn.innerHTML = FOLDER_SVG;
    btn.addEventListener('mouseenter', function () { showTooltip(btn); });
    btn.addEventListener('focus', function () { showTooltip(btn); });
    btn.addEventListener('mouseleave', hideTooltip);
    btn.addEventListener('blur', hideTooltip);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      const md = extractMarkdown(copyBtn);
      if (!md) return;
      const firstLine = md.split('\n').find(function (l) { return l.trim().length > 0; });
      downloadMarkdown(md, firstLine || 'response');
    });
    return btn;
  }

  function inject(copyBtn) {
    if (!copyBtn || copyBtn.hasAttribute(MARK)) return;
    copyBtn.setAttribute(MARK, '1');
    const toolbar = adapter.getToolbar(copyBtn);
    if (!toolbar || toolbar.querySelector('.samd-btn')) return;
    try {
      // Insert directly after Copy rather than at the end of the toolbar.
      copyBtn.insertAdjacentElement('afterend', makeButton(copyBtn));
    } catch (err) {
      // Some frameworks reject insertion into managed nodes; degrade quietly.
      console.warn(LOG + ' could not insert button', err);
    }
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      try {
        adapter.findCopyButtons(document).forEach(inject);
      } catch (err) {
        console.warn(LOG + ' scan failed', err);
      }
    });
  }

  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
  scheduleScan();

  // ---- Selection feature: floating "Save as MD" above highlighted text ----
  (function () {
    let popup = null;
    let savedRange = null;

    function removePopup() {
      if (popup) {
        popup.classList.remove('samd-visible');
        const p = popup;
        popup = null;
        setTimeout(function () { if (p && p.parentNode) p.remove(); }, 150);
      }
    }

    function buildPopup() {
      const el = document.createElement('div');
      el.className = 'samd-selection-popup';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Save selection as MD');
      el.innerHTML = FOLDER_SVG + '<span>Save as MD</span>';
      // mousedown (not click) so it fires before the selection clears
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        saveSelection();
      });
      return el;
    }

    function saveSelection() {
      if (!savedRange) return;
      const frag = savedRange.cloneContents();
      const holder = document.createElement('div');
      holder.appendChild(frag);
      const md = cleanAndConvert(holder);
      if (!md) { removePopup(); return; }
      const firstLine = md.split('\n').find(function (l) { return l.trim().length > 0; });
      downloadMarkdown(md, (firstLine || 'selection') + '-selection');
      removePopup();
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }

    function showPopupForSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { removePopup(); return; }
      const text = sel.toString().trim();
      if (text.length < 2) { removePopup(); return; }

      const range = sel.getRangeAt(0);
      // Ignore selections inside inputs / the popup itself.
      const anchorEl = range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;
      if (anchorEl && anchorEl.closest('input, textarea, .samd-selection-popup')) return;

      savedRange = range.cloneRange();
      // Anchor on the FIRST line box of the selection, not the bounding box:
      // for a multi-line selection the bounding box starts at the paragraph's
      // left edge, while rects[0] is where the highlight actually begins.
      const rects = range.getClientRects();
      const rect = (rects && rects.length) ? rects[0] : range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) { removePopup(); return; }

      if (!popup) {
        popup = buildPopup();
        document.body.appendChild(popup);
      }
      // Left-aligned with the start of the selection (not centred): sites
      // like Claude show their own "reply to selection" control centred above
      // the highlight, and a centred popup would sit right on top of it.
      const top = rect.top + window.scrollY - 44;
      const left = rect.left + window.scrollX;
      popup.style.top = Math.max(window.scrollY + 4, top) + 'px';
      popup.style.left = Math.max(4, left) + 'px';
      requestAnimationFrame(function () {
        if (popup) popup.classList.add('samd-visible');
      });
    }

    document.addEventListener('mouseup', function () {
      // Let the browser finalize the selection first.
      setTimeout(showPopupForSelection, 10);
    });
    document.addEventListener('mousedown', function (e) {
      if (popup && !popup.contains(e.target)) removePopup();
    });
    document.addEventListener('scroll', removePopup, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') removePopup();
    });
  })();

  // Diagnostic helper - run  __samd()  in the console to see what matched.
  window.__samd = function () {
    const found = adapter.findCopyButtons(document);
    console.log(LOG + ' adapter=' + adapter.name);
    console.log(LOG + ' selector=' + adapter.copySel);
    console.log(LOG + ' copy buttons matched: ' + found.length);
    console.log(LOG + ' buttons injected: ' + document.querySelectorAll('.samd-btn').length);
    if (found[0]) {
      const c = adapter.getMessageContainer(found[0]);
      console.log(LOG + ' first container:', c);
      console.log(LOG + ' container text length: ' + ((c && c.innerText) || '').length);
    }
    return found;
  };
})();
