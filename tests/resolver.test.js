// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../extension/lib/resolver.js');

const HASH = '62b7a5ecc1b483e99a3456ef9c2f7861';
const HASH2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const v = (path, hash = HASH, ext = 'mp4') => `https://v1.pinimg.com/videos/${path}/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4, 6)}/${hash}.${ext}`;

test('extractPinId handles the common URL shapes', () => {
  assert.equal(R.extractPinId('https://www.pinterest.com/pin/84301824269690044/'), '84301824269690044');
  assert.equal(R.extractPinId('https://de.pinterest.com/pin/84301824269690044'), '84301824269690044');
  assert.equal(R.extractPinId('https://www.pinterest.co.uk/pin/recipe-video--454933999867625815/'), '454933999867625815');
  assert.equal(R.extractPinId('/pin/84301824269690044/?mt=login'), '84301824269690044');
  assert.equal(R.extractPinId('84301824269690044'), '84301824269690044');
  assert.equal(R.extractPinId('https://www.pinterest.com/someone/board/'), null);
  assert.equal(R.extractPinId(''), null);
});

test('short links and hosts', () => {
  assert.ok(R.isShortLink('https://pin.it/1yUQAh7Ue'));
  assert.ok(!R.isShortLink('https://pinterest.com/pin/1'));
  assert.ok(R.isPinterestHost('www.pinterest.com'));
  assert.ok(R.isPinterestHost('pinterest.co.uk'));
  assert.ok(!R.isPinterestHost('notpinterest.com.evil.io'));
});

test('regular video pin: prefers H.264 720p MP4', () => {
  const pin = {
    title: 'Easy pasta',
    videos: {
      video_list: {
        V_HLSV4: { url: v('iht/hls', HASH, 'm3u8'), width: 1080, height: 1920 },
        V_720P: { url: v('iht/720p'), width: 1080, height: 1920, duration: 30000 }
      }
    },
    pinner: { videos: { video_list: { V_720P: { url: v('iht/720p', HASH2) } } } }
  };
  const groups = R.collectVideoGroups(pin);
  assert.equal(groups.length, 1, 'pinner branch must be ignored');
  const [best] = R.rankCandidates(groups[0]);
  assert.equal(best.url, v('iht/720p'));
  assert.equal(best.verified, true);
  assert.equal(R.qualityLabel(best), '720p');
  assert.equal(R.qualityLabel({ key: 'V_EXP7', url: v('mc/expMp4'), width: 1080, height: 1920 }), '1080p');
});

test('idea/story pin with several clips yields one group per clip', () => {
  const pin = {
    story_pin_data: {
      pages: [
        { blocks: [{ video: { video_list: { V_EXP7: { url: v('mc/expMp4', HASH) + '' , width: 720, height: 1280 }, V_EXP4: { url: v('mc/expMp4', HASH).replace('.mp4', '_t4.mp4'), width: 360, height: 640 } } } }] },
        { blocks: [{ video: { video_list: { V_EXP7: { url: v('mc/expMp4', HASH2), width: 720, height: 1280 } } } }] }
      ]
    }
  };
  const groups = R.collectVideoGroups(pin);
  assert.equal(groups.length, 2);
  assert.equal(R.rankCandidates(groups[0])[0].width, 720);
});

test('HLS-only pin derives an unverified 720p MP4', () => {
  const groups = [[{ key: 'V_HLSV3_MOBILE', url: v('mc/hls', HASH, 'm3u8'), width: 0, height: 0 }]];
  const [cand] = R.rankCandidates(groups[0]);
  assert.equal(cand.url, v('mc/720p'));
  assert.equal(cand.verified, false);
  assert.equal(R.hlsToMp4(v('iht/h265', HASH, 'm3u8')), v('iht/720p'));
});

test('HEVC MP4s are only used after H.264 options', () => {
  const group = [
    { key: 'hevcMp4V2', url: v('iht/hevcMp4V2').replace('.mp4', '_t5.mp4'), width: 1080, height: 1920 },
    { key: 'V_720P', url: v('iht/720p'), width: 720, height: 1280 }
  ];
  const ranked = R.rankCandidates(group);
  assert.equal(ranked[0].key, 'V_720P');
  assert.match(ranked[ranked.length - 1].url, /hevc/);
});

test('HTML fallback scopes to the pin\'s own data', () => {
  const pinId = '84301824269690044';
  const html = `
    <script>window.__PWS_RELAY_REGISTER_COMPLETED_REQUEST__("%7B%22pinId%22%3A%22${pinId}%22%7D", {"videoUrls":["${v('iht/720p')}","${v('iht/hls', HASH, 'm3u8')}"]})</script>
    <script>{"related":"${v('iht/720p', HASH2)}"}</script>`;
  const groups = R.collectFromHtml(html, pinId);
  assert.equal(groups.length, 1);
  assert.equal(R.rankCandidates(groups[0])[0].url, v('iht/720p'));
});

test('HTML fallback without owner chunk keeps only the first video', () => {
  const html = `<script>"${v('iht/720p')}" "${v('iht/720p', HASH2)}" "https://v1.pinimg.com/videos/thumbnails/originals/62/b7/a5/${HASH}.0000000.jpg"</script>`;
  const groups = R.collectFromHtml(html, '1234567');
  assert.equal(groups.length, 1);
  assert.equal(groups[0][0].url, v('iht/720p'));
});

test('safeFileName strips hashtags, emoji and reserved characters', () => {
  assert.equal(R.safeFileName('Dry Tinde Ki Sabji 👩‍🍳 Recipe 🔪 #food #yum'), 'Dry Tinde Ki Sabji Recipe');
  assert.equal(R.safeFileName('a/b\\c:d*e?f"g<h>i|j'), 'a b c d e f g h i j');
  assert.equal(R.safeFileName('...hidden.'), 'hidden');
  assert.equal(R.safeFileName('CON'), '_CON');
  assert.ok(R.safeFileName('word '.repeat(50)).length <= 80);
});

test('pickTitle falls back sensibly', () => {
  assert.equal(R.pickTitle({ title: '', grid_title: 'Grid' }, '1'), 'Grid');
  assert.equal(R.pickTitle({}, '99'), 'pinterest-99');
});
