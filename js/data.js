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
    (!value.alg || typeof value.alg === 'string') &&
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
    version: normalizePositiveInteger(data.version, 1),
    salt: typeof data.salt === 'string' ? data.salt : '',
    verification: isEncryptedClinicalEnvelope(data.verification) ? data.verification : null,
    kdfIterations: normalizePositiveInteger(data.kdfIterations, 210000),
    kdfHash: typeof data.kdfHash === 'string' && data.kdfHash ? data.kdfHash : 'SHA-256',
    updatedAt: data.updatedAt || null,
  };
}

const PAYMENT_METHOD_SLOT_IDS = ['pm1', 'pm2', 'pm3', 'pm4'];
const LEGACY_PAYMENT_METHOD_TO_SLOT = {
  aliorBank: 'pm1',
  ingBank: 'pm2',
  cash: 'pm3',
};
const DEFAULT_PAYMENT_METHOD_LABELS = {
  pm1: 'Alior Bank',
  pm2: 'ING Bank',
  pm3: 'Gotowka',
  pm4: '',
};
const PAYMENT_METHOD_MIGRATION_FALLBACK_LABEL = 'Metoda archiwalna';

function normalizeDateKey(dateValue, fallback) {
  const fallbackKey = typeof fallback === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fallback)
    ? fallback
    : new Date().toISOString().slice(0, 10);

  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
    return dateValue.trim();
  }

  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return fallbackKey;

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeOptionalDateKey(dateValue) {
  if (dateValue === undefined || dateValue === null || dateValue === '') return null;

  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
    return dateValue.trim();
  }

  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizePaymentMethodId(methodId) {
  if (typeof methodId !== 'string' || !methodId) return null;
  if (Object.prototype.hasOwnProperty.call(LEGACY_PAYMENT_METHOD_TO_SLOT, methodId)) {
    return LEGACY_PAYMENT_METHOD_TO_SLOT[methodId];
  }
  return PAYMENT_METHOD_SLOT_IDS.includes(methodId) ? methodId : null;
}

function isPaymentMethodSlotId(methodId) {
  return PAYMENT_METHOD_SLOT_IDS.includes(normalizePaymentMethodId(methodId));
}

function normalizePaymentMethodLabel(label) {
  return String(label || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasLetterOrDigit(value) {
  return /[\p{L}\p{N}]/u.test(String(value || ''));
}

function isValidPaymentMethodLabel(label) {
  const normalized = normalizePaymentMethodLabel(label);
  if (!normalized) return false;
  return hasLetterOrDigit(normalized);
}

function createPaymentMethodHistoryEntry(data = {}) {
  const methodId = normalizePaymentMethodId(data.methodId);
  if (!methodId) return null;
  return {
    id: data.id || uuid(),
    methodId,
    label: normalizePaymentMethodLabel(data.label),
    validFrom: normalizeDateKey(data.validFrom, '2000-01-01'),
    archivedAt: normalizeOptionalDateKey(data.archivedAt),
  };
}

function createPaymentMethodSettings(data = {}) {
  const slotIds = Array.isArray(data.slotIds) && data.slotIds.length
    ? data.slotIds.map(normalizePaymentMethodId).filter(isPaymentMethodSlotId)
    : PAYMENT_METHOD_SLOT_IDS.slice();
  const history = Array.isArray(data.history)
    ? data.history.map(createPaymentMethodHistoryEntry)
      .filter(Boolean)
    : [];

  return {
    slotIds: slotIds.length ? Array.from(new Set(slotIds)) : PAYMENT_METHOD_SLOT_IDS.slice(),
    history,
  };
}

function getPaymentMethodSettings() {
  const settings = AppState.settings || {};
  const paymentMethods = settings.paymentMethods;
  if (paymentMethods && typeof paymentMethods === 'object') {
    return paymentMethods;
  }
  return createPaymentMethodSettings({});
}

function getPaymentMethodSlotIds() {
  const settings = getPaymentMethodSettings();
  const slotIds = Array.isArray(settings.slotIds) ? settings.slotIds : [];
  const normalized = slotIds.map(normalizePaymentMethodId).filter(isPaymentMethodSlotId);
  return normalized.length ? Array.from(new Set(normalized)) : PAYMENT_METHOD_SLOT_IDS.slice();
}

function getPaymentMethodHistory(methodId) {
  const normalizedMethodId = normalizePaymentMethodId(methodId);
  if (!normalizedMethodId) return [];

  return getPaymentMethodSettings().history
    .filter((entry) => normalizePaymentMethodId(entry.methodId) === normalizedMethodId)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
}

function getPaymentMethodHistoryEntryForDate(methodId, referenceDate) {
  const normalizedMethodId = normalizePaymentMethodId(methodId);
  if (!normalizedMethodId) return null;

  const dateKey = normalizeDateKey(referenceDate, new Date().toISOString().slice(0, 10));
  const matches = getPaymentMethodHistory(normalizedMethodId).filter((entry) => {
    if (entry.validFrom > dateKey) return false;
    if (entry.archivedAt && entry.archivedAt <= dateKey) return false;
    return true;
  });

  if (!matches.length) return null;
  return matches.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] || null;
}

function getPaymentMethodLabelForDate(methodId, referenceDate) {
  const entry = getPaymentMethodHistoryEntryForDate(methodId, referenceDate);
  return entry && entry.label ? entry.label : null;
}

function getCurrentPaymentMethodLabel(methodId) {
  return getPaymentMethodLabelForDate(methodId, new Date());
}

function isPaymentMethodActive(methodId, referenceDate = new Date()) {
  return !!getPaymentMethodLabelForDate(methodId, referenceDate);
}

function getActivePaymentMethodOptions(referenceDate = new Date()) {
  return getPaymentMethodSlotIds()
    .map((methodId) => ({
      id: methodId,
      label: getPaymentMethodLabelForDate(methodId, referenceDate),
    }))
    .filter((option) => isValidPaymentMethodLabel(option.label));
}

function getAllUsedPaymentMethodOptions(referenceDate = new Date()) {
  return getPaymentMethodSlotIds()
    .map((methodId) => ({
      id: methodId,
      currentLabel: getCurrentPaymentMethodLabel(methodId),
      historicalLabel: getPaymentMethodLabelForDate(methodId, referenceDate),
      isActive: isPaymentMethodActive(methodId, referenceDate),
    }))
    .filter((option) => option.currentLabel || option.historicalLabel);
}

function getPaymentMethodRecentHistory(methodId, limit = 3) {
  return getPaymentMethodHistory(methodId)
    .filter((entry) => entry.label && !!entry.archivedAt)
    .slice(0, limit);
}

function getPaymentMethodCurrentEntry(methodId, referenceDate = new Date()) {
  return getPaymentMethodHistoryEntryForDate(methodId, referenceDate);
}

function getPaymentMethodCurrentLabel(methodId, referenceDate = new Date()) {
  const entry = getPaymentMethodCurrentEntry(methodId, referenceDate);
  return entry && entry.label ? entry.label : '';
}

function getPaymentMethodDefaultLabel(methodId) {
  const normalizedMethodId = normalizePaymentMethodId(methodId);
  return normalizedMethodId ? (DEFAULT_PAYMENT_METHOD_LABELS[normalizedMethodId] || '') : '';
}

function findPaymentMethodLabelConflict(label, options = {}) {
  const normalizedLabel = normalizePaymentMethodLabel(label);
  if (!normalizedLabel) return null;

  const excludeEntryId = options.excludeEntryId || null;
  const normalizedNeedle = normalizedLabel.toLocaleLowerCase('pl-PL');

  return getPaymentMethodSettings().history.find((entry) => {
    if (excludeEntryId && entry.id === excludeEntryId) return false;
    return normalizePaymentMethodLabel(entry.label).toLocaleLowerCase('pl-PL') === normalizedNeedle;
  }) || null;
}

function hasPaymentMethodLabelConflict(label, options = {}) {
  return !!findPaymentMethodLabelConflict(label, options);
}

function getPaymentMethodFallbackLabel() {
  return PAYMENT_METHOD_MIGRATION_FALLBACK_LABEL;
}

function getResolvedPaymentMethodLabelForDate(methodId, referenceDate) {
  return getPaymentMethodLabelForDate(methodId, referenceDate) || getPaymentMethodFallbackLabel();
}

function validatePaymentMethodDrafts(rawDrafts = {}, referenceDate = new Date()) {
  const dateKey = normalizeDateKey(referenceDate, new Date().toISOString().slice(0, 10));
  const slotIds = getPaymentMethodSlotIds();
  const errors = {};
  const normalizedDrafts = {};
  const draftNameOwners = new Map();

  slotIds.forEach((methodId) => {
    const rawValue = Object.prototype.hasOwnProperty.call(rawDrafts, methodId)
      ? rawDrafts[methodId]
      : getPaymentMethodCurrentLabel(methodId, dateKey);
    const stringValue = rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const normalizedLabel = normalizePaymentMethodLabel(stringValue);
    const currentEntry = getPaymentMethodCurrentEntry(methodId, dateKey);
    const currentLabel = currentEntry && currentEntry.label ? currentEntry.label : '';
    const currentKey = normalizePaymentMethodLabel(currentLabel).toLocaleLowerCase('pl-PL');

    normalizedDrafts[methodId] = normalizedLabel;

    if (!normalizedLabel) {
      if (stringValue.length > 0) {
        errors[methodId] = 'Wpisz nazwe albo zostaw pole calkiem puste.';
      }
      return;
    }

    if (!hasLetterOrDigit(normalizedLabel)) {
      errors[methodId] = 'Nazwa musi zawierac litery lub cyfry.';
      return;
    }

    const draftKey = normalizedLabel.toLocaleLowerCase('pl-PL');
    const existingDraftOwner = draftNameOwners.get(draftKey);
    if (existingDraftOwner && existingDraftOwner !== methodId) {
      errors[methodId] = 'Ta nazwa jest juz uzyta w innym polu.';
      if (!errors[existingDraftOwner]) {
        errors[existingDraftOwner] = 'Ta nazwa jest juz uzyta w innym polu.';
      }
      return;
    }
    draftNameOwners.set(draftKey, methodId);

    const conflict = findPaymentMethodLabelConflict(normalizedLabel, {
      excludeEntryId: currentEntry ? currentEntry.id : null,
    });
    if (conflict && draftKey !== currentKey) {
      errors[methodId] = 'Ta nazwa byla juz uzyta. Uzyj innej, np. z numerem.';
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalizedDrafts,
    referenceDate: dateKey,
  };
}

function applyPaymentMethodDrafts(rawDrafts = {}, referenceDate = new Date()) {
  const validation = validatePaymentMethodDrafts(rawDrafts, referenceDate);
  if (!validation.isValid) {
    const firstErrorKey = Object.keys(validation.errors)[0];
    throw new Error(validation.errors[firstErrorKey] || 'Nieprawidlowe metody platnosci.');
  }

  const dateKey = validation.referenceDate;
  const settings = AppState.settings || {};
  settings.paymentMethods = createPaymentMethodSettings(settings.paymentMethods || {});
  AppState.settings = settings;

  const history = settings.paymentMethods.history;
  const summary = [];

  getPaymentMethodSlotIds().forEach((methodId) => {
    const nextLabel = validation.normalizedDrafts[methodId] || '';
    const currentEntry = getPaymentMethodCurrentEntry(methodId, dateKey);
    const currentLabel = currentEntry && currentEntry.label ? currentEntry.label : '';

    if (nextLabel === currentLabel) return;

    if (!nextLabel) {
      if (!currentEntry) return;

      if (currentEntry.validFrom === dateKey) {
        const index = history.findIndex((entry) => entry.id === currentEntry.id);
        if (index !== -1) history.splice(index, 1);
      } else {
        currentEntry.archivedAt = dateKey;
      }

      summary.push({
        methodId,
        action: 'deactivate',
        previousLabel: currentLabel,
        nextLabel: '',
      });
      return;
    }

    if (currentEntry && currentEntry.validFrom === dateKey) {
      currentEntry.label = nextLabel;
      currentEntry.archivedAt = null;
      summary.push({
        methodId,
        action: currentLabel ? 'rename' : 'activate',
        previousLabel: currentLabel,
        nextLabel,
      });
      return;
    }

    if (currentEntry) {
      currentEntry.archivedAt = dateKey;
    }

    history.push(createPaymentMethodHistoryEntry({
      methodId,
      label: nextLabel,
      validFrom: dateKey,
      archivedAt: null,
    }));

    summary.push({
      methodId,
      action: currentLabel ? 'rename' : 'activate',
      previousLabel: currentLabel,
      nextLabel,
    });
  });

  settings.paymentMethods.history = history
    .filter(Boolean)
    .sort((a, b) => {
      if (a.methodId === b.methodId) return b.validFrom.localeCompare(a.validFrom);
      return a.methodId.localeCompare(b.methodId);
    });

  return {
    date: dateKey,
    summary,
  };
}

function getPaymentMethodSettingsSnapshot(referenceDate = new Date()) {
  const dateKey = normalizeDateKey(referenceDate, new Date().toISOString().slice(0, 10));
  return getPaymentMethodSlotIds().map((methodId) => ({
    id: methodId,
    currentLabel: getPaymentMethodCurrentLabel(methodId, dateKey),
    history: getPaymentMethodRecentHistory(methodId, 3),
    isActive: isPaymentMethodActive(methodId, dateKey),
  }));
}

function parseStoredPaymentMethod(rawMethod, explicitSplitMethod) {
  const primaryRaw = typeof rawMethod === 'string' && rawMethod ? rawMethod : null;
  const hasCompound = isCompoundMethod(primaryRaw);
  const parts = hasCompound ? primaryRaw.split('+') : [primaryRaw];
  const primary = parts[0] || null;
  const secondary = explicitSplitMethod || parts[1] || null;

  return {
    primaryRaw: primary,
    secondaryRaw: secondary,
    primaryId: normalizePaymentMethodId(primary),
    secondaryId: normalizePaymentMethodId(secondary),
  };
}

function collectInvalidPaymentMethodHistoryEntries(rawHistory = []) {
  if (!Array.isArray(rawHistory)) return;

  rawHistory.forEach((entry, index) => {
    const rawMethodId = entry && typeof entry === 'object' ? entry.methodId : null;
    if (normalizePaymentMethodId(rawMethodId)) return;

    registerMigrationIssue({
      type: 'invalid-payment-method-history-entry',
      historyIndex: index,
      rawMethodId,
      fallbackLabel: getPaymentMethodFallbackLabel(),
    });
  });
}

function registerMigrationIssue(issue) {
  if (!issue || typeof issue !== 'object' || !issue.type) return;
  const key = JSON.stringify(issue);
  const exists = AppState.migrationIssues.some((entry) => JSON.stringify(entry) === key);
  if (!exists) AppState.migrationIssues.push(issue);
}

function getEarliestPaymentMethodReferenceDate() {
  const dates = [];

  (AppState.payments || []).forEach((payment) => {
    if (payment && payment.date) dates.push(normalizeOptionalDateKey(payment.date));
  });

  (AppState.sessions || []).forEach((session) => {
    if (session && session.paymentDate) {
      dates.push(normalizeOptionalDateKey(session.paymentDate));
      return;
    }
    if (session && session.paymentMethod && session.date) {
      dates.push(normalizeOptionalDateKey(session.date));
    }
  });

  const filtered = dates.filter(Boolean).sort();
  return filtered[0] || '2000-01-01';
}

function getUsedCanonicalPaymentMethodIds() {
  const used = new Set();

  (AppState.payments || []).forEach((payment) => {
    const primaryId = normalizePaymentMethodId(payment.methodId) || parseStoredPaymentMethod(payment.method, payment.splitMethod).primaryId;
    const secondaryId = normalizePaymentMethodId(payment.splitMethodId) || parseStoredPaymentMethod(payment.method, payment.splitMethod).secondaryId;
    if (primaryId) used.add(primaryId);
    if (payment.isSplit && secondaryId) used.add(secondaryId);
  });

  (AppState.sessions || []).forEach((session) => {
    if (!session.paymentMethod) return;
    const parsed = parseStoredPaymentMethod(session.paymentMethod, null);
    if (parsed.primaryId) used.add(parsed.primaryId);
    if (parsed.secondaryId) used.add(parsed.secondaryId);
  });

  return Array.from(used);
}

function seedPaymentMethodHistoryFromExistingData() {
  const settings = AppState.settings || {};
  settings.paymentMethods = createPaymentMethodSettings(settings.paymentMethods || {});
  AppState.settings = settings;

  const history = settings.paymentMethods.history;
  const earliestDate = getEarliestPaymentMethodReferenceDate();
  const usedMethodIds = getUsedCanonicalPaymentMethodIds();

  usedMethodIds.forEach((methodId) => {
    const alreadyExists = history.some((entry) => entry.methodId === methodId && !!entry.label);
    if (alreadyExists) return;

    const label = getPaymentMethodDefaultLabel(methodId);
    if (!label) return;

    history.push(createPaymentMethodHistoryEntry({
      methodId,
      label,
      validFrom: earliestDate,
      archivedAt: null,
    }));
  });
}

function migratePaymentMethodReferences() {
  (AppState.payments || []).forEach((payment) => {
    const parsed = parseStoredPaymentMethod(payment.method, payment.splitMethod);
    payment.methodId = parsed.primaryId;
    payment.splitMethodId = payment.isSplit ? parsed.secondaryId : null;

    if (!parsed.primaryId) {
      registerMigrationIssue({
        type: 'unknown-payment-method',
        paymentId: payment.id,
        rawMethod: parsed.primaryRaw,
      });
    }

    if (payment.isSplit && !parsed.secondaryId) {
      registerMigrationIssue({
        type: 'unknown-split-payment-method',
        paymentId: payment.id,
        rawMethod: parsed.secondaryRaw,
      });
    }
  });

  (AppState.sessions || []).forEach((session) => {
    if (!session.paymentMethod) return;
    const parsed = parseStoredPaymentMethod(session.paymentMethod, null);

    if (!parsed.primaryId) {
      registerMigrationIssue({
        type: 'unknown-session-payment-method',
        sessionId: session.id,
        rawMethod: parsed.primaryRaw,
      });
    }

    if (parsed.secondaryRaw && !parsed.secondaryId) {
      registerMigrationIssue({
        type: 'unknown-session-split-payment-method',
        sessionId: session.id,
        rawMethod: parsed.secondaryRaw,
      });
    }
  });
}

function validatePaymentMethodHistoryCoverage() {
  (AppState.payments || []).forEach((payment) => {
    const parsed = parseStoredPaymentMethod(payment.method, payment.splitMethod);
    const primaryId = normalizePaymentMethodId(payment.methodId) || parsed.primaryId;
    const secondaryId = normalizePaymentMethodId(payment.splitMethodId) || parsed.secondaryId;
    const paymentDate = payment.date || new Date().toISOString();

    if (primaryId && !getPaymentMethodLabelForDate(primaryId, paymentDate)) {
      registerMigrationIssue({
        type: 'missing-payment-method-history',
        paymentId: payment.id,
        methodId: primaryId,
        date: normalizeOptionalDateKey(paymentDate),
        fallbackLabel: getPaymentMethodFallbackLabel(),
      });
    }

    if (payment.isSplit && secondaryId && !getPaymentMethodLabelForDate(secondaryId, paymentDate)) {
      registerMigrationIssue({
        type: 'missing-split-payment-method-history',
        paymentId: payment.id,
        methodId: secondaryId,
        date: normalizeOptionalDateKey(paymentDate),
        fallbackLabel: getPaymentMethodFallbackLabel(),
      });
    }
  });

  (AppState.sessions || []).forEach((session) => {
    if (!session.paymentMethod) return;
    const parsed = parseStoredPaymentMethod(session.paymentMethod, null);
    const sessionDate = session.paymentDate || session.date || new Date().toISOString();

    if (parsed.primaryId && !getPaymentMethodLabelForDate(parsed.primaryId, sessionDate)) {
      registerMigrationIssue({
        type: 'missing-session-payment-method-history',
        sessionId: session.id,
        methodId: parsed.primaryId,
        date: normalizeOptionalDateKey(sessionDate),
        fallbackLabel: getPaymentMethodFallbackLabel(),
      });
    }

    if (parsed.secondaryId && !getPaymentMethodLabelForDate(parsed.secondaryId, sessionDate)) {
      registerMigrationIssue({
        type: 'missing-session-split-payment-method-history',
        sessionId: session.id,
        methodId: parsed.secondaryId,
        date: normalizeOptionalDateKey(sessionDate),
        fallbackLabel: getPaymentMethodFallbackLabel(),
      });
    }
  });
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
    // [{id, startDate, endDate, sessionsCount}]
    previousTherapies:  Array.isArray(data.previousTherapies)  ? data.previousTherapies  : [],
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
    data.paymentAmount !== undefined && data.paymentAmount !== null && data.paymentAmount !== '' ? data.paymentAmount : (
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
    // null | 'patient_vacation' | 'patient_late' | 'therapist'
    cancellationReason:   data.cancellationReason   || null,
    // partial payment support
    isPartiallyPaid:      data.isPartiallyPaid      || false,
    partialPaymentAmount: normalizeNullableNumber(data.partialPaymentAmount),
  };
}

/**
 * Creates a Payment object with defaults merged from data.
 * @param {Partial<Payment>} data
 * @returns {Payment}
 */
function createPayment(data = {}) {
  const isSplit = data.isSplit === true;
  const method = typeof data.method === 'string' && data.method ? data.method : 'cash';
  const splitMethod = isSplit ? (typeof data.splitMethod === 'string' && data.splitMethod ? data.splitMethod : 'cash') : null;
  const methodId = normalizePaymentMethodId(data.methodId || method);
  const splitMethodId = isSplit ? normalizePaymentMethodId(data.splitMethodId || splitMethod) : null;
  return {
    ...data,
    id:            data.id            || uuid(),
    patientId:     data.patientId     || null,
    date:          data.date ? normalizeSessionDate(data.date) : new Date().toISOString(),
    amount:        normalizeNullableNumber(data.amount) ?? 0,
    // aliorBank | ingBank | cash
    method,
    methodId,
    // Split payment fields
    isSplit:       isSplit,
    splitMethod,   // second method when isSplit=true
    splitMethodId,
    splitAmounts:  isSplit && data.splitAmounts
      ? {
          primary: normalizeNullableNumber(data.splitAmounts.primary) ?? 0,
          secondary: normalizeNullableNumber(data.splitAmounts.secondary) ?? 0,
        }
      : null,  // {primary: number, secondary: number}
    sessionsCount: normalizePositiveInteger(data.sessionsCount, 0),
    sessionIds:    Array.isArray(data.sessionIds) ? data.sessionIds : [],
    note:          data.note          || '',
    createdAt:     data.createdAt     || new Date().toISOString(),
  };
}

/**
 * Returns true if a paymentMethod string represents a split (compound) payment.
 * e.g. 'aliorBank+cash' → true, 'cash' → false
 */
function isCompoundMethod(str) {
  return typeof str === 'string' && str.indexOf('+') !== -1;
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
    therapistName:      typeof data.therapistName === 'string' ? data.therapistName : '',
    therapistAddress:   typeof data.therapistAddress === 'string' ? data.therapistAddress : '',
    therapistNIP:       typeof data.therapistNIP === 'string' ? data.therapistNIP : '',
    workingHoursStart:  typeof data.workingHoursStart === 'string' && data.workingHoursStart
      ? data.workingHoursStart
      : '08:00',
    workingHoursEnd:    typeof data.workingHoursEnd === 'string' && data.workingHoursEnd
      ? data.workingHoursEnd
      : '20:00',
    // seconds of inactivity before app locks
    autoLockTimeout:    data.autoLockTimeout !== undefined ? data.autoLockTimeout : 120,
    // ISO string of the last month that was auto-generated e.g. "2026-03"
    lastGeneratedMonth: data.lastGeneratedMonth || null,
    clinicalSecurity:   createClinicalSecuritySettings(data.clinicalSecurity || {}),
    paymentMethods:     createPaymentMethodSettings(data.paymentMethods || {}),
  };
}

// -----------------------------------------------------------------------------
// LOOKUP CONSTANTS
// -----------------------------------------------------------------------------

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

function getPaymentById(id) {
  return AppState.payments.find((payment) => payment.id === id);
}

function clearSessionPaymentState(session) {
  if (!session) return;
  session.isPaid = false;
  session.isPartiallyPaid = false;
  session.partialPaymentAmount = null;
  session.paymentId = null;
  session.paymentMethod = null;
  session.paymentDate = null;
}

function getPaymentTotalForSessions(sessionIds = []) {
  return sessionIds.reduce((sum, sessionId) => {
    const session = getSessionById(sessionId);
    return sum + getSessionAmount(session);
  }, 0);
}

function savePaymentRecord(data = {}) {
  const uniqueSessionIds = Array.from(new Set(Array.isArray(data.sessionIds) ? data.sessionIds : []));
  if (uniqueSessionIds.length === 0) {
    throw new Error('Platnosc musi obejmowac przynajmniej jedna sesje.');
  }

  const sessions = uniqueSessionIds.map(getSessionById).filter(Boolean);
  if (sessions.length !== uniqueSessionIds.length) {
    throw new Error('Co najmniej jedna wybrana sesja juz nie istnieje.');
  }

  const patientId = data.patientId || sessions[0].patientId || null;
  if (sessions.some((session) => session.patientId !== patientId)) {
    throw new Error('Jedna platnosc nie moze obejmowac sesji roznych pacjentow.');
  }

  const previousRecord = data.id ? getPaymentById(data.id) : null;
  const amount = normalizeNullableNumber(data.amount);
  const normalizedAmount = amount !== null ? amount : getPaymentTotalForSessions(uniqueSessionIds);
  const isSplit = data.isSplit === true;
  const splitMethod = isSplit ? (data.splitMethod || 'cash') : null;
  const methodId = normalizePaymentMethodId(data.methodId || data.method);
  const splitMethodId = isSplit ? normalizePaymentMethodId(data.splitMethodId || splitMethod) : null;
  const splitAmounts = isSplit && data.splitAmounts
    ? {
        primary: normalizeNullableNumber(data.splitAmounts.primary) ?? 0,
        secondary: normalizeNullableNumber(data.splitAmounts.secondary) ?? 0,
      }
    : null;

  let paymentRecord = previousRecord;
  if (!paymentRecord) {
    paymentRecord = createPayment({
      id: data.id || undefined,
      patientId,
      date: data.date || new Date().toISOString().slice(0, 10),
      amount: normalizedAmount,
      method: data.method || 'cash',
      methodId,
      isSplit,
      splitMethod,
      splitMethodId,
      splitAmounts,
      sessionIds: uniqueSessionIds,
      sessionsCount: uniqueSessionIds.length,
      note: data.note || '',
    });
    AppState.payments.push(paymentRecord);
  } else {
    paymentRecord.patientId = patientId;
    paymentRecord.date = data.date ? normalizeSessionDate(data.date) : paymentRecord.date;
    paymentRecord.amount = normalizedAmount;
    paymentRecord.method = data.method || 'cash';
    paymentRecord.methodId = methodId;
    paymentRecord.isSplit = isSplit;
    paymentRecord.splitMethod = splitMethod;
    paymentRecord.splitMethodId = splitMethodId;
    paymentRecord.splitAmounts = splitAmounts;
    paymentRecord.sessionIds = uniqueSessionIds;
    paymentRecord.sessionsCount = uniqueSessionIds.length;
    paymentRecord.note = data.note || '';
  }

  reconcilePaymentStatus();
  return paymentRecord;
}

function deletePaymentRecord(paymentId) {
  const paymentRecord = getPaymentById(paymentId);
  if (!paymentRecord) return null;
  AppState.payments = AppState.payments.filter((payment) => payment.id !== paymentId);
  reconcilePaymentStatus();
  return paymentRecord;
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
    const fullRate = getSessionAmount(s, patient);
    const paidPart = normalizeNullableNumber(s.partialPaymentAmount) || 0;
    // For partially paid sessions, only count the remaining amount
    const owed = s.isPartiallyPaid && paidPart
      ? Math.max(fullRate - paidPart, 0)
      : fullRate;
    return sum + owed;
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
 * @returns {Promise<string>}
 */
async function serializeAppData() {
  const data = {
    version:         4,
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
 * Migrates a patient object from old format (v1) to new format (v2).
 * Old format used sessionDays[] + sessionTimes{} instead of sessionDayConfigs[].
 *
 * @param {object} raw — raw patient object from JSON
 * @returns {object} — patient with sessionDayConfigs
 */
function _migratePatient(raw) {
  if (!raw) return raw;

  // Already new format or no old-format fields
  if (Array.isArray(raw.sessionDayConfigs) && raw.sessionDayConfigs.length > 0) return raw;
  if (!Array.isArray(raw.sessionDays) || raw.sessionDays.length === 0) return raw;

  const dayToISO = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
    friday: 5, saturday: 6, sunday: 7,
  };

  const times = raw.sessionTimes || {};
  raw.sessionDayConfigs = raw.sessionDays
    .filter(d => dayToISO[d] !== undefined)
    .map(d => ({
      weekday: dayToISO[d],
      sessionTime: times[d] || '10:00',
    }));

  return raw;
}

/**
 * Migrates a session object from old format (v1) to new format (v2).
 * Old format stored date as "YYYY-MM-DD" + separate time field "HH:MM".
 * New format stores date as a full ISO datetime string.
 *
 * @param {object} raw — raw session object from JSON
 * @returns {object} — session with merged date+time
 */
function _migrateSession(raw) {
  if (!raw) return raw;

  // Old format has a separate `time` field (e.g. "10:00").
  // `date` can be either "YYYY-MM-DD" (10 chars) or a full ISO string
  // like "2026-03-25T00:00:00.000Z". In both cases we need to merge
  // the separate time into the date.
  if (raw.time && typeof raw.date === 'string') {
    // Extract just the date portion (first 10 chars of any format)
    var datePart = raw.date.substring(0, 10); // "YYYY-MM-DD"
    raw.date = new Date(datePart + 'T' + raw.time + ':00').toISOString();
    delete raw.time;
  }

  return raw;
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
  AppState.patients        = (data.patients       || []).map(_migratePatient).map(createPatient);
  AppState.sessions        = (data.sessions       || []).map(_migrateSession).map(createSession);
  AppState.payments        = (data.payments       || []).map(createPayment);
  AppState.blockedPeriods  = (data.blockedPeriods || []).map(createBlockedPeriod);
  collectInvalidPaymentMethodHistoryEntries(
    data && data.settings && data.settings.paymentMethods && data.settings.paymentMethods.history
      ? data.settings.paymentMethods.history
      : []
  );
  AppState.settings        = createAppSettings(data.settings || {});
  AppState.generatedMonths = Array.isArray(data.generatedMonths) ? data.generatedMonths : [];

  // Migrate legacy paid sessions before bootstrapping history, so synthetic
  // payment records are also reflected in the new payment-method registry.
  migrateLegacyPaidSessionsToPayments();

  // Build initial history entries for already-used legacy methods and collect
  // migration issues before the UI starts reading payment labels by date.
  seedPaymentMethodHistoryFromExistingData();
  migratePaymentMethodReferences();
  validatePaymentMethodHistoryCoverage();

  // Always reconcile payment flags so sessions stay in sync with payment records
  reconcilePaymentStatus();

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
      toast('Migracja danych: ' + AppState.migrationIssues.length + ' element(ow) wymaga uwagi.', 'warning', 6000);
    }
  }

  if (typeof SecurityService !== 'undefined') {
    SecurityService.bootstrapFromLoadedState({ forceRefreshProtectedState: true });
  }
}

function migrateLegacyPaidSessionsToPayments() {
  AppState.sessions.forEach((session) => {
    if (!session.isPaid || !session.isPaymentRequired) return;
    if (session.paymentId && getPaymentById(session.paymentId)) return;

    const rawMethod = session.paymentMethod || 'cash';
    const parsed = parseStoredPaymentMethod(rawMethod, null);
    const method = parsed.primaryRaw || 'cash';
    const splitMethod = parsed.secondaryRaw || null;

    const paymentRecord = createPayment({
      id: session.paymentId || uuid(),
      patientId: session.patientId,
      date: session.paymentDate || session.date,
      amount: getSessionAmount(session),
      method,
      isSplit: !!splitMethod,
      splitMethod,
      sessionIds: [session.id],
      sessionsCount: 1,
      note: '',
    });

    AppState.payments.push(paymentRecord);
    session.paymentId = paymentRecord.id;

    if (!parsed.primaryId) {
      registerMigrationIssue({
        type: 'unknown-legacy-session-payment-method',
        sessionId: session.id,
        rawMethod: parsed.primaryRaw,
      });
    }

    if (splitMethod && !parsed.secondaryId) {
      registerMigrationIssue({
        type: 'unknown-legacy-session-split-payment-method',
        sessionId: session.id,
        rawMethod: parsed.secondaryRaw,
      });
    }
  });
}

/**
 * Reconciles isPaid / isPartiallyPaid / paymentId / paymentMethod / paymentDate
 * on every session based on the authoritative Payment records.
 *
 * This is a data-integrity repair that runs after every load. It fixes
 * inconsistencies caused by rescheduling, duplicate-session bugs, etc.
 */
function reconcilePaymentStatus() {
  // Step 1 — clear payment flags on sessions touched by any payment
  // or still carrying stale payment state from an older link.
  const referenced = new Set();
  AppState.payments.forEach(p => (p.sessionIds || []).forEach(id => referenced.add(id)));
  AppState.sessions.forEach(s => {
    const hasPaymentState = !!(s.paymentId || s.paymentMethod || s.paymentDate || s.isPaid || s.isPartiallyPaid);
    if (!referenced.has(s.id) && !hasPaymentState) return;
    clearSessionPaymentState(s);
  });

  // Step 2 — re-apply each payment using oldest-session-first distribution.
  AppState.payments.forEach(payment => {
    const sessions = (payment.sessionIds || [])
      .map(id => getSessionById(id))
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remaining = Number(payment.amount) || 0;
    sessions.forEach(session => {
      const rate = getSessionAmount(session);

      session.paymentId     = payment.id;
      session.paymentMethod = payment.isSplit
        ? payment.method + '+' + payment.splitMethod
        : payment.method;
      session.paymentDate   = payment.date;

      if (remaining >= rate) {
        session.isPaid              = true;
        session.isPartiallyPaid     = false;
        session.partialPaymentAmount = null;
        remaining -= rate;
      } else if (remaining > 0) {
        session.isPaid              = false;
        session.isPartiallyPaid     = true;
        session.partialPaymentAmount = remaining;
        remaining = 0;
      } else {
        session.isPaid              = false;
        session.isPartiallyPaid     = false;
        session.partialPaymentAmount = null;
        session.paymentId            = null;
        session.paymentMethod        = null;
        session.paymentDate          = null;
      }
    });
  });
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
