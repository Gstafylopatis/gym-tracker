/* Screen renderers. Each returns an HTML string; app.js swaps it into #app. */

import { DAY_LABEL, MUSCLES, MUSCLE_LABEL, WEEK_TARGET, KG_STEP } from './program.js';
import {
  store, getEx, exImg, dayType, dayItems, planFor, setsOf, sessionOf, isWorkout, lastSetsFor, lastKg,
  exHistory, allExIds, targetSets, exDone, workoutDates,
} from './store.js';
import { todayStr, addDays, mondayOf, niceDate, weekdayName, isoWeek, relTime, parseDate } from './dates.js';
import {
  METRICS, metricsFor, prsFor, prSetsOn, round1, setCount, weekWorkouts, streakWeeks,
  muscleSets, bodyweightSeries, totals, isBodyweight,
} from './stats.js';
import { lineChart, heatmap, heatLegend, barList } from './charts.js';
import { status as syncStatus, configured, repoName, filePath, DEFAULT_REPO, DEFAULT_PATH } from './sync.js';
import { prefs } from './prefs.js';
import { I } from './icons.js';
import { ui, esc } from './ui.js';

export const APP_VERSION = '2.0.0';

/* ───────── Formatting ───────── */

export function kgLabel(kg) { return kg == null ? 'BW' : round1(kg) + ' kg'; }
export function setsSummary(sets) {
  if (!sets.length) return '';
  const reps = sets.map((s) => s.r).join(' · ');
  const kgs = [...new Set(sets.map((s) => s.kg))];
  const kgPart = kgs.length === 1 ? (kgs[0] == null ? 'BW' : round1(kgs[0]) + ' kg') : sets.map((s) => kgLabel(s.kg)).join(' / ');
  return reps + ' @ ' + kgPart;
}
const shortDate = (d) => weekdayName(d).slice(0, 3) + ' ' + niceDate(d);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

export function syncDot() {
  if (!configured()) {
    return '<button class="sync-dot" data-act="nav" data-screen="settings" aria-label="Sync is off"><i></i>Local</button>';
  }
  const s = syncStatus.state;
  const label = s === 'syncing' ? 'Syncing' : s === 'error' ? 'Sync error' : s === 'offline' ? 'Offline' : 'Synced';
  return '<button class="sync-dot ' + s + '" data-act="nav" data-screen="settings" aria-label="Sync status: ' + label + '"><i></i>' + label + '</button>';
}

function thumb(id, cls) {
  const img = exImg(id, 0);
  return '<div class="thumb' + (cls ? ' ' + cls : '') + '">' +
    (img && img.startsWith('images/') ? '' : '<div class="ph">' + I.dumbbell + '</div>') +
    (img ? '<div style="background-image: url(&quot;' + esc(img) + '&quot;);"></div>' : '') + '</div>';
}

/* ───────── Today ───────── */

function itemTarget(item, date) {
  const ex = getEx(item.id);
  const t = item.target || {};
  const sets = targetSets(item);
  const reps = t.reps != null ? t.reps : ex.reps;
  const kg = t.kg !== undefined ? t.kg : (ex.kg == null ? null : lastKg(item.id, date));
  return { sets, reps, kg, coachKg: t.kg !== undefined, note: t.note };
}

export function renderToday() {
  const date = ui.viewDate;
  const today = todayStr();
  const isToday = date === today;
  const type = dayType(date);
  const items = dayItems(date);
  const logged = isWorkout(sessionOf(date));
  const plan = planFor(date);
  const doneCount = items.filter((it) => exDone(date, it)).length;
  const totalSets = items.reduce((n, it) => n + setsOf(date, it.id).length, 0);

  const kicker = (isToday ? 'Today · ' : date > today ? 'Planned · ' : '') + weekdayName(date) + ' ' + niceDate(date);
  const title = plan && typeof plan.title === 'string' && plan.title.trim() && plan.day === type ? esc(plan.title)
    : type === 'rest' && !items.length ? 'Rest day' : DAY_LABEL[type] + ' day';

  const seg = logged ? '' : '<div class="seg">' + ['push', 'pull', 'rest'].map((t) =>
    '<button class="' + (t === type ? 'on' : '') + '" data-act="daytype" data-type="' + t + '">' + DAY_LABEL[t] + '</button>').join('') + '</div>';

  const nav = '<div class="date-nav">' +
    (isToday ? '' : '<button class="link-btn" data-act="gotoday">Today</button>') +
    '<button class="icon-btn" data-act="daystep" data-d="-1" aria-label="Previous day">' + I.left + '</button>' +
    '<button class="icon-btn" data-act="daystep" data-d="1" aria-label="Next day">' + I.right + '</button></div>';

  const pct = items.length ? doneCount / items.length : 0;
  const progress = items.length
    ? '<div class="progress-track"><div class="progress-fill' + (pct === 1 ? ' full' : '') + '" style="width: ' + Math.round(pct * 100) + '%;"></div></div>' +
      '<div class="sub">' + doneCount + ' of ' + plural(items.length, 'exercise') + ' done · ' + plural(totalSets, 'set') + ' logged</div>'
    : '';

  const note = plan && typeof plan.note === 'string' && plan.note.trim()
    ? '<div class="note-card">' + I.note + '<div><b>Coach</b> · ' + esc(plan.note) + '</div></div>' : '';

  const cards = items.map((it) => {
    const ex = getEx(it.id);
    const sets = setsOf(date, it.id);
    const tg = itemTarget(it, date);
    const done = sets.length >= tg.sets;
    const meta = sets.length
      ? setsSummary(sets)
      : tg.sets + ' × ' + (tg.reps || '?') + (ex.kg == null && tg.kg == null ? ' · bodyweight' : ' · ' + kgLabel(tg.kg));
    const prs = sets.length ? prSetsOn(it.id, date) : new Set();
    const dots = '<span class="set-dots">' + Array.from({ length: Math.max(tg.sets, sets.length) }, (_, i) =>
      '<i class="' + (i < sets.length ? 'on' : '') + '"></i>').join('') + '</span>';
    return '<div class="ex-card' + (done ? ' done' : '') + '" data-act="open" data-id="' + esc(it.id) + '" role="button" tabindex="0">' +
      thumb(it.id) +
      '<div class="ex-body"><div class="ex-name">' + esc(ex.name) + '</div>' +
      '<div class="ex-meta">' + esc(meta) + '</div>' +
      '<div class="ex-tags">' + dots +
      (prs.size ? '<span class="pill pill-accent">' + I.trophy + 'PR</span>' : '') +
      (it.rolled ? '<span class="pill">↳ from ' + esc(it.rolled) + '</span>' : '') +
      (tg.note ? '<span class="pill pill-accent">' + esc(tg.note) + '</span>' : '') +
      '</div></div>' +
      '<button class="quick' + (done ? ' done' : '') + '" data-act="quickset" data-id="' + esc(it.id) + '" aria-label="Log a set of ' + esc(ex.name) + '">' +
      (done ? I.check : sets.length ? sets.length + '/' + tg.sets : I.plus) + '</button></div>';
  }).join('');

  const empty = !items.length
    ? '<div class="card empty"><div class="big">' + (type === 'rest' ? 'Rest day' : 'Nothing planned') + '</div>' +
      '<div class="sub" style="margin-top: 6px;">' + (type === 'rest'
        ? 'Recovery is where the muscle gets built.<br>Feeling fresh? Switch the day type above.'
        : 'Add exercises below, or ask your coach for a session.') + '</div></div>'
    : '';

  return '<div class="screen" data-scroll="today">' +
    '<div class="today-head"><div><div class="kicker">' + kicker + '</div><h1 class="title">' + title + '</h1></div>' + syncDot() + '</div>' +
    '<div class="between" style="margin-top: 12px;">' + (seg || '<span class="pill">' + plural(totalSets, 'set') + ' logged</span>') + nav + '</div>' +
    progress + note +
    '<div class="ex-list">' + empty + cards + '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="addex" style="margin-top: 12px;">' + I.plus + 'Add exercise</button>' +
    syncBanner() +
    '</div>';
}

function syncBanner() {
  if (configured()) {
    if (syncStatus.state !== 'error') return '';
    return '<button class="banner error" data-act="nav" data-screen="settings">' + I.alert + '<div><b>Sync problem</b><br>' + esc(syncStatus.msg) + '</div></button>';
  }
  if (!workoutDates().length) return '';
  return '<button class="banner" data-act="nav" data-screen="settings">' + I.cloud +
    '<div><b>Turn on sync</b><br>Your log only lives on this device. Connect the private data repo to sync phone and computer.</div></button>';
}

/* ───────── Exercise detail ───────── */

function musFigures(mus) {
  const c = {};
  for (const k of MUSCLES) c[k] = 'var(--surface-3)';
  for (const k of mus.s || []) c[k] = 'color-mix(in srgb, var(--accent) 45%, var(--surface-3))';
  for (const k of mus.p || []) c[k] = 'var(--accent)';
  const g = 'var(--surface-2)';
  const body =
    '<circle cx="60" cy="14" r="9" fill="' + g + '"/>' +
    '<line x1="60" y1="22" x2="60" y2="30" stroke="' + g + '" stroke-width="9" stroke-linecap="round"/>' +
    '<rect x="38" y="32" width="44" height="76" rx="16" fill="' + g + '"/>' +
    '<rect x="42" y="106" width="36" height="18" rx="9" fill="' + g + '"/>' +
    '<line x1="34" y1="42" x2="26" y2="80" stroke="' + g + '" stroke-width="10" stroke-linecap="round"/>' +
    '<line x1="86" y1="42" x2="94" y2="80" stroke="' + g + '" stroke-width="10" stroke-linecap="round"/>' +
    '<line x1="24" y1="88" x2="20" y2="112" stroke="' + g + '" stroke-width="8" stroke-linecap="round"/>' +
    '<line x1="96" y1="88" x2="100" y2="112" stroke="' + g + '" stroke-width="8" stroke-linecap="round"/>' +
    '<line x1="51" y1="130" x2="48" y2="172" stroke="' + g + '" stroke-width="14" stroke-linecap="round"/>' +
    '<line x1="69" y1="130" x2="72" y2="172" stroke="' + g + '" stroke-width="14" stroke-linecap="round"/>' +
    '<line x1="47" y1="178" x2="45" y2="206" stroke="' + g + '" stroke-width="10" stroke-linecap="round"/>' +
    '<line x1="73" y1="178" x2="75" y2="206" stroke="' + g + '" stroke-width="10" stroke-linecap="round"/>';
  const front = body +
    '<circle cx="36" cy="40" r="7" fill="' + c.shoulders + '"/><circle cx="84" cy="40" r="7" fill="' + c.shoulders + '"/>' +
    '<ellipse cx="50" cy="54" rx="9" ry="7" fill="' + c.chest + '"/><ellipse cx="70" cy="54" rx="9" ry="7" fill="' + c.chest + '"/>' +
    '<line x1="33" y1="50" x2="27" y2="74" stroke="' + c.biceps + '" stroke-width="8" stroke-linecap="round"/>' +
    '<line x1="87" y1="50" x2="93" y2="74" stroke="' + c.biceps + '" stroke-width="8" stroke-linecap="round"/>' +
    '<line x1="24" y1="90" x2="21" y2="108" stroke="' + c.forearms + '" stroke-width="7" stroke-linecap="round"/>' +
    '<line x1="96" y1="90" x2="99" y2="108" stroke="' + c.forearms + '" stroke-width="7" stroke-linecap="round"/>' +
    '<rect x="52" y="64" width="16" height="38" rx="8" fill="' + c.core + '"/>' +
    '<line x1="51" y1="134" x2="48" y2="166" stroke="' + c.quads + '" stroke-width="11" stroke-linecap="round"/>' +
    '<line x1="69" y1="134" x2="72" y2="166" stroke="' + c.quads + '" stroke-width="11" stroke-linecap="round"/>';
  const back = body +
    '<ellipse cx="60" cy="38" rx="13" ry="7" fill="' + c.traps + '"/>' +
    '<circle cx="36" cy="40" r="7" fill="' + c.shoulders + '"/><circle cx="84" cy="40" r="7" fill="' + c.shoulders + '"/>' +
    '<ellipse cx="60" cy="57" rx="8" ry="8" fill="' + c.midback + '"/>' +
    '<ellipse cx="49" cy="73" rx="7" ry="14" transform="rotate(8 49 73)" fill="' + c.lats + '"/>' +
    '<ellipse cx="71" cy="73" rx="7" ry="14" transform="rotate(-8 71 73)" fill="' + c.lats + '"/>' +
    '<ellipse cx="60" cy="96" rx="7" ry="8" fill="' + c.lowerback + '"/>' +
    '<line x1="33" y1="50" x2="27" y2="74" stroke="' + c.triceps + '" stroke-width="8" stroke-linecap="round"/>' +
    '<line x1="87" y1="50" x2="93" y2="74" stroke="' + c.triceps + '" stroke-width="8" stroke-linecap="round"/>' +
    '<circle cx="52" cy="114" r="8.5" fill="' + c.glutes + '"/><circle cx="68" cy="114" r="8.5" fill="' + c.glutes + '"/>' +
    '<line x1="51" y1="134" x2="48" y2="166" stroke="' + c.hams + '" stroke-width="11" stroke-linecap="round"/>' +
    '<line x1="69" y1="134" x2="72" y2="166" stroke="' + c.hams + '" stroke-width="11" stroke-linecap="round"/>' +
    '<line x1="47" y1="182" x2="45" y2="202" stroke="' + c.calves + '" stroke-width="9" stroke-linecap="round"/>' +
    '<line x1="73" y1="182" x2="75" y2="202" stroke="' + c.calves + '" stroke-width="9" stroke-linecap="round"/>';
  const fig = (inner, cap) =>
    '<figure style="margin: 0; text-align: center;"><svg width="88" height="162" viewBox="0 0 120 220" fill="none">' + inner + '</svg>' +
    '<figcaption class="muted" style="font-size: 11.5px;">' + cap + '</figcaption></figure>';
  return '<div class="mus-figs">' + fig(front, 'Front') + fig(back, 'Back') + '</div>' +
    '<div class="mus-legend"><span><i style="background: var(--accent);"></i>Primary</span>' +
    '<span><i style="background: color-mix(in srgb, var(--accent) 45%, var(--surface-3));"></i>Assisting</span></div>';
}

/* Default values for the next set: same set number last session, else the
   previous set today, else the target/exercise default. */
export function nextSetDefaults(id, date, idx) {
  const ex = getEx(id);
  const sets = setsOf(date, id);
  const prev = lastSetsFor(id, date);
  const item = dayItems(date).find((it) => it.id === id);
  const tkg = item && item.target && item.target.kg !== undefined ? item.target.kg : undefined;
  let r = ex.repDefault, kg = ex.kg == null ? null : lastKg(id, date);
  if (sets.length && idx > 0) { r = sets[sets.length - 1].r; if (ex.kg != null) kg = sets[sets.length - 1].kg ?? kg; }
  else if (prev && prev.sets[idx]) { r = prev.sets[idx].r; if (ex.kg != null) kg = prev.sets[idx].kg ?? kg; }
  if (tkg !== undefined && !sets.length) kg = tkg;
  if (ex.kg != null && kg == null) kg = 0;
  return { r, kg };
}

export function renderDetail() {
  const id = ui.detailId;
  const ex = getEx(id);
  const date = ui.viewDate;
  const sets = setsOf(date, id);
  const item = dayItems(date).find((it) => it.id === id) || { id, target: null };
  const tg = itemTarget(item, date);
  const prev = lastSetsFor(id, date);
  const editing = ui.editIdx != null && sets[ui.editIdx] ? sets[ui.editIdx] : null;
  const def = editing ? { r: editing.r, kg: editing.kg } : nextSetDefaults(id, date, sets.length);
  const bw = ex.kg == null;
  const prs = prSetsOn(id, date);

  const stepper = (inputId, label, val, step) =>
    '<div class="stepper"><div class="stepper-label">' + label + '</div><div class="stepper-ctl">' +
    '<button data-act="step" data-input="' + inputId + '" data-delta="-' + step + '" aria-label="Decrease ' + label + '">−</button>' +
    '<input id="' + inputId + '" type="number" inputmode="decimal" step="' + step + '" min="0" value="' + (val == null ? '' : val) + '" aria-label="' + label + '">' +
    '<button data-act="step" data-input="' + inputId + '" data-delta="' + step + '" aria-label="Increase ' + label + '">+</button>' +
    '</div></div>';

  const setRows = sets.map((s, i) =>
    '<div class="set-line' + (ui.editIdx === i ? ' editing' : '') + '">' +
    '<span class="set-no' + (prs.has(i) ? ' pr' : '') + '">' + (i + 1) + '</span>' +
    '<button class="set-txt" data-act="editset" data-idx="' + i + '"><b>' + s.r + ' reps</b><span class="muted"> · ' + kgLabel(s.kg) + '</span>' +
    (prs.has(i) ? ' <span class="pill pill-accent" style="margin-left: 4px;">' + I.trophy + 'PR</span>' : '') + '</button>' +
    '<button class="icon-btn plain" data-act="delset" data-idx="' + i + '" aria-label="Delete set ' + (i + 1) + '">' + I.x + '</button></div>').join('');

  const done = sets.length >= tg.sets;
  const heading = editing ? 'Editing set ' + (ui.editIdx + 1)
    : 'Set ' + (sets.length + 1) + (done ? ' · extra' : ' of ' + tg.sets);
  const logger =
    '<div class="card logger">' +
    '<div class="between"><div class="card-title">' + heading + '</div>' +
    '<div class="sub">Target ' + tg.sets + ' × ' + esc(tg.reps || '?') + (tg.coachKg && tg.kg != null && !bw ? ' @ ' + kgLabel(tg.kg) : '') + '</div></div>' +
    '<div class="steppers' + (bw ? ' single' : '') + '">' +
    stepper('inp-reps', ex.perArm ? 'Reps / arm' : 'Reps', def.r, 1) +
    (bw ? '' : stepper('inp-kg', 'Weight kg', def.kg, KG_STEP)) +
    '</div>' +
    '<div class="row" style="margin-top: 12px;">' +
    (editing
      ? '<button class="btn btn-lg" data-act="saveedit" style="flex: 1;">Save set ' + (ui.editIdx + 1) + '</button>' +
        '<button class="btn btn-lg btn-ghost" data-act="canceledit">Cancel</button>'
      : '<button class="btn btn-lg btn-block' + (done ? ' btn-good' : '') + '" data-act="logset">' + I.check + (done ? 'Log extra set' : 'Log set ' + (sets.length + 1)) + '</button>') +
    '</div>' +
    (setRows ? '<div class="set-list" style="margin-top: 12px;">' + setRows + '</div>' : '') +
    (prev ? '<div class="sub" style="margin-top: 10px;">Last time · ' + shortDate(prev.date) + ': <b>' + setsSummary(prev.sets) + '</b></div>' : '') +
    (tg.note ? '<div class="note-card">' + I.note + '<div>' + esc(tg.note) + '</div></div>' : '') +
    '</div>';

  // Records + progress
  const hist = exHistory(id);
  const pr = prsFor(id);
  const recTiles = !hist.length ? '' : bw
    ? '<div class="stat-grid" style="margin-top: 10px;">' +
      '<div class="stat"><div class="stat-label">Best set</div><div class="stat-value">' + pr.bestReps.r + '<small>reps</small></div><div class="stat-delta">' + niceDate(pr.bestReps.date) + '</div></div>' +
      '<div class="stat"><div class="stat-label">Sessions</div><div class="stat-value">' + hist.length + '</div><div class="stat-delta">since ' + niceDate(hist[0].date) + '</div></div></div>'
    : (pr.bestE ? '<div class="stat-grid" style="margin-top: 10px;">' +
      '<div class="stat"><div class="stat-label">Est. 1RM</div><div class="stat-value">' + round1(pr.bestE.v) + '<small>kg</small></div><div class="stat-delta">' + pr.bestE.r + ' × ' + round1(pr.bestE.kg) + ' kg · ' + niceDate(pr.bestE.date) + '</div></div>' +
      '<div class="stat"><div class="stat-label">Heaviest</div><div class="stat-value">' + round1(pr.bestKg.kg) + '<small>kg</small></div><div class="stat-delta">' + pr.bestKg.r + ' reps · ' + niceDate(pr.bestKg.date) + '</div></div></div>' : '');

  let chart = '';
  if (hist.length >= 2) {
    const metric = bw ? 'reps' : 'e1rm';
    const pts = hist.map((h) => ({ date: h.date, v: METRICS[metric].of(h.sets), sets: h.sets }));
    const sel = ui.detailPt != null && ui.detailPt < pts.length ? ui.detailPt : pts.length - 1;
    chart = '<div class="card" style="margin-top: 10px;"><div class="between"><div class="card-title">' + METRICS[metric].label + '</div>' +
      '<div class="sub">' + plural(pts.length, 'session') + '</div></div>' +
      lineChart(pts, { sel, act: 'detailpt', height: 150 }) + readout(pts[sel], METRICS[metric].unit) + '</div>';
  }

  const shots = [0, 1].map((n) => [n, exImg(id, n)]).filter(([, u]) => u);
  const photos = !shots.length ? '' :
    '<div class="photos' + (shots.length === 1 ? ' one' : '') + '" style="margin-bottom: 14px;">' + shots.map(([n, u]) =>
      '<div><button class="photo" data-act="zoom" data-n="' + n + '" aria-label="Enlarge photo"><div style="background-image: url(&quot;' + esc(u) + '&quot;);"></div></button>' +
      '<div class="photo-cap">' + (shots.length === 2 ? (n ? 'End' : 'Start') : 'Tap to enlarge') + '</div></div>').join('') + '</div>';

  const recent = hist.slice(-6).reverse().filter((h) => h.date !== date);
  const recentList = recent.length
    ? '<div class="section-label">Recent sessions</div><div class="card">' + recent.map((h) =>
      '<div class="history-row"><span class="d">' + niceDate(h.date) + '</span><span>' + setsSummary(h.sets) + '</span></div>').join('') + '</div>'
    : '';

  return '<div class="screen" data-scroll="detail">' +
    '<div class="between" style="margin: -4px 0 10px;"><button class="link-btn" data-act="back" style="display: inline-flex; align-items: center; gap: 2px; margin-left: -6px;">' +
    I.back + (ui.from === 'today' ? (date === todayStr() ? 'Today' : shortDate(date)) : 'Back') + '</button>' + syncDot() + '</div>' +
    photos +
    '<h1 class="title-sm">' + esc(ex.name) + '</h1>' +
    '<div class="ex-tags" style="margin-top: 8px;"><span class="pill pill-accent">' + esc(ex.m) + '</span>' +
    '<span class="pill">' + DAY_LABEL[ex.day] + '</span>' +
    (ex.rest ? '<span class="pill">' + I.timer + Math.round(ex.rest / 15) * 15 + 's rest</span>' : '') + '</div>' +
    (ex.desc ? '<p class="sub" style="margin: 10px 0 0; font-size: 14px; line-height: 1.5;">' + esc(ex.desc) + '</p>' : '') +
    logger + recTiles + chart + recentList +
    (ex.mus ? '<div class="section-label">Muscles worked</div><div class="card">' + musFigures(ex.mus) + '</div>' : '') +
    (ex.how.length ? '<div class="section-label">How to</div><div class="card how">' +
      ex.how.map((t, i) => '<div class="how-step"><b>' + (i + 1) + '</b><span>' + esc(t) + '</span></div>').join('') + '</div>' : '') +
    '</div>';
}

function readout(p, unit) {
  return '<div class="readout"><span><b>' + shortDate(p.date) + '</b>' +
    (p.sets ? '<span class="muted"> · ' + setsSummary(p.sets) + '</span>' : '') + '</span>' +
    '<b class="v num">' + round1(p.v) + ' ' + unit + '</b></div>';
}

/* ───────── Week ───────── */

export function renderWeek() {
  const today = todayStr();
  const monday = addDays(mondayOf(today), ui.weekOffset * 7);
  const sunday = addDays(monday, 6);
  let workouts = 0, sets = 0;
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const isToday = date === today, future = date > today;
    const sess = sessionOf(date);
    const logged = isWorkout(sess);
    const type = dayType(date);
    const items = (logged || isToday || future) ? dayItems(date) : [];
    const dn = items.filter((it) => exDone(date, it)).length;
    const n = setCount(date);
    if (logged) { workouts++; sets += n; }
    const missed = !logged && !isToday && !future && type !== 'rest';
    const plan = planFor(date);
    const label = type === 'rest' && !items.length ? 'Rest' : missed ? 'No training'
      : plan && typeof plan.title === 'string' && plan.title.trim() && plan.day === type ? esc(plan.title) : DAY_LABEL[type] + ' day';
    const sub = logged ? plural(n, 'set') + ' · ' + plural(Object.keys(sess.sets).length, 'exercise')
      : future && items.length ? (plan ? 'Planned by coach · ' : 'Planned · ') + plural(items.length, 'exercise')
      : isToday && items.length ? plural(items.length, 'exercise') : '';
    const full = items.length > 0 && dn === items.length;
    rows.push(
      '<button class="day-row' + (isToday ? ' today' : '') + (type === 'rest' && !logged ? ' rest' : '') + (missed ? ' missed' : '') + '" data-act="openday" data-date="' + date + '"' +
      (future || missed || (type === 'rest' && !logged) ? ' style="opacity: 0.7;"' : '') + '>' +
      '<div class="day-badge' + (full ? ' full' : '') + '"><span>' + weekdayName(date).slice(0, 3) + '</span><b>' + parseDate(date).getDate() + '</b></div>' +
      '<div style="flex: 1; min-width: 0;"><div style="font-weight: 700;">' + label + '</div>' +
      (sub ? '<div class="sub" style="font-size: 12.5px;">' + sub + '</div>' : '') + '</div>' +
      (items.length && !future ? '<div class="mini-track' + (full ? ' full' : '') + '"><div><div style="width: ' + Math.round(dn / items.length * 100) + '%;"></div></div><small>' + dn + ' / ' + items.length + '</small></div>' : '') +
      '</button>');
  }
  return '<div class="screen" data-scroll="week">' +
    '<div class="between"><div><div class="kicker">' + niceDate(monday) + ' – ' + niceDate(sunday) + '</div>' +
    '<h1 class="title">Week ' + isoWeek(monday) + '</h1></div>' +
    '<div class="date-nav">' +
    (ui.weekOffset ? '<button class="link-btn" data-act="weeknav" data-dir="0">This week</button>' : '') +
    '<button class="icon-btn" data-act="weeknav" data-dir="-1" aria-label="Previous week">' + I.left + '</button>' +
    '<button class="icon-btn" data-act="weeknav" data-dir="1" aria-label="Next week"' + (ui.weekOffset >= 2 ? ' disabled' : '') + '>' + I.right + '</button></div></div>' +
    '<div class="sub" style="margin: 6px 0 16px;">' + (workouts ? plural(workouts, 'workout') + ' · ' + plural(sets, 'set') : (ui.weekOffset > 0 ? 'Upcoming' : 'Nothing logged yet')) + '</div>' +
    '<div class="stack" style="gap: 8px;">' + rows.join('') + '</div>' +
    '<p class="sub" style="margin: 16px 4px 0; font-size: 12.5px;">Push and pull alternate with a rest day between. Missed exercises roll into your next session.</p>' +
    '</div>';
}

/* ───────── Stats ───────── */

export function renderStats() {
  const today = todayStr();
  const monday = mondayOf(today);
  const thisWeek = weekWorkouts(monday);
  const streak = streakWeeks();
  const tot = totals();
  const monthStart = today.slice(0, 8) + '01';
  const monthSets = workoutDates().filter((d) => d >= monthStart).reduce((n, d) => n + setCount(d), 0);

  if (!tot.workouts) {
    return '<div class="screen" data-scroll="stats"><h1 class="title">Stats</h1>' +
      '<div class="card empty" style="margin-top: 16px;"><div class="big">No workouts yet</div><div class="sub" style="margin-top: 6px;">Log your first session and your progress shows up here.</div></div>' +
      bodyweightCard() + '</div>';
  }

  const tiles = '<div class="stat-grid" style="margin-top: 14px;">' +
    '<div class="stat"><div class="stat-label">This week</div><div class="stat-value">' + thisWeek + '<small>/ ' + WEEK_TARGET + ' workouts</small></div></div>' +
    '<div class="stat"><div class="stat-label">Streak</div><div class="stat-value">' + streak + '<small>' + (streak === 1 ? 'week' : 'weeks') + '</small></div><div class="stat-delta">weeks with 2+ workouts</div></div>' +
    '<div class="stat"><div class="stat-label">Sets this month</div><div class="stat-value">' + monthSets + '</div></div>' +
    '<div class="stat"><div class="stat-label">All-time</div><div class="stat-value">' + tot.workouts + '<small>workouts</small></div><div class="stat-delta">' + Math.round(tot.vol).toLocaleString() + ' kg lifted</div></div>' +
    '</div>';

  // Heatmap
  const byDate = {};
  for (const d of workoutDates()) byDate[d] = setCount(d);
  const hsel = ui.heatSel;
  const heat = '<div class="section-label">Consistency</div><div class="card">' +
    heatmap(byDate, { weeks: 18, sel: hsel }) + heatLegend() +
    (hsel ? '<div class="readout"><span><b>' + shortDate(hsel) + '</b><span class="muted"> · ' +
      (byDate[hsel] ? DAY_LABEL[sessionOf(hsel).day] + ' day' : 'no training') + '</span></span>' +
      (byDate[hsel] ? '<button class="link-btn" data-act="openday" data-date="' + hsel + '" style="padding: 0;">' + plural(byDate[hsel], 'set') + ' →</button>' : '') + '</div>' : '') +
    '</div>';

  // Exercise progress
  const ids = allExIds().filter((id) => exHistory(id).length);
  if (!ui.chartEx || !ids.includes(ui.chartEx)) ui.chartEx = ids[0];
  const ex = getEx(ui.chartEx);
  const mlist = metricsFor(ui.chartEx);
  if (!mlist.includes(ui.chartMetric)) ui.chartMetric = mlist[0];
  const m = METRICS[ui.chartMetric];
  const hist = exHistory(ui.chartEx);
  const pts = hist.map((h) => ({ date: h.date, v: m.of(h.sets), sets: h.sets }));
  const sel = ui.chartPt != null && ui.chartPt < pts.length ? ui.chartPt : pts.length - 1;
  const first = pts[0].v, last = pts[pts.length - 1].v;
  const change = pts.length > 1 && first ? Math.round((last - first) / first * 100) : null;
  const progress = '<div class="section-label">Exercise progress</div><div class="card">' +
    '<div class="chips">' + ids.map((id) =>
      '<button class="chip' + (id === ui.chartEx ? ' on' : '') + '" data-act="chartex" data-id="' + esc(id) + '">' + esc(getEx(id).name) + '</button>').join('') + '</div>' +
    '<div class="between" style="margin: 8px 0 6px;"><div class="seg">' + mlist.map((k) =>
      '<button class="' + (k === ui.chartMetric ? 'on' : '') + '" data-act="chartmetric" data-m="' + k + '">' + METRICS[k].label + '</button>').join('') + '</div>' +
    (change != null ? '<span class="pill ' + (change >= 0 ? 'pill-good' : '') + '">' + (change >= 0 ? '+' : '') + change + '%</span>' : '') + '</div>' +
    (pts.length > 1 ? lineChart(pts, { sel, act: 'chartpt' }) : '<div class="sub" style="padding: 10px 0;">One session of ' + esc(ex.name) + ' so far — the trend appears after the next.</div>') +
    readout(pts[sel], m.unit) + '</div>';

  // Muscle volume
  let from, to, div = 1, cap;
  if (ui.musWindow === 'last') { from = addDays(monday, -7); to = addDays(monday, -1); cap = 'Last week'; }
  else if (ui.musWindow === 'avg4') { from = addDays(monday, -28); to = addDays(monday, -1); div = 4; cap = 'Average of the last 4 full weeks'; }
  else { from = monday; to = today; cap = 'This week so far'; }
  const ms = muscleSets(from, to);
  const rows = MUSCLES.map((k) => ({ label: MUSCLE_LABEL[k], v: ms[k] / div })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  const muscles = '<div class="section-label">Weekly sets per muscle</div><div class="card">' +
    '<div class="seg full" style="margin-bottom: 14px;">' + [['week', 'This week'], ['last', 'Last week'], ['avg4', '4-wk avg']].map(([k, l]) =>
      '<button class="' + (ui.musWindow === k ? 'on' : '') + '" data-act="muswin" data-w="' + k + '">' + l + '</button>').join('') + '</div>' +
    (rows.length ? barList(rows, { ref: 10, fmt: (v) => String(Math.round(v * 2) / 2) }) : '<div class="sub">No sets in this window.</div>') +
    '<p class="sub" style="margin: 12px 0 0; font-size: 12.5px;">' + cap + '. Primary muscle = 1 set, assisting = ½. The line marks 10 sets, a common weekly target for growth.</p></div>';

  // Records
  const recRows = ids.map((id) => {
    const p = prsFor(id);
    const e = getEx(id);
    const val = isBodyweight(id)
      ? (p.bestReps ? p.bestReps.r + ' reps<small>' + niceDate(p.bestReps.date) + '</small>' : '–')
      : (p.bestE ? round1(p.bestE.v) + ' kg e1RM<small>' + p.bestE.r + ' × ' + round1(p.bestE.kg) + ' kg · ' + niceDate(p.bestE.date) + '</small>' : '–');
    return '<button class="pr-row" data-act="open" data-id="' + esc(id) + '" style="width: 100%; background: none; border-left: none; border-right: none; border-top: none; text-align: left; padding-left: 0; padding-right: 0;">' +
      '<span class="n">' + esc(e.name) + '</span><span class="v">' + val + '</span></button>';
  }).join('');
  const records = '<div class="section-label">Personal records</div><div class="card" style="padding-top: 6px; padding-bottom: 6px;">' + recRows + '</div>';

  return '<div class="screen" data-scroll="stats">' +
    '<div class="between"><h1 class="title">Stats</h1>' + syncDot() + '</div>' +
    tiles + heat + progress + muscles + records + bodyweightCard() +
    '</div>';
}

function bodyweightCard() {
  const series = bodyweightSeries();
  const latest = series[series.length - 1];
  const today = todayStr();
  let chart = '';
  if (series.length >= 2) {
    const sel = ui.bwPt != null && ui.bwPt < series.length ? ui.bwPt : series.length - 1;
    chart = lineChart(series, { sel, act: 'bwpt', height: 150 }) + readout(series[sel], 'kg');
  }
  const monthAgo = series.filter((p) => p.date <= addDays(today, -30)).pop();
  const delta = latest && monthAgo ? round1(latest.v - monthAgo.v) : null;
  return '<div class="section-label">Bodyweight</div><div class="card">' +
    (latest ? '<div class="between" style="margin-bottom: 10px;"><div><div class="stat-value">' + round1(latest.v) + '<small>kg</small></div>' +
      '<div class="stat-delta">' + (latest.date === today ? 'today' : niceDate(latest.date)) + (delta != null ? ' · ' + (delta >= 0 ? '+' : '') + delta + ' kg in 30 days' : '') + '</div></div></div>' : '') +
    chart +
    '<div class="row" style="margin-top: 12px;"><input class="input" id="inp-bw" type="number" inputmode="decimal" step="0.1" min="20" max="300" placeholder="' + (latest ? round1(latest.v) : 'Weight') + ' kg" style="flex: 1;" aria-label="Bodyweight in kg">' +
    '<button class="btn" data-act="logbw">' + (store.body[today] != null ? 'Update' : 'Log today') + '</button></div></div>';
}

/* ───────── Settings ───────── */

export function renderSettings() {
  const s = syncStatus;
  const syncCard = configured()
    ? '<div class="card">' +
      '<div class="between"><div class="card-title">Sync</div>' + syncDot() + '</div>' +
      '<div class="sub" style="margin-top: 6px;">' + esc(repoName()) + ' / ' + esc(filePath()) + '<br>Last synced ' + relTime(s.lastSync) + '</div>' +
      (s.state === 'error' ? '<div class="banner error" style="margin-top: 10px;">' + I.alert + '<div>' + esc(s.msg) + '</div></div>' : '') +
      '<div class="row" style="margin-top: 12px;"><button class="btn btn-sm" data-act="syncnow">Sync now</button>' +
      '<button class="btn btn-sm btn-ghost" data-act="syncoff">Disconnect</button></div></div>'
    : '<div class="card">' +
      '<div class="card-title">Sync across devices</div>' +
      '<p class="sub" style="margin: 4px 0 12px;">Your log syncs automatically to a JSON file in your private GitHub repo. Create a fine-grained token at <b>github.com → Settings → Developer settings → Fine-grained tokens</b> with access to only that repo and <b>Contents: Read and write</b>. The token stays on this device.</p>' +
      '<label class="field-label" for="inp-token">Token</label>' +
      '<input class="input" id="inp-token" type="password" placeholder="github_pat_…" autocomplete="off" spellcheck="false">' +
      '<label class="field-label" for="inp-repo" style="margin-top: 10px;">Repository</label>' +
      '<input class="input" id="inp-repo" type="text" value="' + esc(DEFAULT_REPO) + '" autocomplete="off" spellcheck="false" autocapitalize="off">' +
      '<label class="field-label" for="inp-path" style="margin-top: 10px;">File</label>' +
      '<input class="input" id="inp-path" type="text" value="' + esc(DEFAULT_PATH) + '" autocomplete="off" spellcheck="false" autocapitalize="off">' +
      '<button class="btn btn-block" data-act="syncon" style="margin-top: 14px;">Connect &amp; sync</button></div>';

  const tog = (key, label, sub) =>
    '<div class="setting-row"><div><div style="font-weight: 600;">' + label + '</div>' + (sub ? '<div class="sub" style="font-size: 12.5px;">' + sub + '</div>' : '') + '</div>' +
    '<label class="toggle"><input type="checkbox" data-pref="' + key + '"' + (prefs[key] ? ' checked' : '') + ' aria-label="' + label + '"><span></span></label></div>';

  return '<div class="screen" data-scroll="settings">' +
    '<h1 class="title">Settings</h1>' +
    '<div class="section-label">Data</div>' + syncCard +
    '<div class="section-label">Rest timer</div><div class="card">' +
    tog('autoRest', 'Start after each set', 'Uses each exercise’s rest time — 2–2½ min for compounds, 75–90 s for isolation') +
    tog('sound', 'Sound', 'Beep when rest is over') +
    tog('vibrate', 'Vibrate', 'Android only') +
    tog('notify', 'Notify when in background', 'Shows a notification if the app isn’t open') +
    '</div>' +
    '<div class="section-label">Appearance</div><div class="card"><div class="seg full">' +
    [['auto', 'System'], ['dark', 'Dark'], ['light', 'Light']].map(([k, l]) =>
      '<button class="' + (prefs.theme === k ? 'on' : '') + '" data-act="theme" data-t="' + k + '">' + l + '</button>').join('') + '</div></div>' +
    '<div class="section-label">Backup</div><div class="card">' +
    '<p class="sub" style="margin: 0 0 12px;">Download the whole log as a JSON file, or load one (merge keeps both, file wins on the same date).</p>' +
    '<div class="row"><button class="btn btn-ghost" data-act="export" style="flex: 1;">Export</button>' +
    '<button class="btn btn-ghost" data-act="import" style="flex: 1;">Import</button></div></div>' +
    '<div class="section-label">Coach</div><div class="card"><p class="sub" style="margin: 0;">Your coach is Claude Code. Ask for a workout, a program change, or a review of your progress — it reads and writes the same data file, and changes show up here on the next sync.</p></div>' +
    '<p class="sub" style="text-align: center; margin: 22px 0 0; font-size: 12px;">Gym Tracker ' + APP_VERSION + ' · ' + plural(workoutDates().length, 'workout') + ' on this device</p>' +
    '</div>';
}

/* ───────── Overlays ───────── */

export function renderOverlay() {
  let html = '';
  if (ui.sheet === 'addex') {
    const date = ui.viewDate;
    const shown = new Set(dayItems(date).map((it) => it.id));
    const groups = {};
    for (const id of allExIds()) {
      if (shown.has(id)) continue;
      const d = getEx(id).day;
      (groups[d] = groups[d] || []).push(id);
    }
    const order = ['push', 'pull', 'other'];
    const body = order.filter((d) => groups[d]).map((d) =>
      '<div class="section-label" style="margin-top: 10px;">' + DAY_LABEL[d] + '</div>' +
      groups[d].map((id) => '<button class="sheet-item" data-act="pickex" data-id="' + esc(id) + '">' + thumb(id) +
        '<div><div style="font-weight: 700;">' + esc(getEx(id).name) + '</div><div class="sub" style="font-size: 12.5px;">' + esc(getEx(id).m) + '</div></div></button>').join('')).join('');
    html += '<div class="backdrop" data-act="closesheet"><div class="sheet" data-act="noop"><div class="sheet-grip"></div>' +
      '<div class="card-title" style="font-size: 18px;">Add exercise</div>' +
      '<div class="sub">Log any exercise on ' + (date === todayStr() ? 'today' : shortDate(date)) + '. New exercises can be added by your coach.</div>' +
      (body || '<div class="sub" style="padding: 20px 0;">Everything is already on today’s list.</div>') + '</div></div>';
  }
  if (ui.sheet === 'import' && ui.importData) {
    const n = Object.keys(ui.importData.sessions || {}).length;
    html += '<div class="backdrop" data-act="closesheet"><div class="sheet" data-act="noop"><div class="sheet-grip"></div>' +
      '<div class="card-title" style="font-size: 18px;">Import ' + plural(n, 'session') + '</div>' +
      '<p class="sub">Merge adds them to your log (the file wins on the same date). Replace discards everything here first.</p>' +
      '<div class="stack"><button class="btn btn-block" data-act="importmerge">Merge</button>' +
      '<button class="btn btn-block btn-danger" data-act="importreplace">Replace everything</button>' +
      '<button class="btn btn-block btn-ghost" data-act="closesheet">Cancel</button></div></div></div>';
  }
  if (ui.zoom != null && ui.detailId) {
    const u = exImg(ui.detailId, ui.zoom);
    const other = exImg(ui.detailId, ui.zoom ? 0 : 1);
    if (u) {
      html += '<div class="zoom" data-act="zoomclose"><div class="zoom-img" style="background-image: url(&quot;' + esc(u) + '&quot;);"></div>' +
        '<div class="row">' + (other ? '<button class="btn btn-ghost btn-sm" data-act="zoomswap">' + (ui.zoom ? 'Start position' : 'End position') + '</button>' : '') +
        '<button class="btn btn-sm" data-act="zoomclose">Close</button></div></div>';
    }
  }
  if (ui.toast) {
    html += '<div class="toast' + (ui.toast.kind === 'pr' ? ' pr' : '') + (document.getElementById('timer') && !document.getElementById('timer').hidden ? ' has-timer' : '') + '" role="status">' +
      (ui.toast.kind === 'pr' ? I.trophy : '') + '<span>' + esc(ui.toast.text) + '</span>' +
      (ui.toast.undo ? '<button data-act="undo">Undo</button>' : '') + '</div>';
  }
  return html;
}

export function renderNav() {
  const tabs = [['today', 'Today', I.today], ['week', 'Week', I.week], ['stats', 'Stats', I.stats], ['settings', 'Settings', I.settings]];
  const cur = ui.screen === 'detail' ? ui.from : ui.screen;
  return tabs.map(([k, l, ic]) =>
    '<button class="' + (cur === k ? 'on' : '') + '" data-act="nav" data-screen="' + k + '"' + (cur === k ? ' aria-current="page"' : '') + '>' + ic + l + '</button>').join('');
}

