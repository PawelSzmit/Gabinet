/* ===========================================
   Finance - dashboard, Chart.js, statistics
   =========================================== */

const Finance = (() => {
  let revenueChart = null;

  function init() {
    document.querySelectorAll('#view-finance .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#view-finance .tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#view-finance .tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'fin-dashboard') renderDashboard();
        if (tab.dataset.tab === 'fin-payments') Payments.renderPaymentsList();
      });
    });

    document.querySelectorAll('.chart-period-selector .btn-switcher').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-period-selector .btn-switcher').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderRevenueChart(parseInt(btn.dataset.period));
      });
    });
  }

  function renderDashboard() {
    const data = App.getData();
    const now = new Date();
    const currentMonthKey = Utils.getMonthKey(now);
    const currentYear = now.getFullYear();

    const monthSessions = data.sessions.filter(s => Utils.getMonthKey(new Date(s.date + 'T00:00:00')) === currentMonthKey);
    const completedThisMonth = monthSessions.filter(s => s.status === 'completed').length;
    const scheduledThisMonth = monthSessions.filter(s => s.status === 'scheduled').length;
    const totalThisMonth = monthSessions.length;

    const monthPayments = data.payments.filter(p => Utils.getMonthKey(new Date(p.date + 'T00:00:00')) === currentMonthKey);
    const receivedThisMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    const unpaidThisMonth = monthSessions.filter(s =>
      !s.isPaid && (s.status === 'completed' || (s.status === 'cancelled' && s.isPaymentRequired))
    );
    const unpaidCount = unpaidThisMonth.length;
    const toReceive = unpaidThisMonth.reduce((sum, s) => {
      const patient = data.patients.find(p => p.id === s.patientId);
      return sum + (patient ? patient.sessionRate : 0);
    }, 0);

    const yearPayments = data.payments.filter(p => p.date.startsWith(currentYear.toString()));
    const yearlyRevenue = yearPayments.reduce((sum, p) => sum + p.amount, 0);
    const monthsElapsed = now.getMonth() + 1;
    const monthlyAvg = monthsElapsed > 0 ? yearlyRevenue / monthsElapsed : 0;

    const statsHtml = `
      <div class="stat-card">
        <div class="stat-value">${totalThisMonth}</div>
        <div class="stat-label">Sesje (miesiąc)</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${completedThisMonth}</div>
        <div class="stat-label">Odbyte</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${scheduledThisMonth}</div>
        <div class="stat-label">Zaplanowane</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${Utils.formatCurrency(receivedThisMonth)}</div>
        <div class="stat-label">Przychód otrzymany</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${Utils.formatCurrency(toReceive)}</div>
        <div class="stat-label">Do otrzymania</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">${unpaidCount}</div>
        <div class="stat-label">Nieopłacone</div>
      </div>
    `;

    document.getElementById('finance-stats').innerHTML = statsHtml;

    const aliorMonth = monthPayments.filter(p => p.method === 'aliorBank').reduce((s, p) => s + p.amount, 0);
    const ingMonth = monthPayments.filter(p => p.method === 'ingBank').reduce((s, p) => s + p.amount, 0);
    const cashMonth = monthPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);

    const totalSlots = calculateTotalSlots();
    const usedSlots = completedThisMonth + scheduledThisMonth;
    const utilization = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

    const dayBreakdown = calculateDayBreakdown(data, currentMonthKey);

    const extraStatsHtml = `
      <div class="stat-card">
        <div class="stat-value">${Utils.formatCurrency(yearlyRevenue)}</div>
        <div class="stat-label">Roczny przychód</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Utils.formatCurrency(Math.round(monthlyAvg))}</div>
        <div class="stat-label">Średnia miesięczna</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${utilization}%</div>
        <div class="stat-label">Wykorzystanie terminów</div>
      </div>
      <div class="stat-card" style="grid-column: 1 / -1;">
        <div class="stat-label" style="margin-bottom:8px">Przychody wg metody (bieżący miesiąc)</div>
        <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px;">
          <span style="color:var(--alior);font-weight:600">Alior: ${Utils.formatCurrency(aliorMonth)}</span>
          <span style="color:var(--ing);font-weight:600">ING: ${Utils.formatCurrency(ingMonth)}</span>
          <span style="color:var(--cash);font-weight:600">Gotówka: ${Utils.formatCurrency(cashMonth)}</span>
        </div>
      </div>
      <div class="stat-card" style="grid-column: 1 / -1;">
        <div class="stat-label" style="margin-bottom:8px">Wykorzystanie wg dnia</div>
        <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px;">
          ${dayBreakdown}
        </div>
      </div>
    `;

    document.getElementById('finance-extra-stats').innerHTML = extraStatsHtml;

    const activePeriod = parseInt(document.querySelector('.chart-period-selector .btn-switcher.active').dataset.period);
    renderRevenueChart(activePeriod);
  }

  function getWorkingHours() {
    const data = App.getData();
    const defaults = {
      monday:    { enabled: false, start: '08:00', end: '16:00' },
      tuesday:   { enabled: true,  start: '08:00', end: '20:00' },
      wednesday: { enabled: true,  start: '08:00', end: '20:00' },
      thursday:  { enabled: true,  start: '08:00', end: '20:00' },
      friday:    { enabled: false, start: '08:00', end: '16:00' }
    };
    return (data && data.settings && data.settings.workingHours) ? data.settings.workingHours : defaults;
  }

  function getSlotsForDay(dayConfig) {
    if (!dayConfig || !dayConfig.enabled) return 0;
    const [sh, sm] = dayConfig.start.split(':').map(Number);
    const [eh, em] = dayConfig.end.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    return Math.max(0, Math.floor((endMinutes - startMinutes) / 60));
  }

  function calculateTotalSlots() {
    const wh = getWorkingHours();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = Utils.getDaysInMonth(year, month);
    const data = App.getData();

    let total = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = Utils.formatDateISO(new Date(year, month, day));
      const dow = Utils.getDayOfWeek(dateStr);
      const cfg = wh[dow];
      if (!cfg || !cfg.enabled) continue;

      const isBlocked = data.blockedPeriods && data.blockedPeriods.some(bp =>
        Utils.isDateInRange(dateStr, bp.startDate, bp.endDate)
      );
      if (isBlocked) continue;

      total += getSlotsForDay(cfg);
    }
    return total || 1;
  }

  function calculateDayBreakdown(data, monthKey) {
    const wh = getWorkingHours();
    const dayLabels = {
      monday: 'Pn', tuesday: 'Wt', wednesday: 'Śr',
      thursday: 'Cz', friday: 'Pt'
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = Utils.getDaysInMonth(year, month);

    const daySlotsTotal = {};
    const daySessionsCount = {};

    Object.keys(dayLabels).forEach(d => {
      daySlotsTotal[d] = 0;
      daySessionsCount[d] = 0;
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = Utils.formatDateISO(new Date(year, month, day));
      const dow = Utils.getDayOfWeek(dateStr);
      const cfg = wh[dow];
      if (!cfg || !cfg.enabled) continue;

      const isBlocked = data.blockedPeriods && data.blockedPeriods.some(bp =>
        Utils.isDateInRange(dateStr, bp.startDate, bp.endDate)
      );
      if (isBlocked) continue;

      daySlotsTotal[dow] = (daySlotsTotal[dow] || 0) + getSlotsForDay(cfg);
    }

    data.sessions
      .filter(s => Utils.getMonthKey(new Date(s.date + 'T00:00:00')) === monthKey)
      .filter(s => s.status === 'completed' || s.status === 'scheduled')
      .forEach(s => {
        const dow = Utils.getDayOfWeek(s.date);
        if (daySessionsCount[dow] !== undefined) {
          daySessionsCount[dow]++;
        }
      });

    return Object.entries(dayLabels)
      .filter(([key]) => wh[key] && wh[key].enabled)
      .map(([key, label]) => {
        const slots = daySlotsTotal[key] || 0;
        const sessions = daySessionsCount[key] || 0;
        const pct = slots > 0 ? Math.round((sessions / slots) * 100) : 0;
        return `<span>${label}: ${sessions}/${slots} (${pct}%)</span>`;
      }).join('');
  }

  function renderRevenueChart(months) {
    const data = App.getData();
    const now = new Date();
    const labels = [];
    const aliorData = [];
    const ingData = [];
    const cashData = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = Utils.getMonthKey(d);
      labels.push(Utils.POLISH_MONTHS[d.getMonth()].substring(0, 3));

      const monthPayments = data.payments.filter(p => Utils.getMonthKey(new Date(p.date + 'T00:00:00')) === key);
      aliorData.push(monthPayments.filter(p => p.method === 'aliorBank').reduce((s, p) => s + p.amount, 0));
      ingData.push(monthPayments.filter(p => p.method === 'ingBank').reduce((s, p) => s + p.amount, 0));
      cashData.push(monthPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0));
    }

    const ctx = document.getElementById('revenue-chart');
    if (revenueChart) {
      revenueChart.destroy();
    }

    revenueChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Alior Bank',
            data: aliorData,
            backgroundColor: 'rgba(204, 0, 0, 0.7)',
            borderColor: '#CC0000',
            borderWidth: 1
          },
          {
            label: 'ING Bank',
            data: ingData,
            backgroundColor: 'rgba(255, 102, 0, 0.7)',
            borderColor: '#FF6600',
            borderWidth: 1
          },
          {
            label: 'Gotówka',
            data: cashData,
            backgroundColor: 'rgba(39, 174, 96, 0.7)',
            borderColor: '#27AE60',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${Utils.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: (val) => Utils.formatCurrency(val)
            }
          }
        }
      }
    });
  }

  return {
    init,
    renderDashboard
  };
})();
