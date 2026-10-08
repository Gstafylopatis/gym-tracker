/* Workout data: the single JSON document that syncs to the data repo.

   Shape (version 2):
   {
     version: 2,
     sessions:  { "YYYY-MM-DD": { day, sets: { exId: [{ r, kg }] }, note? } },
     overrides: { "YYYY-MM-DD": "push" | "pull" | "rest" },   // forced day type
     plans:     { "YYYY-MM-DD": { day, note?, ex: [id | { id, sets?, reps?, kg?, note? }] } },
     customEx:  { exId: { name, day, sets, reps, kg, ... } },  // new or overridden exercises
     program:   { push: [ids], pull: [ids] },                  // optional, overrides the default
     body:      { "YYYY-MM-DD": kg },                          // bodyweight log
   }
   kg null = bodyweight. Everything keyed by date so the sync merge works per day. */

import { EX, DEFAULT_PROGRAM, DAY_LABEL } from './program.js';
import { addDays, niceDate, weekdayName } from './dates.js';

const STORE_KEY = 'gym-tracker-v1'; // unchanged since v1 so existing on-device logs carry over
const COLLECTIONS = ['sessions', 'overrides', 'plans', 'customEx', 'body'];

export function emptyStore() {
  return { version: 2, sessions: {}, overrides: {}, plans: {}, customEx: {}, body: {} };
}

/* Coerce anything that came from storage, the network, or an import into a
   well-formed store so a bad file can never crash a render. */
export function normalize(data) {
  const out = emptyStore();
  if (!data || typeof data !== 'object') return out;
  for (const c of COLLECTIONS) {
    if (data[c] && typeof data[c] === 'object' && !Array.isArray(data[c])) out[c] = data[c];
  }
  if (data.program && typeof data.program === 'object') out.program = data.program;
  for (const [d, s] of Object.entries(out.sessions)) {
    if (!s || typeof s !== 'object') { delete out.sessions[d]; continue; }
    if (!s.sets || typeof s.sets !== 'object') s.sets = {};
    for (const [id, arr] of Object.entries(s.sets)) {
      if (!Array.isArray(arr)) { delete s.sets[id]; continue; }
      s.sets[id] = arr.filter((x) => x && typeof x.r === 'number')
        .map((x) => ({ r: x.r, kg: typeof x.kg === 'number' ? x.kg : null }));
    }
    if (!DAY_LABEL[s.day]) s.day = 'other';
  }
  return out;
}

export let store;
try { store = normalize(JSON.parse(localStorage.getItem(STORE_KEY))); } catch (e) { store = emptyStore(); }

const listeners = [];
export function onSave(fn) { listeners.push(fn); }

export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* quota — sync still has it */ }
  for (const fn of listeners) fn();
}
/* Replace the whole document (sync pull, import). Does not trigger listeners. */
export function replaceStore(data) {
  store = normalize(data);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  invalidate();
}

/* ───────── Exercises ───────── */

function prettyName(id) {
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]+/g, ' ');
}
/* Image URLs from the data file are untrusted — accept only plain https URLs. */
function safeImg(u) {
  return (typeof u === 'string' && /^https:\/\/[^\s"'()<>\\]+$/i.test(u)) ? u : null;
}

const exCache = new Map();
export function clearExCache() { exCache.clear(); }

/* Resolve an exercise id: built-in, overridden by customEx, else a safe
   generic definition so unknown ids never crash a render. */
export function getEx(id) {
  if (exCache.has(id)) return exCache.get(id);
  const builtin = EX[id];
  const base = builtin ? { ...builtin } : {
    name: prettyName(id), day: 'other', sets: 3, reps: '', repDefault: 10,
    kg: null, rest: 90, m: 'Custom', mus: null, desc: '', how: [], custom: true,
  };
  const c = store.customEx && store.customEx[id];
  if (c && typeof c === 'object') {
    for (const k of ['name', 'day', 'sets', 'reps', 'repDefault', 'kg', 'm', 'desc', 'rest', 'perArm']) {
      if (c[k] !== undefined) base[k] = c[k];
    }
    if (c.mus && (Array.isArray(c.mus.p) || Array.isArray(c.mus.s))) base.mus = { p: c.mus.p || [], s: c.mus.s || [] };
    if (Array.isArray(c.how)) base.how = c.how.filter((t) => typeof t === 'string');
    if (c.img0 !== undefined) base.img0 = safeImg(c.img0);
    if (c.img1 !== undefined) base.img1 = safeImg(c.img1);
  }
  if (!DAY_LABEL[base.day]) base.day = 'other';
  if (typeof base.sets !== 'number' || base.sets < 1) base.sets = 3;
  if (typeof base.repDefault !== 'number') base.repDefault = parseInt(base.reps, 10) || 10;
  // Logged with a weight at least once → weighted exercise.
  if (base.kg == null && exHistory(id).some((h) => h.sets.some((s) => s.kg != null))) base.kg = 0;
  exCache.set(id, base);
  return base;
}

/* Photo for an exercise: bundled file for built-ins, remote URL otherwise. */
export function exImg(id, n) {
  const ex = getEx(id);
  if (ex['img' + n] !== undefined) return ex['img' + n];
  return EX[id] ? 'images/' + id + '-' + n + '.jpg' : null;
}

export function programFor(type) {
  const p = store.program && Array.isArray(store.program[type]) ? store.program[type] : DEFAULT_PROGRAM[type];
  return (p || []).filter((id) => typeof id === 'string');
}

/* Every exercise id known anywhere: program, custom definitions, the log. */
export function allExIds() {
  const ids = new Set([...programFor('pull'), ...programFor('push'), ...Object.keys(EX)]);
  for (const id of Object.keys(store.customEx || {})) ids.add(id);
  for (const d of workoutDates()) for (const id of Object.keys(store.sessions[d].sets)) ids.add(id);
  return [...ids];
}

/* ───────── Log queries ───────── */

export function sessionOf(date) { return store.sessions[date]; }
export function setsOf(date, exId) {
  const s = sessionOf(date);
  const a = s && s.sets && s.sets[exId];
  return Array.isArray(a) ? a : [];
}
export function isWorkout(sess) {
  return !!(sess && sess.sets && Object.values(sess.sets).some((arr) => arr.length > 0));
}
let wdCache = null;
export function workoutDates() {
  if (!wdCache) wdCache = Object.keys(store.sessions).filter((d) => isWorkout(store.sessions[d])).sort();
  return wdCache;
}
export function invalidate() { wdCache = null; exCache.clear(); }
onSave(invalidate);

export function lastWorkoutBefore(date) {
  const ds = workoutDates();
  for (let i = ds.length - 1; i >= 0; i--) if (ds[i] < date) return ds[i];
  return null;
}
/* Sessions that logged sets for one exercise, oldest → newest. */
export function exHistory(exId) {
  return workoutDates()
    .map((d) => ({ date: d, sets: setsOf(d, exId) }))
    .filter((h) => h.sets.length > 0);
}
export function lastSetsFor(exId, beforeDate) {
  const hist = exHistory(exId).filter((h) => h.date < beforeDate);
  return hist.length ? hist[hist.length - 1] : null;
}
export function lastKg(exId, beforeDate) {
  const prev = lastSetsFor(exId, beforeDate || '9999');
  if (prev) { for (let i = prev.sets.length - 1; i >= 0; i--) { if (prev.sets[i].kg != null) return prev.sets[i].kg; } }
  const kg = getEx(exId).kg;
  return kg === 0 ? null : kg;
}

/* Day type for a date: logged session > manual override > plan > rotation.
   The rotation chains forward from the last real workout, alternating
   push/pull with a rest day between, so future days project the schedule. */
export function dayType(date) {
  const sess = sessionOf(date);
  if (isWorkout(sess)) return sess.day;
  if (store.overrides[date]) return store.overrides[date];
  const plan = store.plans[date];
  if (plan && DAY_LABEL[plan.day]) return plan.day;
  const last = lastWorkoutBefore(date);
  if (!last) return 'push';
  let lw = last, lt = store.sessions[last].day;
  if (lt !== 'push' && lt !== 'pull') {
    // Custom day (e.g. legs) — alternate from the most recent push/pull.
    const ds = workoutDates().filter((d) => d < date);
    for (let i = ds.length - 1; i >= 0; i--) {
      const t = store.sessions[ds[i]].day;
      if (t === 'push' || t === 'pull') { lt = t; break; }
    }
    if (lt !== 'push' && lt !== 'pull') lt = 'pull';
  }
  let d = addDays(last, 1), guard = 0;
  while (d < date && guard++ < 120) {
    const p = store.plans[d];
    const t = store.overrides[d] || (p && DAY_LABEL[p.day] ? p.day : null) ||
      (d === addDays(lw, 1) ? 'rest' : (lt === 'pull' ? 'push' : 'pull'));
    if (t === 'push' || t === 'pull') { lw = d; lt = t; } else if (t !== 'rest') lw = d;
    d = addDays(d, 1);
  }
  return date === addDays(lw, 1) ? 'rest' : (lt === 'pull' ? 'push' : 'pull');
}

/* Normalise a plan entry: "id" or { id, sets, reps, kg, note }. */
function planItem(x) {
  if (typeof x === 'string') return { id: x, target: null };
  if (x && typeof x.id === 'string') {
    const t = {};
    for (const k of ['sets', 'reps', 'kg', 'note']) if (x[k] !== undefined) t[k] = x[k];
    return { id: x.id, target: Object.keys(t).length ? t : null };
  }
  return null;
}

export function planFor(date) {
  const p = store.plans[date];
  return p && typeof p === 'object' ? p : null;
}

/* Exercises shown for a date: the plan (or program), unfinished ones rolled
   over from the previous workout (never onto rest days), plus anything already
   logged that day so recorded sets can never become invisible. */
export function dayItems(date) {
  const type = dayType(date);
  const plan = planFor(date);
  const items = (plan && plan.day === type && Array.isArray(plan.ex))
    ? plan.ex.map(planItem).filter(Boolean).map((it) => ({ ...it, rolled: null }))
    : programFor(type).map((id) => ({ id, target: null, rolled: null }));
  const last = type !== 'rest' && type !== 'other' ? lastWorkoutBefore(date) : null;
  if (last && !plan) {
    const lastType = store.sessions[last].day;
    for (const id of programFor(lastType)) {
      if (items.some((it) => it.id === id)) continue;
      if (setsOf(last, id).length === 0) {
        items.push({ id, target: null, rolled: weekdayName(last).slice(0, 3) + ' ' + niceDate(last) });
      }
    }
  }
  const sess = sessionOf(date);
  if (sess && sess.sets) {
    for (const id of Object.keys(sess.sets)) {
      if (!items.some((it) => it.id === id)) items.push({ id, target: null, rolled: null, extra: true });
    }
  }
  return items;
}

export function targetSets(item) {
  return (item.target && typeof item.target.sets === 'number') ? item.target.sets : getEx(item.id).sets;
}
export function exDone(date, item) { return setsOf(date, item.id).length >= targetSets(item); }

/* ───────── Mutations ───────── */

/* A session's day type follows the work logged in it: the majority of the
   logged exercises' day types wins; ties keep the stored label. */
function majorityDay(sess) {
  const counts = {};
  for (const id of Object.keys(sess.sets || {})) {
    if ((sess.sets[id] || []).length) {
      const d = getEx(id).day;
      counts[d] = (counts[d] || 0) + 1;
    }
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!best.length) return sess.day;
  if (best[1] && best[1][1] === best[0][1]) return DAY_LABEL[sess.day] ? sess.day : best[0][0];
  return best[0][0];
}

export function logSet(date, exId, r, kg) {
  let sess = store.sessions[date];
  if (!sess) {
    const t = dayType(date);
    sess = store.sessions[date] = { day: t === 'rest' ? getEx(exId).day : t, sets: {} };
  }
  (sess.sets[exId] = sess.sets[exId] || []).push({ r, kg });
  sess.day = majorityDay(sess);
  save();
}
export function insertSet(date, exId, idx, set) {
  logSet(date, exId, set.r, set.kg);
  const arr = setsOf(date, exId);
  arr.splice(idx, 0, arr.pop());
  save();
}
export function removeSet(date, exId, idx) {
  const sets = setsOf(date, exId);
  if (idx < 0 || idx >= sets.length) return;
  sets.splice(idx, 1);
  const sess = store.sessions[date];
  if (sets.length === 0) delete sess.sets[exId];
  if (!isWorkout(sess) && !sess.note) delete store.sessions[date];
  else sess.day = majorityDay(sess);
  save();
}
export function updateSet(date, exId, idx, r, kg) {
  const sets = setsOf(date, exId);
  if (sets[idx]) { sets[idx] = { r, kg }; save(); }
}
export function setOverride(date, type) {
  if (isWorkout(sessionOf(date))) return;
  store.overrides[date] = type;
  save();
}
export function setBodyweight(date, kg) {
  if (kg == null) delete store.body[date]; else store.body[date] = kg;
  save();
}
