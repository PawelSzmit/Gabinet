'use strict';

const SecurityService = {
  status: 'unconfigured',
  _derivedKey: null,
  _protectedState: null,

  isSupported() {
    return !!(
      typeof crypto !== 'undefined' &&
      crypto &&
      crypto.subtle &&
      typeof crypto.getRandomValues === 'function'
    );
  },

  isStorageReady() {
    return typeof serializeAppData === 'function'
      && serializeAppData.constructor
      && serializeAppData.constructor.name === 'AsyncFunction';
  },

  getStatus() {
    return this.status;
  },

  isConfigured() {
    const settings = this._getClinicalSettings();
    return !!(
      settings &&
      settings.enabled &&
      settings.salt &&
      settings.verification &&
      isEncryptedClinicalEnvelope(settings.verification)
    );
  },

  isUnlocked() {
    return this.status === 'unlocked' && !!this._derivedKey;
  },

  canReadClinicalData() {
    if (this.isUnlocked()) return true;
    return this.status === 'unconfigured' && !this.hasAnyClinicalData(AppState);
  },

  isClinicalValueProtected(value) {
    return isEncryptedClinicalEnvelope(value);
  },

  hasClinicalContent(value) {
    if (this.isClinicalValueProtected(value)) return true;
    return typeof value === 'string' && value.trim().length > 0;
  },

  getClinicalDisplayState(value, options = {}) {
    const emptyLabel = options.emptyLabel || 'Brak danych.';
    const protectedLabel = options.protectedLabel || 'Dane kliniczne sa zabezpieczone.';

    if (!this.canReadClinicalData() && this.hasClinicalContent(value)) {
      return {
        hasData: true,
        isProtected: true,
        text: protectedLabel,
        rawText: '',
      };
    }

    if (this.isClinicalValueProtected(value)) {
      return {
        hasData: true,
        isProtected: true,
        text: protectedLabel,
        rawText: '',
      };
    }

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
  },

  needsPasswordSetup() {
    return this.status === 'unconfigured' || this.status === 'migration-required';
  },

  getClinicalActionLabel() {
    return this.needsPasswordSetup() ? 'Ustaw haslo' : 'Odblokuj notatki';
  },

  getUiSummary() {
    if (!this.isSupported()) {
      return {
        status: 'Brak wsparcia przegladarki',
        note: 'Ta przegladarka nie obsluguje mechanizmu ochrony danych klinicznych.',
        primaryLabel: null,
        changeLabel: null,
      };
    }

    if (!this.isStorageReady()) {
      return {
        status: this.status === 'migration-pending'
          ? 'Ochrona kliniczna czeka na migracje'
          : 'Fundament ochrony gotowy',
        note: this.status === 'migration-pending'
          ? 'W aplikacji sa juz tresci kliniczne. Pelne haslo kliniczne zostanie wlaczone po migracji modelu danych.'
          : 'Modul ochrony danych klinicznych jest podpiety. Migracja danych wlaczy zapis asynchroniczny.',
        primaryLabel: null,
        changeLabel: null,
      };
    }

    if (this.status === 'migration-required') {
      return {
        status: 'Wymagana ochrona notatek',
        note: 'Masz juz tresci kliniczne. Ustaw haslo, aby zabezpieczyc je przed kolejnym zapisem i eksportem.',
        primaryLabel: 'Ustaw haslo',
        changeLabel: null,
      };
    }

    if (this.isUnlocked()) {
      return {
        status: 'Dane kliniczne odblokowane',
        note: 'Notatki, cele i wpisy kliniczne sa dostepne w tej sesji pracy.',
        primaryLabel: 'Zablokuj notatki',
        changeLabel: 'Zmien haslo',
      };
    }

    if (this.isConfigured()) {
      return {
        status: 'Dane kliniczne zablokowane',
        note: 'Haslo jest ustawione. Podaj je tylko wtedy, gdy chcesz zobaczyc albo edytowac tresci kliniczne.',
        primaryLabel: 'Odblokuj notatki',
        changeLabel: 'Zmien haslo',
      };
    }

    return {
      status: 'Haslo nie jest ustawione',
      note: 'Haslo chroni tylko dane kliniczne. Kalendarz, pacjenci i finanse nadal dzialaja normalnie.',
      primaryLabel: 'Ustaw haslo',
      changeLabel: null,
    };
  },

  hasAnyClinicalData(source = AppState) {
    let found = false;
    this._visitClinicalFields(source, ({ value }) => {
      if (found) return;
      if (isEncryptedClinicalEnvelope(value)) {
        found = true;
        return;
      }
      if (typeof value === 'string' && value.trim()) {
        found = true;
      }
    });
    return found;
  },

  bootstrapFromLoadedState(options = {}) {
    const forceRefreshProtectedState = options.forceRefreshProtectedState === true;

    if (this.isConfigured() && this._protectedState && !this.isUnlocked() && !forceRefreshProtectedState) {
      this.status = 'locked';
      this._emitChange();
      return;
    }

    this._derivedKey = null;
    this._protectedState = null;

    if (!this.isSupported()) {
      this.status = 'unsupported';
      this._emitChange();
      return;
    }

    if (!this.isStorageReady()) {
      this.status = this.hasAnyClinicalData(AppState) ? 'migration-pending' : 'foundation-ready';
      this._emitChange();
      return;
    }

    if (this.isConfigured()) {
      this._protectedState = this._cloneState({
        patients: AppState.patients,
        sessions: AppState.sessions,
        payments: AppState.payments,
        blockedPeriods: AppState.blockedPeriods,
        settings: AppState.settings,
        generatedMonths: AppState.generatedMonths || [],
      });
      this._applyLockedState(this._protectedState);
      this.status = 'locked';
      this._emitChange();
      return;
    }

    this.status = this.hasAnyClinicalData(AppState) ? 'migration-required' : 'unconfigured';
    this._emitChange();
  },

  async requestClinicalAccess(options = {}) {
    if (!this.isSupported()) {
      this._toast('Ta przegladarka nie obsluguje ochrony danych klinicznych.', 'error');
      return false;
    }

    if (!this.isStorageReady()) {
      this._toast('Najpierw trzeba dokonczyc migracje modelu danych.', 'info', 5000);
      return false;
    }

    if (this.isUnlocked()) {
      if (typeof AutoLock !== 'undefined') AutoLock.start();
      return true;
    }

    if (this.needsPasswordSetup()) {
      return this._openSetupDialog(options);
    }

    return this._openUnlockDialog(options);
  },

  async openChangePasswordFlow() {
    if (!this.isStorageReady()) {
      this._toast('Zmiana hasla bedzie dostepna po migracji modelu danych.', 'info', 5000);
      return false;
    }

    if (!this.isConfigured()) {
      return this._openSetupDialog({ changeMode: false });
    }

    if (!this.isUnlocked()) {
      const unlocked = await this._openUnlockDialog({
        title: 'Odblokuj dane kliniczne',
        subtitle: 'Najpierw potwierdz haslo, a potem ustawisz nowe.',
        submitLabel: 'Odblokuj',
      });
      if (!unlocked) return false;
    }

    return this._openSetupDialog({ changeMode: true });
  },

  async prepareDataForStorage(data) {
    const clone = this._cloneState(data);

    if (this.isConfigured()) {
      if (this._derivedKey) {
        await this._encryptClinicalFieldsInState(clone, this._derivedKey);
        this._protectedState = clone;
        return this._cloneState(clone);
      }

      if (this._protectedState) {
        this._mergeProtectedFields(clone, this._protectedState);
        clone.settings = createAppSettings(clone.settings || {});
        clone.settings.clinicalSecurity = createClinicalSecuritySettings(
          (this._protectedState.settings && this._protectedState.settings.clinicalSecurity)
          || clone.settings.clinicalSecurity
          || {}
        );
        return clone;
      }

      throw new Error('Brakuje zaszyfrowanego stanu danych klinicznych.');
    }

    if (this.hasAnyClinicalData(clone)) {
      if (this._hasPlaintextClinicalData(clone)) {
        throw new Error('Ustaw haslo do danych klinicznych, aby bezpiecznie zapisac jawne notatki.');
      }
      this.status = 'migration-required';
      this._emitChange();
    }

    return clone;
  },

  async lockClinicalData(options = {}) {
    if (!this.isConfigured() || !this.isUnlocked() || !this._protectedState) {
      return false;
    }

    this._derivedKey = null;
    this._applyLockedState(this._protectedState);
    this.status = 'locked';
    this._cleanupSensitiveUi();
    this._emitChange();

    if (!options.silent) {
      this._toast('Dane kliniczne zostaly ponownie zablokowane.', 'info');
    }

    return true;
  },

  handleSignOut() {
    if (this.isUnlocked() && this._protectedState) {
      this._applyLockedState(this._protectedState);
    }
    this._derivedKey = null;
    this._cleanupSensitiveUi();
    this.bootstrapFromLoadedState();
  },

  async emergencyResetClinicalData() {
    this._visitClinicalFields(AppState, ({ holder, key }) => {
      holder[key] = '';
    });
    if (AppState.settings) {
      AppState.settings.clinicalSecurity = createClinicalSecuritySettings({});
    }
    this._derivedKey = null;
    this._protectedState = null;
    this.status = 'unconfigured';
    this._cleanupSensitiveUi();
    this._emitChange();
    if (typeof persistData === 'function') persistData();
    this._toast('Dane kliniczne zostaly trwale usuniete. Mozesz ustawic nowe haslo.', 'warning', 6000);
  },

  async _openSetupDialog(options = {}) {
    const isChange = options.changeMode === true;
    return this._openPasswordDialog({
      title: isChange ? 'Zmien haslo do danych klinicznych' : 'Ustaw haslo do danych klinicznych',
      subtitle: isChange
        ? 'Nowe haslo bedzie chronilo notatki, cele i wpisy kliniczne.'
        : 'Haslo bedzie chronilo notatki, cele i wpisy kliniczne.',
      submitLabel: isChange ? 'Zmien haslo' : 'Ustaw haslo',
      warning: 'Jesli zapomnisz tego hasla, odzyskanie tresci klinicznych moze byc niemozliwe.',
      fields: [
        { id: 'password', label: 'Haslo', type: 'password', autocomplete: 'new-password' },
        { id: 'passwordRepeat', label: 'Powtorz haslo', type: 'password', autocomplete: 'new-password' },
      ],
      onSubmit: async (values) => {
        const password = values.password || '';
        const repeat = values.passwordRepeat || '';
        if (password.length < 8) {
          throw new Error('Haslo powinno miec co najmniej 8 znakow.');
        }
        if (password !== repeat) {
          throw new Error('Hasla nie sa takie same.');
        }

        if (isChange) {
          await this._changePassword(password);
          this._toast('Haslo do danych klinicznych zostalo zmienione.', 'success');
        } else {
          await this._setInitialPassword(password);
          this._toast('Haslo do danych klinicznych zostalo ustawione.', 'success');
        }

        return true;
      },
    });
  },

  async _openUnlockDialog(options = {}) {
    return this._openPasswordDialog({
      title: options.title || 'Odblokuj dane kliniczne',
      subtitle: options.subtitle || 'Podaj haslo, aby zobaczyc i edytowac notatki kliniczne.',
      submitLabel: options.submitLabel || 'Odblokuj',
      footerHtml: '<button type="button" class="gabinet-security-modal__forgot" style="background:none;border:none;color:#888;font-size:.85rem;cursor:pointer;text-decoration:underline;margin-top:8px">Nie pamietam hasla</button>',
      onFooterClick: async () => {
        const confirmed = confirm(
          'UWAGA: Ta operacja BEZPOWROTNIE usunie wszystkie notatki kliniczne, '
          + 'cele terapeutyczne i wpisy postepow.\n\n'
          + 'Dane demograficzne pacjentow, sesje i platnosci pozostana nienaruszone.\n\n'
          + 'Czy na pewno chcesz kontynuowac?'
        );
        if (!confirmed) return;
        const doubleConfirm = confirm(
          'Ostatnie potwierdzenie: czy na pewno chcesz TRWALE usunac dane kliniczne?'
        );
        if (!doubleConfirm) return;
        await this.emergencyResetClinicalData();
        return 'close';
      },
      fields: [
        { id: 'password', label: 'Haslo', type: 'password', autocomplete: 'current-password' },
      ],
      onSubmit: async (values) => {
        await this._unlockWithPassword(values.password || '');
        this._toast('Dane kliniczne zostaly odblokowane.', 'success');
        return true;
      },
    });
  },

  async _setInitialPassword(password) {
    await this._applyPassword(password);
  },

  async _changePassword(password) {
    if (!this.isUnlocked()) {
      throw new Error('Najpierw odblokuj dane kliniczne.');
    }
    await this._applyPassword(password);
  },

  async _applyPassword(password) {
    const prevSettings = AppState.settings
      ? this._cloneState(AppState.settings)
      : null;
    const prevKey = this._derivedKey;
    const prevStatus = this.status;
    const prevProtected = this._protectedState;

    try {
      await this._decryptLegacyClinicalStringsInState(AppState);
      const securitySettings = await this._createSecuritySettings(password);
      AppState.settings = createAppSettings(AppState.settings || {});
      AppState.settings.clinicalSecurity = securitySettings;
      this._derivedKey = await this._deriveKey(password, securitySettings);
      this.status = 'unlocked';
      await serializeAppData();
      if (typeof persistData === 'function') persistData();
      if (typeof AutoLock !== 'undefined') AutoLock.start();
      this._emitChange();
    } catch (err) {
      AppState.settings = prevSettings;
      this._derivedKey = prevKey;
      this.status = prevStatus;
      this._protectedState = prevProtected;
      this._emitChange();
      throw new Error('Nie udalo sie zapisac hasla. Dane pozostaly bez zmian. (' + err.message + ')');
    }
  },

  async _unlockWithPassword(password) {
    if (!password) {
      throw new Error('Podaj haslo.');
    }
    if (!this.isConfigured()) {
      throw new Error('Najpierw ustaw haslo do danych klinicznych.');
    }
    if (!this._protectedState) {
      throw new Error('Brakuje zaszyfrowanych danych klinicznych.');
    }

    this.status = 'unlocking';
    this._emitChange();

    try {
      const settings = this._getClinicalSettings();
      const key = await this._deriveKey(password, settings);
      await this._verifyKey(key, settings.verification);
      const decryptedState = this._cloneState(this._protectedState);
      await this._decryptClinicalFieldsInState(decryptedState, key);
      this._applyUnlockedState(decryptedState);
      this._derivedKey = key;
      this.status = 'unlocked';
      if (typeof AutoLock !== 'undefined') AutoLock.start();
      this._emitChange();
      return true;
    } catch (err) {
      this._derivedKey = null;
      this.status = 'locked';
      this._emitChange();
      if (
        typeof DOMException !== 'undefined' &&
        (err instanceof DOMException || (err.name && err.name === 'OperationError'))
      ) {
        throw new Error('Haslo nie pasuje.');
      }
      throw new Error('Wystapil blad techniczny podczas odszyfrowywania danych. (' + err.message + ')');
    }
  },

  async _createSecuritySettings(password) {
    const settings = createClinicalSecuritySettings({
      enabled: true,
      version: 1,
      salt: this._bytesToBase64(crypto.getRandomValues(new Uint8Array(16))),
      kdfIterations: 210000,
      kdfHash: 'SHA-256',
      updatedAt: new Date().toISOString(),
    });
    const key = await this._deriveKey(password, settings);
    settings.verification = await this._encryptString('gabinet-clinical-verification', key);
    return settings;
  },

  async _verifyKey(key, envelope) {
    const value = await this._decryptString(envelope, key);
    if (value !== 'gabinet-clinical-verification') {
      throw new Error('INVALID_PASSWORD');
    }
  },

  async _deriveKey(password, securitySettings) {
    if (!this.isSupported()) {
      throw new Error('Brak wsparcia kryptografii w przegladarce.');
    }

    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this._base64ToBytes(securitySettings.salt),
        iterations: securitySettings.kdfIterations || 210000,
        hash: securitySettings.kdfHash || 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async _encryptClinicalFieldsInState(data, key) {
    const jobs = [];
    this._visitClinicalFields(data, ({ holder, key: fieldKey, value }) => {
      if (isEncryptedClinicalEnvelope(value)) return;
      const plaintext = typeof value === 'string' ? value : String(value || '');
      jobs.push(
        this._encryptString(plaintext, key).then((envelope) => {
          holder[fieldKey] = envelope;
        })
      );
    });
    await Promise.all(jobs);
  },

  async _decryptClinicalFieldsInState(data, key) {
    const jobs = [];
    this._visitClinicalFields(data, ({ holder, key: fieldKey, value }) => {
      if (!isEncryptedClinicalEnvelope(value)) {
        holder[fieldKey] = typeof value === 'string' ? value : String(value || '');
        return;
      }
      jobs.push(
        this._decryptString(value, key).then((plaintext) => {
          holder[fieldKey] = plaintext;
        })
      );
    });
    await Promise.all(jobs);
  },

  async _decryptLegacyClinicalStringsInState(data) {
    if (typeof Encryption === 'undefined' || typeof Encryption.decrypt !== 'function') return;

    const jobs = [];
    this._visitClinicalFields(data, ({ holder, key: fieldKey, value }) => {
      if (!this._isProbablyLegacyEncryptedString(value)) return;
      jobs.push(
        Encryption.decrypt(value).then((plaintext) => {
          holder[fieldKey] = typeof plaintext === 'string' ? plaintext : value;
        }).catch(() => {
          holder[fieldKey] = value;
        })
      );
    });
    await Promise.all(jobs);
  },

  async _encryptString(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(String(plaintext || ''))
    );

    return {
      __clinicalEncrypted: true,
      alg: 'AES-GCM',
      iv: this._bytesToBase64(iv),
      ciphertext: this._bytesToBase64(new Uint8Array(encrypted)),
    };
  },

  async _decryptString(envelope, key) {
    const decrypted = await crypto.subtle.decrypt(
      { name: envelope.alg || 'AES-GCM', iv: this._base64ToBytes(envelope.iv) },
      key,
      this._base64ToBytes(envelope.ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  },

  _applyLockedState(protectedState) {
    const lockedState = this._cloneState(protectedState);
    this._visitClinicalFields(lockedState, ({ holder, key }) => {
      holder[key] = '';
    });
    this._hydrateAppState(lockedState);
    if (typeof App !== 'undefined' && typeof App.refreshCurrentView === 'function') {
      App.refreshCurrentView();
    }
  },

  _applyUnlockedState(decryptedState) {
    this._hydrateAppState(decryptedState);
    if (typeof App !== 'undefined' && typeof App.refreshCurrentView === 'function') {
      App.refreshCurrentView();
    }
  },

  _hydrateAppState(data) {
    AppState.patients = (data.patients || []).map(createPatient);
    AppState.sessions = (data.sessions || []).map(createSession);
    AppState.payments = (data.payments || []).map(createPayment);
    AppState.blockedPeriods = (data.blockedPeriods || []).map(createBlockedPeriod);
    AppState.settings = createAppSettings(data.settings || {});
    AppState.generatedMonths = Array.isArray(data.generatedMonths) ? data.generatedMonths : [];
    if (typeof reconcilePaymentStatus === 'function') {
      reconcilePaymentStatus();
    }
  },

  _mergeProtectedFields(target, source) {
    const protectedSessions = this._indexById(source.sessions || [], 'sessions');
    (target.sessions || []).forEach((session) => {
      const protectedSession = protectedSessions.get(session.id);
      this._mergeProtectedRecordField(session, protectedSession, 'sessionNotes', 'sesji');
    });

    const protectedPatients = this._indexById(source.patients || [], 'patients');
    (target.patients || []).forEach((patient) => {
      const protectedPatient = protectedPatients.get(patient.id);
      if (!protectedPatient) {
        this._assertNoClinicalContentInPatient(patient, 'nowego pacjenta');
        return;
      }

      this._mergeProtectedCollection(
        patient.sessionNotes,
        protectedPatient.sessionNotes,
        ['content'],
        'notatki pacjenta'
      );
      this._mergeProtectedCollection(
        patient.therapeuticGoals,
        protectedPatient.therapeuticGoals,
        ['title', 'notes'],
        'celu terapeutycznego'
      );
      this._mergeProtectedCollection(
        patient.progressEntries,
        protectedPatient.progressEntries,
        ['title', 'content'],
        'wpisu postepu'
      );
    });
  },

  _indexById(items, label) {
    const indexed = new Map();
    (items || []).forEach((item) => {
      if (!item || !item.id) return;
      if (indexed.has(item.id)) {
        throw new Error('Nie mozna bezpiecznie zapisac danych klinicznych: duplikat id w ' + label + '. Odblokuj dane kliniczne i sprawdz rekordy.');
      }
      indexed.set(item.id, item);
    });
    return indexed;
  },

  _mergeProtectedCollection(targetItems = [], sourceItems = [], clinicalKeys = [], label = 'rekordu') {
    const protectedItems = this._indexById(sourceItems || [], label);
    (targetItems || []).forEach((targetItem) => {
      const protectedItem = targetItem && targetItem.id ? protectedItems.get(targetItem.id) : null;
      clinicalKeys.forEach((clinicalKey) => {
        this._mergeProtectedRecordField(targetItem, protectedItem, clinicalKey, label);
      });
    });
  },

  _mergeProtectedRecordField(targetRecord, sourceRecord, clinicalKey, label) {
    if (!targetRecord) return;

    if (sourceRecord && Object.prototype.hasOwnProperty.call(sourceRecord, clinicalKey)) {
      if (this._hasUnprotectedClinicalValue(targetRecord[clinicalKey])) {
        this._throwLockedClinicalEditError(label);
      }
      targetRecord[clinicalKey] = this._cloneState(sourceRecord[clinicalKey]);
      return;
    }

    if (this.hasClinicalContent(targetRecord[clinicalKey])) {
      this._throwLockedClinicalEditError(label);
    }
  },

  _assertNoClinicalContentInPatient(patient, label) {
    (patient.sessionNotes || []).forEach((note) => {
      if (this.hasClinicalContent(note.content)) this._throwLockedClinicalEditError(label);
    });
    (patient.therapeuticGoals || []).forEach((goal) => {
      if (this.hasClinicalContent(goal.title) || this.hasClinicalContent(goal.notes)) {
        this._throwLockedClinicalEditError(label);
      }
    });
    (patient.progressEntries || []).forEach((entry) => {
      if (this.hasClinicalContent(entry.title) || this.hasClinicalContent(entry.content)) {
        this._throwLockedClinicalEditError(label);
      }
    });
  },

  _hasUnprotectedClinicalValue(value) {
    return !isEncryptedClinicalEnvelope(value)
      && typeof value === 'string'
      && value.trim().length > 0;
  },

  _throwLockedClinicalEditError(label) {
    throw new Error('Dane kliniczne sa zablokowane. Odblokuj je przed edycja lub zmiana ' + label + '.');
  },

  _visitClinicalFields(data, visitor) {
    (data.sessions || []).forEach((session, sessionIndex) => {
      visitor({
        holder: session,
        key: 'sessionNotes',
        value: session.sessionNotes,
        path: ['sessions', sessionIndex, 'sessionNotes'],
      });
    });

    (data.patients || []).forEach((patient, patientIndex) => {
      (patient.sessionNotes || []).forEach((note, noteIndex) => {
        visitor({
          holder: note,
          key: 'content',
          value: note.content,
          path: ['patients', patientIndex, 'sessionNotes', noteIndex, 'content'],
        });
      });

      (patient.therapeuticGoals || []).forEach((goal, goalIndex) => {
        visitor({
          holder: goal,
          key: 'title',
          value: goal.title,
          path: ['patients', patientIndex, 'therapeuticGoals', goalIndex, 'title'],
        });
        visitor({
          holder: goal,
          key: 'notes',
          value: goal.notes,
          path: ['patients', patientIndex, 'therapeuticGoals', goalIndex, 'notes'],
        });
      });

      (patient.progressEntries || []).forEach((entry, entryIndex) => {
        visitor({
          holder: entry,
          key: 'title',
          value: entry.title,
          path: ['patients', patientIndex, 'progressEntries', entryIndex, 'title'],
        });
        visitor({
          holder: entry,
          key: 'content',
          value: entry.content,
          path: ['patients', patientIndex, 'progressEntries', entryIndex, 'content'],
        });
      });
    });
  },

  _hasPlaintextClinicalData(data) {
    let found = false;
    this._visitClinicalFields(data, ({ value }) => {
      if (found) return;
      if (isEncryptedClinicalEnvelope(value)) return;
      if (typeof value !== 'string' || !value.trim()) return;
      if (this._isProbablyLegacyEncryptedString(value)) return;
      found = true;
    });
    return found;
  },

  _isProbablyLegacyEncryptedString(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.length < 24 || trimmed.length % 4 !== 0) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return false;
    try {
      return this._base64ToBytes(trimmed).length > 28;
    } catch {
      return false;
    }
  },

  _getValueAtPath(root, path) {
    return path.reduce((current, segment) => {
      if (current === undefined || current === null) return null;
      return current[segment];
    }, root);
  },

  _getClinicalSettings() {
    AppState.settings = createAppSettings(AppState.settings || {});
    return AppState.settings.clinicalSecurity;
  },

  _cleanupSensitiveUi() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll(
      '#modal-session-detail, #modal-patient-detail, .gabinet-security-modal-backdrop, .cal-modal-overlay, .pv-modal-overlay'
    ).forEach((node) => {
      node.remove();
    });
  },

  _emitChange() {
    if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
    document.dispatchEvent(new CustomEvent('clinical-security-changed', {
      detail: {
        status: this.status,
        configured: this.isConfigured(),
        unlocked: this.isUnlocked(),
      },
    }));
  },

  _cloneState(value) {
    return JSON.parse(JSON.stringify(value));
  },

  _bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    if (typeof btoa === 'function') return btoa(binary);
    if (typeof Buffer !== 'undefined') return Buffer.from(binary, 'binary').toString('base64');
    throw new Error('Brak kodowania base64 w przegladarce.');
  },

  _base64ToBytes(base64) {
    const binary = typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  },

  async _openPasswordDialog(config) {
    this._injectModalStyles();

    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'gabinet-security-modal-backdrop';
      backdrop.innerHTML = (
        '<div class="gabinet-security-modal" role="dialog" aria-modal="true">'
        + '<div class="gabinet-security-modal__header">'
          + '<h3 class="gabinet-security-modal__title">' + this._escapeHtml(config.title) + '</h3>'
          + '<button class="gabinet-security-modal__close" type="button" aria-label="Zamknij">x</button>'
        + '</div>'
        + '<p class="gabinet-security-modal__subtitle">' + this._escapeHtml(config.subtitle || '') + '</p>'
        + (config.warning
          ? '<p class="gabinet-security-modal__warning">' + this._escapeHtml(config.warning) + '</p>'
          : '')
        + '<form class="gabinet-security-modal__form">'
          + (config.fields || []).map((field) => (
            '<label class="gabinet-security-modal__label" for="gsm-' + this._escapeHtml(field.id) + '">'
            + this._escapeHtml(field.label)
            + '<input class="gabinet-security-modal__input"'
              + ' id="gsm-' + this._escapeHtml(field.id) + '"'
              + ' name="' + this._escapeHtml(field.id) + '"'
              + ' type="' + this._escapeHtml(field.type || 'password') + '"'
              + ' autocomplete="' + this._escapeHtml(field.autocomplete || 'off') + '"'
              + ' required>'
            + '</label>'
          )).join('')
          + '<p class="gabinet-security-modal__error" hidden></p>'
          + '<div class="gabinet-security-modal__actions">'
            + '<button class="gabinet-security-modal__btn gabinet-security-modal__btn--ghost" type="button" data-role="cancel">Anuluj</button>'
            + '<button class="gabinet-security-modal__btn gabinet-security-modal__btn--primary" type="submit">' + this._escapeHtml(config.submitLabel || 'Zapisz') + '</button>'
          + '</div>'
        + '</form>'
        + (config.footerHtml || '')
        + '</div>'
      );

      const close = (result) => {
        backdrop.remove();
        resolve(result);
      };

      const form = backdrop.querySelector('form');
      const errorEl = backdrop.querySelector('.gabinet-security-modal__error');
      const submitBtn = backdrop.querySelector('[type="submit"]');

      backdrop.querySelector('[data-role="cancel"]').addEventListener('click', () => close(false));
      backdrop.querySelector('.gabinet-security-modal__close').addEventListener('click', () => close(false));
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) close(false);
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorEl.hidden = true;
        errorEl.textContent = '';
        submitBtn.disabled = true;

        try {
          const values = {};
          (config.fields || []).forEach((field) => {
            const input = form.querySelector('[name="' + field.id + '"]');
            values[field.id] = input ? input.value : '';
          });

          const ok = await config.onSubmit(values);
          if (ok !== false) {
            close(true);
            return;
          }
        } catch (err) {
          errorEl.textContent = err && err.message ? err.message : 'Nie udalo sie zapisac zmian.';
          errorEl.hidden = false;
        } finally {
          submitBtn.disabled = false;
        }
      });

      if (config.footerHtml && config.onFooterClick) {
        const forgotBtn = backdrop.querySelector('.gabinet-security-modal__forgot');
        if (forgotBtn) {
          forgotBtn.addEventListener('click', async () => {
            const result = await config.onFooterClick();
            if (result === 'close') close(false);
          });
        }
      }

      document.body.appendChild(backdrop);
      const firstInput = backdrop.querySelector('input');
      if (firstInput) firstInput.focus();
    });
  },

  _injectModalStyles() {
    if (document.getElementById('gabinet-security-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'gabinet-security-modal-styles';
    style.textContent = `
      .gabinet-security-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(20, 29, 24, 0.48);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 10020;
      }
      .gabinet-security-modal {
        width: min(100%, 460px);
        background: #fbf8f2;
        color: #243126;
        border-radius: 24px;
        box-shadow: 0 30px 80px rgba(19, 28, 22, 0.18);
        padding: 24px;
      }
      .gabinet-security-modal__header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }
      .gabinet-security-modal__title {
        margin: 0;
        font-size: 1.25rem;
        line-height: 1.2;
      }
      .gabinet-security-modal__close {
        border: none;
        background: transparent;
        color: #6b7a70;
        font-size: 1.8rem;
        line-height: 1;
        cursor: pointer;
      }
      .gabinet-security-modal__subtitle,
      .gabinet-security-modal__warning {
        margin: 14px 0 0;
        font-size: 0.95rem;
        line-height: 1.5;
        color: #4f5d53;
      }
      .gabinet-security-modal__warning {
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(220, 194, 157, 0.2);
        color: #66513a;
      }
      .gabinet-security-modal__form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 18px;
      }
      .gabinet-security-modal__label {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 0.92rem;
        color: #37453b;
      }
      .gabinet-security-modal__input {
        width: 100%;
        border: 1px solid rgba(73, 102, 79, 0.18);
        border-radius: 14px;
        background: #fff;
        color: #243126;
        font-size: 1rem;
        padding: 14px 16px;
        outline: none;
      }
      .gabinet-security-modal__input:focus {
        border-color: #49664f;
        box-shadow: 0 0 0 3px rgba(73, 102, 79, 0.12);
      }
      .gabinet-security-modal__error {
        margin: 0;
        font-size: 0.9rem;
        color: #b42318;
      }
      .gabinet-security-modal__actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 4px;
      }
      .gabinet-security-modal__btn {
        border: none;
        border-radius: 999px;
        padding: 12px 18px;
        font-size: 0.95rem;
        cursor: pointer;
      }
      .gabinet-security-modal__btn--ghost {
        background: rgba(73, 102, 79, 0.08);
        color: #49664f;
      }
      .gabinet-security-modal__btn--primary {
        background: #49664f;
        color: #fff;
      }
      .gabinet-security-modal__btn[disabled] {
        opacity: 0.6;
        cursor: wait;
      }
    `;
    document.head.appendChild(style);
  },

  _escapeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _toast(message, type, duration) {
    if (typeof toast === 'function') toast(message, type, duration);
  },
};
