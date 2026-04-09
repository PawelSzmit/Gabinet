'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '554823778989-760krqf91lrhq288s5l61oaa0fe2pekp.apps.googleusercontent.com';
const DRIVE_FILE_NAME  = 'gabinet-data.json';
const SCOPES           = 'https://www.googleapis.com/auth/drive.appdata';

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

    this._clearLegacySessionCache();

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

        this.accessToken = response.access_token;

        if (this._tokenResolve) {
          this._tokenResolve(response.access_token);
        }
      },
    });
  },

  // ── requestToken ──────────────────────────────────────────────────────────
  // Shows the Google consent popup after a user click or tries a quiet refresh.
  requestToken(options = {}) {
    const interactive = options.interactive !== false;
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
      this._tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' });
    });
  },

  // ── isSignedIn ────────────────────────────────────────────────────────────
  isSignedIn() {
    return !!this.accessToken;
  },

  // ── signOut ───────────────────────────────────────────────────────────────
  signOut() {
    if (this.accessToken && window.google && window.google.accounts) {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.fileId      = null;
    this._clearLegacySessionCache();
  },

  // ── findOrCreateFile ──────────────────────────────────────────────────────
  // Returns the Drive file-id of gabinet-data.json in appDataFolder.
  // Creates the file with an empty data structure if it does not exist yet.
  async findOrCreateFile() {
    if (this.fileId) return this.fileId;

    const query = encodeURIComponent(
      `name = '${DRIVE_FILE_NAME}' and trashed = false`
    );
    const url   = `https://www.googleapis.com/drive/v3/files` +
                  `?spaces=appDataFolder&q=${query}&fields=files(id,name)`;

    const resp = await this.apiFetch(url);
    const json = await resp.json();

    if (json.files && json.files.length > 0) {
      this.fileId = json.files[0].id;
      return this.fileId;
    }

    // File not found – create it with a fresh empty state.
    const emptyContent = serializeAppData ? await serializeAppData() : JSON.stringify({});
    const id = await this.createFile(emptyContent);
    this.fileId = id;
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
      DriveService._showError('Nie udało się wczytać danych z Drive.');
    } finally {
      DriveService._setLoading(false);
    }
  },

  // ── saveData ──────────────────────────────────────────────────────────────
  async saveData() {
    if (!this.isSignedIn()) return;

    try {
      // Uzyj ostatnio zserializowanych danych z LocalStore (max 3s stare)
      // zamiast serializowac i szyfrowac ponownie.
      const cachedContent = (typeof LocalStore !== 'undefined' && typeof LocalStore.getRecentSerialized === 'function')
        ? LocalStore.getRecentSerialized(3000)
        : null;
      const content = cachedContent || (typeof serializeAppData === 'function'
        ? await serializeAppData()
        : JSON.stringify({}));

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
      DriveService._showError(err && err.message ? err.message : 'Nie udało się zapisać danych na Drive.');
    }
  },

  // ── createFile ────────────────────────────────────────────────────────────
  async createFile(content) {
    const metadata = {
      name:    DRIVE_FILE_NAME,
      parents: ['appDataFolder'],
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

    if (!this.accessToken) {
      throw new Error('Sesja Google wygasła. Kliknij "Połącz z Google" ponownie.');
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
        this.accessToken = null;
        await this.requestToken({ interactive: false });
        mergedOptions.headers = buildHeaders(options.headers || {});
        resp = await fetch(url, mergedOptions);
      } catch (refreshErr) {
        this.accessToken = null;
        throw new Error('Sesja Google wygasła. Kliknij "Połącz z Google" ponownie.');
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

  _clearLegacySessionCache() {
    ['gabinet_access_token', 'gabinet_token_expiry', 'gabinet_drive_file_id', 'gabinet_user_info'].forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('[Drive] Could not clear legacy session cache:', err);
      }
    });
  },
};

// Assign after object literal so the debounce closure can reference DriveService.
DriveService.debouncedSave = debounce(function () {
  DriveService.saveData();
}, 2000);

// ─── Public helper called after any data mutation ─────────────────────────────
function persistData() {
  if (typeof LocalStore !== 'undefined' && typeof LocalStore.scheduleSnapshot === 'function') {
    LocalStore.scheduleSnapshot({
      hasPendingSync: true,
      source: 'local-change',
    });
  }
  DriveService.debouncedSave();
  if (typeof TabGuard !== 'undefined') TabGuard.notifyDataSaved();
}

// ─── Offline / online banners ─────────────────────────────────────────────────
window.addEventListener('online',  () => {
  document.getElementById('offline-banner') &&
    (document.getElementById('offline-banner').hidden = true);
  // Flush any pending saves when connection is restored.
  if (DriveService.isSignedIn()) {
    DriveService.saveData();
  }
  if (typeof App !== 'undefined' && typeof App.refreshSyncStatusUi === 'function') {
    App.refreshSyncStatusUi();
  }
});

window.addEventListener('offline', () => {
  document.getElementById('offline-banner') &&
    (document.getElementById('offline-banner').hidden = false);
  if (typeof App !== 'undefined' && typeof App.refreshSyncStatusUi === 'function') {
    App.refreshSyncStatusUi();
  }
});
