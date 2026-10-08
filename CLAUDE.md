# Gym Tracker: notes for Claude

The user is the only person who uses this app. They talk to Claude Code to
change the app and to get coaching. Read `README.md` for the architecture.

## Two repos

- `Gstafylopatis/gym-tracker` (public): the app. GitHub Pages serves `docs/`
  from `main`. Code changes go live only after they are merged to `main`.
- `Gstafylopatis/gym-tracker-data` (private): `log.json`, the workout log.
  The app syncs this file on every device. Edits to it reach the app on its
  next sync (within about 2 minutes, or right away when the app is opened).
  No deploy is needed. To work on the file, add the repo to the session
  (`add_repo` with push access) and edit `log.json` on `main`.

## Coaching workflow

1. Read `log.json` first. Base all advice on the logged numbers.
2. Make the smallest edit that does the job. Keep every other key unchanged,
   keep the JSON valid, and keep the existing formatting (2-space indent,
   small objects on one line, date keys sorted).
3. Commit to `main` in the data repo with a clear message, such as
   `Plan: pull day 2026-10-09` or `Log: 2026-10-08 legs`.
4. Write sets under `sessions` only when the user says they did the training.
   A date that is today or later with no reported training gets a plan, not
   sets.
5. If the app shows a sync error after an edit, the cause is usually invalid
   JSON. The app never overwrites a file it cannot parse, so fix the file and
   commit again.

## Equipment

- **Home (default):** adjustable dumbbells, a pull-up bar, and an ottoman used
  as a bench. No barbell, no real bench, no machines.
- **Gym:** only when the user says they are at the gym.

## Program and progression

- **Program:** push and pull days alternate, with a rest day between when
  possible. The app works out the rotation from the last workout.
- **Progression:** add reps until every set reaches the top of the range, then
  add weight (0.5–2 kg on dumbbells) and go back to the bottom of the range.
  For bodyweight exercises, add total reps, then move to a harder variation.

## `log.json` schema (version 2)

```jsonc
{
  "version": 2,
  "sessions": {                       // completed training, keyed by local date
    "2026-10-08": {
      "day": "push",                  // push | pull | other
      "sets": { "floorpress": [{ "r": 10, "kg": 20 }, { "r": 9, "kg": 20 }] },
      "note": "optional"
    }
  },
  "plans": {                          // future sessions; the app shows these on that date
    "2026-10-10": {
      "day": "other",                 // push | pull | other (other = custom, e.g. legs)
      "title": "Legs day",            // optional; replaces "Custom day" in the header
      "note": "Keep RPE 7",           // optional; shown as a coach note
      "ex": ["kneeraise", { "id": "gobletsquat", "sets": 3, "reps": "10–12", "kg": 16, "note": "pause at bottom" }]
    }
  },
  "customEx": {                       // new exercises, or field overrides for built-ins
    "gobletsquat": {
      "name": "Goblet Squat", "day": "other", "sets": 3, "reps": "10–12", "kg": 16,
      "rest": 120,                    // rest timer, in seconds
      "m": "Quads · glutes",          // short muscle label
      "mus": { "p": ["quads", "glutes"], "s": ["core"] },
      "desc": "One-line description",
      "how": ["Cue 1", "Cue 2", "Cue 3"],
      "img0": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Goblet_Squat/0.jpg",
      "img1": "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Goblet_Squat/1.jpg"
    }
  },
  "program": { "push": ["floorpress", "..."], "pull": ["pullup", "..."] },  // optional
  "overrides": { "2026-10-09": "rest" },   // day type the user forced in the app
  "body": { "2026-10-08": 80.4 }           // bodyweight in kg
}
```

### Field rules

- `kg: null` means a bodyweight exercise. Reps for `row` are per arm.
- Exercise ids are short and lowercase, such as `bench`, `rdl`, or `squat`.
  Never reuse a home exercise id for a different gym lift.
- Muscle keys: chest, shoulders, biceps, triceps, forearms, core, quads,
  traps, lats, midback, lowerback, glutes, hams, calves.
- For photo URLs, use an exact name from `coach/exercise-names.txt`. If no
  name in the list matches, leave out `img0` and `img1`.
- Built-in exercise ids are in `docs/js/program.js`:
  - pull: `pullup`, `row`, `hammer`, `conc`
  - push: `floorpress`, `inclinepu`, `ohp`, `latraise`, `kneeraise`
- To change the default program, set `program` in `log.json`. This takes
  effect with no deploy. Change `program.js` only to change the built-in
  defaults.

## Code conventions

- Plain ES modules with no build step and no dependencies. Keep it that way.
- HTML is built as strings. Escape all data with `esc()`, because `log.json`
  is untrusted input to the renderer.
- After changing any file in `docs/`, run the app (serve `docs/` and load it
  in Playwright) and check the console for errors before you push.
- If you add a new JS or CSS file, add it to `CODE` in `docs/sw.js`. If you
  change images, fonts, or icons, bump `CACHE` in the same file.
