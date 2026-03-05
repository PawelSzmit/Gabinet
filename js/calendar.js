/* ===========================================
   Calendar - daily, weekly, monthly views
   =========================================== */

const Calendar = (() => {
  let currentDate = new Date();
  let currentView = 'month';

  function init() {
    document.getElementById('cal-prev').addEventListener('click', navigatePrev);
    document.getElementById('cal-next').addEventListener('click', navigateNext);
    document.getElementById('cal-today').addEventListener('click', goToday);

    document.querySelectorAll('.calendar-view-switcher .btn-switcher').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.calendar-view-switcher .btn-switcher').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        render();
      });
    });
  }

  function navigatePrev() {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    render();
  }

  function navigateNext() {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    render();
  }

  function goToday() {
    currentDate = new Date();
    render();
  }

  function render() {
    updateLabel();
    switch (currentView) {
      case 'month': renderMonth(); break;
      case 'week': renderWeek(); break;
      case 'day': renderDay(); break;
    }
  }

  function updateLabel() {
    const label = document.getElementById('cal-current-label');
    if (currentView === 'month') {
      label.textContent = `${Utils.POLISH_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (currentView === 'week') {
      const weekDates = Utils.getWeekDates(currentDate);
      const start = weekDates[0];
      const end = weekDates[4]; // Friday
      label.textContent = `${start.getDate()}-${end.getDate()} ${Utils.POLISH_MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    } else {
      label.textContent = `${currentDate.getDate()} ${Utils.POLISH_MONTHS_GENITIVE[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  }

  function renderMonth() {
    const container = document.getElementById('calendar-container');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = Utils.getDaysInMonth(year, month);
    let firstDay = Utils.getFirstDayOfMonth(year, month);
    if (firstDay === 0) firstDay = 7; // Mon=1..Sun=7

    const today = Utils.todayISO();
    const data = App.getData();
    const sessionDaysSet = new Set();
    data.patients.filter(p => !p.isArchived).forEach(p => {
      p.sessionDays.forEach(d => sessionDaysSet.add(Utils.DAY_MAP[d]));
    });

    const weekdayLabels = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

    let html = '<div class="calendar-month">';
    html += '<div class="calendar-weekdays">';
    weekdayLabels.forEach(d => {
      html += `<div class="calendar-weekday">${d}</div>`;
    });
    html += '</div>';
    html += '<div class="calendar-days">';

    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = firstDay - 1; i > 0; i--) {
      const dayNum = prevMonthDays - i + 1;
      const dateObj = new Date(year, month - 1, dayNum);
      const dateStr = Utils.formatDateISO(dateObj);
      const sessions = Sessions.getSessionsForDate(dateStr);
      html += renderDayCell(dayNum, dateStr, sessions, true, today, sessionDaysSet, dateObj);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = Utils.formatDateISO(dateObj);
      const sessions = Sessions.getSessionsForDate(dateStr);
      html += renderDayCell(day, dateStr, sessions, false, today, sessionDaysSet, dateObj);
    }

    const totalCells = firstDay - 1 + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      const dateObj = new Date(year, month + 1, i);
      const dateStr = Utils.formatDateISO(dateObj);
      const sessions = Sessions.getSessionsForDate(dateStr);
      html += renderDayCell(i, dateStr, sessions, true, today, sessionDaysSet, dateObj);
    }

    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll('.day-session-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        Sessions.showSessionModal(chip.dataset.sessionId);
      });
    });

    container.querySelectorAll('.calendar-day').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.date;
        if (dateStr) {
          currentDate = new Date(dateStr + 'T00:00:00');
          currentView = 'day';
          document.querySelectorAll('.calendar-view-switcher .btn-switcher').forEach(b => b.classList.remove('active'));
          document.querySelector('.calendar-view-switcher .btn-switcher[data-view="day"]').classList.add('active');
          render();
        }
      });
    });
  }

  function renderDayCell(dayNum, dateStr, sessions, isOtherMonth, today, sessionDaysSet, dateObj) {
    const jsDay = dateObj.getDay();
    const isSessionDay = sessionDaysSet.has(jsDay);
    const isToday = dateStr === today;
    const classes = ['calendar-day'];
    if (isOtherMonth) classes.push('other-month');
    if (isToday) classes.push('today');
    if (isSessionDay && !isOtherMonth) classes.push('session-day');

    let sessionsHtml = '';
    if (sessions.length > 0) {
      const data = App.getData();
      sessionsHtml = '<div class="day-sessions">';
      sessions.sort((a, b) => a.time.localeCompare(b.time)).forEach(s => {
        const patient = data.patients.find(p => p.id === s.patientId);
        const name = patient ? patient.pseudonym : '?';
        const chipClass = getSessionChipClass(s);
        sessionsHtml += `<div class="day-session-chip ${chipClass}" data-session-id="${s.id}" title="${name} ${Utils.formatTime(s.time)}">${name}</div>`;
      });
      sessionsHtml += '</div>';
    }

    return `<div class="calendar-day ${classes.join(' ')}" data-date="${dateStr}">
      <div class="day-number">${dayNum}</div>
      ${sessionsHtml}
    </div>`;
  }

  function getSessionChipClass(session) {
    if (session.status === 'scheduled') return 'status-scheduled';
    if (session.status === 'completed') return 'status-completed';
    if (session.status === 'cancelled' && session.isPaymentRequired) return 'status-cancelled-paid';
    if (session.status === 'cancelled') return 'status-cancelled-unpaid';
    return '';
  }

  function renderWeek() {
    const container = document.getElementById('calendar-container');
    const weekDates = Utils.getWeekDates(currentDate);
    const weekdayDates = weekDates.slice(0, 5); // Mon-Fri only
    const today = Utils.todayISO();
    const data = App.getData();
    const settings = data.settings || {};

    const defaultWH = {
      monday:    { enabled: false, start: '08:00', end: '16:00' },
      tuesday:   { enabled: true,  start: '08:00', end: '20:00' },
      wednesday: { enabled: true,  start: '08:00', end: '20:00' },
      thursday:  { enabled: true,  start: '08:00', end: '20:00' },
      friday:    { enabled: false, start: '08:00', end: '16:00' }
    };
    const wh = settings.workingHours || defaultWH;

    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayLabels = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt'];

    // Determine global hour range from all enabled days
    let globalStart = 23, globalEnd = 0;
    dayKeys.forEach(key => {
      const cfg = wh[key];
      if (cfg && cfg.enabled) {
        const s = parseInt(cfg.start.split(':')[0]);
        const e = parseInt(cfg.end.split(':')[0]);
        if (s < globalStart) globalStart = s;
        if (e > globalEnd) globalEnd = e;
      }
    });
    if (globalStart >= globalEnd) { globalStart = 8; globalEnd = 20; }

    // Build per-day start/end hours for shading
    const dayHours = {};
    dayKeys.forEach(key => {
      const cfg = wh[key];
      if (cfg && cfg.enabled) {
        dayHours[key] = {
          start: parseInt(cfg.start.split(':')[0]),
          end: parseInt(cfg.end.split(':')[0])
        };
      } else {
        dayHours[key] = null; // day disabled
      }
    });

    let html = '<div class="calendar-week">';
    html += '<div class="week-header"><div class="week-header-cell"></div>';
    weekdayDates.forEach((d, i) => {
      const dateStr = Utils.formatDateISO(d);
      const isToday = dateStr === today;
      html += `<div class="week-header-cell${isToday ? ' today' : ''}">
        ${dayLabels[i]}
        <span class="week-date">${d.getDate()}</span>
      </div>`;
    });
    html += '</div>';

    html += '<div class="week-body">';
    for (let h = globalStart; h < globalEnd; h++) {
      const timeLabel = `${h.toString().padStart(2, '0')}:00`;
      html += `<div class="week-time-label">${timeLabel}</div>`;

      weekdayDates.forEach((d, i) => {
        const dateStr = Utils.formatDateISO(d);
        const dayKey = dayKeys[i];
        const dh = dayHours[dayKey];
        const isOutside = !dh || h < dh.start || h >= dh.end;

        const sessions = Sessions.getSessionsForDate(dateStr);
        const hourSessions = sessions.filter(s => {
          const sHour = parseInt(s.time.split(':')[0]);
          return sHour === h;
        });

        html += `<div class="week-cell${isOutside ? ' outside-hours' : ''}">`;
        hourSessions.forEach(s => {
          const patient = data.patients.find(p => p.id === s.patientId);
          const name = patient ? patient.pseudonym : '?';
          const chipClass = getSessionChipClass(s);
          html += `<div class="week-session-block ${chipClass}" data-session-id="${s.id}">${Utils.formatTime(s.time)} ${name}</div>`;
        });
        html += '</div>';
      });
    }
    html += '</div></div>';

    container.innerHTML = html;

    container.querySelectorAll('.week-session-block').forEach(block => {
      block.addEventListener('click', () => {
        Sessions.showSessionModal(block.dataset.sessionId);
      });
    });
  }

  function renderDay() {
    const container = document.getElementById('calendar-container');
    const dateStr = Utils.formatDateISO(currentDate);
    const sessions = Sessions.getSessionsForDate(dateStr);
    const data = App.getData();
    const dayName = Utils.POLISH_DAYS[currentDate.getDay()];

    let html = `<div class="calendar-day-view">`;
    html += `<div class="day-view-header">
      <h3>${dayName}</h3>
      <p>${Utils.formatDateLongPL(dateStr)}</p>
    </div>`;

    if (sessions.length === 0) {
      html += '<div class="day-empty">Brak zaplanowanych sesji</div>';
    } else {
      sessions.sort((a, b) => a.time.localeCompare(b.time));
      sessions.forEach(session => {
        const patient = data.patients.find(p => p.id === session.patientId);
        const pseudonym = patient ? patient.pseudonym : 'Nieznany';
        const statusDotClass = getStatusDotClass(session);
        const paidIcon = session.isPaid ? '<span class="paid-icon">&#10003;</span>' : '';

        let numberStr = '';
        if (session.sessionNumber) {
          numberStr = `sesja nr ${session.cycleSessionNumber}`;
          if (patient && patient.therapyCycles && patient.therapyCycles.length > 1 && session.globalSessionNumber) {
            numberStr += ` (#${session.globalSessionNumber})`;
          }
        }

        html += `
          <div class="day-session-item" data-session-id="${session.id}">
            <div class="day-session-time">${Utils.formatTime(session.time)}</div>
            <div class="day-session-info">
              <div class="day-session-name">${Utils.escapeHtml(pseudonym)}</div>
              <div class="day-session-details">${numberStr} ${Utils.getStatusLabel(session.status)}</div>
            </div>
            <div class="day-session-status">
              <span class="status-dot ${statusDotClass}"></span>
              ${paidIcon}
            </div>
          </div>
        `;
      });
    }

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.day-session-item').forEach(item => {
      item.addEventListener('click', () => {
        Sessions.showSessionModal(item.dataset.sessionId);
      });
    });
  }

  function getStatusDotClass(session) {
    if (session.status === 'scheduled') return 'scheduled';
    if (session.status === 'completed') return 'completed';
    if (session.status === 'cancelled' && session.isPaymentRequired) return 'cancelled-paid';
    if (session.status === 'cancelled') return 'cancelled-unpaid';
    return '';
  }

  return { init, render };
})();
