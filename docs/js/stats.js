/* Derived numbers for the Stats screen and PR detection. */

import { store, getEx, exHistory, workoutDates, sessionOf, isWorkout } from './store.js';
import { addDays, mondayOf, todayStr } from './dates.js';
import { MUSCLES } from './program.js';

/* Epley estimated one-rep max. */
export function e1rm(kg, r) {
  if (kg == null || !r) return 0;
  return r === 1 ? kg : kg * (1 + r / 30);
}
export function round1(v) { return Math.round(v * 10) / 10; }

export function isBodyweight(exId) { return getEx(exId).kg == null; }

/* Per-session metrics for one exercise. */
export const METRICS = {
  e1rm: { label: 'Est. 1RM', unit: 'kg', of: (sets) => Math.max(0, ...sets.map((s) => e1rm(s.kg, s.r))) },
  top: { label: 'Top weight', unit: 'kg', of: (sets) => Math.max(0, ...sets.map((s) => s.kg || 0)) },
  volume: { label: 'Volume', unit: 'kg', of: (sets) => sets.reduce((n, s) => n + (s.kg || 0) * s.r, 0) },
  reps: { label: 'Total reps', unit: 'reps', of: (sets) => sets.reduce((n, s) => n + s.r, 0) },
  best: { label: 'Best set', unit: 'reps', of: (sets) => Math.max(0, ...sets.map((s) => s.r)) },
};
export function metricsFor(exId) {
  return isBodyweight(exId) ? ['reps', 'best'] : ['e1rm', 'top', 'volume'];
}

/* Personal records for an exercise, optionally only counting sets before a
   date (and the first `upto` sets on that date). */
export function prsFor(exId, beforeDate, upto) {
  let bestKg = null, bestE = null, bestReps = null;
  for (const h of exHistory(exId)) {
    if (beforeDate && h.date > beforeDate) break;
    const sets = beforeDate && h.date === beforeDate ? h.sets.slice(0, upto || 0) : h.sets;
    for (const s of sets) {
      if (s.kg != null) {
        if (!bestKg || s.kg > bestKg.kg || (s.kg === bestKg.kg && s.r > bestKg.r)) bestKg = { kg: s.kg, r: s.r, date: h.date };
        const e = e1rm(s.kg, s.r);
        if (!bestE || e > bestE.v) bestE = { v: e, kg: s.kg, r: s.r, date: h.date };
      }
      if (!bestReps || s.r > bestReps.r) bestReps = { r: s.r, kg: s.kg, date: h.date };
    }
  }
  return { bestKg, bestE, bestReps };
}

/* Did set #idx on date set a record? Returns a short label or null. */
export function prCheck(exId, date, idx) {
  const s = (sessionOf(date) && sessionOf(date).sets[exId] || [])[idx];
  if (!s) return null;
  const before = prsFor(exId, date, idx);
  if (s.kg != null && !isBodyweight(exId)) {
    if (!before.bestE) return null; // first time ever — not a "record" yet
    if (s.kg > before.bestKg.kg) return 'Weight PR · ' + s.kg + ' kg';
    if (e1rm(s.kg, s.r) > before.bestE.v + 0.01) return 'e1RM PR · ' + round1(e1rm(s.kg, s.r)) + ' kg';
    return null;
  }
  if (!before.bestReps) return null;
  return s.r > before.bestReps.r ? 'Rep PR · ' + s.r + ' reps' : null;
}

/* Which set indices on a date were PRs at the time they were logged. */
export function prSetsOn(exId, date) {
  const sets = (sessionOf(date) && sessionOf(date).sets[exId]) || [];
  const out = new Set();
  sets.forEach((_, i) => { if (prCheck(exId, date, i)) out.add(i); });
  return out;
}

export function setCount(date) {
  const s = sessionOf(date);
  return s && s.sets ? Object.values(s.sets).reduce((n, a) => n + a.length, 0) : 0;
}
export function sessionVolume(date) {
  const s = sessionOf(date);
  if (!s) return 0;
  let v = 0;
  for (const arr of Object.values(s.sets)) for (const x of arr) v += (x.kg || 0) * x.r;
  return v;
}

export function weekWorkouts(monday) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (isWorkout(sessionOf(addDays(monday, i)))) n++;
  return n;
}
/* Consecutive weeks (ending this week or last) with ≥ 2 workouts. */
export function streakWeeks() {
  let m = mondayOf(todayStr());
  let streak = 0;
  if (weekWorkouts(m) >= 2) streak++;
  m = addDays(m, -7);
  while (weekWorkouts(m) >= 2) { streak++; m = addDays(m, -7); }
  return streak;
}

/* Hard sets per muscle between two dates (inclusive). Primary muscles count
   a full set, assisting muscles half a set. */
export function muscleSets(from, to) {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
  for (const d of workoutDates()) {
    if (d < from || d > to) continue;
    for (const [id, arr] of Object.entries(store.sessions[d].sets)) {
      const mus = getEx(id).mus;
      if (!mus || !arr.length) continue;
      for (const m of mus.p || []) if (m in out) out[m] += arr.length;
      for (const m of mus.s || []) if (m in out) out[m] += arr.length * 0.5;
    }
  }
  return out;
}

export function bodyweightSeries() {
  return Object.keys(store.body || {}).sort()
    .filter((d) => typeof store.body[d] === 'number')
    .map((d) => ({ date: d, v: store.body[d] }));
}

export function totals() {
  const ds = workoutDates();
  let sets = 0, vol = 0;
  for (const d of ds) { sets += setCount(d); vol += sessionVolume(d); }
  return { workouts: ds.length, sets, vol, first: ds[0] || null };
}
