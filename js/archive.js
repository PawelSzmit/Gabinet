/* ===========================================
   Archive - archiving, restoring patients
   =========================================== */

const Archive = (() => {
  let restoringPatientId = null;

  function init() {
    document.getElementById('btn-archive-list').addEventListener('click', () => {
      App.navigate('archive');
    });

    document.getElementById('mr-btn-restore').addEventListener('click', restorePatient);

    document.querySelectorAll('input[name="restoreDay"]').forEach(cb => {
      cb.addEventListener('change', updateRestoreTimeInputs);
    });
  }

  function renderArchiveList() {
    const data = App.getData();
    const archived = data.patients.filter(p => p.isArchived);
    const container = document.getElementById('archive-list');
    const emptyEl = document.getElementById('archive-empty');

    if (archived.length === 0) {
      container.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    container.innerHTML = archived.map(patient => {
      const completedSessions = data.sessions.filter(s =>
        s.patientId === patient.id && s.status === 'completed'
      ).length;
      const startDate = Utils.formatDatePL(patient.therapyStartDate);
      const endDate = patient.archivedDate ? Utils.formatDatePL(patient.archivedDate) : '?';

      return `
        <div class="list-item" data-patient-id="${patient.id}">
          <div class="list-item-left">
            <span class="list-item-title">${Utils.escapeHtml(patient.lastName)} ${Utils.escapeHtml(patient.firstName)}</span>
            <span class="list-item-subtitle">${Utils.escapeHtml(patient.pseudonym)} &middot; ${startDate} - ${endDate} &middot; ${completedSessions} sesji</span>
          </div>
          <div class="list-item-right">
            <button class="btn btn-sm btn-primary btn-restore" data-id="${patient.id}">Przywróć</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showRestoreModal(btn.dataset.id);
      });
    });
  }

  function showRestoreModal(patientId) {
    restoringPatientId = patientId;
    const data = App.getData();
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) return;

    const completedSessions = data.sessions.filter(s =>
      s.patientId === patientId && s.status === 'completed'
    ).length;

    document.getElementById('mr-patient-info').innerHTML = `
      <div class="info-card">
        <h4>Pacjent</h4>
        <span class="value">${Utils.escapeHtml(patient.firstName)} ${Utils.escapeHtml(patient.lastName)} (${Utils.escapeHtml(patient.pseudonym)})</span>
      </div>
      <div class="info-card">
        <h4>Poprzednia terapia</h4>
        <span class="value">${Utils.formatDatePL(patient.therapyStartDate)} - ${Utils.formatDatePL(patient.archivedDate)}</span>
      </div>
      <div class="info-card">
        <h4>Odbyte sesje</h4>
        <span class="value">${completedSessions}</span>
      </div>
    `;

    document.getElementById('mr-start-date').value = Utils.todayISO();

    document.querySelectorAll('input[name="restoreDay"]').forEach(cb => {
      cb.checked = patient.sessionDays.includes(cb.value);
    });

    updateRestoreTimeInputs();

    if (patient.sessionTimes) {
      Object.entries(patient.sessionTimes).forEach(([day, time]) => {
        const input = document.getElementById(`restore-time-${day}`);
        if (input) input.value = time;
      });
    }

    Utils.showModal('modal-restore');
  }

  function updateRestoreTimeInputs() {
    const container = document.getElementById('mr-times-inputs');
    container.innerHTML = '';
    const checked = Array.from(document.querySelectorAll('input[name="restoreDay"]:checked'));

    if (checked.length === 0) {
      document.getElementById('mr-times-container').classList.add('hidden');
      return;
    }

    document.getElementById('mr-times-container').classList.remove('hidden');
    checked.forEach(cb => {
      const dayName = Utils.DAY_NAMES_PL[cb.value] || cb.value;
      const div = document.createElement('div');
      div.className = 'form-row';
      div.style.marginBottom = '8px';
      div.innerHTML = `
        <div class="form-group" style="flex:1">
          <label>${dayName}</label>
        </div>
        <div class="form-group" style="flex:1">
          <input type="time" id="restore-time-${cb.value}" value="14:00">
        </div>
      `;
      container.appendChild(div);
    });
  }

  function restorePatient() {
    if (!restoringPatientId) return;

    const newStartDate = document.getElementById('mr-start-date').value;
    if (!newStartDate) {
      Utils.showToast('Podaj datę rozpoczęcia', 'warning');
      return;
    }

    const sessionDays = Array.from(document.querySelectorAll('input[name="restoreDay"]:checked')).map(cb => cb.value);
    if (sessionDays.length === 0) {
      Utils.showToast('Wybierz przynajmniej jeden dzień sesji', 'warning');
      return;
    }

    const sessionTimes = {};
    sessionDays.forEach(day => {
      const input = document.getElementById(`restore-time-${day}`);
      sessionTimes[day] = input ? input.value : '14:00';
    });

    const data = App.getData();
    const patient = data.patients.find(p => p.id === restoringPatientId);
    if (!patient) return;

    patient.isArchived = false;
    patient.archivedDate = null;
    patient.sessionDays = sessionDays;
    patient.sessionTimes = sessionTimes;
    patient.sessionsPerWeek = sessionDays.length;

    const cycleNumber = patient.therapyCycles.length + 1;
    patient.therapyCycles.push({
      id: Utils.generateUUID(),
      startDate: newStartDate,
      endDate: null,
      cycleNumber
    });

    Sessions.generateSessionsForMonth(patient, new Date());

    App.saveAndRefresh();
    Utils.hideModals();
    Utils.showToast('Pacjent przywrócony', 'success');
    App.navigate('patients');
  }

  return {
    init,
    renderArchiveList,
    showRestoreModal
  };
})();
