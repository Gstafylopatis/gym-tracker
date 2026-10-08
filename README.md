# Gym Tracker

A personal workout tracker that runs as an installable web app on your phone
and computer. It is a static site on GitHub Pages, so there is no server to run
or pay for. Your log syncs through a JSON file in a private GitHub repo.

**App:** https://gstafylopatis.github.io/gym-tracker/

## Features

- **Today:** the day's push, pull, or custom session. Tap **+** to log a set
  with your last numbers, or tap the card to log each set yourself. Exercises
  you missed last time roll over to the next session.
- **Rest timer:** starts after each set, using each exercise's rest time.
  You can add or remove 15 s. It beeps and vibrates when rest is over, keeps
  the screen on while it runs, and can send a notification when the app is in
  the background.
- **PRs:** shows a badge when you set a weight, estimated-1RM, or rep record.
- **Stats:** weekly tiles and streak, an 18-week training heatmap, and
  per-exercise charts (est. 1RM, top weight, volume, reps). Also weekly sets
  per muscle, a list of personal records, and bodyweight tracking.
- **Week:** this week's schedule and past or upcoming weeks, including
  sessions your coach planned.
- **Works offline.** Dark mode by default, with light mode in Settings.

## Setup (one time)

### 1. Host the app

GitHub → this repo → **Settings → Pages** → Source: *Deploy from a branch* →
`main`, folder `/docs`. The site is live at the URL above about a minute later.

Install it on your phone:

- **Android (Chrome):** open the URL → menu → **Add to Home screen**.
- **iPhone (Safari):** open the URL → Share → **Add to Home Screen**.
- **Computer (Chrome or Edge):** open the URL → click the install icon in the
  address bar.

### 2. Turn on sync

Your log lives in the private repo **`Gstafylopatis/gym-tracker-data`**, in
the file `log.json`.

1. GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories** → `gym-tracker-data`.
   - Permissions → Repository → **Contents: Read and write**. Leave all other
     permissions off.
   - Expiration: up to 1 year. When the token expires, the app shows a sync
     error and you paste a new token.
2. In the app, go to **Settings → Sync**. Paste the token and tap
   **Connect & sync**. Do this on each device.

The first sync uploads what is already on the device. After that, sync runs
automatically:

- when the app opens,
- when you return to it,
- every two minutes while it is open,
- a few seconds after each change.

Edits from different devices merge per value. If two devices changed the same
value, the device that is syncing wins.

The token is stored only in that browser's local storage. It can access one
private repo and nothing else.

### 3. Let Claude Code be your coach

In claude.ai/code, ask for workouts, program changes, or a progress review.
Claude reads and edits `log.json` in the data repo, and the app picks up the
changes on its next sync. The data repo must be enabled for the Claude GitHub
App (github.com/settings/installations → Claude → Repository access) so that
Claude sessions can open it. See `CLAUDE.md` for the data format.

## Layout

```
docs/                 the deployable site (GitHub Pages serves this folder)
  index.html          app shell
  css/app.css         styles and theme tokens (dark and light)
  js/app.js           entry point: rendering, event handling
  js/views.js         screens: Today, exercise detail, Week, Stats, Settings
  js/store.js         log data: queries, rotation logic, mutations
  js/sync.js          GitHub sync with three-way merge
  js/stats.js         PRs, estimated 1RM, muscle volume
  js/charts.js        SVG line chart, heatmap, bars
  js/timer.js         rest timer
  js/program.js       built-in exercises and the default program
  sw.js               service worker (offline support)
coach/                reference files for coaching (exercise photo names)
```

There is no build step. Edit the files and push to `main`, and GitHub Pages
redeploys in about a minute. Installed apps load the new version on their
next launch. If you change anything in `images/`, `fonts/`, or `icons/`, also
bump `CACHE` in `docs/sw.js`.
