/* ===========================================
   Finance - revenue chart, payments tab
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
        if (tab.dataset.tab === 'fin-chart') renderRevenueChart();
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
    const activePeriod = parseInt(document.querySelector('.chart-period-selector .btn-switcher.active').dataset.period);
    renderRevenueChart(activePeriod);
  }

  function renderRevenueChart(months) {
    if (!months) {
      const activeBtn = document.querySelector('.chart-period-selector .btn-switcher.active');
      months = activeBtn ? parseInt(activeBtn.dataset.period) : 6;
    }

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
            backgroundColor: 'rgba(204, 0, 0, 0.65)',
            borderColor: '#CC0000',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'ING Bank',
            data: ingData,
            backgroundColor: 'rgba(255, 102, 0, 0.65)',
            borderColor: '#FF6600',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Gotówka',
            data: cashData,
            backgroundColor: 'rgba(52, 199, 89, 0.65)',
            borderColor: '#34C759',
            borderWidth: 1,
            borderRadius: 6
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
