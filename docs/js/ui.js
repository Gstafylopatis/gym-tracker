/* Transient UI state (not persisted). */

import { todayStr } from './dates.js';

export const ui = {
  screen: 'today',        // today | detail | week | stats | settings
  from: 'today',          // screen to return to from detail
  viewDate: todayStr(),
  detailId: null,
  editIdx: null,          // set being edited on the detail screen
  detailPt: null,         // selected point on the detail chart
  zoom: null,             // photo index shown full-screen
  weekOffset: 0,
  chartEx: null,
  chartMetric: null,
  chartPt: null,
  heatSel: null,
  musWindow: 'week',      // week | last | avg4
  bwPt: null,
  sheet: null,            // 'addex' | 'import'
  importData: null,
  toast: null,            // { text, undo, kind }
};

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
