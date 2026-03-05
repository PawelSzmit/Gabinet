/* ===========================================
   Drive - Google Drive API v3
   =========================================== */

const Drive = (() => {
  const DATA_FILE_NAME = 'gabinet-data.json';
  let fileId = null;
  let isSaving = false;
  let pendingSave = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  function getDefaultData() {
    return {
      version: '1.0',
      lastSync: new Date().toISOString(),
      settings: {
        therapistName: '',
        therapistAddress: '',
        therapistNIP: '',
        workingHoursStart: '08:00',
        workingHoursEnd: '20:00',
        encryptionKeyHash: ''
      },
      patients: [],
      sessions: [],
      payments: [],
      sessionNotes: [],
      progressEntries: [],
      blockedPeriods: [],
      invoices: []
    };
  }

  function setSyncStatus(status) {
    const indicator = document.getElementById('sync-indicator');
    indicator.className = 'sync-indicator ' + status;
    const titles = {
      syncing: 'Synchronizuję...',
      synced: 'Zsynchronizowano',
      error: 'Błąd synchronizacji'
    };
    indicator.title = titles[status] || '';
  }

  async function findFile() {
    try {
      const response = await gapi.client.drive.files.list({
        q: `name='${DATA_FILE_NAME}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, modifiedTime)'
      });
      const files = response.result.files;
      if (files && files.length > 0) {
        fileId = files[0].id;
        return fileId;
      }
      return null;
    } catch (err) {
      throw err;
    }
  }

  async function createFile(data) {
    const metadata = {
      name: DATA_FILE_NAME,
      mimeType: 'application/json'
    };
    const content = JSON.stringify(data, null, 2);
    const boundary = '-------gabinet_boundary';
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      content,
      `--${boundary}--`
    ].join('\r\n');

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Auth.getToken()}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    );

    if (!response.ok) throw new Error('Failed to create file');
    const result = await response.json();
    fileId = result.id;
    return result;
  }

  async function loadData() {
    setSyncStatus('syncing');
    try {
      await Auth.ensureValidToken();
      let fId = await findFile();

      if (!fId) {
        const defaultData = getDefaultData();
        await createFile(defaultData);
        setSyncStatus('synced');
        updateLastSync();
        return defaultData;
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${Auth.getToken()}` }
        }
      );

      if (response.status === 401) {
        // Token expired mid-request — force refresh and retry once
        await Auth.ensureValidToken();
        const retry = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${Auth.getToken()}` } }
        );
        if (!retry.ok) throw new Error('Failed to load file after token refresh');
        const data = await retry.json();
        setSyncStatus('synced');
        updateLastSync();
        retryCount = 0;
        return data;
      }

      if (!response.ok) throw new Error('Failed to load file');
      const data = await response.json();
      setSyncStatus('synced');
      updateLastSync();
      retryCount = 0;
      return data;
    } catch (err) {
      setSyncStatus('error');
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        await new Promise(r => setTimeout(r, 1000 * retryCount));
        return loadData();
      }
      Utils.showToast('Błąd synchronizacji danych', 'error');
      const cached = localStorage.getItem('gabinet_data_cache');
      if (cached) {
        return JSON.parse(cached);
      }
      return getDefaultData();
    }
  }

  const debouncedSave = Utils.debounce(async (data) => {
    await performSave(data);
  }, 300);

  async function saveData(data) {
    data.lastSync = new Date().toISOString();
    localStorage.setItem('gabinet_data_cache', JSON.stringify(data));
    debouncedSave(data);
  }

  async function performSave(data) {
    if (isSaving) {
      pendingSave = data;
      return;
    }

    isSaving = true;
    setSyncStatus('syncing');

    try {
      await Auth.ensureValidToken();

      if (!fileId) {
        await findFile();
      }

      if (!fileId) {
        await createFile(data);
      } else {
        const response = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${Auth.getToken()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data, null, 2)
          }
        );

        if (response.status === 401) {
          // Token expired mid-request — force refresh and retry once
          await Auth.ensureValidToken();
          const retry = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${Auth.getToken()}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data, null, 2)
            }
          );
          if (!retry.ok) throw new Error('Failed to save file after token refresh');
        } else if (!response.ok) {
          throw new Error('Failed to save file');
        }
      }

      setSyncStatus('synced');
      updateLastSync();
      retryCount = 0;
    } catch (err) {
      setSyncStatus('error');
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        await new Promise(r => setTimeout(r, 1000 * retryCount));
        await performSave(data);
        return;
      }
      Utils.showToast('Błąd zapisu danych', 'error');
    } finally {
      isSaving = false;
      if (pendingSave) {
        const nextData = pendingSave;
        pendingSave = null;
        await performSave(nextData);
      }
    }
  }

  function updateLastSync() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('set-last-sync');
    if (el) {
      el.textContent = `Ostatnia synchronizacja: ${timeStr}`;
    }
  }

  async function forceSync() {
    retryCount = 0;
    fileId = null;
    return loadData();
  }

  return {
    loadData,
    saveData,
    forceSync,
    getDefaultData
  };
})();
