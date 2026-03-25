// =============================================================================
// utils.js — Shared utility functions for Gabinet PWA
// =============================================================================

'use strict';

// -----------------------------------------------------------------------------
// UUID generation
// -----------------------------------------------------------------------------
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 version 4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// -----------------------------------------------------------------------------
// Polish date formatting
// -----------------------------------------------------------------------------
const PL_LOCALE = 'pl-PL';

/**
 * "3 marca 2026"
 */
function formatDateLong(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(PL_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * "3 mar 2026"
 */
function formatDateMedium(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(PL_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * "03.03.2026"
 */
function formatDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(PL_LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * "14:30"
 */
function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString(PL_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * "wtorek, 3 marca 2026"
 */
function formatDateWithWeekday(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(PL_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * "wtorek, 3 marca 2026, 14:30"
 */
function formatDateTimeWithWeekday(date) {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = d.toLocaleDateString(PL_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = formatTime(d);
  return `${datePart}, ${timePart}`;
}

/**
 * "marzec 2026"
 */
function formatMonthYear(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(PL_LOCALE, { month: 'long', year: 'numeric' });
}

/**
 * Returns true if two dates fall on the same calendar day.
 */
function isSameDay(a, b) {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Returns a new Date set to midnight on the first day of the given date's month.
 */
function startOfMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Returns a new Date set to 23:59:59.999 on the last day of the given date's month.
 */
function endOfMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Returns a new Date with n months added (or subtracted if n is negative).
 */
function addMonths(date, n) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  const originalDay = d.getDate();
  d.setDate(1); // avoid overshooting month-end
  d.setMonth(d.getMonth() + n);
  // Clamp to last day of the resulting month if needed
  const daysInTarget = getDaysInMonth(d.getFullYear(), d.getMonth());
  d.setDate(Math.min(originalDay, daysInTarget));
  return d;
}

/**
 * Returns a new Date with n days added (or subtracted if n is negative).
 */
function addDays(date, n) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Returns the number of days in the given month (0-indexed month: 0=Jan).
 */
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// -----------------------------------------------------------------------------
// Currency formatting
// -----------------------------------------------------------------------------

/**
 * "200 zł"
 */
function formatPLN(amount) {
  const n = Number(amount);
  if (isNaN(n)) return '— zł';
  return (
    n.toLocaleString(PL_LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' zł'
  );
}

// -----------------------------------------------------------------------------
// Polish pluralization
// -----------------------------------------------------------------------------

/**
 * Returns the correct Polish plural form.
 *
 * @param {number} n      - the count
 * @param {string} one    - singular, e.g. "sesja"
 * @param {string} few    - plural 2-4, e.g. "sesje"
 * @param {string} many   - plural 5+, e.g. "sesji"
 * @returns {string}      - e.g. "1 sesja", "2 sesje", "5 sesji"
 */
function pluralPL(n, one, few, many) {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (abs === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// -----------------------------------------------------------------------------
// Weekday helpers (1=Mon … 7=Sun; we expose Mon–Sun but label 1–5 as work days)
// -----------------------------------------------------------------------------

const WEEKDAYS = [
  { id: 1, name: 'Poniedziałek', short: 'Pn' },
  { id: 2, name: 'Wtorek',       short: 'Wt' },
  { id: 3, name: 'Środa',        short: 'Śr' },
  { id: 4, name: 'Czwartek',     short: 'Cz' },
  { id: 5, name: 'Piątek',       short: 'Pt' },
  { id: 6, name: 'Sobota',       short: 'Sb' },
  { id: 7, name: 'Niedziela',    short: 'Nd' },
];

/**
 * Returns the weekday object for a given id (1–7).
 */
function getWeekdayName(n) {
  return WEEKDAYS.find((w) => w.id === n) || null;
}

/**
 * Returns the ISO weekday number (1=Mon … 7=Sun) for a Date object.
 */
function getISOWeekday(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDay(); // 0=Sun
  return day === 0 ? 7 : day;
}

// -----------------------------------------------------------------------------
// DOM helpers
// -----------------------------------------------------------------------------

/**
 * Creates a new DOM element.
 * @param {string} tag   - element tag
 * @param {string} [cls] - space-separated class names
 * @param {string} [html]- innerHTML
 */
function el(tag, cls, html) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (html !== undefined) element.innerHTML = html;
  return element;
}

/**
 * Shorthand for querySelector.
 * @param {string} sel       - CSS selector
 * @param {Element} [parent] - defaults to document
 */
function qs(sel, parent) {
  return (parent || document).querySelector(sel);
}

/**
 * Shorthand for querySelectorAll (returns a real Array).
 * @param {string} sel       - CSS selector
 * @param {Element} [parent] - defaults to document
 */
function qsa(sel, parent) {
  return Array.from((parent || document).querySelectorAll(sel));
}

/**
 * Adds an event listener; returns the remove function.
 * @param {EventTarget} element
 * @param {string}      evt
 * @param {Function}    fn
 */
function on(element, evt, fn) {
  element.addEventListener(evt, fn);
  return () => element.removeEventListener(evt, fn);
}

/** Shows an element by removing the 'hidden' class. */
function show(element) {
  if (element) element.classList.remove('hidden');
}

/** Hides an element by adding the 'hidden' class. */
function hide(element) {
  if (element) element.classList.add('hidden');
}

/** Toggles the 'hidden' class on an element. */
function toggle(element) {
  if (element) element.classList.toggle('hidden');
}

/**
 * Sets innerHTML on the first element matching the selector.
 * @param {string} sel  - CSS selector
 * @param {string} html - HTML string to inject
 */
function setHTML(sel, html) {
  const target = document.querySelector(sel);
  if (target) target.innerHTML = html;
}

// -----------------------------------------------------------------------------
// Toast notifications
// -----------------------------------------------------------------------------

(function _initToastContainer() {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText =
        'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);' +
        'display:flex;flex-direction:column;align-items:center;gap:0.5rem;' +
        'z-index:9999;pointer-events:none;';
      document.body.appendChild(container);
    }
  });
})();

/**
 * Shows a temporary toast notification.
 * @param {string} msg          - message text
 * @param {'info'|'success'|'warning'|'error'} [type='info']
 * @param {number} [duration=3000] - ms before auto-dismiss
 */
function toast(msg, type = 'info', duration = 3000) {
  if (typeof document === 'undefined') return;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText =
      'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);' +
      'display:flex;flex-direction:column;align-items:center;gap:0.5rem;' +
      'z-index:9999;pointer-events:none;';
    document.body.appendChild(container);
  }

  const COLOR_MAP = {
    info:    { bg: '#334155', icon: 'ℹ️' },
    success: { bg: '#166534', icon: '✓'  },
    warning: { bg: '#92400e', icon: '⚠️' },
    error:   { bg: '#991b1b', icon: '✕'  },
  };
  const style = COLOR_MAP[type] || COLOR_MAP.info;

  const item = document.createElement('div');
  item.style.cssText =
    `background:${style.bg};color:#fff;padding:0.6rem 1.2rem;border-radius:0.5rem;` +
    'font-size:0.9rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:auto;' +
    'opacity:0;transition:opacity 0.25s ease;max-width:90vw;text-align:center;';
  item.textContent = `${style.icon} ${msg}`;

  container.appendChild(item);

  // Trigger fade-in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { item.style.opacity = '1'; });
  });

  // Fade out and remove
  setTimeout(() => {
    item.style.opacity = '0';
    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 300);
  }, duration);
}

// -----------------------------------------------------------------------------
// Debounce
// -----------------------------------------------------------------------------

/**
 * Returns a debounced version of fn that fires after ms milliseconds of silence.
 * @param {Function} fn
 * @param {number}   ms
 */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// -----------------------------------------------------------------------------
// Therapy duration calculation
// -----------------------------------------------------------------------------

/**
 * Returns a human-readable Polish string describing how long therapy has been going.
 * Examples: "2 lata 3 miesiące", "5 miesięcy", "3 tygodnie", "1 tydzień"
 *
 * @param {string|Date} startDate
 * @returns {string}
 */
function therapyDuration(startDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const now = new Date();

  if (isNaN(start.getTime())) return '—';

  let years  = now.getFullYear() - start.getFullYear();
  let months = now.getMonth()    - start.getMonth();
  let days   = now.getDate()     - start.getDate();

  if (days < 0) {
    months -= 1;
    days += getDaysInMonth(now.getFullYear(), now.getMonth() - 1);
  }
  if (months < 0) {
    years  -= 1;
    months += 12;
  }

  const totalDays   = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const totalWeeks  = Math.floor(totalDays / 7);
  const totalMonths = years * 12 + months;

  if (totalDays < 7) {
    return pluralPL(totalDays, 'dzień', 'dni', 'dni');
  }
  if (totalMonths < 1) {
    return pluralPL(totalWeeks, 'tydzień', 'tygodnie', 'tygodni');
  }
  if (years === 0) {
    return pluralPL(months, 'miesiąc', 'miesiące', 'miesięcy');
  }

  const yearStr  = pluralPL(years,  'rok',     'lata',     'lat');
  const monthStr = months > 0 ? ' ' + pluralPL(months, 'miesiąc', 'miesiące', 'miesięcy') : '';
  return yearStr + monthStr;
}

// -----------------------------------------------------------------------------
// Deep clone
// -----------------------------------------------------------------------------

/**
 * Returns a deep clone of obj using JSON round-trip.
 * Handles plain objects, arrays, and primitives.
 * @param {*} obj
 */
function clone(obj) {
  if (obj === undefined) return undefined;
  return JSON.parse(JSON.stringify(obj));
}
