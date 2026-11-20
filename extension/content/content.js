/* Clipnest – content script: adds "Download MP4" buttons to Pinterest videos. */
(() => {
  'use strict';
  if (window.__clipnestLoaded) return;
  window.__clipnestLoaded = true;

  const R = globalThis.ClipnestResolver;
  const MARK = 'data-clipnest';
  const DOWNLOAD_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M11 3h2v9.17l3.59-3.58L18 10l-6 6-6-6 1.41-1.41L11 12.17V3zM5 19h14v2H5z"/></svg>';

  // ------------------------------------------------------------ helpers

  function currentPinId() {
    return R.extractPinId(location.pathname);
  }

  function pinIdForVideo(video) {
    const link = video.closest('a[href*="/pin/"]');
    if (link) return R.extractPinId(link.getAttribute('href'));
    return null;
  }

  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (res) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(res || { ok: false, error: 'No response from extension.' });
        });
      } catch (e) {
        // Happens after the extension was updated/reloaded while the tab stayed open.
        resolve({ ok: false, error: 'Extension was updated. Please reload this page.' });
      }
    });
  }

  // ------------------------------------------------------------ toast

  let toastEl = null;
  let toastTimer = null;
  function toast(text, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'clipnest-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.dataset.kind = kind || 'info';
    toastEl.classList.add('clipnest-toast--show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('clipnest-toast--show'), kind === 'error' ? 6000 : 3500);
  }

  // ------------------------------------------------------------ download action

  const busy = new Set();
  async function downloadPin(pinId, button) {
    if (!pinId || busy.has(pinId)) return;
    busy.add(pinId);
    setState(button, 'busy');
    toast('Preparing download…', 'info');
    try {
      let prefetched = null;
      try {
        prefetched = await R.fetchPinVideos(pinId, location.origin);
      } catch {
        prefetched = null; // background will try on its own
      }
      const res = await send({ type: 'clipnest:download', pinId, prefetched });
      if (res.ok) {
        setState(button, 'done');
        toast(res.count > 1 ? `Downloading ${res.count} videos` : 'Download started', 'success');
      } else {
        setState(button, 'error');
        toast(res.error || 'Download failed.', 'error');
      }
    } finally {
      busy.delete(pinId);
      setTimeout(() => setState(button, 'idle'), 2500);
    }
  }

  function setState(button, state) {
    if (!button) return;
    button.dataset.state = state;
    const label = button.querySelector('.clipnest-label');
    if (label) {
      label.textContent = { busy: 'Preparing…', done: 'Downloading', error: 'Failed', idle: button.dataset.idleLabel }[state];
    }
  }

  function makeButton(label, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `clipnest-btn ${extraClass || ''}`.trim();
    b.dataset.idleLabel = label;
    b.dataset.state = 'idle';
    b.title = 'Download this video as MP4 (Clipnest)';
    b.innerHTML = `${DOWNLOAD_ICON}<span class="clipnest-label"></span>`;
    b.querySelector('.clipnest-label').textContent = label;
    // Pinterest wraps videos in links and listens on pointer events; keep our clicks to ourselves.
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'touchstart']) {
      b.addEventListener(type, (e) => e.stopPropagation(), true);
    }
    return b;
  }

  // ------------------------------------------------------------ buttons on feed videos

  function decorateVideo(video) {
    if (video.hasAttribute(MARK)) return;
    video.setAttribute(MARK, '1');
    const pinId = pinIdForVideo(video);
    // Videos not wrapped in a pin link are the main video on a pin page: handled by the floating button.
    if (!pinId || pinId === currentPinId()) return;
    const host = video.closest('[data-grid-item]') || video.closest('a[href*="/pin/"]') || video.parentElement;
    if (!host || host.querySelector(':scope > .clipnest-btn')) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const button = makeButton('MP4', 'clipnest-btn--overlay');
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      downloadPin(pinId, button);
    }, true);
    host.appendChild(button);
  }

  // ------------------------------------------------------------ floating button on pin pages

  let floating = null;
  function updateFloating() {
    const pinId = currentPinId();
    const hasMainVideo = !!pinId && [...document.querySelectorAll('video')].some((v) => {
      const id = pinIdForVideo(v);
      return !id || id === pinId;
    });
    if (!hasMainVideo) {
      if (floating) floating.hidden = true;
      return;
    }
    if (!floating) {
      floating = makeButton('Download video', 'clipnest-btn--floating');
      floating.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadPin(currentPinId(), floating);
      });
      document.documentElement.appendChild(floating);
    }
    floating.hidden = false;
  }

  // ------------------------------------------------------------ observe the SPA

  let scheduled = false;
  function scan() {
    scheduled = false;
    document.querySelectorAll(`video:not([${MARK}])`).forEach(decorateVideo);
    updateFloating();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      schedule();
    }
  }, 700);
  schedule();

  // ------------------------------------------------------------ messages from popup / background

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !msg) return false;
    if (msg.type === 'clipnest:fetchPin') {
      R.fetchPinVideos(msg.pinId, location.origin)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg.type === 'clipnest:toast') {
      toast(msg.text, msg.kind);
    }
    return false;
  });
})();
