/* Clipnest – background service worker: resolves pins and starts downloads. */
importScripts('lib/resolver.js');

const R = self.ClipnestResolver;
const DEFAULT_SETTINGS = { saveAs: false, subfolder: true };
const MENU_ID = 'clipnest-download';
const PIN_URL_PATTERNS = [
  '*://*.pinterest.com/pin/*', '*://*.pinterest.ca/pin/*', '*://*.pinterest.co.uk/pin/*',
  '*://*.pinterest.com.au/pin/*', '*://*.pinterest.de/pin/*', '*://*.pinterest.fr/pin/*',
  '*://*.pinterest.es/pin/*', '*://*.pinterest.it/pin/*', '*://*.pinterest.jp/pin/*',
  '*://*.pinterest.com.mx/pin/*', '*://*.pinterest.nz/pin/*', '*://*.pinterest.ie/pin/*',
  '*://*.pinterest.at/pin/*', '*://*.pinterest.ch/pin/*', '*://*.pinterest.pt/pin/*',
  '*://*.pinterest.se/pin/*', '*://*.pinterest.dk/pin/*', '*://*.pinterest.cl/pin/*',
  '*://*.pinterest.co.kr/pin/*', '*://*.pinterest.ph/pin/*', '*://pin.it/*'
];

// ---------------------------------------------------------------- settings

async function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ---------------------------------------------------------------- resolving

async function expandShortLink(url) {
  const res = await fetch(url, { redirect: 'follow', credentials: 'omit' });
  const id = R.extractPinId(res.url) || R.extractPinId(await res.text().catch(() => ''));
  if (!id) throw new Error('That pin.it link does not point to a pin.');
  return id;
}

async function pinIdFrom(request) {
  if (request.pinId) return String(request.pinId);
  const input = String(request.url || '').trim();
  if (!input) throw new Error('No pin link given.');
  if (R.isShortLink(input)) return expandShortLink(input);
  const id = R.extractPinId(input);
  if (!id) throw new Error('This does not look like a Pinterest pin link.');
  return id;
}

/** Ask the content script on a Pinterest tab to fetch pin data with the user's own session. */
async function fetchViaTab(tabId, pinId) {
  if (tabId == null) return null;
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'clipnest:fetchPin', pinId });
    return res && res.ok ? res.data : null;
  } catch {
    return null; // no content script in that tab
  }
}

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', credentials: 'omit' });
    const type = res.headers.get('content-type') || '';
    return res.ok && !/text\/html|xml/i.test(type);
  } catch {
    return false;
  }
}

/** Turn raw groups into a list of downloadable videos (one per clip). */
async function buildVideos(groups) {
  const videos = [];
  for (const group of groups) {
    for (const cand of R.rankCandidates(group)) {
      if (cand.verified || await urlExists(cand.url)) {
        videos.push({
          url: cand.url,
          width: cand.width,
          height: cand.height,
          duration: cand.duration,
          quality: R.qualityLabel(cand),
          hevc: /hevc|h265/i.test(cand.url)
        });
        break;
      }
    }
  }
  return videos;
}

async function resolve(request) {
  const pinId = await pinIdFrom(request);
  let data = request.prefetched && request.prefetched.pinId === pinId ? request.prefetched : null;
  if (!data) data = await fetchViaTab(request.tabId, pinId);
  if (!data || !data.groups || !data.groups.length) {
    const own = await R.fetchPinVideos(pinId);
    data = (own.groups.length || !data) ? own : data;
  }
  const videos = await buildVideos(data.groups || []);
  let error = null;
  if (!videos.length) {
    error = data.externalLink
      ? 'This pin links to a video hosted on another website, so it cannot be downloaded here.'
      : 'No downloadable video was found in this pin.';
  }
  return {
    ok: videos.length > 0,
    pinId,
    title: data.title,
    thumbnail: data.thumbnail || null,
    videos,
    error
  };
}

// ---------------------------------------------------------------- downloading

function isAllowedVideoUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)pinimg\.com$/i.test(u.hostname) && /\.mp4$/i.test(u.pathname);
  } catch {
    return false;
  }
}

async function downloadOne(video, { title, pinId, index, total }) {
  if (!isAllowedVideoUrl(video.url)) throw new Error('Refusing to download an unexpected URL.');
  const settings = await getSettings();
  const base = R.safeFileName(title) || 'pinterest-video';
  const suffix = total > 1 ? `-${index + 1}` : '';
  const folder = settings.subfolder ? 'Pinterest/' : '';
  const filename = `${folder}${base}-${pinId}${suffix}.mp4`;
  const opts = { url: video.url, saveAs: !!settings.saveAs, conflictAction: 'uniquify' };
  try {
    return await chrome.downloads.download({ ...opts, filename });
  } catch (e) {
    // Some titles still upset the OS; fall back to a plain name.
    return chrome.downloads.download({ ...opts, filename: `${folder}pinterest-${pinId}${suffix}.mp4` });
  }
}

async function download(request) {
  const info = request.resolved && request.resolved.videos ? request.resolved : await resolve(request);
  if (!info.videos || !info.videos.length) {
    return { ok: false, error: info.error || 'No downloadable video was found in this pin.' };
  }
  const list = Number.isInteger(request.index) ? [info.videos[request.index]].filter(Boolean) : info.videos;
  for (let i = 0; i < list.length; i++) {
    const index = Number.isInteger(request.index) ? request.index : i;
    await downloadOne(list[i], { title: info.title, pinId: info.pinId, index, total: info.videos.length });
  }
  return { ok: true, count: list.length, title: info.title };
}

// ---------------------------------------------------------------- messaging

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return false;
  const tabId = msg.tabId != null ? msg.tabId : sender.tab && sender.tab.id;
  const handlers = {
    'clipnest:resolve': () => resolve({ ...msg, tabId }),
    'clipnest:download': () => download({ ...msg, tabId })
  };
  const handler = handlers[msg.type];
  if (!handler) return false;
  handler()
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: (e && e.message) || String(e) }));
  return true; // async response
});

// ---------------------------------------------------------------- context menu

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Right-click on a link to a pin (on any site).
    chrome.contextMenus.create({
      id: `${MENU_ID}-link`,
      title: 'Download Pinterest video (MP4)',
      contexts: ['link'],
      targetUrlPatterns: PIN_URL_PATTERNS
    });
    // Right-click anywhere on a pin page.
    chrome.contextMenus.create({
      id: `${MENU_ID}-page`,
      title: 'Download this Pinterest video (MP4)',
      contexts: ['page', 'video', 'image'],
      documentUrlPatterns: PIN_URL_PATTERNS
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!String(info.menuItemId).startsWith(MENU_ID)) return;
  const url = info.linkUrl || info.pageUrl;
  const tabId = tab && tab.id;
  const notify = (text, kind) => {
    if (tabId != null) chrome.tabs.sendMessage(tabId, { type: 'clipnest:toast', text, kind }).catch(() => {});
  };
  notify('Preparing download…', 'info');
  try {
    const res = await download({ url, tabId });
    notify(res.ok ? 'Download started' : res.error, res.ok ? 'success' : 'error');
  } catch (e) {
    notify(e.message || String(e), 'error');
  }
});
