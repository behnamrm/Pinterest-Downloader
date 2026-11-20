/*
 * Clipnest – shared pin/video resolution helpers.
 *
 * Loaded as a classic script in three places:
 *   - the background service worker (importScripts)
 *   - the content script on Pinterest pages
 *   - Node unit tests (module.exports)
 *
 * It only reads public pin data from Pinterest and never sends anything
 * anywhere else.
 */
(function (root) {
  'use strict';

  const PIN_ID_RE = /\/pin\/(?:[^/?#]*--)?(\d{5,25})(?=[/?#]|$)/i;
  const SHORT_LINK_RE = /^https?:\/\/(?:www\.)?pin\.it\/[A-Za-z0-9]+/i;
  const VIDEO_URL_RE = /https:\/\/v\d*[a-z]*\.pinimg\.com\/videos\/[^"'\s\\<>]+?\.(?:mp4|m3u8)/gi;
  const HASH_RE = /[0-9a-f]{32}/i;

  // Branches of the pin object that describe *other* pins/users; never walk them.
  const SKIP_KEYS = new Set([
    'pinner', 'origin_pinner', 'native_creator', 'via_pinner', 'board',
    'closeup_attribution', 'sponsor', 'third_party_pin_owner', 'aggregated_pin_data',
    'related_pins', 'pin_join', 'rich_summary', 'rich_metadata', 'embed'
  ]);

  /** Extract a numeric pin id from a URL, path or bare id. */
  function extractPinId(input) {
    if (input == null) return null;
    const s = String(input).trim();
    if (/^\d{5,25}$/.test(s)) return s;
    const m = s.match(PIN_ID_RE);
    return m ? m[1] : null;
  }

  function isShortLink(input) {
    return SHORT_LINK_RE.test(String(input || '').trim());
  }

  function isPinterestHost(hostname) {
    return /(^|\.)pinterest\.[a-z.]{2,8}$/i.test(hostname || '');
  }

  function videoHash(url) {
    const m = String(url).match(HASH_RE);
    return m ? m[0].toLowerCase() : url;
  }

  function isMp4(url) {
    return /\.mp4(?:[?#]|$)/i.test(url);
  }

  function isHevc(entry) {
    return /hevc|h265/i.test(`${entry.key || ''} ${entry.url}`);
  }

  /** Fetch the pin JSON from Pinterest's own web API (same request the site makes). */
  async function fetchPinResource(pinId, origin) {
    const base = origin || 'https://www.pinterest.com';
    const data = JSON.stringify({ options: { id: String(pinId), field_set_key: 'detailed' }, context: {} });
    const url = `${base}/resource/PinResource/get/?source_url=${encodeURIComponent(`/pin/${pinId}/`)}` +
      `&data=${encodeURIComponent(data)}&_=${Date.now()}`;
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Pinterest-PWS-Handler': 'www/pin/[id].js'
      }
    });
    if (!res.ok) throw new Error(`Pinterest API returned HTTP ${res.status}`);
    const json = await res.json();
    const pin = json && json.resource_response && json.resource_response.data;
    if (!pin || typeof pin !== 'object') throw new Error('Pinterest API returned no pin data');
    return pin;
  }

  /** Find every `video_list` object inside the pin data (regular, idea/story and carousel pins). */
  function collectVideoGroups(pin) {
    const groups = [];
    const seen = new WeakSet();

    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 14 || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) {
        node.forEach((n) => walk(n, depth + 1));
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (SKIP_KEYS.has(key)) continue;
        if (key === 'video_list' && value && typeof value === 'object' && !Array.isArray(value)) {
          const entries = Object.entries(value)
            .filter(([, v]) => v && typeof v.url === 'string')
            .map(([k, v]) => ({
              key: k,
              url: v.url,
              width: Number(v.width) || 0,
              height: Number(v.height) || 0,
              duration: Number(v.duration) || 0
            }));
          if (entries.length) groups.push(entries);
        } else {
          walk(value, depth + 1);
        }
      }
    }

    walk(pin, 0);
    return dedupeGroups(groups);
  }

  function dedupeGroups(groups) {
    const byHash = new Map();
    for (const g of groups) {
      const h = videoHash(g[0].url);
      if (!byHash.has(h)) byHash.set(h, g);
      else byHash.get(h).push(...g);
    }
    return [...byHash.values()];
  }

  /** Fallback: pull video URLs out of the pin page HTML. */
  function collectFromHtml(html, pinId) {
    const text = String(html)
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/');

    // Prefer the <script> chunks that belong to this pin, so related pins are ignored.
    const markers = [
      `%22pinId%22%3A%22${pinId}%22`,
      `"pinId":"${pinId}"`,
      `"id":"${pinId}"`,
      `"entityId":"${pinId}"`
    ];
    const chunks = text.split(/<script\b/i).filter((c) =>
      /pinimg\.com\/videos\//i.test(c) && markers.some((m) => c.includes(m)));

    let urls = [];
    let ownerScoped = false;
    for (const c of chunks) urls.push(...(c.match(VIDEO_URL_RE) || []));
    if (urls.length) ownerScoped = true;
    else urls = text.match(VIDEO_URL_RE) || [];

    const groups = new Map();
    for (const url of new Set(urls)) {
      if (/\/videos\/(?:thumbnails|captions)\//i.test(url)) continue;
      const h = videoHash(url);
      if (!groups.has(h)) groups.set(h, []);
      const pathKey = (url.match(/\/videos\/[^/]+\/([^/]+)\//) || [])[1] || 'unknown';
      groups.get(h).push({ key: pathKey, url, width: 0, height: 0, duration: 0 });
    }
    const list = [...groups.values()];
    // Without an owner-scoped chunk we cannot tell related pins apart; keep the first video only.
    return ownerScoped ? list : list.slice(0, 1);
  }

  async function fetchPinHtml(pinId, origin) {
    const base = origin || 'https://www.pinterest.com';
    const res = await fetch(`${base}/pin/${pinId}/`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Pin page returned HTTP ${res.status}`);
    return res.text();
  }

  function pickTitle(pin, pinId) {
    const candidates = [
      pin && pin.title,
      pin && pin.grid_title,
      pin && pin.story_pin_data && pin.story_pin_data.metadata && pin.story_pin_data.metadata.pin_title,
      pin && pin.seo_title,
      pin && pin.description,
      pin && pin.auto_alt_text
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return `pinterest-${pinId}`;
  }

  function pickThumbnail(pin) {
    const imgs = pin && pin.images;
    if (!imgs) return null;
    const pref = ['474x', '236x', '736x', 'orig'];
    for (const k of pref) if (imgs[k] && imgs[k].url) return imgs[k].url;
    return null;
  }

  function externalVideoLink(pin) {
    const link = (pin && (pin.link || (pin.embed && pin.embed.src))) || '';
    return /youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com/i.test(link) ? link : null;
  }

  /**
   * Resolve a pin to raw video groups.
   * Tries Pinterest's JSON API first, then falls back to parsing the pin page.
   */
  async function fetchPinVideos(pinId, origin) {
    let pin = null;
    let groups = [];
    let apiError = null;
    try {
      pin = await fetchPinResource(pinId, origin);
      groups = collectVideoGroups(pin);
    } catch (e) {
      apiError = e;
    }
    if (!groups.length) {
      try {
        const html = await fetchPinHtml(pinId, origin);
        groups = collectFromHtml(html, pinId);
        if (!pin) {
          const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
          pin = { title: t ? decodeEntities(t[1]).replace(/\s*\|\s*Pinterest\s*$/i, '') : '' };
        }
      } catch (e) {
        if (!pin) throw apiError || e;
      }
    }
    return {
      pinId: String(pinId),
      title: pickTitle(pin, pinId),
      thumbnail: pickThumbnail(pin),
      externalLink: groups.length ? null : externalVideoLink(pin),
      groups
    };
  }

  function decodeEntities(s) {
    return String(s)
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  // Lower number = preferred when resolutions tie.
  function keyRank(key) {
    const k = String(key || '').toUpperCase();
    if (k === 'V_720P' || k === '720P') return 0;
    const exp = k.match(/EXP(\d+)/);
    if (exp) return 10 - Number(exp[1]) / 10;
    if (k.includes('EXPMP4')) return 11;
    return 20;
  }

  function hlsToMp4(url) {
    if (!/\.m3u8(?:[?#]|$)/i.test(url)) return null;
    return url
      .replace(/\/videos\/([^/]+)\/(?:hls|h265|hlsv\d)\//i, '/videos/$1/720p/')
      .replace(/(?:_[a-z0-9]+)?\.m3u8(?:[?#].*)?$/i, '.mp4');
  }

  /**
   * From one video group, list download candidates best-first.
   * H.264 MP4s first (play everywhere), then a 720p MP4 derived from the HLS
   * stream (must be verified), then HEVC MP4s as a last resort.
   */
  function rankCandidates(group) {
    const byArea = (a, b) => (b.width * b.height) - (a.width * a.height) || keyRank(a.key) - keyRank(b.key);
    const mp4 = group.filter((e) => isMp4(e.url));
    const h264 = mp4.filter((e) => !isHevc(e)).sort(byArea);
    const hevc = mp4.filter(isHevc).sort(byArea);
    const out = h264.map((e) => ({ ...e, verified: true }));
    const known = new Set(out.map((e) => e.url));
    for (const e of group) {
      const derived = hlsToMp4(e.url);
      if (derived && !known.has(derived)) {
        known.add(derived);
        out.push({ key: 'derived_720p', url: derived, width: e.width, height: e.height, duration: e.duration, verified: false });
      }
    }
    for (const e of hevc) if (!known.has(e.url)) out.push({ ...e, verified: true });
    return out;
  }

  function qualityLabel(c) {
    // The /720p/ file is always 720p, even when the API reports the source size.
    if (/720/i.test(`${c.key || ''} ${c.url}`)) return '720p';
    if (c.width && c.height) return `${Math.min(c.width, c.height)}p`;
    return 'MP4';
  }

  /** Make a string safe to use as a file name on Windows, macOS and Linux. */
  function safeFileName(input, maxLen) {
    const limit = maxLen || 80;
    let s = String(input || '')
      .replace(/#[\p{L}\p{N}_]+/gu, ' ')          // hashtags
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*~]+/g, ' ')
      .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (s.length > limit) s = s.slice(0, limit).replace(/\s+\S*$/, '') || s.slice(0, limit);
    s = s.replace(/^[.\s-]+|[.\s-]+$/g, '');
    if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = `_${s}`;
    return s;
  }

  const api = {
    extractPinId,
    isShortLink,
    isPinterestHost,
    fetchPinResource,
    fetchPinHtml,
    fetchPinVideos,
    collectVideoGroups,
    collectFromHtml,
    rankCandidates,
    hlsToMp4,
    qualityLabel,
    safeFileName,
    pickTitle
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ClipnestResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
