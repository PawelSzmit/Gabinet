/* ===========================================
   Sessions - generation, numbering, statuses
   =========================================== */

const Sessions = (() => {
  let currentSessionId = null;

  function init() {
    document.querySelectorAll('input[name="sessionStatus"]').forEach(rb => {
      rb.addEventListener('change', handleStatusChange);
    });
    document.getElementById('ms-payment-required').addEventListener('change', handlePaymentRequiredChange);
    document.getElementById('ms-btn-reschedule').addEventListener('click', toggleRescheduleForm);
    document.getElementById('ms-btn-confirm-reschedule').addEventListener('click', confirmReschedule);
    document.getElementById('ms-btn-save').addEventListener('click', saveSessionChanges);
    document.getElementById('ms-payment-link').addEventListener('click', (e) => {
      e.preventDefault();
      Utils.hideModals();
      App.navigate('finance/payments');
    });
  }

  function generateSessionsForMonth(patient, monthDate) {
    const data = App.getData();
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = Utils.getDaysInMonth(year, month);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = Utils.formatDateISO(date);
      const dayOfWeek = Utils.getDayOfWeek(dateStr);

      if (!patient.sessionDays.includes(dayOfWeek)) continue;

      if (dateStr < patient.therapyStartDate) continue;

      const isOnVacation = patient.vacationPeriods && patient.vacationPeriods.some(v =>
        Utils.isDateInRange(dateStr, v.startDate, v.endDate)
      );
      if (isOnVacation) continue;

      const isBlocked = data.blockedPeriods && data.blockedPeriods.some(bp =>
        Utils.isDateInRange(dateStr, bp.startDate, bp.endDate)
      );
      if (isBlocked) continue;

      const exists = data.sessions.some(s =>
        s.patientId === patient.id && s.date === dateStr
      );
      if (exists) continue;

      const time = (patient.sessionTimes && patient.sessionTimes[dayOfWeek]) || '14:00';

      data.sessions.push({
        id: Utils.generateUUID(),
        patientId: patient.id,
        date: dateStr,
        time,
        status: 'scheduled',
        isPaymentRequired: true,
        isPaid: false,
        paymentId: null,
        sessionNumber: null,
        cycleSessionNumber: null,
        globalSessionNumber: null,
        wasRescheduled: false,
        originalDate: null,
        originalTime: null,
        notes: '',
        cancellationReason: null
      });
    }
  }

  function generateSessionsForAllPatients(monthDate) {
    const data = App.getData();
    const date = monthDate || new Date();
    data.patients.filter(p => !p.isArchived).forEach(patient => {
      generateSessionsForMonth(patient, date);
    });
  }

  function checkAndGenerateMonthlySessionsIfNeeded() {
    const currentMonth = Utils.getMonthKey(new Date());
    const lastGenMonth = localStorage.getItem('lastSessionGenMonth');

    if (lastGenMonth !== currentMonth) {
      generateSessionsForAllPatients(new Date());
      localStorage.setItem('lastSessionGenMonth', currentMonth);
      Utils.showToast(`Sesje wygenerowane na ${Utils.POLISH_MONTHS[new Date().getMonth()]}`, 'info');
    }
  }

  function assignSessionNumber(session, allSessions, patient) {
    if (session.status === 'scheduled') {
      session.sessionNumber = null;
      session.globalSessionNumber = null;
      session.cycleSessionNumber = null;
      return;
    }

    if (session.status === 'cancelled' && !session.isPaymentRequired) {
      session.sessionNumber = null;
      session.globalSessionNumber = null;
      session.cycleSessionNumber = null;
      return;
    }

    const numbered = allSessions
      .filter(s =>
        s.patientId === patient.id &&
        (s.status === 'completed' || (s.status === 'cancelled' && s.isPaymentRequired)) &&
        s.globalSessionNumber !== null &&
        s.date < session.date
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const offset = patient.sessionNumberOffset || 0;

    session.globalSessionNumber = numbered.length + 1 + offset;

    const currentCycle = patient.therapyCycles.find(c => c.endDate === null);
    const cycleStart = currentCycle ? currentCycle.startDate : patient.therapyStartDate;

    const cycleNumbered = numbered.filter(s => s.date >= cycleStart);
    session.cycleSessionNumber = cycleNumbered.length + 1 + offset;
    session.sessionNumber = session.cycleSessionNumber;
  }

  function recalculateAllSessionNumbers(patientId) {
    const data = App.getData();
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) return;

    const patientSessions = data.sessions
      .filter(s => s.patientId === patientId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    patientSessions.forEach(s => {
      s.sessionNumber = null;
      s.globalSessionNumber = null;
      s.cycleSessionNumber = null;
    });

    patientSessions.forEach(session => {
      assignSessionNumber(session, data.sessions, patient);
    });
  }

  function showSessionModal(sessionId) {
    const data = App.getData();
    const session = data.sessions.find(s => s.id === sessionId);
    if (!session) return;
    currentSessionId = sessionId;

    const patient = data.patients.find(p => p.id === session.patientId);
    const pseudonym = patient ? patient.pseudonym : 'Nieznany';

    document.getElementById('ms-date').textContent = Utils.formatDateLongPL(session.date);
    document.getElementById('ms-time').textContent = Utils.formatTime(session.time);
    document.getElementById('ms-patient').textContent = pseudonym;

    if (session.sessionNumber) {
      document.getElementById('ms-number-info').classList.remove('hidden');
      let numberStr = `Sesja nr ${session.cycleSessionNumber}`;
      if (patient && patient.therapyCycles && patient.therapyCycles.length > 1 && session.globalSessionNumber) {
        numberStr += ` (#${session.globalSessionNumber})`;
      }
      document.getElementById('ms-number').textContent = numberStr;
    } else {
      document.getElementById('ms-number-info').classList.add('hidden');
    }

    if (session.wasRescheduled && session.originalDate) {
      document.getElementById('ms-rescheduled-info').classList.remove('hidden');
      document.getElementById('ms-original-date').textContent = Utils.formatDatePL(session.originalDate);
    } else {
      document.getElementById('ms-rescheduled-info').classList.add('hidden');
    }

    document.querySelectorAll('input[name="sessionStatus"]').forEach(rb => {
      rb.checked = rb.value === session.status;
    });

    handleStatusChange();

    if (session.status === 'cancelled') {
      document.getElementById('ms-payment-required').checked = session.isPaymentRequired;
    }

    updatePaymentInfo(session);

    document.getElementById('ms-reschedule-form').classList.add('hidden');

    loadSessionNote(session);

    Utils.showModal('modal-session');
  }

  async function loadSessionNote(session) {
    const data = App.getData();
    const note = data.sessionNotes.find(n => n.sessionId === session.id);
    const textarea = document.getElementById('ms-notes');
    if (note && note.content) {
      textarea.value = await Encryption.decrypt(note.content);
    } else if (session.notes) {
      textarea.value = await Encryption.decrypt(session.notes);
    } else {
      textarea.value = '';
    }
  }

  function handleStatusChange() {
    const selected = document.querySelector('input[name="sessionStatus"]:checked');
    if (!selected) return;

    if (selected.value === 'cancelled') {
      document.getElementById('ms-cancelled-options').classList.remove('hidden');
    } else {
      document.getElementById('ms-cancelled-options').classList.add('hidden');
    }
  }

  function handlePaymentRequiredChange() {
    // No additional UI update needed
  }

  function updatePaymentInfo(session) {
    const statusEl = document.getElementById('ms-payment-status');
    const detailsEl = document.getElementById('ms-payment-details');
    const linkEl = document.getElementById('ms-payment-link');

    if (session.isPaid) {
      statusEl.innerHTML = 'Status: <span style="color:var(--success)">Opłacona &#10003;</span>';
      const data = App.getData();
      const payment = data.payments.find(p => p.id === session.paymentId);
      if (payment) {
        detailsEl.classList.remove('hidden');
        detailsEl.textContent = `${Utils.getPaymentMethodLabel(payment.method)}, ${Utils.formatDatePL(payment.date)}, ${Utils.formatCurrency(payment.amount)}`;
      }
      linkEl.classList.add('hidden');
    } else {
      statusEl.innerHTML = 'Status: <span style="color:var(--danger)">Nieopłacona &#10007;</span>';
      detailsEl.classList.add('hidden');
      linkEl.classList.remove('hidden');
    }
  }

  function toggleRescheduleForm() {
    const form = document.getElementById('ms-reschedule-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('ms-new-date').value = '';
      document.getElementById('ms-new-time').value = '';
    }
  }

  function confirmReschedule() {
    const newDate = document.getElementById('ms-new-date').value;
    const newTime = document.getElementById('ms-new-time').value;

    if (!newDate || !newTime) {
      Utils.showToast('Podaj nową datę i godzinę', 'warning');
      return;
    }

    const data = App.getData();
    const session = data.sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    session.wasRescheduled = true;
    session.originalDate = session.date;
    session.originalTime = session.time;
    session.date = newDate;
    session.time = newTime;

    recalculateAllSessionNumbers(session.patientId);
    App.saveAndRefresh();
    Utils.hideModals();
    Utils.showToast('Sesja przeniesiona', 'success');
  }

  async function saveSessionChanges() {
    const data = App.getData();
    const session = data.sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    const newStatus = document.querySelector('input[name="sessionStatus"]:checked').value;
    const oldStatus = session.status;
    session.status = newStatus;

    if (newStatus === 'cancelled') {
      session.isPaymentRequired = document.getElementById('ms-payment-required').checked;
      if (!session.isPaymentRequired) {
        session.isPaid = false;
        session.paymentId = null;
      }
    } else if (newStatus === 'completed') {
      session.isPaymentRequired = true;
    } else {
      session.isPaymentRequired = true;
      session.isPaid = false;
      session.paymentId = null;
    }

    const noteText = document.getElementById('ms-notes').value;
    if (noteText.trim()) {
      const encrypted = await Encryption.encrypt(noteText);
      session.notes = encrypted;

      const existingNote = data.sessionNotes.find(n => n.sessionId === session.id);
      if (existingNote) {
        existingNote.content = encrypted;
        existingNote.modifiedAt = new Date().toISOString();
      } else {
        data.sessionNotes.push({
          id: Utils.generateUUID(),
          patientId: session.patientId,
          sessionId: session.id,
          date: session.date,
          content: encrypted,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString()
        });
      }
    }

    recalculateAllSessionNumbers(session.patientId);
    App.saveAndRefresh();
    Utils.hideModals();
    Utils.showToast('Sesja zaktualizowana', 'success');
  }

  function getSessionsForDate(dateStr) {
    return App.getData().sessions.filter(s => s.date === dateStr);
  }

  function getSessionsForDateRange(startDate, endDate) {
    return App.getData().sessions.filter(s =>
      s.date >= startDate && s.date <= endDate
    );
  }

  return {
    init,
    generateSessionsForMonth,
    generateSessionsForAllPatients,
    checkAndGenerateMonthlySessionsIfNeeded,
    assignSessionNumber,
    recalculateAllSessionNumbers,
    showSessionModal,
    getSessionsForDate,
    getSessionsForDateRange
  };
})();
