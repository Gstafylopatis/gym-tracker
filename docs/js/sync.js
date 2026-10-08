/* Automatic sync with a JSON file in a private GitHub repo (Contents API).

   Offline-first: the app always reads and writes localStorage; sync runs in
   the background on launch, when the app comes to the foreground, every few
   minutes while open, and a few seconds after each change.

   Conflicts are resolved with a three-way merge against the last version this
   device synced ("base"): a change on only one side wins; if both sides
   changed the same value, this device wins. Deletions merge the same way. */

import { store, replaceStore, normalize, emptyStore, onSave } from './store.js';

const CFG_KEY = 'gym-tracker-sync';
const STATE_KEY = 'gym-tracker-sync-state';
export const DEFAULT_REPO = 'Gstafylopatis/gym-tracker-data';
export const DEFAULT_PATH = 'log.json';
const PUSH_DELAY = 3000;
const POLL_EVERY = 2 * 60 * 1000;

function load(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
export let cfg = load(CFG_KEY);
let st = load(STATE_KEY);
function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } }
function saveSt() { try { localStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

export const status = { state: 'off', msg: '', lastSync: st.lastSync || 0 };
const statusListeners = [];
const dataListeners = [];
export function onStatus(fn) { statusListeners.push(fn); }
/* Called when a pull brought in remote changes and the UI should re-render. */
export function onRemoteData(fn) { dataListeners.push(fn); }
function setStatus(state, msg) {
  status.state = state; status.msg = msg || ''; status.lastSync = st.lastSync || 0;
  for (const fn of statusListeners) fn(status);
}

export function configured() { return !!cfg.token; }
export function repoName() { return cfg.repo || DEFAULT_REPO; }
export function filePath() { return cfg.path || DEFAULT_PATH; }

export function connect(token, repo, path) {
  cfg = { token: token.trim(), repo: (repo || DEFAULT_REPO).trim(), path: (path || DEFAULT_PATH).trim().replace(/^\/+/, '') };
  st = {}; // new target → no common base; first sync merges both sides
  saveCfg(); saveSt();
  return syncNow();
}
export function disconnect() {
  cfg = {}; st = {};
  saveCfg(); saveSt();
  setStatus('off');
}

/* ───────── JSON helpers ───────── */

/* Key-order-independent serialisation, used only for comparisons. */
function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

export function merge3(b, l, r) {
  const cl = canon(l), cr = canon(r);
  if (cl === cr) return l;
  const cb = canon(b);
  if (cl === cb) return r;
  if (cr === cb) return l;
  if (isObj(l) && isObj(r)) {
    const bo = isObj(b) ? b : {};
    const out = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const v = merge3(bo[k], l[k], r[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return l; // both sides changed the same leaf: this device wins
}

/* Human-friendly file layout: date-keyed collections sorted, small values on
   one line — so the file diffs cleanly and is easy to edit by hand. */
function sorted(o) {
  if (!isObj(o)) return o;
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k];
  return out;
}
export function serialize(data) {
  const d = { ...data };
  for (const c of ['sessions', 'overrides', 'plans', 'body']) d[c] = sorted(d[c]);
  const pretty = (v, ind) => {
    const flat = JSON.stringify(v);
    if (v === null || typeof v !== 'object' || flat.length + ind.length <= 96) return flat;
    const next = ind + '  ';
    if (Array.isArray(v)) return '[\n' + v.map((x) => next + pretty(x, next)).join(',\n') + '\n' + ind + ']';
    const keys = Object.keys(v).filter((k) => v[k] !== undefined);
    return '{\n' + keys.map((k) => next + JSON.stringify(k) + ': ' + pretty(v[k], next)).join(',\n') + '\n' + ind + '}';
  };
  return pretty(d, '') + '\n';
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/* ───────── GitHub Contents API ───────── */

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

async function gh(method, url, body, accept) {
  const res = await fetch('https://api.github.com' + url, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      Accept: accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (e) { /* no body */ }
    throw new HttpError(res.status, detail || 'HTTP ' + res.status);
  }
  return accept && accept.includes('raw') ? res.text() : res.json();
}

function contentsUrl() {
  return '/repos/' + repoName() + '/contents/' + filePath().split('/').map(encodeURIComponent).join('/');
}

async function getRemote() {
  let meta;
  try {
    meta = await gh('GET', contentsUrl());
  } catch (e) {
    if (e.status !== 404) throw e;
    // 404 means either "no file yet" or "no access to the repo" — tell them apart.
    try { await gh('GET', '/repos/' + repoName()); } catch (e2) {
      throw new HttpError(e2.status, e2.status === 404
        ? 'Repo ' + repoName() + ' not found, or the token has no access to it'
        : e2.message);
    }
    return null;
  }
  // Files over 1 MB come back without inline content.
  const text = meta.encoding === 'base64' && meta.content
    ? b64decode(meta.content)
    : await gh('GET', contentsUrl(), null, 'application/vnd.github.raw+json');
  let data;
  try { data = JSON.parse(text); } catch (e) {
    throw new HttpError(0, filePath() + ' in the data repo is not valid JSON — fix it there, nothing was overwritten');
  }
  return { sha: meta.sha, data: normalize(data) };
}

function deviceLabel() {
  const mobile = navigator.userAgentData ? navigator.userAgentData.mobile : /Android|iPhone|iPad/i.test(navigator.userAgent);
  return mobile ? 'phone' : 'computer';
}

async function putRemote(data, sha) {
  const res = await gh('PUT', contentsUrl(), {
    message: 'Sync from ' + deviceLabel(),
    content: b64encode(serialize(data)),
    ...(sha ? { sha } : {}),
  });
  return res.content.sha;
}

/* ───────── Sync loop ───────── */

function commitBase(data, sha) {
  st.sha = sha;
  st.base = JSON.stringify(data);
  st.lastSync = Date.now();
  saveSt();
}

export function isDirty() {
  return configured() && (!st.base || canon(JSON.parse(st.base)) !== canon(store));
}

async function syncOnce() {
  const snapshot = canon(store);
  const local = JSON.parse(JSON.stringify(store));
  const remote = await getRemote();

  if (!remote) {
    commitBase(local, await putRemote(local, null));
    return;
  }
  if (remote.sha === st.sha && st.base) {
    if (canon(JSON.parse(st.base)) !== snapshot) commitBase(local, await putRemote(local, remote.sha));
    else { st.lastSync = Date.now(); saveSt(); }
    return;
  }

  const base = st.base ? JSON.parse(st.base) : emptyStore();
  const merged = normalize(merge3(base, local, remote.data));
  const mergedC = canon(merged);
  if (mergedC !== snapshot) {
    // The user may have logged something while we were on the network;
    // never overwrite that — run another round instead.
    if (canon(store) !== snapshot) { pending = true; return; }
    replaceStore(merged);
    for (const fn of dataListeners) fn();
  }
  const sha = mergedC !== canon(remote.data) ? await putRemote(merged, remote.sha) : remote.sha;
  commitBase(merged, sha);
}

let running = null;
let pending = false;
export function syncNow() {
  if (!configured()) { setStatus('off'); return Promise.resolve(); }
  if (running) { pending = true; return running; }
  running = (async () => {
    let conflicts = 0;
    setStatus('syncing');
    try {
      do {
        pending = false;
        if (!navigator.onLine) { setStatus('offline'); return; }
        try {
          await syncOnce();
        } catch (e) {
          // 409/422: someone else wrote between our read and write — retry.
          if ((e.status === 409 || e.status === 422) && conflicts++ < 3) { pending = true; continue; }
          throw e;
        }
      } while (pending);
      setStatus('idle');
    } catch (e) {
      const msg = e.status === 401 ? 'Token rejected or expired — paste a new one in Settings'
        : e.status === 403 ? 'Token lacks permission (needs Contents: read & write) or rate-limited'
        : (e.message || 'Sync failed');
      setStatus(navigator.onLine ? 'error' : 'offline', navigator.onLine ? msg : '');
    } finally {
      running = null;
    }
  })();
  return running;
}

let pushTimer = null;
function schedulePush() {
  if (!configured()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, PUSH_DELAY);
}

export function startSync() {
  onSave(schedulePush);
  document.addEventListener('visibilitychange', () => {
    if (!configured()) return;
    if (document.visibilityState === 'visible') syncNow();
    else if (isDirty()) { clearTimeout(pushTimer); syncNow(); }
  });
  window.addEventListener('online', () => configured() && syncNow());
  window.addEventListener('offline', () => configured() && setStatus('offline'));
  setInterval(() => { if (configured() && document.visibilityState === 'visible') syncNow(); }, POLL_EVERY);
  if (configured()) syncNow(); else setStatus('off');
}
