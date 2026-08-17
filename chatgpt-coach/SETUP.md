# Gym Coach as a Custom GPT

A ChatGPT GPT that reads AND writes your workout log — it coaches on your
ChatGPT subscription and can log sessions or add new exercises (gym lifts,
legs days) straight into the app's data.

## How it works

The Gym Tracker app's cloud backup lives in a secret GitHub Gist
(`gym-tracker-backup.json`, gist id `5d36fc8ab53a8689838dd8c13a63b868` —
already created and seeded). The GPT has two Actions against the GitHub API:
`getWorkoutLog` (fetches the log at the start of every chat) and
`updateWorkoutLog` (writes sessions and new exercise definitions back).
The app picks up coach-written data via Restore → Merge, and new exercises
appear in the app with generic cards and full logging/charting.

The gist is unlisted but anyone with the exact URL could read the workout
data. Fine for reps and kilos; don't put anything sensitive in the app.
Every write creates a gist revision, so mistakes can be rolled back at
gist.github.com.

## One-time setup (~5 minutes, on chatgpt.com)

1. You need a GitHub personal access token with only the **gist** scope
   (github.com → Settings → Developer settings → Personal access tokens).
   The same token you paste into the app's Cloud backup works.
2. chatgpt.com → **GPTs** (sidebar) → **Create** → **Configure** tab.
3. Name: `Gym Coach`. Description: `Strength coach that reads and logs my
   Gym Tracker workouts`.
4. **Instructions**: paste the entire contents of `instructions.md`.
   **Conversation starters**:
   - What's my workout today?
   - Done training — here's what I did, log it.
   - At the gym today, give me my session.
   - Today only legs and core.
5. **Actions** → **Create new action**:
   - **Schema**: paste the entire contents of `action-openapi.json`.
   - **Authentication**: API Key → Auth Type **Bearer** → paste the GitHub
     token.
   - **Test** `getWorkoutLog` — it should return the gist with your log.
6. **Create** → share setting **Only me** (required — the Action carries
   your token, never share this GPT).

## Using it

- Ask for workouts as usual; the coach reads your current log every chat.
- After training, tell it what you did ("done: bench 3×8@50, squat 3×10@60")
  and it logs the session — creating exercise definitions for anything new —
  then reminds you to pull it into the app.
- **Sync habits:** in the app, tap **Save to cloud** after logging there;
  tap **Restore → Merge** after the coach logs for you. Merge is per-date,
  so keep each date's truth in one place — don't log the same day in the
  app and the chat without syncing between.
- First Action call: ChatGPT asks to allow api.github.com — Always Allow.
