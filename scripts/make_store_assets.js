// Generates Chrome Web Store images into store/ using the real extension UI.
// Usage: node scripts/make_store_assets.js   (needs Playwright + Chromium)
// All artwork is mock content: no Pinterest logos or third-party videos.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'store');

const FAKE_THUMB = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#be123c"/></linearGradient></defs>' +
  '<rect width="96" height="128" fill="url(#g)"/><circle cx="48" cy="70" r="26" fill="#fde68a" opacity=".85"/></svg>');

const FAKE_RESULT = {
  ok: true,
  pinId: '1234567890',
  title: 'Creamy tomato basil pasta in 15 minutes',
  thumbnail: FAKE_THUMB,
  videos: [{ url: 'https://v1.pinimg.com/videos/x.mp4', quality: '720p', duration: 47000 }]
};

// Single quotes only: these strings are placed inside style="…" attributes.
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const ICON = 'data:image/png;base64,' + fs.readFileSync(path.join(EXT, 'icons', 'icon-128.png')).toString('base64');
const DL_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11 3h2v9.17l3.59-3.58L18 10l-6 6-6-6 1.41-1.41L11 12.17V3zM5 19h14v2H5z"/></svg>';

function videoCard(w, h, hue, withButton) {
  return `<div style="position:relative;width:${w}px;height:${h}px;border-radius:20px;overflow:hidden;
    background:linear-gradient(160deg,hsl(${hue} 80% 62%),hsl(${hue + 40} 70% 38%));box-shadow:0 18px 40px rgba(15,23,42,.25)">
    <div style="position:absolute;inset:0;display:grid;place-items:center">
      <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.85);display:grid;place-items:center">
        <div style="margin-left:6px;border-left:22px solid #1f2a44;border-top:13px solid transparent;border-bottom:13px solid transparent"></div>
      </div></div>
    ${withButton ? `<div style="position:absolute;top:12px;left:12px;display:flex;gap:6px;align-items:center;background:#1f2a44;color:#fff;
      padding:7px 12px;border-radius:999px;font:600 13px ${FONT};box-shadow:0 2px 10px rgba(0,0,0,.3)">${DL_SVG.replace(/18/g, '15')}MP4</div>` : ''}
    <div style="position:absolute;right:12px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;font:600 12px ${FONT};padding:3px 8px;border-radius:8px">0:${20 + (hue % 39)}</div>
  </div>`;
}

function shell(width, height, inner) {
  return `<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:${FONT};
    background:linear-gradient(135deg,#ecfdf5 0%,#e0e7ff 100%);color:#121826">${inner}</body></html>`;
}

function headline(title, sub) {
  return `<div style="display:flex;align-items:center;gap:14px;margin-bottom:26px">
      <img src="${ICON}" width="56" height="56"><div style="font:700 24px/1.15 ${FONT}">MP4 Video Downloader<div style="font:500 16px ${FONT};color:#475569">for Pinterest</div></div></div>
    <h1 style="margin:0 0 16px;font:800 46px/1.12 ${FONT};letter-spacing:-.02em">${title}</h1>
    <p style="margin:0;font:400 21px/1.5 ${FONT};color:#475569">${sub}</p>`;
}

(async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-assets-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];

  // 1) Real popup UI with mock data.
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 340, height: 372 });
  await popup.addInitScript((fake) => {
    const install = () => {
      if (!globalThis.chrome || !chrome.runtime) return setTimeout(install, 0);
      chrome.runtime.sendMessage = async (m) => (m.type === 'pvd:resolve' ? fake : { ok: true, count: 1 });
      chrome.tabs.query = async () => [{ id: 1, url: 'https://www.pinterest.com/pin/1234567890/' }];
    };
    install();
  }, FAKE_RESULT);
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  await popup.waitForSelector('#state-result:not([hidden])');
  await popup.waitForTimeout(300);
  const popupPng = path.join(userDir, 'popup.png');
  await popup.screenshot({ path: popupPng, scale: 'device' });
  const popupSrc = 'data:image/png;base64,' + fs.readFileSync(popupPng).toString('base64');

  const page = await ctx.newPage();
  async function render(file, w, h, html) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(OUT, file) });
    console.log('wrote', file);
  }

  const toast = `<div style="position:absolute;left:50%;bottom:34px;transform:translateX(-50%);background:#15803d;color:#fff;
    font:500 16px ${FONT};padding:12px 18px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25)">Download started</div>`;

  await render('screenshot-1-feed.png', 1280, 800, shell(1280, 800, `
    <div style="position:absolute;left:80px;top:150px;width:470px">
      ${headline('Save Pinterest videos as MP4', 'A download button appears on every video. One click, and the MP4 lands in your Downloads folder.')}
    </div>
    <div style="position:absolute;left:600px;top:70px;display:grid;grid-template-columns:repeat(3,190px);gap:18px">
      <div style="display:grid;gap:18px">${videoCard(190, 330, 10, true)}${videoCard(190, 250, 200, true)}</div>
      <div style="display:grid;gap:18px;margin-top:60px">${videoCard(190, 260, 280, true)}${videoCard(190, 320, 140, true)}</div>
      <div style="display:grid;gap:18px">${videoCard(190, 300, 330, true)}${videoCard(190, 280, 40, true)}</div>
    </div>`));

  await render('screenshot-2-pin.png', 1280, 800, shell(1280, 800, `
    <div style="position:absolute;left:80px;top:170px;width:480px">
      ${headline('One click on any pin', 'Open a video pin and press “Download video”. You get the best quality H.264 MP4 that plays everywhere.')}
    </div>
    <div style="position:absolute;left:660px;top:60px">${videoCard(380, 640, 190, false)}</div>
    <div style="position:absolute;left:620px;top:600px;display:flex;gap:8px;align-items:center;background:#1f2a44;color:#fff;
      padding:14px 20px;border-radius:999px;font:600 17px ${FONT};box-shadow:0 6px 20px rgba(0,0,0,.3)">${DL_SVG}Download video</div>
    ${toast.replace('left:50%', 'left:850px')}`));

  await render('screenshot-3-popup.png', 1280, 800, shell(1280, 800, `
    <div style="position:absolute;left:80px;top:180px;width:520px">
      ${headline('Paste a link, get the video', 'Use the toolbar popup with any pinterest.com/pin/… or pin.it/… link. Idea pins with several clips are supported too.')}
    </div>
    <img src="${popupSrc}" style="position:absolute;left:720px;top:${(800 - 744) / 2}px;width:${340 * 1.4}px;border-radius:16px;
      box-shadow:0 24px 60px rgba(15,23,42,.3)">`));

  await render('promo-small-440x280.png', 440, 280, shell(440, 280, `
    <div style="position:absolute;inset:0;display:flex;align-items:center;gap:20px;padding:0 34px">
      <img src="${ICON}" width="96" height="96">
      <div><div style="font:800 30px/1.08 ${FONT};letter-spacing:-.02em">MP4 Video<br>Downloader</div>
      <div style="font:500 17px/1.35 ${FONT};color:#475569;margin-top:8px">for Pinterest</div></div>
    </div>`));

  await render('promo-marquee-1400x560.png', 1400, 560, shell(1400, 560, `
    <div style="position:absolute;left:100px;top:120px;width:560px">
      ${headline('Pinterest videos, saved as MP4', 'One-click downloads from any pin, idea pin or pin.it link.')}
    </div>
    <div style="position:absolute;left:780px;top:90px;display:flex;align-items:flex-start;gap:22px">
      ${videoCard(180, 320, 10, true)}<div style="margin-top:60px">${videoCard(180, 320, 200, true)}</div><div style="margin-top:20px">${videoCard(180, 320, 300, true)}</div>
    </div>`));

  await ctx.close();
  fs.rmSync(userDir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
