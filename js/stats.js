/* ===========================================
   Stats - comprehensive statistics module
   =========================================== */

const Stats = (() => {
  let sessionsChart = null;
  let paymentsChart = null;

  function init() {
    // Period preset buttons
    document.querySelectorAll('#view-stats .stats-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-stats .stats-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const months = parseInt(btn.dataset.months);
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
        document.getElementById('stats-date-from').value = Utils.formatDateISO(from);
        document.getElementById('stats-date-to').value = Utils.formatDateISO(now);
        render();
      });
    });

    // Custom date change
    document.getElementById('stats-date-from').addEventListener('change', () => {
      clearActivePreset();
      render();
    });
    document.getElementById('stats-date-to').addEventListener('change', () => {
      clearActivePreset();
      render();
    });
  }

  function clearActivePreset() {
    document.querySelectorAll('#view-stats .stats-period-btn').forEach(b => b.classList.remove('active'));
  }

  function getDateRange() {
    const fromVal = document.getElementById('stats-date-from').value;
    const toVal = document.getElementById('stats-date-to').value;
    return { from: fromVal, to: toVal };
  }

  function setDefaultRange() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    document.getElementById('stats-date-from').value = Utils.formatDateISO(from);
    document.getElementById('stats-date-to').value = Utils.formatDateISO(now);
    // Set 6-month button as active
    document.querySelectorAll('#view-stats .stats-period-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.months === '6');
    });
  }

  function render() {
    const data = App.getData();
    if (!data) return;

    const range = getDateRange();
    if (!range.from || !range.to) return;

    const sessions = data.sessions.filter(s => s.date >= range.from && s.date <= range.to);
    const payments = data.payments.filter(p => p.date >= range.from && p.date <= range.to);

    renderCards(data, sessions, payments, range);
    renderSessionsChart(data, range);
    renderPaymentsChart(data, range);
  }

  function renderCards(data, sessions, payments, range) {
    const completed = sessions.filter(s => s.status === 'completed');
    const cancelled = sessions.filter(s => s.status === 'cancelled');
    const scheduled = sessions.filter(s => s.status === 'scheduled');
    const totalSessions = completed.length + cancelled.length + scheduled.length;

    // --- Time span calculations ---
    const fromDate = new Date(range.from + 'T00:00:00');
    const toDate = new Date(range.to + 'T00:00:00');
    const diffDays = Math.max(1, Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)));
    const diffWeeks = Math.max(1, diffDays / 7);
    const diffMonths = Math.max(1, (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth()) + 1);

    // Sessions stats
    const avgPerWeek = (completed.length / diffWeeks).toFixed(1);
    const avgPerMonth = (completed.length / diffMonths).toFixed(1);

    // Payments
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const aliorTotal = payments.filter(p => p.method === 'aliorBank').reduce((s, p) => s + p.amount, 0);
    const ingTotal = payments.filter(p => p.method === 'ingBank').reduce((s, p) => s + p.amount, 0);
    const cashTotal = payments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);

    // Average payment per session
    const paidSessions = sessions.filter(s => s.isPaid);
    const paidPayments = payments.length;
    const avgPerSession = paidPayments > 0 ? totalRevenue / paidPayments : 0;

    // Average monthly income
    const avgMonthlyIncome = totalRevenue / diffMonths;

    // Cancellation rate
    const completedAndCancelled = completed.length + cancelled.length;
    const cancellationRate = completedAndCancelled > 0
      ? Math.round((cancelled.length / completedAndCancelled) * 100) : 0;

    // New patients in period
    const newPatients = data.patients.filter(p => {
      return p.therapyStartDate >= range.from && p.therapyStartDate <= range.to;
    }).length;

    // Best / worst month
    const monthlyTotals = {};
    payments.forEach(p => {
      const key = Utils.getMonthKey(new Date(p.date + 'T00:00:00'));
      monthlyTotals[key] = (monthlyTotals[key] || 0) + p.amount;
    });
    const monthKeys = Object.keys(monthlyTotals).sort();
    let bestMonth = '—', worstMonth = '—';
    if (monthKeys.length > 0) {
      let bestKey = monthKeys[0], worstKey = monthKeys[0];
      monthKeys.forEach(k => {
        if (monthlyTotals[k] > monthlyTotals[bestKey]) bestKey = k;
        if (monthlyTotals[k] < monthlyTotals[worstKey]) worstKey = k;
      });
      const formatMonthLabel = (key) => {
        const [y, m] = key.split('-');
        return `${Utils.POLISH_MONTHS[parseInt(m) - 1]} ${y}`;
      };
      bestMonth = `${formatMonthLabel(bestKey)} (${Utils.formatCurrency(monthlyTotals[bestKey])})`;
      worstMonth = `${formatMonthLabel(worstKey)} (${Utils.formatCurrency(monthlyTotals[worstKey])})`;
    }

    // Revenue trend — compare current period vs same-length previous period
    const periodLengthMs = toDate - fromDate;
    const prevFrom = new Date(fromDate.getTime() - periodLengthMs);
    const prevTo = new Date(fromDate.getTime() - 1);
    const prevFromStr = Utils.formatDateISO(prevFrom);
    const prevToStr = Utils.formatDateISO(prevTo);
    const prevPayments = data.payments.filter(p => p.date >= prevFromStr && p.date <= prevToStr);
    const prevRevenue = prevPayments.reduce((s, p) => s + p.amount, 0);

    let trendHtml = '—';
    if (prevRevenue > 0) {
      const change = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100);
      if (change > 0) {
        trendHtml = `<span style="color:var(--success)">&#9650; +${change}%</span>`;
      } else if (change < 0) {
        trendHtml = `<span style="color:var(--danger)">&#9660; ${change}%</span>`;
      } else {
        trendHtml = `<span style="color:var(--text-secondary)">&#9644; 0%</span>`;
      }
    }

    const html = `
      <div class="stats-section">
        <h3 class="stats-section-title">Sesje</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalSessions}</div>
            <div class="stat-label">Łączna liczba sesji</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">${completed.length}</div>
            <div class="stat-label">Odbyte</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgPerWeek}</div>
            <div class="stat-label">Śr. sesji / tydzień</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgPerMonth}</div>
            <div class="stat-label">Śr. sesji / miesiąc</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-value">${cancellationRate}%</div>
            <div class="stat-label">Wskaźnik odwołań</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${newPatients}</div>
            <div class="stat-label">Nowi pacjenci</div>
          </div>
        </div>
      </div>

      <div class="stats-section">
        <h3 class="stats-section-title">Przychody</h3>
        <div class="stats-grid">
          <div class="stat-card success">
            <div class="stat-value">${Utils.formatCurrency(totalRevenue)}</div>
            <div class="stat-label">Łączne wpłaty</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Utils.formatCurrency(Math.round(avgMonthlyIncome))}</div>
            <div class="stat-label">Śr. dochód / miesiąc</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Utils.formatCurrency(Math.round(avgPerSession))}</div>
            <div class="stat-label">Śr. płatność / sesję</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${trendHtml}</div>
            <div class="stat-label">Trend przychodów</div>
          </div>
          <div class="stat-card" style="grid-column: 1 / -1;">
            <div class="stat-label" style="margin-bottom:8px">Wpłaty wg źródła</div>
            <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px;">
              <span style="color:var(--alior);font-weight:600">Alior: ${Utils.formatCurrency(aliorTotal)}</span>
              <span style="color:var(--ing);font-weight:600">ING: ${Utils.formatCurrency(ingTotal)}</span>
              <span style="color:var(--cash);font-weight:600">Gotówka: ${Utils.formatCurrency(cashTotal)}</span>
            </div>
          </div>
          <div class="stat-card" style="grid-column: 1 / -1;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <div><span class="stat-label">Najlepszy miesiąc:</span><br><strong>${bestMonth}</strong></div>
              <div><span class="stat-label">Najgorszy miesiąc:</span><br><strong>${worstMonth}</strong></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('stats-cards').innerHTML = html;
  }

  function getMonthsBetweenRange(from, to) {
    const months = [];
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      months.push({
        key: Utils.getMonthKey(d),
        label: Utils.POLISH_MONTHS[d.getMonth()].substring(0, 3) + ' ' + d.getFullYear().toString().substring(2)
      });
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }

  function renderSessionsChart(data, range) {
    const months = getMonthsBetweenRange(range.from, range.to);
    const labels = months.map(m => m.label);
    const completedData = [];
    const cancelledData = [];

    months.forEach(m => {
      const monthSessions = data.sessions.filter(s =>
        Utils.getMonthKey(new Date(s.date + 'T00:00:00')) === m.key
      );
      completedData.push(monthSessions.filter(s => s.status === 'completed').length);
      cancelledData.push(monthSessions.filter(s => s.status === 'cancelled').length);
    });

    const ctx = document.getElementById('stats-sessions-chart');
    if (sessionsChart) sessionsChart.destroy();

    sessionsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Odbyte',
            data: completedData,
            borderColor: '#34C759',
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#34C759',
            borderWidth: 2.5
          },
          {
            label: 'Odwołane',
            data: cancelledData,
            borderColor: '#FF3B30',
            backgroundColor: 'rgba(255, 59, 48, 0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#FF3B30',
            borderWidth: 2.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  function renderPaymentsChart(data, range) {
    const months = getMonthsBetweenRange(range.from, range.to);
    const labels = months.map(m => m.label);
    const aliorData = [];
    const ingData = [];
    const cashData = [];
    const totalData = [];

    months.forEach(m => {
      const mp = data.payments.filter(p =>
        Utils.getMonthKey(new Date(p.date + 'T00:00:00')) === m.key
      );
      const alior = mp.filter(p => p.method === 'aliorBank').reduce((s, p) => s + p.amount, 0);
      const ing = mp.filter(p => p.method === 'ingBank').reduce((s, p) => s + p.amount, 0);
      const cash = mp.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
      aliorData.push(alior);
      ingData.push(ing);
      cashData.push(cash);
      totalData.push(alior + ing + cash);
    });

    const ctx = document.getElementById('stats-payments-chart');
    if (paymentsChart) paymentsChart.destroy();

    paymentsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Razem',
            data: totalData,
            borderColor: '#007AFF',
            backgroundColor: 'rgba(0, 122, 255, 0.08)',
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#007AFF'
          },
          {
            label: 'Alior Bank',
            data: aliorData,
            borderColor: 'rgba(204, 0, 0, 0.7)',
            tension: 0.4,
            borderWidth: 1.5,
            pointRadius: 3,
            borderDash: [4, 4]
          },
          {
            label: 'ING Bank',
            data: ingData,
            borderColor: 'rgba(255, 102, 0, 0.7)',
            tension: 0.4,
            borderWidth: 1.5,
            pointRadius: 3,
            borderDash: [4, 4]
          },
          {
            label: 'Gotówka',
            data: cashData,
            borderColor: 'rgba(52, 199, 89, 0.7)',
            tension: 0.4,
            borderWidth: 1.5,
            pointRadius: 3,
            borderDash: [4, 4]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${Utils.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: (val) => Utils.formatCurrency(val) } }
        }
      }
    });
  }

  return { init, render, setDefaultRange };
})();
