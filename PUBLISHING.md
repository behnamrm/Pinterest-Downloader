# Publishing the extension to the Chrome Web Store

This takes about 30 minutes of your time, then Google reviews the extension (usually 1–3 business days, sometimes longer for new developers).

Everything you need to paste is in [`store/listing.md`](store/listing.md). All images are in [`store/`](store/).

---

## 1. Test it yourself first (5 min)

1. Download this repository (green **Code** button → **Download ZIP**) and unzip it.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (top-right switch).
4. Click **Load unpacked** and choose the **`extension`** folder.
5. Open a Pinterest video pin, for example <https://www.pinterest.com/pin/84301824269690044/>.
6. Click **Download video** (bottom-left of the page). The MP4 should appear in your Downloads.
7. Also try the toolbar icon (pin it via the puzzle-piece menu) and paste a pin link.

## 2. Publish the privacy policy (5 min)

The Web Store requires a public privacy policy URL. The policy is already written in [`docs/privacy-policy.md`](docs/privacy-policy.md); GitHub Pages can host it for free:

1. Merge this branch into your default branch (or use this branch directly in the next step).
2. On GitHub open the repository → **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, branch **main** (or this branch), folder **/docs**, then **Save**.
4. After a minute, check that <https://behnamrm.github.io/Pinterest-Downloader/privacy-policy> opens.

> The repository must be **public** for free GitHub Pages. If you want to keep it private, paste the policy into any public page you control (Google Sites, Notion public page, your website) and use that URL instead.

## 3. Create a developer account (one time, US$5)

1. Go to <https://chrome.google.com/webstore/devconsole> and sign in with the Google account you want to publish under.
2. Accept the developer agreement and pay the one-time **US$5** registration fee.
3. In **Account**, add a contact email and **verify** it (required before publishing).
4. Make sure **2-Step Verification** is on for that Google account (required to publish).

## 4. Build the upload ZIP

The ready-made file is [`dist/pinterest-mp4-downloader-1.0.1.zip`](dist/). To rebuild it after changes:

```bash
./scripts/package.sh
```

## 5. Upload and fill in the listing

1. In the Developer Dashboard click **+ New item** and upload `dist/pinterest-mp4-downloader-1.0.1.zip`.
2. **Store listing** tab: paste the description, choose the category, upload the icon, the 3 screenshots and the promo tiles (see `store/listing.md`).
3. **Privacy practices** tab: paste the single-purpose text and each permission justification, answer **No** to remote code, tick no data types, tick the three certifications, and paste the privacy policy URL.
4. **Distribution** tab: Public, all regions, free.
5. Click **Save draft**, then **Submit for review**.

You can choose **Publish automatically after approval**, or publish manually when the review passes.

## 6. Updating later

1. Change the code and bump `"version"` in `extension/manifest.json` (e.g. `1.0.1` → `1.0.2`).
2. Run `./scripts/package.sh`.
3. In the dashboard open the item → **Package** → **Upload new package** → submit for review.

---

## Review tips (avoid common rejections)

- **Name & branding:** the name uses "for Pinterest" (descriptive use) and the icon is original artwork without Pinterest's logo or red colour. Keep it that way – using Pinterest's logo, or naming it just "Pinterest Downloader", is a common reason for trademark takedowns.
- **Disclaimer:** the description and popup state the extension is not affiliated with Pinterest. Keep it.
- **YouTube:** the Web Store does not allow downloading YouTube videos. The extension refuses pins whose video lives on YouTube or other sites. Don't add that.
- **Permissions:** request nothing beyond what is listed. Each extra permission needs a justification and slows review.
- **Screenshots:** the provided screenshots use mock content, not other people's Pinterest videos. If you replace them with real screenshots, use your own pins.
- If a reviewer rejects the item, the email names the policy. Fix that point and resubmit; it is common and not a problem.

## Known limits

- The extension relies on how Pinterest's website currently delivers videos. If Pinterest changes this, downloads may stop until the extension is updated (the logic is in `extension/lib/resolver.js`).
- Pins that only link to a video on another website (YouTube, Vimeo, TikTok …) can't be downloaded.
