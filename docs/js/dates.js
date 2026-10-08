/* Date helpers. Dates are local-time "YYYY-MM-DD" strings everywhere. */

export function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function todayStr() { return fmtDate(new Date()); }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
export function mondayOf(s) { const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return fmtDate(d); }
export function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 864e5); }

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function niceDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
export function weekdayName(s) { return WDAYS[(parseDate(s).getDay() + 6) % 7]; }
export function isoWeek(s) {
  const t = parseDate(s); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const jan4 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}
export function relTime(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return niceDate(fmtDate(new Date(ts)));
}
