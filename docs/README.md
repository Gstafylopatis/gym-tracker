# Gym Tracker

Self-contained PWA for the home dumbbell push/pull program. No build step,
no external dependencies — everything in this folder is the deployable site.

## Deploy on GitHub Pages

This folder is named `docs/` so the simplest Pages setup works:
repo → Settings → Pages → "Deploy from a branch" → `main` / `docs`.
Then on your phone open the published URL in Chrome → menu → **Add to Home
Screen**. On desktop Chrome use the install icon in the address bar.

## Updating the app

Edit `docs/index.html` and push — from this PC, from github.com's web editor
(press `.` in the repo for the full editor), or from any Claude Code session
(claude.ai/code can clone, edit, and push the repo). GitHub Pages redeploys
automatically in ~1 minute, and installed clients pick the new version up on
their next online launch (navigations are network-first; the cached copy is
only the offline fallback).

If you change anything in `images/`, `fonts/`, or `icons/`, also bump the
`CACHE` version string at the top of `sw.js` so installed clients refetch
those static assets.

## Data & backup

All workout data lives in `localStorage` on the device. On first run the log
is seeded with the 2026-08-17 pull session. Two backup paths, both under
**Progress → Backup**:

- **Export / Import JSON** — plain file download/upload for manual moves.
- **Cloud backup (GitHub Gist)** — paste a GitHub fine-grained personal
  access token with only the *gist* scope (github.com → Settings →
  Developer settings → Personal access tokens); the app saves the log to a
  private gist named `gym-tracker-backup.json` and can restore it on any
  device where you paste the same token. The token is stored only in that
  device's localStorage. Restore offers merge (file wins on overlapping
  dates) or full replace.
