'use strict';

const LocalStore = {
  DB_NAME: 'gabinet-local-store',
  DB_VERSION: 1,
  STORE_NAME: 'kv',
  SNAPSHOT_KEY: 'app-snapshot',
  META_KEY: 'sync-meta',

  _dbPromise: null,
  _saveTimer: null,
  _writeChain: Promise.resolve(),
  _state: {
    supported: typeof indexedDB !== 'undefined',
    snapshotAvailable: false,
    hasPendingSync: false,
    lastLocalWriteAt: null,
    lastDriveSyncAt: null,
    lastSnapshotAt: null,
    lastSnapshotSource: 'none',
  },

  isSupported() {
    return this._state.supported;
  },

  getState() {
    return { ...this._state };
  },

  hasSnapshot() {
    return !!this._state.snapshotAvailable;
  },

  hasPendingSync() {
    return !!this._state.hasPendingSync;
  },

  shouldPreferLocalSnapshot() {
    return this.hasSnapshot() && this.hasPendingSync();
  },

  async init() {
    if (!this.isSupported()) {
      return this.getState();
    }

    const metaRecord = await this._getRecord(this.META_KEY);
    if (metaRecord) {
      this._mergeMeta(metaRecord.value || {});
    }

    const snapshotRecord = await this._getRecord(this.SNAPSHOT_KEY);
    if (snapshotRecord && typeof snapshotRecord.value === 'string' && snapshotRecord.value.trim()) {
      this._setState({
        snapshotAvailable: true,
        lastSnapshotAt: snapshotRecord.savedAt || this._state.lastSnapshotAt,
        lastSnapshotSource: snapshotRecord.source || this._state.lastSnapshotSource || 'local',
      });
    }

    this._emitChange();
    return this.getState();
  },

  async loadSnapshot() {
    if (!this.isSupported()) return null;

    const snapshotRecord = await this._getRecord(this.SNAPSHOT_KEY);
    if (!snapshotRecord || typeof snapshotRecord.value !== 'string' || !snapshotRecord.value.trim()) {
      this._setState({ snapshotAvailable: false });
      this._emitChange();
      return null;
    }

    this._setState({
      snapshotAvailable: true,
      lastSnapshotAt: snapshotRecord.savedAt || this._state.lastSnapshotAt,
      lastSnapshotSource: snapshotRecord.source || this._state.lastSnapshotSource || 'local',
    });
    this._emitChange();

    return {
      serializedData: snapshotRecord.value,
      savedAt: snapshotRecord.savedAt || null,
      source: snapshotRecord.source || 'local',
      meta: this.getState(),
    };
  },

  scheduleSnapshot(options = {}) {
    if (!this.isSupported()) return;

    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.saveSnapshot(options).catch((error) => {
        console.error('[LocalStore] Snapshot save failed:', error);
        if (error && error.name === 'QuotaExceededError' && typeof toast === 'function') {
          toast('Brak miejsca na lokalna kopie danych. Zwolnij pamiec przegladarki.', 'warning', 6000);
        }
      });
    }, 250);
  },

  /** Ostatnio zserializowane dane — wspoldzielone z DriveService.saveData(). */
  _lastSerializedData: null,
  _lastSerializedAt: 0,

  getRecentSerialized(maxAgeMs) {
    if (this._lastSerializedData && (Date.now() - this._lastSerializedAt) < maxAgeMs) {
      return this._lastSerializedData;
    }
    return null;
  },

  async saveSnapshot(options = {}) {
    if (!this.isSupported()) return null;
    const serializedData = await serializeAppData();
    this._lastSerializedData = serializedData;
    this._lastSerializedAt = Date.now();
    const now = new Date().toISOString();

    return this.storeSerializedSnapshot(serializedData, {
      hasPendingSync: options.hasPendingSync !== undefined ? options.hasPendingSync : true,
      lastLocalWriteAt: options.lastLocalWriteAt || now,
      lastDriveSyncAt: options.lastDriveSyncAt,
      source: options.source || 'local-change',
      savedAt: options.savedAt || now,
    });
  },

  async storeSerializedSnapshot(serializedData, options = {}) {
    if (!this.isSupported() || typeof serializedData !== 'string' || !serializedData.trim()) {
      return null;
    }

    const writeTask = async () => {
      const now = options.savedAt || new Date().toISOString();
      const previousMetaRecord = await this._getRecord(this.META_KEY);
      const previousMeta = previousMetaRecord ? (previousMetaRecord.value || {}) : {};
      const nextMeta = {
        hasPendingSync: options.hasPendingSync !== undefined
          ? options.hasPendingSync
          : !!previousMeta.hasPendingSync,
        lastLocalWriteAt: options.lastLocalWriteAt !== undefined
          ? options.lastLocalWriteAt
          : (previousMeta.lastLocalWriteAt || null),
        lastDriveSyncAt: options.lastDriveSyncAt !== undefined
          ? options.lastDriveSyncAt
          : (previousMeta.lastDriveSyncAt || null),
        lastSnapshotAt: now,
        lastSnapshotSource: options.source || previousMeta.lastSnapshotSource || 'local',
      };

      await this._withStore('readwrite', (store) => {
        store.put({
          key: this.SNAPSHOT_KEY,
          value: serializedData,
          savedAt: now,
          source: options.source || 'local',
        });
        store.put({
          key: this.META_KEY,
          value: nextMeta,
          savedAt: now,
        });
      });

      this._setState({
        snapshotAvailable: true,
        hasPendingSync: nextMeta.hasPendingSync,
        lastLocalWriteAt: nextMeta.lastLocalWriteAt,
        lastDriveSyncAt: nextMeta.lastDriveSyncAt,
        lastSnapshotAt: nextMeta.lastSnapshotAt,
        lastSnapshotSource: nextMeta.lastSnapshotSource,
      });
      this._emitChange();

      return {
        serializedData,
        savedAt: now,
        meta: this.getState(),
      };
    };

    this._writeChain = this._writeChain.then(writeTask, writeTask);
    return this._writeChain;
  },

  async clear() {
    if (!this.isSupported()) return;

    await this._withStore('readwrite', (store) => {
      store.delete(this.SNAPSHOT_KEY);
      store.delete(this.META_KEY);
    });

    this._setState({
      snapshotAvailable: false,
      hasPendingSync: false,
      lastLocalWriteAt: null,
      lastDriveSyncAt: null,
      lastSnapshotAt: null,
      lastSnapshotSource: 'none',
    });
    this._emitChange();
  },

  getSyncStatusSummary() {
    const state = this.getState();
    const connected = typeof DriveService !== 'undefined' &&
      typeof DriveService.isSignedIn === 'function' &&
      DriveService.isSignedIn();
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;

    if (!state.supported) {
      return {
        status: 'Lokalny snapshot niedostępny',
        note: 'Ta przeglądarka nie udostępnia bezpiecznego magazynu offline.',
        actionLabel: connected ? null : 'Połącz z Google',
        bannerVisible: !connected,
      };
    }

    if (!state.snapshotAvailable) {
      return {
        status: 'Brak danych lokalnych',
        note: 'Lokalna kopia pojawi się po pierwszym udanym wczytaniu albo zapisie danych.',
        actionLabel: connected ? null : 'Połącz z Google',
        bannerVisible: false,
      };
    }

    if (!connected) {
      return {
        status: state.hasPendingSync ? 'Lokalne zmiany czekają na synchronizację' : 'Dane lokalne dostępne',
        note: state.hasPendingSync
          ? 'Pracujesz na danych z tego urządzenia. Połącz z Google, aby wysłać zmiany na Drive.'
          : 'Możesz pracować na lokalnej kopii danych. Połącz z Google, aby zsynchronizować najnowszy stan.',
        actionLabel: 'Połącz z Google',
        bannerVisible: true,
      };
    }

    if (state.hasPendingSync) {
      return {
        status: online ? 'Synchronizacja lokalnych zmian' : 'Zmiany czekają na internet',
        note: online
          ? 'Lokalna kopia została zaktualizowana i czeka na zapis do Google Drive.'
          : 'Lokalna kopia jest bezpieczna. Zapis do Google Drive wróci, gdy połączenie będzie dostępne.',
        actionLabel: null,
        bannerVisible: true,
      };
    }

    return {
      status: 'Google Drive połączony',
      note: state.lastDriveSyncAt
        ? 'Ostatnia synchronizacja: ' + this._formatSyncStamp(state.lastDriveSyncAt)
        : 'Dane lokalne i Google Drive są gotowe do dalszej pracy.',
      actionLabel: null,
      bannerVisible: false,
    };
  },

  _formatSyncStamp(value) {
    if (!value) return 'brak danych';
    if (typeof formatDateTimeWithWeekday === 'function') {
      return formatDateTimeWithWeekday(value);
    }
    return new Date(value).toLocaleString('pl-PL');
  },

  _mergeMeta(meta) {
    this._setState({
      hasPendingSync: meta.hasPendingSync === true,
      lastLocalWriteAt: meta.lastLocalWriteAt || null,
      lastDriveSyncAt: meta.lastDriveSyncAt || null,
      lastSnapshotAt: meta.lastSnapshotAt || null,
      lastSnapshotSource: meta.lastSnapshotSource || this._state.lastSnapshotSource || 'none',
    });
  },

  _setState(patch) {
    this._state = {
      ...this._state,
      ...patch,
    };
  },

  _emitChange() {
    if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
    document.dispatchEvent(new CustomEvent('local-store:change', {
      detail: this.getState(),
    }));
  },

  async _getRecord(key) {
    return this._withStore('readonly', (store) => store.get(key));
  },

  async _withStore(mode, executor) {
    const db = await this._openDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, mode);
      const store = transaction.objectStore(this.STORE_NAME);
      const result = executor(store);

      if (result && typeof result === 'object' && 'onsuccess' in result && 'result' in result) {
        result.onsuccess = () => resolve(result.result || null);
        result.onerror = () => reject(result.error || transaction.error || new Error('IndexedDB request failed.'));
        return;
      }

      transaction.oncomplete = () => resolve(result || null);
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
    });
  },

  _openDb() {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
      });
    }

    return this._dbPromise;
  },
};
