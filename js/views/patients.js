// =============================================================================
// views/patients.js — Patients view for Gabinet PWA
// =============================================================================

'use strict';

// -----------------------------------------------------------------------------
// AVATAR COLOUR PALETTE — keyed by first letter
// -----------------------------------------------------------------------------
const AVATAR_COLORS = {
  A: '#E53935', B: '#8E24AA', C: '#1E88E5', D: '#00897B', E: '#F4511E',
  F: '#6D4C41', G: '#039BE5', H: '#3949AB', I: '#7CB342', J: '#C0CA33',
  K: '#FB8C00', L: '#F6BF26', M: '#E91E63', N: '#00ACC1', O: '#43A047',
  P: '#5E35B1', Q: '#D81B60', R: '#00BCD4', S: '#FF7043', T: '#9CCC65',
  U: '#26A69A', W: '#AB47BC', V: '#EF5350', X: '#7986CB', Y: '#4CAF50',
  Z: '#FF5722',
};

function avatarColor(name) {
  if (!name) return '#78909C';
  const ch = name.trim().toUpperCase().charAt(0);
  return AVATAR_COLORS[ch] || '#78909C';
}

function patientInitials(patient) {
  const f = (patient.firstName || '').trim().charAt(0).toUpperCase();
  const l = (patient.lastName  || '').trim().charAt(0).toUpperCase();
  return (f + l) || '??';
}

function patientDisplayName(patient) {
  if (patient.pseudonym) return patient.pseudonym;
  return ((patient.firstName || '') + ' ' + (patient.lastName || '')).trim() || 'Pacjent';
}

function sessionDayLabels(patient) {
  if (!Array.isArray(patient.sessionDayConfigs) || patient.sessionDayConfigs.length === 0) {
    return '\u2014';
  }
  return patient.sessionDayConfigs
    .map(cfg => {
      const wd = getWeekdayName(cfg.weekday);
      return wd ? wd.short : '?';
    })
    .join(', ');
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================================================
// PatientViews — main export object
// =============================================================================

const PatientViews = {
  searchQuery:  '',
  sortOrder:    'lastName',   // lastName | longestTherapy | shortestTherapy | debt
  showDebtOnly: false,

  // ── RENDER ENTRY POINT ───────────────────────────────────────────────────

  render(params) {
    params = params || {};
    if (params.patientId) {
      this._currentPatientId = params.patientId;
      this._renderDetailPage(params.patientId);
      return;
    }
    if (params.view === 'archive') {
      this._renderArchivePage();
      return;
    }
    if (params.view === 'add' || params.view === 'edit') {
      this._currentPatientId = params.patientId || null;
      this._renderFormPage(params.patientId || null);
      return;
    }
    if (params.q !== undefined) {
      this.searchQuery = params.q;
    }
    this._renderListPage();
  },

  _renderListPage() {
    const container = document.getElementById('view-container');
    if (!container) return;
    container.innerHTML = this._listPageHTML();
    this._injectStyles();
    this.bindEvents();
  },

  _renderDetailPage(patientId) {
    const container = document.getElementById('view-container');
    if (!container) return;
    container.innerHTML = this.renderPatientDetail(patientId);
    this._injectStyles();
    this._bindDetailEvents(patientId);
  },

  _renderFormPage(patientId) {
    const container = document.getElementById('view-container');
    if (!container) return;
    container.innerHTML = this.renderPatientForm(patientId);
    this._injectStyles();
    this._bindFormEvents(patientId);
  },

  _renderArchivePage() {
    const container = document.getElementById('view-container');
    if (!container) return;
    container.innerHTML = this.renderArchiveView();
    this._injectStyles();
    this._bindArchiveEvents();
  },

  // ── LIST PAGE HTML ───────────────────────────────────────────────────────

  _listPageHTML() {
    return (
      '<div class="pv-page">' +
        this._renderSearchBar() +
        this._renderToolbar() +
        '<div class="pv-list-wrap" id="pv-list-wrap">' +
          this.renderPatientList() +
        '</div>' +
      '</div>' +
      this._contextMenuHTML() +
      this._goalModalHTML() +
      this._noteModalHTML() +
      this._vacationModalHTML() +
      this._restoreModalHTML()
    );
  },

  _renderSearchBar() {
    return (
      '<div class="pv-search-bar">' +
        '<span class="pv-search-icon">&#128269;</span>' +
        '<input' +
          ' type="search"' +
          ' id="pv-search"' +
          ' class="pv-search-input"' +
          ' placeholder="Szukaj pacjenta..."' +
          ' value="' + escHtml(this.searchQuery) + '"' +
          ' autocomplete="off"' +
        '/>' +
      '</div>'
    );
  },

  _renderToolbar() {
    const debtActive = this.showDebtOnly ? ' pv-btn--active' : '';
    const sortLabels = {
      lastName:        'Nazwisko',
      longestTherapy:  'Najd\u0142u\u017csza terapia',
      shortestTherapy: 'Najkr\xf3tsza terapia',
      debt:            'Zad\u0142u\u017cenie',
    };
    const sortLabel = sortLabels[this.sortOrder] || 'Sortuj';
    const sortItems = Object.keys(sortLabels).map(key =>
      '<button class="pv-sort-item' + (this.sortOrder === key ? ' active' : '') +
      '" data-sort="' + key + '">' + sortLabels[key] + '</button>'
    ).join('');

    return (
      '<div class="pv-toolbar">' +
        '<button class="pv-btn pv-btn-add" id="pv-btn-add" title="Dodaj pacjenta">' +
          '<span class="pv-btn-icon">+</span> Nowy' +
        '</button>' +
        '<button class="pv-btn pv-btn-icon-only" id="pv-btn-archive" title="Archiwum">&#128451;</button>' +
        '<div class="pv-sort-wrap">' +
          '<button class="pv-btn pv-btn-sort" id="pv-btn-sort">' +
            escHtml(sortLabel) + ' &#9660;' +
          '</button>' +
          '<div class="pv-sort-menu hidden" id="pv-sort-menu">' +
            sortItems +
          '</div>' +
        '</div>' +
        '<button class="pv-btn pv-btn-debt' + debtActive + '" id="pv-btn-debt" title="Tylko zad\u0142u\u017ceni">D\u0142ug</button>' +
      '</div>'
    );
  },

  // ── PATIENT LIST ─────────────────────────────────────────────────────────

  renderPatientList() {
    let patients = AppState.activePatients.slice();

    // Filter by search
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      patients = patients.filter(p => {
        const full = ((p.firstName || '') + ' ' + (p.lastName || '') + ' ' + (p.pseudonym || '')).toLowerCase();
        return full.includes(q);
      });
    }

    // Filter by debt
    if (this.showDebtOnly) {
      patients = patients.filter(p => getPatientDebt(p.id).total > 0);
    }

    // Sort
    patients.sort((a, b) => {
      switch (this.sortOrder) {
        case 'lastName':
          return (a.lastName || '').localeCompare(b.lastName || '', 'pl');
        case 'longestTherapy': {
          const da = new Date(a.therapyStartDate || 0);
          const db = new Date(b.therapyStartDate || 0);
          return da - db;
        }
        case 'shortestTherapy': {
          const da = new Date(a.therapyStartDate || 0);
          const db = new Date(b.therapyStartDate || 0);
          return db - da;
        }
        case 'debt': {
          const da = getPatientDebt(a.id).total;
          const db = getPatientDebt(b.id).total;
          return db - da;
        }
        default:
          return 0;
      }
    });

    if (patients.length === 0) {
      return this._emptyStateHTML();
    }

    return (
      '<ul class="pv-list" id="pv-list">' +
        patients.map(p => this.renderPatientRow(p)).join('') +
      '</ul>'
    );
  },

  renderPatientRow(patient) {
    const initials         = patientInitials(patient);
    const color            = avatarColor(patient.firstName || patient.pseudonym);
    const display          = patientDisplayName(patient);
    const days             = sessionDayLabels(patient);
    const duration         = getPatientTherapyDuration(patient);
    const debt             = getPatientDebt(patient.id);
    const completedCount   = getCompletedSessionsCount(patient.id);
    const debtBadge        = debt.total > 0
      ? '<span class="pv-row-debt">' + escHtml(formatPLN(debt.total)) + '</span>'
      : '';

    return (
      '<li class="pv-row" data-id="' + escHtml(patient.id) + '" tabindex="0" role="button"' +
          ' aria-label="' + escHtml(display) + '">' +
        '<div class="pv-avatar" style="background:' + color + '">' + escHtml(initials) + '</div>' +
        '<div class="pv-row-body">' +
          '<div class="pv-row-top">' +
            '<span class="pv-row-name">' + escHtml(display) + '</span>' +
            debtBadge +
          '</div>' +
          '<div class="pv-row-meta">' +
            '<span class="pv-row-days">' + escHtml(days) + '</span>' +
            '<span class="pv-row-sep">\xb7</span>' +
            '<span class="pv-row-duration">' + escHtml(duration) + '</span>' +
            '<span class="pv-row-sep">\xb7</span>' +
            '<span class="pv-row-count">' + completedCount + ' sesji</span>' +
          '</div>' +
        '</div>' +
        '<button class="pv-row-more" data-id="' + escHtml(patient.id) + '" title="Opcje" aria-label="Opcje">&#8942;</button>' +
      '</li>'
    );
  },

  _emptyStateHTML() {
    const hasFilter = this.searchQuery || this.showDebtOnly;
    return (
      '<div class="pv-empty">' +
        '<div class="pv-empty-icon">&#128101;</div>' +
        '<p class="pv-empty-msg">' + (hasFilter ? 'Brak wynik\xf3w' : 'Brak pacjent\xf3w') + '</p>' +
        (!hasFilter ? '<button class="pv-btn pv-btn-add pv-empty-add" id="pv-empty-add">Dodaj pacjenta</button>' : '') +
      '</div>'
    );
  },

  // ── PATIENT DETAIL ───────────────────────────────────────────────────────

  renderPatientDetail(patientId) {
    const patient = getPatient(patientId);
    if (!patient) {
      return '<div class="pv-page pv-page--detail"><p class="pv-error">Nie znaleziono pacjenta.</p></div>';
    }
    const debt           = getPatientDebt(patientId);
    const sessions       = getPatientSessions(patientId);
    const completedCount = sessions.filter(s => s.status === 'completed').length;
    const lastTen        = sessions.slice().reverse().slice(0, 10);
    const display        = patientDisplayName(patient);
    const initials       = patientInitials(patient);
    const color          = avatarColor(patient.firstName || patient.pseudonym);
    const duration       = getPatientTherapyDuration(patient);

    const debtBadge = debt.total > 0
      ? '<span class="pv-debt-badge">D\u0142ug: ' + escHtml(formatPLN(debt.total)) + '</span>'
      : '';
    const pseudonymLine = patient.pseudonym
      ? '<p class="pv-detail-pseudonym">' + escHtml(patient.firstName) + ' ' + escHtml(patient.lastName) + '</p>'
      : '';
    const pseudonymDl = patient.pseudonym
      ? '<dt>Pseudonim</dt><dd>' + escHtml(patient.pseudonym) + '</dd>'
      : '';

    return (
      '<div class="pv-page pv-page--detail">' +
        '<div class="pv-detail-header">' +
          '<button class="pv-back-btn" id="pv-back-btn">&#8592; Pacjenci</button>' +
          '<button class="pv-edit-btn" id="pv-edit-btn" data-id="' + escHtml(patientId) + '">Edytuj</button>' +
        '</div>' +

        '<div class="pv-detail-hero">' +
          '<div class="pv-avatar pv-avatar--large" style="background:' + color + '">' + escHtml(initials) + '</div>' +
          '<h1 class="pv-detail-name">' + escHtml(display) + '</h1>' +
          pseudonymLine +
          debtBadge +
        '</div>' +

        '<div class="pv-detail-sections">' +

          '<section class="pv-section">' +
            '<h2 class="pv-section-title">Informacje</h2>' +
            '<dl class="pv-dl">' +
              '<dt>Imi\u0119</dt><dd>' + escHtml(patient.firstName) + '</dd>' +
              '<dt>Nazwisko</dt><dd>' + escHtml(patient.lastName) + '</dd>' +
              pseudonymDl +
              '<dt>Stawka sesji</dt><dd>' + escHtml(formatPLN(patient.sessionRate)) + '</dd>' +
              '<dt>Sesje w tygodniu</dt><dd>' + escHtml(String(patient.sessionsPerWeek)) + '</dd>' +
            '</dl>' +
          '</section>' +

          '<section class="pv-section">' +
            '<h2 class="pv-section-title">Terapia</h2>' +
            '<dl class="pv-dl">' +
              '<dt>Pocz\u0105tek terapii</dt><dd>' + escHtml(formatDateLong(patient.therapyStartDate)) + '</dd>' +
              '<dt>Czas trwania</dt><dd>' + escHtml(duration) + '</dd>' +
              '<dt>Uko\u0144czone sesje</dt><dd>' + completedCount + '</dd>' +
            '</dl>' +
          '</section>' +

          '<section class="pv-section">' +
            '<h2 class="pv-section-title">Harmonogram</h2>' +
            this._renderScheduleSection(patient) +
          '</section>' +

          '<section class="pv-section">' +
            '<h2 class="pv-section-title">Urlopy ' +
              '<button class="pv-section-add-btn" id="pv-add-vacation" data-id="' + escHtml(patientId) + '">+ Dodaj</button>' +
            '</h2>' +
            this._renderVacationsSection(patient) +
          '</section>' +

          '<section class="pv-section">' +
            '<h2 class="pv-section-title">Cele terapeutyczne ' +
              '<button class="pv-section-add-btn" id="pv-add-goal" data-id="' + escHtml(patientId) + '">+ Dodaj</button>' +
            '</h2>' +
            this._renderGoalsSection(patient) +
          '</section>' +

          '<section class="pv-section">' +
            '<h2 class="pv-section-title">Notatki ' +
              '<button class="pv-section-add-btn" id="pv-add-note" data-id="' + escHtml(patientId) + '">+ Dodaj</button>' +
            '</h2>' +
            this._renderNotesSection(patient) +
          '</section>' +

          '<section class="pv-section">' +
            '<h2 class="pv-section-title">Ostatnie sesje</h2>' +
            this._renderSessionsSection(lastTen) +
          '</section>' +

          '<div class="pv-detail-actions">' +
            '<button class="pv-btn pv-btn-archive-p" id="pv-archive-btn" data-id="' + escHtml(patientId) + '">' +
              'Archiwizuj pacjenta' +
            '</button>' +
            '<button class="pv-btn pv-btn-danger" id="pv-delete-btn" data-id="' + escHtml(patientId) + '">' +
              'Usu\u0144 pacjenta' +
            '</button>' +
          '</div>' +

        '</div>' +
      '</div>' +
      this._goalModalHTML() +
      this._noteModalHTML() +
      this._vacationModalHTML()
    );
  },

  _renderScheduleSection(patient) {
    if (!patient.sessionDayConfigs || patient.sessionDayConfigs.length === 0) {
      return '<p class="pv-empty-sub">Brak harmonogramu.</p>';
    }
    const rows = patient.sessionDayConfigs.map(cfg => {
      const wd = getWeekdayName(cfg.weekday);
      return (
        '<div class="pv-schedule-row">' +
          '<span class="pv-schedule-day">' + escHtml(wd ? wd.name : '?') + '</span>' +
          '<span class="pv-schedule-time">' + escHtml(cfg.sessionTime || '\u2014') + '</span>' +
        '</div>'
      );
    }).join('');
    return '<div class="pv-schedule-list">' + rows + '</div>';
  },

  _renderVacationsSection(patient) {
    if (!patient.vacationPeriods || patient.vacationPeriods.length === 0) {
      return '<p class="pv-empty-sub">Brak urlop\xf3w.</p>';
    }
    const rows = patient.vacationPeriods.map(vp =>
      '<div class="pv-vacation-row" data-vpid="' + escHtml(vp.id) + '">' +
        '<span class="pv-vacation-dates">' +
          escHtml(formatDateShort(vp.startDate)) + ' \u2013 ' + escHtml(formatDateShort(vp.endDate)) +
        '</span>' +
        '<button class="pv-row-delete-btn" data-vpid="' + escHtml(vp.id) + '"' +
          ' data-patientid="' + escHtml(patient.id) + '" title="Usu\u0144 urlop">&#10005;</button>' +
      '</div>'
    ).join('');
    return '<div class="pv-vacation-list">' + rows + '</div>';
  },

  _renderGoalsSection(patient) {
    if (!patient.therapeuticGoals || patient.therapeuticGoals.length === 0) {
      return '<p class="pv-empty-sub">Brak cel\xf3w.</p>';
    }
    const icons = { inProgress: '&#9203;', achieved: '&#9989;', obsolete: '&#128683;' };
    const rows = patient.therapeuticGoals.map(g => {
      const statusObj = GOAL_STATUS[g.status];
      const statusName = statusObj ? statusObj.name : g.status;
      return (
        '<div class="pv-goal-row" data-goalid="' + escHtml(g.id) + '">' +
          '<span class="pv-goal-icon">' + (icons[g.status] || '&#9203;') + '</span>' +
          '<span class="pv-goal-title">' + escHtml(g.title) + '</span>' +
          '<span class="pv-goal-status pv-goal-status--' + escHtml(g.status) + '">' + escHtml(statusName) + '</span>' +
          '<button class="pv-row-delete-btn" data-goalid="' + escHtml(g.id) + '"' +
            ' data-patientid="' + escHtml(patient.id) + '" title="Usu\u0144 cel">&#10005;</button>' +
        '</div>'
      );
    }).join('');
    return '<div class="pv-goals-list">' + rows + '</div>';
  },

  _renderNotesSection(patient) {
    if (!patient.sessionNotes || patient.sessionNotes.length === 0) {
      return '<p class="pv-empty-sub">Brak notatek.</p>';
    }
    const rows = patient.sessionNotes.slice().reverse().map(n => {
      const preview = (n.content || '').slice(0, 100);
      const ellipsis = (n.content || '').length > 100 ? '\u2026' : '';
      return (
        '<div class="pv-note-row" data-noteid="' + escHtml(n.id) + '">' +
          '<div class="pv-note-header">' +
            '<span class="pv-note-date">' + escHtml(formatDateMedium(n.date)) + '</span>' +
            '<button class="pv-row-delete-btn" data-noteid="' + escHtml(n.id) + '"' +
              ' data-patientid="' + escHtml(patient.id) + '" title="Usu\u0144 notatk\u0119">&#10005;</button>' +
          '</div>' +
          '<p class="pv-note-preview">' + escHtml(preview) + ellipsis + '</p>' +
        '</div>'
      );
    }).join('');
    return '<div class="pv-notes-list">' + rows + '</div>';
  },

  _renderSessionsSection(sessions) {
    if (sessions.length === 0) {
      return '<p class="pv-empty-sub">Brak sesji.</p>';
    }
    const statusLabels = { scheduled: 'Planowana', completed: 'Uko\u0144czona', cancelled: 'Odwo\u0142ana' };
    const rows = sessions.map(s => {
      const label  = statusLabels[s.status] || s.status;
      const cls    = 'pv-sess-status--' + (s.status || 'scheduled');
      const paid   = s.isPaid ? '<span class="pv-sess-paid">&#10003;</span>' : '';
      return (
        '<div class="pv-sess-row">' +
          '<span class="pv-sess-date">' + escHtml(formatDateMedium(s.date)) + ' ' + escHtml(formatTime(s.date)) + '</span>' +
          '<span class="pv-sess-status ' + cls + '">' + escHtml(label) + '</span>' +
          paid +
        '</div>'
      );
    }).join('');
    return '<div class="pv-sessions-list">' + rows + '</div>';
  },

  // ── PATIENT FORM ─────────────────────────────────────────────────────────

  renderPatientForm(patientId) {
    patientId = patientId || null;
    const patient  = patientId ? getPatient(patientId) : null;
    const isEdit   = !!patient;
    const title    = isEdit ? 'Edytuj pacjenta' : 'Nowy pacjent';
    const p        = patient || {};

    const checkedDays = Array.isArray(p.sessionDayConfigs) ? p.sessionDayConfigs : [];
    const dayToggles  = WEEKDAYS.map(wd => {
      const cfg     = checkedDays.find(c => c.weekday === wd.id);
      const checked = cfg ? 'checked' : '';
      const time    = cfg ? (cfg.sessionTime || '10:00') : '10:00';
      const disabled = cfg ? '' : 'disabled';
      return (
        '<div class="pv-form-day-row" id="pv-day-row-' + wd.id + '">' +
          '<label class="pv-day-toggle">' +
            '<input type="checkbox" name="weekday" value="' + wd.id + '" ' + checked +
              ' class="pv-day-check" data-dayid="' + wd.id + '">' +
            '<span class="pv-day-label">' + escHtml(wd.name) + '</span>' +
          '</label>' +
          '<input type="time" class="pv-time-input" data-dayid="' + wd.id + '"' +
            ' value="' + escHtml(time) + '" ' + disabled + '>' +
        '</div>'
      );
    }).join('');

    const spwOptions = [1, 2, 3].map(n =>
      '<option value="' + n + '"' + ((p.sessionsPerWeek || 1) === n ? ' selected' : '') + '>' + n + ' \xd7 w tygodniu</option>'
    ).join('');

    const startDate = p.therapyStartDate
      ? new Date(p.therapyStartDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const deleteBtn = isEdit
      ? '<button type="button" class="pv-btn pv-btn-danger" id="pv-form-delete" data-id="' + escHtml(p.id || '') + '">Usu\u0144</button>'
      : '';

    return (
      '<div class="pv-page pv-page--form">' +
        '<div class="pv-detail-header">' +
          '<button class="pv-back-btn" id="pv-form-back">&#8592; ' + (isEdit ? 'Pacjent' : 'Pacjenci') + '</button>' +
          '<span class="pv-form-title">' + escHtml(title) + '</span>' +
        '</div>' +

        '<form id="pv-patient-form" class="pv-form" novalidate>' +
          '<input type="hidden" name="id" value="' + escHtml(p.id || '') + '">' +

          '<section class="pv-form-section">' +
            '<h3 class="pv-form-section-title">Dane osobowe</h3>' +
            '<label class="pv-form-label">' +
              '<span>Imi\u0119 <span class="pv-required">*</span></span>' +
              '<input type="text" name="firstName" class="pv-form-input"' +
                ' value="' + escHtml(p.firstName || '') + '" required placeholder="Imi\u0119">' +
              '<span class="pv-form-error" id="err-firstName"></span>' +
            '</label>' +
            '<label class="pv-form-label">' +
              '<span>Nazwisko <span class="pv-required">*</span></span>' +
              '<input type="text" name="lastName" class="pv-form-input"' +
                ' value="' + escHtml(p.lastName || '') + '" required placeholder="Nazwisko">' +
              '<span class="pv-form-error" id="err-lastName"></span>' +
            '</label>' +
            '<label class="pv-form-label">' +
              '<span>Pseudonim</span>' +
              '<input type="text" name="pseudonym" class="pv-form-input"' +
                ' value="' + escHtml(p.pseudonym || '') + '" placeholder="Opcjonalny pseudonim">' +
            '</label>' +
            '<label class="pv-form-label">' +
              '<span>Data rozpocz\u0119cia terapii <span class="pv-required">*</span></span>' +
              '<input type="date" name="therapyStartDate" class="pv-form-input"' +
                ' value="' + escHtml(startDate) + '" required>' +
              '<span class="pv-form-error" id="err-therapyStartDate"></span>' +
            '</label>' +
          '</section>' +

          '<section class="pv-form-section">' +
            '<h3 class="pv-form-section-title">Finansowe</h3>' +
            '<label class="pv-form-label">' +
              '<span>Stawka za sesj\u0119 (z\u0142) <span class="pv-required">*</span></span>' +
              '<input type="number" name="sessionRate" class="pv-form-input"' +
                ' value="' + escHtml(String(p.sessionRate !== undefined ? p.sessionRate : 200)) + '"' +
                ' min="0" step="10" required placeholder="200">' +
              '<span class="pv-form-error" id="err-sessionRate"></span>' +
            '</label>' +
          '</section>' +

          '<section class="pv-form-section">' +
            '<h3 class="pv-form-section-title">Harmonogram</h3>' +
            '<label class="pv-form-label">' +
              '<span>Sesje w tygodniu</span>' +
              '<select name="sessionsPerWeek" class="pv-form-input pv-form-select">' +
                spwOptions +
              '</select>' +
            '</label>' +
            '<div class="pv-form-label">' +
              '<span>Dni sesji</span>' +
              '<div class="pv-day-toggles" id="pv-day-toggles">' +
                dayToggles +
              '</div>' +
              '<span class="pv-form-error" id="err-days"></span>' +
            '</div>' +
          '</section>' +

          '<div class="pv-form-actions">' +
            '<button type="submit" class="pv-btn pv-btn-primary" id="pv-form-submit">' +
              (isEdit ? 'Zapisz zmiany' : 'Dodaj pacjenta') +
            '</button>' +
            deleteBtn +
          '</div>' +
        '</form>' +
      '</div>'
    );
  },

  // ── ARCHIVE VIEW ─────────────────────────────────────────────────────────

  renderArchiveView() {
    const archived = AppState.archivedPatients;

    let listHTML;
    if (archived.length === 0) {
      listHTML = '<p class="pv-empty-sub pv-empty-sub--center">Brak zarchiwizowanych pacjent\xf3w.</p>';
    } else {
      listHTML = (
        '<ul class="pv-list">' +
          archived.map(p => {
            const initials  = patientInitials(p);
            const color     = avatarColor(p.firstName || p.pseudonym);
            const display   = patientDisplayName(p);
            const archDate  = p.archivedDate ? formatDateShort(p.archivedDate) : '\u2014';
            return (
              '<li class="pv-row pv-row--archived" data-id="' + escHtml(p.id) + '" tabindex="0">' +
                '<div class="pv-avatar" style="background:' + color + '">' + escHtml(initials) + '</div>' +
                '<div class="pv-row-body">' +
                  '<div class="pv-row-top">' +
                    '<span class="pv-row-name">' + escHtml(display) + '</span>' +
                    '<span class="pv-row-archived-tag">Zarchiwizowany</span>' +
                  '</div>' +
                  '<div class="pv-row-meta">' +
                    '<span>Zarchiwizowany: ' + escHtml(archDate) + '</span>' +
                  '</div>' +
                '</div>' +
                '<button class="pv-btn pv-btn-restore pv-btn-sm" data-id="' + escHtml(p.id) + '" title="Przywr\xf3\u0107">Przywr\xf3\u0107</button>' +
              '</li>'
            );
          }).join('') +
        '</ul>'
      );
    }

    return (
      '<div class="pv-page">' +
        '<div class="pv-detail-header">' +
          '<button class="pv-back-btn" id="pv-back-btn">&#8592; Pacjenci</button>' +
          '<span class="pv-form-title">Archiwum</span>' +
        '</div>' +
        '<div class="pv-list-wrap">' +
          listHTML +
        '</div>' +
      '</div>' +
      this._restoreModalHTML()
    );
  },

  showRestoreForm(patientId) {
    const modal = document.getElementById('pv-modal-restore');
    if (!modal) return;
    modal.dataset.patientid = patientId;
    const today = new Date().toISOString().split('T')[0];
    const inp   = modal.querySelector('#restore-start-date');
    if (inp) inp.value = today;
    modal.classList.remove('hidden');
  },

  // ── MODALS HTML ──────────────────────────────────────────────────────────

  _goalModalHTML() {
    return (
      '<div class="pv-modal hidden" id="pv-modal-goal" role="dialog" aria-modal="true">' +
        '<div class="pv-modal-box">' +
          '<h3 class="pv-modal-title">Cel terapeutyczny</h3>' +
          '<label class="pv-form-label">' +
            '<span>Tytu\u0142 celu <span class="pv-required">*</span></span>' +
            '<input type="text" id="goal-title" class="pv-form-input" placeholder="Opisz cel..." maxlength="200">' +
          '</label>' +
          '<label class="pv-form-label">' +
            '<span>Status</span>' +
            '<select id="goal-status" class="pv-form-input pv-form-select">' +
              '<option value="inProgress">W trakcie</option>' +
              '<option value="achieved">Osi\u0105gni\u0119ty</option>' +
              '<option value="obsolete">Nieaktualny</option>' +
            '</select>' +
          '</label>' +
          '<div class="pv-modal-actions">' +
            '<button class="pv-btn pv-btn-primary" id="pv-goal-save">Zapisz</button>' +
            '<button class="pv-btn" id="pv-goal-cancel">Anuluj</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  },

  _noteModalHTML() {
    return (
      '<div class="pv-modal hidden" id="pv-modal-note" role="dialog" aria-modal="true">' +
        '<div class="pv-modal-box">' +
          '<h3 class="pv-modal-title">Notatka</h3>' +
          '<label class="pv-form-label">' +
            '<span>Tre\u015b\u0107 notatki <span class="pv-required">*</span></span>' +
            '<textarea id="note-content" class="pv-form-input pv-form-textarea"' +
              ' rows="5" placeholder="Wpisz notatk\u0119..."></textarea>' +
          '</label>' +
          '<label class="pv-form-label">' +
            '<span>Data</span>' +
            '<input type="date" id="note-date" class="pv-form-input">' +
          '</label>' +
          '<div class="pv-modal-actions">' +
            '<button class="pv-btn pv-btn-primary" id="pv-note-save">Zapisz</button>' +
            '<button class="pv-btn" id="pv-note-cancel">Anuluj</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  },

  _vacationModalHTML() {
    return (
      '<div class="pv-modal hidden" id="pv-modal-vacation" role="dialog" aria-modal="true">' +
        '<div class="pv-modal-box">' +
          '<h3 class="pv-modal-title">Dodaj urlop</h3>' +
          '<label class="pv-form-label">' +
            '<span>Data od <span class="pv-required">*</span></span>' +
            '<input type="date" id="vacation-start" class="pv-form-input">' +
          '</label>' +
          '<label class="pv-form-label">' +
            '<span>Data do <span class="pv-required">*</span></span>' +
            '<input type="date" id="vacation-end" class="pv-form-input">' +
          '</label>' +
          '<div class="pv-modal-actions">' +
            '<button class="pv-btn pv-btn-primary" id="pv-vacation-save">Zapisz</button>' +
            '<button class="pv-btn" id="pv-vacation-cancel">Anuluj</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  },

  _restoreModalHTML() {
    return (
      '<div class="pv-modal hidden" id="pv-modal-restore" role="dialog" aria-modal="true">' +
        '<div class="pv-modal-box">' +
          '<h3 class="pv-modal-title">Przywr\xf3\u0107 pacjenta</h3>' +
          '<p class="pv-modal-desc">Podaj dat\u0119 pocz\u0105tku nowego cyklu terapii.</p>' +
          '<label class="pv-form-label">' +
            '<span>Data rozpocz\u0119cia <span class="pv-required">*</span></span>' +
            '<input type="date" id="restore-start-date" class="pv-form-input">' +
          '</label>' +
          '<div class="pv-modal-actions">' +
            '<button class="pv-btn pv-btn-primary" id="pv-restore-confirm">Przywr\xf3\u0107</button>' +
            '<button class="pv-btn" id="pv-restore-cancel">Anuluj</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  },

  _contextMenuHTML() {
    return (
      '<div class="pv-ctx-menu hidden" id="pv-ctx-menu" role="menu">' +
        '<button class="pv-ctx-item" id="pv-ctx-edit">&#9998; Edytuj</button>' +
        '<button class="pv-ctx-item" id="pv-ctx-archive">&#128451; Archiwizuj</button>' +
        '<button class="pv-ctx-item pv-ctx-item--danger" id="pv-ctx-delete">&#128465; Usu\u0144</button>' +
      '</div>'
    );
  },

  // ── BIND EVENTS (list view) ──────────────────────────────────────────────

  bindEvents() {
    // Search
    const searchInput = document.getElementById('pv-search');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        this.searchQuery = searchInput.value;
        const wrap = document.getElementById('pv-list-wrap');
        if (wrap) wrap.innerHTML = this.renderPatientList();
        this._bindListRowEvents();
      }, 250));
    }

    // Add button (toolbar)
    const addBtn = document.getElementById('pv-btn-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => Router.navigate('patients', { view: 'add' }));
    }

    // Add button (empty state)
    const emptyAdd = document.getElementById('pv-empty-add');
    if (emptyAdd) {
      emptyAdd.addEventListener('click', () => Router.navigate('patients', { view: 'add' }));
    }

    // Archive navigation
    const archiveBtn = document.getElementById('pv-btn-archive');
    if (archiveBtn) {
      archiveBtn.addEventListener('click', () => Router.navigate('patients', { view: 'archive' }));
    }

    // Sort menu toggle
    const sortBtn  = document.getElementById('pv-btn-sort');
    const sortMenu = document.getElementById('pv-sort-menu');
    if (sortBtn && sortMenu) {
      sortBtn.addEventListener('click', e => {
        e.stopPropagation();
        sortMenu.classList.toggle('hidden');
      });
      sortMenu.querySelectorAll('.pv-sort-item').forEach(item => {
        item.addEventListener('click', () => {
          this.sortOrder = item.dataset.sort;
          sortMenu.classList.add('hidden');
          const wrap = document.getElementById('pv-list-wrap');
          if (wrap) wrap.innerHTML = this.renderPatientList();
          this._bindListRowEvents();
          const labels = {
            lastName:        'Nazwisko',
            longestTherapy:  'Najd\u0142u\u017csza terapia',
            shortestTherapy: 'Najkr\xf3tsza terapia',
            debt:            'Zad\u0142u\u017cenie',
          };
          sortBtn.innerHTML = escHtml(labels[this.sortOrder] || 'Sortuj') + ' &#9660;';
        });
      });
    }

    // Debt-only toggle
    const debtBtn = document.getElementById('pv-btn-debt');
    if (debtBtn) {
      debtBtn.addEventListener('click', () => {
        this.showDebtOnly = !this.showDebtOnly;
        debtBtn.classList.toggle('pv-btn--active', this.showDebtOnly);
        const wrap = document.getElementById('pv-list-wrap');
        if (wrap) wrap.innerHTML = this.renderPatientList();
        this._bindListRowEvents();
      });
    }

    // Close context menu when clicking anywhere else
    document.addEventListener('click', this._closeContextMenu.bind(this), { capture: true });

    this._bindListRowEvents();
  },

  _bindListRowEvents() {
    const list = document.getElementById('pv-list');
    if (!list) return;

    // Row click -> detail
    list.querySelectorAll('.pv-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.pv-row-more')) return;
        Router.navigate('patients', { patientId: row.dataset.id });
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          Router.navigate('patients', { patientId: row.dataset.id });
        }
      });
    });

    // More (ellipsis) button -> context menu
    list.querySelectorAll('.pv-row-more').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._showContextMenu(btn.dataset.id, btn);
      });

      // Long-press on row
      let pressTimer;
      const rowEl = btn.closest('.pv-row');
      if (rowEl) {
        rowEl.addEventListener('contextmenu', e => {
          e.preventDefault();
          this._showContextMenu(btn.dataset.id, btn);
        });
        rowEl.addEventListener('touchstart', () => {
          pressTimer = setTimeout(() => this._showContextMenu(btn.dataset.id, btn), 600);
        }, { passive: true });
        rowEl.addEventListener('touchend',  () => clearTimeout(pressTimer));
        rowEl.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
      }
    });
  },

  _showContextMenu(patientId, anchorEl) {
    const menu = document.getElementById('pv-ctx-menu');
    if (!menu) return;
    menu.dataset.patientid = patientId;
    menu.classList.remove('hidden');

    const rect = anchorEl.getBoundingClientRect();
    menu.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    menu.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 180) + 'px';

    const editBtn    = document.getElementById('pv-ctx-edit');
    const archiveBtn = document.getElementById('pv-ctx-archive');
    const deleteBtn  = document.getElementById('pv-ctx-delete');

    const wrap = (fn) => (e) => { e.stopPropagation(); this._closeContextMenu(); fn(patientId); };
    if (editBtn)    editBtn.onclick    = wrap(id => Router.navigate('patients', { view: 'edit', patientId: id }));
    if (archiveBtn) archiveBtn.onclick = wrap(id => this.archivePatient(id));
    if (deleteBtn)  deleteBtn.onclick  = wrap(id => this.deletePatient(id));
  },

  _closeContextMenu() {
    const menu = document.getElementById('pv-ctx-menu');
    if (menu) menu.classList.add('hidden');
  },

  // ── BIND EVENTS (detail view) ────────────────────────────────────────────

  _bindDetailEvents(patientId) {
    const back = document.getElementById('pv-back-btn');
    if (back) back.addEventListener('click', () => Router.back());

    const editBtn = document.getElementById('pv-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () =>
        Router.navigate('patients', { view: 'edit', patientId })
      );
    }

    const archiveBtn = document.getElementById('pv-archive-btn');
    if (archiveBtn) {
      archiveBtn.addEventListener('click', () => this.archivePatient(patientId));
    }

    const deleteBtn = document.getElementById('pv-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deletePatient(patientId));
    }

    // Add goal
    const addGoal = document.getElementById('pv-add-goal');
    if (addGoal) {
      addGoal.addEventListener('click', () => {
        const modal = document.getElementById('pv-modal-goal');
        if (!modal) return;
        modal.dataset.patientid = patientId;
        const titleEl  = document.getElementById('goal-title');
        const statusEl = document.getElementById('goal-status');
        if (titleEl)  titleEl.value  = '';
        if (statusEl) statusEl.value = 'inProgress';
        modal.classList.remove('hidden');
      });
    }

    // Add note
    const addNote = document.getElementById('pv-add-note');
    if (addNote) {
      addNote.addEventListener('click', () => {
        const modal = document.getElementById('pv-modal-note');
        if (!modal) return;
        modal.dataset.patientid = patientId;
        const contentEl = document.getElementById('note-content');
        const dateEl    = document.getElementById('note-date');
        if (contentEl) contentEl.value = '';
        if (dateEl)    dateEl.value    = new Date().toISOString().split('T')[0];
        modal.classList.remove('hidden');
      });
    }

    // Add vacation
    const addVacation = document.getElementById('pv-add-vacation');
    if (addVacation) {
      addVacation.addEventListener('click', () => {
        const modal = document.getElementById('pv-modal-vacation');
        if (!modal) return;
        modal.dataset.patientid = patientId;
        const startEl = document.getElementById('vacation-start');
        const endEl   = document.getElementById('vacation-end');
        if (startEl) startEl.value = '';
        if (endEl)   endEl.value   = '';
        modal.classList.remove('hidden');
      });
    }

    this._bindModalEvents(patientId);
    this._bindDetailDeleteButtons(patientId);
  },

  _bindModalEvents(patientId) {
    // ---- Goal modal ----
    const goalSave   = document.getElementById('pv-goal-save');
    const goalCancel = document.getElementById('pv-goal-cancel');
    if (goalSave) {
      goalSave.addEventListener('click', () => {
        const modal    = document.getElementById('pv-modal-goal');
        const pid      = (modal && modal.dataset.patientid) || patientId;
        const titleEl  = document.getElementById('goal-title');
        const statusEl = document.getElementById('goal-status');
        const title    = titleEl  ? titleEl.value.trim()  : '';
        const status   = statusEl ? statusEl.value        : 'inProgress';
        if (!title) { toast('Podaj tytu\u0142 celu.', 'warning'); return; }
        const patient = getPatient(pid);
        if (!patient) return;
        patient.therapeuticGoals.push({
          id: uuid(), title, status,
          dateSet: new Date().toISOString(), dateAchieved: null, notes: ''
        });
        persistData();
        if (modal) modal.classList.add('hidden');
        toast('Cel dodany.', 'success');
        this._renderDetailPage(pid);
      });
    }
    if (goalCancel) {
      goalCancel.addEventListener('click', () => {
        const modal = document.getElementById('pv-modal-goal');
        if (modal) modal.classList.add('hidden');
      });
    }

    // ---- Note modal ----
    const noteSave   = document.getElementById('pv-note-save');
    const noteCancel = document.getElementById('pv-note-cancel');
    if (noteSave) {
      noteSave.addEventListener('click', () => {
        const modal     = document.getElementById('pv-modal-note');
        const pid       = (modal && modal.dataset.patientid) || patientId;
        const contentEl = document.getElementById('note-content');
        const dateEl    = document.getElementById('note-date');
        const content   = contentEl ? contentEl.value.trim() : '';
        const date      = dateEl    ? dateEl.value           : '';
        if (!content) { toast('Wpisz tre\u015b\u0107 notatki.', 'warning'); return; }
        const patient = getPatient(pid);
        if (!patient) return;
        patient.sessionNotes.push({
          id: uuid(),
          date: date ? new Date(date).toISOString() : new Date().toISOString(),
          content,
          sessionId: null
        });
        persistData();
        if (modal) modal.classList.add('hidden');
        toast('Notatka dodana.', 'success');
        this._renderDetailPage(pid);
      });
    }
    if (noteCancel) {
      noteCancel.addEventListener('click', () => {
        const modal = document.getElementById('pv-modal-note');
        if (modal) modal.classList.add('hidden');
      });
    }

    // ---- Vacation modal ----
    const vacSave   = document.getElementById('pv-vacation-save');
    const vacCancel = document.getElementById('pv-vacation-cancel');
    if (vacSave) {
      vacSave.addEventListener('click', () => {
        const modal   = document.getElementById('pv-modal-vacation');
        const pid     = (modal && modal.dataset.patientid) || patientId;
        const startEl = document.getElementById('vacation-start');
        const endEl   = document.getElementById('vacation-end');
        const start   = startEl ? startEl.value : '';
        const end     = endEl   ? endEl.value   : '';
        if (!start || !end) { toast('Podaj obie daty.', 'warning'); return; }
        if (new Date(start) > new Date(end)) {
          toast('Data "od" musi by\u0107 przed dat\u0105 "do".', 'warning'); return;
        }
        const patient = getPatient(pid);
        if (!patient) return;
        patient.vacationPeriods.push({
          id: uuid(),
          startDate: new Date(start).toISOString(),
          endDate:   new Date(end).toISOString()
        });
        persistData();
        if (modal) modal.classList.add('hidden');
        toast('Urlop dodany.', 'success');
        this._renderDetailPage(pid);
      });
    }
    if (vacCancel) {
      vacCancel.addEventListener('click', () => {
        const modal = document.getElementById('pv-modal-vacation');
        if (modal) modal.classList.add('hidden');
      });
    }
  },

  _bindDetailDeleteButtons(patientId) {
    const container = document.getElementById('view-container');
    if (!container) return;

    // Delete vacation period
    container.querySelectorAll('.pv-row-delete-btn[data-vpid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid  = btn.dataset.patientid || patientId;
        const vpid = btn.dataset.vpid;
        const p    = getPatient(pid);
        if (!p) return;
        p.vacationPeriods = p.vacationPeriods.filter(v => v.id !== vpid);
        persistData();
        toast('Urlop usuni\u0119ty.', 'success');
        this._renderDetailPage(pid);
      });
    });

    // Delete therapeutic goal
    container.querySelectorAll('.pv-row-delete-btn[data-goalid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid    = btn.dataset.patientid || patientId;
        const goalid = btn.dataset.goalid;
        const p      = getPatient(pid);
        if (!p) return;
        p.therapeuticGoals = p.therapeuticGoals.filter(g => g.id !== goalid);
        persistData();
        toast('Cel usuni\u0119ty.', 'success');
        this._renderDetailPage(pid);
      });
    });

    // Delete session note
    container.querySelectorAll('.pv-row-delete-btn[data-noteid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid    = btn.dataset.patientid || patientId;
        const noteid = btn.dataset.noteid;
        const p      = getPatient(pid);
        if (!p) return;
        p.sessionNotes = p.sessionNotes.filter(n => n.id !== noteid);
        persistData();
        toast('Notatka usuni\u0119ta.', 'success');
        this._renderDetailPage(pid);
      });
    });
  },

  // ── BIND EVENTS (form view) ──────────────────────────────────────────────

  _bindFormEvents(patientId) {
    const back = document.getElementById('pv-form-back');
    if (back) {
      back.addEventListener('click', () => {
        if (patientId) Router.navigate('patients', { patientId });
        else           Router.back();
      });
    }

    // Day checkbox <-> time input coupling
    const container = document.getElementById('view-container');
    if (container) {
      container.querySelectorAll('.pv-day-check').forEach(chk => {
        chk.addEventListener('change', () => {
          const dayId  = chk.dataset.dayid;
          const timeEl = container.querySelector('.pv-time-input[data-dayid="' + dayId + '"]');
          if (timeEl) timeEl.disabled = !chk.checked;
        });
      });
    }

    // Form submit
    const form = document.getElementById('pv-patient-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        this.savePatient(new FormData(form));
      });
    }

    // Delete button
    const delBtn = document.getElementById('pv-form-delete');
    if (delBtn) {
      delBtn.addEventListener('click', () => this.deletePatient(patientId));
    }
  },

  // ── BIND EVENTS (archive view) ───────────────────────────────────────────

  _bindArchiveEvents() {
    const back = document.getElementById('pv-back-btn');
    if (back) back.addEventListener('click', () => Router.back());

    const container = document.getElementById('view-container');
    if (!container) return;

    container.querySelectorAll('.pv-btn-restore').forEach(btn => {
      btn.addEventListener('click', () => this.showRestoreForm(btn.dataset.id));
    });

    const confirmBtn = document.getElementById('pv-restore-confirm');
    const cancelBtn  = document.getElementById('pv-restore-cancel');

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const modal   = document.getElementById('pv-modal-restore');
        if (!modal) return;
        const pid     = modal.dataset.patientid;
        const dateEl  = document.getElementById('restore-start-date');
        const dateVal = dateEl ? dateEl.value : '';
        if (!dateVal) { toast('Podaj dat\u0119.', 'warning'); return; }
        this.restorePatient(pid, dateVal);
        modal.classList.add('hidden');
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const modal = document.getElementById('pv-modal-restore');
        if (modal) modal.classList.add('hidden');
      });
    }
  },

  // ── CRUD ─────────────────────────────────────────────────────────────────

  savePatient(formData) {
    const id              = formData.get('id') || null;
    const firstName       = (formData.get('firstName')      || '').trim();
    const lastName        = (formData.get('lastName')       || '').trim();
    const pseudonym       = (formData.get('pseudonym')      || '').trim();
    const startDateRaw    = formData.get('therapyStartDate') || '';
    const sessionRate     = parseFloat(formData.get('sessionRate')) || 0;
    const sessionsPerWeek = parseInt(formData.get('sessionsPerWeek'), 10) || 1;

    // Clear errors
    ['firstName', 'lastName', 'therapyStartDate', 'sessionRate', 'days'].forEach(field => {
      const el = document.getElementById('err-' + field);
      if (el) el.textContent = '';
    });

    let valid = true;
    const setErr = (field, msg) => {
      const el = document.getElementById('err-' + field);
      if (el) el.textContent = msg;
      valid = false;
    };

    if (!firstName)  setErr('firstName',       'Imi\u0119 jest wymagane.');
    if (!lastName)   setErr('lastName',        'Nazwisko jest wymagane.');
    if (!startDateRaw) setErr('therapyStartDate', 'Data jest wymagana.');
    if (isNaN(sessionRate) || sessionRate < 0) setErr('sessionRate', 'Podaj prawid\u0142ow\u0105 stawk\u0119.');

    // Collect selected session days
    const container = document.getElementById('view-container');
    const sessionDayConfigs = [];
    if (container) {
      container.querySelectorAll('.pv-day-check:checked').forEach(chk => {
        const dayId  = parseInt(chk.dataset.dayid, 10);
        const timeEl = container.querySelector('.pv-time-input[data-dayid="' + dayId + '"]');
        const time   = (timeEl && !timeEl.disabled) ? timeEl.value : '10:00';
        sessionDayConfigs.push({ weekday: dayId, sessionTime: time });
      });
    }
    if (sessionDayConfigs.length === 0) setErr('days', 'Wybierz co najmniej jeden dzie\u0144.');

    if (!valid) return;

    const therapyStartDate = new Date(startDateRaw).toISOString();

    if (id) {
      // --- Update existing patient ---
      const patient = getPatient(id);
      if (!patient) { toast('Nie znaleziono pacjenta.', 'error'); return; }
      patient.firstName         = firstName;
      patient.lastName          = lastName;
      patient.pseudonym         = pseudonym;
      patient.therapyStartDate  = therapyStartDate;
      patient.sessionRate       = sessionRate;
      patient.sessionsPerWeek   = sessionsPerWeek;
      patient.sessionDayConfigs = sessionDayConfigs;
      persistData();
      toast('Pacjent zaktualizowany.', 'success');
      Router.navigate('patients', { patientId: id });
    } else {
      // --- Create new patient ---
      const patient = createPatient({
        firstName,
        lastName,
        pseudonym,
        therapyStartDate,
        sessionRate,
        sessionsPerWeek,
        sessionDayConfigs,
      });

      // Create the initial therapy cycle
      patient.therapyCycles.push({
        id:          uuid(),
        startDate:   therapyStartDate,
        endDate:     null,
        cycleNumber: 1,
      });

      AppState.patients.push(patient);

      // Generate sessions for the current month
      generateCurrentMonthSessions(patient);

      persistData();
      toast('Pacjent dodany.', 'success');
      Router.navigate('patients', { patientId: patient.id });
    }
  },

  deletePatient(patientId) {
    const patient = getPatient(patientId);
    if (!patient) return;
    const name = patientDisplayName(patient);
    const doDelete = () => {
      AppState.patients = AppState.patients.filter(p => p.id !== patientId);
      persistData();
      toast('Pacjent usuni\u0119ty.', 'success');
      Router.navigate('patients', {});
    };
    if (typeof Modal !== 'undefined' && Modal.confirm) {
      Modal.confirm(
        'Usu\u0144 pacjenta',
        'Czy na pewno chcesz usun\u0105\u0107 pacjenta \u201e' + name + '\u201d? Wszystkie powi\u0105zane sesje zostan\u0105 zachowane.',
        doDelete
      );
    } else if (window.confirm('Usu\u0144 pacjenta \u201e' + name + '\u201d?')) {
      doDelete();
    }
  },

  archivePatient(patientId) {
    const patient = getPatient(patientId);
    if (!patient) return;
    const name = patientDisplayName(patient);

    const doArchive = () => {
      patient.isArchived   = true;
      patient.isActive     = false;
      patient.archivedDate = new Date().toISOString();

      // Remove future scheduled sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      AppState.sessions = AppState.sessions.filter(s => {
        if (s.patientId !== patientId) return true;
        if (s.status    !== 'scheduled') return true;
        return new Date(s.date) < today;
      });

      // Close the active therapy cycle
      const cycle = getActiveCycle(patient);
      if (cycle) {
        cycle.endDate = new Date().toISOString();
      }

      persistData();
      toast('Pacjent \u201e' + name + '\u201d zarchiwizowany.', 'success');
      Router.navigate('patients', {});
    };

    if (typeof Modal !== 'undefined' && Modal.confirm) {
      Modal.confirm(
        'Archiwizuj pacjenta',
        'Czy na pewno chcesz zarchiwizowa\u0107 pacjenta \u201e' + name + '\u201d? Przysz\u0142e sesje zostan\u0105 usuni\u0119te.',
        doArchive
      );
    } else if (window.confirm('Archiwizuj pacjenta \u201e' + name + '\u201d?')) {
      doArchive();
    }
  },

  restorePatient(patientId, newStartDate) {
    const patient = getPatient(patientId);
    if (!patient) { toast('Nie znaleziono pacjenta.', 'error'); return; }

    patient.isArchived   = false;
    patient.isActive     = true;
    patient.archivedDate = null;

    const startISO = new Date(newStartDate).toISOString();
    const maxCycle = patient.therapyCycles.reduce((m, c) => Math.max(m, c.cycleNumber || 0), 0);
    patient.therapyCycles.push({
      id:          uuid(),
      startDate:   startISO,
      endDate:     null,
      cycleNumber: maxCycle + 1,
    });

    generateCurrentMonthSessions(patient);
    persistData();
    toast('Pacjent przywr\xf3cony.', 'success');
    Router.navigate('patients', { patientId });
  },

  // ── STYLES ───────────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('pv-styles')) return;
    const style = document.createElement('style');
    style.id = 'pv-styles';
    style.textContent = [
      /* Page layout */
      '.pv-page{display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--bg,#f5f5f5)}',
      '.pv-list-wrap{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      /* Search bar */
      '.pv-search-bar{display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;background:#fff;border-bottom:1px solid #e0e0e0}',
      '.pv-search-icon{font-size:1.1rem;color:#888}',
      '.pv-search-input{flex:1;border:none;outline:none;font-size:1rem;background:transparent;color:#222}',
      '.pv-search-input::placeholder{color:#aaa}',
      /* Toolbar */
      '.pv-toolbar{display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;background:#fff;border-bottom:1px solid #e0e0e0;flex-wrap:wrap}',
      '.pv-btn{display:inline-flex;align-items:center;gap:.3rem;padding:.4rem .85rem;border:none;border-radius:.5rem;font-size:.875rem;cursor:pointer;background:#f0f0f0;color:#333;font-weight:500;transition:background .15s}',
      '.pv-btn:hover{background:#e0e0e0}',
      '.pv-btn-add{background:#1976D2;color:#fff}',
      '.pv-btn-add:hover{background:#1565C0}',
      '.pv-btn-primary{background:#1976D2;color:#fff}',
      '.pv-btn-primary:hover{background:#1565C0}',
      '.pv-btn-icon-only{padding:.4rem .7rem;font-size:1.1rem}',
      '.pv-btn--active{background:#1976D2!important;color:#fff!important}',
      '.pv-btn-danger{background:#D32F2F;color:#fff}',
      '.pv-btn-danger:hover{background:#B71C1C}',
      '.pv-btn-restore{background:#388E3C;color:#fff}',
      '.pv-btn-restore:hover{background:#2E7D32}',
      '.pv-btn-sm{padding:.3rem .6rem;font-size:.8rem}',
      '.pv-btn-archive-p{background:#FF8F00;color:#fff}',
      '.pv-btn-archive-p:hover{background:#E65100}',
      /* Sort menu */
      '.pv-sort-wrap{position:relative}',
      '.pv-sort-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:200;background:#fff;border:1px solid #ddd;border-radius:.5rem;box-shadow:0 4px 16px rgba(0,0,0,.12);min-width:190px;overflow:hidden}',
      '.pv-sort-item{display:block;width:100%;padding:.65rem 1rem;text-align:left;border:none;background:transparent;cursor:pointer;font-size:.9rem;color:#333}',
      '.pv-sort-item:hover,.pv-sort-item.active{background:#e3f2fd;color:#1976D2}',
      /* Patient list */
      '.pv-list{list-style:none;margin:0;padding:0}',
      '.pv-row{display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;background:#fff;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background .1s;position:relative}',
      '.pv-row:hover,.pv-row:focus{background:#f5f9ff;outline:none}',
      '.pv-row--archived{opacity:.7}',
      /* Avatar */
      '.pv-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;flex-shrink:0;letter-spacing:.02em}',
      '.pv-avatar--large{width:72px;height:72px;font-size:1.6rem;margin-bottom:.5rem}',
      /* Row body */
      '.pv-row-body{flex:1;min-width:0}',
      '.pv-row-top{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}',
      '.pv-row-name{font-weight:600;font-size:.95rem;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pv-row-debt{background:#D32F2F;color:#fff;font-size:.72rem;font-weight:700;padding:.15rem .45rem;border-radius:999px;white-space:nowrap}',
      '.pv-row-meta{display:flex;align-items:center;gap:.35rem;font-size:.78rem;color:#888;margin-top:.15rem;flex-wrap:wrap}',
      '.pv-row-sep{color:#ccc}',
      '.pv-row-more{background:none;border:none;cursor:pointer;font-size:1.3rem;color:#aaa;padding:.2rem .4rem;border-radius:.3rem;flex-shrink:0}',
      '.pv-row-more:hover{background:#f0f0f0;color:#555}',
      '.pv-row-archived-tag{font-size:.72rem;background:#9E9E9E;color:#fff;padding:.1rem .4rem;border-radius:999px}',
      /* Empty state */
      '.pv-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 2rem;text-align:center;gap:.75rem}',
      '.pv-empty-icon{font-size:3rem}',
      '.pv-empty-msg{font-size:1.1rem;color:#888;margin:0}',
      '.pv-empty-add{margin-top:.5rem}',
      '.pv-empty-sub{color:#aaa;font-size:.85rem;margin:.5rem 0}',
      '.pv-empty-sub--center{text-align:center}',
      /* Context menu */
      '.pv-ctx-menu{position:fixed;z-index:500;background:#fff;border:1px solid #ddd;border-radius:.5rem;box-shadow:0 4px 20px rgba(0,0,0,.15);min-width:160px;overflow:hidden}',
      '.pv-ctx-item{display:block;width:100%;padding:.75rem 1rem;text-align:left;border:none;background:transparent;cursor:pointer;font-size:.9rem;color:#333}',
      '.pv-ctx-item:hover{background:#f0f4ff}',
      '.pv-ctx-item--danger{color:#D32F2F}',
      '.pv-ctx-item--danger:hover{background:#fff0f0}',
      /* Detail page */
      '.pv-page--detail{overflow-y:auto}',
      '.pv-detail-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:#fff;border-bottom:1px solid #e0e0e0;position:sticky;top:0;z-index:10}',
      '.pv-back-btn,.pv-edit-btn{background:none;border:none;color:#1976D2;font-size:.95rem;cursor:pointer;padding:.3rem .5rem;border-radius:.4rem}',
      '.pv-back-btn:hover,.pv-edit-btn:hover{background:#e3f2fd}',
      '.pv-detail-hero{display:flex;flex-direction:column;align-items:center;padding:1.5rem 1rem 1rem;background:#fff;border-bottom:1px solid #f0f0f0}',
      '.pv-detail-name{font-size:1.4rem;font-weight:700;color:#1a1a1a;margin:.25rem 0 0}',
      '.pv-detail-pseudonym{font-size:.9rem;color:#888;margin:.1rem 0 0}',
      '.pv-debt-badge{margin-top:.5rem;background:#D32F2F;color:#fff;font-weight:700;font-size:.85rem;padding:.25rem .75rem;border-radius:999px}',
      '.pv-detail-sections{padding:.5rem 0 2rem}',
      '.pv-section{background:#fff;margin:.75rem;border-radius:.75rem;padding:1rem;box-shadow:0 1px 4px rgba(0,0,0,.06)}',
      '.pv-section-title{font-size:.95rem;font-weight:700;color:#444;margin:0 0 .75rem;display:flex;align-items:center;justify-content:space-between}',
      '.pv-section-add-btn{background:none;border:none;color:#1976D2;font-size:.82rem;cursor:pointer;padding:.15rem .4rem;border-radius:.3rem}',
      '.pv-section-add-btn:hover{background:#e3f2fd}',
      /* Definition list */
      '.pv-dl{display:grid;grid-template-columns:auto 1fr;gap:.35rem .75rem;margin:0;font-size:.88rem}',
      '.pv-dl dt{color:#888}',
      '.pv-dl dd{color:#1a1a1a;font-weight:500;margin:0}',
      /* Schedule */
      '.pv-schedule-list{display:flex;flex-direction:column;gap:.4rem}',
      '.pv-schedule-row{display:flex;justify-content:space-between;font-size:.88rem}',
      '.pv-schedule-day{color:#333;font-weight:500}',
      '.pv-schedule-time{color:#555}',
      /* Sub lists */
      '.pv-vacation-list,.pv-goals-list,.pv-notes-list,.pv-sessions-list{display:flex;flex-direction:column;gap:.4rem}',
      '.pv-vacation-row,.pv-goal-row,.pv-note-row,.pv-sess-row{display:flex;align-items:center;gap:.5rem;font-size:.87rem;padding:.4rem 0;border-bottom:1px solid #f5f5f5}',
      '.pv-vacation-row:last-child,.pv-goal-row:last-child,.pv-note-row:last-child,.pv-sess-row:last-child{border-bottom:none}',
      '.pv-vacation-dates{flex:1;color:#333}',
      '.pv-goal-icon{font-size:1rem;flex-shrink:0}',
      '.pv-goal-title{flex:1;color:#1a1a1a}',
      '.pv-goal-status{font-size:.75rem;padding:.1rem .4rem;border-radius:999px;font-weight:600}',
      '.pv-goal-status--inProgress{background:#E3F2FD;color:#1565C0}',
      '.pv-goal-status--achieved{background:#E8F5E9;color:#2E7D32}',
      '.pv-goal-status--obsolete{background:#F5F5F5;color:#757575}',
      '.pv-note-header{display:flex;align-items:center;gap:.5rem;width:100%}',
      '.pv-note-date{font-size:.78rem;color:#888;flex:1}',
      '.pv-note-preview{margin:.15rem 0 0;color:#555;font-size:.85rem;line-height:1.4;flex:1;word-break:break-word}',
      '.pv-note-row{flex-direction:column;align-items:flex-start}',
      '.pv-row-delete-btn{background:none;border:none;cursor:pointer;color:#ccc;font-size:.85rem;padding:.15rem .35rem;border-radius:.3rem;flex-shrink:0}',
      '.pv-row-delete-btn:hover{background:#fee;color:#D32F2F}',
      '.pv-sess-date{flex:1;color:#555}',
      '.pv-sess-status{font-size:.75rem;font-weight:600;padding:.1rem .4rem;border-radius:999px}',
      '.pv-sess-status--scheduled{background:#E3F2FD;color:#1565C0}',
      '.pv-sess-status--completed{background:#E8F5E9;color:#2E7D32}',
      '.pv-sess-status--cancelled{background:#FFF3E0;color:#E65100}',
      '.pv-sess-paid{color:#2E7D32;font-size:.9rem;margin-left:.25rem}',
      '.pv-detail-actions{display:flex;flex-direction:column;gap:.6rem;margin:.75rem}',
      /* Form page */
      '.pv-page--form{overflow-y:auto;background:#f5f5f5}',
      '.pv-form-title{font-weight:600;font-size:1rem;color:#1a1a1a}',
      '.pv-form{padding:.5rem 0 2rem}',
      '.pv-form-section{background:#fff;margin:.75rem;border-radius:.75rem;padding:1rem;box-shadow:0 1px 4px rgba(0,0,0,.06)}',
      '.pv-form-section-title{font-size:.9rem;font-weight:700;color:#555;margin:0 0 .85rem;text-transform:uppercase;letter-spacing:.04em}',
      '.pv-form-label{display:flex;flex-direction:column;gap:.35rem;margin-bottom:.85rem;font-size:.88rem;color:#555}',
      '.pv-form-label:last-child{margin-bottom:0}',
      '.pv-form-input{border:1.5px solid #ddd;border-radius:.5rem;padding:.55rem .75rem;font-size:.95rem;color:#1a1a1a;outline:none;transition:border-color .15s;background:#fff}',
      '.pv-form-input:focus{border-color:#1976D2}',
      '.pv-form-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%23888\' stroke-width=\'1.5\' fill=\'none\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2rem}',
      '.pv-form-textarea{resize:vertical;min-height:90px}',
      '.pv-form-error{color:#D32F2F;font-size:.78rem;min-height:1em}',
      '.pv-required{color:#D32F2F}',
      '.pv-form-actions{display:flex;flex-direction:column;gap:.6rem;padding:0 .75rem}',
      '.pv-day-toggles{display:flex;flex-direction:column;gap:.4rem}',
      '.pv-form-day-row{display:flex;align-items:center;gap:.75rem}',
      '.pv-day-toggle{display:flex;align-items:center;gap:.5rem;cursor:pointer;flex:1;font-size:.9rem;color:#333}',
      '.pv-day-toggle input[type=checkbox]{width:1.1rem;height:1.1rem;accent-color:#1976D2;cursor:pointer}',
      '.pv-day-label{font-weight:500}',
      '.pv-time-input{border:1.5px solid #ddd;border-radius:.4rem;padding:.35rem .5rem;font-size:.88rem;color:#1a1a1a;width:95px}',
      '.pv-time-input:disabled{opacity:.35;pointer-events:none}',
      /* Modals */
      '.pv-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:1rem}',
      '.pv-modal.hidden{display:none}',
      '.pv-modal-box{background:#fff;border-radius:1rem;padding:1.5rem;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.2)}',
      '.pv-modal-title{font-size:1.05rem;font-weight:700;color:#1a1a1a;margin:0 0 1rem}',
      '.pv-modal-desc{font-size:.88rem;color:#666;margin:0 0 .85rem}',
      '.pv-modal-actions{display:flex;gap:.6rem;margin-top:1rem}',
      '.pv-modal-actions .pv-btn{flex:1;justify-content:center}',
      /* Utility */
      '.hidden{display:none!important}',
    ].join('');
    document.head.appendChild(style);
  },
};

// =============================================================================
// Global entry-point called by renderPatients() in app.js
// =============================================================================

function renderPatients(params) {
  params = params || {};
  if (typeof PatientViews !== 'undefined' && typeof PatientViews.render === 'function') {
    PatientViews.render(params);
  }
}
