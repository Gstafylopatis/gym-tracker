/* Inline SVG icons (stroke = currentColor). */

const ic = (d, size = 22, sw = 2.2) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw +
  '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

export const I = {
  today: ic('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
  week: ic('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  stats: ic('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  settings: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  back: ic('<path d="M15 18l-6-6 6-6"/>', 22, 2.6),
  left: ic('<path d="M15 18l-6-6 6-6"/>', 20, 2.6),
  right: ic('<path d="M9 18l6-6-6-6"/>', 20, 2.6),
  check: ic('<path d="M20 6 9 17l-5-5"/>', 22, 3),
  plus: ic('<path d="M12 5v14M5 12h14"/>', 22, 2.8),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>', 18, 2.6),
  note: ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 18),
  trophy: ic('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>', 14, 2.4),
  cloud: ic('<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12.5 3.5 3.5 0 0 0 6.5 19z"/>', 20),
  alert: ic('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>', 20),
  dumbbell: ic('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>', 26, 2.4),
  timer: ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>', 18),
};
