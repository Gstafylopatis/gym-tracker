/* Per-device preferences (not synced). */

const PREFS_KEY = 'gym-tracker-prefs';
const DEFAULTS = { theme: 'auto', autoRest: true, sound: true, vibrate: true, notify: false };

export const prefs = { ...DEFAULTS };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch (e) { /* defaults */ }

export function setPref(k, v) {
  prefs[k] = v;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  if (k === 'theme') applyTheme();
}

export function applyTheme() {
  const root = document.documentElement;
  if (prefs.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', prefs.theme);
  const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0e0f11' : '#f4f4f1');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
