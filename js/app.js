/* ===========================================
   App - routing, initialization, global state
   =========================================== */

const App = (() => {
  let appData = null;
  let isInitialized = false;

  async function init() {
    registerServiceWorker();

    Auth.init(onLogin, onLogout);

    setupModalCloseHandlers();

    if (Auth.isLoggedIn()) {
      onLogin();
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
  }

  async function onLogin() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-shell').classList.remove('hidden');

    await Encryption.init();

    appData = await Drive.loadData();

    if (!appData.patients) appData.patients = [];
    if (!appData.sessions) appData.sessions = [];
    if (!appData.payments) appData.payments = [];
    if (!appData.sessionNotes) appData.sessionNotes = [];
    if (!appData.progressEntries) appData.progressEntries = [];
    if (!appData.blockedPeriods) appData.blockedPeriods = [];
    if (!appData.invoices) appData.invoices = [];
    if (!appData.settings) appData.settings = {};

    if (!isInitialized) {
      Patients.init();
      Sessions.init();
      Calendar.init();
      Payments.init();
      Finance.init();
      Notes.init();
      Archive.init();
      setupNavigation();
      setupSettings();
      isInitialized = true;
    }

    Sessions.checkAndGenerateMonthlySessionsIfNeeded();
    await Drive.saveData(appData);

    loadSettingsForm();
    handleRoute();

    checkUnpaidNotifications();
  }

  function onLogout() {
    appData = null;
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.add('active');
    localStorage.removeItem('gabinet_data_cache');
  }

  function setupNavigation() {
    document.querySelectorAll('#bottom-nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        navigate(item.dataset.route);
      });
    });

    document.querySelectorAll('#sidebar-nav .sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        navigate(item.dataset.route);
      });
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      window.history.back();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      navigate('settings');
    });

    window.addEventListener('hashchange', handleRoute);
  }

  function setupSettings() {
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-force-sync').addEventListener('click', async () => {
      appData = await Drive.forceSync();
      Utils.showToast('Dane zsynchronizowane', 'success');
      refreshViews();
    });
    document.getElementById('btn-reset-data').addEventListener('click', () => {
      Utils.showConfirm(
        'Resetuj dane',
        'Czy na pewno chcesz usunąć WSZYSTKIE dane? Tej operacji nie można cofnąć!',
        async () => {
          appData = Drive.getDefaultData();
          await Drive.saveData(appData);
          localStorage.removeItem('lastSessionGenMonth');
          Utils.showToast('Dane zresetowane', 'success');
          refreshViews();
        }
      );
    });
    document.getElementById('btn-add-blocked').addEventListener('click', addBlockedPeriod);
  }

  function setupModalCloseHandlers() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', Utils.hideModals);
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        Utils.hideModals();
      }
    });
  }

  function navigate(route) {
    const newHash = '#/' + route;
    if (window.location.hash === newHash) {
      handleRoute();
    } else {
      window.location.hash = newHash;
    }
  }

  function handleRoute() {
    const hash = window.location.hash || '#/calendar';
    const path = hash.replace('#/', '').split('/');
    const route = path[0];
    const param = path[1];
    const subparam = path[2];

    updateActiveNav(route);

    document.getElementById('btn-back').classList.add('hidden');

    switch (route) {
      case 'calendar':
        setTitle('Kalendarz');
        showView('view-calendar');
        Calendar.render();
        break;

      case 'patients':
        if (param === 'new') {
          setTitle('Nowy pacjent');
          showBack();
          Patients.showPatientForm();
        } else if (param && subparam === 'edit') {
          setTitle('Edycja pacjenta');
          showBack();
          Patients.showPatientForm(param);
        } else if (param) {
          showBack();
          showView('view-patient-detail');
          Notes.setCurrentPatient(param);
          Patients.renderPatientDetail(param);
          const patient = appData.patients.find(p => p.id === param);
          setTitle(patient ? patient.pseudonym : 'Pacjent');
        } else {
          setTitle('Pacjenci');
          showView('view-patients');
          Patients.renderPatientsList();
        }
        break;

      case 'finance':
        setTitle('Finanse');
        showView('view-finance');
        if (param === 'payments') {
          document.querySelectorAll('#view-finance .tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('#view-finance .tab-content').forEach(tc => tc.classList.remove('active'));
          document.querySelector('#view-finance .tab[data-tab="fin-payments"]').classList.add('active');
          document.getElementById('fin-payments').classList.add('active');
          Payments.renderPaymentsList();
        } else {
          document.querySelectorAll('#view-finance .tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('#view-finance .tab-content').forEach(tc => tc.classList.remove('active'));
          document.querySelector('#view-finance .tab[data-tab="fin-dashboard"]').classList.add('active');
          document.getElementById('fin-dashboard').classList.add('active');
          Finance.renderDashboard();
        }
        break;

      case 'settings':
        setTitle('Ustawienia');
        showView('view-settings');
        loadSettingsForm();
        break;

      case 'archive':
        setTitle('Archiwum');
        showView('view-archive');
        showBack();
        Archive.renderArchiveList();
        break;

      default:
        setTitle('Kalendarz');
        showView('view-calendar');
        Calendar.render();
    }
  }

  function setTitle(title) {
    document.getElementById('header-title').textContent = title;
  }

  function showBack() {
    document.getElementById('btn-back').classList.remove('hidden');
  }

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
  }

  function updateActiveNav(route) {
    const mainRoute = route.split('/')[0];

    document.querySelectorAll('#bottom-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === mainRoute);
    });

    document.querySelectorAll('#sidebar-nav .sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === mainRoute);
    });
  }

  function loadSettingsForm() {
    if (!appData || !appData.settings) return;
    const s = appData.settings;
    document.getElementById('set-name').value = s.therapistName || '';
    document.getElementById('set-address').value = s.therapistAddress || '';
    document.getElementById('set-nip').value = s.therapistNIP || '';

    const defaultHours = {
      monday:    { enabled: false, start: '08:00', end: '16:00' },
      tuesday:   { enabled: true,  start: '08:00', end: '20:00' },
      wednesday: { enabled: true,  start: '08:00', end: '20:00' },
      thursday:  { enabled: true,  start: '08:00', end: '20:00' },
      friday:    { enabled: false, start: '08:00', end: '16:00' }
    };
    const wh = s.workingHours || defaultHours;

    document.querySelectorAll('#working-hours-list .working-day-row').forEach(row => {
      const day = row.dataset.day;
      const cfg = wh[day] || defaultHours[day];
      if (cfg) {
        row.querySelector('.wh-enabled').checked = cfg.enabled;
        row.querySelector('.wh-start').value = cfg.start || '08:00';
        row.querySelector('.wh-end').value = cfg.end || '20:00';
      }
    });

    document.getElementById('set-google-email').textContent = Auth.getUserEmail() || 'Zalogowano';
    renderBlockedPeriods();
  }

  function saveSettings() {
    if (!appData) return;
    appData.settings.therapistName = document.getElementById('set-name').value.trim();
    appData.settings.therapistAddress = document.getElementById('set-address').value.trim();
    appData.settings.therapistNIP = document.getElementById('set-nip').value.trim();

    const workingHours = {};
    document.querySelectorAll('#working-hours-list .working-day-row').forEach(row => {
      const day = row.dataset.day;
      workingHours[day] = {
        enabled: row.querySelector('.wh-enabled').checked,
        start: row.querySelector('.wh-start').value || '08:00',
        end: row.querySelector('.wh-end').value || '20:00'
      };
    });
    appData.settings.workingHours = workingHours;

    const blockedPeriods = Array.from(document.querySelectorAll('.blocked-item')).map(item => ({
      id: item.dataset.id || Utils.generateUUID(),
      startDate: item.querySelector('.blocked-start').value,
      endDate: item.querySelector('.blocked-end').value,
      reason: item.querySelector('.blocked-reason').value
    })).filter(bp => bp.startDate && bp.endDate);
    appData.blockedPeriods = blockedPeriods;

    saveAndRefresh();
    Utils.showToast('Ustawienia zapisane', 'success');
  }

  function addBlockedPeriod(existing) {
    const list = document.getElementById('blocked-periods-list');
    const item = document.createElement('div');
    item.className = 'blocked-item';
    const bp = existing && typeof existing === 'object' ? existing : {};
    item.dataset.id = bp.id || Utils.generateUUID();
    item.innerHTML = `
      <input type="date" class="blocked-start" value="${bp.startDate || ''}" placeholder="Od">
      <span>-</span>
      <input type="date" class="blocked-end" value="${bp.endDate || ''}" placeholder="Do">
      <input type="text" class="blocked-reason" value="${Utils.escapeHtml(bp.reason || '')}" placeholder="Powód" style="flex:2">
      <button type="button" class="btn-remove" title="Usuń">&times;</button>
    `;
    item.querySelector('.btn-remove').addEventListener('click', () => item.remove());
    list.appendChild(item);
  }

  function renderBlockedPeriods() {
    const list = document.getElementById('blocked-periods-list');
    list.innerHTML = '';
    if (appData && appData.blockedPeriods) {
      appData.blockedPeriods.forEach(bp => addBlockedPeriod(bp));
    }
  }

  function getData() {
    return appData;
  }

  function saveAndRefresh() {
    if (appData) {
      Drive.saveData(appData);
    }
  }

  function refreshViews() {
    handleRoute();
  }

  function checkUnpaidNotifications() {
    if (!appData) return;
    appData.patients.filter(p => !p.isArchived).forEach(patient => {
      const unpaid = Patients.getUnpaidSessionsCount(patient.id, appData);
      if (unpaid >= 3) {
        Utils.showToast(`${patient.pseudonym} ma ${unpaid} nieopłaconych sesji`, 'warning');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    navigate,
    getData,
    saveAndRefresh,
    showView,
    refreshViews
  };
})();
