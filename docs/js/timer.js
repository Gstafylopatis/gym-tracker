/* Rest timer. Lives outside the main render so it can tick every frame-ish
   without re-rendering the screen; state survives a reload. */

import { prefs } from './prefs.js';

const KEY = 'gym-tracker-timer';
let t = null; // { endAt, total, label }
try { t = JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { t = null; }
let doneAt = 0;
let tickId = null, endId = null, wakeLock = null, audio = null;
let el = null;

function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { /* ignore */ } }

/* Must be called from a user gesture once so iOS/Chrome allow sound later. */
export function primeAudio() {
  if (!prefs.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch (e) { audio = null; }
}

function beep() {
  if (!prefs.sound || !audio) return;
  const now = audio.currentTime;
  [0, 0.22, 0.44].forEach((off, i) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, now + off);
    g.gain.exponentialRampToValueAtTime(0.35, now + off + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.18);
    o.connect(g).connect(audio.destination);
    o.start(now + off); o.stop(now + off + 0.2);
  });
}

async function holdWake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

function finish() {
  t = null; persist();
  doneAt = Date.now();
  clearTimeout(endId);
  holdWake(false);
  if (prefs.vibrate && navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 400]);
  beep();
  if (prefs.notify && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker && navigator.serviceWorker.ready.then((reg) =>
      reg.showNotification('Rest over', { body: 'Time for your next set.', tag: 'rest', renotify: true, icon: 'icons/icon-192.png' })).catch(() => {});
  }
  paint();
  setTimeout(paint, 6100);
}

export function startRest(seconds, label) {
  t = { endAt: Date.now() + seconds * 1000, total: seconds, label: label || '' };
  doneAt = 0;
  persist();
  arm();
  holdWake(true);
  paint();
}
export function adjustRest(delta) {
  if (!t) return;
  t.endAt += delta * 1000; t.total = Math.max(1, t.total + delta);
  if (t.endAt <= Date.now()) { finish(); return; }
  persist(); arm(); paint();
}
export function stopRest() {
  t = null; doneAt = 0; persist();
  clearTimeout(endId); holdWake(false); paint();
}
export function restRunning() { return !!t; }

function arm() {
  clearTimeout(endId);
  if (t) endId = setTimeout(finish, Math.max(0, t.endAt - Date.now()));
  if (!tickId) tickId = setInterval(paint, 250);
}

const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

function show(on) {
  el.hidden = !on;
  if (el.parentNode) el.parentNode.classList.toggle('timer-on', on);
}

function paint() {
  if (!el) return;
  if (t && Date.now() >= t.endAt) { finish(); return; }
  if (t) {
    const left = Math.ceil((t.endAt - Date.now()) / 1000);
    const pct = Math.max(0, Math.min(1, 1 - left / t.total));
    if (!el.firstChild || el.dataset.mode !== 'run') {
      el.dataset.mode = 'run';
      el.innerHTML =
        '<div class="timer-bar"><div class="timer-fill"></div></div>' +
        '<div class="timer-row">' +
        '<div class="timer-main"><span class="timer-kicker">Rest</span><span class="timer-time"></span></div>' +
        '<button class="timer-btn" data-act="rest" data-d="-15" aria-label="15 seconds less">−15</button>' +
        '<button class="timer-btn" data-act="rest" data-d="15" aria-label="15 seconds more">+15</button>' +
        '<button class="timer-btn timer-skip" data-act="reststop">Skip</button></div>';
    }
    el.querySelector('.timer-time').textContent = fmt(left);
    el.querySelector('.timer-kicker').textContent = t.label ? 'Rest · ' + t.label : 'Rest';
    el.querySelector('.timer-fill').style.transform = 'scaleX(' + pct.toFixed(4) + ')';
    show(true);
    return;
  }
  if (doneAt && Date.now() - doneAt < 6000) {
    if (el.dataset.mode !== 'done') {
      el.dataset.mode = 'done';
      el.innerHTML = '<div class="timer-row timer-done"><div class="timer-main"><span class="timer-time">Go — next set</span></div>' +
        '<button class="timer-btn" data-act="reststop">OK</button></div>';
    }
    show(true);
    return;
  }
  show(false); el.dataset.mode = '';
  if (tickId) { clearInterval(tickId); tickId = null; }
}

export function mountTimer(node) {
  el = node;
  if (t) arm();
  paint();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (t) holdWake(true); paint(); }
  });
}
