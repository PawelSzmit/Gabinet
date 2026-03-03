// finance.js - Finance views for Gabinet PWA

const FinanceViews = (() => {

  // helpers

  const POLISH_MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                         'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const POLISH_MONTHS_GEN = ['stycznia','lutego','marca','kwietnia','maja','czerwca',
                              'lipca','sierpnia','września','października','listopada','grudnia'];
  const POLISH_MONTHS_SHORT = ['Sty','Lut','Mar','Kwi','Maj','Cze',
                                'Lip','Sie','Wrz','Paź','Lis','Gru'];

  function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  }

  function formatDateLong(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDate() + ' ' + POLISH_MONTHS_GEN[d.getMonth()] + ' ' + d.getFullYear();
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentYearMonth() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  function getPatient(id) {
    return (AppState.patients || []).find(function(p){ return p.id === id; }) || null;
  }

  function getSessions() { return AppState.sessions || []; }
  function getPayments() { return AppState.payments || []; }

  function methodLabel(method) {
    const map = { alior: 'Alior Bank', ing: 'ING Bank', cash: 'Gotówka' };
    return map[method] || method || '';
  }

  function methodBadgeClass(method) {
    const map = { alior: 'badge-alior', ing: 'badge-ing', cash: 'badge-cash' };
    return map[method] || '';
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Returns the effective price for a session: paymentAmount if set, else patient's sessionRate
  function sessionEffectivePrice(s) {
    if (s.paymentAmount !== null && s.paymentAmount !== undefined) return s.paymentAmount;
    const p = getPatient(s.patientId);
    return p ? (p.sessionRate || 0) : 0;
  }

  // stats helpers

  function sessionsThisMonth() {
    const ym = currentYearMonth();
    return getSessions().filter(function(s) {
      const d = new Date(s.date.slice(0, 10) + 'T00:00:00');
      return d.getFullYear() === ym.year && d.getMonth() === ym.month &&
             (s.status === 'completed' || s.status === 'scheduled');
    });
  }

  function paidSessionsThisMonth() {
    const ym = currentYearMonth();
    return getSessions().filter(function(s) {
      const d = new Date(s.date.slice(0, 10) + 'T00:00:00');
      return d.getFullYear() === ym.year && d.getMonth() === ym.month && s.isPaid;
    });
  }

  function revenueThisMonth() {
    const ym = currentYearMonth();
    return getPayments().filter(function(p) {
      const d = new Date(p.date + 'T00:00:00');
      return d.getFullYear() === ym.year && d.getMonth() === ym.month;
    }).reduce(function(sum, p) { return sum + (p.amount || 0); }, 0);
  }

  function unpaidRequiredSessions() {
    return getSessions().filter(function(s){
      return !s.isPaid && (s.status === 'completed' || s.status === 'scheduled');
    });
  }

  function totalDebt() {
    return unpaidRequiredSessions().reduce(function(sum,s){ return sum + sessionEffectivePrice(s); }, 0);
  }

  function sessionsThisYear() {
    const ym = currentYearMonth();
    return getSessions().filter(function(s) {
      const d = new Date(s.date.slice(0, 10) + 'T00:00:00');
      return d.getFullYear() === ym.year && (s.status === 'completed' || s.status === 'scheduled');
    });
  }

  function revenueThisYear() {
    const ym = currentYearMonth();
    return getPayments().filter(function(p) {
      const d = new Date(p.date + 'T00:00:00');
      return d.getFullYear() === ym.year;
    }).reduce(function(sum, p) { return sum + (p.amount || 0); }, 0);
  }

  function avgSessionsPerMonth() {
    const ym = currentYearMonth();
    const monthsElapsed = ym.month + 1;
    return (sessionsThisYear().length / monthsElapsed).toFixed(1);
  }

  function avgRevenuePerMonth() {
    const ym = currentYearMonth();
    const monthsElapsed = ym.month + 1;
    return (revenueThisYear() / monthsElapsed).toFixed(0);
  }

  function revenueByMethod() {
    const ym = currentYearMonth();
    const result = { alior: 0, ing: 0, cash: 0 };
    getPayments().forEach(function(p) {
      const d = new Date(p.date + 'T00:00:00');
      if (d.getFullYear() === ym.year && d.getMonth() === ym.month) {
        const m = p.method || 'cash';
        if (result[m] !== undefined) result[m] += (p.amount || 0);
        else result.cash += (p.amount || 0);
      }
    });
    return result;
  }

  function debtByPatient() {
    const unpaid = unpaidRequiredSessions();
    const byPatient = {};
    unpaid.forEach(function(s) {
      const pid = s.patientId;
      if (!byPatient[pid]) byPatient[pid] = { sessions: [], total: 0 };
      byPatient[pid].sessions.push(s);
      byPatient[pid].total += sessionEffectivePrice(s);
    });
    return byPatient;
  }

  // chart helpers

  function revenueChartData(periodKey) {
    const now = new Date();
    let months = [];

    if (periodKey === '3m') {
      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    } else if (periodKey === '6m') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    } else if (periodKey === 'rok') {
      for (let i = 0; i < 12; i++) {
        months.push({ year: now.getFullYear(), month: i });
      }
    } else {
      const all = getPayments();
      if (!all.length) return [];
      const set = {};
      all.forEach(function(p) {
        const d = new Date(p.date + 'T00:00:00');
        const key = d.getFullYear() + '-' + d.getMonth();
        if (!set[key]) set[key] = { year: d.getFullYear(), month: d.getMonth() };
      });
      months = Object.values(set).sort(function(a,b){
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
    }

    return months.map(function(ym) {
      const rev = getPayments().filter(function(p) {
        const d = new Date(p.date + 'T00:00:00');
        return d.getFullYear() === ym.year && d.getMonth() === ym.month;
      }).reduce(function(sum,p){ return sum + (p.amount||0); }, 0);
      return { label: POLISH_MONTHS_SHORT[ym.month], year: ym.year, month: ym.month, value: rev };
    });
  }

  function renderChart(periodKey) {
    const data = revenueChartData(periodKey);
    if (!data.length) {
      return '<p class="fin-empty">Brak danych do wykresu.</p>';
    }
    const maxVal = Math.max.apply(null, data.map(function(d){ return d.value; }).concat([1]));
    let bars = '';
    data.forEach(function(d) {
      const pct = Math.round((d.value / maxVal) * 100);
      const zeroClass = d.value > 0 ? '' : ' bar-zero';
      const amountStr = d.value > 0 ? formatCurrency(d.value) : '';
      bars += '<div class="chart-bar-wrap">' +
              '<div class="chart-bar-amount">' + amountStr + '</div>' +
              '<div class="chart-bar' + zeroClass + '" style="height:' + pct + '%"></div>' +
              '<div class="chart-bar-label">' + escHtml(d.label) + '</div>' +
              '</div>';
    });
    return '<div class="chart-bars-container">' + bars + '</div>';
  }

  // DASHBOARD TAB

  function renderDashboard() {
    const ym = currentYearMonth();
    const completedCount = sessionsThisMonth().filter(function(s){ return s.status === 'completed'; }).length;
    const paidCount = paidSessionsThisMonth().length;
    const rev = revenueThisMonth();
    const debt = totalDebt();
    const byMethod = revenueByMethod();
    const methodTotal = byMethod.alior + byMethod.ing + byMethod.cash;
    const debtMap = debtByPatient();
    const hasDebt = Object.keys(debtMap).length > 0;
    const yearSessions = sessionsThisYear().length;
    const yearRev = revenueThisYear();
    const avgSess = avgSessionsPerMonth();
    const avgRev = avgRevenuePerMonth();

    let debtRows = '';
    if (hasDebt) {
      Object.keys(debtMap).forEach(function(pid) {
        const data = debtMap[pid];
        const p = getPatient(pid);
        const pseudo = p ? escHtml(p.pseudonym || p.firstName) : 'Nieznany';
        debtRows += '<div class="fin-debt-row">' +
          '<span class="fin-debt-name">' + pseudo + '</span>' +
          '<span class="fin-debt-count">' + data.sessions.length + ' ses.</span>' +
          '<span class="fin-debt-amount">' + formatCurrency(data.total) + '</span>' +
          '</div>';
      });
    }

    const debtSection = hasDebt ? (
      '<h3 class="fin-section-title fin-section-orange">' +
      '<span class="fin-section-icon">&#9888;</span> Zaległości</h3>' +
      '<div class="fin-debt-list">' + debtRows + '</div>'
    ) : '';

    return '<div class="fin-dashboard">' +

      '<h3 class="fin-section-title">' +
      '<span class="fin-section-icon">&#128197;</span> ' +
      POLISH_MONTHS[ym.month] + ' ' + ym.year + '</h3>' +

      '<div class="fin-stats-grid">' +
        '<div class="fin-stat-card fin-stat-blue">' +
          '<div class="fin-stat-icon">&#128197;</div>' +
          '<div class="fin-stat-value">' + completedCount + '</div>' +
          '<div class="fin-stat-label">Odbyte sesje</div></div>' +
        '<div class="fin-stat-card fin-stat-green">' +
          '<div class="fin-stat-icon">&#9989;</div>' +
          '<div class="fin-stat-value">' + paidCount + '</div>' +
          '<div class="fin-stat-label">Opłacone sesje</div></div>' +
        '<div class="fin-stat-card fin-stat-green fin-stat-bold">' +
          '<div class="fin-stat-icon">&#128176;</div>' +
          '<div class="fin-stat-value">' + formatCurrency(rev) + '</div>' +
          '<div class="fin-stat-label">Przychód</div></div>' +
        '<div class="fin-stat-card ' + (debt > 0 ? 'fin-stat-orange' : 'fin-stat-muted') + '">' +
          '<div class="fin-stat-icon">&#9888;</div>' +
          '<div class="fin-stat-value">' + formatCurrency(debt) + '</div>' +
          '<div class="fin-stat-label">Należności</div></div>' +
      '</div>' +

      '<h3 class="fin-section-title">' +
      '<span class="fin-section-icon">&#128202;</span> Rok ' + ym.year + '</h3>' +

      '<div class="fin-stats-grid">' +
        '<div class="fin-stat-card fin-stat-blue">' +
          '<div class="fin-stat-icon">&#128193;</div>' +
          '<div class="fin-stat-value">' + yearSessions + '</div>' +
          '<div class="fin-stat-label">Sesje w roku</div></div>' +
        '<div class="fin-stat-card fin-stat-green">' +
          '<div class="fin-stat-icon">&#128181;</div>' +
          '<div class="fin-stat-value">' + formatCurrency(yearRev) + '</div>' +
          '<div class="fin-stat-label">Przychód w roku</div></div>' +
        '<div class="fin-stat-card fin-stat-purple">' +
          '<div class="fin-stat-icon">&#128200;</div>' +
          '<div class="fin-stat-value">' + avgSess + '</div>' +
          '<div class="fin-stat-label">Śr. sesji/mies.</div></div>' +
        '<div class="fin-stat-card fin-stat-purple">' +
          '<div class="fin-stat-icon">&#128201;</div>' +
          '<div class="fin-stat-value">' + formatCurrency(Number(avgRev)) + '</div>' +
          '<div class="fin-stat-label">Śr. przychód/mies.</div></div>' +
      '</div>' +

      '<h3 class="fin-section-title">' +
      '<span class="fin-section-icon">&#127968;</span> Przychód według metody</h3>' +
      '<div class="fin-method-table">' +
        '<div class="fin-method-row">' +
          '<span class="fin-method-badge badge-alior">Alior Bank</span>' +
          '<span class="fin-method-amount">' + formatCurrency(byMethod.alior) + '</span></div>' +
        '<div class="fin-method-row">' +
          '<span class="fin-method-badge badge-ing">ING Bank</span>' +
          '<span class="fin-method-amount">' + formatCurrency(byMethod.ing) + '</span></div>' +
        '<div class="fin-method-row">' +
          '<span class="fin-method-badge badge-cash">Gotówka</span>' +
          '<span class="fin-method-amount">' + formatCurrency(byMethod.cash) + '</span></div>' +
        '<div class="fin-method-row fin-method-total">' +
          '<span class="fin-method-label">Łącznie</span>' +
          '<span class="fin-method-amount fin-total-bold">' + formatCurrency(methodTotal) + '</span></div>' +
      '</div>' +

      debtSection +

      '<h3 class="fin-section-title">' +
      '<span class="fin-section-icon">&#128202;</span> Wykres przychodów</h3>' +
      '<div class="fin-chart-period-picker" id="fin-chart-period-picker">' +
        '<button class="fin-period-btn active" data-period="3m">3M</button>' +
        '<button class="fin-period-btn" data-period="6m">6M</button>' +
        '<button class="fin-period-btn" data-period="rok">Rok</button>' +
        '<button class="fin-period-btn" data-period="all">Wszystko</button>' +
      '</div>' +
      '<div class="fin-chart-container" id="fin-chart-container">' +
        renderChart('3m') +
      '</div>' +

      '</div>';
  }

  // PAYMENTS TAB

  function renderPayments(filters) {
    const f = filters || { method: 'all', from: '', to: '' };
    let payments = getPayments().slice().sort(function(a,b){ return b.date.localeCompare(a.date); });

    if (f.method && f.method !== 'all') {
      payments = payments.filter(function(p){ return p.method === f.method; });
    }
    if (f.from) payments = payments.filter(function(p){ return p.date >= f.from; });
    if (f.to)   payments = payments.filter(function(p){ return p.date <= f.to; });

    const total = payments.reduce(function(sum,p){ return sum + (p.amount||0); }, 0);

    let rows = '';
    payments.forEach(function(p) {
      const patient  = getPatient(p.patientId);
      const pseudo   = patient ? escHtml(patient.pseudonym || patient.firstName) : 'Nieznany';
      const fullName = patient ? escHtml(((patient.firstName || '') + ' ' + (patient.lastName || '')).trim()) : '';
      const sessCount = (p.sessionIds || []).length;
      rows += '<div class="fin-payment-row" data-payment-id="' + escHtml(p.id) + '">' +
        '<div class="fin-payment-main" onclick="FinanceViews.openPaymentDetail(\'' + escHtml(p.id) + '\')">' +
          '<div class="fin-payment-top">' +
            '<span class="fin-payment-date">' + formatDateLong(p.date) + '</span>' +
            '<span class="fin-method-badge ' + methodBadgeClass(p.method) + '">' + methodLabel(p.method) + '</span>' +
            '<span class="fin-payment-amount">' + formatCurrency(p.amount) + '</span></div>' +
          '<div class="fin-payment-bottom">' +
            '<span class="fin-payment-patient">' + pseudo + '</span>' +
            (fullName ? '<span class="fin-payment-fullname">' + fullName + '</span>' : '') +
            '<span class="fin-payment-sessions">' + sessCount + ' sesji</span></div>' +
          (p.note ? '<div class="fin-payment-note">' + escHtml(p.note) + '</div>' : '') +
        '</div>' +
        '<div class="fin-payment-actions">' +
          '<button class="fin-btn-icon" title="Edytuj" onclick="FinanceViews.openEditPayment(\'' + escHtml(p.id) + '\');event.stopPropagation()">&#9998;</button>' +
          '<button class="fin-btn-icon fin-btn-del" title="Usuń" onclick="FinanceViews.confirmDeletePayment(\'' + escHtml(p.id) + '\');event.stopPropagation()">&#128465;</button>' +
        '</div></div>';
    });

    const summaryHtml = payments.length > 0
      ? '<div class="fin-payments-summary"><span>' + payments.length + ' płatności</span><span class="fin-summary-total">' + formatCurrency(total) + '</span></div>'
      : '';

    return '<div class="fin-payments" id="fin-payments-view">' +
      '<div class="fin-payments-toolbar">' +
        '<button class="btn btn-primary fin-add-payment-btn" onclick="FinanceViews.openAddPayment()">' +
          '+ Zarejestruj płatność' +
        '</button></div>' +
      '<div class="fin-filter-chips" id="fin-filter-chips">' +
        '<button class="fin-chip ' + (f.method==='all'?'active':'') + '" data-method="all">Wszystkie</button>' +
        '<button class="fin-chip ' + (f.method==='alior'?'active':'') + '" data-method="alior">Alior Bank</button>' +
        '<button class="fin-chip ' + (f.method==='ing'?'active':'') + '" data-method="ing">ING Bank</button>' +
        '<button class="fin-chip ' + (f.method==='cash'?'active':'') + '" data-method="cash">Gotówka</button></div>' +
      '<div class="fin-date-filters">' +
        '<div class="fin-date-filter-group"><label>Od</label>' +
          '<input type="date" class="fin-date-input" id="fin-filter-from" value="' + escHtml(f.from) + '" /></div>' +
        '<div class="fin-date-filter-group"><label>Do</label>' +
          '<input type="date" class="fin-date-input" id="fin-filter-to" value="' + escHtml(f.to) + '" /></div></div>' +
      summaryHtml +
      '<div class="fin-payment-list">' +
        (rows || '<p class="fin-empty">Brak płatności spełniających kryteria.</p>') +
      '</div></div>';
  }

  // MAIN RENDER

  let _currentTab = 'dashboard';
  let _paymentFilters = { method: 'all', from: '', to: '' };
  let _containerRef = null;

  function render(container) {
    _containerRef = container;
    container.innerHTML =
      '<div class="fin-view" id="fin-view-root">' +
      '<div class="fin-tabs">' +
        '<button class="fin-tab ' + (_currentTab==='dashboard'?'active':'') + '" data-tab="dashboard">Dashboard</button>' +
        '<button class="fin-tab ' + (_currentTab==='payments'?'active':'') + '" data-tab="payments">Płatności</button>' +
      '</div>' +
      '<div class="fin-tab-content" id="fin-tab-content">' +
        (_currentTab === 'dashboard' ? renderDashboard() : renderPayments(_paymentFilters)) +
      '</div></div>';

    bindEvents(container);
  }

  function bindEvents(container) {
    container.querySelectorAll('.fin-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _currentTab = btn.dataset.tab;
        render(container);
      });
    });

    const picker = container.querySelector('#fin-chart-period-picker');
    if (picker) {
      picker.querySelectorAll('.fin-period-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          picker.querySelectorAll('.fin-period-btn').forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
          const chartContainer = container.querySelector('#fin-chart-container');
          if (chartContainer) chartContainer.innerHTML = renderChart(btn.dataset.period);
        });
      });
    }

    const chips = container.querySelector('#fin-filter-chips');
    if (chips) {
      chips.querySelectorAll('.fin-chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
          _paymentFilters.method = chip.dataset.method;
          refreshPaymentsTab(container);
        });
      });
    }

    const fromInput = container.querySelector('#fin-filter-from');
    const toInput   = container.querySelector('#fin-filter-to');
    if (fromInput) {
      fromInput.addEventListener('change', function() {
        _paymentFilters.from = fromInput.value;
        refreshPaymentsTab(container);
      });
    }
    if (toInput) {
      toInput.addEventListener('change', function() {
        _paymentFilters.to = toInput.value;
        refreshPaymentsTab(container);
      });
    }
  }

  function refreshPaymentsTab(container) {
    const content = container.querySelector('#fin-tab-content');
    if (content) {
      content.innerHTML = renderPayments(_paymentFilters);
      bindEvents(container);
    }
  }

  // ADD / EDIT PAYMENT SHEET

  function buildUnpaidSessionOptions(patientId, selectedIds) {
    const sel = new Set(selectedIds || []);
    const sessions = getSessions().filter(function(s) {
      return s.patientId === patientId &&
             (!s.isPaid || sel.has(s.id)) &&
             (s.status === 'scheduled' || s.status === 'completed' ||
              (s.status === 'cancelled' && sel.has(s.id)));
    }).sort(function(a,b) {
      return a.date.localeCompare(b.date);
    });

    if (!sessions.length) return '<p class="fin-empty">Brak niepopłaconych sesji dla tego pacjenta.</p>';

    return sessions.map(function(s) {
      const checked = sel.has(s.id) ? 'checked' : '';
      const label = formatDateLong(s.date) + ' ' + formatTime(s.date) + ' \u2013 ' + formatCurrency(sessionEffectivePrice(s));
      const statusLabel = s.status==='completed'?'(odbyła się)':
                          s.status==='scheduled' ?'(zaplanowana)':
                          s.status==='cancelled' ?'(odwołana)':    '';
      return '<label class="fin-session-check">' +
             '<input type="checkbox" class="fin-session-cb" value="' + escHtml(s.id) + '" ' + checked + ' />' +
             '<span class="fin-session-check-label">' + escHtml(label) +
             '<small class="fin-sess-status"> ' + statusLabel + '</small></span></label>';
    }).join('');
  }

  function calcTotalFromSelected(selectedIds) {
    return (selectedIds || []).reduce(function(sum, id) {
      const s = getSessions().find(function(x){ return x.id === id; });
      return sum + (s ? sessionEffectivePrice(s) : 0);
    }, 0);
  }

  function renderPaymentSheet(payment) {
    const isEdit = !!payment;
    const p = payment || { id:'', patientId:'', date: todayStr(), method:'cash', sessionIds:[], note:'', amount:0 };
    const patients = (AppState.patients || []).slice().sort(function(a,b){
      return (a.pseudonym||a.firstName||'').localeCompare(b.pseudonym||b.firstName||'');
    });

    let patientOptions = '';
    patients.forEach(function(pt) {
      patientOptions += '<option value="' + escHtml(pt.id) + '"' + (pt.id===p.patientId?' selected':'') + '>' +
        escHtml(pt.pseudonym || ((pt.firstName||'')+' '+(pt.lastName||'')). trim()) +
        '</option>';
    });

    const unpaidHtml = p.patientId
      ? buildUnpaidSessionOptions(p.patientId, p.sessionIds)
      : '<p class="fin-empty">Wybierz pacjenta, aby zobaczyć sesje.</p>';

    const totalAmount = calcTotalFromSelected(p.sessionIds);

    return '<div class="sheet-overlay" id="fin-payment-sheet">' +
      '<div class="sheet-panel">' +
        '<div class="sheet-header">' +
          '<h2>' + (isEdit ? 'Edytuj płatność' : 'Zarejestruj płatność') + '</h2>' +
          '<button class="sheet-close" onclick="FinanceViews.closePaymentSheet()">&#10005;</button>' +
        '</div>' +
        '<div class="sheet-body">' +

          '<div class="fin-form-group">' +
            '<label>Pacjent</label>' +
            '<select class="fin-select" id="fin-ps-patient">' +
              '<option value="">-- wybierz pacjenta --</option>' + patientOptions +
            '</select></div>' +

          '<div class="fin-form-group">' +
            '<label>Data płatności</label>' +
            '<input type="date" class="fin-input" id="fin-ps-date" value="' + escHtml(p.date) + '" /></div>' +

          '<div class="fin-form-group">' +
            '<label>Metoda płatności</label>' +
            '<div class="fin-segmented" id="fin-ps-method">' +
              '<button class="seg-btn ' + (p.method==='alior'?'active':'') + '" data-method="alior">Alior</button>' +
              '<button class="seg-btn ' + (p.method==='ing'?'active':'') + '" data-method="ing">ING</button>' +
              '<button class="seg-btn ' + (p.method==='cash'?'active':'') + '" data-method="cash">Gotówka</button>' +
            '</div>' +
            '<input type="hidden" id="fin-ps-method-val" value="' + escHtml(p.method) + '" /></div>' +

          '<div class="fin-form-group">' +
            '<label>Sesje do opłacenia</label>' +
            '<div class="fin-session-list" id="fin-ps-sessions">' + unpaidHtml + '</div></div>' +

          '<div class="fin-form-group">' +
            '<label>Kwota łączna</label>' +
            '<div class="fin-total-display" id="fin-ps-total">' + formatCurrency(totalAmount) + '</div></div>' +

          '<div class="fin-form-group">' +
            '<label>Notatka (opcjonalna)</label>' +
            '<textarea class="fin-textarea" id="fin-ps-note" rows="2">' + escHtml(p.note||'')+'</textarea></div>' +

        '</div>' +
        '<div class="sheet-footer">' +
          '<button class="btn btn-secondary" onclick="FinanceViews.closePaymentSheet()">Anuluj</button>' +
          '<button class="btn btn-primary" onclick="FinanceViews.savePayment(\'' + (isEdit?escHtml(p.id):'') + '\')">'  +
            (isEdit ? 'Zapisz zmiany' : 'Zapisz płatność') +
          '</button></div>' +
      '</div></div>';
  }

  function openPaymentSheet(payment) {
    const existing = document.querySelector('#fin-payment-sheet');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', renderPaymentSheet(payment));
    bindPaymentSheetEvents();
  }

  function bindPaymentSheetEvents() {
    const sheet = document.querySelector('#fin-payment-sheet');
    if (!sheet) return;

    const patientSel = sheet.querySelector('#fin-ps-patient');
    if (patientSel) {
      patientSel.addEventListener('change', function() {
        const pid = patientSel.value;
        const sessContainer = sheet.querySelector('#fin-ps-sessions');
        if (sessContainer) {
          sessContainer.innerHTML = pid
            ? buildUnpaidSessionOptions(pid, [])
            : '<p class="fin-empty">Wybierz pacjenta, aby zobaczyć sesje.</p>';
          bindSessionCheckboxes(sheet);
        }
        updateTotal(sheet);
      });
    }

    const segBtns = sheet.querySelectorAll('#fin-ps-method .seg-btn');
    segBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        segBtns.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        const hiddenInput = sheet.querySelector('#fin-ps-method-val');
        if (hiddenInput) hiddenInput.value = btn.dataset.method;
      });
    });

    bindSessionCheckboxes(sheet);
  }

  function bindSessionCheckboxes(sheet) {
    sheet.querySelectorAll('.fin-session-cb').forEach(function(cb) {
      cb.addEventListener('change', function(){ updateTotal(sheet); });
    });
  }

  function updateTotal(sheet) {
    const checked = Array.from(sheet.querySelectorAll('.fin-session-cb:checked')).map(function(cb){ return cb.value; });
    const total = calcTotalFromSelected(checked);
    const totalEl = sheet.querySelector('#fin-ps-total');
    if (totalEl) totalEl.textContent = formatCurrency(total);
  }

  function getSelectedSessionIds(sheet) {
    return Array.from(sheet.querySelectorAll('.fin-session-cb:checked')).map(function(cb){ return cb.value; });
  }

  function openAddPayment() { openPaymentSheet(null); }

  function openEditPayment(paymentId) {
    const p = getPayments().find(function(x){ return x.id === paymentId; });
    if (!p) return;
    openPaymentSheet(p);
  }

  function savePayment(existingId) {
    const sheet = document.querySelector('#fin-payment-sheet');
    if (!sheet) return;

    const patientId  = (sheet.querySelector('#fin-ps-patient')?.value) || '';
    const date       = (sheet.querySelector('#fin-ps-date')?.value) || '';
    const method     = (sheet.querySelector('#fin-ps-method-val')?.value) || 'cash';
    const note       = (sheet.querySelector('#fin-ps-note')?.value) || '';
    const sessionIds = getSelectedSessionIds(sheet);

    if (!patientId)       { alert('Wybierz pacjenta.'); return; }
    if (!date)            { alert('Podaj datę płatności.'); return; }
    if (!sessionIds.length){ alert('Wybierz co najmniej jedną sesję.'); return; }

    const amount = calcTotalFromSelected(sessionIds);
    if (!AppState.payments) AppState.payments = [];

    if (existingId) {
      const old = AppState.payments.find(function(x){ return x.id === existingId; });
      if (old) {
        (old.sessionIds || []).forEach(function(sid) {
          const s = getSessions().find(function(x){ return x.id === sid; });
          if (s) s.isPaid = false;
        });
        const idx = AppState.payments.findIndex(function(x){ return x.id === existingId; });
        if (idx >= 0) {
          AppState.payments[idx] = Object.assign({}, AppState.payments[idx],
            { patientId: patientId, date: date, method: method, note: note, sessionIds: sessionIds, amount: amount });
        }
      }
    } else {
      AppState.payments.push({
        id: 'pay_' + Date.now(),
        patientId: patientId, date: date, method: method,
        note: note, sessionIds: sessionIds, amount: amount,
        createdAt: new Date().toISOString()
      });
    }

    sessionIds.forEach(function(sid) {
      const s = (AppState.sessions || []).find(function(x){ return x.id === sid; });
      if (s) s.isPaid = true;
    });

    persistData();
    closePaymentSheet();
    if (_containerRef) render(_containerRef);
  }

  function closePaymentSheet() {
    const sheet = document.querySelector('#fin-payment-sheet');
    if (sheet) sheet.remove();
  }

  function confirmDeletePayment(paymentId) {
    if (!confirm('Czy na pewno chcesz usunąć tę płatność?\nSesje zostaną oznaczone jako nieopłacone.')) return;
    deletePayment(paymentId);
  }

  function deletePayment(paymentId) {
    const p = (AppState.payments || []).find(function(x){ return x.id === paymentId; });
    if (p) {
      (p.sessionIds || []).forEach(function(sid) {
        const s = (AppState.sessions || []).find(function(x){ return x.id === sid; });
        if (s) s.isPaid = false;
      });
    }
    AppState.payments = (AppState.payments || []).filter(function(x){ return x.id !== paymentId; });
    persistData();
    if (_containerRef) render(_containerRef);
  }

  // PAYMENT DETAIL

  function openPaymentDetail(paymentId) {
    const p = (AppState.payments || []).find(function(x){ return x.id === paymentId; });
    if (!p) return;

    const patient  = getPatient(p.patientId);
    const pseudo   = patient ? escHtml(patient.pseudonym || patient.firstName) : 'Nieznany';
    const fullName = patient ? escHtml(((patient.firstName||'')+' '+(patient.lastName||'')).trim()) : '';

    let paidSessions = '';
    (p.sessionIds || []).forEach(function(sid) {
      const s = getSessions().find(function(x){ return x.id === sid; });
      if (!s) return;
      paidSessions +=
        '<div class="fin-detail-session-row">' +
          '<span class="fin-ds-date">' + formatDateLong(s.date) + '</span>' +
          '<span class="fin-ds-time">' + formatTime(s.date) + '</span>' +
          '<span class="fin-ds-amount">' + formatCurrency(sessionEffectivePrice(s)) + '</span>' +
        '</div>';
    });

    const html =
      '<div class="sheet-overlay" id="fin-payment-detail">' +
      '<div class="sheet-panel">' +
        '<div class="sheet-header">' +
          '<h2>Szczegóły płatności</h2>' +
          '<button class="sheet-close" onclick="document.querySelector(\'#fin-payment-detail\').remove()">&#10005;</button>' +
        '</div>' +
        '<div class="sheet-body">' +
          '<div class="fin-detail-row"><span class="fin-detail-label">Pacjent</span>' +
            '<span>' + pseudo + (fullName ? ' (' + fullName + ')' : '') + '</span></div>' +
          '<div class="fin-detail-row"><span class="fin-detail-label">Data</span>' +
            '<span>' + formatDateLong(p.date) + '</span></div>' +
          '<div class="fin-detail-row"><span class="fin-detail-label">Metoda</span>' +
            '<span class="fin-method-badge ' + methodBadgeClass(p.method) + '">' + methodLabel(p.method) + '</span></div>' +
          '<div class="fin-detail-row"><span class="fin-detail-label">Kwota</span>' +
            '<span class="fin-payment-amount">' + formatCurrency(p.amount) + '</span></div>' +
          (p.note ? '<div class="fin-detail-row"><span class="fin-detail-label">Notatka</span><span>' + escHtml(p.note) + '</span></div>' : '') +
          '<h4 class="fin-detail-sessions-title">Opłacone sesje</h4>' +
          '<div class="fin-detail-sessions">' +
            (paidSessions || '<p class="fin-empty">Brak sesji przypisanych.</p>') +
          '</div>' +
        '</div>' +
        '<div class="sheet-footer">' +
          '<button class="btn btn-danger" onclick="FinanceViews.confirmDeletePayment(\'' + escHtml(p.id) + '\');var el=document.querySelector(\'#fin-payment-detail\');if(el)el.remove()">' +
            'Usuń płatność' +
          '</button>' +
          '<button class="btn btn-secondary" onclick="document.querySelector(\'#fin-payment-detail\').remove()">Zamknij</button>' +
        '</div></div></div>';

    const existing = document.querySelector('#fin-payment-detail');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // PUBLIC API

  return {
    render:                render,
    openAddPayment:        openAddPayment,
    openEditPayment:       openEditPayment,
    savePayment:           savePayment,
    closePaymentSheet:     closePaymentSheet,
    confirmDeletePayment:  confirmDeletePayment,
    deletePayment:         deletePayment,
    openPaymentDetail:     openPaymentDetail
  };

})();
