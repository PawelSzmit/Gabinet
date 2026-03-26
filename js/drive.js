'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '554823778989-760krqf91lrhq288s5l61oaa0fe2pekp.apps.googleusercontent.com';
const DRIVE_FILE_NAME  = 'gabinet-data.json';
const SCOPES           = 'https://www.googleapis.com/auth/drive.file';

const LS_TOKEN_KEY   = 'gabinet_access_token';
const LS_EXPIRY_KEY  = 'gabinet_token_expiry';
const LS_FILEID_KEY  = 'gabinet_drive_file_id_v2';

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

  // ── init ──────────────────────────────────────────────────────────────────
  // Must be called once the google.accounts.oauth2 library is ready.
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

        localStorage.setItem(LS_TOKEN_KEY,  response.access_token);
        localStorage.setItem(LS_EXPIRY_KEY, String(expiresAt));

        if (this._tokenResolve) {
          this._tokenResolve(response.access_token);
        }
      },
    });

    // Restore cached file-id so we skip the search step on reload.
    const cachedFileId = localStorage.getItem(LS_FILEID_KEY);
    if (cachedFileId) {
      this.fileId = cachedFileId;
    }
  },

  // ── requestToken ──────────────────────────────────────────────────────────
  // Shows the Google consent popup (or reuses a cached token silently).
  requestToken() {
    return new Promise((resolve, reject) => {
      if (!this._tokenClient) {
        reject(new Error('DriveService.init() has not been called.'));
        return;
      }

      // If we already have a valid in-memory token, resolve immediately.
      if (this.accessToken && this.isSignedIn()) {
        resolve(this.accessToken);
        return;
      }

      this._tokenResolve = resolve;
      this._tokenReject  = reject;
      this._tokenClient.requestAccessToken({ prompt: '' });
    });
  },

  // ── isSignedIn ────────────────────────────────────────────────────────────
  isSignedIn() {
    if (this.accessToken) return true;
    const token  = localStorage.getItem(LS_TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(LS_EXPIRY_KEY) || '0', 10);
    return !!(token && Date.now() < expiry);
  },

  // ── loadStoredToken ───────────────────────────────────────────────────────
  // Restores a previously saved token into memory on page reload.
  loadStoredToken() {
    const token  = localStorage.getItem(LS_TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(LS_EXPIRY_KEY) || '0', 10);
    if (token && Date.now() < expiry) {
      this.accessToken = token;
      return true;
    }
    // Token expired – clear stale entries.
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_EXPIRY_KEY);
    this.accessToken = null;
    return false;
  },

  // ── signOut ───────────────────────────────────────────────────────────────
  signOut() {
    if (this.accessToken && window.google && window.google.accounts) {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.fileId      = null;
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_EXPIRY_KEY);
    localStorage.removeItem(LS_FILEID_KEY);
  },

  // ── findOrCreateFile ──────────────────────────────────────────────────────
  // Returns the Drive file-id of gabinet-data.json on the user's Drive.
  // Creates the file with an empty data structure if it does not exist yet.
  async findOrCreateFile() {
    if (this.fileId) return this.fileId;

    const query = encodeURIComponent(
      `name = '${DRIVE_FILE_NAME}' and trashed = false`
    );
    const url   = `https://www.googleapis.com/drive/v3/files` +
                  `?q=${query}&fields=files(id,name)`;

    const resp = await this.apiFetch(url);
    const json = await resp.json();

    if (json.files && json.files.length > 0) {
      this.fileId = json.files[0].id;
      localStorage.setItem(LS_FILEID_KEY, this.fileId);
      return this.fileId;
    }

    // File not found – create it with a fresh empty state.
    const emptyContent = serializeAppData ? serializeAppData() : JSON.stringify({});
    const id = await this.createFile(emptyContent);
    this.fileId = id;
    localStorage.setItem(LS_FILEID_KEY, id);
    return id;
  },

  // ── loadData ──────────────────────────────────────────────────────────────
  async loadData() {
    DriveService._setLoading(true);
    try {
      const fileId = await this.findOrCreateFile();
      const url    = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const resp   = await this.apiFetch(url);

      if (!resp.ok) {
        throw new Error(`Drive read failed: ${resp.status}`);
      }

      const text = await resp.text();
      if (text && text.trim().length > 0) {
        if (typeof deserializeAppData === 'function') {
          deserializeAppData(text);
        }
      }
    } catch (err) {
      console.error('[Drive] loadData error:', err);
      DriveService._showError('Nie udało się wczytać danych z Drive.');
    } finally {
      DriveService._setLoading(false);
    }
  },

  // ── saveData ──────────────────────────────────────────────────────────────
  async saveData() {
    if (!this.isSignedIn()) return;

    try {
      const content = typeof serializeAppData === 'function'
        ? serializeAppData()
        : JSON.stringify({});

      const fileId = await this.findOrCreateFile();
      await this.updateFile(fileId, content);
    } catch (err) {
      if (err.message === 'OFFLINE') {
        console.warn('[Drive] Offline – save deferred.');
        return;
      }
      console.error('[Drive] saveData error:', err);
      DriveService._showError('Nie udało się zapisać danych na Drive.');
    }
  },

  // ── createFile ────────────────────────────────────────────────────────────
  async createFile(content) {
    const metadata = {
      name:    DRIVE_FILE_NAME,
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

  // ── updateFile ────────────────────────────────────────────────────────────
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

  // ── apiFetch ──────────────────────────────────────────────────────────────
  // Wraps fetch with the Authorization header.
  // On 401 it attempts a single token refresh then retries.
  async apiFetch(url, options = {}) {
    if (!navigator.onLine) {
      throw new Error('OFFLINE');
    }

    const buildHeaders = (extraHeaders = {}) => ({
      Authorization: `Bearer ${this.accessToken}`,
      ...extraHeaders,
    });

    // Merge caller-supplied headers without overwriting Authorization.
    const mergedOptions = {
      ...options,
      headers: buildHeaders(options.headers || {}),
    };

    let resp = await fetch(url, mergedOptions);

    // Token expired mid-session – refresh once and retry.
    if (resp.status === 401) {
      try {
        await this.requestToken();
        mergedOptions.headers = buildHeaders(options.headers || {});
        resp = await fetch(url, mergedOptions);
      } catch (refreshErr) {
        throw new Error('Token refresh failed – please sign in again.');
      }
    }

    return resp;
  },

  // ── debouncedSave ─────────────────────────────────────────────────────────
  // Saves after 2 s of inactivity; reassigned below.
  debouncedSave: null,

  // ── Private helpers ───────────────────────────────────────────────────────
  _loadingCount: 0,

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
    this._errorTimer = setTimeout(() => { el.hidden = true; }, 4000);
  },
};

// Assign after object literal so the debounce closure can reference DriveService.
DriveService.debouncedSave = debounce(function () {
  DriveService.saveData();
}, 2000);

// ─── Public helper called after any data mutation ─────────────────────────────
function persistData() {
  DriveService.debouncedSave();
}

// ─── Data Recovery from Drive Version History ────────────────────────────────
const DataRecovery = {

  /**
   * Lists all available revisions of gabinet-data.json on Google Drive.
   * @returns {Promise<Array<{id: string, modifiedTime: string}>>}
   */
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

  /**
   * Downloads a specific revision's content.
   * @param {string} revisionId
   * @returns {Promise<string>} — raw JSON text
   */
  async downloadRevision(revisionId) {
    const fileId = DriveService.fileId || localStorage.getItem(LS_FILEID_KEY);
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`;
    const resp = await DriveService.apiFetch(url);
    if (!resp.ok) throw new Error('Nie udało się pobrać rewizji: ' + resp.status);
    return await resp.text();
  },

  /**
   * Attempts to recover session times and patient schedule data from
   * the oldest available revision that still has `time` fields on sessions
   * or `sessionDays`/`sessionTimes` on patients.
   *
   * @param {function} onProgress — callback(message) for UI updates
   * @returns {Promise<{sessionsFixed: number, patientsFixed: number}>}
   */
  async recoverFromHistory(onProgress) {
    const log = onProgress || console.log;

    log('Pobieranie listy wersji z Google Drive...');
    const revisions = await this.listRevisions();

    if (revisions.length < 2) {
      throw new Error('Brak starszych wersji pliku na Drive. Odzyskanie danych nie jest możliwe.');
    }

    log(`Znaleziono ${revisions.length} wersji. Szukam wersji z oryginalnymi danymi...`);

    // Try revisions from oldest to newest, looking for one with `time` fields
    let oldData = null;
    let usedRevision = null;

    for (const rev of revisions) {
      try {
        log(`Sprawdzam wersję z ${new Date(rev.modifiedTime).toLocaleString('pl-PL')}...`);
        const text = await this.downloadRevision(rev.id);
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { continue; }

        // Check if this revision has old-format data (session.time fields)
        const hasSessionTimes = (parsed.sessions || []).some(s => s.time && typeof s.time === 'string');
        // Check if this revision has patient schedule data (sessionDays)
        const hasPatientDays = (parsed.patients || []).some(p =>
          Array.isArray(p.sessionDays) && p.sessionDays.length > 0
        );

        if (hasSessionTimes || hasPatientDays) {
          oldData = parsed;
          usedRevision = rev;
          log(`✅ Znaleziono wersję z ${hasSessionTimes ? 'czasami sesji' : ''}${hasSessionTimes && hasPatientDays ? ' i ' : ''}${hasPatientDays ? 'harmonogramem pacjentów' : ''} z dnia ${new Date(rev.modifiedTime).toLocaleString('pl-PL')}`);
          break;
        }
      } catch (e) {
        log(`⚠️ Nie udało się odczytać wersji: ${e.message}`);
      }
    }

    if (!oldData) {
      throw new Error('Nie znaleziono żadnej wersji z oryginalnymi danymi (time/sessionDays). Wszystkie wersje mają już nowy format.');
    }

    // ── Merge session times ──
    let sessionsFixed = 0;
    const oldSessionsById = {};
    for (const s of (oldData.sessions || [])) {
      if (s.id) oldSessionsById[s.id] = s;
    }

    for (const currentSession of AppState.sessions) {
      const old = oldSessionsById[currentSession.id];
      if (!old) continue;

      if (old.time && typeof old.time === 'string') {
        // Old session has a separate time field — merge it into current date
        const datePart = currentSession.date.substring(0, 10);
        const newDate = new Date(datePart + 'T' + old.time + ':00').toISOString();
        if (newDate !== currentSession.date) {
          currentSession.date = newDate;
          sessionsFixed++;
        }
      }
    }

    log(`Naprawiono czasy ${sessionsFixed} sesji.`);

    // ── Merge patient schedule data ──
    let patientsFixed = 0;
    const oldPatientsById = {};
    for (const p of (oldData.patients || [])) {
      if (p.id) oldPatientsById[p.id] = p;
    }

    const dayToISO = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7,
    };

    for (const currentPatient of AppState.patients) {
      const old = oldPatientsById[currentPatient.id];
      if (!old) continue;

      // Only fix if current patient has empty sessionDayConfigs
      if (Array.isArray(currentPatient.sessionDayConfigs) && currentPatient.sessionDayConfigs.length > 0) {
        continue;
      }

      if (Array.isArray(old.sessionDays) && old.sessionDays.length > 0) {
        const times = old.sessionTimes || {};
        currentPatient.sessionDayConfigs = old.sessionDays
          .filter(d => dayToISO[d] !== undefined)
          .map(d => ({
            weekday: dayToISO[d],
            sessionTime: times[d] || '10:00',
          }));
        patientsFixed++;
      }
    }

    log(`Naprawiono harmonogramy ${patientsFixed} pacjentów.`);

    // ── Save corrected data ──
    if (sessionsFixed > 0 || patientsFixed > 0) {
      log('Zapisywanie poprawionych danych na Drive...');
      await DriveService.saveData();
      log(`✅ Gotowe! Naprawiono ${sessionsFixed} sesji i ${patientsFixed} pacjentów.`);
    } else {
      log('⚠️ Nie znaleziono danych do naprawienia (ID sesji/pacjentów mogły się zmienić).');
    }

    return { sessionsFixed, patientsFixed };
  },
};

// ─── Offline / online banners ─────────────────────────────────────────────────
window.addEventListener('online',  () => {
  document.getElementById('offline-banner') &&
    (document.getElementById('offline-banner').hidden = true);
  // Flush any pending saves when connection is restored.
  if (DriveService.isSignedIn()) {
    DriveService.saveData();
  }
});

window.addEventListener('offline', () => {
  document.getElementById('offline-banner') &&
    (document.getElementById('offline-banner').hidden = false);
});
