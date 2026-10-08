/* Entry point: render loop, event handling, wiring of sync and timer. */

import {
  store, save, replaceStore, normalize, getEx, setsOf, logSet, insertSet, removeSet, updateSet,
  setOverride, setBodyweight, exHistory,
} from './store.js';
import { todayStr, addDays } from './dates.js';
import { startSync, syncNow, onStatus, onRemoteData, connect, disconnect, configured, serialize, merge3 } from './sync.js';
import { prefs, setPref, applyTheme } from './prefs.js';
import { mountTimer, startRest, adjustRest, stopRest, primeAudio, restRunning } from './timer.js';
import { prCheck } from './stats.js';
import {
  renderToday, renderDetail, renderWeek, renderStats, renderSettings, renderOverlay, renderNav,
  nextSetDefaults, kgLabel, syncDot,
} from './views.js';
import { ui } from './ui.js';

const $ = (id) => document.getElementById(id);
const scrollPos = {};
let toastTimer = null;

/* ───────── Render ───────── */

function render() {
  const app = $('app');
  const prev = app.querySelector('[data-scroll]');
  if (prev) scrollPos[prev.dataset.scroll] = prev.scrollTop;
  const view = { today: renderToday, detail: renderDetail, week: renderWeek, stats: renderStats, settings: renderSettings }[ui.screen] || renderToday;
  app.innerHTML = view();
  const scr = app.querySelector('[data-scroll]');
  if (scr && scrollPos[scr.dataset.scroll]) scr.scrollTop = scrollPos[scr.dataset.scroll];
  $('nav').innerHTML = renderNav();
  $('overlay').innerHTML = renderOverlay();
}

/* Re-render without clobbering something the user is typing. */
let deferred = false;
function softRender() {
  const a = document.activeElement;
  if (a && a.tagName === 'INPUT' && $('app').contains(a) && a.type !== 'checkbox') { deferred = true; return; }
  render();
}
document.addEventListener('focusout', () => { if (deferred) { deferred = false; setTimeout(softRender, 0); } });

function toast(text, undo, kind) {
  ui.toast = { text, undo, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast = null; $('overlay').innerHTML = renderOverlay(); }, undo ? 4500 : kind === 'pr' ? 3500 : 2500);
  $('overlay').innerHTML = renderOverlay();
}

function go(screen) {
  if (screen === 'detail') ui.from = ui.screen === 'detail' ? ui.from : ui.screen;
  ui.screen = screen;
  ui.editIdx = null;
  if (screen === 'detail') { scrollPos.detail = 0; ui.detailPt = null; }
}

/* ───────── Logging ───────── */

function readNum(id, fallback) {
  const el = $(id);
  if (!el) return fallback;
  const v = parseFloat(String(el.value).replace(',', '.'));
  return isNaN(v) || v < 0 ? fallback : v;
}

function afterLog(date, id, idx, r, kg) {
  const pr = prCheck(id, date, idx);
  const undo = () => { removeSet(date, id, idx); render(); };
  if (pr) toast('New ' + pr, undo, 'pr');
  else toast('Set ' + (idx + 1) + ' · ' + r + ' reps · ' + kgLabel(kg), undo);
  if (prefs.autoRest && date === todayStr()) {
    if (pr && navigator.vibrate && prefs.vibrate) navigator.vibrate(60);
    startRest(getEx(id).rest || 90, getEx(id).name);
    // The toast sits above the timer once it is showing.
    $('overlay').innerHTML = renderOverlay();
  }
}

function quickLog(id) {
  const date = ui.viewDate;
  const sets = setsOf(date, id);
  const idx = sets.length;
  const { r, kg } = nextSetDefaults(id, date, idx);
  const w = getEx(id).kg == null ? null : kg;
  logSet(date, id, r, w);
  render();
  afterLog(date, id, idx, r, w);
}

function logFromEditor() {
  const id = ui.detailId, date = ui.viewDate, ex = getEx(id);
  const def = nextSetDefaults(id, date, setsOf(date, id).length);
  const r = Math.max(1, Math.round(readNum('inp-reps', def.r)));
  const kg = ex.kg == null ? null : readNum('inp-kg', def.kg ?? 0);
  return { r, kg };
}

/* ───────── Events ───────── */

const actions = {
  nav: (t) => {
    ui.toast = null;
    go(t.dataset.screen);
    if (ui.screen === 'today') { ui.viewDate = todayStr(); ui.detailId = null; }
    if (ui.screen === 'week') ui.weekOffset = ui.weekOffset || 0;
  },
  open: (t) => {
    if (ui.screen !== 'today' && ui.screen !== 'detail') ui.viewDate = todayStr();
    ui.detailId = t.dataset.id; go('detail');
  },
  back: () => { ui.screen = ui.from || 'today'; ui.detailId = null; ui.editIdx = null; ui.zoom = null; },
  quickset: (t, e) => {
    e.stopPropagation();
    primeAudio();
    quickLog(t.dataset.id);
    return false;
  },
  gotoday: () => { ui.viewDate = todayStr(); },
  daystep: (t) => { ui.viewDate = addDays(ui.viewDate, parseInt(t.dataset.d, 10)); },
  daytype: (t) => { setOverride(ui.viewDate, t.dataset.type); },
  addex: () => { ui.sheet = 'addex'; },
  pickex: (t) => { ui.sheet = null; ui.detailId = t.dataset.id; go('detail'); },
  closesheet: () => { ui.sheet = null; ui.importData = null; },
  noop: (t, e) => { e.stopPropagation(); return false; },
  step: (t) => {
    const inp = $(t.dataset.input);
    if (inp) {
      const v = Math.max(0, (parseFloat(String(inp.value).replace(',', '.')) || 0) + parseFloat(t.dataset.delta));
      inp.value = Math.round(v * 100) / 100;
    }
    return false; // keep focus/scroll; no re-render
  },
  logset: () => {
    primeAudio();
    const { r, kg } = logFromEditor();
    const date = ui.viewDate, id = ui.detailId;
    const idx = setsOf(date, id).length;
    logSet(date, id, r, kg);
    render();
    afterLog(date, id, idx, r, kg);
    return false;
  },
  editset: (t) => { ui.editIdx = parseInt(t.dataset.idx, 10); },
  canceledit: () => { ui.editIdx = null; },
  saveedit: () => {
    const { r, kg } = logFromEditor();
    updateSet(ui.viewDate, ui.detailId, ui.editIdx, r, kg);
    ui.editIdx = null;
  },
  delset: (t, e) => {
    e.stopPropagation();
    const date = ui.viewDate, id = ui.detailId, idx = parseInt(t.dataset.idx, 10);
    const removed = setsOf(date, id)[idx];
    removeSet(date, id, idx);
    ui.editIdx = null;
    render();
    toast('Deleted set ' + (idx + 1), () => { insertSet(date, id, idx, removed); render(); });
    return false;
  },
  detailpt: (t) => { ui.detailPt = parseInt(t.dataset.idx, 10); },
  zoom: (t, e) => { e.stopPropagation(); ui.zoom = parseInt(t.dataset.n, 10); },
  zoomswap: (t, e) => { e.stopPropagation(); ui.zoom = ui.zoom ? 0 : 1; },
  zoomclose: () => { ui.zoom = null; },
  openday: (t) => { ui.viewDate = t.dataset.date; go('today'); },
  weeknav: (t) => {
    const d = parseInt(t.dataset.dir, 10);
    ui.weekOffset = d === 0 ? 0 : Math.min(2, ui.weekOffset + d);
  },
  chartex: (t) => { ui.chartEx = t.dataset.id; ui.chartPt = null; },
  chartmetric: (t) => { ui.chartMetric = t.dataset.m; ui.chartPt = null; },
  chartpt: (t) => { ui.chartPt = parseInt(t.dataset.idx, 10); },
  bwpt: (t) => { ui.bwPt = parseInt(t.dataset.idx, 10); },
  heatsel: (t) => { ui.heatSel = ui.heatSel === t.dataset.date ? null : t.dataset.date; },
  muswin: (t) => { ui.musWindow = t.dataset.w; },
  logbw: () => {
    const v = readNum('inp-bw', NaN);
    if (!(v >= 20 && v <= 300)) { toast('Enter your weight in kg'); return false; }
    setBodyweight(todayStr(), Math.round(v * 10) / 10);
    ui.bwPt = null;
    toast('Bodyweight logged · ' + v + ' kg');
  },
  rest: (t) => { adjustRest(parseInt(t.dataset.d, 10)); return false; },
  reststop: () => { stopRest(); return false; },
  theme: (t) => { setPref('theme', t.dataset.t); },
  syncon: () => {
    const token = ($('inp-token').value || '').trim();
    if (!token) { toast('Paste your token first'); return false; }
    connect(token, $('inp-repo').value, $('inp-path').value).then(() => softRender());
  },
  syncnow: () => { syncNow(); return false; },
  syncoff: () => { disconnect(); toast('Sync disconnected on this device'); },
  export: () => { doExport(); return false; },
  import: () => { $('importFile').click(); return false; },
  importmerge: () => applyImport('merge'),
  importreplace: () => applyImport('replace'),
  undo: () => {
    const u = ui.toast && ui.toast.undo;
    ui.toast = null; clearTimeout(toastTimer);
    if (u) u();
  },
};

$('frame').addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const fn = actions[t.dataset.act];
  if (!fn) return;
  if (fn(t, e) === false) return;
  render();
});
$('frame').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && e.target.id === 'inp-bw') { e.preventDefault(); actions.logbw(); render(); }
  if (e.key === 'Escape' && (ui.sheet || ui.zoom != null)) { ui.sheet = null; ui.zoom = null; render(); }
});
$('frame').addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.pref;
  if (!k) return;
  setPref(k, e.target.checked);
  if (k === 'notify' && e.target.checked && 'Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then((p) => {
      if (p !== 'granted') { setPref('notify', false); toast('Notifications are blocked for this site'); render(); }
    });
  }
});

/* ───────── Export / import ───────── */

function doExport() {
  const blob = new Blob([serialize(store)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gym-tracker-' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast('Log exported');
}
$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  file.text().then((txt) => {
    const data = JSON.parse(txt);
    if (!data || typeof data.sessions !== 'object' || data.sessions === null) throw new Error('bad shape');
    ui.importData = normalize(data);
    ui.sheet = 'import';
    render();
  }).catch(() => toast('That is not a Gym Tracker backup file'));
});
function applyImport(mode) {
  const inc = ui.importData;
  ui.sheet = null; ui.importData = null;
  if (!inc) return;
  if (mode === 'replace') {
    replaceStore(inc);
  } else {
    // Merge: the file wins wherever both sides have the same key.
    replaceStore(merge3({}, inc, store));
  }
  save();
  toast(mode === 'replace' ? 'Log replaced' : 'Backup merged');
}

/* ───────── Boot ───────── */

applyTheme();
mountTimer($('timer'));
onStatus(() => {
  if (ui.screen === 'settings') { softRender(); return; }
  document.querySelectorAll('.sync-dot').forEach((el) => { el.outerHTML = syncDot(); });
  // Error banner on Today appears/disappears with the status.
  if (ui.screen === 'today') softRender();
});
onRemoteData(() => softRender());
render();
startSync();

// Midnight rollover: if the app stays open past midnight, move "today" along.
let lastDay = todayStr();
setInterval(() => {
  const t = todayStr();
  if (t !== lastDay) { if (ui.viewDate === lastDay) ui.viewDate = t; lastDay = t; softRender(); }
}, 60 * 1000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Ask the browser not to evict the on-device copy of the log.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist(); }).catch(() => {});
}

// Exposed for debugging from the console.
window.gym = { store: () => store, syncNow, configured, exHistory, restRunning };
