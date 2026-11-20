# Chrome Web Store listing – copy & paste text

Everything below goes into the Chrome Web Store Developer Dashboard. Field names match the dashboard.

---

## Store listing tab

**Name** (comes from manifest.json):
```
Clipnest – Video Downloader for Pinterest
```

**Summary / short description** (comes from manifest.json, max 132 chars):
```
Download Pinterest videos as MP4 files in one click. Works on pins, idea pins and pin.it links.
```

**Description:**
```
Clipnest lets you save Pinterest videos to your computer as standard MP4 files, in one click.

HOW IT WORKS
• Open any video pin and click the "Download video" button in the bottom-left corner.
• Or click the "MP4" button that appears on videos in your feed and in search results.
• Or click the Clipnest icon in the toolbar and paste a pinterest.com/pin/… or pin.it/… link.
• Or right-click any pin link and choose "Download Pinterest video (MP4)".

FEATURES
• Real MP4 files (H.264 video + AAC audio) that play on Windows, macOS, phones and video editors.
• Picks the best available quality automatically.
• Idea pins with several clips: download one clip or all of them.
• Works with pin.it short links.
• Clean file names based on the pin title.
• Optional: save into a "Pinterest" folder, or choose where to save each file.
• Works on Pinterest country sites (pinterest.co.uk, pinterest.de, pinterest.fr, …).

PRIVACY
Clipnest has no servers, no analytics, no ads and no tracking. It only talks to Pinterest to find the video and saves the file directly with Chrome's download manager. Nothing about you is collected or shared.

NOTES
• Videos that a pin only links to on other websites (for example YouTube) are not supported.
• Please download only videos you own or have permission to save, and respect creators' rights.

Clipnest is an independent project and is not affiliated with, endorsed or sponsored by Pinterest, Inc. Pinterest is a trademark of Pinterest, Inc.
```

**Category:** `Tools` (alternative: `Photos`)

**Language:** English

**Graphic assets** (all in the `store/` folder):

| Dashboard field | File |
|---|---|
| Store icon (128×128) | `store/store-icon-128.png` |
| Screenshots (1280×800, upload in this order) | `store/screenshot-1-feed.png`, `store/screenshot-2-pin.png`, `store/screenshot-3-popup.png` |
| Small promo tile (440×280) | `store/promo-small-440x280.png` |
| Marquee promo tile (1400×560, optional) | `store/promo-marquee-1400x560.png` |

**Official URL:** leave empty (needs a verified domain).
**Homepage URL:** `https://github.com/behnamrm/Pinterest-Downloader`
**Support URL:** `https://github.com/behnamrm/Pinterest-Downloader/issues`

---

## Privacy practices tab

**Single purpose description:**
```
Clipnest downloads videos from Pinterest pins as MP4 files. Every feature (in-page download buttons, toolbar popup, right-click menu) serves that one purpose.
```

**Permission justifications:**

`downloads`
```
Used to save the Pinterest video the user chose as an MP4 file through Chrome's download manager.
```

`storage`
```
Stores the user's two preferences: whether to save files into a "Pinterest" subfolder and whether to ask where to save each file.
```

`contextMenus`
```
Adds a "Download Pinterest video (MP4)" item to the right-click menu on Pinterest pin links and pin pages.
```

Host permissions (`https://*.pinterest.com/*`, `https://pin.it/*`, `https://*.pinimg.com/*`) and content scripts on Pinterest sites:
```
pinterest.com (and Pinterest country domains): the content script adds the download buttons to Pinterest video pins, and the extension reads the public pin information (title, video links) needed to find the MP4 file.
pin.it: expands Pinterest short links the user pastes into the popup to the full pin address.
pinimg.com: Pinterest's video CDN; used to check that an MP4 file exists before downloading it.
The extension does not run on any other website.
```

**Are you using remote code?** `No, I am not using remote code.`

**Data usage** – tick **nothing** in the "collects or uses" list (the extension collects no user data), then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
```
https://behnamrm.github.io/Pinterest-Downloader/privacy-policy
```
(after enabling GitHub Pages – see PUBLISHING.md, step 2)

---

## Distribution tab

- Visibility: **Public** (or **Unlisted** for a soft launch)
- Regions: All regions
- Pricing: Free
