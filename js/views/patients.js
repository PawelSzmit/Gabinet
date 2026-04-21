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

function getClinicalFieldState(value, options = {}) {
  if (typeof SecurityService !== 'undefined'
      && typeof SecurityService.getClinicalDisplayState === 'function') {
    return SecurityService.getClinicalDisplayState(value, options);
  }

  const emptyLabel = options.emptyLabel || 'Brak danych.';
  if (typeof value === 'string') {
    return {
      hasData: value.trim().length > 0,
      isProtected: false,
      text: value.trim().length > 0 ? value : emptyLabel,
      rawText: value,
    };
  }

  return {
    hasData: false,
    isProtected: false,
    text: emptyLabel,
    rawText: '',
  };
}

function clinicalDataUnlocked() {
  return typeof SecurityService !== 'undefined'
    && typeof SecurityService.canReadClinicalData === 'function'
    && SecurityService.canReadClinicalData();
}

function clinicalActionLabel() {
  if (typeof SecurityService !== 'undefined'
      && typeof SecurityService.getClinicalActionLabel === 'function') {
    return SecurityService.getClinicalActionLabel();
  }
  return 'Odblokuj notatki';
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
    // view-specific routes must be checked before patientId,
    // because edit passes both { view:'edit', patientId }
    if (params.view === 'archive') {
      this._renderArchivePage();
      return;
    }
    if (params.view === 'add' || params.view === 'edit') {
      this._currentPatientId = params.patientId || null;
      this._renderFormPage(params.patientId || null);
      return;
    }
    if (params.patientId) {
      this._currentPatientId = params.patientId;
      this._renderDetailPage(params.patientId);
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
        '<div class="pv-sort-wrap">' +
          '<button class="pv-btn pv-btn-sort" id="pv-btn-sort">' +
            escHtml(sortLabel) + ' &#9660;' +
          '</button>' +
          '<div class="pv-sort-menu hidden" id="pv-sort-menu">' +
            sortItems +
          '</div>' +
        '</div>' +
        '<button class="pv-btn pv-btn-debt' + debtActive + '" id="pv-btn-debt" title="Tylko zad\u0142u\u017ceni">D\u0142ug</button>' +
        '<button class="pv-btn pv-btn-archive-link" id="pv-btn-archive">Archiwum</button>' +
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
    const legalName        = ((patient.firstName || '') + ' ' + (patient.lastName || '')).trim();
    const days             = sessionDayLabels(patient);
    const duration         = getPatientTherapyDuration(patient);
    const debt             = getPatientDebt(patient.id);
    const completedCount   = getCompletedSessionsCount(patient.id);
    const debtBadge        = debt.total > 0
      ? '<span class="pv-row-debt">' + escHtml(formatPLN(debt.total)) + '</span>'
      : '';
    const nameMeta = patient.pseudonym
      ? '<div class="pv-row-legal">' + escHtml(legalName) + '</div>'
      : '';

    return (
      '<li class="pv-row" data-id="' + escHtml(patient.id) + '" tabindex="0" role="button"' +
          ' aria-label="' + escHtml(display) + '">' +
        '<div class="pv-avatar" style="background:' + color + '">' + escHtml(initials) + '</div>' +
        '<div class="pv-row-body">' +
          '<div class="pv-row-top">' +
            '<span class="pv-row-name">' + escHtml(display) + '</span>' +
            (patient.pseudonym ? '<span class="pv-row-privacy">pseudonim</span>' : '') +
            debtBadge +
          '</div>' +
          nameMeta +
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
    const prevTotal      = (patient.previousTherapies || []).reduce((s, t) => s + (parseInt(t.sessionsCount, 10) || 0), 0);
    const sessionDisplay = prevTotal > 0 ? completedCount + ' (' + (completedCount + prevTotal) + ')' : String(completedCount);
    const lastTen        = sessions.slice().reverse().slice(0, 12);
    const display        = patientDisplayName(patient);
    const initials       = patientInitials(patient);
    const color          = avatarColor(patient.firstName || patient.pseudonym);
    const duration       = getPatientTherapyDuration(patient);
    const fullName       = ((patient.firstName || '') + ' ' + (patient.lastName || '')).trim();
    const sessionNotesWithContent = sessions.filter(s => typeof SecurityService !== 'undefined'
      ? SecurityService.hasClinicalContent(s.sessionNotes)
      : !!(typeof s.sessionNotes === 'string' && s.sessionNotes.trim()));
    const notesCount     = (patient.sessionNotes || []).length + sessionNotesWithContent.length;
    const goalsCount     = (patient.therapeuticGoals || []).length;
    const progressCount  = (patient.progressEntries || []).length;
    const debtAmount     = debt.total > 0 ? formatPLN(debt.total) : 'Brak zaległości';
    const cancelledSessions = sessions.filter(s => s.status === 'cancelled');
    const cancelVacation    = cancelledSessions.filter(s => s.cancellationReason === 'patient_vacation').length;
    const cancelPatient     = cancelledSessions.filter(s => s.cancellationReason === 'patient_late').length;
    const cancelTherapist   = cancelledSessions.filter(s => s.cancellationReason === 'therapist').length;
    const cancelOther       = cancelledSessions.filter(s => !s.cancellationReason).length;
    const cancelTotal       = cancelledSessions.length;
    const clinicalUnlocked  = clinicalDataUnlocked();

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
          '<p class="pv-detail-pseudonym">' + escHtml(fullName) + '</p>' +
          '<div class="pv-detail-badges">' +
            '<span class="pv-debt-badge">' + escHtml(debtAmount) + '</span>' +
          '</div>' +
          '<div class="pv-overview-stats">' +
            '<article class="pv-overview-stat"><span>Czas terapii</span><strong>' + escHtml(duration) + '</strong></article>' +
            '<article class="pv-overview-stat"><span>Sesje</span><strong>' + sessionDisplay + '</strong></article>' +
            '<article class="pv-overview-stat"><span>Notatki</span><strong>' + notesCount + '</strong></article>' +
            '<article class="pv-overview-stat"><span>Cele</span><strong>' + goalsCount + '</strong></article>' +
          '</div>' +
        '</div>' +

        '<nav class="pv-workspace-nav" aria-label="Sekcje pacjenta">' +
          '<a class="pv-workspace-chip" href="#pv-overview">Przegląd</a>' +
          '<a class="pv-workspace-chip" href="#pv-sessions">Sesje</a>' +
          '<a class="pv-workspace-chip" href="#pv-clinical">Kliniczne</a>' +
          '<a class="pv-workspace-chip" href="#pv-history">Historia</a>' +
        '</nav>' +

        '<div class="pv-detail-sections">' +

          '<section class="pv-section pv-section--workspace" id="pv-overview">' +
            '<h2 class="pv-section-title">Przegląd</h2>' +
            '<div class="pv-workspace-grid">' +
              '<article class="pv-panel-card">' +
                '<h3>Tożsamość i ustawienia terapii</h3>' +
                '<dl class="pv-dl">' +
                  '<dt>Imi\u0119</dt><dd>' + escHtml(patient.firstName) + '</dd>' +
                  '<dt>Nazwisko</dt><dd>' + escHtml(patient.lastName) + '</dd>' +
                  pseudonymDl +
                  '<dt>Stawka sesji</dt><dd>' + escHtml(formatPLN(patient.sessionRate)) + '</dd>' +
                  '<dt>Sesje w tygodniu</dt><dd>' + escHtml(String(patient.sessionsPerWeek)) + '</dd>' +
                '</dl>' +
              '</article>' +
              '<article class="pv-panel-card">' +
                '<h3>Przebieg terapii</h3>' +
                '<dl class="pv-dl">' +
                  '<dt>Pocz\u0105tek terapii</dt><dd>' + escHtml(formatDateLong(patient.therapyStartDate)) + '</dd>' +
                  '<dt>Czas trwania</dt><dd>' + escHtml(duration) + '</dd>' +
                  '<dt>Uko\u0144czone sesje</dt><dd>' + sessionDisplay + '</dd>' +
                  '<dt>Zaległości</dt><dd>' + escHtml(debtAmount) + '</dd>' +
                '</dl>' +
              '</article>' +
              '<article class="pv-panel-card pv-panel-card--wide">' +
                '<h3>Rytm spotkań</h3>' +
                this._renderScheduleSection(patient) +
              '</article>' +
            '</div>' +
          '</section>' +

          '<section class="pv-section pv-section--workspace" id="pv-sessions">' +
            '<h2 class="pv-section-title">Sesje</h2>' +
            '<div class="pv-workspace-grid">' +
              '<article class="pv-panel-card pv-panel-card--wide">' +
                '<h3>Ostatnie sesje</h3>' +
                this._renderSessionsSection(lastTen) +
              '</article>' +
              '<article class="pv-panel-card">' +
                '<h3>Urlopy i przerwy ' +
                  '<button class="pv-section-add-btn" id="pv-add-vacation" data-id="' + escHtml(patientId) + '">+ Dodaj</button>' +
                '</h3>' +
                this._renderVacationsSection(patient) +
              '</article>' +
            '</div>' +
          '</section>' +

          '<section class="pv-section pv-section--workspace" id="pv-clinical">' +
            '<h2 class="pv-section-title">Kliniczne</h2>' +
            '<div class="pv-workspace-grid">' +
              (clinicalUnlocked
                ? (
                  '<article class="pv-panel-card">' +
                    '<h3>Cele terapeutyczne ' +
                      '<button class="pv-section-add-btn" id="pv-add-goal" data-id="' + escHtml(patientId) + '">+ Dodaj</button>' +
                    '</h3>' +
                    this._renderGoalsSection(patient) +
                  '</article>' +
                  '<article class="pv-panel-card pv-panel-card--wide">' +
                    '<h3>Notatki i obserwacje ' +
                      '<button class="pv-section-add-btn" id="pv-add-note" data-id="' + escHtml(patientId) + '">+ Dodaj</button>' +
                    '</h3>' +
                    this._renderNotesSection(patient) +
                  '</article>'
                )
                : (
                  '<article class="pv-panel-card pv-panel-card--wide">' +
                    this._renderClinicalLockCard(
                      'Dane kliniczne sa zablokowane',
                      'Aby zobaczyc albo edytowac notatki, cele i obserwacje, podaj haslo do danych klinicznych.'
                    ) +
                  '</article>'
                )) +
            '</div>' +
          '</section>' +

          '<section class="pv-section pv-section--workspace" id="pv-history">' +
            '<h2 class="pv-section-title">Historia</h2>' +
            '<div class="pv-workspace-grid">' +
              '<article class="pv-panel-card">' +
                '<h3>Odwołane sesje</h3>' +
                (cancelTotal > 0
                  ? '<dl class="pv-dl">' +
                      '<dt>Łącznie</dt><dd>' + cancelTotal + '</dd>' +
                      (cancelVacation > 0 ? '<dt>Urlop pacjenta</dt><dd>' + cancelVacation + '</dd>' : '') +
                      (cancelPatient > 0 ? '<dt>Odwołane przez pacjenta</dt><dd>' + cancelPatient + '</dd>' : '') +
                      (cancelTherapist > 0 ? '<dt>Odwołane przez terapeutę</dt><dd>' + cancelTherapist + '</dd>' : '') +
                      (cancelOther > 0 ? '<dt>Bez kategorii</dt><dd>' + cancelOther + '</dd>' : '') +
                    '</dl>'
                  : '<p class="pv-empty-msg" style="padding:8px 0">Brak odwołanych sesji.</p>') +
              '</article>' +
              '<article class="pv-panel-card">' +
                '<h3>Wpisy postępów</h3>' +
                (clinicalUnlocked
                  ? this._renderProgressSection(patient)
                  : this._renderClinicalLockCard(
                      'Historia postepow jest zablokowana',
                      'Wpisy kliniczne wroca po odblokowaniu danych klinicznych.'
                    )) +
              '</article>' +
              '<article class="pv-panel-card">' +
                '<h3>Cykle terapii</h3>' +
                this._renderTherapyCyclesSection(patient) +
              '</article>' +
            '</div>' +
            '<div class="pv-detail-actions">' +
              '<button class="pv-btn pv-btn-archive-p" id="pv-archive-btn" data-id="' + escHtml(patientId) + '">' +
                'Archiwizuj pacjenta' +
              '</button>' +
              '<button class="pv-btn pv-btn-danger" id="pv-delete-btn" data-id="' + escHtml(patientId) + '">' +
                'Usu\u0144 pacjenta' +
              '</button>' +
            '</div>' +
          '</section>' +

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
      const titleState = getClinicalFieldState(g.title, {
        emptyLabel: '(bez tytulu)',
        protectedLabel: 'Cel terapeutyczny zabezpieczony',
      });
      return (
        '<div class="pv-goal-row" data-goalid="' + escHtml(g.id) + '">' +
          '<span class="pv-goal-icon">' + (icons[g.status] || '&#9203;') + '</span>' +
          '<span class="pv-goal-title">' + escHtml(titleState.text) + '</span>' +
          '<span class="pv-goal-status pv-goal-status--' + escHtml(g.status) + '">' + escHtml(statusName) + '</span>' +
          '<button class="pv-row-delete-btn" data-goalid="' + escHtml(g.id) + '"' +
            ' data-patientid="' + escHtml(patient.id) + '" title="Usu\u0144 cel">&#10005;</button>' +
        '</div>'
      );
    }).join('');
    return '<div class="pv-goals-list">' + rows + '</div>';
  },

  _renderNotesSection(patient) {
    // Combine manual notes and calendar session notes into one chronological list
    const manualNotes = (patient.sessionNotes || []).map(n => ({
      date:    n.date,
      type:    'manual',
      id:      n.id,
      content: n.content,
    }));

    const sessionNotes = getPatientSessions(patient.id)
      .filter(s => typeof SecurityService !== 'undefined'
        ? SecurityService.hasClinicalContent(s.sessionNotes)
        : !!(typeof s.sessionNotes === 'string' && s.sessionNotes.trim()))
      .map(s => ({
        date:    s.date,
        type:    'session',
        id:      s.id,
        content: s.sessionNotes,
      }));

    // Oldest first — newest at the bottom, like a notebook
    const all = manualNotes.concat(sessionNotes)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (all.length === 0) {
      return '<p class="pv-empty-sub">Brak notatek.</p>';
    }

    const rows = all.map(item => {
      const isSession  = item.type === 'session';
      const contentState = getClinicalFieldState(item.content, {
        emptyLabel: '(pusta notatka)',
        protectedLabel: 'Dane kliniczne sa zablokowane.',
      });
      const dataAttr   = isSession
        ? 'data-sessionnoteid="' + escHtml(item.id) + '"'
        : 'data-noteid="' + escHtml(item.id) + '"';
      const typeTag    = isSession
        ? '<span class="pv-note-type-tag">Sesja</span>'
        : '';
      const deleteBtn  = isSession
        ? ''
        : '<button class="pv-row-delete-btn" data-noteid="' + escHtml(item.id) + '"' +
            ' data-patientid="' + escHtml(patient.id) + '" title="Usu\u0144 notatk\u0119">&#10005;</button>';
      return (
        '<div class="pv-note-row" ' + dataAttr + '>' +
          '<div class="pv-note-header">' +
            '<span class="pv-note-date">' + escHtml(formatDateMedium(item.date)) + '</span>' +
            typeTag +
            deleteBtn +
          '</div>' +
          '<p class="pv-note-body">' + escHtml(contentState.text) + '</p>' +
        '</div>'
      );
    }).join('');

    return '<div class="pv-notes-list">' + rows + '</div>';
  },

  _renderClinicalLockCard(title, description) {
    return (
      '<div class="pv-clinical-guard">' +
        '<div class="pv-clinical-guard__icon">🔒</div>' +
        '<h4 class="pv-clinical-guard__title">' + escHtml(title) + '</h4>' +
        '<p class="pv-clinical-guard__text">' + escHtml(description) + '</p>' +
        '<button class="pv-btn pv-btn-add pv-clinical-unlock-btn" type="button">' + escHtml(clinicalActionLabel()) + '</button>' +
      '</div>'
    );
  },

  _renderSessionsSection(sessions) {
    if (sessions.length === 0) {
      return '<p class="pv-empty-sub">Brak sesji.</p>';
    }
    const statusLabels = { scheduled: 'Planowana', completed: 'Uko\u0144czona', cancelled: 'Odwo\u0142ana' };
    const rows = sessions.map(s => {
      const label  = statusLabels[s.status] || s.status;
      const cls    = 'pv-sess-status--' + (s.status || 'scheduled');
      const paid   = s.isPaid
        ? '<span class="pv-sess-paid">&#10003;</span>'
        : s.isPartiallyPaid
          ? '<span class="pv-sess-partial">Częściowo opłacona (' + escHtml(formatPLN(s.partialPaymentAmount)) + ')</span>'
          : '';
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

  _renderProgressSection(patient) {
    if (!patient.progressEntries || patient.progressEntries.length === 0) {
      return '<p class="pv-empty-sub">Brak wpisów postępu.</p>';
    }
    const rows = patient.progressEntries.slice().reverse().map(entry => {
      const titleState = getClinicalFieldState(entry.title, {
        emptyLabel: 'Wpis',
        protectedLabel: 'Tytul wpisu zabezpieczony',
      });
      const contentState = getClinicalFieldState(entry.content, {
        emptyLabel: '',
        protectedLabel: 'Tresc wpisu jest zablokowana.',
      });
      return (
        '<div class="pv-note-row">' +
          '<div class="pv-note-header">' +
            '<span class="pv-note-date">' + escHtml(formatDateMedium(entry.date)) + '</span>' +
            '<span class="pv-goal-status pv-goal-status--inProgress">' + escHtml(entry.category || 'Wpis') + '</span>' +
          '</div>' +
          '<p class="pv-note-preview"><strong>' + escHtml(titleState.text) + '</strong><br>' + escHtml(contentState.text) + '</p>' +
        '</div>'
      );
    }).join('');
    return '<div class="pv-notes-list">' + rows + '</div>';
  },

  _renderTherapyCyclesSection(patient) {
    const cycles   = Array.isArray(patient.therapyCycles)    ? patient.therapyCycles    : [];
    const prevs    = Array.isArray(patient.previousTherapies) ? patient.previousTherapies : [];

    if (cycles.length === 0 && prevs.length === 0) {
      return '<p class="pv-empty-sub">Brak zapisanych cykli terapii.</p>';
    }

    // Current / app-managed cycles (newest first)
    const cycleRows = cycles.slice().reverse().map(cycle => (
      '<div class="pv-sess-row">' +
        '<span class="pv-sess-date">Cykl ' + escHtml(String(cycle.cycleNumber || '—')) + '</span>' +
        '<span class="pv-row-duration">' + escHtml(formatDateShort(cycle.startDate)) + ' – ' + escHtml(cycle.endDate ? formatDateShort(cycle.endDate) : 'trwa') + '</span>' +
      '</div>'
    )).join('');

    // Previous therapies entered manually (oldest first, to mirror form order)
    const prevRows = prevs.map((t, i) => {
      const dateRange = (t.startDate ? escHtml(formatDateShort(t.startDate)) : '?')
        + ' – '
        + (t.endDate ? escHtml(formatDateShort(t.endDate)) : '?');
      const sessionsBadge = t.sessionsCount
        ? '<span class="pv-cycle-sessions-badge">' + escHtml(String(t.sessionsCount)) + ' sesji</span>'
        : '';
      return (
        '<div class="pv-sess-row">' +
          '<span class="pv-sess-date">Poprzednia terapia' + (prevs.length > 1 ? ' ' + (i + 1) : '') + '</span>' +
          '<span class="pv-row-duration">' + dateRange + sessionsBadge + '</span>' +
        '</div>'
      );
    }).join('');

    const separator = (cycleRows && prevRows)
      ? '<div class="pv-cycle-separator"></div>'
      : '';

    return '<div class="pv-sessions-list">' + cycleRows + separator + prevRows + '</div>';
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

    const freqOptions = [
      [1, 'Co tydzie\u0144'],
      [2, 'Co 2 tygodnie'],
      [4, 'Co 4 tygodnie'],
      [6, 'Co 6 tygodni'],
      [8, 'Co 8 tygodni'],
    ].map(([val, label]) =>
      '<option value="' + val + '"' + ((p.sessionFrequencyWeeks || 1) === val ? ' selected' : '') + '>' + label + '</option>'
    ).join('');

    const anchorDateVal = p.sessionFrequencyAnchorDate
      ? new Date(p.sessionFrequencyAnchorDate).toISOString().split('T')[0]
      : (p.therapyStartDate ? new Date(p.therapyStartDate).toISOString().split('T')[0] : '');

    const anchorHidden = (p.sessionFrequencyWeeks || 1) === 1 ? ' hidden' : '';

    const isIrregular    = p.isIrregular || false;
    const scheduleHidden = isIrregular ? ' hidden' : '';

    const startDate = p.therapyStartDate
      ? new Date(p.therapyStartDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const deleteBtn = isEdit
      ? '<button type="button" class="pv-btn pv-btn-danger" id="pv-form-delete" data-id="' + escHtml(p.id || '') + '">Usu\u0144</button>'
      : '';

    const prevTherapies = Array.isArray(p.previousTherapies) ? p.previousTherapies : [];
    const prevTherapyCount = prevTherapies.length;
    const prevTherapyRows = prevTherapies.map((t, i) => {
      const startVal = t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '';
      const endVal   = t.endDate   ? new Date(t.endDate).toISOString().split('T')[0]   : '';
      const sessVal  = t.sessionsCount !== undefined ? String(t.sessionsCount) : '';
      return (
        '<div class="pv-prev-therapy-row" data-index="' + i + '">' +
          '<input type="hidden" class="pt-id" value="' + escHtml(t.id || '') + '">' +
          '<div class="pv-prev-therapy-fields">' +
            '<label class="pv-form-label pv-form-label--inline"><span>Od</span>' +
              '<input type="date" class="pv-form-input pt-start" value="' + escHtml(startVal) + '"></label>' +
            '<label class="pv-form-label pv-form-label--inline"><span>Do</span>' +
              '<input type="date" class="pv-form-input pt-end" value="' + escHtml(endVal) + '"></label>' +
            '<label class="pv-form-label pv-form-label--inline"><span>Sesji</span>' +
              '<input type="number" class="pv-form-input pt-sessions" value="' + escHtml(sessVal) + '" min="0" placeholder="0"></label>' +
          '</div>' +
        '</div>'
      );
    }).join('');

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
            '<label class="pv-form-label pv-form-label--checkbox">' +
              '<input type="checkbox" name="isIrregular" id="pv-irregular-check"' +
                (isIrregular ? ' checked' : '') + '>' +
              '<span>Pacjent o nieregularnym terminarzu</span>' +
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

          '<section class="pv-form-section' + scheduleHidden + '" id="pv-schedule-section">' +
            '<h3 class="pv-form-section-title">Harmonogram</h3>' +
            '<label class="pv-form-label">' +
              '<span>Sesje w tygodniu</span>' +
              '<select name="sessionsPerWeek" class="pv-form-input pv-form-select">' +
                spwOptions +
              '</select>' +
            '</label>' +
            '<label class="pv-form-label">' +
              '<span>Cz\u0119stotliwo\u015b\u0107 spotka\u0144</span>' +
              '<select name="sessionFrequencyWeeks" id="pv-freq-select" class="pv-form-input pv-form-select">' +
                freqOptions +
              '</select>' +
            '</label>' +
            '<label class="pv-form-label' + anchorHidden + '" id="pv-anchor-date-row">' +
              '<span>Od jakiego dnia liczy\u0107 interwa\u0142? <span class="pv-required">*</span></span>' +
              '<input type="date" name="sessionFrequencyAnchorDate" id="pv-anchor-date"' +
                ' class="pv-form-input" value="' + escHtml(anchorDateVal) + '">' +
              '<span class="pv-form-error" id="err-anchorDate"></span>' +
            '</label>' +
            '<div class="pv-form-label">' +
              '<span>Dni sesji</span>' +
              '<div class="pv-day-toggles" id="pv-day-toggles">' +
                dayToggles +
              '</div>' +
              '<span class="pv-form-error" id="err-days"></span>' +
            '</div>' +
          '</section>' +

          '<section class="pv-form-section">' +
            '<h3 class="pv-form-section-title">Poprzednie terapie</h3>' +
            '<label class="pv-form-label">' +
              '<span>Liczba poprzednich terapii</span>' +
              '<input type="number" id="pv-prev-therapy-count" class="pv-form-input"' +
                ' min="0" max="20" value="' + prevTherapyCount + '" placeholder="0">' +
            '</label>' +
            '<div id="pv-prev-therapies-rows">' + prevTherapyRows + '</div>' +
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

    document.querySelectorAll('.pv-clinical-unlock-btn').forEach((clinicalUnlockBtn) => {
      clinicalUnlockBtn.addEventListener('click', async () => {
        if (typeof SecurityService === 'undefined') return;
        const ok = await SecurityService.requestClinicalAccess();
        if (ok) this._renderDetailPage(patientId);
      });
    });

    // Add goal
    const addGoal = document.getElementById('pv-add-goal');
    if (addGoal) {
      addGoal.addEventListener('click', async () => {
        if (typeof SecurityService !== 'undefined') {
          const ok = await SecurityService.requestClinicalAccess();
          if (!ok) return;
        }
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
      addNote.addEventListener('click', async () => {
        if (typeof SecurityService !== 'undefined') {
          const ok = await SecurityService.requestClinicalAccess();
          if (!ok) return;
        }
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
      goalSave.addEventListener('click', async () => {
        if (typeof SecurityService !== 'undefined') {
          const ok = await SecurityService.requestClinicalAccess();
          if (!ok) return;
        }
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
      noteSave.addEventListener('click', async () => {
        if (typeof SecurityService !== 'undefined') {
          const ok = await SecurityService.requestClinicalAccess();
          if (!ok) return;
        }
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
        const vpStart = new Date(start);
        const vpEnd   = new Date(end);
        vpStart.setHours(0, 0, 0, 0);
        vpEnd.setHours(23, 59, 59, 999);

        const newVacation = {
          id: uuid(),
          startDate: vpStart.toISOString(),
          endDate:   vpEnd.toISOString()
        };
        patient.vacationPeriods.push(newVacation);


        // Cancel existing scheduled sessions within vacation range
        let cancelled = 0;
        if (typeof applyVacationCancellations === 'function') {
          cancelled = applyVacationCancellations(patient, newVacation);
        } else {
          AppState.sessions.forEach(s => {
            if (s.patientId !== patient.id) return;
            if (s.status !== 'scheduled') return;
            const sd = new Date(s.date);
            if (sd >= vpStart && sd <= vpEnd) {
              s.status = 'cancelled';
              s.cancellationReason = 'patient_vacation';
              s.isPaymentRequired = false;
              cancelled++;
            }
          });
        }

        persistData();
        if (modal) modal.classList.add('hidden');
        toast('Urlop dodany.' + (cancelled > 0 ? ' Odwo\u0142ano ' + cancelled + ' sesji.' : ''), 'success');
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
        const removed = p.vacationPeriods.find(v => v.id === vpid);
        p.vacationPeriods = p.vacationPeriods.filter(v => v.id !== vpid);

        // Restore cancelled-by-vacation sessions within the removed period
        if (removed) {
          const vpStart = new Date(removed.startDate);
          const vpEnd   = new Date(removed.endDate);
          vpStart.setHours(0, 0, 0, 0);
          vpEnd.setHours(23, 59, 59, 999);
          getSessions().forEach(s => {
            if (s.patientId !== pid) return;
            if (s.status !== 'cancelled' || s.cancellationReason !== 'patient_vacation') return;
            const sd = new Date(s.date);
            if (sd >= vpStart && sd <= vpEnd) {
              s.status = 'scheduled';
              s.cancellationReason = null;
              s.isPaymentRequired = true;
            }
          });
        }

        persistData();
        toast('Urlop usuni\u0119ty.', 'success');
        this._renderDetailPage(pid);
      });
    });

    // Delete therapeutic goal
    container.querySelectorAll('.pv-row-delete-btn[data-goalid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (typeof SecurityService !== 'undefined') {
          const ok = await SecurityService.requestClinicalAccess();
          if (!ok) return;
        }
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
      btn.addEventListener('click', async () => {
        if (typeof SecurityService !== 'undefined') {
          const ok = await SecurityService.requestClinicalAccess();
          if (!ok) return;
        }
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

      // Frequency toggle: show/hide anchor date field
      const freqSelect = container.querySelector('#pv-freq-select');
      const anchorRow  = container.querySelector('#pv-anchor-date-row');
      if (freqSelect && anchorRow) {
        freqSelect.addEventListener('change', () => {
          const isWeekly = parseInt(freqSelect.value, 10) === 1;
          anchorRow.classList.toggle('hidden', isWeekly);
        });
      }

      // Irregular patient toggle: show/hide schedule section
      const irregularCheck  = container.querySelector('#pv-irregular-check');
      const scheduleSection = container.querySelector('#pv-schedule-section');
      if (irregularCheck && scheduleSection) {
        irregularCheck.addEventListener('change', () => {
          scheduleSection.classList.toggle('hidden', irregularCheck.checked);
        });
      }
    }

    // Previous therapies count → generate / remove rows
    const prevCountEl = document.getElementById('pv-prev-therapy-count');
    const prevRowsEl  = document.getElementById('pv-prev-therapies-rows');
    if (prevCountEl && prevRowsEl) {
      prevCountEl.addEventListener('input', () => {
        const target  = Math.max(0, Math.min(20, parseInt(prevCountEl.value, 10) || 0));
        const current = prevRowsEl.querySelectorAll('.pv-prev-therapy-row').length;
        if (target > current) {
          for (let i = current; i < target; i++) {
            const row = document.createElement('div');
            row.className   = 'pv-prev-therapy-row';
            row.dataset.index = i;
            row.innerHTML   =
              '<input type="hidden" class="pt-id" value="">' +
              '<div class="pv-prev-therapy-fields">' +
                '<label class="pv-form-label pv-form-label--inline"><span>Od</span>' +
                  '<input type="date" class="pv-form-input pt-start"></label>' +
                '<label class="pv-form-label pv-form-label--inline"><span>Do</span>' +
                  '<input type="date" class="pv-form-input pt-end"></label>' +
                '<label class="pv-form-label pv-form-label--inline"><span>Sesji</span>' +
                  '<input type="number" class="pv-form-input pt-sessions" min="0" placeholder="0"></label>' +
              '</div>';
            prevRowsEl.appendChild(row);
          }
        } else {
          const rows = prevRowsEl.querySelectorAll('.pv-prev-therapy-row');
          for (let i = target; i < rows.length; i++) rows[i].remove();
        }
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
    const sessionFrequencyWeeks = parseInt(formData.get('sessionFrequencyWeeks'), 10) || 1;
    const sessionFrequencyAnchorRaw = formData.get('sessionFrequencyAnchorDate') || '';
    const isIrregular     = formData.get('isIrregular') === 'on' || false;

    // Clear errors
    ['firstName', 'lastName', 'therapyStartDate', 'sessionRate', 'days', 'anchorDate'].forEach(field => {
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

    if (sessionFrequencyWeeks > 1 && !sessionFrequencyAnchorRaw) {
      setErr('anchorDate', 'Podaj dat\u0119 pocz\u0105tku interwa\u0142u.');
    }

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

    // Collect previousTherapies from dynamic rows
    const previousTherapies = [];
    const prevRowsContainer = document.getElementById('pv-prev-therapies-rows');
    if (prevRowsContainer) {
      prevRowsContainer.querySelectorAll('.pv-prev-therapy-row').forEach(row => {
        const idEl       = row.querySelector('.pt-id');
        const startEl    = row.querySelector('.pt-start');
        const endEl      = row.querySelector('.pt-end');
        const sessionsEl = row.querySelector('.pt-sessions');
        const therapyId  = (idEl && idEl.value) ? idEl.value : uuid();
        const startDate  = (startEl  && startEl.value)  ? new Date(startEl.value).toISOString()  : null;
        const endDate    = (endEl    && endEl.value)    ? new Date(endEl.value).toISOString()    : null;
        const sessionsCount = parseInt((sessionsEl && sessionsEl.value) || '0', 10) || 0;
        previousTherapies.push({ id: therapyId, startDate, endDate, sessionsCount });
      });
    }

    if (id) {
      // --- Update existing patient ---
      const patient = getPatient(id);
      if (!patient) { toast('Nie znaleziono pacjenta.', 'error'); return; }
      patient.firstName          = firstName;
      patient.lastName           = lastName;
      patient.pseudonym          = pseudonym;
      patient.therapyStartDate   = therapyStartDate;
      patient.sessionRate        = sessionRate;
      patient.sessionsPerWeek    = sessionsPerWeek;
      patient.sessionDayConfigs  = sessionDayConfigs;
      patient.previousTherapies  = previousTherapies;
      patient.sessionFrequencyWeeks      = sessionFrequencyWeeks;
      patient.sessionFrequencyAnchorDate = sessionFrequencyWeeks > 1 && sessionFrequencyAnchorRaw
        ? new Date(sessionFrequencyAnchorRaw).toISOString()
        : null;
      patient.isIrregular = isIrregular;
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
        sessionFrequencyWeeks,
        sessionFrequencyAnchorDate: sessionFrequencyWeeks > 1 && sessionFrequencyAnchorRaw
          ? new Date(sessionFrequencyAnchorRaw).toISOString()
          : null,
        sessionDayConfigs,
        previousTherapies,
        isIrregular,
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
      '.pv-page{display:flex;flex-direction:column;background:transparent;padding:18px 18px calc(var(--tab-bar-height) + 30px);font-family:var(--font-sans,"Manrope",sans-serif)}',
      '.pv-list-wrap{}',
      '.pv-search-bar,.pv-section,.pv-form-section,.pv-modal-box,.pv-ctx-menu{background:color-mix(in srgb,var(--surface-raised,#f7f2eb) 92%, transparent);border:1px solid var(--border,rgba(73,102,79,.14));box-shadow:var(--shadow-sm)}',
      '.pv-search-bar{display:flex;align-items:center;gap:.75rem;padding:16px 18px;border-radius:24px}',
      '.pv-search-icon{font-size:1.1rem;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.pv-search-input{flex:1;border:none;outline:none;font-size:1rem;background:transparent;color:var(--text,#243126)}',
      '.pv-search-input::placeholder{color:var(--text-tertiary,rgba(36,49,38,.44))}',
      '.pv-toolbar{display:flex;align-items:center;gap:.5rem;padding:10px 0;flex-wrap:wrap}',
      '.pv-btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;padding:.78rem 1rem;border:none;border-radius:999px;font-size:.84rem;cursor:pointer;background:rgba(255,255,255,.68);color:var(--text,#243126);font-weight:800;transition:transform .15s ease,background .15s ease,opacity .15s ease}',
      '.pv-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.9)}',
      '.pv-btn-add,.pv-btn-primary{background:linear-gradient(135deg,var(--blue,#49664f),#617f68);color:var(--text-inverse,#f6f0e6)}',
      '.pv-btn-icon-only{padding:.75rem .9rem;font-size:1.05rem}',
      '.pv-btn-archive-link{margin-left:auto;color:var(--text-secondary,rgba(36,49,38,.6));font-weight:600;font-size:.8rem}',
      '.pv-btn--active{background:var(--blue,#49664f)!important;color:var(--text-inverse,#f6f0e6)!important}',
      '.pv-btn-danger{background:linear-gradient(135deg,var(--red,#bf6152),#a95246);color:#fff}',
      '.pv-btn-restore{background:linear-gradient(135deg,var(--green,#6b9073),#7ca484);color:#fff}',
      '.pv-btn-sm{padding:.58rem .8rem;font-size:.78rem}',
      '.pv-btn-archive-p{background:linear-gradient(135deg,var(--orange,#cc8b56),#c97c46);color:#fff}',
      '.pv-sort-wrap{position:relative}',
      '.pv-sort-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:200;background:var(--surface-raised,#f7f2eb);border:1px solid var(--border,rgba(73,102,79,.14));border-radius:18px;box-shadow:var(--shadow-md);min-width:220px;overflow:hidden}',
      '.pv-sort-item{display:block;width:100%;padding:.9rem 1rem;text-align:left;border:none;background:transparent;cursor:pointer;font-size:.9rem;color:var(--text,#243126)}',
      '.pv-sort-item:hover,.pv-sort-item.active{background:rgba(255,255,255,.7);color:var(--blue,#49664f)}',
      '.pv-list{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:12px}',
      '.pv-row{display:flex;align-items:center;gap:14px;padding:16px 18px;background:color-mix(in srgb,var(--surface-raised,#f7f2eb) 92%, transparent);border:1px solid var(--border,rgba(73,102,79,.14));border-radius:24px;cursor:pointer;transition:transform .14s ease,box-shadow .14s ease;position:relative;box-shadow:var(--shadow-sm)}',
      '.pv-row:hover,.pv-row:focus{transform:translateY(-1px);box-shadow:var(--shadow-md);outline:none}',
      '.pv-row--archived{opacity:.8}',
      '.pv-avatar{width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1rem;flex-shrink:0;letter-spacing:.02em;box-shadow:0 10px 18px rgba(31,43,35,.14)}',
      '.pv-avatar--large{width:84px;height:84px;font-size:1.8rem;margin-bottom:.8rem;border-radius:26px}',
      '.pv-row-body{flex:1;min-width:0}',
      '.pv-row-top{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}',
      '.pv-row-name{font-size:1.05rem;font-weight:800;color:var(--text,#243126);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pv-row-legal{margin-top:3px;font-size:.82rem;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.pv-row-privacy{display:inline-flex;align-items:center;padding:.2rem .5rem;border-radius:999px;background:var(--blue-light,#dbe7d7);color:var(--blue,#49664f);font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}',
      '.pv-row-debt,.pv-debt-badge{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--red,#bf6152),#a95246);color:#fff;font-size:.74rem;font-weight:800;padding:.28rem .6rem;border-radius:999px;white-space:nowrap}',
      '.pv-debt-badge--soft{background:var(--blue-light,#dbe7d7);color:var(--blue,#49664f)}',
      '.pv-row-meta{display:flex;align-items:center;gap:.35rem;font-size:.78rem;color:var(--text-secondary,rgba(36,49,38,.68));margin-top:.28rem;flex-wrap:wrap}',
      '.pv-row-sep{color:var(--text-tertiary,rgba(36,49,38,.44))}',
      '.pv-row-more{background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--text-secondary,rgba(36,49,38,.68));padding:.3rem .45rem;border-radius:999px;flex-shrink:0}',
      '.pv-row-more:hover{background:rgba(255,255,255,.7);color:var(--text,#243126)}',
      '.pv-row-archived-tag{font-size:.72rem;background:var(--text-tertiary,rgba(36,49,38,.44));color:#fff;padding:.18rem .48rem;border-radius:999px}',
      '.pv-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;text-align:center;gap:.9rem}',
      '.pv-empty-icon{font-size:3rem}',
      '.pv-empty-msg{font-size:1.08rem;color:var(--text-secondary,rgba(36,49,38,.68));margin:0}',
      '.pv-empty-add{margin-top:.5rem}',
      '.pv-empty-sub{color:var(--text-secondary,rgba(36,49,38,.68));font-size:.85rem;margin:.4rem 0}',
      '.pv-empty-sub--center{text-align:center}',
      '.pv-ctx-menu{position:fixed;z-index:500;border-radius:18px;min-width:180px;overflow:hidden}',
      '.pv-ctx-item{display:block;width:100%;padding:.85rem 1rem;text-align:left;border:none;background:transparent;cursor:pointer;font-size:.9rem;color:var(--text,#243126)}',
      '.pv-ctx-item:hover{background:rgba(255,255,255,.7)}',
      '.pv-ctx-item--danger{color:var(--red,#bf6152)}',
      '.pv-page--detail,.pv-page--form{overflow-y:auto;scrollbar-width:none}',
      '.pv-page--detail::-webkit-scrollbar,.pv-page--form::-webkit-scrollbar{display:none}',
      '.pv-detail-header{display:flex;align-items:center;justify-content:space-between;padding:16px 2px 10px;position:sticky;top:0;z-index:20;background:linear-gradient(180deg,var(--bg,transparent) 72%, transparent)}',
      '.pv-back-btn,.pv-edit-btn{background:rgba(255,255,255,.68);border:none;color:var(--blue,#49664f);font-size:.92rem;font-weight:800;cursor:pointer;padding:.72rem .95rem;border-radius:999px}',
      '.pv-back-btn:hover,.pv-edit-btn:hover{background:rgba(255,255,255,.92)}',
      '.pv-detail-hero{display:flex;flex-direction:column;align-items:center;padding:26px 22px;background:color-mix(in srgb,var(--surface-raised,#f7f2eb) 92%, transparent);border:1px solid var(--border,rgba(73,102,79,.14));border-radius:30px;box-shadow:var(--shadow-md)}',
      '.pv-detail-name{font-family:var(--font-display,"Fraunces",serif);font-size:clamp(2rem,4vw,3rem);line-height:.95;color:var(--text,#243126);margin:.25rem 0 0;letter-spacing:-.06em;text-align:center}',
      '.pv-detail-pseudonym{font-size:.92rem;color:var(--text-secondary,rgba(36,49,38,.68));margin:.32rem 0 0;text-align:center}',
      '.pv-detail-badges{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center;margin-top:1rem}',
      '.pv-overview-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;width:100%;margin-top:18px}',
      '.pv-overview-stat{padding:14px;border-radius:20px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1));text-align:left}',
      '.pv-overview-stat span{display:block;font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--text-secondary,rgba(36,49,38,.68));margin-bottom:6px}',
      '.pv-overview-stat strong{font-size:1rem;color:var(--text,#243126)}',
      '.pv-workspace-nav{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 0;padding:0 2px 2px}',
      '.pv-workspace-chip{display:inline-flex;align-items:center;padding:.75rem 1rem;border-radius:999px;background:rgba(255,255,255,.68);color:var(--blue,#49664f);font-size:.82rem;font-weight:800;border:1px solid var(--border,rgba(73,102,79,.12))}',
      '.pv-detail-sections{padding:.85rem 0 2rem;display:grid;gap:14px}',
      '.pv-section{margin:0;border-radius:28px;padding:22px}',
      '.pv-section--workspace{scroll-margin-top:88px}',
      '.pv-section-title{font-size:1rem;font-weight:800;color:var(--text,#243126);margin:0 0 1rem;display:flex;align-items:center;justify-content:space-between}',
      '.pv-workspace-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '.pv-panel-card{padding:18px;border-radius:22px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1))}',
      '.pv-panel-card--wide{grid-column:1 / -1}',
      '.pv-panel-card h3{margin:0 0 12px;font-size:1rem;color:var(--text,#243126)}',
      '.pv-section-add-btn{background:none;border:none;color:var(--blue,#49664f);font-size:.82rem;font-weight:800;cursor:pointer;padding:.15rem .4rem;border-radius:999px}',
      '.pv-section-add-btn:hover{background:var(--blue-light,#dbe7d7)}',
      '.pv-dl{display:grid;grid-template-columns:auto 1fr;gap:.42rem .85rem;margin:0;font-size:.9rem}',
      '.pv-dl dt{color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.pv-dl dd{color:var(--text,#243126);font-weight:600;margin:0;text-align:right}',
      '.pv-schedule-list,.pv-vacation-list,.pv-goals-list,.pv-notes-list,.pv-sessions-list{display:flex;flex-direction:column;gap:.55rem}',
      '.pv-schedule-row,.pv-vacation-row,.pv-goal-row,.pv-note-row,.pv-sess-row{display:flex;align-items:center;gap:.6rem;font-size:.88rem;padding:.7rem 0;border-bottom:1px solid var(--separator,rgba(73,102,79,.12))}',
      '.pv-schedule-row:last-child,.pv-vacation-row:last-child,.pv-goal-row:last-child,.pv-note-row:last-child,.pv-sess-row:last-child{border-bottom:none}',
      '.pv-schedule-row{justify-content:space-between}',
      '.pv-schedule-day,.pv-goal-title{color:var(--text,#243126);font-weight:600}',
      '.pv-schedule-time,.pv-vacation-dates,.pv-sess-date,.pv-row-duration{color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.pv-cycle-sessions-badge{margin-left:.4rem;font-size:.75rem;font-weight:700;background:rgba(73,102,79,.1);color:var(--green,#49664f);border-radius:999px;padding:.1rem .5rem;white-space:nowrap}',
      '.pv-cycle-separator{height:1px;background:var(--separator,rgba(73,102,79,.18));margin:.4rem 0}',
      '.pv-clinical-guard{padding:1.25rem;border:1px dashed rgba(73,102,79,.24);border-radius:20px;background:rgba(73,102,79,.04);display:flex;flex-direction:column;align-items:flex-start;gap:.75rem}',
      '.pv-clinical-guard__icon{font-size:1.35rem}',
      '.pv-clinical-guard__title{margin:0;font-size:1rem;color:var(--text,#243126)}',
      '.pv-clinical-guard__text{margin:0;color:var(--text-secondary,rgba(36,49,38,.68));font-size:.9rem;line-height:1.6}',
      '.pv-goal-icon{font-size:1rem;flex-shrink:0}',
      '.pv-goal-status{font-size:.74rem;padding:.2rem .48rem;border-radius:999px;font-weight:800}',
      '.pv-goal-status--inProgress{background:var(--blue-light,#dbe7d7);color:var(--blue,#49664f)}',
      '.pv-goal-status--achieved{background:var(--green-light,#e5f0e4);color:var(--green,#6b9073)}',
      '.pv-goal-status--obsolete{background:rgba(36,49,38,.08);color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.pv-note-row{flex-direction:column;align-items:flex-start}',
      '.pv-note-header{display:flex;align-items:center;gap:.5rem;width:100%}',
      '.pv-note-date{font-size:.78rem;color:var(--text-secondary,rgba(36,49,38,.68));flex:1}',
      '.pv-note-preview{margin:0;color:var(--text-secondary,rgba(36,49,38,.68));font-size:.86rem;line-height:1.6;flex:1;word-break:break-word}',
      '.pv-note-preview strong{color:var(--text,#243126)}',
      '.pv-row-delete-btn{background:none;border:none;cursor:pointer;color:var(--text-tertiary,rgba(36,49,38,.44));font-size:.85rem;padding:.2rem .35rem;border-radius:999px;flex-shrink:0}',
      '.pv-row-delete-btn:hover{background:var(--red-light,#f4ddd8);color:var(--red,#bf6152)}',
      '.pv-sess-status{font-size:.74rem;font-weight:800;padding:.2rem .48rem;border-radius:999px}',
      '.pv-sess-status--scheduled{background:var(--blue-light,#dbe7d7);color:var(--blue,#49664f)}',
      '.pv-sess-status--completed{background:var(--green-light,#e5f0e4);color:var(--green,#6b9073)}',
      '.pv-sess-status--cancelled{background:var(--orange-light,#f6e4d5);color:var(--orange,#cc8b56)}',
      '.pv-sess-paid{color:var(--green,#6b9073);font-size:.9rem;margin-left:.25rem}',
      '.pv-sess-partial{color:var(--orange,#cc8b56);font-size:.9rem;margin-left:.25rem;cursor:help}',
      '.pv-detail-actions{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:12px}',
      '.pv-history-footnote{margin-top:12px;font-size:.84rem;color:var(--text-secondary,rgba(36,49,38,.68));line-height:1.6}',
      '.pv-form{padding:.85rem 0 2rem;display:grid;gap:14px}',
      '.pv-form-title{font-weight:800;font-size:1rem;color:var(--text,#243126)}',
      '.pv-form-section{margin:0;border-radius:24px;padding:18px}',
      '.pv-form-section-title{font-size:.82rem;font-weight:800;color:var(--text-secondary,rgba(36,49,38,.68));margin:0 0 1rem;text-transform:uppercase;letter-spacing:.08em}',
      '.pv-form-label{display:flex;flex-direction:column;gap:.45rem;margin-bottom:.85rem;font-size:.88rem;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.pv-form-label:last-child{margin-bottom:0}',
      '.pv-form-input,.pv-time-input{border:1.5px solid var(--border,rgba(73,102,79,.14));border-radius:16px;padding:.8rem .95rem;font-size:.95rem;color:var(--text,#243126);outline:none;transition:border-color .15s ease,box-shadow .15s ease;background:rgba(255,255,255,.72)}',
      '.pv-form-input:focus,.pv-time-input:focus{border-color:var(--blue,#49664f);box-shadow:0 0 0 3px rgba(73,102,79,.12)}',
      '.pv-form-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%2349664f\' stroke-width=\'1.5\' fill=\'none\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .9rem center;padding-right:2.4rem}',
      '.pv-form-textarea{resize:vertical;min-height:90px}',
      '.pv-form-error{color:var(--red,#bf6152);font-size:.78rem;min-height:1em}',
      '.pv-required{color:var(--red,#bf6152)}',
      '.pv-form-actions{display:flex;flex-wrap:wrap;gap:.6rem}',
      '.pv-day-toggles{display:flex;flex-direction:column;gap:.55rem}',
      '.pv-form-day-row{display:flex;align-items:center;gap:.75rem}',
      '.pv-day-toggle{display:flex;align-items:center;gap:.5rem;cursor:pointer;flex:1;font-size:.9rem;color:var(--text,#243126)}',
      '.pv-day-toggle input[type=checkbox]{width:1.1rem;height:1.1rem;accent-color:var(--blue,#49664f);cursor:pointer}',
      '.pv-day-label{font-weight:600}',
      '.pv-time-input:disabled{opacity:.35;pointer-events:none}',
      '.pv-note-body{font-size:.9rem;color:var(--text,#243126);line-height:1.65;margin:6px 0 0;white-space:pre-wrap;word-break:break-word}',
      '.pv-note-type-tag{font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--blue,#49664f);background:rgba(73,102,79,.1);border-radius:6px;padding:2px 7px;margin-left:6px}',
      '.pv-prev-therapy-row{border:1.5px solid var(--border,rgba(73,102,79,.14));border-radius:16px;padding:12px 14px;margin-bottom:10px;background:rgba(255,255,255,.5)}',
      '.pv-prev-therapy-fields{display:grid;grid-template-columns:1fr 1fr 80px;gap:.6rem;align-items:end}',
      '.pv-form-label--inline{margin-bottom:0}',
      '.pv-form-label--checkbox{flex-direction:row;align-items:center;gap:.6rem}',
      '.pv-form-label--checkbox input[type=checkbox]{width:1.1rem;height:1.1rem;accent-color:var(--blue,#49664f);cursor:pointer;flex-shrink:0;margin:0}',
      '.pv-form-label--checkbox span{margin:0;color:var(--text,#243126)}',
      '@media (max-width:520px){.pv-prev-therapy-fields{grid-template-columns:1fr 1fr;}.pv-prev-therapy-fields .pv-form-label--inline:last-child{grid-column:1 / -1}}',
      '.pv-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(14,18,15,.4);padding:1rem}',
      '.pv-modal.hidden{display:none}',
      '.pv-modal-box{border-radius:28px;padding:1.5rem;width:100%;max-width:420px}',
      '.pv-modal-title{font-size:1.08rem;font-weight:800;color:var(--text,#243126);margin:0 0 1rem}',
      '.pv-modal-desc{font-size:.88rem;color:var(--text-secondary,rgba(36,49,38,.68));margin:0 0 .85rem}',
      '.pv-modal-actions{display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap}',
      '.pv-modal-actions .pv-btn{flex:1}',
      '@media (max-width: 880px){.pv-page{padding:14px 14px calc(var(--tab-bar-height) + 24px)}.pv-workspace-grid{grid-template-columns:1fr}.pv-overview-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (max-width: 640px){.pv-overview-stats{grid-template-columns:1fr}.pv-detail-actions,.pv-form-actions,.pv-modal-actions{flex-direction:column}.pv-detail-actions .pv-btn,.pv-form-actions .pv-btn,.pv-modal-actions .pv-btn{width:100%}}',
      '@media (prefers-color-scheme: dark){.pv-search-bar,.pv-toolbar,.pv-section,.pv-form-section,.pv-modal-box,.pv-ctx-menu,.pv-row,.pv-detail-hero{background:color-mix(in srgb,var(--surface-raised,#223128) 88%, transparent)}.pv-panel-card,.pv-overview-stat,.pv-workspace-chip,.pv-btn,.pv-back-btn,.pv-edit-btn,.pv-form-input,.pv-time-input{background:rgba(255,255,255,.04)}.pv-search-input,.pv-row-name,.pv-detail-name,.pv-panel-card h3,.pv-schedule-day,.pv-goal-title,.pv-form-title,.pv-modal-title{color:var(--text,#f4ede4)}.pv-row-legal,.pv-row-meta,.pv-detail-pseudonym,.pv-empty-msg,.pv-empty-sub,.pv-dl dt,.pv-note-date,.pv-note-preview,.pv-sess-date,.pv-row-duration,.pv-history-footnote,.pv-form-label,.pv-modal-desc{color:var(--text-secondary,rgba(244,237,228,.72))}.pv-dl dd{color:var(--text,#f4ede4)}.pv-row:hover,.pv-row:focus{box-shadow:var(--shadow-md)}.pv-row-delete-btn:hover{background:rgba(209,123,114,.12)}.pv-debt-badge--soft,.pv-row-privacy{background:rgba(220,194,157,.12);color:var(--blue,#dcc29d)}}',
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
