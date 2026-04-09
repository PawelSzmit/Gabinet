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
  migrationIssues: [],  // MigrationIssue[]

  get activePatients()   { return this.patients.filter(p => !p.isArchived && p.isActive); },
  get archivedPatients() { return this.patients.filter(p => p.isArchived); },
};

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeSessionDate(dateValue, legacyTime) {
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    return dateValue.toISOString();
  }

  if (typeof dateValue === 'string' && dateValue.trim()) {
    const trimmed = dateValue.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const [hours, minutes] = String(legacyTime || '00:00').split(':').map(Number);
      return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0).toISOString();
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function isEncryptedClinicalEnvelope(value) {
  return !!(
    value &&
    typeof value === 'object' &&
    value.__clinicalEncrypted === true &&
    typeof value.alg === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

function normalizeClinicalField(value, fallback = '') {
  if (isEncryptedClinicalEnvelope(value)) return value;
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function createClinicalSecuritySettings(data = {}) {
  return {
    enabled: data.enabled === true,
    version: Number.isFinite(data.version) ? data.version : 1,
    salt: typeof data.salt === 'string' ? data.salt : '',
    kdfIterations: normalizePositiveInteger(data.kdfIterations, 210000),
    kdfHash: typeof data.kdfHash === 'string' && data.kdfHash ? data.kdfHash : 'SHA-256',
    verification: isEncryptedClinicalEnvelope(data.verification) ? data.verification : null,
    updatedAt: data.updatedAt || null,
  };
}

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
    ...data,
    id:                 data.id               || uuid(),
    firstName:          data.firstName        || '',
    lastName:           data.lastName         || '',
    pseudonym:          data.pseudonym        || '',
    isActive:           data.isActive         !== false,
    isArchived:         data.isArchived       || false,
    archivedDate:       data.archivedDate     || null,
    sessionsPerWeek:    normalizePositiveInteger(data.sessionsPerWeek, 1),
    sessionRate:        normalizeNullableNumber(data.sessionRate) ?? 200,
    therapyStartDate:   normalizeSessionDate(data.therapyStartDate),
    dateAdded:          data.dateAdded        || new Date().toISOString(),
    // [{weekday:1, sessionTime:'10:00'}]
    sessionDayConfigs:  Array.isArray(data.sessionDayConfigs)
      ? data.sessionDayConfigs.map((config) => ({
          ...config,
          weekday: normalizePositiveInteger(config && config.weekday, 1),
          sessionTime: (config && config.sessionTime) || '10:00',
        }))
      : [],
    // [{id, startDate, endDate, cycleNumber}]
    therapyCycles:      Array.isArray(data.therapyCycles)
      ? data.therapyCycles.map((cycle) => ({
          ...cycle,
          id: (cycle && cycle.id) || uuid(),
          startDate: normalizeSessionDate(cycle && cycle.startDate),
          endDate: cycle && cycle.endDate ? normalizeSessionDate(cycle.endDate) : null,
          cycleNumber: normalizePositiveInteger(cycle && cycle.cycleNumber, 1),
        }))
      : [],
    // [{id, startDate, endDate}]
    vacationPeriods:    Array.isArray(data.vacationPeriods)
      ? data.vacationPeriods.map((period) => ({
          ...period,
          id: (period && period.id) || uuid(),
          startDate: normalizeSessionDate(period && period.startDate),
          endDate: normalizeSessionDate(period && period.endDate),
        }))
      : [],
    // [{id, title, status, dateSet, dateAchieved, notes}]
    therapeuticGoals:   Array.isArray(data.therapeuticGoals)
      ? data.therapeuticGoals.map((goal) => ({
          ...goal,
          id: (goal && goal.id) || uuid(),
          title: normalizeClinicalField(goal && goal.title),
          status: (goal && goal.status) || 'inProgress',
          dateSet: goal && goal.dateSet ? normalizeSessionDate(goal.dateSet) : new Date().toISOString(),
          dateAchieved: goal && goal.dateAchieved ? normalizeSessionDate(goal.dateAchieved) : null,
          notes: normalizeClinicalField(goal && goal.notes),
        }))
      : [],
    // [{id, date, category, title, content}]
    progressEntries:    Array.isArray(data.progressEntries)
      ? data.progressEntries.map((entry) => ({
          ...entry,
          id: (entry && entry.id) || uuid(),
          date: entry && entry.date ? normalizeSessionDate(entry.date) : new Date().toISOString(),
          category: (entry && entry.category) || '',
          title: normalizeClinicalField(entry && entry.title),
          content: normalizeClinicalField(entry && entry.content),
        }))
      : [],
    // [{id, date, content, sessionId}]
    sessionNotes:       Array.isArray(data.sessionNotes)
      ? data.sessionNotes.map((note) => ({
          ...note,
          id: (note && note.id) || uuid(),
          date: note && note.date ? normalizeSessionDate(note.date) : new Date().toISOString(),
          content: normalizeClinicalField(note && (note.content !== undefined ? note.content : note.note)),
          sessionId: (note && note.sessionId) || null,
        }))
      : [],
    invoices:           Array.isArray(data.invoices)           ? data.invoices           : [],
  };
}

/**
 * Creates a Session object with defaults merged from data.
 * @param {Partial<Session>} data
 * @returns {Session}
 */
function createSession(data = {}) {
  const patient = data.patientId ? getPatient(data.patientId) : null;
  const paymentAmount = normalizeNullableNumber(
    data.paymentAmount !== undefined ? data.paymentAmount : (
      data.fee !== undefined ? data.fee : (
        patient ? patient.sessionRate : null
      )
    )
  );

  return {
    ...data,
    id:                   data.id                   || uuid(),
    date:                 normalizeSessionDate(data.date, data.time),
    patientId:            data.patientId            || null,
    // scheduled | completed | cancelled
    status:               data.status               || 'scheduled',
    isPaymentRequired:    data.isPaymentRequired    !== false,
    isPaid:               data.isPaid               || false,
    paymentMethod:        data.paymentMethod        || null,
    paymentDate:          data.paymentDate          || null,
    paymentAmount:        paymentAmount,
    paymentId:            data.paymentId            || null,
    isManuallyCreated:    data.isManuallyCreated    || false,
    sessionNumber:        data.sessionNumber        || null,
    globalSessionNumber:  data.globalSessionNumber  || null,
    cycleSessionNumber:   data.cycleSessionNumber   || null,
    wasRescheduled:       data.wasRescheduled       || false,
    originalDate:         data.originalDate         || null,
    // encrypted text
    sessionNotes:         normalizeClinicalField(
      data.sessionNotes !== undefined ? data.sessionNotes : (data.note || '')
    ),
  };
}

/**
 * Creates a Payment object with defaults merged from data.
 * @param {Partial<Payment>} data
 * @returns {Payment}
 */
function createPayment(data = {}) {
  return {
    ...data,
    id:            data.id            || uuid(),
    patientId:     data.patientId     || null,
    date:          data.date ? normalizeSessionDate(data.date) : new Date().toISOString(),
    amount:        normalizeNullableNumber(data.amount) ?? 0,
    // aliorBank | ingBank | cash
    method:        data.method        || 'cash',
    sessionsCount: normalizePositiveInteger(data.sessionsCount, 0),
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
    ...data,
    id:        data.id        || uuid(),
    startDate: normalizeSessionDate(data.startDate),
    endDate:   normalizeSessionDate(data.endDate),
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
    ...data,
    therapistName:        data.therapistName        || '',
    therapistAddress:     data.therapistAddress     || '',
    therapistNIP:         data.therapistNIP         || '',
    workingHoursStart:    data.workingHoursStart    || '08:00',
    workingHoursEnd:      data.workingHoursEnd      || '20:00',
    // seconds of inactivity before app locks
    autoLockTimeout:      data.autoLockTimeout      !== undefined ? data.autoLockTimeout : 120,
    // ISO string of the last month that was auto-generated e.g. "2026-03"
    lastGeneratedMonth:   data.lastGeneratedMonth   || null,
    clinicalSecurity:     createClinicalSecuritySettings(data.clinicalSecurity || {}),
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

function getSessionById(id) {
  return AppState.sessions.find((session) => session.id === id);
}

function getSessionAmount(session, patient = null) {
  if (!session) return 0;
  const resolvedPatient = patient || getPatient(session.patientId);
  const amount = normalizeNullableNumber(session.paymentAmount);
  if (amount !== null) return amount;
  return resolvedPatient ? resolvedPatient.sessionRate : 0;
}

function clearSessionPaymentState(session) {
  if (!session) return;
  session.isPaid = false;
  session.paymentId = null;
  session.paymentMethod = null;
  session.paymentDate = null;
}

function attachPaymentToSession(session, paymentRecord) {
  if (!session || !paymentRecord) return;
  session.paymentAmount = getSessionAmount(session);
  session.isPaid = true;
  session.paymentId = paymentRecord.id;
  session.paymentMethod = paymentRecord.method || null;
  session.paymentDate = paymentRecord.date || null;
}

function getPaymentById(id) {
  return AppState.payments.find((payment) => payment.id === id);
}

function calculatePaymentTotal(sessionIds) {
  return sessionIds.reduce((sum, sessionId) => {
    const session = getSessionById(sessionId);
    return sum + getSessionAmount(session);
  }, 0);
}

function detachPaymentFromSessions(paymentId, options = {}) {
  const { removeRecord = true } = options;
  const paymentRecord = getPaymentById(paymentId);
  if (!paymentRecord) return null;

  (paymentRecord.sessionIds || []).forEach((sessionId) => {
    clearSessionPaymentState(getSessionById(sessionId));
  });

  if (removeRecord) {
    AppState.payments = AppState.payments.filter((payment) => payment.id !== paymentId);
  }

  return paymentRecord;
}

function recordPaymentForSessions(data = {}) {
  const uniqueSessionIds = Array.from(new Set(Array.isArray(data.sessionIds) ? data.sessionIds : []));
  if (uniqueSessionIds.length === 0) {
    throw new Error('Payment record requires at least one session.');
  }

  const sessions = uniqueSessionIds.map(getSessionById).filter(Boolean);
  if (sessions.length !== uniqueSessionIds.length) {
    throw new Error('Some sessions selected for payment no longer exist.');
  }

  const patientId = data.patientId || sessions[0].patientId || null;
  const mixedPatients = sessions.some((session) => session.patientId !== patientId);
  if (mixedPatients) {
    throw new Error('A single payment record cannot span multiple patients.');
  }

  const previousRecord = data.id ? getPaymentById(data.id) : null;
  if (previousRecord) {
    detachPaymentFromSessions(previousRecord.id, { removeRecord: false });
  }

  sessions.forEach((session) => {
    session.paymentAmount = getSessionAmount(session);
  });

  const paymentDate = data.date ? normalizeSessionDate(data.date) : new Date().toISOString();
  const paymentMethod = data.method || 'cash';
  const paymentTotal = calculatePaymentTotal(uniqueSessionIds);

  let paymentRecord = previousRecord;
  if (!paymentRecord) {
    paymentRecord = createPayment({
      patientId,
      date: paymentDate,
      amount: paymentTotal,
      method: paymentMethod,
      sessionIds: uniqueSessionIds,
      sessionsCount: uniqueSessionIds.length,
      note: data.note || '',
    });
    AppState.payments.push(paymentRecord);
  } else {
    paymentRecord.patientId = patientId;
    paymentRecord.date = paymentDate;
    paymentRecord.amount = paymentTotal;
    paymentRecord.method = paymentMethod;
    paymentRecord.sessionIds = uniqueSessionIds;
    paymentRecord.sessionsCount = uniqueSessionIds.length;
    paymentRecord.note = data.note || '';
  }

  sessions.forEach((session) => attachPaymentToSession(session, paymentRecord));
  return paymentRecord;
}

function rebuildPaymentLinks() {
  AppState.sessions.forEach((session) => {
    if (!session.isPaymentRequired) {
      clearSessionPaymentState(session);
      return;
    }

    // Czyscimy tylko sesje ktore maja paymentId — to Payment record je odbuduje.
    // Sesje z isPaid=true ale BEZ paymentId (edge case po czesciowej migracji)
    // nie sa czyszczone, zeby nie stracic statusu platnosci.
    if (session.paymentId || session.paymentMethod || session.paymentDate) {
      clearSessionPaymentState(session);
    }
  });

  AppState.payments.forEach((paymentRecord) => {
    const sessionIds = Array.from(new Set(Array.isArray(paymentRecord.sessionIds) ? paymentRecord.sessionIds : []));
    paymentRecord.sessionIds = sessionIds;
    paymentRecord.sessionsCount = sessionIds.length;
    paymentRecord.amount = calculatePaymentTotal(sessionIds);

    sessionIds.forEach((sessionId) => {
      const session = getSessionById(sessionId);
      if (session) attachPaymentToSession(session, paymentRecord);
    });
  });
}

function migrateLegacyPaidSessionsToPayments() {
  AppState.sessions.forEach((session) => {
    if (!session.isPaid || !session.isPaymentRequired) return;
    if (session.paymentId && getPaymentById(session.paymentId)) return;

    const paymentRecord = createPayment({
      id: session.paymentId || uuid(),
      patientId: session.patientId,
      date: session.paymentDate || session.date,
      amount: getSessionAmount(session),
      method: session.paymentMethod || 'cash',
      sessionIds: [session.id],
      sessionsCount: 1,
      note: '',
    });

    AppState.payments.push(paymentRecord);
  });
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

  const unpaid = AppState.sessions.filter(s => {
    if (s.patientId !== patientId) return false;
    if (s.isPaid)                   return false;
    if (!s.isPaymentRequired)       return false;
    return s.status === SESSION_STATUS.completed ||
           s.status === SESSION_STATUS.cancelled;
  });

  const total = unpaid.reduce((sum, s) => {
    return sum + getSessionAmount(s, patient);
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
 * Uses a lazily-built index for O(1) lookups when called multiple times
 * per render cycle (e.g. monthly calendar → 30+ calls).
 *
 * Call `invalidateSessionDateIndex()` after mutating AppState.sessions.
 *
 * @param {string} dateStr — e.g. "2026-03-03"
 * @returns {Session[]}
 */
let _sessionDateIndex = null;
let _sessionDateIndexGen = -1;

function _getSessionDateKey(isoDate) {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _buildSessionDateIndex() {
  const gen = AppState.sessions.length;
  if (_sessionDateIndex && _sessionDateIndexGen === gen) return _sessionDateIndex;
  const idx = new Map();
  for (const s of AppState.sessions) {
    const key = _getSessionDateKey(s.date);
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(s);
  }
  _sessionDateIndex = idx;
  _sessionDateIndexGen = gen;
  return idx;
}

function invalidateSessionDateIndex() {
  _sessionDateIndex = null;
  _sessionDateIndexGen = -1;
}

function getSessionsByDate(dateStr) {
  const idx = _buildSessionDateIndex();
  return idx.get(dateStr) || [];
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

  // Pre-build Set of existing session timestamps for this patient (O(n) zamiast O(n^2))
  const existingTimestamps = new Set();
  for (const s of AppState.sessions) {
    if (s.patientId === patient.id) {
      // Zaokraglij do minuty (60s) — zgodnie z oryginalnym 1-min window
      existingTimestamps.add(Math.floor(new Date(s.date).getTime() / 60000));
    }
  }

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

      // Check for existing session using pre-built index
      const tsKey = Math.floor(sessionDate.getTime() / 60000);
      if (existingTimestamps.has(tsKey)) continue;

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
async function serializeAppData() {
  const data = {
    version:         3,
    exportedAt:      new Date().toISOString(),
    patients:        AppState.patients,
    sessions:        AppState.sessions,
    payments:        AppState.payments,
    blockedPeriods:  AppState.blockedPeriods,
    settings:        AppState.settings,
    generatedMonths: AppState.generatedMonths || [],
  };

  if (typeof SecurityService === 'undefined') {
    return JSON.stringify(data);
  }

  const protectedData = await SecurityService.prepareDataForStorage(data);
  return JSON.stringify(protectedData);
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

  AppState.migrationIssues = [];
  AppState.patients        = (data.patients       || []).map(createPatient);
  AppState.sessions        = (data.sessions       || []).map(createSession);
  AppState.payments        = (data.payments       || []).map(createPayment);
  AppState.blockedPeriods  = (data.blockedPeriods || []).map(createBlockedPeriod);
  AppState.settings        = createAppSettings(data.settings || {});
  AppState.generatedMonths = Array.isArray(data.generatedMonths) ? data.generatedMonths : [];

  migrateLegacyPaidSessionsToPayments();
  rebuildPaymentLinks();

  AppState.sessions.forEach((session) => {
    if (session.paymentAmount === null && session.patientId) {
      AppState.migrationIssues.push({
        type: 'missing-session-amount',
        sessionId: session.id,
        patientId: session.patientId,
      });
    }
  });

  if (AppState.migrationIssues.length > 0) {
    console.warn('[Data] Migration completed with unresolved issues:', AppState.migrationIssues);
    if (typeof toast === 'function') {
      toast('Migracja danych: ' + AppState.migrationIssues.length + ' element(ow) wymaga uwagi. Sprawdz ustawienia.', 'warning', 6000);
    }
  }

  if (typeof SecurityService !== 'undefined') {
    SecurityService.bootstrapFromLoadedState();
  }
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
  AppState.migrationIssues = [];

  if (typeof SecurityService !== 'undefined') {
    SecurityService.bootstrapFromLoadedState();
  }
}
