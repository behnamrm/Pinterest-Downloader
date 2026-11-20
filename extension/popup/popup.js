/* Clipnest – toolbar popup. */
(() => {
  'use strict';
  const R = globalThis.ClipnestResolver;
  const $ = (id) => document.getElementById(id);
  const DEFAULT_SETTINGS = { saveAs: false, subfolder: true };
  let lastResolved = null;
  let activeTabId = null;

  function show(state) {
    for (const s of ['idle', 'loading', 'error', 'result']) $(`state-${s}`).hidden = s !== state;
  }

  function send(message) {
    return chrome.runtime.sendMessage(message).catch((e) => ({ ok: false, error: e.message }));
  }

  function formatDuration(ms) {
    if (!ms) return '';
    const total = Math.round(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function renderResult(res) {
    lastResolved = res;
    $('title').textContent = res.title;
    const thumb = $('thumb');
    if (res.thumbnail) {
      thumb.src = res.thumbnail;
      thumb.hidden = false;
    } else {
      thumb.hidden = true;
    }
    const list = $('videos');
    list.textContent = '';
    res.videos.forEach((v, i) => {
      const li = document.createElement('li');
      const meta = document.createElement('span');
      meta.className = 'meta';
      const parts = [res.videos.length > 1 ? `Video ${i + 1}` : 'MP4', v.quality, formatDuration(v.duration)];
      if (v.hevc) parts.push('HEVC');
      meta.textContent = parts.filter(Boolean).join(' · ');
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Download';
      btn.addEventListener('click', () => startDownload(i, btn));
      li.append(meta, btn);
      list.appendChild(li);
    });
    if (res.videos.length > 1) {
      const li = document.createElement('li');
      li.className = 'all';
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = `Download all ${res.videos.length}`;
      btn.addEventListener('click', () => startDownload(null, btn));
      li.appendChild(btn);
      list.appendChild(li);
    }
    show('result');
  }

  function showError(text) {
    $('state-error').textContent = text;
    show('error');
  }

  async function lookup(request) {
    show('loading');
    const res = await send({ type: 'clipnest:resolve', ...request });
    if (res && res.ok) renderResult(res);
    else showError((res && res.error) || 'Something went wrong.');
  }

  async function startDownload(index, btn) {
    if (!lastResolved) return;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Starting…';
    const res = await send({
      type: 'clipnest:download',
      resolved: lastResolved,
      index: index == null ? undefined : index
    });
    btn.textContent = res.ok ? 'Downloading ✓' : 'Failed';
    if (!res.ok) showError(res.error || 'Download failed.');
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 2500);
  }

  // ------------------------------------------------------------ init

  async function init() {
    const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
    $('opt-subfolder').checked = settings.subfolder;
    $('opt-saveas').checked = settings.saveAs;
    $('opt-subfolder').addEventListener('change', (e) => chrome.storage.sync.set({ subfolder: e.target.checked }));
    $('opt-saveas').addEventListener('change', (e) => chrome.storage.sync.set({ saveAs: e.target.checked }));

    $('link-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const value = $('link').value.trim();
      if (!R.isShortLink(value) && !R.extractPinId(value)) {
        showError('Paste a link like pinterest.com/pin/123… or pin.it/abc…');
        return;
      }
      lookup({ url: value });
    });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return show('idle');
    let url;
    try {
      url = new URL(tab.url);
    } catch {
      return show('idle');
    }
    const pinId = R.isPinterestHost(url.hostname) ? R.extractPinId(url.pathname) : null;
    if (!pinId) return show('idle');
    activeTabId = tab.id;
    lookup({ pinId, tabId: activeTabId });
  }

  init();
})();
