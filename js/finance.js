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

    const activePatients = data.patients.filter(p => !p.isArchived);
    const totalSlots = calculateTotalSlots(activePatients);
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

  function calculateTotalSlots(patients) {
    let total = 0;
    const now = new Date();
    const daysInMonth = Utils.getDaysInMonth(now.getFullYear(), now.getMonth());

    patients.forEach(p => {
      const weeklySlots = p.sessionDays.length;
      total += Math.floor(daysInMonth / 7) * weeklySlots;
    });
    return total || 1;
  }

  function calculateDayBreakdown(data, monthKey) {
    const dayNames = { tuesday: 'Wt', wednesday: 'Śr', thursday: 'Cz' };
    const counts = { tuesday: 0, wednesday: 0, thursday: 0 };
    const totals = { tuesday: 0, wednesday: 0, thursday: 0 };

    data.sessions
      .filter(s => Utils.getMonthKey(new Date(s.date + 'T00:00:00')) === monthKey)
      .forEach(s => {
        const dow = Utils.getDayOfWeek(s.date);
        if (counts[dow] !== undefined) {
          totals[dow]++;
          if (s.status === 'completed' || s.status === 'scheduled') {
            counts[dow]++;
          }
        }
      });

    return Object.entries(dayNames).map(([key, label]) => {
      const pct = totals[key] > 0 ? Math.round((counts[key] / totals[key]) * 100) : 0;
      return `<span>${label}: ${pct}%</span>`;
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
