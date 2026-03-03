/* ===========================================
   Payments - registration, editing, filtering
   =========================================== */

const Payments = (() => {
  let editingPaymentId = null;

  function init() {
    document.getElementById('btn-add-payment').addEventListener('click', () => showPaymentModal());
    document.getElementById('mp-patient').addEventListener('change', loadPatientSessions);
    document.getElementById('mp-btn-save').addEventListener('click', savePayment);
    document.getElementById('mpd-btn-delete').addEventListener('click', deletePayment);

    document.querySelectorAll('#fin-payments .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#fin-payments .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPaymentsList();
      });
    });

    document.getElementById('payments-date-from').addEventListener('change', renderPaymentsList);
    document.getElementById('payments-date-to').addEventListener('change', renderPaymentsList);
  }

  function showPaymentModal(paymentId) {
    editingPaymentId = paymentId || null;
    const data = App.getData();

    const patientSelect = document.getElementById('mp-patient');
    patientSelect.innerHTML = '<option value="">Wybierz pacjenta...</option>';
    data.patients.filter(p => !p.isArchived).forEach(p => {
      patientSelect.innerHTML += `<option value="${p.id}">${p.lastName} ${p.firstName} (${Utils.escapeHtml(p.pseudonym)})</option>`;
    });

    document.getElementById('mp-date').value = Utils.todayISO();
    document.getElementById('mp-sessions-list').innerHTML = '';
    document.getElementById('mp-count').textContent = '0';
    document.getElementById('mp-total').textContent = '0 zł';

    document.querySelectorAll('input[name="paymentMethod"]').forEach(rb => {
      rb.checked = rb.value === 'aliorBank';
    });

    if (paymentId) {
      const payment = data.payments.find(p => p.id === paymentId);
      if (payment) {
        document.getElementById('mp-title').textContent = 'Edytuj płatność';
        patientSelect.value = payment.patientId;
        document.getElementById('mp-date').value = payment.date;
        document.querySelectorAll('input[name="paymentMethod"]').forEach(rb => {
          rb.checked = rb.value === payment.method;
        });
        loadPatientSessions();
        setTimeout(() => {
          payment.sessionIds.forEach(sid => {
            const cb = document.querySelector(`#mp-sessions-list input[value="${sid}"]`);
            if (cb) cb.checked = true;
          });
          updatePaymentSummary();
        }, 100);
      }
    } else {
      document.getElementById('mp-title').textContent = 'Zarejestruj płatność';
    }

    Utils.showModal('modal-payment');
  }

  function loadPatientSessions() {
    const patientId = document.getElementById('mp-patient').value;
    const container = document.getElementById('mp-sessions-list');
    const noSessionsEl = document.getElementById('mp-no-sessions');

    if (!patientId) {
      container.innerHTML = '';
      return;
    }

    const data = App.getData();
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) return;

    const unpaidSessions = data.sessions.filter(s =>
      s.patientId === patientId &&
      !s.isPaid &&
      (s.status === 'scheduled' || s.status === 'completed' || (s.status === 'cancelled' && s.isPaymentRequired))
    ).sort((a, b) => a.date.localeCompare(b.date));

    if (unpaidSessions.length === 0) {
      container.innerHTML = '<p class="info-text">Brak sesji do opłacenia</p>';
      return;
    }

    container.innerHTML = unpaidSessions.map(s => {
      const statusLabel = Utils.getStatusLabel(s.status);
      return `
        <label>
          <input type="checkbox" value="${s.id}" data-rate="${patient.sessionRate}">
          ${Utils.formatDatePL(s.date)} ${Utils.formatTime(s.time)} - ${statusLabel}
        </label>
      `;
    }).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', updatePaymentSummary);
    });
  }

  function updatePaymentSummary() {
    const checked = document.querySelectorAll('#mp-sessions-list input[type="checkbox"]:checked');
    let total = 0;
    checked.forEach(cb => {
      total += parseFloat(cb.dataset.rate || 0);
    });
    document.getElementById('mp-count').textContent = checked.length;
    document.getElementById('mp-total').textContent = Utils.formatCurrency(total);
  }

  function savePayment() {
    const patientId = document.getElementById('mp-patient').value;
    const date = document.getElementById('mp-date').value;
    const method = document.querySelector('input[name="paymentMethod"]:checked').value;
    const checkedSessions = Array.from(document.querySelectorAll('#mp-sessions-list input[type="checkbox"]:checked'));

    if (!patientId) {
      Utils.showToast('Wybierz pacjenta', 'warning');
      return;
    }
    if (checkedSessions.length === 0) {
      Utils.showToast('Wybierz sesje do opłacenia', 'warning');
      return;
    }
    if (!date) {
      Utils.showToast('Podaj datę wpłaty', 'warning');
      return;
    }

    const data = App.getData();
    const patient = data.patients.find(p => p.id === patientId);
    const sessionIds = checkedSessions.map(cb => cb.value);
    const totalAmount = sessionIds.length * (patient ? patient.sessionRate : 0);

    if (editingPaymentId) {
      const oldPayment = data.payments.find(p => p.id === editingPaymentId);
      if (oldPayment) {
        oldPayment.sessionIds.forEach(sid => {
          const s = data.sessions.find(sess => sess.id === sid);
          if (s) {
            s.isPaid = false;
            s.paymentId = null;
          }
        });
        oldPayment.patientId = patientId;
        oldPayment.date = date;
        oldPayment.amount = totalAmount;
        oldPayment.method = method;
        oldPayment.sessionIds = sessionIds;
        oldPayment.sessionsCount = sessionIds.length;
      }
    } else {
      const payment = {
        id: Utils.generateUUID(),
        patientId,
        date,
        amount: totalAmount,
        method,
        sessionIds,
        sessionsCount: sessionIds.length,
        note: ''
      };
      data.payments.push(payment);

      sessionIds.forEach(sid => {
        const session = data.sessions.find(s => s.id === sid);
        if (session) {
          session.isPaid = true;
          session.paymentId = payment.id;
        }
      });
    }

    if (editingPaymentId) {
      sessionIds.forEach(sid => {
        const session = data.sessions.find(s => s.id === sid);
        if (session) {
          session.isPaid = true;
          session.paymentId = editingPaymentId;
        }
      });
    }

    App.saveAndRefresh();
    Utils.hideModals();
    Utils.showToast('Płatność zapisana', 'success');
  }

  function renderPaymentsList() {
    const data = App.getData();
    const activeFilter = document.querySelector('#fin-payments .filter-btn.active').dataset.filter;
    const dateFrom = document.getElementById('payments-date-from').value;
    const dateTo = document.getElementById('payments-date-to').value;

    let payments = [...data.payments];

    if (activeFilter !== 'all') {
      payments = payments.filter(p => p.method === activeFilter);
    }

    if (dateFrom) {
      payments = payments.filter(p => p.date >= dateFrom);
    }
    if (dateTo) {
      payments = payments.filter(p => p.date <= dateTo);
    }

    payments.sort((a, b) => b.date.localeCompare(a.date));

    const container = document.getElementById('payments-list');
    if (payments.length === 0) {
      container.innerHTML = '<p class="empty-state">Brak płatności</p>';
      return;
    }

    container.innerHTML = payments.map(payment => {
      const patient = data.patients.find(p => p.id === payment.patientId);
      const patientName = patient ? `${patient.lastName} ${patient.firstName}` : 'Nieznany';
      const methodLabel = Utils.getPaymentMethodLabel(payment.method);

      return `
        <div class="list-item" data-payment-id="${payment.id}">
          <div class="list-item-left">
            <span class="list-item-title">${Utils.formatDatePL(payment.date)} - ${Utils.escapeHtml(patientName)}</span>
            <span class="list-item-subtitle">${methodLabel} &middot; ${payment.sessionsCount} sesji</span>
          </div>
          <div class="list-item-right">
            <strong>${Utils.formatCurrency(payment.amount)}</strong>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        showPaymentDetail(item.dataset.paymentId);
      });
    });
  }

  function showPaymentDetail(paymentId) {
    const data = App.getData();
    const payment = data.payments.find(p => p.id === paymentId);
    if (!payment) return;

    const patient = data.patients.find(p => p.id === payment.patientId);
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Nieznany';

    const sessionsHtml = payment.sessionIds.map(sid => {
      const session = data.sessions.find(s => s.id === sid);
      if (!session) return '<li>Sesja usunięta</li>';
      return `<li>${Utils.formatDatePL(session.date)} ${Utils.formatTime(session.time)} - ${Utils.getStatusLabel(session.status)}</li>`;
    }).join('');

    document.getElementById('mpd-content').innerHTML = `
      <div class="info-card">
        <h4>Pacjent</h4>
        <span class="value">${Utils.escapeHtml(patientName)}</span>
      </div>
      <div class="info-card">
        <h4>Data wpłaty</h4>
        <span class="value">${Utils.formatDateLongPL(payment.date)}</span>
      </div>
      <div class="info-card">
        <h4>Metoda</h4>
        <span class="value">${Utils.getPaymentMethodLabel(payment.method)}</span>
      </div>
      <div class="info-card">
        <h4>Kwota</h4>
        <span class="value">${Utils.formatCurrency(payment.amount)}</span>
      </div>
      <div class="info-card">
        <h4>Sesje (${payment.sessionsCount})</h4>
        <ul style="font-size:0.85rem;padding-left:18px;margin-top:4px;">${sessionsHtml}</ul>
      </div>
    `;

    document.getElementById('mpd-btn-delete').onclick = () => deletePayment(paymentId);
    Utils.showModal('modal-payment-detail');
  }

  function deletePayment(paymentId) {
    const id = paymentId || editingPaymentId;
    if (!id) return;

    Utils.showConfirm('Usuń płatność', 'Czy na pewno chcesz usunąć tę płatność?', () => {
      const data = App.getData();
      const payment = data.payments.find(p => p.id === id);
      if (payment) {
        payment.sessionIds.forEach(sid => {
          const session = data.sessions.find(s => s.id === sid);
          if (session) {
            session.isPaid = false;
            session.paymentId = null;
          }
        });
        data.payments = data.payments.filter(p => p.id !== id);
      }
      App.saveAndRefresh();
      Utils.hideModals();
      Utils.showToast('Płatność usunięta', 'success');
    });
  }

  return {
    init,
    showPaymentModal,
    renderPaymentsList,
    showPaymentDetail
  };
})();
