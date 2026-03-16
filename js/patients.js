/* ===========================================
   Patients - CRUD, forms, lists
   =========================================== */

const Patients = (() => {
  let editingPatientId = null;

  function init() {
    document.getElementById('patient-form').addEventListener('submit', handleSavePatient);
    document.getElementById('btn-cancel-patient').addEventListener('click', () => {
      App.navigate('patients');
    });
    document.getElementById('btn-add-patient').addEventListener('click', () => {
      editingPatientId = null;
      showPatientForm();
    });
    document.getElementById('patient-search').addEventListener('input', renderPatientsList);
    document.getElementById('patient-sort').addEventListener('change', renderPatientsList);
    document.getElementById('btn-add-vacation').addEventListener('click', addVacationPeriod);

    document.querySelectorAll('input[name="sessionDay"]').forEach(cb => {
      cb.addEventListener('change', updateSessionTimeInputs);
    });
  }

  function showPatientForm(patientId) {
    editingPatientId = patientId || null;
    const form = document.getElementById('patient-form');
    form.reset();
    document.getElementById('vacation-periods-list').innerHTML = '';
    document.getElementById('session-times-inputs').innerHTML = '';
    document.getElementById('session-times-container').classList.add('hidden');

    if (patientId) {
      const patient = App.getData().patients.find(p => p.id === patientId);
      if (!patient) return;
      document.getElementById('patient-form-title').textContent = 'Edytuj pacjenta';
      document.getElementById('pf-firstName').value = patient.firstName;
      document.getElementById('pf-lastName').value = patient.lastName;
      document.getElementById('pf-pseudonym').value = patient.pseudonym;
      document.getElementById('pf-startDate').value = patient.therapyStartDate;
      document.getElementById('pf-rate').value = patient.sessionRate;
      document.getElementById('pf-startSessionNumber').value = patient.sessionNumberOffset ? patient.sessionNumberOffset + 1 : 1;

      document.querySelectorAll('input[name="sessionDay"]').forEach(cb => {
        cb.checked = patient.sessionDays.includes(cb.value);
      });

      document.querySelectorAll('input[name="sessionsPerWeek"]').forEach(rb => {
        rb.checked = parseInt(rb.value) === patient.sessionsPerWeek;
      });

      updateSessionTimeInputs();
      if (patient.sessionTimes) {
        Object.entries(patient.sessionTimes).forEach(([day, time]) => {
          const input = document.getElementById(`time-${day}`);
          if (input) input.value = time;
        });
      }

      if (patient.vacationPeriods) {
        patient.vacationPeriods.forEach(v => {
          addVacationPeriod(null, v);
        });
      }
    } else {
      document.getElementById('patient-form-title').textContent = 'Nowy pacjent';
      document.getElementById('pf-startDate').value = Utils.todayISO();
    }

    App.showView('view-patient-form');
  }

  function updateSessionTimeInputs() {
    const container = document.getElementById('session-times-inputs');
    container.innerHTML = '';
    const checked = Array.from(document.querySelectorAll('input[name="sessionDay"]:checked'));

    if (checked.length === 0) {
      document.getElementById('session-times-container').classList.add('hidden');
      return;
    }

    document.getElementById('session-times-container').classList.remove('hidden');
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
          <input type="time" id="time-${cb.value}" value="14:00">
        </div>
      `;
      container.appendChild(div);
    });
  }

  function addVacationPeriod(event, existing) {
    const list = document.getElementById('vacation-periods-list');
    const count = list.children.length;
    if (count >= 3) {
      Utils.showToast('Maksymalnie 3 okresy urlopowe', 'warning');
      return;
    }

    const item = document.createElement('div');
    item.className = 'vacation-item';
    item.innerHTML = `
      <input type="date" class="vacation-start" value="${existing ? existing.startDate : ''}">
      <span>-</span>
      <input type="date" class="vacation-end" value="${existing ? existing.endDate : ''}">
      <button type="button" class="btn-remove" title="Usuń">&times;</button>
    `;
    item.querySelector('.btn-remove').addEventListener('click', () => item.remove());
    list.appendChild(item);
  }

  function validatePatientForm() {
    let valid = true;
    const firstName = document.getElementById('pf-firstName');
    const lastName = document.getElementById('pf-lastName');
    const pseudonym = document.getElementById('pf-pseudonym');
    const startDate = document.getElementById('pf-startDate');
    const rate = document.getElementById('pf-rate');
    const daysError = document.getElementById('pf-days-error');

    [firstName, lastName, pseudonym, startDate, rate].forEach(el => {
      el.classList.remove('invalid');
      const errEl = el.nextElementSibling;
      if (errEl && errEl.classList.contains('form-error')) {
        errEl.classList.remove('visible');
      }
    });
    daysError.classList.remove('visible');

    if (!firstName.value.trim()) {
      firstName.classList.add('invalid');
      showFieldError(firstName, 'Imię jest wymagane');
      valid = false;
    }
    if (!lastName.value.trim()) {
      lastName.classList.add('invalid');
      showFieldError(lastName, 'Nazwisko jest wymagane');
      valid = false;
    }
    if (!pseudonym.value.trim()) {
      pseudonym.classList.add('invalid');
      showFieldError(pseudonym, 'Pseudonim jest wymagany');
      valid = false;
    }

    const data = App.getData();
    const existingPseudonym = data.patients.find(
      p => p.pseudonym.toLowerCase() === pseudonym.value.trim().toLowerCase() && p.id !== editingPatientId
    );
    if (existingPseudonym) {
      pseudonym.classList.add('invalid');
      showFieldError(pseudonym, 'Ten pseudonim jest już zajęty');
      valid = false;
    }

    if (!startDate.value) {
      startDate.classList.add('invalid');
      showFieldError(startDate, 'Data rozpoczęcia jest wymagana');
      valid = false;
    }

    const checkedDays = document.querySelectorAll('input[name="sessionDay"]:checked');
    if (checkedDays.length === 0) {
      daysError.textContent = 'Wybierz przynajmniej jeden dzień sesji';
      daysError.classList.add('visible');
      valid = false;
    }

    if (!rate.value || parseFloat(rate.value) <= 0) {
      rate.classList.add('invalid');
      showFieldError(rate, 'Podaj prawidłową stawkę');
      valid = false;
    }

    return valid;
  }

  function showFieldError(input, message) {
    const errEl = input.nextElementSibling;
    if (errEl && errEl.classList.contains('form-error')) {
      errEl.textContent = message;
      errEl.classList.add('visible');
    }
  }

  function handleSavePatient(e) {
    e.preventDefault();
    if (!validatePatientForm()) return;

    const data = App.getData();
    const sessionDays = Array.from(document.querySelectorAll('input[name="sessionDay"]:checked')).map(cb => cb.value);
    const sessionTimes = {};
    sessionDays.forEach(day => {
      const input = document.getElementById(`time-${day}`);
      sessionTimes[day] = input ? input.value : '14:00';
    });

    const sessionsPerWeek = parseInt(document.querySelector('input[name="sessionsPerWeek"]:checked').value);

    const vacationPeriods = Array.from(document.querySelectorAll('.vacation-item')).map(item => ({
      id: Utils.generateUUID(),
      startDate: item.querySelector('.vacation-start').value,
      endDate: item.querySelector('.vacation-end').value
    })).filter(v => v.startDate && v.endDate);

    if (editingPatientId) {
      const idx = data.patients.findIndex(p => p.id === editingPatientId);
      if (idx !== -1) {
        const patient = data.patients[idx];
        const oldDays = JSON.stringify(patient.sessionDays);
        const oldTimes = JSON.stringify(patient.sessionTimes);

        patient.firstName = document.getElementById('pf-firstName').value.trim();
        patient.lastName = document.getElementById('pf-lastName').value.trim();
        patient.pseudonym = document.getElementById('pf-pseudonym').value.trim();
        patient.therapyStartDate = document.getElementById('pf-startDate').value;
        patient.sessionDays = sessionDays;
        patient.sessionTimes = sessionTimes;
        patient.sessionsPerWeek = sessionsPerWeek;
        patient.sessionRate = parseFloat(document.getElementById('pf-rate').value);
        const editStartNum = parseInt(document.getElementById('pf-startSessionNumber').value) || 1;
        patient.sessionNumberOffset = Math.max(0, editStartNum - 1);
        patient.vacationPeriods = vacationPeriods;

        const daysChanged = oldDays !== JSON.stringify(sessionDays);
        const timesChanged = oldTimes !== JSON.stringify(sessionTimes);
        if (daysChanged || timesChanged) {
          data.sessions = data.sessions.filter(s => {
            if (s.patientId === editingPatientId && s.status === 'scheduled') {
              return false;
            }
            return true;
          });
          Sessions.generateSessionsForMonth(patient, new Date());
        }

        Sessions.recalculateAllSessionNumbers(editingPatientId);
        Utils.showToast('Pacjent zaktualizowany', 'success');
      }
    } else {
      const startSessionNum = parseInt(document.getElementById('pf-startSessionNumber').value) || 1;
      const sessionNumberOffset = Math.max(0, startSessionNum - 1);

      const newPatient = {
        id: Utils.generateUUID(),
        firstName: document.getElementById('pf-firstName').value.trim(),
        lastName: document.getElementById('pf-lastName').value.trim(),
        pseudonym: document.getElementById('pf-pseudonym').value.trim(),
        therapyStartDate: document.getElementById('pf-startDate').value,
        sessionDays,
        sessionTimes,
        sessionsPerWeek,
        sessionRate: parseFloat(document.getElementById('pf-rate').value),
        sessionNumberOffset,
        vacationPeriods,
        isArchived: false,
        archivedDate: null,
        therapyCycles: [{
          id: Utils.generateUUID(),
          startDate: document.getElementById('pf-startDate').value,
          endDate: null,
          cycleNumber: 1
        }],
        therapeuticGoals: [],
        generalNotes: ''
      };
      data.patients.push(newPatient);

      Sessions.generateSessionsForMonth(newPatient, new Date());
      Utils.showToast('Pacjent dodany', 'success');
    }

    App.saveAndRefresh();
    App.navigate('patients');
  }

  function renderPatientsList() {
    const data = App.getData();
    const searchTerm = document.getElementById('patient-search').value.toLowerCase();
    const sortBy = document.getElementById('patient-sort').value;

    let patients = data.patients.filter(p => !p.isArchived);

    if (searchTerm) {
      patients = patients.filter(p =>
        p.lastName.toLowerCase().includes(searchTerm) ||
        p.firstName.toLowerCase().includes(searchTerm) ||
        p.pseudonym.toLowerCase().includes(searchTerm)
      );
    }

    switch (sortBy) {
      case 'alpha':
        patients.sort((a, b) => a.lastName.localeCompare(b.lastName, 'pl'));
        break;
      case 'longest':
        patients.sort((a, b) => a.therapyStartDate.localeCompare(b.therapyStartDate));
        break;
      case 'shortest':
        patients.sort((a, b) => b.therapyStartDate.localeCompare(a.therapyStartDate));
        break;
    }

    const container = document.getElementById('patients-list');
    if (patients.length === 0) {
      container.innerHTML = '<p class="empty-state">Brak pacjentów</p>';
      return;
    }

    container.innerHTML = patients.map(patient => {
      const unpaidCount = getUnpaidSessionsCount(patient.id, data);
      const daysStr = patient.sessionDays.map(d => Utils.DAY_NAMES_PL[d] || d).join(', ');
      const debtBadge = unpaidCount > 0
        ? `<span class="debt-badge">${unpaidCount} nieopłac.</span>`
        : '';

      return `
        <div class="list-item" data-patient-id="${patient.id}">
          <div class="list-item-left">
            <span class="list-item-title">${Utils.escapeHtml(patient.pseudonym)}</span>
            <span class="list-item-subtitle">${Utils.escapeHtml(patient.lastName)} ${Utils.escapeHtml(patient.firstName)} &middot; ${daysStr}</span>
          </div>
          <div class="list-item-right">
            ${debtBadge}
            <div class="list-item-actions">
              <button class="btn btn-sm btn-outline btn-edit-patient" data-id="${patient.id}">Edytuj</button>
              <button class="btn btn-sm btn-warning btn-archive-trigger" data-id="${patient.id}">Arch.</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn')) return;
        const id = item.dataset.patientId;
        App.navigate(`patients/${id}`);
      });
    });

    container.querySelectorAll('.btn-edit-patient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPatientForm(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-archive-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        archivePatient(btn.dataset.id);
      });
    });
  }

  function getUnpaidSessionsCount(patientId, data) {
    return data.sessions.filter(s =>
      s.patientId === patientId &&
      !s.isPaid &&
      (s.status === 'completed' || (s.status === 'cancelled' && s.isPaymentRequired))
    ).length;
  }

  function archivePatient(patientId) {
    const data = App.getData();
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) return;

    Utils.showConfirm(
      'Archiwizuj pacjenta',
      `Czy na pewno chcesz zarchiwizować pacjenta ${patient.firstName} ${patient.lastName}?`,
      () => {
        patient.isArchived = true;
        patient.archivedDate = Utils.todayISO();
        const currentCycle = patient.therapyCycles.find(c => c.endDate === null);
        if (currentCycle) {
          currentCycle.endDate = Utils.todayISO();
        }

        data.sessions = data.sessions.filter(s => {
          if (s.patientId === patientId && s.status === 'scheduled') {
            return false;
          }
          return true;
        });

        App.saveAndRefresh();
        Utils.showToast('Pacjent zarchiwizowany', 'success');
        App.navigate('patients');
      }
    );
  }

  async function renderPatientDetail(patientId) {
    const data = App.getData();
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) {
      App.navigate('patients');
      return;
    }

    document.getElementById('pd-name').textContent = `${patient.firstName} ${patient.lastName}`;
    document.getElementById('pd-pseudonym').textContent = patient.pseudonym;

    const completedSessions = data.sessions.filter(s =>
      s.patientId === patientId && s.status === 'completed'
    ).length;
    const unpaid = getUnpaidSessionsCount(patientId, data);
    const debt = unpaid * patient.sessionRate;
    const duration = Utils.calculateTherapyDuration(patient.therapyStartDate);
    const daysStr = patient.sessionDays.map(d => Utils.DAY_NAMES_PL[d]).join(', ');

    document.getElementById('pd-info-content').innerHTML = `
      <div class="info-card">
        <h4>Data rozpoczęcia</h4>
        <span class="value">${Utils.formatDateLongPL(patient.therapyStartDate)}</span>
      </div>
      <div class="info-card">
        <h4>Czas trwania terapii</h4>
        <span class="value">${duration}</span>
      </div>
      <div class="info-card">
        <h4>Sesje tygodniowo</h4>
        <span class="value">${patient.sessionsPerWeek} (${daysStr})</span>
      </div>
      <div class="info-card">
        <h4>Stawka za sesję</h4>
        <span class="value">${Utils.formatCurrency(patient.sessionRate)}</span>
      </div>
      <div class="info-card">
        <h4>Odbyte sesje</h4>
        <span class="value">${completedSessions}</span>
      </div>
      <div class="info-card">
        <h4>Zadłużenie</h4>
        <span class="value ${debt > 0 ? 'danger' : 'success'}">${debt > 0 ? Utils.formatCurrency(debt) : 'Brak'}</span>
      </div>
    `;

    renderPatientSessions(patientId);
    await renderPatientNotes(patientId);
    await renderPatientGoals(patientId);
    await renderPatientProgress(patientId);

    document.getElementById('btn-edit-patient').onclick = () => showPatientForm(patientId);
    document.getElementById('btn-archive-patient').onclick = () => archivePatient(patientId);

    const tabs = document.querySelectorAll('#view-patient-detail .tab');
    const tabContents = document.querySelectorAll('#view-patient-detail .tab-content');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    tabs[0].click();
  }

  function renderPatientSessions(patientId) {
    const data = App.getData();
    const filterBtns = document.querySelectorAll('#pd-sessions .filter-btn');
    const container = document.getElementById('pd-sessions-list');

    function render(filter) {
      let sessions = data.sessions.filter(s => s.patientId === patientId);

      switch (filter) {
        case 'completed':
          sessions = sessions.filter(s => s.status === 'completed');
          break;
        case 'scheduled':
          sessions = sessions.filter(s => s.status === 'scheduled');
          break;
        case 'unpaid':
          sessions = sessions.filter(s =>
            !s.isPaid && (s.status === 'completed' || (s.status === 'cancelled' && s.isPaymentRequired))
          );
          break;
      }

      sessions.sort((a, b) => b.date.localeCompare(a.date));

      if (sessions.length === 0) {
        container.innerHTML = '<p class="empty-state">Brak sesji</p>';
        return;
      }

      container.innerHTML = sessions.map(session => {
        const statusClass = getSessionStatusClass(session);
        const paidIcon = session.isPaid ? ' &#10003;' : '';
        const numberStr = session.sessionNumber ? `#${session.sessionNumber}` : '';

        return `
          <div class="list-item ${statusClass}" data-session-id="${session.id}">
            <div class="list-item-left">
              <span class="list-item-title">${Utils.formatDatePL(session.date)} ${Utils.formatTime(session.time)}</span>
              <span class="list-item-subtitle">${Utils.getStatusLabel(session.status)} ${numberStr}${paidIcon}</span>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => {
          Sessions.showSessionModal(item.dataset.sessionId);
        });
      });
    }

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render(btn.dataset.filter);
      });
    });

    render('all');
  }

  async function renderPatientNotes(patientId) {
    await Notes.renderNotesList(patientId);
  }

  async function renderPatientGoals(patientId) {
    await Notes.renderGoalsList(patientId);
  }

  async function renderPatientProgress(patientId) {
    await Notes.renderProgressList(patientId);
  }

  function getSessionStatusClass(session) {
    if (session.status === 'scheduled') return 'session-scheduled';
    if (session.status === 'completed') return 'session-completed';
    if (session.status === 'cancelled' && session.isPaymentRequired) return 'session-cancelled-paid';
    if (session.status === 'cancelled') return 'session-cancelled-unpaid';
    return '';
  }

  function getActivePatients() {
    return App.getData().patients.filter(p => !p.isArchived);
  }

  return {
    init,
    showPatientForm,
    renderPatientsList,
    renderPatientDetail,
    getActivePatients,
    getUnpaidSessionsCount,
    getSessionStatusClass
  };
})();
