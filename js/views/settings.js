'use strict';
// settings.js – Settings view for Gabinet PWA

const SettingsView = (() => {
  function esc(s) {
    return escapeHtml(s);
  }

  function formatDateRange(start, end) {
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    const s = new Date(start).toLocaleDateString('pl-PL', opts);
    const e = new Date(end).toLocaleDateString('pl-PL', opts);
    return s + ' – ' + e;
  }

  function getClinicalSecuritySummary() {
    if (typeof SecurityService === 'undefined' || typeof SecurityService.getUiSummary !== 'function') {
      return {
        status: 'Ochrona niedostepna',
        note: 'Nie udalo sie wczytac modulu ochrony danych klinicznych.',
        primaryLabel: null,
        changeLabel: null,
      };
    }
    return SecurityService.getUiSummary();
  }

  function getSyncSummary() {
    if (typeof LocalStore === 'undefined' || typeof LocalStore.getSyncStatusSummary !== 'function') {
      return {
        status: 'Stan synchronizacji niedostepny',
        note: 'Ta przegladarka nie udostepnia lokalnego snapshotu offline.',
        actionLabel: null,
        actionId: null,
        actionClass: 'blue',
      };
    }

    const summary = LocalStore.getSyncStatusSummary();
    const connected = typeof DriveService !== 'undefined'
      && typeof DriveService.isSignedIn === 'function'
      && DriveService.isSignedIn();

    return {
      status: summary.status,
      note: summary.note,
      actionLabel: connected ? 'Odlacz Google Drive' : (summary.actionLabel || 'Polacz z Google'),
      actionId: connected ? 'sv-signout-btn' : 'sv-connect-btn',
      actionClass: connected ? 'danger' : 'blue',
    };
  }

  function injectStyles() {
    if (document.getElementById('sv-styles')) return;
    const css = `
      .sv-wrap { max-width: 680px; margin: 0 auto; padding: 0 0 80px; }
      .sv-section { background: #fff; border-radius: 12px; margin: 16px 12px; overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,.08); }
      .sv-section-title { font-size: 13px; font-weight: 600; color: #8e8e93; text-transform: uppercase;
                          letter-spacing: .5px; padding: 16px 16px 4px; }
      .sv-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f2f2f7; gap: 12px; }
      .sv-row:last-child { border-bottom: none; }
      .sv-row label { font-size: 15px; color: #000; flex: 0 0 auto; min-width: 130px; }
      .sv-row input[type=text], .sv-row input[type=number], .sv-row select {
        flex: 1; border: none; outline: none; font-size: 15px; color: #3a3a3c;
        background: transparent; text-align: right; min-width: 0; }
      .sv-row input[type=text]::placeholder, .sv-row input[type=number]::placeholder { color: #c7c7cc; }
      .sv-row .sv-value { flex: 1; text-align: right; font-size: 15px; color: #3a3a3c; }
      .sv-row-btn { justify-content: center; cursor: pointer; }
      .sv-row-btn span { font-size: 15px; }
      .sv-row-btn.danger span { color: #ff3b30; }
      .sv-row-btn.orange span { color: #ff9500; }
      .sv-row-btn.blue span { color: #007aff; }
      .sv-row-btn:active { background: #f2f2f7; }
      .sv-blocked-row { padding: 12px 16px; border-bottom: 1px solid #f2f2f7; }
      .sv-blocked-row:last-child { border-bottom: none; }
      .sv-blocked-row .sv-blocked-dates { font-size: 15px; color: #000; }
      .sv-blocked-row .sv-blocked-reason { font-size: 13px; color: #8e8e93; margin-top: 2px; }
      .sv-blocked-row .sv-blocked-del { float: right; color: #ff3b30; font-size: 22px; line-height: 1;
                                        background: none; border: none; cursor: pointer; padding: 0 0 0 8px; }
      .sv-about { text-align: center; padding: 28px 20px; }
      .sv-about-icon { font-size: 64px; margin-bottom: 8px; }
      .sv-about-title { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
      .sv-about-version { font-size: 14px; color: #8e8e93; margin-bottom: 16px; }
      .sv-about-desc { font-size: 14px; color: #3a3a3c; line-height: 1.5; margin-bottom: 20px; }
      .sv-feature-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px;
                        border-top: 1px solid #f2f2f7; text-align: left; }
      .sv-feature-row .sv-ficon { font-size: 22px; color: #007aff; width: 32px; text-align: center; }
      .sv-feature-row .sv-ftext { font-size: 14px; color: #3a3a3c; }
      .sv-account { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
      .sv-account-avatar { width: 40px; height: 40px; border-radius: 50%; background: #007aff;
                           color: #fff; display: flex; align-items: center; justify-content: center;
                           font-weight: 700; font-size: 16px; flex-shrink: 0; }
      .sv-account-info { flex: 1; }
      .sv-account-name { font-size: 15px; font-weight: 600; }
      .sv-account-email { font-size: 13px; color: #8e8e93; }
      .sv-regen-ok { font-size: 13px; color: #34c759; padding: 4px 16px 12px; display: none; }
      .sv-row-note { align-items: flex-start; }
      .sv-row-note span { font-size: 13px; line-height: 1.5; color: #5d6a60; }
      .sv-security-status { font-size: 15px; font-weight: 600; color: #243126; text-align: right; }

      .sv-sheet-bg { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 900;
                     display: flex; align-items: flex-end; }
      .sv-sheet { background: #fff; border-radius: 20px 20px 0 0; width: 100%; max-width: 680px;
                  margin: 0 auto; padding: 0 0 env(safe-area-inset-bottom); animation: slideUp .3s ease; }
      .sv-sheet-handle { width: 40px; height: 4px; background: #c7c7cc; border-radius: 2px;
                         margin: 12px auto 0; }
      .sv-sheet-header { display: flex; align-items: center; justify-content: space-between;
                         padding: 16px 20px 8px; }
      .sv-sheet-title { font-size: 18px; font-weight: 700; }
      .sv-sheet-close { font-size: 22px; background: none; border: none; color: #8e8e93; cursor: pointer; }
      .sv-sheet-body { padding: 8px 20px 20px; }
      .sv-sheet-field { margin-bottom: 16px; }
      .sv-sheet-field label { display: block; font-size: 13px; color: #8e8e93; margin-bottom: 4px; }
      .sv-sheet-field input, .sv-sheet-field textarea {
        width: 100%; border: 1px solid #e5e5ea; border-radius: 10px;
        padding: 10px 12px; font-size: 16px; box-sizing: border-box; }
      .sv-sheet-field input:focus, .sv-sheet-field textarea:focus { outline: none; border-color: #007aff; }
      .sv-btn-primary { width: 100%; padding: 14px; background: #007aff; color: #fff; border: none;
                        border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; }
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @media (prefers-color-scheme: dark) {
        .sv-section { background: #1c1c1e; }
        .sv-section-title { color: #636366; }
        .sv-row { border-bottom-color: #2c2c2e; }
        .sv-row label { color: #fff; }
        .sv-row input[type=text], .sv-row input[type=number], .sv-row select,
        .sv-row .sv-value { color: #ebebf5; }
        .sv-blocked-row { border-bottom-color: #2c2c2e; }
        .sv-blocked-row .sv-blocked-dates { color: #fff; }
        .sv-about-title { color: #fff; }
        .sv-about-desc { color: #ebebf5; }
        .sv-feature-row .sv-ftext { color: #ebebf5; }
        .sv-account-name { color: #fff; }
        .sv-sheet { background: #1c1c1e; }
        .sv-sheet-title { color: #fff; }
        .sv-sheet-field input, .sv-sheet-field textarea {
          background: #2c2c2e; border-color: #3a3a3c; color: #fff; }
        .sv-wrap { background: transparent; }
      }
    `;
    const s = document.createElement('style');
    s.id = 'sv-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function render(container) {
    injectStyles();
    const settings = (typeof AppState !== 'undefined' && AppState.settings) ? AppState.settings : {};
    const userInfo = _getUserInfo();
    const securitySummary = getClinicalSecuritySummary();
    const syncSummary = getSyncSummary();

    container.innerHTML = `
      <div class="sv-wrap">

        <div class="sv-section-title">Dane terapeuty</div>
        <div class="sv-section">
          <div class="sv-row">
            <label for="sv-name">Imie i nazwisko</label>
            <input type="text" id="sv-name" value="${esc(settings.therapistName || '')}" placeholder="Jan Kowalski">
          </div>
          <div class="sv-row">
            <label for="sv-addr">Adres gabinetu</label>
            <input type="text" id="sv-addr" value="${esc(settings.therapistAddress || '')}" placeholder="ul. Przykladowa 1, Warszawa">
          </div>
          <div class="sv-row">
            <label for="sv-nip">NIP</label>
            <input type="text" id="sv-nip" value="${esc(settings.therapistNIP || '')}" placeholder="opcjonalnie">
          </div>
        </div>

        <div class="sv-section-title">Konto Google</div>
        <div class="sv-section">
          <div class="sv-account">
            <div class="sv-account-avatar">${userInfo.initial}</div>
            <div class="sv-account-info">
              <div class="sv-account-name">${esc(userInfo.name || 'Uzytkownik')}</div>
              <div class="sv-account-email">${esc(userInfo.email || 'Dane na Google Drive')}</div>
            </div>
          </div>
          <div class="sv-row">
            <label>Stan danych</label>
            <div class="sv-value sv-security-status">${esc(syncSummary.status)}</div>
          </div>
          <div class="sv-row sv-row-note">
            <span>${esc(syncSummary.note)}</span>
          </div>
          ${syncSummary.actionLabel ? `
            <div class="sv-row sv-row-btn ${esc(syncSummary.actionClass)}" id="${esc(syncSummary.actionId)}">
              <span>${esc(syncSummary.actionLabel)}</span>
            </div>
          ` : ''}
        </div>

        <div class="sv-section-title">Ochrona danych klinicznych</div>
        <div class="sv-section">
          <div class="sv-row">
            <label>Status</label>
            <div class="sv-value sv-security-status">${esc(securitySummary.status)}</div>
          </div>
          <div class="sv-row sv-row-note">
            <span>${esc(securitySummary.note)}</span>
          </div>
          ${securitySummary.primaryLabel ? `
            <div class="sv-row sv-row-btn blue" id="sv-clinical-primary-btn">
              <span>${esc(securitySummary.primaryLabel)}</span>
            </div>
          ` : ''}
          ${securitySummary.changeLabel ? `
            <div class="sv-row sv-row-btn blue" id="sv-clinical-change-btn">
              <span>${esc(securitySummary.changeLabel)}</span>
            </div>
          ` : ''}
        </div>

        <div class="sv-section-title">Zablokowane terminy</div>
        <div class="sv-section" id="sv-blocked-list">
          ${renderBlockedList()}
          <div class="sv-row sv-row-btn blue" id="sv-add-blocked-btn">
            <span>+ Dodaj zablokowany termin</span>
          </div>
        </div>

        <div class="sv-section-title">Zarzadzanie danymi</div>
        <div class="sv-section">
          <div class="sv-row sv-row-btn orange" id="sv-regen-btn">
            <span>🔄 Generuj sesje na biezacy miesiac</span>
          </div>
          <div class="sv-regen-ok" id="sv-regen-ok">✅ Sesje zostaly wygenerowane</div>
          <div class="sv-row sv-row-btn blue" id="sv-export-btn">
            <span>⬇️ Eksportuj dane (JSON)</span>
          </div>
          <div class="sv-row sv-row-btn orange" id="sv-recover-btn">
            <span>🔧 Odzyskaj czasy sesji z historii Drive</span>
          </div>
          <div id="sv-recover-log" style="padding:8px 16px;font-size:13px;color:#8e8e93;display:none;max-height:200px;overflow-y:auto;white-space:pre-line;"></div>
        </div>

        <div class="sv-section-title">O aplikacji</div>
        <div class="sv-section">
          <div class="sv-about">
            <div class="sv-about-icon">🔒</div>
            <div class="sv-about-title">Gabinet</div>
            <div class="sv-about-version">Wersja 1.0 PWA</div>
            <div class="sv-about-desc">Aplikacja do zarzadzania gabinetem psychoterapeutycznym</div>
          </div>
          <div class="sv-feature-row"><span class="sv-ficon">☁️</span><span class="sv-ftext">Dane przechowywane na Twoim Google Drive</span></div>
          <div class="sv-feature-row"><span class="sv-ficon">🔒</span><span class="sv-ftext">Brak zewnetrznych serwerow i baz danych</span></div>
          <div class="sv-feature-row"><span class="sv-ficon">📵</span><span class="sv-ftext">Lokalna kopia danych pozwala wrocic do pracy po odswiezeniu offline</span></div>
          <div class="sv-feature-row"><span class="sv-ficon">💳</span><span class="sv-ftext">Obsluga gotowki i przelewow bankowych</span></div>
        </div>

      </div>
    `;

    bindEvents(container);
  }

  function renderBlockedList() {
    const periods = (typeof AppState !== 'undefined') ? (AppState.blockedPeriods || []) : [];
    if (periods.length === 0) {
      return '<div class="sv-row"><span style="color:#8e8e93;font-size:14px">Brak zablokowanych terminow</span></div>';
    }
    return periods.map((p) => `
      <div class="sv-blocked-row" data-id="${esc(p.id)}">
        <button class="sv-blocked-del" data-del="${esc(p.id)}" title="Usun">×</button>
        <div class="sv-blocked-dates">${esc(formatDateRange(p.startDate, p.endDate))}</div>
        ${p.reason ? `<div class="sv-blocked-reason">${esc(p.reason)}</div>` : ''}
      </div>
    `).join('');
  }

  function _getUserInfo() {
    try {
      const raw = localStorage.getItem('gabinet_user_info');
      if (raw) {
        const info = JSON.parse(raw);
        return {
          name: info.name || '',
          email: info.email || '',
          initial: (info.name || info.email || 'U')[0].toUpperCase(),
        };
      }
    } catch (e) {}
    return { name: '', email: '', initial: 'U' };
  }

  function bindEvents(container) {
    const saveDebounced = _debounce(saveSettings, 800);
    ['sv-name', 'sv-addr', 'sv-nip'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('input', saveDebounced);
    });

    const signOutBtn = document.getElementById('sv-signout-btn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        if (typeof App !== 'undefined' && typeof App._handleSignOut === 'function') {
          App._handleSignOut();
        }
      });
    }

    const connectBtn = document.getElementById('sv-connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        if (typeof App !== 'undefined' && typeof App._handleSignInClick === 'function') {
          App._handleSignInClick();
        }
      });
    }

    const clinicalPrimaryBtn = document.getElementById('sv-clinical-primary-btn');
    if (clinicalPrimaryBtn) {
      clinicalPrimaryBtn.addEventListener('click', async () => {
        if (typeof SecurityService === 'undefined') return;
        if (SecurityService.isUnlocked && SecurityService.isUnlocked()) {
          if (typeof SecurityService.lockClinicalData === 'function') {
            await SecurityService.lockClinicalData();
          }
          render(container);
          return;
        }
        if (typeof SecurityService.requestClinicalAccess === 'function') {
          const ok = await SecurityService.requestClinicalAccess();
          if (ok) render(container);
        }
      });
    }

    const clinicalChangeBtn = document.getElementById('sv-clinical-change-btn');
    if (clinicalChangeBtn) {
      clinicalChangeBtn.addEventListener('click', async () => {
        if (typeof SecurityService !== 'undefined' && typeof SecurityService.openChangePasswordFlow === 'function') {
          const changed = await SecurityService.openChangePasswordFlow();
          if (changed) render(container);
        }
      });
    }

    const addBtn = document.getElementById('sv-add-blocked-btn');
    if (addBtn) addBtn.addEventListener('click', showBlockPeriodSheet);

    const blockedList = document.getElementById('sv-blocked-list');
    if (blockedList) {
      blockedList.addEventListener('click', (e) => {
        const delBtn = e.target.closest('[data-del]');
        if (delBtn) deleteBlockedPeriod(delBtn.dataset.del);
      });
    }

    const regenBtn = document.getElementById('sv-regen-btn');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => {
        if (typeof AppState !== 'undefined' && AppState.patients) {
          AppState.patients.filter((p) => !p.isArchived && p.isActive).forEach((patient) => {
            if (typeof regenerateCurrentMonth === 'function') regenerateCurrentMonth(patient);
          });
          if (typeof persistData !== 'undefined') persistData();
        }
        const ok = document.getElementById('sv-regen-ok');
        if (ok) {
          ok.style.display = 'block';
          setTimeout(() => { ok.style.display = 'none'; }, 3000);
        }
      });
    }

    const recoverBtn = document.getElementById('sv-recover-btn');
    if (recoverBtn) {
      recoverBtn.addEventListener('click', async () => {
        if (!confirm('Czy chcesz sprobowac odzyskac oryginalne czasy sesji i harmonogramy pacjentow z historii wersji Google Drive?')) return;

        const logEl = document.getElementById('sv-recover-log');
        if (logEl) {
          logEl.style.display = 'block';
          logEl.textContent = '';
        }

        const addLog = (msg) => {
          if (logEl) logEl.textContent += msg + '\n';
          console.log('[Recovery]', msg);
        };

        recoverBtn.style.pointerEvents = 'none';
        recoverBtn.style.opacity = '0.5';

        try {
          if (typeof DataRecovery === 'undefined') throw new Error('DataRecovery nie jest dostepny.');
          const result = await DataRecovery.recoverFromHistory(addLog);
          if (result.sessionsFixed > 0 || result.patientsFixed > 0) {
            if (typeof toast === 'function') toast('Dane odzyskane!', 'success');
          } else {
            if (typeof toast === 'function') toast('Nie znaleziono danych do naprawienia.', 'warning');
          }
        } catch (err) {
          addLog('❌ Blad: ' + err.message);
          if (typeof toast === 'function') toast('Blad odzyskiwania: ' + err.message, 'error');
        } finally {
          recoverBtn.style.pointerEvents = '';
          recoverBtn.style.opacity = '';
        }
      });
    }

    const exportBtn = document.getElementById('sv-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const json = typeof serializeAppData === 'function'
            ? await serializeAppData()
            : JSON.stringify(AppState, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'gabinet-backup-' + new Date().toISOString().slice(0, 10) + '.json';
          a.click();
          URL.revokeObjectURL(url);
          if (typeof toast === 'function') toast('Dane wyeksportowane', 'success');
        } catch (err) {
          if (typeof toast === 'function') toast('Blad eksportu: ' + err.message, 'error');
        }
      });
    }
  }

  function saveSettings() {
    const nameEl = document.getElementById('sv-name');
    const addrEl = document.getElementById('sv-addr');
    const nipEl = document.getElementById('sv-nip');
    if (typeof AppState === 'undefined') return;
    if (!AppState.settings) AppState.settings = {};
    if (nameEl) AppState.settings.therapistName = nameEl.value.trim();
    if (addrEl) AppState.settings.therapistAddress = addrEl.value.trim();
    if (nipEl) AppState.settings.therapistNIP = nipEl.value.trim();
    if (typeof persistData !== 'undefined') persistData();
  }

  function deleteBlockedPeriod(id) {
    if (!confirm('Usunac zablokowany termin?')) return;
    if (typeof AppState !== 'undefined') {
      AppState.blockedPeriods = (AppState.blockedPeriods || []).filter((p) => p.id !== id);
      if (typeof persistData !== 'undefined') persistData();
    }
    const list = document.getElementById('sv-blocked-list');
    if (list) {
      const addBtn = list.querySelector('#sv-add-blocked-btn');
      list.innerHTML = renderBlockedList() + (addBtn ? addBtn.outerHTML : '');
      const newAddBtn = list.querySelector('#sv-add-blocked-btn');
      if (newAddBtn) newAddBtn.addEventListener('click', showBlockPeriodSheet);
      list.addEventListener('click', (e) => {
        const delBtn = e.target.closest('[data-del]');
        if (delBtn) deleteBlockedPeriod(delBtn.dataset.del);
      });
    }
    if (typeof toast === 'function') toast('Termin usuniety', 'success');
  }

  function showBlockPeriodSheet() {
    const today = new Date().toISOString().slice(0, 10);
    const html = `
      <div class="sv-sheet-bg" id="sv-bp-bg">
        <div class="sv-sheet">
          <div class="sv-sheet-handle"></div>
          <div class="sv-sheet-header">
            <span class="sv-sheet-title">Zablokuj termin</span>
            <button class="sv-sheet-close" id="sv-bp-close">×</button>
          </div>
          <div class="sv-sheet-body">
            <div class="sv-sheet-field">
              <label>Data od</label>
              <input type="date" id="sv-bp-start" value="${today}">
            </div>
            <div class="sv-sheet-field">
              <label>Data do</label>
              <input type="date" id="sv-bp-end" value="${today}">
            </div>
            <div class="sv-sheet-field">
              <label>Powod (opcjonalnie)</label>
              <input type="text" id="sv-bp-reason" placeholder="np. Urlop, Szkolenie">
            </div>
            <button class="sv-btn-primary" id="sv-bp-save">Zablokuj termin</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    const bg = document.getElementById('sv-bp-bg');
    document.getElementById('sv-bp-close').addEventListener('click', () => bg.remove());
    bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });

    document.getElementById('sv-bp-save').addEventListener('click', () => {
      const start = document.getElementById('sv-bp-start').value;
      const end = document.getElementById('sv-bp-end').value;
      const reason = document.getElementById('sv-bp-reason').value.trim();

      if (!start || !end) { alert('Uzupelnij daty.'); return; }
      if (end < start) { alert('Data koncowa musi byc po dacie poczatkowej.'); return; }

      const period = {
        id: typeof uuid === 'function' ? uuid() : Date.now().toString(),
        startDate: start,
        endDate: end,
        reason,
      };

      if (typeof AppState !== 'undefined') {
        if (!AppState.blockedPeriods) AppState.blockedPeriods = [];
        AppState.blockedPeriods.push(period);
        if (typeof persistData !== 'undefined') persistData();
      }

      bg.remove();

      const list = document.getElementById('sv-blocked-list');
      if (list) {
        list.innerHTML = renderBlockedList()
          + '<div class="sv-row sv-row-btn blue" id="sv-add-blocked-btn"><span>+ Dodaj zablokowany termin</span></div>';
        list.querySelector('#sv-add-blocked-btn').addEventListener('click', showBlockPeriodSheet);
        list.addEventListener('click', (e) => {
          const delBtn = e.target.closest('[data-del]');
          if (delBtn) deleteBlockedPeriod(delBtn.dataset.del);
        });
      }

      if (typeof toast === 'function') toast('Termin zablokowany', 'success');
    });
  }

  function _debounce(fn, ms) {
    let t;
    return function() {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  return {
    render(container) {
      render(container || document.getElementById('view-container'));
    },
  };
})();
