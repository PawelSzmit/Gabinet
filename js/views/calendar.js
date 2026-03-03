// =============================================================================
// views/calendar.js -- Calendar view for Gabinet PWA
// =============================================================================

'use strict';

const CalendarViews = {
  currentDate:  new Date(),
  selectedDate: new Date(),
  viewMode:     'monthly',

  render() {
    const container = document.getElementById('view-container');
    if (!container) return;
    container.innerHTML = [
      '<div class="cal-wrapper">',
        this._renderToolbar(),
        '<div class="cal-body" id="cal-body">',
          this._renderCurrentView(),
        '</div>',
        '<div class="cal-day-sessions" id="cal-day-sessions">',
          this.renderDaySessionsList(this.selectedDate),
        '</div>',
      '</div>',
    ].join('');
    this._injectStyles();
    this.bindEvents();
  },

  _renderCurrentView() {
    if (this.viewMode === 'monthly') return this.renderMonthly();
    if (this.viewMode === 'weekly')  return this.renderWeekly();
    if (this.viewMode === 'daily')   return this.renderDaily();
    return this.renderMonthly();
  },

  _renderToolbar() {
    const mA    = this.viewMode === 'monthly' ? ' active' : '';
    const wA    = this.viewMode === 'weekly'  ? ' active' : '';
    const dA    = this.viewMode === 'daily'   ? ' active' : '';
    const title = this._getTitle();
    return (
      '<div class="cal-toolbar">'
      + '<div class="cal-toolbar-left">'
        + '<button class="cal-btn cal-btn-today" id="btn-today">Dziś</button>'
        + '<div class="cal-nav">'
          + '<button class="cal-btn cal-btn-icon" id="btn-prev">‹</button>'
          + '<span class="cal-title" id="cal-title">' + title + '</span>'
          + '<button class="cal-btn cal-btn-icon" id="btn-next">›</button>'
        + '</div>'
      + '</div>'
      + '<div class="cal-toolbar-right">'
        + '<div class="cal-segment" id="cal-segment">'
          + '<button class="cal-seg-btn' + mA + '" data-view="monthly">Miesiąc</button>'
          + '<button class="cal-seg-btn' + wA + '" data-view="weekly">Tydzień</button>'
          + '<button class="cal-seg-btn' + dA + '" data-view="daily">Dzień</button>'
        + '</div>'
        + '<div class="cal-add-menu-wrap" id="cal-add-menu-wrap">'
          + '<button class="cal-btn cal-btn-add" id="btn-add-menu">+</button>'
          + '<div class="cal-add-menu hidden" id="cal-add-menu">'
            + '<button class="cal-add-menu-item" id="btn-add-session">Dodaj sesję</button>'
            + '<button class="cal-add-menu-item" id="btn-block-period">Zablokuj termin</button>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '</div>'
    );
  },

  _getTitle() {
    if (this.viewMode === 'monthly') return formatMonthYear(this.currentDate);
    if (this.viewMode === 'weekly') {
      const mon  = this._getWeekStart(this.currentDate);
      const sun  = addDays(mon, 6);
      const mStr = mon.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
      const sStr = sun.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
      return mStr + ' – ' + sStr;
    }
    if (this.viewMode === 'daily') return formatDateWithWeekday(this.currentDate);
    return '';
  },

  renderMonthly() {
    const year  = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const today = new Date();
    const monthSessions = getSessionsForMonth(year, month);
    const sessionMap    = {};
    for (const s of monthSessions) {
      const d   = new Date(s.date);
      const key = d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
      if (!sessionMap[key]) sessionMap[key] = [];
      sessionMap[key].push(s);
    }
    const firstDay        = new Date(year, month, 1);
    const firstISOWeekday = getISOWeekday(firstDay);
    const daysInMonth     = getDaysInMonth(year, month);
    const prevMonth       = month === 0 ? 11 : month - 1;
    const prevYear        = month === 0 ? year - 1 : year;
    const prevDays        = getDaysInMonth(prevYear, prevMonth);
    const HEADERS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
    let cells = '';
    for (let i = firstISOWeekday - 1; i > 0; i--) {
      cells += '<div class="cal-cell cal-cell-other"><span class="cal-day-num">'
        + (prevDays - i + 1) + '</span></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const key = year + '-'
        + String(month + 1).padStart(2, '0') + '-'
        + String(d).padStart(2, '0');
      const sessions  = sessionMap[key] || [];
      const isToday    = isSameDay(cellDate, today);
      const isSelected = isSameDay(cellDate, this.selectedDate);
      const isWeekend  = getISOWeekday(cellDate) >= 6;
      const isBlocked  = this._isDateBlocked(cellDate);
      const classes = ['cal-cell',
        isToday    ? 'cal-cell-today'    : '',
        isSelected ? 'cal-cell-selected' : '',
        isWeekend  ? 'cal-cell-weekend'  : '',
        isBlocked  ? 'cal-cell-blocked'  : '',
      ].filter(Boolean).join(' ');
      const dots = sessions.slice(0, 4).map(s =>
        '<span class="cal-dot" style="background:' + this._sessionColor(s) + '"></span>'
      ).join('');
      const extra = sessions.length > 4
        ? '<span class="cal-dot-more">+' + (sessions.length - 4) + '</span>' : '';
      cells += '<div class="' + classes + '" data-date="' + key
        + '" role="button" tabindex="0">'
        + '<span class="cal-day-num">' + d + '</span>'
        + (isBlocked ? '<span class="cal-blocked-icon">✕</span>' : '')
        + '<div class="cal-dots">' + dots + extra + '</div>'
        + '</div>';
    }
    const filled = (firstISOWeekday - 1) + daysInMonth;
    const rem    = filled % 7;
    if (rem !== 0) {
      for (let i = 1; i <= 7 - rem; i++) {
        cells += '<div class="cal-cell cal-cell-other"><span class="cal-day-num">' + i + '</span></div>';
      }
    }
    const headerHtml = HEADERS.map(h => '<div class="cal-header-cell">' + h + '</div>').join('');
    return '<div class="cal-monthly">'
      + '<div class="cal-grid-headers">' + headerHtml + '</div>'
      + '<div class="cal-grid" id="cal-grid">' + cells + '</div>'
      + '</div>';
  },

  renderWeekly() {
    const monday = this._getWeekStart(this.currentDate);
    const today  = new Date();
    const HOURS  = this._workingHours();
    let headerHtml = '<div class="cal-week-time-col"></div>';
    let colsHtml   = '';
    for (let i = 0; i < 7; i++) {
      const day        = addDays(monday, i);
      const isToday    = isSameDay(day, today);
      const isSelected = isSameDay(day, this.selectedDate);
      const dayKey     = this._dateKey(day);
      const sessions   = getSessionsByDate(dayKey);
      const dLabel     = day.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' });
      const hClass     = 'cal-week-header-cell'
        + (isToday    ? ' today'    : '')
        + (isSelected ? ' selected' : '');
      headerHtml += '<div class="' + hClass + '" data-date="' + dayKey
        + '" role="button" tabindex="0">' + dLabel + '</div>';
      let slots = '';
      for (const hour of HOURS) {
        const hourSessions = sessions.filter(s => new Date(s.date).getHours() === hour);
        const evHtml = hourSessions.map(s => {
          const patient = getPatient(s.patientId);
          const name    = patient ? (patient.pseudonym || patient.firstName) : 'Pacjent';
          const color   = this._sessionColor(s);
          return '<div class="cal-week-event" style="background:' + color
            + '20;border-left:3px solid ' + color + '" data-session-id="' + s.id + '" role="button">'
            + '<span class="cal-week-event-time">' + formatTime(new Date(s.date)) + '</span>'
            + '<span class="cal-week-event-name">' + name + '</span>'
            + '</div>';
        }).join('');
        slots += '<div class="cal-week-slot" data-hour="' + hour
          + '" data-date="' + dayKey + '">' + evHtml + '</div>';
      }
      colsHtml += '<div class="cal-week-day-col' + (isToday ? ' today' : '') + '">' + slots + '</div>';
    }
    const timeLabels = HOURS.map(h =>
      '<div class="cal-week-time-label">' + String(h).padStart(2, '0') + ':00</div>'
    ).join('');
    return '<div class="cal-weekly">'
      + '<div class="cal-week-header">' + headerHtml + '</div>'
      + '<div class="cal-week-body">'
        + '<div class="cal-week-time-col">' + timeLabels + '</div>'
        + colsHtml
      + '</div></div>';
  },

  renderDaily() {
    const day       = this.currentDate;
    const today     = new Date();
    const dayKey    = this._dateKey(day);
    const sessions  = getSessionsByDate(dayKey);
    const HOURS     = this._workingHours();
    const isBlocked = this._isDateBlocked(day);
    const dLabel    = formatDateWithWeekday(day);
    const isToday   = isSameDay(day, today);
    let slots = '';
    for (const hour of HOURS) {
      const hourSessions = sessions.filter(s => new Date(s.date).getHours() === hour);
      const evHtml = hourSessions.map(s => {
        const patient = getPatient(s.patientId);
        const name    = patient
          ? (patient.pseudonym || (patient.firstName + ' ' + patient.lastName))
          : 'Nieznany pacjent';
        const color   = this._sessionColor(s);
        const badge   = this._statusBadge(s.status);
        return '<div class="cal-daily-event" style="border-left:4px solid ' + color
          + ';background:' + color + '15" data-session-id="' + s.id + '" role="button">'
          + '<div class="cal-daily-event-header">'
            + '<span class="cal-daily-event-time">' + formatTime(new Date(s.date)) + '</span>'
            + badge
          + '</div>'
          + '<div class="cal-daily-event-name">' + name + '</div>'
          + (s.wasRescheduled ? '<div class="cal-daily-event-flag">Przełożona</div>' : '')
          + '</div>';
      }).join('');
      slots += '<div class="cal-daily-row" data-hour="' + hour + '">'
        + '<div class="cal-daily-time">' + String(hour).padStart(2, '0') + ':00</div>'
        + '<div class="cal-daily-events" data-hour="' + hour + '" data-date="' + dayKey + '">'
          + (evHtml || '<div class="cal-daily-empty"></div>')
        + '</div></div>';
    }
    return '<div class="cal-daily">'
      + '<div class="cal-daily-header' + (isToday ? ' today' : '') + '">'
        + '<span>' + dLabel + '</span>'
        + (isBlocked ? '<span class="cal-blocked-badge">Zablokowany termin</span>' : '')
      + '</div>'
      + '<div class="cal-daily-slots">' + slots + '</div>'
      + '</div>';
  },

  renderDaySessionsList(date) {
    const dayKey   = this._dateKey(date);
    const sessions = getSessionsByDate(dayKey)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const dLabel   = formatDateLong(date);
    if (sessions.length === 0) {
      return '<div class="cal-sessions-list">'
        + '<div class="cal-sessions-list-header">'
          + '<h3 class="cal-sessions-list-title">' + dLabel + '</h3>'
        + '</div>'
        + '<div class="cal-sessions-empty">Brak sesji w tym dniu</div>'
        + '</div>';
    }
    const rows = sessions.map(s => this.renderSessionRow(s)).join('');
    const totalUnpaid = sessions
      .filter(s => s.isPaymentRequired && \!s.isPaid && s.status \!== 'cancelled')
      .reduce((sum, s) => {
        const patient = getPatient(s.patientId);
        const amount  = s.paymentAmount \!== null
          ? s.paymentAmount : (patient ? patient.sessionRate : 0);
        return sum + amount;
      }, 0);
    const debtHtml = totalUnpaid > 0
      ? '<span class="cal-sessions-debt">Do zapłaty: ' + formatPLN(totalUnpaid) + '</span>' : '';
    return '<div class="cal-sessions-list">'
      + '<div class="cal-sessions-list-header">'
        + '<h3 class="cal-sessions-list-title">' + dLabel + '</h3>'
        + debtHtml
      + '</div>'
      + '<div class="cal-sessions-rows" id="cal-sessions-rows">' + rows + '</div>'
      + '</div>';
  },

  renderSessionRow(session) {
    const patient = getPatient(session.patientId);
    const name    = patient
      ? (patient.pseudonym || (patient.firstName + ' ' + patient.lastName))
      : 'Nieznany pacjent';
    const time    = formatTime(new Date(session.date));
    const color   = this._sessionColor(session);
    const badge   = this._statusBadge(session.status);
    const rate    = patient ? patient.sessionRate : 0;
    const amount  = session.paymentAmount \!== null ? session.paymentAmount : rate;
    const paidHtml = session.isPaid
      ? '<span class="cal-row-paid">Opłacona</span>'
      : (session.isPaymentRequired && session.status \!== 'cancelled'
          ? '<span class="cal-row-unpaid">' + formatPLN(amount) + '</span>'
          : '');
    const reschedFlag = session.wasRescheduled
      ? '<span class="cal-row-flag" title="Przełożona">↩</span>' : '';
    const noteFlag = session.sessionNotes && session.sessionNotes.trim()
      ? '<span class="cal-row-flag" title="Ma notatki">📝</span>' : '';
    const numLabel = session.sessionNumber
      ? '<span class="cal-row-num">#' + session.sessionNumber + '</span>' : '';
    return '<div class="cal-session-row" data-session-id="' + session.id
      + '" role="button" tabindex="0" style="border-left:3px solid ' + color + '">'
      + '<div class="cal-row-time">' + time + '</div>'
      + '<div class="cal-row-body">'
        + '<div class="cal-row-name">' + name + ' ' + numLabel + ' ' + reschedFlag + ' ' + noteFlag + '</div>'
        + '<div class="cal-row-meta">' + badge + ' ' + paidHtml + '</div>'
      + '</div>'
      + '<div class="cal-row-chevron">›</div>'
      + '</div>';
  },

  prevMonth()  { this.currentDate = addMonths(this.currentDate, -1); this._refresh(); },
  nextMonth()  { this.currentDate = addMonths(this.currentDate,  1); this._refresh(); },
  prevWeek()   { this.currentDate = addDays(this.currentDate, -7);   this._refresh(); },
  nextWeek()   { this.currentDate = addDays(this.currentDate,  7);   this._refresh(); },
  prevDay() {
    this.currentDate  = addDays(this.currentDate, -1);
    this.selectedDate = new Date(this.currentDate);
    this._refresh();
  },
  nextDay() {
    this.currentDate  = addDays(this.currentDate, 1);
    this.selectedDate = new Date(this.currentDate);
    this._refresh();
  },
  goToToday() {
    this.currentDate  = new Date();
    this.selectedDate = new Date();
    this._refresh();
  },
  selectDate(date) {
    this.selectedDate = new Date(date);
    this.currentDate  = new Date(date);
    this._refreshDayList();
    const grid = document.getElementById('cal-grid');
    if (grid) {
      grid.querySelectorAll('.cal-cell-selected').forEach(c => c.classList.remove('cal-cell-selected'));
      const key  = this._dateKey(date);
      const cell = grid.querySelector('[data-date="' + key + '"]');
      if (cell) cell.classList.add('cal-cell-selected');
    }
  },

  showAddSessionModal() {
    this._removeExistingModal('modal-add-session');
    const patients       = AppState.activePatients;
    const patientOptions = patients.map(p =>
      '<option value="' + p.id + '">'
        + (p.pseudonym || (p.firstName + ' ' + p.lastName))
        + '</option>'
    ).join('');
    const defaultDate = this._dateKey(this.selectedDate);
    const modal = document.createElement('div');
    modal.id        = 'modal-add-session';
    modal.className = 'cal-modal-overlay';
    modal.innerHTML = (
      '<div class="cal-modal-sheet" role="dialog" aria-modal="true">'
      + '<div class="cal-modal-header">'
        + '<button class="cal-modal-cancel" id="modal-add-cancel">Anuluj</button>'
        + '<h2 class="cal-modal-title">Nowa sesja</h2>'
        + '<button class="cal-modal-save" id="modal-add-save">Zapisz</button>'
      + '</div>'
      + '<div class="cal-modal-body">'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Pacjent</label>'
          + '<select class="cal-form-control" id="add-patient-select">'
            + '<option value="">Wybierz pacjenta…</option>'
            + patientOptions
          + '</select>'
        + '</div>'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Data</label>'
          + '<input class="cal-form-control" type="date" id="add-session-date" value="' + defaultDate + '">'
        + '</div>'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Godzina</label>'
          + '<input class="cal-form-control" type="time" id="add-session-time" value="10:00">'
        + '</div>'
        + '<div class="cal-form-group cal-form-row">'
          + '<label class="cal-form-label">Niestandardowa kwota</label>'
          + '<label class="cal-toggle">'
            + '<input type="checkbox" id="add-custom-amount-toggle">'
            + '<span class="cal-toggle-slider"></span>'
          + '</label>'
        + '</div>'
        + '<div class="cal-form-group hidden" id="add-custom-amount-group">'
          + '<label class="cal-form-label">Kwota (zł)</label>'
          + '<input class="cal-form-control" type="number" id="add-custom-amount" min="0" step="10" placeholder="np. 200">'
        + '</div>'
        + '<div class="cal-form-group cal-form-row">'
          + '<label class="cal-form-label">Wymagana płatność</label>'
          + '<label class="cal-toggle">'
            + '<input type="checkbox" id="add-payment-required" checked>'
            + '<span class="cal-toggle-slider"></span>'
          + '</label>'
        + '</div>'
        + '<div id="add-form-error" class="cal-form-error hidden"></div>'
      + '</div>'
      + '</div>'
    );
    document.body.appendChild(modal);
    const toggleEl    = modal.querySelector('#add-custom-amount-toggle');
    const customGroup = modal.querySelector('#add-custom-amount-group');
    toggleEl.addEventListener('change', () => {
      customGroup.classList.toggle('hidden', !toggleEl.checked);
    });
    modal.querySelector('#modal-add-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#modal-add-save').addEventListener('click', () => {
      const patientId = modal.querySelector('#add-patient-select').value;
      const dateVal   = modal.querySelector('#add-session-date').value;
      const timeVal   = modal.querySelector('#add-session-time').value;
      const errorEl   = modal.querySelector('#add-form-error');
      if (!patientId) { this._showFormError(errorEl, 'Wybierz pacjenta.'); return; }
      if (!dateVal)   { this._showFormError(errorEl, 'Podaj datę sesji.'); return; }
      if (!timeVal)   { this._showFormError(errorEl, 'Podaj godzinę sesji.'); return; }
      const tp = timeVal.split(':').map(Number);
      const dp = dateVal.split('-').map(Number);
      const sessionDate = new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0, 0);
      const isCustom    = toggleEl.checked;
      const customAmt   = isCustom ? parseFloat(modal.querySelector('#add-custom-amount').value) : null;
      const paymentReq  = modal.querySelector('#add-payment-required').checked;
      const session = createSession({
        date:              sessionDate.toISOString(),
        patientId:         patientId,
        status:            'scheduled',
        isManuallyCreated: true,
        isPaymentRequired: paymentReq,
        paymentAmount:     isCustom ? (isNaN(customAmt) ? null : customAmt) : null,
      });
      AppState.sessions.push(session);
      const patient = getPatient(patientId);
      if (patient) recalculateSessionNumbers(patient);
      if (typeof persistData === 'function') persistData();
      modal.remove();
      this.selectedDate = sessionDate;
      this.currentDate  = sessionDate;
      this._refresh();
      toast('Sesja została dodana.', 'success');
    });
  },

  showBlockPeriodModal() {
    this._removeExistingModal('modal-block-period');
    const defaultDate = this._dateKey(this.selectedDate);
    const modal = document.createElement('div');
    modal.id        = 'modal-block-period';
    modal.className = 'cal-modal-overlay';
    modal.innerHTML = (
      '<div class="cal-modal-sheet" role="dialog" aria-modal="true">'
      + '<div class="cal-modal-header">'
        + '<button class="cal-modal-cancel" id="modal-block-cancel">Anuluj</button>'
        + '<h2 class="cal-modal-title">Zablokuj termin</h2>'
        + '<button class="cal-modal-save" id="modal-block-save">Zapisz</button>'
      + '</div>'
      + '<div class="cal-modal-body">'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Data od</label>'
          + '<input class="cal-form-control" type="date" id="block-start-date" value="' + defaultDate + '">'
        + '</div>'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Data do</label>'
          + '<input class="cal-form-control" type="date" id="block-end-date" value="' + defaultDate + '">'
        + '</div>'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Powód (opcjonalny)</label>'
          + '<input class="cal-form-control" type="text" id="block-reason" placeholder="np. urlop, choroba…">'
        + '</div>'
        + '<div id="block-form-error" class="cal-form-error hidden"></div>'
      + '</div>'
      + '</div>'
    );
    document.body.appendChild(modal);
    modal.querySelector('#modal-block-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#modal-block-save').addEventListener('click', () => {
      const startVal = modal.querySelector('#block-start-date').value;
      const endVal   = modal.querySelector('#block-end-date').value;
      const reason   = modal.querySelector('#block-reason').value.trim();
      const errorEl  = modal.querySelector('#block-form-error');
      if (!startVal) { this._showFormError(errorEl, 'Podaj datę początkową.'); return; }
      if (!endVal)   { this._showFormError(errorEl, 'Podaj datę końcową.'); return; }
      const sp = startVal.split('-').map(Number);
      const ep = endVal.split('-').map(Number);
      const startDate = new Date(sp[0], sp[1] - 1, sp[2], 0, 0, 0, 0);
      const endDate   = new Date(ep[0], ep[1] - 1, ep[2], 23, 59, 59, 999);
      if (endDate < startDate) {
        this._showFormError(errorEl, 'Data końcowa musi być po dacie początkowej.');
        return;
      }
      AppState.blockedPeriods.push(createBlockedPeriod({
        startDate: startDate.toISOString(),
        endDate:   endDate.toISOString(),
        reason:    reason,
      }));
      if (typeof persistData === 'function') persistData();
      modal.remove();
      this._refresh();
      toast('Termin został zablokowany.', 'success');
    });
  },

  openSessionDetail(sessionId) {
    const session = AppState.sessions.find(s => s.id === sessionId);
    if (\!session) return;
    const patient = getPatient(session.patientId);
    if (\!patient) return;
    this._removeExistingModal('modal-session-detail');
    const name    = patient.firstName + ' ' + patient.lastName;
    const pseudo  = patient.pseudonym || '—';
    const dateStr = formatDateTimeWithWeekday(new Date(session.date));
    const badge   = this._statusBadge(session.status);
    const amount  = session.paymentAmount \!== null ? session.paymentAmount : patient.sessionRate;
    const color   = this._sessionColor(session);
    const numLabel = session.sessionNumber ? 'Sesja #' + session.sessionNumber : '';
    const paymentSection = session.isPaymentRequired
      ? ('<div class="cal-detail-section">'
          + '<h4 class="cal-detail-section-title">Płatność</h4>'
          + '<div class="cal-detail-row">'
            + '<span class="cal-detail-label">Kwota</span>'
            + '<span class="cal-detail-value">' + formatPLN(amount) + '</span>'
          + '</div>'
          + '<div class="cal-detail-row">'
            + '<span class="cal-detail-label">Status</span>'
            + '<span class="cal-detail-value ' + (session.isPaid ? 'cal-paid' : 'cal-unpaid') + '">'
              + (session.isPaid ? 'Opłacona' : 'Nieopłacona')
            + '</span>'
          + '</div>'
          + (session.isPaid && session.paymentMethod
              ? '<div class="cal-detail-row">'
                + '<span class="cal-detail-label">Metoda</span>'
                + '<span class="cal-detail-value">' + this._paymentMethodName(session.paymentMethod) + '</span>'
                + '</div>' : '')
          + (session.isPaid && session.paymentDate
              ? '<div class="cal-detail-row">'
                + '<span class="cal-detail-label">Data płatności</span>'
                + '<span class="cal-detail-value">' + formatDateMedium(new Date(session.paymentDate)) + '</span>'
                + '</div>' : '')
          + '</div>')
      : '<div class="cal-detail-section"><p class="cal-detail-muted">Płatność nie jest wymagana.</p></div>';
    const actionsSection = session.status === 'scheduled'
      ? ('<div class="cal-detail-section">'
          + '<h4 class="cal-detail-section-title">Akcje</h4>'
          + '<div class="cal-detail-actions">'
            + '<button class="cal-action-btn cal-action-complete" id="detail-btn-complete">Oznacz jako odbyła się</button>'
            + '<button class="cal-action-btn cal-action-absent" id="detail-btn-absent">Nie odbyła się</button>'
            + '<button class="cal-action-btn cal-action-reschedule" id="detail-btn-reschedule">Przełóż sesję</button>'
          + '</div>'
          + '</div>') : '';
    const reschedInfo = session.wasRescheduled && session.originalDate
      ? ('<div class="cal-detail-row cal-detail-reschedule">'
          + '<span class="cal-detail-label">Pierwotna data</span>'
          + '<span class="cal-detail-value">' + formatDateMedium(new Date(session.originalDate)) + '</span>'
          + '</div>') : '';
    const notesHtml = session.sessionNotes && session.sessionNotes.trim()
      ? '<p class="cal-detail-notes-text">' + this._escapeHtml(session.sessionNotes) + '</p>'
      : '<p class="cal-detail-muted">Brak notatek.</p>';
    const modal = document.createElement('div');
    modal.id        = 'modal-session-detail';
    modal.className = 'cal-modal-overlay';
    modal.innerHTML = (
      '<div class="cal-modal-sheet cal-modal-sheet-large" role="dialog" aria-modal="true">'
      + '<div class="cal-modal-header" style="border-left:4px solid ' + color + '">'
        + '<button class="cal-modal-cancel" id="modal-detail-close">Zamknij</button>'
        + '<h2 class="cal-modal-title">Szczegóły sesji</h2>'
        + '<div></div>'
      + '</div>'
      + '<div class="cal-modal-body">'
        + '<div class="cal-detail-section cal-detail-patient">'
          + '<div class="cal-detail-patient-name">' + name + '</div>'
          + '<div class="cal-detail-patient-pseudo">Pseudonim: ' + pseudo + '</div>'
        + '</div>'
        + '<div class="cal-detail-section">'
          + '<div class="cal-detail-row">'
            + '<span class="cal-detail-label">Data i czas</span>'
            + '<span class="cal-detail-value">' + dateStr + '</span>'
          + '</div>'
          + '<div class="cal-detail-row">'
            + '<span class="cal-detail-label">Status</span>'
            + '<span class="cal-detail-value">' + badge + '</span>'
          + '</div>'
          + (numLabel ? '<div class="cal-detail-row">'
              + '<span class="cal-detail-label">Numer</span>'
              + '<span class="cal-detail-value">' + numLabel + '</span>'
              + '</div>' : '')
          + reschedInfo
        + '</div>'
        + paymentSection
        + actionsSection
        + '<div class="cal-detail-section">'
          + '<div class="cal-detail-section-header">'
            + '<h4 class="cal-detail-section-title" style="margin-bottom:0">Notatki</h4>'
            + '<button class="cal-edit-notes-btn" id="detail-btn-edit-notes">Edytuj</button>'
          + '</div>'
          + '<div id="detail-notes-view">' + notesHtml + '</div>'
          + '<div id="detail-notes-edit" class="hidden">'
            + '<textarea class="cal-form-control cal-notes-textarea" id="detail-notes-input" rows="6" placeholder="Notatki z sesji…">'
              + this._escapeHtml(session.sessionNotes || '')
            + '</textarea>'
            + '<div class="cal-notes-edit-actions">'
              + '<button class="cal-action-btn" id="detail-notes-cancel">Anuluj</button>'
              + '<button class="cal-action-btn cal-action-complete" id="detail-notes-save">Zapisz notatki</button>'
            + '</div>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '</div>'
    );
    document.body.appendChild(modal);
    modal.querySelector('#modal-detail-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    const notesView  = modal.querySelector('#detail-notes-view');
    const notesEdit  = modal.querySelector('#detail-notes-edit');
    const notesInput = modal.querySelector('#detail-notes-input');
    modal.querySelector('#detail-btn-edit-notes').addEventListener('click', () => {
      notesView.classList.add('hidden');
      notesEdit.classList.remove('hidden');
      notesInput.focus();
    });
    modal.querySelector('#detail-notes-cancel').addEventListener('click', () => {
      notesEdit.classList.add('hidden');
      notesView.classList.remove('hidden');
    });
    modal.querySelector('#detail-notes-save').addEventListener('click', () => {
      session.sessionNotes = notesInput.value;
      if (typeof persistData === 'function') persistData();
      notesView.innerHTML = session.sessionNotes.trim()
        ? '<p class="cal-detail-notes-text">' + this._escapeHtml(session.sessionNotes) + '</p>'
        : '<p class="cal-detail-muted">Brak notatek.</p>';
      notesEdit.classList.add('hidden');
      notesView.classList.remove('hidden');
      toast('Notatki zapisane.', 'success');
    });
    const btnComplete = modal.querySelector('#detail-btn-complete');
    if (btnComplete) {
      btnComplete.addEventListener('click', () => {
        session.status = 'completed';
        if (typeof persistData === 'function') persistData();
        modal.remove();
        this._refresh();
        toast('Sesja oznaczona jako odbyta.', 'success');
      });
    }
    const btnAbsent = modal.querySelector('#detail-btn-absent');
    if (btnAbsent) btnAbsent.addEventListener('click', () => this._showAbsentDialog(session, modal));
    const btnReschedule = modal.querySelector('#detail-btn-reschedule');
    if (btnReschedule) btnReschedule.addEventListener('click', () => this._showRescheduleDialog(session, modal));
  },

  _showAbsentDialog(session, parentModal) {
    const patient = getPatient(session.patientId);
    const rate    = patient ? patient.sessionRate : 0;
    const dialog  = document.createElement('div');
    dialog.className    = 'cal-modal-overlay';
    dialog.style.zIndex = '10001';
    dialog.innerHTML = (
      '<div class="cal-modal-sheet" role="dialog" aria-modal="true">'
      + '<div class="cal-modal-header">'
        + '<button class="cal-modal-cancel" id="absent-cancel">Anuluj</button>'
        + '<h2 class="cal-modal-title">Nie odbyła się</h2>'
        + '<button class="cal-modal-save" id="absent-save">Zapisz</button>'
      + '</div>'
      + '<div class="cal-modal-body">'
        + '<p class="cal-detail-muted">Sesja zostanie oznaczona jako odwołana.</p>'
        + '<div class="cal-form-group cal-form-row">'
          + '<label class="cal-form-label">Pobierz opłatę (' + formatPLN(rate) + ')</label>'
          + '<label class="cal-toggle">'
            + '<input type="checkbox" id="absent-payment-req"' + (session.isPaymentRequired ? ' checked' : '') + '>'
            + '<span class="cal-toggle-slider"></span>'
          + '</label>'
        + '</div>'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Metoda płatności</label>'
          + '<select class="cal-form-control" id="absent-payment-method">'
            + '<option value="">Nie zapłacono jeszcze</option>'
            + '<option value="cash">Gotówka</option>'
            + '<option value="aliorBank">Alior Bank</option>'
            + '<option value="ingBank">ING Bank</option>'
          + '</select>'
        + '</div>'
      + '</div>'
      + '</div>'
    );
    document.body.appendChild(dialog);
    dialog.querySelector('#absent-cancel').addEventListener('click', () => dialog.remove());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
    dialog.querySelector('#absent-save').addEventListener('click', () => {
      const payReq = dialog.querySelector('#absent-payment-req').checked;
      const method = dialog.querySelector('#absent-payment-method').value;
      session.status            = 'cancelled';
      session.isPaymentRequired = payReq;
      if (method) {
        session.isPaid        = true;
        session.paymentMethod = method;
        session.paymentDate   = new Date().toISOString();
      }
      if (patient) recalculateSessionNumbers(patient);
      if (typeof persistData === 'function') persistData();
      dialog.remove();
      parentModal.remove();
      this._refresh();
      toast('Sesja oznaczona jako nie odbyła się.', 'info');
    });
  },

  _showRescheduleDialog(session, parentModal) {
    const currentDate = new Date(session.date);
    const defaultDate = this._dateKey(currentDate);
    const defaultTime = formatTime(currentDate);
    const dialog = document.createElement('div');
    dialog.className    = 'cal-modal-overlay';
    dialog.style.zIndex = '10001';
    dialog.innerHTML = (
      '<div class="cal-modal-sheet" role="dialog" aria-modal="true">'
      + '<div class="cal-modal-header">'
        + '<button class="cal-modal-cancel" id="reschedule-cancel">Anuluj</button>'
        + '<h2 class="cal-modal-title">Przełóż sesję</h2>'
        + '<button class="cal-modal-save" id="reschedule-save">Zapisz</button>'
      + '</div>'
      + '<div class="cal-modal-body">'
        + '<p class="cal-detail-muted">Wybierz nową datę i godzinę sesji.</p>'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Nowa data</label>'
          + '<input class="cal-form-control" type="date" id="reschedule-date" value="' + defaultDate + '">'
        + '</div>'
        + '<div class="cal-form-group">'
          + '<label class="cal-form-label">Nowa godzina</label>'
          + '<input class="cal-form-control" type="time" id="reschedule-time" value="' + defaultTime + '">'
        + '</div>'
        + '<div id="reschedule-error" class="cal-form-error hidden"></div>'
      + '</div>'
      + '</div>'
    );
    document.body.appendChild(dialog);
    dialog.querySelector('#reschedule-cancel').addEventListener('click', () => dialog.remove());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
    dialog.querySelector('#reschedule-save').addEventListener('click', () => {
      const dateVal = dialog.querySelector('#reschedule-date').value;
      const timeVal = dialog.querySelector('#reschedule-time').value;
      const errorEl = dialog.querySelector('#reschedule-error');
      if (\!dateVal) { this._showFormError(errorEl, 'Podaj nową datę.'); return; }
      if (\!timeVal) { this._showFormError(errorEl, 'Podaj nową godzinę.'); return; }
      const tp = timeVal.split(':').map(Number);
      const dp = dateVal.split('-').map(Number);
      const newDate = new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0, 0);
      session.originalDate   = session.date;
      session.wasRescheduled = true;
      session.date           = newDate.toISOString();
      if (typeof persistData === 'function') persistData();
      dialog.remove();
      parentModal.remove();
      this.selectedDate = newDate;
      this.currentDate  = newDate;
      this._refresh();
      toast('Sesja została przełożona.', 'success');
    });
  },

  bindEvents() {
    const safeClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn.bind(this));
    };
    safeClick('btn-today', this.goToToday);
    safeClick('btn-prev', () => {
      if (this.viewMode === 'monthly')     this.prevMonth();
      else if (this.viewMode === 'weekly') this.prevWeek();
      else                                 this.prevDay();
    });
    safeClick('btn-next', () => {
      if (this.viewMode === 'monthly')     this.nextMonth();
      else if (this.viewMode === 'weekly') this.nextWeek();
      else                                 this.nextDay();
    });
    const segment = document.getElementById('cal-segment');
    if (segment) {
      segment.addEventListener('click', e => {
        const btn = e.target.closest('[data-view]');
        if (!btn) return;
        this.viewMode = btn.dataset.view;
        this._refresh();
      });
    }
    const addMenuBtn = document.getElementById('btn-add-menu');
    const addMenu    = document.getElementById('cal-add-menu');
    if (addMenuBtn && addMenu) {
      addMenuBtn.addEventListener('click', e => {
        e.stopPropagation();
        addMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', () => addMenu.classList.add('hidden'), { once: true });
    }
    safeClick('btn-add-session',  this.showAddSessionModal);
    safeClick('btn-block-period', this.showBlockPeriodModal);
    const grid = document.getElementById('cal-grid');
    if (grid) {
      grid.addEventListener('click', e => {
        const cell = e.target.closest('[data-date]');
        if (!cell || cell.classList.contains('cal-cell-other')) return;
        const p = cell.dataset.date.split('-').map(Number);
        this.selectDate(new Date(p[0], p[1] - 1, p[2]));
      });
    }
    const weekHeader = document.querySelector('.cal-week-header');
    if (weekHeader) {
      weekHeader.addEventListener('click', e => {
        const cell = e.target.closest('[data-date]');
        if (!cell) return;
        const p = cell.dataset.date.split('-').map(Number);
        this.selectedDate = new Date(p[0], p[1] - 1, p[2]);
        this._refreshDayList();
        weekHeader.querySelectorAll('.selected').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
      });
    }
    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
      viewContainer.addEventListener('click', e => {
        const target = e.target.closest('[data-session-id]');
        if (!target) return;
        this.openSessionDetail(target.dataset.sessionId);
      });
    }
  },

  _refresh() {
    const body = document.getElementById('cal-body');
    if (body) body.innerHTML = this._renderCurrentView();
    const title = document.getElementById('cal-title');
    if (title) title.textContent = this._getTitle();
    const seg = document.getElementById('cal-segment');
    if (seg) {
      seg.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === this.viewMode);
      });
    }
    this._refreshDayList();
    const grid = document.getElementById('cal-grid');
    if (grid) {
      grid.addEventListener('click', e => {
        const cell = e.target.closest('[data-date]');
        if (!cell || cell.classList.contains('cal-cell-other')) return;
        const p = cell.dataset.date.split('-').map(Number);
        this.selectDate(new Date(p[0], p[1] - 1, p[2]));
      });
    }
    const weekHeader = document.querySelector('.cal-week-header');
    if (weekHeader) {
      weekHeader.addEventListener('click', e => {
        const cell = e.target.closest('[data-date]');
        if (!cell) return;
        const p = cell.dataset.date.split('-').map(Number);
        this.selectedDate = new Date(p[0], p[1] - 1, p[2]);
        this._refreshDayList();
        weekHeader.querySelectorAll('.selected').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
      });
    }
  },

  _refreshDayList() {
    const listEl = document.getElementById('cal-day-sessions');
    if (listEl) listEl.innerHTML = this.renderDaySessionsList(this.selectedDate);
  },

  _getWeekStart(date) {
    const d   = new Date(date);
    const iso = getISOWeekday(d);
    d.setDate(d.getDate() - (iso - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  },

  _workingHours() {
    const settings = AppState.settings || {};
    const startH   = parseInt((settings.workingHoursStart || '08:00').split(':')[0], 10);
    const endH     = parseInt((settings.workingHoursEnd   || '20:00').split(':')[0], 10);
    const hours    = [];
    for (let h = startH; h <= endH; h++) hours.push(h);
    return hours;
  },

  _dateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  },

  _sessionColor(session) {
    if (session.status === 'completed')                   return '#34C759';
    if (session.status === 'cancelled' && session.isPaid) return '#FF9500';
    if (session.status === 'cancelled')                   return '#FF3B30';
    return '#007AFF';
  },

  _statusBadge(status) {
    const map = {
      scheduled: { label: 'Zaplanowana', bg: '#007AFF' },
      completed: { label: 'Odbyta',      bg: '#34C759' },
      cancelled: { label: 'Odwołana',bg: '#FF3B30' },
    };
    const s = map[status] || { label: status, bg: '#8E8E93' };
    return '<span class="cal-badge" style="background:' + s.bg + '">' + s.label + '</span>';
  },

  _paymentMethodName(method) {
    const map = { aliorBank: 'Alior Bank', ingBank: 'ING Bank', cash: 'Gotówka' };
    return map[method] || method;
  },

  _isDateBlocked(date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return AppState.blockedPeriods.some(bp => {
      const s = new Date(bp.startDate); s.setHours(0, 0, 0, 0);
      const e = new Date(bp.endDate);   e.setHours(23, 59, 59, 999);
      return d >= s && d <= e;
    });
  },

  _removeExistingModal(id) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
  },

  _showFormError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  },

  _escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/
/g, '<br>');
  },

  _injectStyles() {
    if (document.getElementById('cal-styles')) return;
    const style = document.createElement('style');
    style.id = 'cal-styles';
    const rules = [
      '.cal-wrapper{display:flex;flex-direction:column;height:100%;overflow:hidden;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.cal-toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff;border-bottom:1px solid #e0e0e5;gap:8px;flex-wrap:wrap;flex-shrink:0}',
      '.cal-toolbar-left,.cal-toolbar-right{display:flex;align-items:center;gap:8px}',
      '.cal-nav{display:flex;align-items:center;gap:4px}',
      '.cal-title{font-size:.95rem;font-weight:600;min-width:140px;text-align:center;color:#1c1c1e;text-transform:capitalize}',
      '.cal-btn{border:none;border-radius:8px;padding:6px 12px;font-size:.85rem;font-weight:600;cursor:pointer;background:#e5e5ea;color:#1c1c1e;transition:background .15s}',
      '.cal-btn:hover{background:#d1d1d6}',
      '.cal-btn-today{background:#007AFF;color:#fff}.cal-btn-today:hover{background:#0062cc}',
      '.cal-btn-icon{width:32px;height:32px;padding:0;font-size:1.3rem;line-height:1;display:flex;align-items:center;justify-content:center}',
      '.cal-btn-add{width:32px;height:32px;padding:0;font-size:1.4rem;background:#007AFF;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer}',
      '.cal-btn-add:hover{background:#0062cc}',
      '.cal-segment{display:flex;background:#e5e5ea;border-radius:8px;padding:2px;gap:2px}',
      '.cal-seg-btn{border:none;background:transparent;padding:4px 10px;border-radius:6px;font-size:.8rem;font-weight:500;cursor:pointer;color:#3c3c43;transition:background .15s,color .15s}',
      '.cal-seg-btn.active{background:#fff;color:#007AFF;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}',
      '.cal-add-menu-wrap{position:relative}',
      '.cal-add-menu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);overflow:hidden;z-index:200;min-width:160px}',
      '.cal-add-menu.hidden{display:none}',
      '.cal-add-menu-item{display:block;width:100%;padding:12px 16px;border:none;background:transparent;text-align:left;font-size:.9rem;cursor:pointer;color:#1c1c1e;border-bottom:1px solid #f2f2f7}',
      '.cal-add-menu-item:last-child{border-bottom:none}.cal-add-menu-item:hover{background:#f2f2f7}',
      '.cal-body{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0}',
      '.cal-monthly{display:flex;flex-direction:column}',
      '.cal-grid-headers{display:grid;grid-template-columns:repeat(7,1fr);background:#fff;border-bottom:1px solid #e0e0e5;position:sticky;top:0;z-index:5}',
      '.cal-header-cell{text-align:center;font-size:.72rem;font-weight:600;color:#8e8e93;padding:6px 0;text-transform:uppercase;letter-spacing:.03em}',
      '.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);background:#e0e0e5;gap:1px}',
      '.cal-cell{background:#fff;min-height:56px;padding:4px 3px;cursor:pointer;position:relative;display:flex;flex-direction:column;align-items:flex-start;transition:background .12s;user-select:none}',
      '.cal-cell:active{background:#eef5ff}',
      '.cal-cell-other{background:#fafafa;opacity:.55;cursor:default;pointer-events:none}',
      '.cal-cell-weekend .cal-day-num{color:#8e8e93}',
      '.cal-cell-blocked{background:#fff5f5}.cal-cell-blocked .cal-day-num{color:#FF3B30}',
      '.cal-cell-today .cal-day-num{background:#007AFF;color:#fff!important;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700}',
      '.cal-cell-selected{background:#EBF4FF!important}',
      '.cal-cell-selected:not(.cal-cell-today) .cal-day-num{color:#007AFF;font-weight:700}',
      '.cal-day-num{font-size:.82rem;font-weight:500;color:#1c1c1e;min-width:24px;min-height:24px;display:flex;align-items:center;justify-content:center}',
      '.cal-blocked-icon{position:absolute;top:3px;right:4px;font-size:.6rem;color:#FF3B30;line-height:1}',
      '.cal-dots{display:flex;flex-wrap:wrap;gap:2px;margin-top:2px;padding:0 2px;align-items:center}',
      '.cal-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}',
      '.cal-dot-more{font-size:.58rem;color:#8e8e93;line-height:1}',
      '.cal-weekly{display:flex;flex-direction:column;height:100%}',
      '.cal-week-header{display:grid;grid-template-columns:50px repeat(7,1fr);background:#fff;border-bottom:1px solid #e0e0e5;position:sticky;top:0;z-index:5;flex-shrink:0}',
      '.cal-week-header .cal-week-time-col{border-right:1px solid #e0e0e5}',
      '.cal-week-header-cell{text-align:center;font-size:.75rem;font-weight:500;color:#3c3c43;padding:7px 2px;cursor:pointer;border-right:1px solid #f2f2f7;user-select:none}',
      '.cal-week-header-cell.today{color:#007AFF;font-weight:700}.cal-week-header-cell.selected{background:#EBF4FF}',
      '.cal-week-body{display:grid;grid-template-columns:50px repeat(7,1fr);overflow-y:auto;flex:1;min-height:0}',
      '.cal-week-time-col{border-right:1px solid #e0e0e5}',
      '.cal-week-time-label{font-size:.68rem;color:#8e8e93;padding:4px 4px 0;height:52px;border-bottom:1px solid #f2f2f7;display:flex;align-items:flex-start;box-sizing:border-box}',
      '.cal-week-day-col{border-right:1px solid #f2f2f7}.cal-week-day-col.today{background:#f0f7ff}',
      '.cal-week-slot{height:52px;border-bottom:1px solid #f2f2f7;padding:2px;overflow:hidden;box-sizing:border-box}',
      '.cal-week-event{border-radius:4px;padding:2px 4px;margin-bottom:2px;cursor:pointer;font-size:.7rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;align-items:center;gap:3px}',
      '.cal-week-event:hover{filter:brightness(.95)}',
      '.cal-week-event-time{font-weight:700;color:#1c1c1e;flex-shrink:0}',
      '.cal-week-event-name{color:#3c3c43;overflow:hidden;text-overflow:ellipsis}',
      '.cal-daily{display:flex;flex-direction:column}',
      '.cal-daily-header{background:#fff;border-bottom:1px solid #e0e0e5;padding:10px 16px;font-size:.88rem;font-weight:600;color:#1c1c1e;text-transform:capitalize;display:flex;align-items:center;gap:10px;flex-shrink:0;position:sticky;top:0;z-index:5}',
      '.cal-daily-header.today{color:#007AFF}',
      '.cal-blocked-badge{background:rgba(255,59,48,.08);color:#FF3B30;border:1px solid rgba(255,59,48,.25);border-radius:6px;padding:2px 8px;font-size:.72rem;font-weight:500}',
      '.cal-daily-slots{overflow-y:auto}',
      '.cal-daily-row{display:grid;grid-template-columns:50px 1fr;border-bottom:1px solid #f2f2f7;min-height:52px;align-items:stretch}',
      '.cal-daily-time{font-size:.68rem;color:#8e8e93;padding:6px 4px 0 8px;border-right:1px solid #e0e0e5;align-self:flex-start}',
      '.cal-daily-events{padding:4px 8px;display:flex;flex-direction:column;gap:4px;min-height:52px}',
      '.cal-daily-empty{min-height:44px}',
      '.cal-daily-event{border-radius:8px;padding:7px 10px;cursor:pointer;transition:opacity .12s}',
      '.cal-daily-event:hover{opacity:.82}',
      '.cal-daily-event-header{display:flex;align-items:center;gap:8px;margin-bottom:3px}',
      '.cal-daily-event-time{font-size:.78rem;font-weight:700;color:#1c1c1e}',
      '.cal-daily-event-name{font-size:.85rem;color:#1c1c1e;font-weight:500}',
      '.cal-daily-event-flag{font-size:.72rem;color:#FF9500;margin-top:2px}',
      '.cal-day-sessions{border-top:1px solid #e0e0e5;background:#fff;flex-shrink:0;max-height:42vh;overflow-y:auto}',
      '.cal-sessions-list{padding-bottom:8px}',
      '.cal-sessions-list-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 6px;border-bottom:1px solid #f2f2f7;position:sticky;top:0;background:#fff;z-index:2}',
      '.cal-sessions-list-title{font-size:.88rem;font-weight:600;color:#1c1c1e;margin:0;text-transform:capitalize}',
      '.cal-sessions-debt{font-size:.75rem;color:#FF3B30;font-weight:600}',
      '.cal-sessions-empty{padding:18px 16px;text-align:center;color:#8e8e93;font-size:.85rem}',
      '.cal-session-row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f2f2f7;cursor:pointer;transition:background .1s}',
      '.cal-session-row:last-child{border-bottom:none}.cal-session-row:hover{background:#f5f5f7}',
      '.cal-row-time{font-size:.85rem;font-weight:700;color:#1c1c1e;min-width:40px;flex-shrink:0}',
      '.cal-row-body{flex:1;min-width:0}',
      '.cal-row-name{font-size:.88rem;color:#1c1c1e;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px}',
      '.cal-row-meta{display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap}',
      '.cal-row-num{font-size:.72rem;color:#8e8e93}',
      '.cal-row-flag{font-size:.8rem}',
      '.cal-row-paid{font-size:.72rem;color:#34C759;font-weight:600}',
      '.cal-row-unpaid{font-size:.72rem;color:#FF3B30;font-weight:600}',
      '.cal-row-chevron{color:#c7c7cc;font-size:1.1rem;flex-shrink:0}',
      '.cal-badge{display:inline-block;color:#fff;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:10px;vertical-align:middle}',
      '.cal-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9000;display:flex;align-items:flex-end;justify-content:center}',
      '.cal-modal-sheet{background:#f2f2f7;border-radius:16px 16px 0 0;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;animation:calSlideUp .28s cubic-bezier(.32,.72,0,1)}',
      '.cal-modal-sheet-large{max-height:96vh}',
      '@keyframes calSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.cal-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#fff;border-bottom:1px solid #e0e0e5;position:sticky;top:0;z-index:1}',
      '.cal-modal-title{font-size:.95rem;font-weight:700;color:#1c1c1e;margin:0}',
      '.cal-modal-cancel{border:none;background:transparent;color:#007AFF;font-size:.9rem;cursor:pointer;padding:0;min-width:48px}',
      '.cal-modal-save{border:none;background:transparent;color:#007AFF;font-size:.9rem;font-weight:700;cursor:pointer;padding:0;min-width:48px;text-align:right}',
      '.cal-modal-body{padding:16px;display:flex;flex-direction:column;gap:0}',
      '.cal-form-group{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}',
      '.cal-form-row{flex-direction:row;align-items:center;justify-content:space-between}',
      '.cal-form-label{font-size:.75rem;font-weight:600;color:#8e8e93;text-transform:uppercase;letter-spacing:.03em}',
      '.cal-form-control{border:1px solid #d1d1d6;border-radius:10px;padding:10px 12px;font-size:.9rem;background:#fff;color:#1c1c1e;outline:none;width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none}',
      '.cal-form-control:focus{border-color:#007AFF;box-shadow:0 0 0 3px rgba(0,122,255,.15)}',
      '.cal-form-error{color:#FF3B30;font-size:.82rem;padding:4px 0;font-weight:500}',
      '.cal-form-error.hidden{display:none}',
      '.cal-notes-textarea{resize:vertical;min-height:100px}',
      '.cal-notes-edit-actions{display:flex;gap:8px;margin-top:8px;justify-content:flex-end}',
      '.cal-toggle{position:relative;display:inline-flex;align-items:center;cursor:pointer}',
      '.cal-toggle input{opacity:0;width:0;height:0;position:absolute}',
      '.cal-toggle-slider{width:44px;height:26px;background:#ccc;border-radius:13px;position:relative;transition:background .2s;flex-shrink:0}',
      '.cal-toggle-slider::before{content:"";position:absolute;width:22px;height:22px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
      '.cal-toggle input:checked + .cal-toggle-slider{background:#34C759}',
      '.cal-toggle input:checked + .cal-toggle-slider::before{transform:translateX(18px)}',
      '.cal-detail-section{background:#fff;border-radius:12px;padding:12px 16px;margin-bottom:12px}',
      '.cal-detail-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
      '.cal-detail-section-title{font-size:.72rem;font-weight:700;color:#8e8e93;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px}',
      '.cal-detail-row{display:flex;align-items:flex-start;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f2f2f7;gap:12px}',
      '.cal-detail-row:last-child{border-bottom:none}',
      '.cal-detail-label{font-size:.85rem;color:#8e8e93;flex-shrink:0}',
      '.cal-detail-value{font-size:.85rem;color:#1c1c1e;font-weight:500;text-align:right}',
      '.cal-detail-reschedule .cal-detail-label{color:#FF9500}',
      '.cal-detail-patient{text-align:center;padding:18px 16px}',
      '.cal-detail-patient-name{font-size:1.1rem;font-weight:700;color:#1c1c1e}',
      '.cal-detail-patient-pseudo{font-size:.85rem;color:#8e8e93;margin-top:4px}',
      '.cal-detail-muted{font-size:.85rem;color:#8e8e93;margin:4px 0 0}',
      '.cal-detail-notes-text{font-size:.88rem;color:#1c1c1e;line-height:1.55;margin:4px 0 0}',
      '.cal-paid{color:#34C759!important}.cal-unpaid{color:#FF3B30!important}',
      '.cal-detail-actions{display:flex;flex-direction:column;gap:8px}',
      '.cal-action-btn{border:none;border-radius:10px;padding:12px;font-size:.9rem;font-weight:600;cursor:pointer;text-align:center;background:#e5e5ea;color:#1c1c1e;transition:opacity .15s}',
      '.cal-action-btn:hover{opacity:.78}',
      '.cal-action-complete{background:#34C759;color:#fff}',
      '.cal-action-absent{background:#FF3B30;color:#fff}',
      '.cal-action-reschedule{background:#FF9500;color:#fff}',
      '.cal-edit-notes-btn{border:none;background:transparent;color:#007AFF;font-size:.85rem;font-weight:600;cursor:pointer;padding:0}',
      '.hidden{display:none!important}',
    ];
    style.textContent = rules.join('
');
    document.head.appendChild(style);
  },
};
