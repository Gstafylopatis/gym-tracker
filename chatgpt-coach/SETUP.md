# Gym Coach as a Custom GPT

A ChatGPT GPT that reads your live workout log and coaches on your ChatGPT
subscription — no API key, no pasting.

## How it works

The Gym Tracker app's cloud backup lives in a secret GitHub Gist
(`gym-tracker-backup.json`, gist id `5d36fc8ab53a8689838dd8c13a63b868` —
already created and seeded). The GPT has an Action that fetches that gist's
raw URL at the start of every chat, so it always sees your current log.

The gist URL is unlisted but not access-controlled — anyone with the exact
URL could read the workout data. Fine for reps and kilos; don't put anything
sensitive in the app.

## One-time setup (~5 minutes, on chatgpt.com)

1. chatgpt.com → **GPTs** (sidebar) → **Create** → switch to the
   **Configure** tab.
2. Name: `Gym Coach`. Description: `Strength coach that reads my Gym
   Tracker log`.
3. **Instructions**: paste the entire contents of `instructions.md`.
4. **Capabilities**: nothing required — you can untick Web Browsing/DALL·E.
5. Scroll to **Actions** → **Create new action**:
   - **Schema**: paste the entire contents of `action-openapi.json`.
   - **Authentication**: None.
   - Use the **Test** button on `getWorkoutLog` — it should return your log.
6. **Create** → share setting **Only me**.

## Using it

- Open the Gym Coach GPT (pin it; it works in the ChatGPT mobile app too)
  and just ask — "what's today?", "when do I add weight to rows?". On the
  first Action call ChatGPT asks to allow gist.githubusercontent.com —
  choose Always Allow.
- **Keeping the log fresh:** in the Gym Tracker app, connect Cloud backup
  (Progress → Backup → GitHub token with gist scope) and tap **Save to
  cloud** after workouts. The app updates this same gist, so the GPT sees it
  immediately. If the coach's data looks stale, that's the reason.
