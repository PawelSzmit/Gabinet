/* ===========================================
   Notes - encrypted notes, goals, progress
   =========================================== */

const Notes = (() => {
  let currentPatientId = null;
  let editingNoteId = null;
  let editingGoalId = null;
  let editingProgressId = null;

  function init() {
    document.getElementById('btn-add-note').addEventListener('click', () => showNoteModal());
    document.getElementById('mn-btn-save').addEventListener('click', saveNote);
    document.getElementById('mn-btn-delete').addEventListener('click', deleteNote);

    document.getElementById('btn-add-goal').addEventListener('click', () => showGoalModal());
    document.getElementById('mg-btn-save').addEventListener('click', saveGoal);
    document.getElementById('mg-btn-delete').addEventListener('click', deleteGoal);

    document.getElementById('btn-add-progress').addEventListener('click', () => showProgressModal());
    document.getElementById('mpr-btn-save').addEventListener('click', saveProgress);
    document.getElementById('mpr-btn-delete').addEventListener('click', deleteProgress);
  }

  function setCurrentPatient(patientId) {
    currentPatientId = patientId;
  }

  // ---- Notes ----

  function showNoteModal(noteId) {
    editingNoteId = noteId || null;
    document.getElementById('mn-date').value = Utils.todayISO();
    document.getElementById('mn-content').value = '';
    document.getElementById('mn-btn-delete').classList.add('hidden');

    if (noteId) {
      const data = App.getData();
      const note = data.sessionNotes.find(n => n.id === noteId);
      if (note) {
        document.getElementById('mn-title').textContent = 'Edytuj notatkę';
        document.getElementById('mn-date').value = note.date;
        document.getElementById('mn-btn-delete').classList.remove('hidden');
        Encryption.decrypt(note.content).then(text => {
          document.getElementById('mn-content').value = text;
        });
      }
    } else {
      document.getElementById('mn-title').textContent = 'Nowa notatka';
    }

    Utils.showModal('modal-note');
  }

  async function saveNote() {
    const date = document.getElementById('mn-date').value;
    const content = document.getElementById('mn-content').value;

    if (!content.trim()) {
      Utils.showToast('Wpisz treść notatki', 'warning');
      return;
    }

    const encrypted = await Encryption.encrypt(content);
    const data = App.getData();

    if (editingNoteId) {
      const note = data.sessionNotes.find(n => n.id === editingNoteId);
      if (note) {
        note.date = date;
        note.content = encrypted;
        note.modifiedAt = new Date().toISOString();
      }
    } else {
      data.sessionNotes.push({
        id: Utils.generateUUID(),
        patientId: currentPatientId,
        sessionId: null,
        date,
        content: encrypted,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      });
    }

    App.saveAndRefresh();
    Utils.hideModals();
    Utils.showToast('Notatka zapisana', 'success');
    await renderNotesList(currentPatientId);
  }

  function deleteNote() {
    if (!editingNoteId) return;
    Utils.showConfirm('Usuń notatkę', 'Czy na pewno chcesz usunąć tę notatkę?', async () => {
      const data = App.getData();
      data.sessionNotes = data.sessionNotes.filter(n => n.id !== editingNoteId);
      App.saveAndRefresh();
      Utils.hideModals();
      Utils.showToast('Notatka usunięta', 'success');
      await renderNotesList(currentPatientId);
    });
  }

  async function renderNotesList(patientId) {
    currentPatientId = patientId;
    const data = App.getData();
    const container = document.getElementById('pd-notes-list');

    const notes = data.sessionNotes
      .filter(n => n.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (notes.length === 0) {
      container.innerHTML = '<p class="empty-state">Brak notatek</p>';
      return;
    }

    const notesHtml = [];
    for (const note of notes) {
      let preview = '';
      try {
        const decrypted = await Encryption.decrypt(note.content);
        preview = decrypted.substring(0, 120);
        if (decrypted.length > 120) preview += '...';
      } catch {
        preview = '[zaszyfrowana]';
      }

      const sessionBadge = note.sessionId
        ? (() => {
            const session = data.sessions.find(s => s.id === note.sessionId);
            return session && session.sessionNumber
              ? `<span class="badge badge-primary">Sesja #${session.sessionNumber}</span>`
              : '';
          })()
        : '';

      notesHtml.push(`
        <div class="list-item" data-note-id="${note.id}">
          <div class="list-item-left">
            <span class="list-item-title">${Utils.formatDatePL(note.date)} ${sessionBadge}</span>
            <div class="note-preview">${Utils.escapeHtml(preview)}</div>
          </div>
        </div>
      `);
    }

    container.innerHTML = notesHtml.join('');

    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        showNoteModal(item.dataset.noteId);
      });
    });
  }

  // ---- Goals ----

  function showGoalModal(goalId) {
    editingGoalId = goalId || null;
    document.getElementById('mg-goal-title').value = '';
    document.getElementById('mg-description').value = '';
    document.getElementById('mg-status').value = 'inProgress';
    document.getElementById('mg-btn-delete').classList.add('hidden');

    if (goalId) {
      const data = App.getData();
      const patient = data.patients.find(p => p.id === currentPatientId);
      if (patient) {
        const goal = patient.therapeuticGoals.find(g => g.id === goalId);
        if (goal) {
          document.getElementById('mg-title').textContent = 'Edytuj cel';
          document.getElementById('mg-goal-title').value = goal.title;
          document.getElementById('mg-status').value = goal.status;
          document.getElementById('mg-btn-delete').classList.remove('hidden');
          Encryption.decrypt(goal.description).then(text => {
            document.getElementById('mg-description').value = text;
          });
        }
      }
    } else {
      document.getElementById('mg-title').textContent = 'Nowy cel terapeutyczny';
    }

    Utils.showModal('modal-goal');
  }

  async function saveGoal() {
    const title = document.getElementById('mg-goal-title').value.trim();
    const description = document.getElementById('mg-description').value;
    const status = document.getElementById('mg-status').value;

    if (!title) {
      Utils.showToast('Wpisz tytuł celu', 'warning');
      return;
    }

    const encryptedDesc = await Encryption.encrypt(description);
    const data = App.getData();
    const patient = data.patients.find(p => p.id === currentPatientId);
    if (!patient) return;

    if (editingGoalId) {
      const goal = patient.therapeuticGoals.find(g => g.id === editingGoalId);
      if (goal) {
        goal.title = title;
        goal.description = encryptedDesc;
        goal.status = status;
        if (status === 'achieved' && !goal.dateAchieved) {
          goal.dateAchieved = Utils.todayISO();
        }
      }
    } else {
      patient.therapeuticGoals.push({
        id: Utils.generateUUID(),
        title,
        description: encryptedDesc,
        status,
        dateSet: Utils.todayISO(),
        dateAchieved: null
      });
    }

    App.saveAndRefresh();
    Utils.hideModals();
    Utils.showToast('Cel zapisany', 'success');
    await renderGoalsList(currentPatientId);
  }

  function deleteGoal() {
    if (!editingGoalId) return;
    Utils.showConfirm('Usuń cel', 'Czy na pewno chcesz usunąć ten cel?', async () => {
      const data = App.getData();
      const patient = data.patients.find(p => p.id === currentPatientId);
      if (patient) {
        patient.therapeuticGoals = patient.therapeuticGoals.filter(g => g.id !== editingGoalId);
      }
      App.saveAndRefresh();
      Utils.hideModals();
      Utils.showToast('Cel usunięty', 'success');
      await renderGoalsList(currentPatientId);
    });
  }

  async function renderGoalsList(patientId) {
    currentPatientId = patientId;
    const data = App.getData();
    const patient = data.patients.find(p => p.id === patientId);
    const container = document.getElementById('pd-goals-list');

    if (!patient || !patient.therapeuticGoals || patient.therapeuticGoals.length === 0) {
      container.innerHTML = '<p class="empty-state">Brak celów terapeutycznych</p>';
      return;
    }

    const goalsHtml = patient.therapeuticGoals.map(goal => {
      const statusLabel = Utils.getGoalStatusLabel(goal.status);
      const statusBadgeClass = goal.status === 'achieved' ? 'badge-success'
        : goal.status === 'abandoned' ? 'badge-neutral' : 'badge-primary';
      const checkIcon = goal.status === 'achieved' ? '&#10003; ' : '';

      return `
        <div class="list-item" data-goal-id="${goal.id}">
          <div class="list-item-left">
            <span class="list-item-title">${checkIcon}${Utils.escapeHtml(goal.title)}</span>
            <span class="list-item-subtitle">${Utils.formatDatePL(goal.dateSet)}</span>
          </div>
          <div class="list-item-right">
            <span class="badge ${statusBadgeClass}">${statusLabel}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = goalsHtml;

    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        showGoalModal(item.dataset.goalId);
      });
    });
  }

  // ---- Progress ----

  function showProgressModal(progressId) {
    editingProgressId = progressId || null;
    document.getElementById('mpr-date').value = Utils.todayISO();
    document.getElementById('mpr-category').value = 'Przełom';
    document.getElementById('mpr-progress-title').value = '';
    document.getElementById('mpr-content').value = '';
    document.getElementById('mpr-btn-delete').classList.add('hidden');

    if (progressId) {
      const data = App.getData();
      const entry = data.progressEntries.find(e => e.id === progressId);
      if (entry) {
        document.getElementById('mpr-title').textContent = 'Edytuj wpis';
        document.getElementById('mpr-date').value = entry.date;
        document.getElementById('mpr-category').value = entry.category;
        document.getElementById('mpr-progress-title').value = entry.title;
        document.getElementById('mpr-btn-delete').classList.remove('hidden');
        Encryption.decrypt(entry.content).then(text => {
          document.getElementById('mpr-content').value = text;
        });
      }
    } else {
      document.getElementById('mpr-title').textContent = 'Nowy wpis postępu';
    }

    Utils.showModal('modal-progress');
  }

  async function saveProgress() {
    const date = document.getElementById('mpr-date').value;
    const category = document.getElementById('mpr-category').value;
    const title = document.getElementById('mpr-progress-title').value.trim();
    const content = document.getElementById('mpr-content').value;

    if (!title) {
      Utils.showToast('Wpisz tytuł', 'warning');
      return;
    }

    const encrypted = await Encryption.encrypt(content);
    const data = App.getData();

    if (editingProgressId) {
      const entry = data.progressEntries.find(e => e.id === editingProgressId);
      if (entry) {
        entry.date = date;
        entry.category = category;
        entry.title = title;
        entry.content = encrypted;
      }
    } else {
      data.progressEntries.push({
        id: Utils.generateUUID(),
        patientId: currentPatientId,
        sessionId: null,
        date,
        category,
        title,
        content: encrypted
      });
    }

    App.saveAndRefresh();
    Utils.hideModals();
    Utils.showToast('Wpis zapisany', 'success');
    await renderProgressList(currentPatientId);
  }

  function deleteProgress() {
    if (!editingProgressId) return;
    Utils.showConfirm('Usuń wpis', 'Czy na pewno chcesz usunąć ten wpis?', async () => {
      const data = App.getData();
      data.progressEntries = data.progressEntries.filter(e => e.id !== editingProgressId);
      App.saveAndRefresh();
      Utils.hideModals();
      Utils.showToast('Wpis usunięty', 'success');
      await renderProgressList(currentPatientId);
    });
  }

  async function renderProgressList(patientId) {
    currentPatientId = patientId;
    const data = App.getData();
    const container = document.getElementById('pd-progress-list');

    const entries = data.progressEntries
      .filter(e => e.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-state">Brak wpisów postępu</p>';
      return;
    }

    const entriesHtml = [];
    for (const entry of entries) {
      let preview = '';
      try {
        const decrypted = await Encryption.decrypt(entry.content);
        preview = decrypted.substring(0, 100);
        if (decrypted.length > 100) preview += '...';
      } catch {
        preview = '[zaszyfrowana]';
      }

      entriesHtml.push(`
        <div class="timeline-item" data-progress-id="${entry.id}">
          <div class="timeline-date">${Utils.formatDatePL(entry.date)}</div>
          <div class="timeline-category">${Utils.escapeHtml(entry.category)}</div>
          <div class="timeline-title">${Utils.escapeHtml(entry.title)}</div>
          <div class="timeline-preview">${Utils.escapeHtml(preview)}</div>
        </div>
      `);
    }

    container.innerHTML = entriesHtml.join('');

    container.querySelectorAll('.timeline-item').forEach(item => {
      item.addEventListener('click', () => {
        showProgressModal(item.dataset.progressId);
      });
    });
  }

  return {
    init,
    setCurrentPatient,
    renderNotesList,
    renderGoalsList,
    renderProgressList
  };
})();
