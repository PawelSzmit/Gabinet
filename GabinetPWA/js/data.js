// =============================================================================
// data.js — Data models, AppState and persistence for Gabinet PWA
// =============================================================================

'use strict';

// -----------------------------------------------------------------------------
// APP STATE — single source of truth (in-memory)
// -----------------------------------------------------------------------------

const AppState = {
  patients:       [],   // Patient[]
  sessions:       [],   // Session[]
  payments:       [],   // Payment[]
  blockedPeriods: [],   // BlockedPeriod[]
  settings:       {},   // AppSettings

  get activePatients()   { return this.patients.filter(p => !p.isArchived && p.isActive); },
  get archivedPatients() { return this.patients.filter(p => p.isArchived); },
};

// -----------------------------------------------------------------------------
// MODEL FACTORY FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Creates a Patient object with defaults merged from data.
 * @param {Partial<Patient>} data
 * @returns {Patient}
 */
function createPatient(data = {}) {
  return {
    id:                 data.id               || uuid(),
    firstName:          data.firstName        || '',
    lastName:           data.lastName         || '',
    pseudonym:          data.pseudonym        || '',
    isActive:           data.isActive         !== false,
    isArchived:         data.isArchived       || false,
    archivedDate:       data.archivedDate     || null,
    sessionsPerWeek:    data.sessionsPerWeek  || 1,
    sessionRate:        data.sessionRate      || 200,
    therapyStartDate:   data.therapyStartDate || new Date().toISOString(),
    dateAdded:          data.dateAdded        || new Date().toISOString(),
    // [{weekday:1, sessionTime:'10:00'}]
    sessionDayConfigs:  Array.isArray(data.sessionDayConfigs)  ? data.sessionDayConfigs  : [],
    // [{id, startDate, endDate, cycleNumber}]
    therapyCycles:      Array.isArray(data.therapyCycles)      ? data.therapyCycles      : [],
    // [{id, startDate, endDate}]
    vacationPeriods:    Array.isArray(data.vacationPeriods)    ? data.vacationPeriods    : [],
    // [{id, title, status, dateSet, dateAchieved, notes}]
    therapeuticGoals:   Array.isArray(data.therapeuticGoals)   ? data.therapeuticGoals   : [],
    // [{id, date, category, title, content}]
    progressEntries:    Array.isArray(data.progressEntries)    ? data.progressEntries    : [],
    // [{id, date, content, sessionId}]
    sessionNotes:       Array.isArray(data.sessionNotes)       ? data.sessionNotes       : [],
    invoices:           Array.isArray(data.invoices)           ? data.invoices           : [],
  };
}

/**
 * Creates a Session object with defaults merged from data.
 * @param {Partial<Session>} data
 * @returns {Session}
 */
function createSession(data = {}) {
  return {
    id:                   data.id                   || uuid(),
    date:                 data.date                 || new Date().toISOString(),
    patientId:            data.patientId            || null,
    // scheduled | completed | cancelled
    status:               data.status               || 'scheduled',
    isPaymentRequired:    data.isPaymentRequired    !== false,
    isPaid:               data.isPaid               || false,
    paymentMethod:        data.paymentMethod        || null,
    paymentDate:          data.paymentDate          || null,
    paymentAmount:        data.paymentAmount        || null,
    paymentId:            data.paymentId            || null,
    isManuallyCreated:    data.isManuallyCreated    || false,
    sessionNumber:        data.sessionNumber        || null,
    globalSessionNumber:  data.globalSessionNumber  || null,
    cycleSessionNumber:   data.cycleSessionNumber   || null,
    wasRescheduled:       data.wasRescheduled       || false,
    originalDate:         data.originalDate         || null,
    // encrypted text
    sessionNotes:         data.sessionNotes         || '',
  };
}

/**
 * Creates a Payment object with defaults merged from data.
 * @param {Partial<Payment>} data
 * @returns {Payment}
 */
function createPayment(data = {}) {
  return {
    id:            data.id            || uuid(),
    patientId:     data.patientId     || null,
    date:          data.date          || new Date().toISOString(),
    amount:        data.amount        || 0,
    // aliorBank | ingBank | cash
    method:        data.method        || 'cash',
    sessionsCount: data.sessionsCount || 0,
    sessionIds:    Array.isArray(data.sessionIds) ? data.sessionIds : [],
    note:          data.note          || '',
    createdAt:     data.createdAt     || new Date().toISOString(),
  };
}

/**
 * Creates a BlockedPeriod object with defaults merged from data.
 * @param {Partial<BlockedPeriod>} data
 * @returns {BlockedPeriod}
 */
function createBlockedPeriod(data = {}) {
  return {
    id:        data.id        || uuid(),
    startDate: data.startDate || new Date().toISOString(),
    endDate:   data.endDate   || new Date().toISOString(),
    reason:    data.reason    || '',
  };
}

/**
 * Creates an AppSettings object with defaults merged from data.
 * @param {Partial<AppSettings>} data
 * @returns {AppSettings}
 */
function createAppSettings(data = {}) {
  return {
    therapistName:        data.therapistName        || '',
    therapistAddress:     data.therapistAddress     || '',
    therapistNIP:         data.therapistNIP         || '',
    workingHoursStart:    data.workingHoursStart    || '08:00',
    workingHoursEnd:      data.workingHoursEnd      || '20:00',
    // seconds of inactivity before app locks
    autoLockTimeout:      data.autoLockTimeout      !== undefined ? data.autoLockTimeout : 120,
    // ISO string of the last month that was auto-generated e.g. "2026-03"
    lastGeneratedMonth:   data.lastGeneratedMonth   || null,
  };
}

// -----------------------------------------------------------------------------
// LOOKUP CONSTANTS
// -----------------------------------------------------------------------------

const PAYMENT_METHODS = {
  aliorBank: { name: 'Alior Bank', icon: '🏦' },
  ingBank:   { name: 'ING Bank',   icon: '🏦' },
  cash:      { name: 'Gotówka',    icon: '💵' },
};

const GOAL_STATUS = {
  inProgress: { name: 'W trakcie',   color: 'blue'  },
  achieved:   { name: 'Osiągnięty',  color: 'green' },
  obsolete:   { name: 'Nieaktualny', color: 'gray'  },
};

const SESSION_STATUS = {
  scheduled:  'scheduled',
  completed:  'completed',
  cancelled:  'cancelled',
};

// -----------------------------------------------------------------------------
// PATIENT HELPERS
// -----------------------------------------------------------------------------

/**
 * Returns the patient with the given id, or undefined.
 * @param {string} id
 * @returns {Patient|undefined}
 */
function getPatient(id) {
  return AppState.patients.find(p => p.id === id);
}

/**
 * Returns all sessions belonging to a patient, sorted ascending by date.
 * @param {string} patientId
 * @returns {Session[]}
 */
function getPatientSessions(patientId) {
  return AppState.sessions
    .filter(s => s.patientId === patientId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Returns all payments belonging to a patient, sorted ascending by date.
 * @param {string} patientId
 * @returns {Payment[]}
 */
function getPatientPayments(patientId) {
  return AppState.payments
    .filter(p => p.patientId === patientId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Returns unpaid sessions and their total debt for a patient.
 * A session is a debt if it is completed (or cancelled+required) and not paid.
 *
 * @param {string} patientId
 * @returns {{ sessions: Session[], total: number }}
 */
function getPatientDebt(patientId) {
  const patient = getPatient(patientId);
  const rate    = patient ? patient.sessionRate : 0;

  const unpaid = AppState.sessions.filter(s => {
    if (s.patientId !== patientId) return false;
    if (s.isPaid)                   return false;
    if (!s.isPaymentRequired)       return false;
    return s.status === SESSION_STATUS.completed ||
           s.status === SESSION_STATUS.cancelled;
  });

  const total = unpaid.reduce((sum, s) => {
    return sum + (s.paymentAmount !== null ? s.paymentAmount : rate);
  }, 0);

  return { sessions: unpaid, total };
}

/**
 * Returns a Polish string describing how long a patient's therapy has lasted.
 * Delegates to therapyDuration() from utils.js.
 *
 * @param {Patient} patient
 * @returns {string}
 */
function getPatientTherapyDuration(patient) {
  if (!patient || !patient.therapyStartDate) return '—';
  return therapyDuration(patient.therapyStartDate);
}

/**
 * Returns the active (open-ended) therapy cycle for a patient.
 * The active cycle is the last one with no endDate.
 *
 * @param {Patient} patient
 * @returns {{ id: string, startDate: string, endDate: null, cycleNumber: number }|null}
 */
function getActiveCycle(patient) {
  if (!patient || !Array.isArray(patient.therapyCycles)) return null;
  const open = patient.therapyCycles.filter(c => !c.endDate);
  if (open.length === 0) return null;
  // Return the last open cycle by cycleNumber (or array order)
  return open.reduce((latest, c) => {
    return (!latest || c.cycleNumber > latest.cycleNumber) ? c : latest;
  }, null);
}

/**
 * Returns the count of sessions that count toward the patient's session total.
 * A session counts if it is completed OR (cancelled AND isPaymentRequired).
 *
 * @param {string} patientId
 * @returns {number}
 */
function getCompletedSessionsCount(patientId) {
  return AppState.sessions.filter(s => {
    if (s.patientId !== patientId) return false;
    return countsForNumbering(s);
  }).length;
}

// -----------------------------------------------------------------------------
// SESSION HELPERS
// -----------------------------------------------------------------------------

/**
 * Returns all sessions scheduled on a specific date string (YYYY-MM-DD).
 * @param {string} dateStr — e.g. "2026-03-03"
 * @returns {Session[]}
 */
function getSessionsByDate(dateStr) {
  return AppState.sessions.filter(s => {
    const d = new Date(s.date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === dateStr;
  });
}

/**
 * Returns all sessions falling within a given calendar month.
 * @param {number} year
 * @param {number} month — 0-indexed (0=Jan)
 * @returns {Session[]}
 */
function getSessionsForMonth(year, month) {
  const start = new Date(year, month,     1,  0,  0,  0,   0);
  const end   = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return AppState.sessions.filter(s => {
    const d = new Date(s.date);
    return d >= start && d <= end;
  });
}

/**
 * Returns true if this session should count toward session numbering.
 * Completed sessions always count; cancelled sessions count only when payment was required.
 *
 * @param {Session} session
 * @returns {boolean}
 */
function countsForNumbering(session) {
  if (session.status === SESSION_STATUS.completed) return true;
  if (session.status === SESSION_STATUS.cancelled && session.isPaymentRequired) return true;
  return false;
}

// -----------------------------------------------------------------------------
// SESSION GENERATION SERVICE
// -----------------------------------------------------------------------------

/**
 * Checks whether a given date falls within any blocked period.
 * @param {Date} date
 * @returns {boolean}
 */
function _isBlocked(date) {
  return AppState.blockedPeriods.some(bp => {
    const s = new Date(bp.startDate);
    const e = new Date(bp.endDate);
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return date >= s && date <= e;
  });
}

/**
 * Checks whether a given date falls within any of the patient's vacation periods.
 * @param {Patient} patient
 * @param {Date}    date
 * @returns {boolean}
 */
function _isPatientOnVacation(patient, date) {
  return (patient.vacationPeriods || []).some(vp => {
    const s = new Date(vp.startDate);
    const e = new Date(vp.endDate);
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return date >= s && date <= e;
  });
}

/**
 * Generates sessions for a patient for a given month based on sessionDayConfigs.
 * Skips blocked periods and patient vacation periods.
 * Does NOT create duplicate sessions where one already exists at the same date+time.
 *
 * @param {Patient} patient
 * @param {number}  year
 * @param {number}  month — 0-indexed
 * @returns {Session[]}  — newly created sessions (already pushed into AppState.sessions)
 */
function generateSessionsForMonth(patient, year, month) {
  if (!patient || !Array.isArray(patient.sessionDayConfigs) || patient.sessionDayConfigs.length === 0) {
    return [];
  }

  const created = [];
  const daysInM = getDaysInMonth(year, month);

  for (let day = 1; day <= daysInM; day++) {
    const date = new Date(year, month, day);
    const isoWeekday = getISOWeekday(date); // 1=Mon … 7=Sun

    for (const config of patient.sessionDayConfigs) {
      if (config.weekday !== isoWeekday) continue;

      // Parse session time
      const [hours, minutes] = (config.sessionTime || '00:00').split(':').map(Number);
      const sessionDate = new Date(year, month, day, hours, minutes, 0, 0);

      if (_isBlocked(sessionDate))              continue;
      if (_isPatientOnVacation(patient, sessionDate)) continue;

      // Check for existing session (same patient, same date within 1-minute window)
      const duplicate = AppState.sessions.some(s => {
        if (s.patientId !== patient.id) return false;
        const d = new Date(s.date);
        return Math.abs(d.getTime() - sessionDate.getTime()) < 60 * 1000;
      });
      if (duplicate) continue;

      const session = createSession({
        date:      sessionDate.toISOString(),
        patientId: patient.id,
        status:    SESSION_STATUS.scheduled,
      });
      AppState.sessions.push(session);
      created.push(session);
    }
  }

  recalculateSessionNumbers(patient);
  return created;
}

/**
 * Generates sessions for a patient for the current calendar month.
 * @param {Patient} patient
 * @returns {Session[]}
 */
function generateCurrentMonthSessions(patient) {
  const now = new Date();
  return generateSessionsForMonth(patient, now.getFullYear(), now.getMonth());
}

/**
 * Deletes all future scheduled (non-completed, non-cancelled) sessions for a patient
 * and regenerates the current month from the patient's sessionDayConfigs.
 *
 * @param {Patient} patient
 * @returns {Session[]}  — newly generated sessions
 */
function regenerateCurrentMonth(patient) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Remove future scheduled sessions for this patient
  AppState.sessions = AppState.sessions.filter(s => {
    if (s.patientId !== patient.id)          return true;
    if (s.status !== SESSION_STATUS.scheduled) return true;
    return new Date(s.date) < today; // keep past scheduled sessions
  });

  return generateCurrentMonthSessions(patient);
}

// -----------------------------------------------------------------------------
// SESSION NUMBERING SERVICE
// -----------------------------------------------------------------------------

/**
 * Recalculates sessionNumber, globalSessionNumber and cycleSessionNumber
 * for all sessions belonging to a patient, in chronological order.
 *
 * - globalSessionNumber  : 1-based count across all cycles
 * - cycleSessionNumber   : 1-based count within the current cycle
 * - sessionNumber        : alias for globalSessionNumber (kept for compatibility)
 *
 * @param {Patient} patient
 */
function recalculateSessionNumbers(patient) {
  const sessions = getPatientSessions(patient.id);
  const countable = sessions.filter(s => countsForNumbering(s));

  let globalNum = 0;

  // Build a lookup: for each cycle, what dates does it span?
  const cycles = (patient.therapyCycles || []).slice().sort((a, b) =>
    new Date(a.startDate) - new Date(b.startDate)
  );

  /**
   * Returns the cycleNumber for a given session date, or null if outside all cycles.
   */
  function getCycleFor(sessionDate) {
    const d = new Date(sessionDate);
    for (const cycle of cycles) {
      const start = new Date(cycle.startDate);
      const end   = cycle.endDate ? new Date(cycle.endDate) : null;
      start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);
      if (d >= start && (end === null || d <= end)) return cycle.cycleNumber;
    }
    return null;
  }

  // cycleSessionNumber counters keyed by cycleNumber
  const cycleCounters = {};

  for (const session of sessions) {
    if (!countsForNumbering(session)) {
      session.sessionNumber       = null;
      session.globalSessionNumber = null;
      session.cycleSessionNumber  = null;
      continue;
    }

    globalNum++;
    session.globalSessionNumber = globalNum;
    session.sessionNumber       = globalNum;

    const cycleNum = getCycleFor(session.date);
    if (cycleNum !== null) {
      cycleCounters[cycleNum] = (cycleCounters[cycleNum] || 0) + 1;
      session.cycleSessionNumber = cycleCounters[cycleNum];
    } else {
      session.cycleSessionNumber = null;
    }
  }
}

// -----------------------------------------------------------------------------
// PERSISTENCE — serialise / deserialise for Google Drive storage
// -----------------------------------------------------------------------------

/**
 * Serialises the entire AppState to a JSON string suitable for storage.
 * @returns {string}
 */
function serializeAppData() {
  const data = {
    version:        2,
    exportedAt:     new Date().toISOString(),
    patients:       AppState.patients,
    sessions:       AppState.sessions,
    payments:       AppState.payments,
    blockedPeriods: AppState.blockedPeriods,
    settings:       AppState.settings,
  };
  return JSON.stringify(data);
}

/**
 * Loads a serialised JSON string into AppState, replacing all current data.
 * Applies factory functions to ensure all objects have the correct shape.
 *
 * @param {string} json
 * @throws {Error} if json is invalid or missing required keys
 */
function deserializeAppData(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error('Nieprawidłowy format danych: ' + e.message);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Dane są puste lub nieprawidłowe.');
  }

  AppState.patients       = (data.patients       || []).map(createPatient);
  AppState.sessions       = (data.sessions       || []).map(createSession);
  AppState.payments       = (data.payments       || []).map(createPayment);
  AppState.blockedPeriods = (data.blockedPeriods || []).map(createBlockedPeriod);
  AppState.settings       = createAppSettings(data.settings || {});
}

/**
 * Returns the default (empty) application state with sensible settings.
 * Use this to initialise a brand-new installation.
 *
 * @returns {{ patients: [], sessions: [], payments: [], blockedPeriods: [], settings: AppSettings }}
 */
function getDefaultData() {
  return {
    patients:       [],
    sessions:       [],
    payments:       [],
    blockedPeriods: [],
    settings:       createAppSettings({}),
  };
}

/**
 * Applies getDefaultData() directly into AppState.
 * Called on first run or after a data reset.
 */
function initDefaultAppState() {
  const defaults = getDefaultData();
  AppState.patients       = defaults.patients;
  AppState.sessions       = defaults.sessions;
  AppState.payments       = defaults.payments;
  AppState.blockedPeriods = defaults.blockedPeriods;
  AppState.settings       = defaults.settings;
}
