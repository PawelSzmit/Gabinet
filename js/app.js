'use strict';

// ─── AutoLock ─────────────────────────────────────────────────────────────────
const AutoLock = {
  timer: null,
  timeout: 900_000,
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
    if (typeof SecurityService !== 'undefined' &&
        typeof SecurityService.lockClinicalData === 'function') {
      SecurityService.lockClinicalData({ silent: true });
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
    events.forEach((evt) => {
      document.addEventListener(evt, () => this.reset(), { passive: true });
    });
    this._initialized = true;
    this.start();
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────
const Router = {
  currentView: 'calendar',
  currentParams: {},
  _history: [],

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
    this._send({ type: 'tab-open', tabId: this._tabId });
  },

  notifyDataSaved() {
    if (!this._channel) return;
    this._send({ type: 'data-saved', tabId: this._tabId, ts: Date.now() });
  },

  _send(msg) {
    try {
      this._channel.postMessage(msg);
    } catch (_) {}
  },

  _onMessage(msg) {
    if (!msg || msg.tabId === this._tabId) return;
    if (msg.type === 'data-saved' && typeof toast === 'function') {
      toast('Dane zostaly zmienione w innej zakladce. Odswiez strone, aby zobaczyc aktualny stan.', 'warning', 6000);
    }
  },
};

// ─── App ──────────────────────────────────────────────────────────────────────
const App = {
  _lockMode: false,

  async init() {
    this.showSplash();
    TabGuard.init();

    if (!localStorage.getItem('gabinet_scope_v2_migrated')) {
      localStorage.removeItem('gabinet_access_token');
      localStorage.removeItem('gabinet_token_expiry');
      localStorage.removeItem('gabinet_drive_file_id');
      localStorage.setItem('gabinet_scope_v2_migrated', '1');
    }

    await Encryption.init();

    let bootedFromLocalSnapshot = false;
    let localSnapshotSerialized = null;
    let localSnapshotStats = this._getStateStats();
    if (typeof LocalStore !== 'undefined' && typeof LocalStore.init === 'function') {
      try {
        await LocalStore.init();
        const snapshot = await LocalStore.loadSnapshot();
        if (snapshot && snapshot.serializedData) {
          try {
            deserializeAppData(snapshot.serializedData);
            bootedFromLocalSnapshot = true;
            localSnapshotSerialized = snapshot.serializedData;
            localSnapshotStats = this._getStatsFromSerializedSnapshot(snapshot.serializedData);
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

    await this._waitForGIS();
    DriveService.init();
    await this._sleep(1500);

    const hasToken = DriveService.loadStoredToken();
    if (hasToken) {
      try {
        await DriveService.loadData();
        await this._recoverLocalSnapshotIfDriveLooksEmpty({
          localSnapshotSerialized,
          localSnapshotStats,
        });
        this._afterSignIn();
      } catch (err) {
        console.warn('[App] Could not load Drive data on startup:', err);
        if (err && err.message === 'DRIVE_FILE_NOT_FOUND') {
          // File doesn't exist yet on Drive — safe to proceed as new/empty state.
          // If we have a local snapshot with data, restore it first and let saveData create the file.
          if (bootedFromLocalSnapshot && this._hasMeaningfulData(localSnapshotStats)) {
            console.warn('[App] Drive file not found but local snapshot has data — restoring local and will create Drive file on next save.');
            if (typeof toast === 'function') {
              toast('Plik na Drive nie istnieje. Dane lokalne zostana przywrocone i zapisane na Drive.', 'warning', 5000);
            }
          }
          this._afterSignIn({ preserveView: bootedFromLocalSnapshot });
        } else if (bootedFromLocalSnapshot) {
          this._afterSignIn({ preserveView: true });
        } else {
          this.hideSplash();
          this.showAuth(false);
        }
      }
    } else if (bootedFromLocalSnapshot) {
      this._afterSignIn({ source: 'local-snapshot' });
      if (typeof toast === 'function') {
        toast('Wczytano lokalna kopie danych z tego urzadzenia.', 'info', 3500);
      }
    } else {
      this.hideSplash();
      this.showAuth(false);
    }

    document.querySelectorAll('[data-action="google-signin"]').forEach((btn) => {
      btn.addEventListener('click', () => this._handleSignInClick());
    });

    document.querySelectorAll('[data-auth-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.querySelector(btn.dataset.authScroll);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    const pinForm = document.getElementById('lock-pin-form');
    if (pinForm) {
      pinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handlePinSubmit();
      });
    }

    const signOutBtn = document.getElementById('btn-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => this._handleSignOut());
    }

    const syncActionBtn = document.getElementById('sync-status-action');
    if (syncActionBtn) {
      syncActionBtn.addEventListener('click', () => this._handleSignInClick());
    }

    document.addEventListener('local-store:change', () => this.refreshSyncStatusUi());
    document.addEventListener('clinical-security-changed', () => {
      this.refreshSyncStatusUi();
      if (Router.currentView === 'settings') {
        this.refreshCurrentView();
      }
    });

    this.refreshSyncStatusUi();
  },

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
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 5000);
    });
  },

  _afterSignIn(options = {}) {
    const preserveView = options.preserveView === true;
    this.hideSplash();
    this.hideAuth();
    this.showApp();
    if (typeof SecurityService !== 'undefined' && typeof SecurityService.bootstrapFromLoadedState === 'function') {
      SecurityService.bootstrapFromLoadedState();
    }
    this._generateSessionsIfNeeded();
    AutoLock.init();
    if (preserveView) {
      this.refreshCurrentView();
    } else {
      Router.navigate('calendar', { viewMode: 'monthly', focusDate: new Date().toISOString() });
    }
    if (typeof SecurityService !== 'undefined' &&
        typeof SecurityService.getStatus === 'function' &&
        SecurityService.getStatus() === 'migration-required') {
      toast('Aby bezpiecznie zapisac istniejace notatki kliniczne, ustaw haslo w Ustawieniach.', 'warning', 5000);
    }
    this.refreshSyncStatusUi();
  },

  async onSignIn(token) {
    const preserveView = this._isVisible('app-shell');
    this.showSplash();
    let localSnapshotSerialized = null;
    let localSnapshotStats = this._getStateStats();
    if (
      typeof LocalStore !== 'undefined' &&
      typeof LocalStore.loadSnapshot === 'function'
    ) {
      try {
        const snapshot = await LocalStore.loadSnapshot();
        if (snapshot && snapshot.serializedData) {
          localSnapshotSerialized = snapshot.serializedData;
          localSnapshotStats = this._getStatsFromSerializedSnapshot(snapshot.serializedData);
        }
      } catch (snapshotError) {
        console.warn('[App] Could not inspect local snapshot before sign-in:', snapshotError);
      }
    }
    try {
      if (
        typeof LocalStore !== 'undefined' &&
        typeof LocalStore.shouldPreferLocalSnapshot === 'function' &&
        LocalStore.shouldPreferLocalSnapshot()
      ) {
        await DriveService.saveData();
        if (typeof toast === 'function') {
          toast('Lokalne dane zostaly zsynchronizowane z Google Drive.', 'success', 3500);
        }
      } else {
        await DriveService.loadData();
        await this._recoverLocalSnapshotIfDriveLooksEmpty({
          localSnapshotSerialized,
          localSnapshotStats,
        });
      }
    } catch (err) {
      console.warn('[App] Drive load after sign-in failed:', err);
    }
    this._afterSignIn({ preserveView });
  },

  async _handleSignInClick() {
    const buttons = [
      document.getElementById('btn-google-signin'),
      document.getElementById('sync-status-action'),
      document.getElementById('sv-connect-btn'),
    ];
    buttons.forEach((btn) => {
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = 'Laczenie...';
    });

    try {
      const token = await DriveService.requestToken();
      await this.onSignIn(token);
    } catch (err) {
      console.error('[App] Sign-in failed:', err);
      const authError = document.getElementById('auth-error');
      if (authError) {
        authError.textContent = 'Logowanie nie powiodlo sie. Sprobuj ponownie.';
        authError.hidden = false;
        authError.classList.remove('hidden');
      }
    } finally {
      buttons.forEach((btn) => {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = 'Polacz z Google';
      });
    }
  },

  _handleSignOut() {
    Modal.confirm(
      'Odlaczenie Google',
      'Czy na pewno chcesz odlaczyc Google Drive? Lokalne dane na tym urzadzeniu pozostana dostepne.',
      () => {
        DriveService.signOut();
        if (typeof SecurityService !== 'undefined' && typeof SecurityService.handleSignOut === 'function') {
          SecurityService.handleSignOut();
        }
        if (
          typeof LocalStore !== 'undefined' &&
          typeof LocalStore.hasSnapshot === 'function' &&
          LocalStore.hasSnapshot()
        ) {
          this.showApp();
          this.hideAuth();
          this.refreshCurrentView();
        } else {
          this.hideApp();
          this.showAuth(false);
        }
        this.refreshSyncStatusUi();
        if (typeof toast === 'function') {
          toast('Google Drive zostal odlaczony. Mozesz dalej pracowac na danych lokalnych.', 'info', 4500);
        }
      }
    );
  },

  _handlePinSubmit() {
    const request = (
      typeof SecurityService !== 'undefined' &&
      typeof SecurityService.isStorageReady === 'function' &&
      SecurityService.isStorageReady()
    )
      ? SecurityService.requestClinicalAccess()
      : DriveService.requestToken();

    Promise.resolve(request)
      .then((ok) => {
        if (ok === false) return;
        AutoLock.unlock();
      })
      .catch(() => {
        const msg = document.getElementById('lock-error-msg');
        if (msg) {
          msg.textContent = 'Nie udalo sie zweryfikowac tozsamosci.';
        }
      });
  },

  showSplash() { this._show('splash-screen'); },
  hideSplash() { this._hide('splash-screen'); },

  showAuth(isLock = false) {
    this._lockMode = isLock;
    const screen = document.getElementById('auth-screen');
    if (screen) {
      screen.hidden = false;
      screen.classList.remove('hidden');
      const title = screen.querySelector('.auth-hero__title');
      if (title) {
        title.textContent = isLock
          ? 'Zaloguj sie ponownie, aby wrocic do spokojnej pracy.'
          : 'Cyfrowy porzadek dla gabinetu psychoterapeutycznego.';
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
      signInBtn.textContent = 'Polacz z Google';
    }
    this.refreshSyncStatusUi();
  },

  hideAuth() { this._hide('auth-screen'); },
  showApp() { this._show('app-shell'); },
  hideApp() { this._hide('app-shell'); },

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
    action.textContent = summary.actionLabel || 'Polacz z Google';
    action.hidden = !summary.actionLabel;
    banner.hidden = false;
    banner.classList.remove('hidden');
  },

  showView(name, params = {}) {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.classList.add('view-transitioning');

    requestAnimationFrame(() => {
      switch (name) {
        case 'today':
        case 'calendar': renderCalendar(params); break;
        case 'patients': renderPatients(params); break;
        case 'finance': renderFinance(params); break;
        case 'settings': renderSettings(params); break;
        default:
          container.innerHTML =
            '<p class="view-error">Nieznany widok: ' + name + '</p>';
      }
      container.classList.remove('view-transitioning');
    });
  },

  switchTab(name) {
    Router.navigate(name);
  },

  _updateTabBar(activeView) {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const isActive = btn.dataset.view === activeView;
      btn.classList.toggle('active', isActive);
      btn.classList.remove('tab-btn--active');
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  },

  _generateSessionsIfNeeded() {
    if (typeof generateCurrentMonthSessions !== 'function') return;

    const now = new Date();
    const yearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    let generatedNew = false;

    if (typeof AppState !== 'undefined' && AppState.generatedMonths) {
      if (!AppState.generatedMonths.includes(yearMonth)) {
        if (typeof AppState.patients !== 'undefined') {
          AppState.patients
            .filter((p) => !p.isArchived && p.isActive)
            .forEach((p) => { generateCurrentMonthSessions(p); });
        }
        AppState.generatedMonths.push(yearMonth);
        generatedNew = true;
      }
    } else if (typeof AppState !== 'undefined' && AppState.patients) {
      AppState.patients
        .filter((p) => !p.isArchived && p.isActive)
        .forEach((p) => { generateCurrentMonthSessions(p); });
      AppState.generatedMonths = AppState.generatedMonths || [];
      AppState.generatedMonths.push(yearMonth);
      generatedNew = true;
    }

    // Always repair vacation cancellations — handles sessions that existed before
    // a vacation was added, and sessions generated in previous months for future dates.
    if (typeof repairVacationCancellations === 'function') {
      const fixed = repairVacationCancellations();
      if (fixed > 0 && generatedNew === false) {
        // Only need to save if we fixed something but didn't already save from generation
        persistData();
        return;
      }
    }

    if (generatedNew) {
      persistData();
    }
  },

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

  _getStateStats() {
    return {
      patients: Array.isArray(AppState && AppState.patients) ? AppState.patients.length : 0,
      sessions: Array.isArray(AppState && AppState.sessions) ? AppState.sessions.length : 0,
      payments: Array.isArray(AppState && AppState.payments) ? AppState.payments.length : 0,
    };
  },

  _getStatsFromSerializedSnapshot(serializedData) {
    if (typeof serializedData !== 'string' || !serializedData.trim()) {
      return { patients: 0, sessions: 0, payments: 0 };
    }

    try {
      const parsed = JSON.parse(serializedData);
      return {
        patients: Array.isArray(parsed && parsed.patients) ? parsed.patients.length : 0,
        sessions: Array.isArray(parsed && parsed.sessions) ? parsed.sessions.length : 0,
        payments: Array.isArray(parsed && parsed.payments) ? parsed.payments.length : 0,
      };
    } catch (_) {
      return { patients: 0, sessions: 0, payments: 0 };
    }
  },

  _hasMeaningfulData(stats) {
    if (!stats) return false;
    return (stats.patients || 0) > 0 || (stats.sessions || 0) > 0 || (stats.payments || 0) > 0;
  },

  async _recoverLocalSnapshotIfDriveLooksEmpty(options = {}) {
    const localSnapshotSerialized = options.localSnapshotSerialized || null;
    const localSnapshotStats = options.localSnapshotStats || null;
    const driveStats = this._getStateStats();

    if (!localSnapshotSerialized) return false;
    if (!this._hasMeaningfulData(localSnapshotStats)) return false;
    if (this._hasMeaningfulData(driveStats)) return false;

    console.warn('[App] Drive returned an empty dataset. Restoring richer local snapshot instead.');
    deserializeAppData(localSnapshotSerialized);

    if (typeof LocalStore !== 'undefined' && typeof LocalStore.storeSerializedSnapshot === 'function') {
      try {
        await LocalStore.storeSerializedSnapshot(localSnapshotSerialized, {
          hasPendingSync: true,
          lastLocalWriteAt: new Date().toISOString(),
          source: 'local-recovery',
        });
      } catch (snapshotError) {
        console.warn('[App] Could not refresh recovered local snapshot:', snapshotError);
      }
    }

    if (typeof DriveService !== 'undefined' && typeof DriveService.saveData === 'function' && DriveService.isSignedIn()) {
      try {
        await DriveService.saveData();
      } catch (saveError) {
        console.warn('[App] Could not push recovered local snapshot to Drive:', saveError);
      }
    }

    if (typeof toast === 'function') {
      toast('Przywrocono lokalna kopie danych, bo Google Drive zwrocil pusty stan.', 'warning', 5000);
    }

    return true;
  },

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      CalendarViews.viewMode = 'monthly';
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
          '<span>Auto-lock danych klinicznych (minuty)</span>' +
          '<input type="number" id="set-autolock-timeout"' +
                 ' value="' + _getAutoLockTimeoutMinutes(settings) + '"' +
                 ' min="1" step="1" />' +
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

function _getAutoLockTimeoutMinutes(settings) {
  const seconds = settings && settings.autoLockTimeout
    ? parseInt(settings.autoLockTimeout, 10)
    : 120;
  return Math.max(1, Math.round((Number.isFinite(seconds) ? seconds : 120) / 60));
}

function _getAutoLockTimeoutSeconds(value) {
  const minutes = parseInt(value, 10);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 2) * 60;
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
        const cb = this._confirmCallback;
        this.close();
        cb && cb();
      };
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        const cb = this._cancelCallback;
        this.close();
        cb && cb();
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
