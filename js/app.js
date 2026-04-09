'use strict';

// ─── AutoLock ─────────────────────────────────────────────────────────────────
const AutoLock = {
  timer:   null,
  timeout: 120_000, // 2 minutes
  _initialized: false,

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
    if (typeof SecurityService !== 'undefined') {
      SecurityService.lockClinicalData();
    }
  },

  unlock() {
    this.start();
  },

  init() {
    const timeoutSeconds = AppState.settings && AppState.settings.autoLockTimeout
      ? AppState.settings.autoLockTimeout
      : 120;
    this.timeout = timeoutSeconds * 1000;
    if (this._initialized) {
      this.start();
      return;
    }
    const events = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    events.forEach(evt =>
      document.addEventListener(evt, () => this.reset(), { passive: true })
    );
    this._initialized = true;
    this.start();
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────
const Router = {
  currentView: 'calendar',
  currentParams: {},
  _history:    [],

  navigate(view, params = {}) {
    this._history.push({ view: this.currentView, params: this.currentParams });
    this.currentView = view;
    this.currentParams = { ...params };
    App.showView(view, params);
    App._updateTabBar(view);
  },

  back() {
    const prev = this._history.pop();
    if (prev) {
      this.currentView = prev.view;
      this.currentParams = prev.params || {};
      App.showView(prev.view, this.currentParams);
      App._updateTabBar(prev.view);
    }
  },
};

// ─── TabGuard — ochrona przed wieloma zakladkami ─────────────────────────────
const TabGuard = {
  _channel: null,
  _tabId: Date.now() + '-' + Math.random().toString(36).slice(2),

  init() {
    if (typeof BroadcastChannel === 'undefined') return;
    this._channel = new BroadcastChannel('gabinet-tab-sync');
    this._channel.onmessage = (e) => this._onMessage(e.data);
    // Oglos swoja obecnosc
    this._send({ type: 'tab-open', tabId: this._tabId });
  },

  notifyDataSaved() {
    if (!this._channel) return;
    this._send({ type: 'data-saved', tabId: this._tabId, ts: Date.now() });
  },

  _send(msg) {
    try { this._channel.postMessage(msg); } catch (_) { /* ignore */ }
  },

  _onMessage(msg) {
    if (msg.tabId === this._tabId) return;
    if (msg.type === 'data-saved') {
      if (typeof toast === 'function') {
        toast('Dane zostaly zmienione w innej zakladce. Odswiez strone, aby zobaczyc aktualne dane.', 'warning', 6000);
      }
    }
  },
};

// ─── App ──────────────────────────────────────────────────────────────────────
const App = {
  _lockMode: false,

  // ── init ──────────────────────────────────────────────────────────────────
  async init() {
    this.showSplash();
    TabGuard.init();

    // Wait for Google Identity Services script, then init DriveService.
    await this._waitForGIS();
    DriveService.init();

    let bootedFromLocalSnapshot = false;
    if (typeof LocalStore !== 'undefined' && typeof LocalStore.init === 'function') {
      try {
        await LocalStore.init();
        const snapshot = await LocalStore.loadSnapshot();
        if (snapshot && snapshot.serializedData) {
          try {
            deserializeAppData(snapshot.serializedData);
            bootedFromLocalSnapshot = true;
          } catch (snapshotError) {
            console.warn('[App] Local snapshot could not be restored:', snapshotError);
            if (typeof LocalStore.clear === 'function') {
              await LocalStore.clear();
            }
            if (typeof initDefaultAppState === 'function') {
              initDefaultAppState();
            }
          }
        }
      } catch (localError) {
        console.warn('[App] Local snapshot init failed:', localError);
      }
    }

    // Minimum splash display time (UX).
    await this._sleep(1500);

    // Wire up the Google sign-in button.
    const signInBtn = document.getElementById('btn-google-signin');
    if (signInBtn) {
      signInBtn.addEventListener('click', () => this._handleSignInClick());
    }

    const syncActionBtn = document.getElementById('sync-status-action');
    if (syncActionBtn) {
      syncActionBtn.addEventListener('click', () => this._handleSignInClick());
    }

    document.addEventListener('local-store:change', () => this.refreshSyncStatusUi());

    document.querySelectorAll('[data-auth-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.querySelector(btn.dataset.authScroll);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

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

    if (bootedFromLocalSnapshot) {
      this._afterSignIn({ source: 'local-snapshot' });
      if (typeof toast === 'function') {
        toast('Wczytano lokalną kopię danych z tego urządzenia.', 'info', 3500);
      }
      return;
    }

    this.hideSplash();
    this.showAuth(false);
    this.refreshSyncStatusUi();
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
  _afterSignIn(options = {}) {
    const preserveView = options.preserveView === true;
    this.hideSplash();
    this.hideAuth();
    this.showApp();
    if (typeof SecurityService !== 'undefined') {
      SecurityService.bootstrapFromLoadedState();
    }
    if (!(typeof SecurityService !== 'undefined' &&
          SecurityService.getStatus &&
          SecurityService.getStatus() === 'migration-required')) {
      this._generateSessionsIfNeeded();
    }
    AutoLock.init();
    if (preserveView) {
      this.refreshCurrentView();
    } else {
      Router.navigate('calendar', { viewMode: 'daily', focusDate: new Date().toISOString() });
    }
    if (typeof SecurityService !== 'undefined' &&
        SecurityService.getStatus &&
        SecurityService.getStatus() === 'migration-required') {
      toast('Aby bezpiecznie zapisac istniejace notatki kliniczne, ustaw haslo.', 'warning', 5000);
    }
    this.refreshSyncStatusUi();
  },

  // ── onSignIn ──────────────────────────────────────────────────────────────
  async onSignIn(token) {
    const preserveView = this._isVisible('app-shell');
    this.showSplash();
    try {
      if (typeof LocalStore !== 'undefined' &&
          typeof LocalStore.shouldPreferLocalSnapshot === 'function' &&
          LocalStore.shouldPreferLocalSnapshot()) {
        await DriveService.saveData();
        if (typeof toast === 'function') {
          toast('Lokalne dane zostały zsynchronizowane z Google Drive.', 'success', 3500);
        }
      } else {
        await DriveService.loadData();
      }
    } catch (err) {
      console.warn('[App] Drive sync after sign-in failed:', err);
    }
    this._afterSignIn({ preserveView });
  },

  // ── _handleSignInClick ────────────────────────────────────────────────────
  async _handleSignInClick() {
    const authBtn = document.getElementById('btn-google-signin');
    const syncBtn = document.getElementById('sync-status-action');
    const settingsBtn = document.getElementById('sv-connect-btn');
    [authBtn, syncBtn, settingsBtn].forEach((button) => {
      if (!button) return;
      button.disabled = true;
      button.textContent = 'Łączenie\u2026';
    });

    try {
      const token = await DriveService.requestToken();
      await this.onSignIn(token);
    } catch (err) {
      console.error('[App] Sign-in failed:', err);
      const authError = document.getElementById('auth-error');
      if (this._isVisible('auth-screen') && authError) {
        authError.textContent = 'Logowanie nie powiodło się. Spróbuj ponownie.';
        authError.hidden = false;
        authError.classList.remove('hidden');
      } else if (typeof DriveService !== 'undefined' && typeof DriveService._showError === 'function') {
        DriveService._showError('Nie udało się połączyć z Google Drive.');
      } else if (typeof toast === 'function') {
        toast('Nie udało się połączyć z Google Drive.', 'error');
      }
    } finally {
      [authBtn, syncBtn, settingsBtn].forEach((button) => {
        if (!button) return;
        button.disabled = false;
        button.textContent = 'Połącz z Google';
      });
    }
  },

  // ── _handleSignOut ────────────────────────────────────────────────────────
  _handleSignOut() {
    Modal.confirm(
      'Wylogowanie',
      'Czy na pewno chcesz odłączyć Google Drive? Lokalne dane na tym urządzeniu pozostaną dostępne.',
      async () => {
        DriveService.signOut();
        if (typeof SecurityService !== 'undefined') {
          SecurityService.handleSignOut();
        }
        this.showApp();
        this.hideAuth();
        this.refreshCurrentView();
        this.refreshSyncStatusUi();
        if (typeof toast === 'function') {
          toast('Google Drive został odłączony. Możesz dalej pracować na danych lokalnych.', 'info', 4500);
        }
      }
    );
  },

  // ── _handlePinSubmit ──────────────────────────────────────────────────────
  _handlePinSubmit() {
    if (typeof SecurityService === 'undefined') return;
    SecurityService.requestClinicalAccess()
      .then((ok) => {
        if (ok) AutoLock.unlock();
      })
      .catch(() => {
        const msg = document.getElementById('lock-error-msg');
        if (msg) { msg.textContent = 'Nie udało się odblokować danych klinicznych.'; }
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
      screen.classList.remove('hidden');
      const title = screen.querySelector('.auth-screen__title');
      if (title) {
        title.textContent = isLock
          ? 'Zaloguj się ponownie, aby wrócić do spokojnej pracy.'
          : 'Cyfrowy porządek dla gabinetu psychoterapeutycznego.';
      }
    }
    const authError = document.getElementById('auth-error');
    if (authError) {
      authError.hidden = true;
      authError.classList.add('hidden');
      authError.textContent = '';
    }
    const signInBtn = document.getElementById('btn-google-signin');
    if (signInBtn) {
      signInBtn.disabled = false;
      signInBtn.textContent = 'Połącz z Google';
    }
    this.refreshSyncStatusUi();
  },
  hideAuth() { this._hide('auth-screen'); },

  showApp()  { this._show('app-shell'); },
  hideApp()  { this._hide('app-shell'); },

  refreshCurrentView() {
    if (!this._isVisible('app-shell')) return;

    if (Router.currentView === 'calendar' && typeof CalendarViews !== 'undefined') {
      CalendarViews.render();
      return;
    }

    if (Router.currentView === 'patients' && typeof PatientViews !== 'undefined') {
      const params = (Router.currentParams && Object.keys(Router.currentParams).length > 0)
        ? Router.currentParams
        : (PatientViews._currentPatientId ? { patientId: PatientViews._currentPatientId } : {});
      PatientViews.render(params);
      this._updateTabBar('patients');
      return;
    }

    this.showView(Router.currentView, Router.currentParams || {});
    this._updateTabBar(Router.currentView);
  },

  refreshSyncStatusUi() {
    const banner = document.getElementById('sync-status-banner');
    const text = document.getElementById('sync-status-text');
    const action = document.getElementById('sync-status-action');
    if (!banner || !text || !action) return;

    if (typeof LocalStore === 'undefined' || typeof LocalStore.getSyncStatusSummary !== 'function') {
      banner.hidden = true;
      banner.classList.add('hidden');
      return;
    }

    const summary = LocalStore.getSyncStatusSummary();
    if (!summary || !summary.bannerVisible) {
      banner.hidden = true;
      banner.classList.add('hidden');
      text.textContent = '';
      action.hidden = true;
      return;
    }

    text.textContent = summary.note || summary.status || '';
    action.textContent = summary.actionLabel || 'Połącz z Google';
    action.hidden = !summary.actionLabel;
    banner.hidden = false;
    banner.classList.remove('hidden');
  },

  // ── showView ──────────────────────────────────────────────────────────────
  showView(name, params = {}) {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.classList.add('view-transitioning');

    requestAnimationFrame(() => {
      switch (name) {
        case 'today':
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
    if (el) {
      el.hidden = false;
      el.classList.remove('hidden');
    }
  },

  _hide(id) {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = true;
      el.classList.add('hidden');
    }
  },

  _isVisible(id) {
    const el = document.getElementById(id);
    return !!(el && !el.hidden);
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
    if (params.focusDate || params.date) {
      const sourceDate = new Date(params.focusDate || params.date);
      CalendarViews.currentDate = sourceDate;
      CalendarViews.selectedDate = new Date(sourceDate);
    }
    if (params.viewMode) {
      CalendarViews.viewMode = params.viewMode;
    } else if (!CalendarViews.viewMode) {
      CalendarViews.viewMode = 'daily';
    }
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
    const time    = _getSessionTimeValue(s) || '--:--';
    const status  = s.isPaid ? 'Opłacona' : _sessionStatusLabel(s.status);
    const amount  = _getSessionAmountValue(s, patient);
    return (
      '<article class="session-item session-item--' + (s.status || 'scheduled') + '"' +
               ' data-id="' + s.id + '"' +
               ' tabindex="0"' +
               ' role="button"' +
               ' aria-label="Wizyta: ' + _escapeHtml(name) + ' o ' + time + '">' +
        '<div class="session-item__time">' + time + '</div>' +
        '<div class="session-item__info">' +
          '<span class="session-item__patient">' + _escapeHtml(name) + '</span>' +
          '<span class="session-item__status">' + status + '</span>' +
        '</div>' +
        '<div class="session-item__fee">' +
          _formatAmountLabel(amount) +
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

  const paid   = monthSess.filter(function(s) { return s.isPaid || !!s.paymentId; });
  const income = paid.reduce(function(sum, s) {
    return sum + _getSessionAmountValue(s);
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
              (s.isPaid ? 'Opłacona' : _sessionStatusLabel(s.status)) +
            '</span>' +
            '<span class="finance-item__fee">' +
              _formatAmountLabel(_getSessionAmountValue(s, patient)) +
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
          '<span>Adres gabinetu</span>' +
          '<input type="text" id="set-therapist-address"' +
                 ' value="' + _escapeHtml(settings.therapistAddress || '') + '"' +
                 ' placeholder="ul. Przyk\u0142adowa 1, Warszawa" />' +
        '</label>' +
        '<label class="settings-field">' +
          '<span>NIP</span>' +
          '<input type="text" id="set-therapist-nip"' +
                 ' value="' + _escapeHtml(settings.therapistNIP || '') + '"' +
                 ' placeholder="opcjonalnie" />' +
        '</label>' +
      '</section>' +

      '<section class="settings-section">' +
        '<h3 class="settings-section__title">Bezpiecze\u0144stwo</h3>' +
        '<label class="settings-field">' +
          '<span>Auto-lock danych klinicznych (minuty)</span>' +
          '<input type="number" id="set-autolock-timeout"' +
                 ' value="' + _getAutoLockTimeoutMinutes(settings) + '"' +
                 ' min="1" step="1" />' +
        '</label>' +
        '<p class="settings-field__hint">To jest uproszczony ekran awaryjny. Pe\u0142ne ustawienia ochrony danych s\u0105 dost\u0119pne w g\u0142\u00f3wnym widoku ustawie\u0144.</p>' +
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

  const STATUSES = ['scheduled', 'completed', 'cancelled'];
  const currentStatus = session.status || 'scheduled';
  const allowedStatuses = STATUSES.includes(currentStatus)
    ? STATUSES
    : STATUSES.concat([currentStatus]);
  const currentAmount = _getSessionAmountInputValue(session, patient);

  Sheet.open('sheet-container',
    '<div class="sheet-session">' +
      '<h3 class="sheet-title">Wizyta</h3>' +
      '<p><strong>Pacjent:</strong> ' + _escapeHtml(name) + '</p>' +
      '<p><strong>Data:</strong> '    + _formatDatePL(session.date) + '</p>' +
      '<p><strong>Godzina:</strong> ' + (_getSessionTimeValue(session) || '\u2014') + '</p>' +
      '<p><strong>Status:</strong> '  + (session.isPaid ? 'Op\u0142acona' : _sessionStatusLabel(session.status)) + '</p>' +
      '<p><strong>Op\u0142ata:</strong> ' +
        _formatAmountLabel(_getSessionAmountValue(session, patient)) + '</p>' +

      '<label class="sheet-field">' +
        '<span>Status</span>' +
        '<select id="session-status-sel">' +
          allowedStatuses.map(function(v) {
            return '<option value="' + v + '"' +
              (session.status === v ? ' selected' : '') + '>' +
              _sessionStatusLabel(v) + '</option>';
          }).join('') +
        '</select>' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Op\u0142ata (z\u0142)</span>' +
        '<input type="number" id="session-fee-inp"' +
               ' value="' + _escapeHtml(currentAmount) + '"' +
               ' min="0" step="10" />' +
      '</label>' +
      '<p class="sheet-helper-text">Notatki kliniczne s\u0105 dost\u0119pne tylko w pe\u0142nym widoku kalendarza, gdzie dzia\u0142a blokada has\u0142em.</p>' +

      '<div class="sheet-actions">' +
        '<button class="btn btn--primary" id="btn-session-save">Zapisz</button>' +
        '<button class="btn btn--danger"  id="btn-session-delete">Usu\u0144 wizyt\u0119</button>' +
        '<button class="btn btn--ghost"   id="btn-session-close">Zamknij</button>' +
      '</div>' +
    '</div>'
  );

  document.getElementById('btn-session-save').addEventListener('click', function() {
    session.status = document.getElementById('session-status-sel').value;
    session.paymentAmount = _readNullableNumber(document.getElementById('session-fee-inp').value);
    _syncFallbackSessionPayment(session);
    persistData();
    Sheet.close();
    renderCalendar({ date: session.date });
  });

  document.getElementById('btn-session-delete').addEventListener('click', function() {
    Modal.confirm('Usu\u0144 wizyt\u0119', 'Czy na pewno chcesz usun\u0105\u0107 t\u0119 wizyt\u0119?',
      function() {
        if (typeof AppState !== 'undefined') {
          _removeSessionFromPaymentRegistry(session);
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
               ' value=""' +
               ' min="0" step="10" />' +
      '</label>' +
      '<p class="sheet-helper-text">Domy\u015blnie wpiszemy stawk\u0119 wybranego pacjenta. Notatki kliniczne dodasz p\u00f3\u017aniej w pe\u0142nym widoku kalendarza.</p>' +
      '<div class="sheet-actions">' +
        '<button class="btn btn--primary" id="btn-new-sess-save">Dodaj wizyt\u0119</button>' +
        '<button class="btn btn--ghost"   id="btn-new-sess-close">Anuluj</button>' +
      '</div>' +
    '</div>'
  );

  const patientSelect = document.getElementById('new-sess-patient');
  const feeInput = document.getElementById('new-sess-fee');

  function syncFeeWithSelectedPatient() {
    const selectedPatient = _findPatient(patientSelect.value);
    feeInput.value = selectedPatient && selectedPatient.sessionRate != null
      ? String(selectedPatient.sessionRate)
      : '';
  }

  patientSelect.addEventListener('change', syncFeeWithSelectedPatient);
  syncFeeWithSelectedPatient();

  document.getElementById('btn-new-sess-save').addEventListener('click', function() {
    const patientId = patientSelect.value;
    if (!patientId) { alert('Wybierz pacjenta.'); return; }

    const sessionData = {
      patientId: patientId,
      date: dateStr,
      time: document.getElementById('new-sess-time').value,
      paymentAmount: _readNullableNumber(feeInput.value),
      status: 'scheduled',
      isManuallyCreated: true,
      sessionNotes: '',
    };
    const newSession = typeof createSession === 'function'
      ? createSession(sessionData)
      : {
          id: _uuid(),
          patientId: sessionData.patientId,
          date: sessionData.date,
          paymentAmount: sessionData.paymentAmount,
          status: sessionData.status,
          isManuallyCreated: true,
          sessionNotes: '',
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
  const fallbackSchedule = _getFallbackScheduleConfig(patient);
  const therapyStartValue = _getDateInputValue(
    patient && patient.therapyStartDate ? patient.therapyStartDate : new Date().toISOString()
  );
  const weekdayOptions = _getWeekdayOptions(fallbackSchedule.weekday);

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
        '<span>Pseudonim</span>' +
        '<input type="text" id="pat-pseudonym"' +
               ' value="' + _escapeHtml(patient ? (patient.pseudonym || '') : '') + '"' +
               ' placeholder="Opcjonalny pseudonim" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Data rozpoczęcia terapii</span>' +
        '<input type="date" id="pat-therapy-start"' +
               ' value="' + _escapeHtml(therapyStartValue) + '" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Stawka indywidualna (z\u0142)</span>' +
        '<input type="number" id="pat-session-rate"' +
               ' value="' + (patient && patient.sessionRate != null ? patient.sessionRate : '') + '"' +
               ' min="0" step="10" />' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Dzień sesji</span>' +
        '<select id="pat-session-weekday">' +
          weekdayOptions +
        '</select>' +
      '</label>' +
      '<label class="sheet-field">' +
        '<span>Godzina sesji</span>' +
        '<input type="time" id="pat-session-time"' +
               ' value="' + _escapeHtml(fallbackSchedule.sessionTime) + '" />' +
      '</label>' +
      '<p class="sheet-helper-text">To jest uproszczony formularz awaryjny. Zapisuje tylko pola zgodne z nowym modelem pacjenta. Notatki kliniczne, cele i rozbudowany harmonogram edytujesz w pełnym widoku pacjenta.</p>' +
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
    const pseudonym = document.getElementById('pat-pseudonym').value.trim();
    const therapyStartRaw = document.getElementById('pat-therapy-start').value;
    const sessionRate = _readNullableNumber(document.getElementById('pat-session-rate').value);
    const weekday = parseInt(document.getElementById('pat-session-weekday').value, 10);
    const sessionTime = document.getElementById('pat-session-time').value || '10:00';
    if (!firstName || !lastName) {
      alert('Imi\u0119 i nazwisko s\u0105 wymagane.');
      return;
    }
    if (!therapyStartRaw) {
      alert('Data rozpocz\u0119cia terapii jest wymagana.');
      return;
    }

    const therapyStartDate = new Date(therapyStartRaw).toISOString();
    const fallbackSessionDayConfigs = [{
      weekday: Number.isFinite(weekday) && weekday > 0 ? weekday : fallbackSchedule.weekday,
      sessionTime: sessionTime,
    }];
    const sessionDayConfigs = (patient && Array.isArray(patient.sessionDayConfigs) && patient.sessionDayConfigs.length > 0)
      ? patient.sessionDayConfigs
      : fallbackSessionDayConfigs;

    if (isNew) {
      const patientData = {
        firstName: firstName,
        lastName: lastName,
        pseudonym: pseudonym,
        therapyStartDate: therapyStartDate,
        sessionRate: sessionRate,
        sessionsPerWeek: sessionDayConfigs.length,
        sessionDayConfigs: sessionDayConfigs,
        createdAt: new Date().toISOString(),
      };
      const newPatient = typeof createPatient === 'function'
        ? createPatient(patientData)
        : {
            id: _uuid(),
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            pseudonym: patientData.pseudonym,
            therapyStartDate: patientData.therapyStartDate,
            sessionRate: patientData.sessionRate,
            sessionsPerWeek: patientData.sessionsPerWeek,
            sessionDayConfigs: patientData.sessionDayConfigs,
            createdAt: patientData.createdAt,
          };
      if (typeof AppState !== 'undefined') {
        AppState.patients = AppState.patients || [];
        AppState.patients.push(newPatient);
      }
    } else {
      patient.firstName = firstName;
      patient.lastName  = lastName;
      patient.pseudonym = pseudonym;
      patient.therapyStartDate = therapyStartDate;
      patient.sessionRate = sessionRate ?? patient.sessionRate;
      patient.sessionsPerWeek = sessionDayConfigs.length;
      patient.sessionDayConfigs = sessionDayConfigs;
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
  AppState.settings.therapistAddress =
    document.getElementById('set-therapist-address').value.trim();
  AppState.settings.therapistNIP =
    document.getElementById('set-therapist-nip').value.trim();
  AppState.settings.autoLockTimeout =
    _getAutoLockTimeoutSeconds(document.getElementById('set-autolock-timeout').value);

  persistData();
  if (typeof AutoLock !== 'undefined' && typeof AutoLock.init === 'function') {
    AutoLock.init();
  }

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
    modal.classList.remove('hidden');
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
      modal.classList.add('hidden');
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
    container.classList.remove('hidden');
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
        container.classList.add('hidden');
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

function _getSessionTimeValue(session) {
  if (!session) return '';
  if (typeof session.time === 'string' && session.time) return session.time;
  if (!session.date) return '';
  const parsed = new Date(session.date);
  if (isNaN(parsed.getTime())) return '';
  return String(parsed.getHours()).padStart(2, '0') + ':' +
         String(parsed.getMinutes()).padStart(2, '0');
}

function _readNullableNumber(value) {
  if (typeof normalizeNullableNumber === 'function') {
    return normalizeNullableNumber(value);
  }
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function _findPaymentForSession(session) {
  if (!session || typeof AppState === 'undefined' || !Array.isArray(AppState.payments)) return null;
  return AppState.payments.find(function(payment) {
    return payment.id === session.paymentId ||
      Array.isArray(payment.sessionIds) && payment.sessionIds.indexOf(session.id) !== -1;
  }) || null;
}

function _syncFallbackSessionPayment(session) {
  if (!session || !session.isPaid || typeof recordPaymentForSessions !== 'function') return;
  const payment = _findPaymentForSession(session);
  const paymentId = payment ? payment.id : (session.paymentId || null);
  const sessionIds = payment && Array.isArray(payment.sessionIds) && payment.sessionIds.length > 0
    ? payment.sessionIds.slice()
    : [session.id];

  recordPaymentForSessions({
    id: paymentId,
    patientId: session.patientId,
    date: payment ? payment.date : (session.paymentDate || session.date),
    method: payment ? payment.method : (session.paymentMethod || 'cash'),
    note: payment ? (payment.note || '') : '',
    sessionIds: sessionIds,
  });
}

function _removeSessionFromPaymentRegistry(session) {
  if (!session) return;
  const payment = _findPaymentForSession(session);
  if (!payment) return;

  const remainingSessionIds = (payment.sessionIds || []).filter(function(sessionId) {
    return sessionId !== session.id;
  });

  if (remainingSessionIds.length === 0) {
    if (typeof detachPaymentFromSessions === 'function') {
      detachPaymentFromSessions(payment.id);
    }
    return;
  }

  if (typeof recordPaymentForSessions === 'function') {
    recordPaymentForSessions({
      id: payment.id,
      patientId: payment.patientId,
      date: payment.date,
      method: payment.method,
      note: payment.note || '',
      sessionIds: remainingSessionIds,
    });
  }
}

function _getDateInputValue(dateValue) {
  if (!dateValue) return '';
  const parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

function _getFallbackScheduleConfig(patient) {
  const defaultWeekday = typeof getISOWeekday === 'function'
    ? getISOWeekday(new Date())
    : 1;
  const configs = patient && Array.isArray(patient.sessionDayConfigs)
    ? patient.sessionDayConfigs
    : [];
  const firstConfig = configs.length > 0 ? configs[0] : null;

  return {
    weekday: firstConfig && firstConfig.weekday ? firstConfig.weekday : defaultWeekday,
    sessionTime: firstConfig && firstConfig.sessionTime ? firstConfig.sessionTime : '10:00',
  };
}

function _getWeekdayOptions(selectedWeekday) {
  const labels = {
    1: 'Poniedziałek',
    2: 'Wtorek',
    3: 'Środa',
    4: 'Czwartek',
    5: 'Piątek',
    6: 'Sobota',
    7: 'Niedziela',
  };

  return Object.keys(labels).map(function(key) {
    return '<option value="' + key + '"' +
      (Number(key) === Number(selectedWeekday) ? ' selected' : '') + '>' +
      labels[key] +
      '</option>';
  }).join('');
}

function _getSessionAmountValue(session, patient) {
  if (typeof getSessionAmount === 'function') {
    return getSessionAmount(session, patient);
  }
  const amount = _readNullableNumber(session && session.paymentAmount);
  if (amount !== null) return amount;
  const legacyAmount = _readNullableNumber(session && session.fee);
  if (legacyAmount !== null) return legacyAmount;
  const rate = _readNullableNumber(patient && patient.sessionRate);
  return rate !== null ? rate : 0;
}

function _getSessionAmountInputValue(session, patient) {
  const amount = _readNullableNumber(session && session.paymentAmount);
  if (amount !== null) return String(amount);
  const legacyAmount = _readNullableNumber(session && session.fee);
  if (legacyAmount !== null) return String(legacyAmount);
  const rate = _readNullableNumber(patient && patient.sessionRate);
  return rate !== null ? String(rate) : '';
}

function _formatAmountLabel(amount) {
  const normalized = _readNullableNumber(amount);
  return normalized === null ? '\u2014' : normalized + ' zł';
}

function _getAutoLockTimeoutMinutes(settings) {
  const seconds = _readNullableNumber(settings && settings.autoLockTimeout);
  if (seconds === null || seconds <= 0) return 2;
  return Math.max(1, Math.round(seconds / 60));
}

function _getAutoLockTimeoutSeconds(value) {
  const minutes = _readNullableNumber(value);
  if (minutes === null || minutes <= 0) return 120;
  return Math.round(minutes * 60);
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
