---
title: Clipnest Privacy Policy
---

# Clipnest – Privacy Policy

_Last updated: November 20, 2026_

Clipnest ("the extension") is a Chrome extension that downloads videos from Pinterest pins as MP4 files.

## Summary

**Clipnest does not collect, store, sell or share any personal data.** It has no servers, no analytics, no ads and no tracking.

## What the extension accesses, and why

| What | Why | Where it goes |
|---|---|---|
| The address of the Pinterest page or pin link you choose to download | To find the pin's ID | Stays in your browser |
| Public pin information from `pinterest.com` (title, thumbnail, video links) | To find the MP4 file for the pin | Requested directly from Pinterest; stays in your browser |
| The video file from `pinimg.com` | To save it to your computer | Saved by Chrome to your Downloads folder |
| Your two settings ("Save into a Pinterest folder", "Ask where to save") | To remember your preferences | Stored with `chrome.storage.sync` in your own Google account's Chrome sync data |

When Clipnest asks Pinterest for pin information, your browser sends that request to Pinterest the same way Pinterest's own website does, including your normal Pinterest cookies if you are logged in. Pinterest's own [privacy policy](https://policy.pinterest.com/privacy-policy) covers those requests. Clipnest never reads, stores or sends your cookies or login details anywhere.

## What the extension does **not** do

- It does not run on websites other than Pinterest (it only reads a link when you right-click it and choose the Clipnest menu item).
- It does not record your browsing history.
- It does not send any data to the developer or to any third party.
- It does not load or run code from the internet; all code ships inside the extension package.

## Permissions

- **downloads** – to save the MP4 file to your computer.
- **storage** – to remember your two settings.
- **contextMenus** – to add "Download Pinterest video (MP4)" to the right-click menu.
- **Access to pinterest.com, pin.it and pinimg.com** – to read pin information, expand pin.it short links and fetch the video file.

## Children

The extension is not directed at children under 13 and collects no information from anyone.

## Changes

If this policy changes, the new version will be published at this address with a new "Last updated" date.

## Contact

Questions? Open an issue at the project's GitHub repository: <https://github.com/behnamrm/Pinterest-Downloader/issues>
