'use strict';

// ─── AutoLock ─────────────────────────────────────────────────────────────────
const AutoLock = {
  timer:   null,
  timeout: 120_000, // 2 minutes

  start() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.lock(), this.timeout);
  },

  reset() {
    this.start();
  },

  lock() {
    clearTimeout(this.timer);
    this.timer = null;
    // Re-use a dedicated lock screen element if available; otherwise fall
    // back to showing the auth screen (token stays in memory).
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
      lockScreen.hidden = false;
      const pinInput = document.getElementById('lock-pin-input');
      if (pinInput) pinInput.focus();
    } else {
      App.hideApp();
      App.showAuth(true /* isLock */);
    }
  },

  unlock() {
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) lockScreen.hidden = true;
    this.start();
  },

  init() {
    const events = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    events.forEach(evt =>
      document.addEventListener(evt, () => this.reset(), { passive: true })
    );
    this.start();
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────
const Router = {
  currentView: 'calendar',
  _history:    [],

  navigate(view, params = {}) {
    this._history.push({ view: this.currentView });
    this.currentView = view;
    App.showView(view, params);
    App._updateTabBar(view);
  },

  back() {
    const prev = this._history.pop();
    if (prev) {
      this.currentView = prev.view;
      App.showView(prev.view, {});
      App._updateTabBar(prev.view);
    }
  },
};

// ─── App ──────────────────────────────────────────────────────────────────────
const App = {
  _lockMode: false,

  // ── init ──────────────────────────────────────────────────────────────────
  async init() {
    this.showSplash();

    // Wait for Google Identity Services script, then init DriveService.
    await this._waitForGIS();
    DriveService.init();

    // Minimum splash display time (UX).
    await this._sleep(1500);

    const hasToken = DriveService.loadStoredToken();
    if (hasToken) {
      try {
        await DriveService.loadData();
        this._afterSignIn();
      } catch (err) {
        console.warn('[App] Could not load Drive data on startup:', err);
        // Still show the app with whatever local state we have.
        this._afterSignIn();
      }
    } else {
      this.hideSplash();
      this.showAuth(false);
    }

    // Wire up the Google sign-in button.
    const signInBtn = document.getElementById('btn-google-signin');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => this._handleSignInClick());
    }

    // Lock screen PIN / re-auth submit.
    const pinForm = document.getElementById('lock-pin-form');
    if (pinForm) {
      pinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handlePinSubmit();
      });
    }

    // Sign-out button (top-level, outside settings view).
    const signOutBtn = document.getElementById('btn-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => this._handleSignOut());
    }
  },

  // ── _waitForGIS ───────────────────────────────────────────────────────────
  _waitForGIS() {
    return new Promise((resolve) => {
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }
      const interval = setInterval(() => {
        if (window.google && window.google.accounts) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      // Resolve anyway after 5 s to avoid an infinite wait when the script
      // is blocked (e.g. ad-blockers, offline).
      setTimeout(() => { clearInterval(interval); resolve(); }, 5000);
    });
  },

  // ── _afterSignIn ──────────────────────────────────────────────────────────
  _afterSignIn() {
    this.hideSplash();
    this.hideAuth();
    this.showApp();
    this._generateSessionsIfNeeded();
    // AutoLock.init(); //wyłączone
    Router.navigate('calendar');
  },

  // ── onSignIn ──────────────────────────────────────────────────────────────
  async onSignIn(token) {
    this.showSplash();
    try {
      await DriveService.loadData();
    } catch (err) {
      console.warn('[App] Drive load after sign-in failed:', err);
    }
    this._afterSignIn();
  },

  // ── _handleSignInClick ────────────────────────────────────────────────────
  async _handleSignInClick() {
    const btn = document.getElementById('btn-google-signin');
    if (btn) { btn.disabled = true; btn.textContent = 'Łączenie\u2026'; }

    try {
      const token = await DriveService.requestToken();
      await this.onSignIn(token);
    } catch (err) {
      console.error('[App] Sign-in failed:', err);
      const authError = document.getElementById('auth-error');
      if (authError) {
        authError.textContent = 'Logowanie nie powiodło się. Spróbuj ponownie.';
        authError.hidden = false;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Zaloguj przez Google';
      }
    }
  },

  // ── _handleSignOut ────────────────────────────────────────────────────────
  _handleSignOut() {
    Modal.confirm(
      'Wylogowanie',
      'Czy na pewno chcesz się wylogować? Dane lokalne zostaną zachowane na Drive.',
      () => {
        DriveService.signOut();
        this.hideApp();
        this.showAuth(false);
      }
    );
  },

  // ── _handlePinSubmit ──────────────────────────────────────────────────────
  // Uses Google token refresh as the "unlock" mechanism instead of a PIN.
  _handlePinSubmit() {
    DriveService.requestToken()
      .then(() => AutoLock.unlock())
      .catch(() => {
        const msg = document.getElementById('lock-error-msg');
        if (msg) { msg.textContent = 'Nie udało się zweryfikować tożsamości.'; }
      });
  },

  // ── splash / auth / app visibility ───────────────────────────────────────
  showSplash()  { this._show('splash-screen'); },
  hideSplash()  { this._hide('splash-screen'); },

  showAuth(isLock = false) {
    this._lockMode = isLock;
    const screen = document.getElementById('auth-screen');
    if (screen) {
      screen.hidden = false;
      const title = screen.querySelector('.auth-title');
      if (title) {
        title.textContent = isLock ? 'Ekran blokady' : 'Gabinet';
      }
    }
  },
  hideAuth() { this._hide('auth-screen'); },

  showApp()  { this._show('app-shell'); },
  hideApp()  { this._hide('app-shell'); },

  // ── showView ──────────────────────────────────────────────────────────────
  showView(name, params = {}) {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.classList.add('view-transitioning');

    requestAnimationFrame(() => {
      switch (name) {
        case 'calendar': renderCalendar(params); break;
        case 'patients': renderPatients(params); break;
        case 'finance':  renderFinance(params);  break;
        case 'settings': renderSettings(params); break;
        default:
          container.innerHTML =
            '<p class="view-error">Nieznany widok: ' + name + '</p>';
      }
      container.classList.remove('view-transitioning');
    });
  },

  // ── switchTab ─────────────────────────────────────────────────────────────
  switchTab(name) {
    Router.navigate(name);
  },

  // ── _updateTabBar ─────────────────────────────────────────────────────────
  _updateTabBar(activeView) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isActive = btn.dataset.view === activeView;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  },

  // ── _generateSessionsIfNeeded ─────────────────────────────────────────────
  // Ensures the current calendar month has session slots for every patient
  // whose schedule is active. Delegates to data.js helpers when available.
  _generateSessionsIfNeeded() {
    if (typeof generateCurrentMonthSessions !== 'function') return;

    const now       = new Date();
    const yearMonth = now.getFullYear() + '-' +
                      String(now.getMonth() + 1).padStart(2, '0');

    if (typeof AppState !== 'undefined' && AppState.generatedMonths) {
      if (AppState.generatedMonths.includes(yearMonth)) return;
    }

    // Generate sessions for all active patients.
    if (typeof AppState !== 'undefined' && AppState.patients) {
      AppState.patients
        .filter(function(p) { return !p.isArchived && p.isActive; })
        .forEach(function(p) { generateCurrentMonthSessions(p); });
    }

    if (typeof AppState !== 'undefined') {
      AppState.generatedMonths = AppState.generatedMonths || [];
      AppState.generatedMonths.push(yearMonth);
    }

    persistData();
  },

  // ── helpers ───────────────────────────────────────────────────────────────
  _show(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  },

  _hide(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  },

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};

// ─── View renderers ───────────────────────────────────────────────────────────
// Each function injects HTML into #view-container and attaches its own event
// listeners. Heavy logic lives in dedicated view files (calendar.js,
// patients.js, …). The stubs below ensure the app works even if those files
// have not yet been loaded.

function renderCalendar(params) {
  params = params || {};
  const container = document.getElementById('view-container');
  if (!container) return;

  if (typeof CalendarViews !== 'undefined' &&
      typeof CalendarViews.render === 'function') {
    CalendarViews.render();
    return;
  }

  // Fallback minimal calendar built inline.
  const now    = params.date ? new Date(params.date) : new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth();
  const MONTHS = [
    'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
    'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
  ];

  const sessions = (typeof AppState !== 'undefined' && AppState.sessions)
    ? AppState.sessions.filter(function(s) {
        const d = new Date(s.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
    : [];

  const rows = _buildCalendarGrid(year, month, sessions);

  container.innerHTML =
    '<div class="view-calendar">' +
      '<div class="calendar-header">' +
        '<button class="btn-icon" id="cal-prev" aria-label="Poprzedni miesiąc">&#8249;</button>' +
        '<h2 class="calendar-month-title">' + MONTHS[month] + ' ' + year + '</h2>' +
        '<button class="btn-icon" id="cal-next" aria-label="Następny miesiąc">&#8250;</button>' +
      '</div>' +
      '<table class="calendar-grid" role="grid" aria-label="Kalendarz">' +
        '<thead><tr>' +
          ['Pon','Wt','Śr','Czw','Pt','Sob','Nd']
            .map(function(d) { return '<th scope="col">' + d + '</th>'; }).join('') +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '<section class="session-list" id="session-list-panel" aria-live="polite"></section>' +
    '</div>';

  document.getElementById('cal-prev').addEventListener('click', function() {
    const d = new Date(year, month - 1, 1);
    Router.navigate('calendar', { date: d.toISOString() });
  });
  document.getElementById('cal-next').addEventListener('click', function() {
    const d = new Date(year, month + 1, 1);
    Router.navigate('calendar', { date: d.toISOString() });
  });

  container.querySelectorAll('.cal-day[data-date]').forEach(function(cell) {
    cell.addEventListener('click', function() {
      _showSessionsForDay(cell.dataset.date);
    });
  });

  // Highlight today and auto-open its sessions.
  const todayStr  = _isoDate(new Date());
  const todayCell = container.querySelector('.cal-day[data-date="' + todayStr + '"]');
  if (todayCell) todayCell.classList.add('cal-day--today');
  _showSessionsForDay(todayStr);
}

function _buildCalendarGrid(year, month, sessions) {
  const firstDay   = new Date(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0);
  // Monday-first week (0 = Mon, 6 = Sun).
  const startDow   = (firstDay.getDay() + 6) % 7;
  const sessionDates = {};
  sessions.forEach(function(s) {
    if (s.date) sessionDates[s.date.slice(0, 10)] = true;
  });

  var rows = '<tr>';

  // Leading empty cells.
  for (var i = 0; i < startDow; i++) {
    rows += '<td class="cal-day cal-day--empty"></td>';
  }

  for (var day = 1; day <= lastDay.getDate(); day++) {
    const date    = _isoDate(new Date(year, month, day));
    const hasSess = !!sessionDates[date];
    const dow     = (startDow + day - 1) % 7;
    const isWknd  = dow >= 5;

    var cls = 'cal-day';
    if (isWknd)  cls += ' cal-day--weekend';
    if (hasSess) cls += ' cal-day--has-sessions';

    rows +=
      '<td class="' + cls + '"' +
          ' data-date="' + date + '"' +
          ' tabindex="0"' +
          ' role="gridcell"' +
          ' aria-label="' + day + ' ' + year + '">' +
        '<span class="cal-day-number">' + day + '</span>' +
        (hasSess ? '<span class="cal-dot" aria-hidden="true"></span>' : '') +
      '</td>';

    if (dow === 6 && day < lastDay.getDate()) rows += '</tr><tr>';
  }

  // Trailing empty cells.
  const totalCells = startDow + lastDay.getDate();
  const remainder  = totalCells % 7;
  if (remainder !== 0) {
    for (var j = remainder; j < 7; j++) {
      rows += '<td class="cal-day cal-day--empty"></td>';
    }
  }

  rows += '</tr>';
  return rows;
}

function _showSessionsForDay(dateStr) {
  const panel = document.getElementById('session-list-panel');
  if (!panel) return;

  const sessions = (typeof AppState !== 'undefined' && AppState.sessions)
    ? AppState.sessions.filter(function(s) {
        return (s.date || '').slice(0, 10) === dateStr;
      })
    : [];

  if (sessions.length === 0) {
    panel.innerHTML =
      '<p class="session-list__empty">Brak wizyt w dniu ' +
      _formatDatePL(dateStr) + '.</p>';
    return;
  }

  var items = sessions.map(function(s) {
    const patient = _findPatient(s.patientId);
    const name    = patient
      ? patient.firstName + ' ' + patient.lastName
      : 'Nieznany pacjent';
    const status  = _sessionStatusLabel(s.status);
    return (
      '<article class="session-item session-item--' + (s.status || 'scheduled') + '"' +
               ' data-id="' + s.id + '"' +
               ' tabindex="0"' +
               ' role="button"' +
               ' aria-label="Wizyta: ' + _escapeHtml(name) + ' o ' + (s.time || '') + '">' +
        '<div class="session-item__time">' + (s.time || '--:--') + '</div>' +
        '<div class="session-item__info">' +
          '<span class="session-item__patient">' + _escapeHtml(name) + '</span>' +
          '<span class="session-item__status">' + status + '</span>' +
        '</div>' +
        '<div class="session-item__fee">' +
          (s.fee != null ? s.fee + ' zł' : '') +
        '</div>' +
      '</article>'
    );
  }).join('');

  panel.innerHTML =
    '<h3 class="session-list__date">' + _formatDatePL(dateStr) + '</h3>' +
    '<div class="session-list__items">' + items + '</div>' +
    '<button class="btn btn--primary session-list__add"' +
            ' id="btn-add-session"' +
            ' data-date="' + dateStr + '">' +
      '+ Dodaj wizytę' +
    '</button>';

  panel.querySelectorAll('.session-item').forEach(function(el) {
    el.addEventListener('click', function() { _openSessionSheet(el.dataset.id); });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') _openSessionSheet(el.dataset.id);
    });
  });

  const addBtn = document.getElementById('btn-add-session');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      _openNewSessionSheet(dateStr);
    });
  }
}

// ── renderPatients ─────────────────────────────────────────────────────────
function renderPatients(params) {
  params = params || {};
  const container = document.getElementById('view-container');
  if (!container) return;

  if (typeof PatientViews !== 'undefined' &&
      typeof PatientViews.render === 'function') {
    PatientViews.render(params);
    return;
  }

  const patients = (typeof AppState !== 'undefined' && AppState.patients)
    ? AppState.patients : [];
  const query    = (params.q || '').toLowerCase();
  const list     = query
    ? patients.filter(function(p) {
        return (p.firstName + ' ' + p.lastName).toLowerCase().includes(query);
      })
    : patients;

  var listHtml;
  if (list.length > 0) {
    listHtml = list.map(function(p) {
      return (
        '<li class="patient-item" data-id="' + p.id + '"' +
            ' tabindex="0" role="button"' +
            ' aria-label="' + _escapeHtml(p.firstName) +
            ' ' + _escapeHtml(p.lastName) + '">' +
          '<div class="patient-item__avatar" aria-hidden="true">' +
            _initials(p.firstName, p.lastName) +
          '</div>' +
          '<div class="patient-item__info">' +
            '<span class="patient-item__name">' +
              _escapeHtml(p.firstName) + ' ' + _escapeHtml(p.lastName) +
            '</span>' +
            '<span class="patient-item__meta">' +
              (p.phone ? _escapeHtml(p.phone) : '') +
            '</span>' +
          '</div>' +
        '</li>'
      );
    }).join('');
  } else {
    listHtml = '<li class="patient-list__empty">Brak pacjentów.</li>';
  }

  container.innerHTML =
    '<div class="view-patients">' +
      '<div class="patients-toolbar">' +
        '<h2>Pacjenci</h2>' +
        '<button class="btn btn--primary" id="btn-add-patient">+ Nowy pacjent</button>' +
      '</div>' +
      '<div class="search-bar">' +
        '<input type="search" id="patient-search"' +
               ' placeholder="Szukaj pacjenta\u2026"' +
               ' value="' + _escapeHtml(params.q || '') + '"' +
               ' aria-label="Szukaj pacjenta" />' +
      '</div>' +
      '<ul class="patient-list" aria-label="Lista pacjentów">' +
        listHtml +
      '</ul>' +
    '</div>';

  document.getElementById('btn-add-patient').addEventListener('click', function() {
    _openPatientSheet(null);
  });

  const searchInput = document.getElementById('patient-search');
  searchInput.addEventListener('input', _debounce(function() {
    Router.navigate('patients', { q: searchInput.value });
  }, 300));

  container.querySelectorAll('.patient-item[data-id]').forEach(function(el) {
    el.addEventListener('click', function() { _openPatientSheet(el.dataset.id); });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') _openPatientSheet(el.dataset.id);
    });
  });
}

// ── renderFinance ──────────────────────────────────────────────────────────
function renderFinance(params) {
  params = params || {};
  const container = document.getElementById('view-container');
  if (!container) return;

  if (typeof FinanceViews !== 'undefined' &&
      typeof FinanceViews.render === 'function') {
    FinanceViews.render(container);
    return;
  }

  const sessions = (typeof AppState !== 'undefined' && AppState.sessions)
    ? AppState.sessions : [];
  const now      = new Date();
  const year     = params.year  !== undefined ? params.year  : now.getFullYear();
  const month    = params.month !== undefined ? params.month : now.getMonth();

  const MONTHS = [
    'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
    'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
  ];

  const monthSess = sessions.filter(function(s) {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const paid   = monthSess.filter(function(s) { return s.status === 'paid'; });
  const income = paid.reduce(function(sum, s) {
    return sum + (parseFloat(s.fee) || 0);
  }, 0);

  var detailRows;
  if (monthSess.length > 0) {
    detailRows = monthSess
      .slice()
      .sort(function(a, b) { return a.date > b.date ? 1 : -1; })
      .map(function(s) {
        const patient = _findPatient(s.patientId);
        const name    = patient
          ? patient.firstName + ' ' + patient.lastName
          : 'Nieznany';
        return (
          '<li class="finance-item finance-item--' + (s.status || 'scheduled') + '">' +
            '<span class="finance-item__date">' + _formatDatePL(s.date) + '</span>' +
            '<span class="finance-item__patient">' + _escapeHtml(name) + '</span>' +
            '<span class="finance-item__status">' +
              _sessionStatusLabel(s.status) +
            '</span>' +
            '<span class="finance-item__fee">' +
              (s.fee != null ? s.fee + ' zł' : '\u2014') +
            '</span>' +
          '</li>'
        );
      }).join('');
  } else {
    detailRows = '<li class="finance-list__empty">Brak wizyt w tym miesiącu.</li>';
  }

  container.innerHTML =
    '<div class="view-finance">' +
      '<div class="finance-header">' +
        '<button class="btn-icon" id="fin-prev" aria-label="Poprzedni miesiąc">&#8249;</button>' +
        '<h2>' + MONTHS[month] + ' ' + year + '</h2>' +
        '<button class="btn-icon" id="fin-next" aria-label="Następny miesiąc">&#8250;</button>' +
      '</div>' +
      '<div class="finance-summary">' +
        '<div class="finance-card">' +
          '<span class="finance-card__label">Przychód</span>' +
          '<span class="finance-card__value">' + income.toFixed(2) + ' zł</span>' +
        '</div>' +
        '<div class="finance-card">' +
          '<span class="finance-card__label">Wizyty opłacone</span>' +
          '<span class="finance-card__value">' + paid.length + '</span>' +
        '</div>' +
        '<div class="finance-card">' +
          '<span class="finance-card__label">Wszystkie wizyty</span>' +
          '<span class="finance-card__value">' + monthSess.length + '</span>' +
        '</div>' +
      '</div>' +
      '<h3 class="finance-section-title">Szczegóły</h3>' +
      '<ul class="finance-list">' + detailRows + '</ul>' +
    '</div>';

  document.getElementById('fin-prev').addEventListener('click', function() {
    const d = new Date(year, month - 1, 1);
    Router.navigate('finance', { year: d.getFullYear(), month: d.getMonth() });
  });
  document.getElementById('fin-next').addEventListener('click', function() {
    const d = new Date(year, month + 1, 1);
    Router.navigate('finance', { year: d.getFullYear(), month: d.getMonth() });
  });
}

// ── renderSettings ─────────────────────────────────────────────────────────
function renderSettings(params) {
  params = params || {};
  const container = document.getElementById('view-container');
  if (!container) return;

  if (typeof SettingsView !== 'undefined' &&
      typeof SettingsView.render === 'function') {
    SettingsView.render(container, params);
    return;
  }

  const settings = (typeof AppState !== 'undefined' && AppState.settings)
    ? AppState.settings : {};

  container.innerHTML =
    '<div class="view-settings">' +
      '<h2>Ustawienia</h2>' +

      '<section class="settings-section">' +
        '<h3 class="settings-section__title">Profil terapeuty</h3>' +
        '<label class="settings-field">' +
          '<span>Imi\u0119 i nazwisko</span>' +
          '<input type="text" id="set-therapist-name"' +
                 ' value="' + _escapeHtml(settings.therapistName || '') + '"' +
                 ' placeholder="Jan Kowalski" />' +
        '</label>' +
        '<label class="settings-field">' +
          '<span>Domy\u015blna stawka (z\u0142 / sesja)</span>' +
          '<input type="number" id="set-default-fee"' +
                 ' value="' + (settings.defaultFee != null ? settings.defaultFee : '') + '"' +
                 ' min="0" step="10" placeholder="200" />' +
        '</label>' +
        '<label class="settings-field">' +
          '<span>Czas trwania sesji (min)</span>' +
          '<input type="number" id="set-session-duration"' +
                 ' value="' + (settings.sessionDuration || 50) + '"' +
                 ' min="15" step="5" />' +
        '</label>' +
      '</section>' +

      '<section class="settings-section">' +
        '<h3 class="settings-section__title">Bezpiecze\u0144stwo</h3>' +
        '<label class="settings-field settings-field--row">' +
          '<span>Automatyczna blokada (2 min)</span>' +
          '<input type="checkbox" id="set-autolock"' +
                 (settings.autoLockEnabled !== false ? ' checked' : '') + ' />' +
        '</label>' +
      '</section>' +

      '<section class="settings-section">' +
        '<h3 class="settings-section__title">Konto</h3>' +
        '<button class="btn btn--danger" id="btn-sign-out-settings">Wyloguj</button>' +
      '</section>' +

      '<button class="btn btn--primary settings-save" id="btn-save-settings">' +
        'Zapisz ustawienia' +
      '</button>' +
    '</div>';

  document.getElementById('btn-save-settings').addEventListener('click', function() {
    _saveSettings();
  });
  document.getElementById('btn-sign-out-settings').addEventListener('click', function() {
    App._handleSignOut();
  });
}

// ─── Session sheet helpers ─────────────────────────────────────────────────────
function _openSessionSheet(sessionId) {
  const sessions = (typeof AppState !== 'undefined' && AppState.sessions)
    ? AppState.sessions : [];
  const session  = sessions.find(function(s) { return s.id === sessionId; });
  if (!session) return;

  const patient = _findPatient(session.patientId);
  const name    = patient
    ? patient.firstName + ' ' + patient.lastName
    : '\u2014';

  const STATUSES = ['scheduled', 'completed', 'paid', 'cancelled', 'no-show'];

  Sheet.open('sheet-container',
    '<div class="sheet-session">' +
      '<h3 class="sheet-title">Wizyta</h3>' +
      '<p><strong>Pacjent:</strong> ' + _escapeHtml(name) + '</p>' +
      '<p><strong>Data:</strong> '    + _formatDatePL(session.date) + '</p>' +
      '<p><strong>Godzina:</strong> ' + (session.time || '\u2014') + '</p>' +
      '<p><strong>Status:</strong> '  + _sessionStatusLabel(session.status) + '</p>' +
      '<p><strong>Op\u0142ata:</strong> ' +
        (session.fee != null ? session.fee + ' z\u0142' : '\u2014') + '</p>' +

      '<label class="sheet-field">' +
        '<span>Status</span>' +
        '<select id="session-status-sel">' +
          STATUSES.map(function(v) {
            return '<option value="' + v + '"' +
              (session.status === v ? ' selected' : '') + '>' +
              _sessionStatusLabel(v) + '</option>';
          }).join('') +
        '</select>' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Op\u0142ata (z\u0142)</span>' +
        '<input type="number" id="session-fee-inp"' +
               ' value="' + (session.fee != null ? session.fee : '') + '"' +
               ' min="0" step="10" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Notatka</span>' +
        '<textarea id="session-note-inp" rows="3">' +
          _escapeHtml(session.note || '') +
        '</textarea>' +
      '</label>' +

      '<div class="sheet-actions">' +
        '<button class="btn btn--primary" id="btn-session-save">Zapisz</button>' +
        '<button class="btn btn--danger"  id="btn-session-delete">Usu\u0144 wizyt\u0119</button>' +
        '<button class="btn btn--ghost"   id="btn-session-close">Zamknij</button>' +
      '</div>' +
    '</div>'
  );

  document.getElementById('btn-session-save').addEventListener('click', function() {
    session.status = document.getElementById('session-status-sel').value;
    session.fee    = parseFloat(document.getElementById('session-fee-inp').value) || session.fee;
    session.note   = document.getElementById('session-note-inp').value.trim();
    persistData();
    Sheet.close();
    renderCalendar({ date: session.date });
  });

  document.getElementById('btn-session-delete').addEventListener('click', function() {
    Modal.confirm('Usu\u0144 wizyt\u0119', 'Czy na pewno chcesz usun\u0105\u0107 t\u0119 wizyt\u0119?',
      function() {
        if (typeof AppState !== 'undefined') {
          AppState.sessions = AppState.sessions.filter(function(s) {
            return s.id !== sessionId;
          });
          persistData();
          Sheet.close();
          renderCalendar({ date: session.date });
        }
      }
    );
  });

  document.getElementById('btn-session-close').addEventListener('click', function() {
    Sheet.close();
  });
}

function _openNewSessionSheet(dateStr) {
  const patients = (typeof AppState !== 'undefined' && AppState.patients)
    ? AppState.patients : [];
  const settings = (typeof AppState !== 'undefined' && AppState.settings)
    ? AppState.settings : {};

  var patientOptions = patients.map(function(p) {
    return '<option value="' + p.id + '">' +
      _escapeHtml(p.firstName) + ' ' + _escapeHtml(p.lastName) +
      '</option>';
  }).join('');

  Sheet.open('sheet-container',
    '<div class="sheet-session">' +
      '<h3 class="sheet-title">Nowa wizyta \u2013 ' + _formatDatePL(dateStr) + '</h3>' +
      '<label class="sheet-field">' +
        '<span>Pacjent</span>' +
        '<select id="new-sess-patient">' +
          '<option value="">\u2014 wybierz \u2014</option>' +
          patientOptions +
        '</select>' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Godzina</span>' +
        '<input type="time" id="new-sess-time" value="09:00" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Op\u0142ata (z\u0142)</span>' +
        '<input type="number" id="new-sess-fee"' +
               ' value="' + (settings.defaultFee || '') + '"' +
               ' min="0" step="10" />' +
      '</label>' +
      '<div class="sheet-actions">' +
        '<button class="btn btn--primary" id="btn-new-sess-save">Dodaj wizyt\u0119</button>' +
        '<button class="btn btn--ghost"   id="btn-new-sess-close">Anuluj</button>' +
      '</div>' +
    '</div>'
  );

  document.getElementById('btn-new-sess-save').addEventListener('click', function() {
    const patientId = document.getElementById('new-sess-patient').value;
    if (!patientId) { alert('Wybierz pacjenta.'); return; }

    const newSession = {
      id:        _uuid(),
      patientId: patientId,
      date:      dateStr,
      time:      document.getElementById('new-sess-time').value,
      fee:       parseFloat(document.getElementById('new-sess-fee').value) || null,
      status:    'scheduled',
      note:      '',
    };

    if (typeof AppState !== 'undefined') {
      AppState.sessions = AppState.sessions || [];
      AppState.sessions.push(newSession);
      persistData();
    }
    Sheet.close();
    renderCalendar({ date: dateStr });
  });

  document.getElementById('btn-new-sess-close').addEventListener('click', function() {
    Sheet.close();
  });
}

// ── Patient sheet ────────────────────────────────────────────────────────────
function _openPatientSheet(patientId) {
  const patients = (typeof AppState !== 'undefined' && AppState.patients)
    ? AppState.patients : [];
  const patient  = patientId
    ? patients.find(function(p) { return p.id === patientId; })
    : null;
  const isNew    = !patient;

  Sheet.open('sheet-container',
    '<div class="sheet-patient">' +
      '<h3 class="sheet-title">' +
        (isNew ? 'Nowy pacjent' : 'Edycja pacjenta') +
      '</h3>' +
      '<label class="sheet-field">' +
        '<span>Imi\u0119</span>' +
        '<input type="text" id="pat-first"' +
               ' value="' + _escapeHtml(patient ? patient.firstName : '') + '" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Nazwisko</span>' +
        '<input type="text" id="pat-last"' +
               ' value="' + _escapeHtml(patient ? patient.lastName : '') + '" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Telefon</span>' +
        '<input type="tel" id="pat-phone"' +
               ' value="' + _escapeHtml(patient ? (patient.phone || '') : '') + '" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Email</span>' +
        '<input type="email" id="pat-email"' +
               ' value="' + _escapeHtml(patient ? (patient.email || '') : '') + '" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Stawka indywidualna (z\u0142)</span>' +
        '<input type="number" id="pat-fee"' +
               ' value="' + (patient && patient.fee != null ? patient.fee : '') + '"' +
               ' min="0" step="10" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Notatki</span>' +
        '<textarea id="pat-notes" rows="4">' +
          _escapeHtml(patient ? (patient.notes || '') : '') +
        '</textarea>' +
      '</label>' +
      '<div class="sheet-actions">' +
        '<button class="btn btn--primary" id="btn-pat-save">Zapisz</button>' +
        (!isNew
          ? '<button class="btn btn--danger" id="btn-pat-delete">Usu\u0144 pacjenta</button>'
          : '') +
        '<button class="btn btn--ghost" id="btn-pat-close">Anuluj</button>' +
      '</div>' +
    '</div>'
  );

  document.getElementById('btn-pat-save').addEventListener('click', function() {
    const firstName = document.getElementById('pat-first').value.trim();
    const lastName  = document.getElementById('pat-last').value.trim();
    if (!firstName || !lastName) {
      alert('Imi\u0119 i nazwisko s\u0105 wymagane.');
      return;
    }

    if (isNew) {
      const newPatient = {
        id:        _uuid(),
        firstName: firstName,
        lastName:  lastName,
        phone:     document.getElementById('pat-phone').value.trim(),
        email:     document.getElementById('pat-email').value.trim(),
        fee:       parseFloat(document.getElementById('pat-fee').value) || null,
        notes:     document.getElementById('pat-notes').value.trim(),
        createdAt: new Date().toISOString(),
      };
      if (typeof AppState !== 'undefined') {
        AppState.patients = AppState.patients || [];
        AppState.patients.push(newPatient);
      }
    } else {
      patient.firstName = firstName;
      patient.lastName  = lastName;
      patient.phone     = document.getElementById('pat-phone').value.trim();
      patient.email     = document.getElementById('pat-email').value.trim();
      patient.fee       = parseFloat(document.getElementById('pat-fee').value) || null;
      patient.notes     = document.getElementById('pat-notes').value.trim();
    }

    persistData();
    Sheet.close();
    renderPatients({});
  });

  if (!isNew) {
    document.getElementById('btn-pat-delete').addEventListener('click', function() {
      Modal.confirm(
        'Usu\u0144 pacjenta',
        'Czy na pewno chcesz usun\u0105\u0107 pacjenta ' +
          patient.firstName + ' ' + patient.lastName + '? ' +
          'Wszystkie powi\u0105zane wizyty zostan\u0105 zachowane.',
        function() {
          AppState.patients = AppState.patients.filter(function(p) {
            return p.id !== patientId;
          });
          persistData();
          Sheet.close();
          renderPatients({});
        }
      );
    });
  }

  document.getElementById('btn-pat-close').addEventListener('click', function() {
    Sheet.close();
  });
}

// ── Settings save ─────────────────────────────────────────────────────────────
function _saveSettings() {
  if (typeof AppState === 'undefined') return;

  AppState.settings                 = AppState.settings || {};
  AppState.settings.therapistName   =
    document.getElementById('set-therapist-name').value.trim();
  AppState.settings.defaultFee      =
    parseFloat(document.getElementById('set-default-fee').value) || null;
  AppState.settings.sessionDuration =
    parseInt(document.getElementById('set-session-duration').value, 10) || 50;
  AppState.settings.autoLockEnabled =
    document.getElementById('set-autolock').checked;

  persistData();

  const btn = document.getElementById('btn-save-settings');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = 'Zapisano!';
    setTimeout(function() { btn.textContent = orig; }, 1500);
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
const Modal = {
  _confirmCallback: null,
  _cancelCallback:  null,

  confirm(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('modal-confirm');
    if (!modal) {
      // Fallback to native browser confirm.
      if (window.confirm(title + '\n\n' + message)) {
        onConfirm && onConfirm();
      } else {
        onCancel && onCancel();
      }
      return;
    }

    const titleEl   = modal.querySelector('.modal__title');
    const messageEl = modal.querySelector('.modal__message');
    if (titleEl)   titleEl.textContent   = title;
    if (messageEl) messageEl.textContent = message;

    this._confirmCallback = onConfirm || null;
    this._cancelCallback  = onCancel  || null;

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');

    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn  = document.getElementById('modal-cancel-btn');

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        this.close();
        this._confirmCallback && this._confirmCallback();
      };
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.close();
        this._cancelCallback && this._cancelCallback();
      };
    }

    // Close on backdrop click.
    modal.onclick = (e) => { if (e.target === modal) this.close(); };

    // Focus first button.
    if (confirmBtn) confirmBtn.focus();
    else if (cancelBtn) cancelBtn.focus();
  },

  close() {
    const modal = document.getElementById('modal-confirm');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    this._confirmCallback = null;
    this._cancelCallback  = null;
  },
};

// ─── Sheet ────────────────────────────────────────────────────────────────────
const Sheet = {
  _escHandler: null,

  open(containerId, html) {
    var container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id        = containerId;
      container.className = 'sheet-overlay';
      document.body.appendChild(container);
    }

    container.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true">' +
        '<div class="sheet__drag-handle" aria-hidden="true"></div>' +
        '<div class="sheet__content">' + html + '</div>' +
      '</div>';

    container.hidden = false;
    container.setAttribute('aria-hidden', 'false');

    // Trigger CSS open transition on next frame.
    requestAnimationFrame(function() {
      container.classList.add('sheet-overlay--open');
    });

    // Close on backdrop click.
    container.addEventListener('click', (e) => {
      if (e.target === container) this.close();
    }, { once: true });

    // Escape key handler.
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    // Focus first interactive element.
    const firstInput = container.querySelector('input,select,textarea,button');
    if (firstInput) firstInput.focus();
  },

  close() {
    document.querySelectorAll('.sheet-overlay').forEach(function(container) {
      container.classList.remove('sheet-overlay--open');

      var done = false;
      function hide() {
        if (done) return;
        done = true;
        container.hidden = true;
        container.setAttribute('aria-hidden', 'true');
        container.innerHTML = '';
      }

      container.addEventListener('transitionend', hide, { once: true });
      // Fallback timeout in case transitionend never fires.
      setTimeout(hide, 400);
    });

    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  },
};

// ─── Tab bar – global click delegation ───────────────────────────────────────
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.tab-btn');
  if (btn && btn.dataset.view) {
    App.switchTab(btn.dataset.view);
  }
});

// ─── Utility helpers ──────────────────────────────────────────────────────────
function _uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function _escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _isoDate(date) {
  return date.getFullYear() + '-' +
         String(date.getMonth() + 1).padStart(2, '0') + '-' +
         String(date.getDate()).padStart(2, '0');
}

function _formatDatePL(dateStr) {
  if (!dateStr) return '\u2014';
  const parts = dateStr.slice(0, 10).split('-');
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function _initials(first, last) {
  return ((first || '')[0] || '').toUpperCase() +
         ((last  || '')[0] || '').toUpperCase();
}

function _findPatient(patientId) {
  if (!patientId ||
      typeof AppState === 'undefined' ||
      !AppState.patients) return null;
  return AppState.patients.find(function(p) {
    return p.id === patientId;
  }) || null;
}

function _sessionStatusLabel(status) {
  var labels = {
    'scheduled': 'Zaplanowana',
    'completed': 'Odbyta',
    'paid':      'Op\u0142acona',
    'cancelled': 'Odwo\u0142ana',
    'no-show':   'Nieobecno\u015b\u0107',
  };
  return labels[status] || status || '\u2014';
}

// Local debounce used inside view renderers (avoids a dependency on drive.js).
function _debounce(fn, delay) {
  var timer = null;
  return function() {
    var args = arguments;
    var ctx  = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
  };
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() { App.init(); });
