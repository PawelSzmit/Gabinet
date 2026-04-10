'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '554823778989-760krqf91lrhq288s5l61oaa0fe2pekp.apps.googleusercontent.com';
const DRIVE_FILE_NAME = 'gabinet-data.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const LS_TOKEN_KEY = 'gabinet_access_token';
const LS_EXPIRY_KEY = 'gabinet_token_expiry';
const LS_FILEID_KEY = 'gabinet_drive_file_id_v2';

// ─── Utility: simple debounce ─────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── DriveService ─────────────────────────────────────────────────────────────
const DriveService = {
  accessToken: null,
  fileId: null,
  _tokenClient: null,
  _tokenResolve: null,
  _tokenReject: null,
  _loadingCount: 0,
  _errorTimer: null,

  init() {
    if (!window.google || !window.google.accounts) {
      console.warn('[Drive] Google Identity Services not loaded yet.');
      return;
    }

    this._tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          if (this._tokenReject) {
            this._tokenReject(new Error(response.error));
          }
          return;
        }

        const expiresAt = Date.now() + (response.expires_in - 60) * 1000;
        this.accessToken = response.access_token;

        localStorage.setItem(LS_TOKEN_KEY, response.access_token);
        localStorage.setItem(LS_EXPIRY_KEY, String(expiresAt));

        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + response.access_token },
        })
          .then((r) => r.json())
          .then((info) => {
            if (info && (info.name || info.email)) {
              localStorage.setItem('gabinet_user_info', JSON.stringify({
                name: info.name || '',
                email: info.email || '',
              }));
            }
          })
          .catch(() => {});

        if (this._tokenResolve) {
          this._tokenResolve(response.access_token);
        }
      },
    });

    const cachedFileId = localStorage.getItem(LS_FILEID_KEY);
    if (cachedFileId) {
      this.fileId = cachedFileId;
    }
  },

  requestToken(options = {}) {
    const interactive = options.interactive !== false;
    const scope = options.scope || SCOPES;
    const prompt = options.prompt !== undefined ? options.prompt : (interactive ? '' : 'none');

    return new Promise((resolve, reject) => {
      if (!this._tokenClient) {
        reject(new Error('DriveService.init() has not been called.'));
        return;
      }

      if (this.accessToken && this.isSignedIn()) {
        resolve(this.accessToken);
        return;
      }

      this._tokenResolve = resolve;
      this._tokenReject = reject;
      this._tokenClient.requestAccessToken({
        prompt,
        scope,
        include_granted_scopes: true,
      });
    });
  },

  isSignedIn() {
    if (this.accessToken) return true;
    const token = localStorage.getItem(LS_TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(LS_EXPIRY_KEY) || '0', 10);
    return !!(token && Date.now() < expiry);
  },

  loadStoredToken() {
    const token = localStorage.getItem(LS_TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(LS_EXPIRY_KEY) || '0', 10);
    if (token && Date.now() < expiry) {
      this.accessToken = token;
      return true;
    }
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_EXPIRY_KEY);
    this.accessToken = null;
    return false;
  },

  signOut() {
    if (this.accessToken && window.google && window.google.accounts) {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.fileId = null;
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_EXPIRY_KEY);
    localStorage.removeItem(LS_FILEID_KEY);
  },

  async findOrCreateFile() {
    if (this.fileId) return this.fileId;

    const query = encodeURIComponent(
      `name = '${DRIVE_FILE_NAME}' and trashed = false`
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

    const resp = await this.apiFetch(url);
    const json = await resp.json();

    if (json.files && json.files.length > 0) {
      this.fileId = json.files[0].id;
      localStorage.setItem(LS_FILEID_KEY, this.fileId);
      return this.fileId;
    }

    const emptyContent = typeof serializeAppData === 'function'
      ? await serializeAppData()
      : JSON.stringify({});
    const id = await this.createFile(emptyContent);
    this.fileId = id;
    localStorage.setItem(LS_FILEID_KEY, id);
    return id;
  },

  async loadData() {
    this._setLoading(true);
    try {
      const fileId = await this.findOrCreateFile();
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const resp = await this.apiFetch(url);

      if (!resp.ok) {
        throw new Error(`Drive read failed: ${resp.status}`);
      }

      const text = await resp.text();
      if (text && text.trim().length > 0) {
        if (typeof deserializeAppData === 'function') {
          deserializeAppData(text);
        }
        if (typeof LocalStore !== 'undefined' && typeof LocalStore.storeSerializedSnapshot === 'function') {
          await LocalStore.storeSerializedSnapshot(text, {
            hasPendingSync: false,
            lastDriveSyncAt: new Date().toISOString(),
            source: 'drive-load',
          });
        }
      }
    } catch (err) {
      console.error('[Drive] loadData error:', err);
      this._showError('Nie udalo sie wczytac danych z Drive.');
      throw err;
    } finally {
      this._setLoading(false);
    }
  },

  async saveData() {
    if (!this.isSignedIn()) return;

    try {
      const cachedContent = (typeof LocalStore !== 'undefined' && typeof LocalStore.getRecentSerialized === 'function')
        ? LocalStore.getRecentSerialized(3000)
        : null;
      const content = cachedContent || (
        typeof serializeAppData === 'function'
          ? await serializeAppData()
          : JSON.stringify({})
      );

      const fileId = await this.findOrCreateFile();
      await this.updateFile(fileId, content);

      if (typeof LocalStore !== 'undefined' && typeof LocalStore.storeSerializedSnapshot === 'function') {
        const currentState = typeof LocalStore.getState === 'function' ? LocalStore.getState() : {};
        await LocalStore.storeSerializedSnapshot(content, {
          hasPendingSync: false,
          lastLocalWriteAt: currentState.lastLocalWriteAt || new Date().toISOString(),
          lastDriveSyncAt: new Date().toISOString(),
          source: 'drive-sync',
        });
      }
    } catch (err) {
      if (err.message === 'OFFLINE') {
        console.warn('[Drive] Offline – save deferred.');
        return;
      }
      console.error('[Drive] saveData error:', err);
      this._showError(err && err.message ? err.message : 'Nie udalo sie zapisac danych na Drive.');
      throw err;
    }
  },

  async createFile(content) {
    const metadata = {
      name: DRIVE_FILE_NAME,
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append(
      'file',
      new Blob([content], { type: 'application/json' })
    );

    const resp = await this.apiFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', body: form }
    );

    if (!resp.ok) {
      throw new Error(`Drive create failed: ${resp.status}`);
    }

    const json = await resp.json();
    return json.id;
  },

  async updateFile(fileId, content) {
    const resp = await this.apiFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      }
    );

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Drive update failed: ${resp.status} – ${body}`);
    }
  },

  async apiFetch(url, options = {}) {
    if (!navigator.onLine) {
      throw new Error('OFFLINE');
    }

    if (!this.accessToken && !this.loadStoredToken()) {
      throw new Error('Sesja Google wygasla. Polacz z Google ponownie.');
    }

    const buildHeaders = (extraHeaders = {}) => ({
      Authorization: `Bearer ${this.accessToken}`,
      ...extraHeaders,
    });

    const mergedOptions = {
      ...options,
      headers: buildHeaders(options.headers || {}),
    };

    let resp = await fetch(url, mergedOptions);

    if (resp.status === 401) {
      try {
        this.accessToken = null;
        localStorage.removeItem(LS_TOKEN_KEY);
        localStorage.removeItem(LS_EXPIRY_KEY);
        await this.requestToken({ interactive: false });
        mergedOptions.headers = buildHeaders(options.headers || {});
        resp = await fetch(url, mergedOptions);
      } catch (refreshErr) {
        this.accessToken = null;
        throw new Error('Sesja Google wygasla. Polacz z Google ponownie.');
      }
    }

    return resp;
  },

  debouncedSave: null,

  _setLoading(state) {
    this._loadingCount += state ? 1 : -1;
    const el = document.getElementById('drive-loading-indicator');
    if (el) {
      el.hidden = this._loadingCount <= 0;
    }
  },

  _showError(msg) {
    const el = document.getElementById('drive-error-toast');
    if (!el) {
      console.error('[Drive]', msg);
      return;
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(this._errorTimer);
    this._errorTimer = setTimeout(() => {
      el.hidden = true;
    }, 4000);
  },
};

DriveService.debouncedSave = debounce(function () {
  DriveService.saveData().catch(() => {});
}, 2000);

function persistData() {
  if (typeof LocalStore !== 'undefined' && typeof LocalStore.scheduleSnapshot === 'function') {
    LocalStore.scheduleSnapshot({
      hasPendingSync: true,
      source: 'local-change',
    });
  }
  DriveService.debouncedSave();
  if (typeof TabGuard !== 'undefined' && typeof TabGuard.notifyDataSaved === 'function') {
    TabGuard.notifyDataSaved();
  }
}

// ─── Data Recovery from Drive Version History ────────────────────────────────
const DataRecovery = {
  _safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  },

  _summarizePayload(payload) {
    const parsed = payload && typeof payload === 'object' ? payload : {};
    const patients = Array.isArray(parsed.patients) ? parsed.patients.length : 0;
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions.length : 0;
    const payments = Array.isArray(parsed.payments) ? parsed.payments.length : 0;
    const blockedPeriods = Array.isArray(parsed.blockedPeriods) ? parsed.blockedPeriods.length : 0;
    const score = (patients * 100000) + (sessions * 1000) + (payments * 10) + blockedPeriods;
    return {
      patients,
      sessions,
      payments,
      blockedPeriods,
      score,
      hasData: patients > 0 || sessions > 0 || payments > 0 || blockedPeriods > 0,
    };
  },

  _describeSummary(summary) {
    return `${summary.patients} pacjentow, ${summary.sessions} sesji, ${summary.payments} platnosci`;
  },

  async _downloadFile(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const resp = await DriveService.apiFetch(url);
    if (!resp.ok) {
      throw new Error('Nie udalo sie pobrac pliku: ' + resp.status);
    }
    return await resp.text();
  },

  async _listNamedFiles(options = {}) {
    const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const fields = 'files(id,name,modifiedTime,createdTime,parents,spaces)';
    const spaces = options.spaces ? `&spaces=${encodeURIComponent(options.spaces)}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}${spaces}&fields=${fields}`;
    const resp = await DriveService.apiFetch(url);
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error('Nie udalo sie pobrac listy plikow: ' + resp.status + ' ' + body);
    }
    const json = await resp.json();
    return Array.isArray(json.files) ? json.files : [];
  },

  async _collectCurrentCandidates(log, candidates, options = {}) {
    const files = await this._listNamedFiles(options);
    if (files.length === 0) {
      log(options.spaces === 'appDataFolder'
        ? 'Nie znaleziono pliku w appDataFolder.'
        : 'Nie znaleziono dodatkowych plikow gabinet-data.json na Drive.');
      return;
    }

    for (const file of files) {
      try {
        const text = await this._downloadFile(file.id);
        const parsed = this._safeJsonParse(text);
        if (!parsed) continue;
        const summary = this._summarizePayload(parsed);
        candidates.push({
          source: options.sourceLabel || 'drive-current',
          fileId: file.id,
          modifiedTime: file.modifiedTime || file.createdTime || null,
          text,
          parsed,
          summary,
        });
        log(`Znaleziono kandydat: ${options.sourceLabel || 'drive-current'} -> ${this._describeSummary(summary)}.`);
      } catch (error) {
        log(`⚠️ Nie udalo sie odczytac pliku ${file.id}: ${error.message}`);
      }
    }
  },

  async _collectRevisionCandidates(log, candidates) {
    const fileId = DriveService.fileId || localStorage.getItem(LS_FILEID_KEY);
    if (!fileId) {
      log('Brak aktywnego pliku Drive do przeszukania historii wersji.');
      return;
    }

    const revisions = await this.listRevisions();
    if (revisions.length === 0) {
      log('Brak historii wersji dla aktywnego pliku.');
      return;
    }

    log(`Przegladam ${revisions.length} wersji aktywnego pliku...`);
    const ordered = revisions.slice().reverse();
    for (const rev of ordered) {
      try {
        const text = await this.downloadRevision(rev.id);
        const parsed = this._safeJsonParse(text);
        if (!parsed) continue;
        const summary = this._summarizePayload(parsed);
        if (!summary.hasData) continue;
        candidates.push({
          source: 'drive-revision',
          fileId,
          revisionId: rev.id,
          modifiedTime: rev.modifiedTime || null,
          text,
          parsed,
          summary,
        });
        log(`Wersja z ${new Date(rev.modifiedTime).toLocaleString('pl-PL')} -> ${this._describeSummary(summary)}.`);
      } catch (error) {
        log(`⚠️ Nie udalo sie odczytac wersji ${rev.id}: ${error.message}`);
      }
    }
  },

  async _ensureAppDataAccess(log) {
    try {
      await DriveService.requestToken({
        interactive: true,
        scope: `${SCOPES} ${APPDATA_SCOPE}`,
        prompt: 'consent',
      });
      log('Uzyskano dostep do starego appDataFolder.');
      return true;
    } catch (error) {
      log('⚠️ Nie udalo sie uzyskac dostepu do appDataFolder: ' + error.message);
      return false;
    }
  },

  _pickBestCandidate(candidates) {
    return candidates
      .filter((candidate) => candidate && candidate.summary && candidate.summary.hasData)
      .sort((a, b) => {
        if (b.summary.score !== a.summary.score) return b.summary.score - a.summary.score;
        const aTime = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
        const bTime = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
        return bTime - aTime;
      })[0] || null;
  },

  async restoreBestAvailableSnapshot(onProgress) {
    const log = onProgress || console.log;
    const candidates = [];

    log('Szukam pelnych danych w obecnym pliku Drive...');
    await this._collectCurrentCandidates(log, candidates, { sourceLabel: 'drive-current' });

    log('Sprawdzam historie wersji obecnego pliku...');
    await this._collectRevisionCandidates(log, candidates);

    log('Prosze Google o jednorazowy dostep do starego ukrytego magazynu aplikacji...');
    const hasAppDataAccess = await this._ensureAppDataAccess(log);
    if (hasAppDataAccess) {
      await this._collectCurrentCandidates(log, candidates, {
        sourceLabel: 'appDataFolder',
        spaces: 'appDataFolder',
      });
    }

    const best = this._pickBestCandidate(candidates);
    if (!best) {
      throw new Error('Nie znaleziono zadnego niepustego backupu w obecnym Drive, historii wersji ani appDataFolder.');
    }

    log(`Najlepszy kandydat: ${best.source} -> ${this._describeSummary(best.summary)}.`);
    deserializeAppData(best.text);

    if (typeof LocalStore !== 'undefined' && typeof LocalStore.storeSerializedSnapshot === 'function') {
      await LocalStore.storeSerializedSnapshot(best.text, {
        hasPendingSync: true,
        lastLocalWriteAt: new Date().toISOString(),
        source: 'recovery-restore',
      });
    }

    log('Zapisuje odzyskane dane do aktualnego pliku aplikacji...');
    await DriveService.saveData();

    return {
      source: best.source,
      summary: best.summary,
      modifiedTime: best.modifiedTime || null,
    };
  },

  async listRevisions() {
    const fileId = DriveService.fileId || localStorage.getItem(LS_FILEID_KEY);
    if (!fileId) throw new Error('Brak pliku na Drive — zaloguj się najpierw.');

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime,size)`;
    const resp = await DriveService.apiFetch(url);
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error('Nie udało się pobrać historii wersji: ' + resp.status + ' ' + body);
    }
    const json = await resp.json();
    return (json.revisions || []).sort((a, b) => new Date(a.modifiedTime) - new Date(b.modifiedTime));
  },

  async downloadRevision(revisionId) {
    const fileId = DriveService.fileId || localStorage.getItem(LS_FILEID_KEY);
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`;
    const resp = await DriveService.apiFetch(url);
    if (!resp.ok) throw new Error('Nie udało się pobrać rewizji: ' + resp.status);
    return await resp.text();
  },

  async recoverFromHistory(onProgress) {
    const log = onProgress || console.log;

    log('Pobieranie listy wersji z Google Drive...');
    const revisions = await this.listRevisions();

    if (revisions.length < 2) {
      throw new Error('Brak starszych wersji pliku na Drive. Odzyskanie danych nie jest możliwe.');
    }

    log(`Znaleziono ${revisions.length} wersji. Przeglądam WSZYSTKIE od najnowszej...`);

    const collectedSessionTimes = {};
    const collectedPatientDays = {};
    let revisionsWithData = 0;

    const reversedRevisions = revisions.slice().reverse();

    for (const rev of reversedRevisions) {
      try {
        const dateStr = new Date(rev.modifiedTime).toLocaleString('pl-PL');
        log(`Sprawdzam wersję z ${dateStr}...`);
        const text = await this.downloadRevision(rev.id);
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          continue;
        }

        let foundInThisRev = 0;

        for (const s of (parsed.sessions || [])) {
          if (s.id && s.time && typeof s.time === 'string') {
            if (!collectedSessionTimes[s.id]) {
              collectedSessionTimes[s.id] = s.time;
              foundInThisRev++;
            }
          }
        }

        for (const p of (parsed.patients || [])) {
          if (p.id && Array.isArray(p.sessionDays) && p.sessionDays.length > 0) {
            if (!collectedPatientDays[p.id]) {
              collectedPatientDays[p.id] = {
                sessionDays: p.sessionDays,
                sessionTimes: p.sessionTimes || {},
              };
              foundInThisRev++;
            }
          }
        }

        if (foundInThisRev > 0) {
          revisionsWithData++;
          log(`  → Znaleziono ${foundInThisRev} nowych pól w tej wersji`);
        }
      } catch (e) {
        log(`⚠️ Nie udało się odczytać wersji: ${e.message}`);
      }
    }

    const totalSessionTimes = Object.keys(collectedSessionTimes).length;
    const totalPatientDays = Object.keys(collectedPatientDays).length;

    log(`\nPodsumowanie: znaleziono ${totalSessionTimes} czasów sesji i ${totalPatientDays} harmonogramów pacjentów w ${revisionsWithData} wersjach.`);

    if (totalSessionTimes === 0 && totalPatientDays === 0) {
      throw new Error('Nie znaleziono żadnych oryginalnych danych (time/sessionDays) w historii wersji.');
    }

    let sessionsFixed = 0;
    for (const currentSession of AppState.sessions) {
      const oldTime = collectedSessionTimes[currentSession.id];
      if (!oldTime) continue;

      const datePart = currentSession.date.substring(0, 10);
      const newDate = new Date(datePart + 'T' + oldTime + ':00').toISOString();
      if (newDate !== currentSession.date) {
        currentSession.date = newDate;
        sessionsFixed++;
      }
    }

    log(`Naprawiono czasy ${sessionsFixed} sesji.`);

    let patientsFixed = 0;
    const dayToISO = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 7,
    };

    for (const currentPatient of AppState.patients) {
      const old = collectedPatientDays[currentPatient.id];
      if (!old) continue;

      if (Array.isArray(currentPatient.sessionDayConfigs) && currentPatient.sessionDayConfigs.length > 0) {
        continue;
      }

      currentPatient.sessionDayConfigs = old.sessionDays
        .filter((d) => dayToISO[d] !== undefined)
        .map((d) => ({
          weekday: dayToISO[d],
          sessionTime: old.sessionTimes[d] || '10:00',
        }));
      patientsFixed++;
    }

    log(`Naprawiono harmonogramy ${patientsFixed} pacjentów.`);

    if (sessionsFixed > 0 || patientsFixed > 0) {
      log('Zapisywanie poprawionych danych na Drive...');
      await DriveService.saveData();
      log(`\n✅ Gotowe! Naprawiono ${sessionsFixed} sesji i ${patientsFixed} pacjentów.`);
    } else {
      log('⚠️ Nie znaleziono danych do naprawienia (ID sesji/pacjentów mogły się zmienić).');
    }

    return { sessionsFixed, patientsFixed };
  },
};

// ─── Offline / online banners ─────────────────────────────────────────────────
window.addEventListener('online', () => {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.hidden = true;

  if (DriveService.isSignedIn()) {
    DriveService.saveData().catch(() => {});
  }
  if (typeof App !== 'undefined' && typeof App.refreshSyncStatusUi === 'function') {
    App.refreshSyncStatusUi();
  }
});

window.addEventListener('offline', () => {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.hidden = false;

  if (typeof App !== 'undefined' && typeof App.refreshSyncStatusUi === 'function') {
    App.refreshSyncStatusUi();
  }
});
