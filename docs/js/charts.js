/* Small hand-rolled SVG charts. Single-series, themed through CSS variables,
   tap/hover a point to inspect it (the readout renders below the chart). */

import { niceDate, addDays, mondayOf, todayStr, MONTHS, parseDate } from './dates.js';

function niceTicks(lo, hi, count) {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < hi) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 100) / 100);
  return ticks;
}
const fmtNum = (v) => (Math.abs(v) >= 10000 ? Math.round(v / 100) / 10 + 'k' : String(Math.round(v * 10) / 10));

/* pts: [{ date, v }], sel: selected index, act: data-act for the hit targets */
export function lineChart(pts, { sel, act, height = 180, zeroBase = false } = {}) {
  const W = 340, H = height, mL = 34, mR = 12, mT = 14, mB = 26;
  const iw = W - mL - mR, ih = H - mT - mB;
  let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  if (zeroBase) lo = 0;
  if (lo === hi) { lo -= Math.max(1, Math.abs(lo) * 0.1); hi += Math.max(1, Math.abs(hi) * 0.1); }
  const ticks = niceTicks(Math.max(0, lo), hi, 3);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const x = (i) => pts.length === 1 ? mL + iw / 2 : mL + (i / (pts.length - 1)) * iw;
  const y = (v) => mT + ih - ((v - lo) / (hi - lo)) * ih;

  const grid = ticks.map((v) =>
    '<line x1="' + mL + '" y1="' + y(v) + '" x2="' + (W - mR) + '" y2="' + y(v) + '" class="c-grid"/>' +
    '<text x="' + (mL - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end" class="c-tick">' + fmtNum(v) + '</text>').join('');

  const n = pts.length;
  const every = Math.max(1, Math.ceil(n / 4));
  const xl = pts.map((p, i) => {
    const first = i === 0, last = i === n - 1;
    if (!first && !last && (i % every !== 0 || i < every || n - 1 - i < every)) return '';
    const anchor = n === 1 ? 'middle' : first ? 'start' : last ? 'end' : 'middle';
    return '<text x="' + x(i) + '" y="' + (H - 7) + '" text-anchor="' + anchor + '" class="c-tick">' + niceDate(p.date) + '</text>';
  }).join('');

  const line = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  const area = n > 1 ? line + ' L' + x(n - 1).toFixed(1) + ' ' + y(lo) + ' L' + x(0).toFixed(1) + ' ' + y(lo) + ' Z' : '';
  const s = sel == null ? n - 1 : sel;
  const cross = '<line x1="' + x(s) + '" y1="' + mT + '" x2="' + x(s) + '" y2="' + (mT + ih) + '" class="c-cross"/>';
  const dots = n <= 40
    ? pts.map((p, i) => i === s ? '' : '<circle cx="' + x(i) + '" cy="' + y(p.v) + '" r="3" class="c-dot"/>').join('')
    : '';
  const selDot = '<circle cx="' + x(s) + '" cy="' + y(pts[s].v) + '" r="5.5" class="c-dot c-dot-sel"/>';
  const slot = n > 1 ? iw / (n - 1) : iw;
  const hits = pts.map((p, i) =>
    '<rect data-act="' + act + '" data-idx="' + i + '" x="' + (x(i) - slot / 2) + '" y="0" width="' + slot + '" height="' + H + '" fill="transparent"/>').join('');

  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + grid + xl +
    (area ? '<path d="' + area + '" class="c-area"/>' : '') +
    cross + '<path d="' + line + '" class="c-line"/>' + dots + selDot + hits + '</svg>';
}

/* Calendar heatmap of sets per day, `weeks` columns ending this week. */
export function heatmap(setsByDate, { weeks = 18, sel } = {}) {
  const cell = 15, gap = 3, top = 14, left = 0;
  const W = weeks * (cell + gap) - gap + left, H = top + 7 * (cell + gap) - gap;
  const today = todayStr();
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  const level = (n) => (n === 0 ? 0 : n < 10 ? 1 : n < 16 ? 2 : n < 22 ? 3 : 4);
  let out = '', lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(start, w * 7);
    const m = parseDate(monday).getMonth();
    if (m !== lastMonth && (w < weeks - 1 || lastMonth === -1 || parseDate(monday).getDate() <= 7)) {
      out += '<text x="' + (left + w * (cell + gap)) + '" y="10" class="c-tick">' + MONTHS[m] + '</text>';
      lastMonth = m;
    }
    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d);
      if (date > today) continue;
      const n = setsByDate[date] || 0;
      const cx = left + w * (cell + gap), cy = top + d * (cell + gap);
      out += '<rect data-act="heatsel" data-date="' + date + '" x="' + cx + '" y="' + cy + '" width="' + cell + '" height="' + cell +
        '" rx="3.5" class="hm hm' + level(n) + (date === sel ? ' hm-sel' : '') + '"/>';
    }
  }
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Training calendar">' + out + '</svg>';
}

export function heatLegend() {
  return '<div class="hm-legend"><span>Less</span>' +
    [0, 1, 2, 3, 4].map((l) => '<svg width="11" height="11"><rect width="11" height="11" rx="2.5" class="hm hm' + l + '"/></svg>').join('') +
    '<span>More</span></div>';
}

/* Horizontal bars, one series. rows: [{ label, v }]. ref: optional reference value. */
export function barList(rows, { max, ref, fmt = fmtNum } = {}) {
  const top = Math.max(max || 0, ref || 0, ...rows.map((r) => r.v), 1);
  return '<div class="bars">' + rows.map((r) =>
    '<div class="bar-row"><div class="bar-label">' + r.label + '</div>' +
    '<div class="bar-track">' +
    (r.v > 0 ? '<div class="bar-fill" style="width: ' + (r.v / top * 100).toFixed(1) + '%;"></div>' : '') +
    (ref ? '<div class="bar-ref" style="left: ' + (ref / top * 100).toFixed(1) + '%;"></div>' : '') +
    '</div><div class="bar-val">' + fmt(r.v) + '</div></div>').join('') + '</div>';
}
