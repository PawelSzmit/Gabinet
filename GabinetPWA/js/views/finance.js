// finance.js - Refreshed finance workspace for Gabinet PWA

'use strict';

const FinanceViews = (() => {
  let currentTab = 'dashboard';
  let containerRef = null;
  let paymentFilters = { method: 'all', from: '', to: '' };

  function injectStyles() {
    if (document.getElementById('fin-styles')) return;
    const style = document.createElement('style');
    style.id = 'fin-styles';
    style.textContent = [
      '.fin-view{display:flex;flex-direction:column;gap:14px;padding:18px 18px calc(var(--tab-bar-height) + 30px);font-family:var(--font-sans,"Manrope",sans-serif)}',
      '.fin-shell,.fin-tabs,.fin-section,.fin-payment-row,.fin-sheet-panel{background:color-mix(in srgb,var(--surface-raised,#f7f2eb) 92%, transparent);border:1px solid var(--border,rgba(73,102,79,.14));box-shadow:var(--shadow-sm)}',
      '.fin-shell{border-radius:30px;padding:24px}',
      '.fin-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start}',
      '.fin-kicker{display:inline-block;margin-bottom:10px;font-size:.72rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--blue,#49664f)}',
      '.fin-title{margin:0;font-family:var(--font-display,"Fraunces",serif);font-size:clamp(2rem,4vw,3.2rem);line-height:.96;letter-spacing:-.06em;color:var(--text,#243126);max-width:10ch}',
      '.fin-text{margin:14px 0 0;max-width:38rem;color:var(--text-secondary,rgba(36,49,38,.68));line-height:1.75}',
      '.fin-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}',
      '.fin-action{border:none;border-radius:999px;padding:13px 16px;font-size:.84rem;font-weight:800;cursor:pointer;background:rgba(255,255,255,.68);color:var(--blue,#49664f);transition:transform .15s ease,background .15s ease}',
      '.fin-action:hover{transform:translateY(-1px)}',
      '.fin-action--primary{background:linear-gradient(135deg,var(--blue,#49664f),#617f68);color:var(--text-inverse,#f6f0e6)}',
      '.fin-highlight{padding:18px;border-radius:24px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.12))}',
      '.fin-highlight__eyebrow{display:block;font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--text-secondary,rgba(36,49,38,.68));margin-bottom:8px}',
      '.fin-highlight strong{display:block;font-size:2rem;color:var(--text,#243126);margin-bottom:4px}',
      '.fin-highlight span{color:var(--text-secondary,rgba(36,49,38,.68));line-height:1.6}',
      '.fin-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}',
      '.fin-metric{padding:16px;border-radius:22px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1));display:flex;flex-direction:column;gap:6px}',
      '.fin-metric span{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.fin-metric strong{font-size:1.28rem;color:var(--text,#243126)}',
      '.fin-metric small{font-size:.8rem;color:var(--text-secondary,rgba(36,49,38,.68));line-height:1.5}',
      '.fin-tabs{display:inline-flex;gap:6px;padding:6px;border-radius:999px;align-self:flex-start}',
      '.fin-tab{border:none;background:transparent;color:var(--text-secondary,rgba(36,49,38,.68));font-size:.8rem;font-weight:800;padding:10px 14px;border-radius:999px;cursor:pointer}',
      '.fin-tab.active{background:#fff;color:var(--blue,#49664f);box-shadow:0 10px 20px rgba(31,43,35,.08)}',
      '.fin-dashboard{display:grid;gap:14px}',
      '.fin-section{border-radius:28px;padding:22px}',
      '.fin-section-title{margin:0 0 14px;font-size:1rem;font-weight:800;color:var(--text,#243126)}',
      '.fin-split{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}',
      '.fin-method-list,.fin-debt-list,.fin-actions-list{display:grid;gap:10px}',
      '.fin-method-row,.fin-debt-row,.fin-action-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-radius:20px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1))}',
      '.fin-method-label,.fin-debt-name,.fin-action-row strong{color:var(--text,#243126);font-weight:700}',
      '.fin-method-amount,.fin-debt-amount{color:var(--text,#243126);font-weight:800}',
      '.fin-debt-count,.fin-action-row span{color:var(--text-secondary,rgba(36,49,38,.68));font-size:.82rem}',
      '.fin-method-badge{display:inline-flex;align-items:center;padding:.35rem .7rem;border-radius:999px;font-size:.74rem;font-weight:800}',
      '.fin-method-badge.badge-alior{background:rgba(191,97,82,.12);color:var(--red,#bf6152)}',
      '.fin-method-badge.badge-ing{background:rgba(204,139,86,.14);color:var(--orange,#cc8b56)}',
      '.fin-method-badge.badge-cash{background:rgba(107,144,115,.14);color:var(--green,#6b9073)}',
      '.fin-bar-chart{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:end;min-height:220px}',
      '.fin-bar{display:flex;flex-direction:column;justify-content:flex-end;gap:8px;min-height:220px}',
      '.fin-bar__value{font-size:.76rem;color:var(--text-secondary,rgba(36,49,38,.68));min-height:18px}',
      '.fin-bar__column{border-radius:18px 18px 10px 10px;background:linear-gradient(180deg,rgba(107,144,115,.2),rgba(73,102,79,.9));min-height:18px}',
      '.fin-bar__label{font-size:.76rem;font-weight:700;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.fin-payments{display:grid;gap:14px}',
      '.fin-payments-toolbar{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}',
      '.fin-filter-row{display:flex;gap:10px;flex-wrap:wrap}',
      '.fin-chip{border:none;border-radius:999px;padding:10px 12px;background:rgba(255,255,255,.62);color:var(--text-secondary,rgba(36,49,38,.68));font-size:.8rem;font-weight:800;cursor:pointer}',
      '.fin-chip.active{background:var(--blue,#49664f);color:var(--text-inverse,#f6f0e6)}',
      '.fin-date-group{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:18px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1));color:var(--text-secondary,rgba(36,49,38,.68));font-size:.82rem;font-weight:700}',
      '.fin-date-group input{border:none;background:transparent;color:var(--text,#243126);font:inherit;outline:none}',
      '.fin-summary{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:20px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1));font-weight:700;color:var(--text,#243126)}',
      '.fin-payment-list{display:grid;gap:12px}',
      '.fin-payment-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px;border-radius:24px}',
      '.fin-payment-main{flex:1;cursor:pointer}',
      '.fin-payment-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.fin-payment-date{font-weight:700;color:var(--text,#243126)}',
      '.fin-payment-amount{font-weight:800;color:var(--text,#243126);margin-left:auto}',
      '.fin-payment-patient{display:block;margin-top:8px;font-size:1rem;font-weight:800;color:var(--text,#243126)}',
      '.fin-payment-sub{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;color:var(--text-secondary,rgba(36,49,38,.68));font-size:.84rem}',
      '.fin-payment-note{margin-top:8px;color:var(--text-secondary,rgba(36,49,38,.68));line-height:1.6;font-size:.84rem}',
      '.fin-payment-actions{display:flex;gap:8px}',
      '.fin-btn-icon{border:none;border-radius:999px;padding:10px;background:rgba(255,255,255,.7);cursor:pointer;color:var(--blue,#49664f)}',
      '.fin-btn-icon--danger{color:var(--red,#bf6152)}',
      '.fin-empty{margin:0;padding:22px;border-radius:22px;background:rgba(255,255,255,.5);border:1px dashed var(--border,rgba(73,102,79,.14));text-align:center;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.fin-sheet-overlay{position:fixed;inset:0;z-index:1000;background:rgba(16,20,17,.4);display:flex;align-items:flex-end;justify-content:center;padding:20px}',
      '.fin-sheet-panel{width:min(720px,100%);border-radius:28px;padding:22px;max-height:92vh;overflow:auto}',
      '.fin-sheet-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
      '.fin-sheet-title{margin:0;font-family:var(--font-display,"Fraunces",serif);font-size:2rem;line-height:.98;letter-spacing:-.05em;color:var(--text,#243126)}',
      '.fin-sheet-subtitle{margin:6px 0 0;color:var(--text-secondary,rgba(36,49,38,.68));line-height:1.6}',
      '.fin-sheet-close{border:none;background:rgba(255,255,255,.68);color:var(--text-secondary,rgba(36,49,38,.68));border-radius:999px;width:42px;height:42px;cursor:pointer;font-size:1.1rem}',
      '.fin-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}',
      '.fin-form-group{display:flex;flex-direction:column;gap:8px}',
      '.fin-form-group--full{grid-column:1 / -1}',
      '.fin-form-group label{font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.fin-select,.fin-input,.fin-textarea{border:1.5px solid var(--border,rgba(73,102,79,.14));border-radius:18px;padding:14px 16px;background:rgba(255,255,255,.72);color:var(--text,#243126);font:inherit;outline:none}',
      '.fin-textarea{resize:vertical;min-height:88px}',
      '.fin-method-toggle{display:flex;gap:8px;flex-wrap:wrap}',
      '.fin-method-btn{border:none;border-radius:999px;padding:11px 14px;background:rgba(255,255,255,.62);color:var(--text-secondary,rgba(36,49,38,.68));font-weight:800;cursor:pointer}',
      '.fin-method-btn.active{background:var(--blue,#49664f);color:var(--text-inverse,#f6f0e6)}',
      '.fin-session-list{display:grid;gap:10px;padding:14px;border-radius:22px;background:rgba(255,255,255,.48);border:1px solid var(--border,rgba(73,102,79,.1))}',
      '.fin-session-check{display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid var(--separator,rgba(73,102,79,.12))}',
      '.fin-session-check:last-child{border-bottom:none}',
      '.fin-session-check input{margin-top:4px;accent-color:var(--blue,#49664f)}',
      '.fin-session-check-label{display:flex;flex-direction:column;gap:4px;color:var(--text,#243126);font-weight:700}',
      '.fin-session-check-label small{font-size:.8rem;color:var(--text-secondary,rgba(36,49,38,.68));font-weight:600}',
      '.fin-total-box{padding:16px;border-radius:22px;background:rgba(255,255,255,.68);border:1px solid var(--border,rgba(73,102,79,.1))}',
      '.fin-total-box strong{display:block;font-size:1.3rem;color:var(--text,#243126)}',
      '.fin-total-box span{color:var(--text-secondary,rgba(36,49,38,.68));font-size:.84rem}',
      '.fin-sheet-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}',
      '.fin-detail-stack{display:grid;gap:12px}',
      '.fin-detail-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:20px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1))}',
      '.fin-detail-row span:first-child{color:var(--text-secondary,rgba(36,49,38,.68));font-weight:700}',
      '.fin-detail-sessions{display:grid;gap:10px}',
      '.fin-detail-session{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-radius:18px;background:rgba(255,255,255,.52);border:1px solid var(--border,rgba(73,102,79,.1))}',
      '@media (max-width: 960px){.fin-view{padding:14px 14px calc(var(--tab-bar-height) + 24px)}.fin-hero,.fin-split,.fin-form-grid{grid-template-columns:1fr}.fin-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fin-bar-chart{grid-template-columns:repeat(3,minmax(0,1fr))}}',
      '@media (max-width: 640px){.fin-metric-grid{grid-template-columns:1fr}.fin-actions,.fin-payments-toolbar,.fin-filter-row,.fin-sheet-actions{flex-direction:column}.fin-action,.fin-sheet-actions .fin-action{width:100%}.fin-payment-row{flex-direction:column}.fin-payment-amount{margin-left:0}}',
      '@media (prefers-color-scheme: dark){.fin-shell,.fin-tabs,.fin-section,.fin-payment-row,.fin-sheet-panel{background:color-mix(in srgb,var(--surface-raised,#223128) 88%, transparent)}.fin-highlight,.fin-metric,.fin-method-row,.fin-debt-row,.fin-action-row,.fin-summary,.fin-date-group,.fin-btn-icon,.fin-select,.fin-input,.fin-textarea,.fin-session-list,.fin-total-box,.fin-detail-row,.fin-detail-session,.fin-tab.active{background:rgba(255,255,255,.04)}.fin-title,.fin-section-title,.fin-payment-date,.fin-payment-patient,.fin-payment-amount,.fin-sheet-title,.fin-total-box strong{color:var(--text,#f4ede4)}.fin-text,.fin-highlight span,.fin-metric span,.fin-metric small,.fin-debt-count,.fin-payment-sub,.fin-payment-note,.fin-kicker,.fin-sheet-subtitle,.fin-form-group label,.fin-session-check-label small,.fin-detail-row span:first-child,.fin-bar__label,.fin-bar__value{color:var(--text-secondary,rgba(244,237,228,.72))}.fin-chip{background:rgba(255,255,255,.04);color:var(--text-secondary,rgba(244,237,228,.72))}.fin-chip.active,.fin-method-btn.active{background:var(--blue,#dcc29d);color:var(--text-inverse,#223128)}.fin-tab.active{color:var(--blue,#dcc29d)}.fin-select,.fin-input,.fin-textarea{color:var(--text,#f4ede4)}}'
    ].join('');
    document.head.appendChild(style);
  }

  function getPatient(id) {
    return AppState.patients.find((patient) => patient.id === id);
  }

  function getSessions() {
    return AppState.sessions || [];
  }

  function getPayments() {
    return AppState.payments || [];
  }

  function displayPatientName(patient) {
    if (!patient) return 'Pacjent';
    return patient.pseudonym || ((patient.firstName || '') + ' ' + (patient.lastName || '')).trim() || 'Pacjent';
  }

  function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  }

  // Alias do globalnego escapeHtml z utils.js
  function escHtml(str) { return escapeHtml(str); }

  function monthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function sessionAmount(session) {
    if (typeof getSessionAmount === 'function') {
      return getSessionAmount(session);
    }
    const patient = getPatient(session.patientId);
    return patient ? patient.sessionRate : 0;
  }

  function paymentMethodLabel(method) {
    const labels = {
      aliorBank: 'Alior Bank',
      ingBank: 'ING Bank',
      cash: 'Gotówka',
    };
    return labels[method] || method || '—';
  }

  function paymentMethodClass(method) {
    const map = {
      aliorBank: 'badge-alior',
      ingBank: 'badge-ing',
      cash: 'badge-cash',
    };
    return map[method] || 'badge-cash';
  }

  function currentMonthSessions() {
    const key = monthKey(new Date());
    return getSessions().filter((session) => monthKey(session.date) === key);
  }

  function outstandingSessions() {
    return getSessions().filter((session) => {
      if (session.isPaid || !session.isPaymentRequired) return false;
      return session.status === 'completed' || session.status === 'cancelled';
    });
  }

  function outstandingByPatient() {
    const grouped = {};
    outstandingSessions().forEach((session) => {
      if (!grouped[session.patientId]) {
        grouped[session.patientId] = { sessions: [], total: 0 };
      }
      grouped[session.patientId].sessions.push(session);
      grouped[session.patientId].total += sessionAmount(session);
    });
    return grouped;
  }

  function revenueByMethod(periodSessions) {
    const totals = { aliorBank: 0, ingBank: 0, cash: 0 };
    periodSessions.forEach((session) => {
      if (!session.isPaid) return;
      const method = session.paymentMethod || 'cash';
      totals[method] = (totals[method] || 0) + sessionAmount(session);
    });
    return totals;
  }

  function monthlyRevenueSeries(limit = 6) {
    const now = new Date();
    const points = [];
    for (let index = limit - 1; index >= 0; index -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = monthKey(monthDate);
      const total = getSessions()
        .filter((session) => monthKey(session.date) === key && session.isPaid)
        .reduce((sum, session) => sum + sessionAmount(session), 0);
      points.push({
        label: monthDate.toLocaleDateString('pl-PL', { month: 'short' }),
        value: total,
      });
    }
    return points;
  }

  function renderRevenueBars() {
    const points = monthlyRevenueSeries(6);
    const max = Math.max(...points.map((point) => point.value), 1);
    return (
      '<div class="fin-bar-chart">' +
      points.map((point) => (
        '<div class="fin-bar">' +
          '<div class="fin-bar__value">' + (point.value ? escHtml(formatCurrency(point.value)) : '&nbsp;') + '</div>' +
          '<div class="fin-bar__column" style="height:' + Math.max(18, Math.round((point.value / max) * 180)) + 'px"></div>' +
          '<div class="fin-bar__label">' + escHtml(point.label) + '</div>' +
        '</div>'
      )).join('') +
      '</div>'
    );
  }

  function renderDashboard() {
    const monthSessions = currentMonthSessions();
    const completed = monthSessions.filter((session) => session.status === 'completed').length;
    const paid = monthSessions.filter((session) => session.isPaid).length;
    const monthRevenue = monthSessions.filter((session) => session.isPaid)
      .reduce((sum, session) => sum + sessionAmount(session), 0);
    const outstanding = outstandingSessions();
    const outstandingTotal = outstanding.reduce((sum, session) => sum + sessionAmount(session), 0);
    const methods = revenueByMethod(monthSessions);
    const debtMap = outstandingByPatient();
    const debtRows = Object.keys(debtMap).map((patientId) => {
      const patient = getPatient(patientId);
      const name = patient ? (patient.pseudonym || patient.firstName || 'Pacjent') : 'Pacjent';
      return (
        '<div class="fin-debt-row">' +
          '<span class="fin-debt-name">' + escHtml(name) + '</span>' +
          '<span class="fin-debt-count">' + debtMap[patientId].sessions.length + ' ses.</span>' +
          '<span class="fin-debt-amount">' + escHtml(formatCurrency(debtMap[patientId].total)) + '</span>' +
        '</div>'
      );
    }).join('');
    const yearlyRevenue = getSessions()
      .filter((session) => new Date(session.date).getFullYear() === new Date().getFullYear() && session.isPaid)
      .reduce((sum, session) => sum + sessionAmount(session), 0);
    const averageMonthlyRevenue = yearlyRevenue / (new Date().getMonth() + 1);

    return (
      '<div class="fin-dashboard">' +
        '<section class="fin-shell">' +
          '<div class="fin-hero">' +
            '<div>' +
              '<span class="fin-kicker">Finanse</span>' +
              '<h1 class="fin-title">Kondycja gabinetu bez arkuszy i zgadywania.</h1>' +
              '<p class="fin-text">Zobacz bieżący przychód, zaległości i najważniejsze działania finansowe w jednym spokojnym panelu.</p>' +
              '<div class="fin-actions">' +
                '<button class="fin-action fin-action--primary" id="fin-open-add-payment">Zarejestruj płatność</button>' +
                '<button class="fin-action" id="fin-open-patients">Przejdź do pacjentów</button>' +
              '</div>' +
            '</div>' +
            '<div class="fin-highlight">' +
              '<span class="fin-highlight__eyebrow">Bieżący miesiąc</span>' +
              '<strong>' + escHtml(formatCurrency(monthRevenue)) + '</strong>' +
              '<span>' + paid + ' opłaconych sesji i ' + completed + ' odbytych spotkań.</span>' +
            '</div>' +
          '</div>' +
          '<div class="fin-metric-grid">' +
            '<article class="fin-metric"><span>Przychód</span><strong>' + escHtml(formatCurrency(monthRevenue)) + '</strong><small>bieżący miesiąc</small></article>' +
            '<article class="fin-metric"><span>Należności</span><strong>' + escHtml(formatCurrency(outstandingTotal)) + '</strong><small>' + outstanding.length + ' sesji czeka na rozliczenie</small></article>' +
            '<article class="fin-metric"><span>Pacjenci z zaległościami</span><strong>' + Object.keys(debtMap).length + '</strong><small>potrzebują spokojnej reakcji</small></article>' +
            '<article class="fin-metric"><span>Śr. przychód / miesiąc</span><strong>' + escHtml(formatCurrency(averageMonthlyRevenue)) + '</strong><small>rok bieżący</small></article>' +
          '</div>' +
        '</section>' +

        '<div class="fin-split">' +
          '<section class="fin-section">' +
            '<h2 class="fin-section-title">Metody płatności</h2>' +
            '<div class="fin-method-list">' +
              '<div class="fin-method-row"><span class="fin-method-label"><span class="fin-method-badge badge-alior">Alior Bank</span></span><span class="fin-method-amount">' + escHtml(formatCurrency(methods.aliorBank)) + '</span></div>' +
              '<div class="fin-method-row"><span class="fin-method-label"><span class="fin-method-badge badge-ing">ING Bank</span></span><span class="fin-method-amount">' + escHtml(formatCurrency(methods.ingBank)) + '</span></div>' +
              '<div class="fin-method-row"><span class="fin-method-label"><span class="fin-method-badge badge-cash">Gotówka</span></span><span class="fin-method-amount">' + escHtml(formatCurrency(methods.cash)) + '</span></div>' +
            '</div>' +
          '</section>' +

          '<section class="fin-section">' +
            '<h2 class="fin-section-title">Rzeczy wymagające uwagi</h2>' +
            '<div class="fin-actions-list">' +
              '<div class="fin-action-row"><div><strong>' + outstanding.length + ' sesji do rozliczenia</strong><span>zaległe lub odwołane płatne spotkania</span></div></div>' +
              '<div class="fin-action-row"><div><strong>' + Object.keys(debtMap).length + ' pacjentów z należnościami</strong><span>warto sprawdzić kontekst terapii i ostatnie ustalenia</span></div></div>' +
              '<div class="fin-action-row"><div><strong>' + paid + ' opłaconych w tym miesiącu</strong><span>bieżący rytm przychodów gabinetu</span></div></div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<section class="fin-section">' +
          '<h2 class="fin-section-title">Trend przychodów</h2>' +
          renderRevenueBars() +
        '</section>' +

        '<section class="fin-section">' +
          '<h2 class="fin-section-title">Zaległości według pacjenta</h2>' +
          (debtRows || '<p class="fin-empty">Brak zaległości. Gabinet jest rozliczony na dziś.</p>') +
        '</section>' +
      '</div>'
    );
  }

  function filteredPayments() {
    return getPayments()
      .filter((payment) => {
        if (paymentFilters.method !== 'all' && payment.method !== paymentFilters.method) return false;
        if (paymentFilters.from && payment.date < paymentFilters.from) return false;
        if (paymentFilters.to && payment.date > paymentFilters.to) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function renderPayments() {
    const payments = filteredPayments();
    const total = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return (
      '<div class="fin-payments">' +
        '<section class="fin-shell">' +
          '<div class="fin-payments-toolbar">' +
            '<button class="fin-action fin-action--primary" id="fin-open-add-payment">Zarejestruj płatność</button>' +
            '<div class="fin-filter-row">' +
              '<button class="fin-chip ' + (paymentFilters.method === 'all' ? 'active' : '') + '" data-method="all">Wszystkie</button>' +
              '<button class="fin-chip ' + (paymentFilters.method === 'aliorBank' ? 'active' : '') + '" data-method="aliorBank">Alior</button>' +
              '<button class="fin-chip ' + (paymentFilters.method === 'ingBank' ? 'active' : '') + '" data-method="ingBank">ING</button>' +
              '<button class="fin-chip ' + (paymentFilters.method === 'cash' ? 'active' : '') + '" data-method="cash">Gotówka</button>' +
            '</div>' +
          '</div>' +
          '<div class="fin-filter-row">' +
            '<label class="fin-date-group">Od <input type="date" id="fin-filter-from" value="' + escHtml(paymentFilters.from) + '"></label>' +
            '<label class="fin-date-group">Do <input type="date" id="fin-filter-to" value="' + escHtml(paymentFilters.to) + '"></label>' +
          '</div>' +
          '<div class="fin-summary"><span>' + payments.length + ' płatności</span><strong>' + escHtml(formatCurrency(total)) + '</strong></div>' +
        '</section>' +
        '<div class="fin-payment-list">' +
          (payments.map((payment) => {
            const patient = getPatient(payment.patientId);
            const display = patient ? (patient.pseudonym || patient.firstName || 'Pacjent') : 'Pacjent';
            const fullName = patient ? ((patient.firstName || '') + ' ' + (patient.lastName || '')).trim() : '';
            return (
              '<article class="fin-payment-row">' +
                '<div class="fin-payment-main" data-payment-detail="' + escHtml(payment.id) + '">' +
                  '<div class="fin-payment-top">' +
                    '<span class="fin-payment-date">' + escHtml(formatDateLong(payment.date)) + '</span>' +
                    '<span class="fin-method-badge ' + paymentMethodClass(payment.method) + '">' + escHtml(paymentMethodLabel(payment.method)) + '</span>' +
                    '<span class="fin-payment-amount">' + escHtml(formatCurrency(payment.amount)) + '</span>' +
                  '</div>' +
                  '<span class="fin-payment-patient">' + escHtml(display) + '</span>' +
                  '<div class="fin-payment-sub">' +
                    (fullName ? '<span>' + escHtml(fullName) + '</span>' : '') +
                    '<span>' + (payment.sessionIds || []).length + ' sesji</span>' +
                  '</div>' +
                  (payment.note ? '<div class="fin-payment-note">' + escHtml(payment.note) + '</div>' : '') +
                '</div>' +
                '<div class="fin-payment-actions">' +
                  '<button class="fin-btn-icon" data-payment-edit="' + escHtml(payment.id) + '" aria-label="Edytuj">✎</button>' +
                  '<button class="fin-btn-icon fin-btn-icon--danger" data-payment-delete="' + escHtml(payment.id) + '" aria-label="Usuń">🗑</button>' +
                '</div>' +
              '</article>'
            );
          }).join('')) ||
          '<p class="fin-empty">Brak płatności spełniających te kryteria.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function render(container) {
    injectStyles();
    containerRef = container;
    container.innerHTML = (
      '<div class="fin-view">' +
        '<div class="fin-tabs">' +
          '<button class="fin-tab ' + (currentTab === 'dashboard' ? 'active' : '') + '" data-tab="dashboard">Kondycja gabinetu</button>' +
          '<button class="fin-tab ' + (currentTab === 'payments' ? 'active' : '') + '" data-tab="payments">Płatności</button>' +
        '</div>' +
        '<div id="fin-content">' + (currentTab === 'dashboard' ? renderDashboard() : renderPayments()) + '</div>' +
      '</div>'
    );
    bindViewEvents(container);
  }

  /** Odswieza tylko zawartosc taba bez przebudowy calego DOM. */
  function _refreshTabContent(container) {
    const content = container.querySelector('#fin-content');
    if (!content) { render(container); return; }
    content.innerHTML = currentTab === 'dashboard' ? renderDashboard() : renderPayments();
    // Aktualizuj klase active na tabach
    container.querySelectorAll('.fin-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === currentTab);
    });
    _bindContentEvents(container);
  }

  /** Binduje eventy wewnatrz #fin-content (bez tabow). */
  function _bindContentEvents(container) {
    container.querySelectorAll('#fin-open-add-payment').forEach((button) => {
      button.addEventListener('click', () => openAddPayment());
    });
    const patientsButton = container.querySelector('#fin-open-patients');
    if (patientsButton) {
      patientsButton.addEventListener('click', () => Router.navigate('patients'));
    }
    container.querySelectorAll('.fin-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        paymentFilters.method = chip.dataset.method;
        _refreshTabContent(container);
      });
    });
    const filterFrom = container.querySelector('#fin-filter-from');
    const filterTo = container.querySelector('#fin-filter-to');
    if (filterFrom) {
      filterFrom.addEventListener('change', () => {
        paymentFilters.from = filterFrom.value;
        _refreshTabContent(container);
      });
    }
    if (filterTo) {
      filterTo.addEventListener('change', () => {
        paymentFilters.to = filterTo.value;
        _refreshTabContent(container);
      });
    }
    container.querySelectorAll('[data-payment-detail]').forEach((element) => {
      element.addEventListener('click', () => openPaymentDetail(element.dataset.paymentDetail));
    });
    container.querySelectorAll('[data-payment-edit]').forEach((button) => {
      button.addEventListener('click', () => openEditPayment(button.dataset.paymentEdit));
    });
    container.querySelectorAll('[data-payment-delete]').forEach((button) => {
      button.addEventListener('click', () => confirmDeletePayment(button.dataset.paymentDelete));
    });
  }

  function bindViewEvents(container) {
    container.querySelectorAll('.fin-tab').forEach((button) => {
      button.addEventListener('click', () => {
        currentTab = button.dataset.tab;
        _refreshTabContent(container);
      });
    });

    _bindContentEvents(container);
  }

  function unpaidSessionsForPatient(patientId, selectedIds = []) {
    const selected = new Set(selectedIds);
    return getSessions()
      .filter((session) => {
        if (session.patientId !== patientId) return false;
        if (!session.isPaymentRequired) return false;
        if (session.isPaid && !selected.has(session.id)) return false;
        return session.status === 'completed' || session.status === 'cancelled' || session.status === 'scheduled';
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function renderSessionCheckboxes(patientId, selectedIds = []) {
    const sessions = unpaidSessionsForPatient(patientId, selectedIds);
    if (!sessions.length) {
      return '<p class="fin-empty">Brak sesji do rozliczenia dla tego pacjenta.</p>';
    }
    const selected = new Set(selectedIds);
    return sessions.map((session) => {
      const patient = getPatient(session.patientId);
      const amount = sessionAmount(session);
      const display = patient ? (patient.pseudonym || patient.firstName || 'Pacjent') : 'Pacjent';
      const checked = selected.has(session.id) ? ' checked' : '';
      return (
        '<label class="fin-session-check">' +
          '<input type="checkbox" class="fin-session-cb" value="' + escHtml(session.id) + '"' + checked + '>' +
          '<span class="fin-session-check-label">' +
            escHtml(display) + ' • ' + escHtml(formatDateMedium(session.date)) + ' • ' + escHtml(formatTime(session.date)) +
            '<small>' + escHtml(formatCurrency(amount)) + ' • ' + escHtml(session.status === 'completed' ? 'odbyta' : session.status === 'cancelled' ? 'odwołana' : 'zaplanowana') + '</small>' +
          '</span>' +
        '</label>'
      );
    }).join('');
  }

  function selectedSessionIds(sheet) {
    return Array.from(sheet.querySelectorAll('.fin-session-cb:checked')).map((input) => input.value);
  }

  function selectedTotal(sheet) {
    return selectedSessionIds(sheet).reduce((sum, sessionId) => {
      const session = getSessions().find((item) => item.id === sessionId);
      return sum + (session ? sessionAmount(session) : 0);
    }, 0);
  }

  function renderPaymentSheet(payment) {
    const isEdit = Boolean(payment);
    const patients = AppState.activePatients.slice().sort((a, b) => displayPatientName(a).localeCompare(displayPatientName(b), 'pl'));
    const selectedMethod = payment ? payment.method : 'cash';
    const patientId = payment ? payment.patientId : '';
    const selectedIds = payment ? (payment.sessionIds || []) : [];
    return (
      '<div class="fin-sheet-overlay" id="fin-payment-sheet">' +
        '<div class="fin-sheet-panel">' +
          '<div class="fin-sheet-header">' +
            '<div>' +
              '<h2 class="fin-sheet-title">' + (isEdit ? 'Edytuj płatność' : 'Zarejestruj płatność') + '</h2>' +
              '<p class="fin-sheet-subtitle">Przypisz płatność do konkretnych sesji i zachowaj porządek w rozliczeniach.</p>' +
            '</div>' +
            '<button class="fin-sheet-close" type="button" id="fin-close-sheet">✕</button>' +
          '</div>' +
          '<div class="fin-form-grid">' +
            '<div class="fin-form-group">' +
              '<label for="fin-sheet-patient">Pacjent</label>' +
              '<select class="fin-select" id="fin-sheet-patient">' +
                '<option value="">Wybierz pacjenta</option>' +
                patients.map((patient) => '<option value="' + escHtml(patient.id) + '"' + (patient.id === patientId ? ' selected' : '') + '>' + escHtml(displayPatientName(patient)) + '</option>').join('') +
              '</select>' +
            '</div>' +
            '<div class="fin-form-group">' +
              '<label for="fin-sheet-date">Data płatności</label>' +
              '<input class="fin-input" type="date" id="fin-sheet-date" value="' + escHtml(payment ? payment.date : new Date().toISOString().slice(0, 10)) + '">' +
            '</div>' +
            '<div class="fin-form-group fin-form-group--full">' +
              '<label>Metoda płatności</label>' +
              '<div class="fin-method-toggle" id="fin-method-toggle">' +
                '<button class="fin-method-btn ' + (selectedMethod === 'aliorBank' ? 'active' : '') + '" type="button" data-method="aliorBank">Alior Bank</button>' +
                '<button class="fin-method-btn ' + (selectedMethod === 'ingBank' ? 'active' : '') + '" type="button" data-method="ingBank">ING Bank</button>' +
                '<button class="fin-method-btn ' + (selectedMethod === 'cash' ? 'active' : '') + '" type="button" data-method="cash">Gotówka</button>' +
              '</div>' +
              '<input type="hidden" id="fin-sheet-method" value="' + escHtml(selectedMethod) + '">' +
            '</div>' +
            '<div class="fin-form-group fin-form-group--full">' +
              '<label>Sesje do rozliczenia</label>' +
              '<div class="fin-session-list" id="fin-sheet-sessions">' +
                (patientId ? renderSessionCheckboxes(patientId, selectedIds) : '<p class="fin-empty">Wybierz pacjenta, aby zobaczyć sesje.</p>') +
              '</div>' +
            '</div>' +
            '<div class="fin-form-group">' +
              '<label>Kwota łączna</label>' +
              '<div class="fin-total-box"><strong id="fin-sheet-total">' + escHtml(formatCurrency((payment && payment.amount) || 0)) + '</strong><span>Wyliczana na podstawie zaznaczonych sesji</span></div>' +
            '</div>' +
            '<div class="fin-form-group">' +
              '<label for="fin-sheet-note">Notatka</label>' +
              '<textarea class="fin-textarea" id="fin-sheet-note">' + escHtml(payment ? (payment.note || '') : '') + '</textarea>' +
            '</div>' +
          '</div>' +
          '<div class="fin-sheet-actions">' +
            '<button class="fin-action" type="button" id="fin-cancel-sheet">Anuluj</button>' +
            '<button class="fin-action fin-action--primary" type="button" id="fin-save-sheet">' + (isEdit ? 'Zapisz zmiany' : 'Zapisz płatność') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function openPaymentSheet(payment) {
    const existing = document.getElementById('fin-payment-sheet');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', renderPaymentSheet(payment));
    bindPaymentSheetEvents(payment);
  }

  function bindPaymentSheetEvents(payment) {
    const sheet = document.getElementById('fin-payment-sheet');
    if (!sheet) return;
    const patientSelect = sheet.querySelector('#fin-sheet-patient');
    const sessionsWrap = sheet.querySelector('#fin-sheet-sessions');
    const totalEl = sheet.querySelector('#fin-sheet-total');
    const methodInput = sheet.querySelector('#fin-sheet-method');
    const selectedIds = payment ? (payment.sessionIds || []) : [];

    function refreshTotal() {
      if (totalEl) totalEl.textContent = formatCurrency(selectedTotal(sheet));
    }

    function bindCheckboxes() {
      sheet.querySelectorAll('.fin-session-cb').forEach((checkbox) => {
        checkbox.addEventListener('change', refreshTotal);
      });
      refreshTotal();
    }

    if (patientSelect) {
      patientSelect.addEventListener('change', () => {
        sessionsWrap.innerHTML = patientSelect.value
          ? renderSessionCheckboxes(patientSelect.value, [])
          : '<p class="fin-empty">Wybierz pacjenta, aby zobaczyć sesje.</p>';
        bindCheckboxes();
      });
    }

    sheet.querySelectorAll('.fin-method-btn').forEach((button) => {
      button.addEventListener('click', () => {
        sheet.querySelectorAll('.fin-method-btn').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        methodInput.value = button.dataset.method;
      });
    });

    bindCheckboxes();
    if (!payment && selectedIds.length === 0) refreshTotal();

    sheet.querySelector('#fin-close-sheet').addEventListener('click', closePaymentSheet);
    sheet.querySelector('#fin-cancel-sheet').addEventListener('click', closePaymentSheet);
    sheet.querySelector('#fin-save-sheet').addEventListener('click', () => savePayment(payment ? payment.id : null));
    sheet.addEventListener('click', (event) => {
      if (event.target === sheet) closePaymentSheet();
    });
  }

  function closePaymentSheet() {
    const sheet = document.getElementById('fin-payment-sheet');
    if (sheet) sheet.remove();
  }

  function openAddPayment() {
    openPaymentSheet(null);
  }

  function openEditPayment(paymentId) {
    const payment = getPayments().find((item) => item.id === paymentId);
    if (!payment) return;
    openPaymentSheet(payment);
  }

  function savePayment(existingId) {
    const sheet = document.getElementById('fin-payment-sheet');
    if (!sheet) return;
    const patientId = sheet.querySelector('#fin-sheet-patient').value;
    const date = sheet.querySelector('#fin-sheet-date').value;
    const method = sheet.querySelector('#fin-sheet-method').value || 'cash';
    const note = sheet.querySelector('#fin-sheet-note').value.trim();
    const sessionIds = selectedSessionIds(sheet);

    if (!patientId) {
      toast('Wybierz pacjenta.', 'warning');
      return;
    }
    if (!date) {
      toast('Podaj datę płatności.', 'warning');
      return;
    }
    if (!sessionIds.length) {
      toast('Wybierz co najmniej jedną sesję.', 'warning');
      return;
    }

    try {
      if (typeof recordPaymentForSessions !== 'function') {
        throw new Error('Brak helpera recordPaymentForSessions.');
      }

      recordPaymentForSessions({
        id: existingId || null,
        patientId,
        date,
        method,
        note,
        sessionIds,
      });
    } catch (error) {
      toast('Nie udało się zapisać płatności: ' + error.message, 'error');
      return;
    }

    persistData();
    closePaymentSheet();
    if (containerRef) render(containerRef);
    toast(existingId ? 'Płatność zaktualizowana.' : 'Płatność zapisana.', 'success');
  }

  function confirmDeletePayment(paymentId) {
    if (!confirm('Czy na pewno chcesz usunąć tę płatność? Sesje wrócą do stanu nieopłaconych.')) return;
    deletePayment(paymentId);
  }

  function deletePayment(paymentId) {
    if (typeof detachPaymentFromSessions !== 'function') return;
    const payment = detachPaymentFromSessions(paymentId);
    if (!payment) return;
    persistData();
    if (containerRef) render(containerRef);
    toast('Płatność usunięta.', 'success');
  }

  function openPaymentDetail(paymentId) {
    const payment = getPayments().find((item) => item.id === paymentId);
    if (!payment) return;
    const patient = getPatient(payment.patientId);
    const display = patient ? (patient.pseudonym || patient.firstName || 'Pacjent') : 'Pacjent';
    const fullName = patient ? ((patient.firstName || '') + ' ' + (patient.lastName || '')).trim() : '';
    const existing = document.getElementById('fin-payment-detail');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend',
      '<div class="fin-sheet-overlay" id="fin-payment-detail">' +
        '<div class="fin-sheet-panel">' +
          '<div class="fin-sheet-header">' +
            '<div>' +
              '<h2 class="fin-sheet-title">Szczegóły płatności</h2>' +
              '<p class="fin-sheet-subtitle">Pełny kontekst rozliczenia dla wybranych sesji.</p>' +
            '</div>' +
            '<button class="fin-sheet-close" type="button" id="fin-close-detail">✕</button>' +
          '</div>' +
          '<div class="fin-detail-stack">' +
            '<div class="fin-detail-row"><span>Pacjent</span><strong>' + escHtml(display + (fullName ? ` (${fullName})` : '')) + '</strong></div>' +
            '<div class="fin-detail-row"><span>Data płatności</span><strong>' + escHtml(formatDateLong(payment.date)) + '</strong></div>' +
            '<div class="fin-detail-row"><span>Metoda</span><strong class="fin-method-badge ' + paymentMethodClass(payment.method) + '">' + escHtml(paymentMethodLabel(payment.method)) + '</strong></div>' +
            '<div class="fin-detail-row"><span>Kwota</span><strong>' + escHtml(formatCurrency(payment.amount)) + '</strong></div>' +
            (payment.note ? '<div class="fin-detail-row"><span>Notatka</span><strong>' + escHtml(payment.note) + '</strong></div>' : '') +
            '<div class="fin-detail-sessions">' +
              (payment.sessionIds || []).map((sessionId) => {
                const session = getSessions().find((item) => item.id === sessionId);
                if (!session) return '';
                return '<div class="fin-detail-session"><span>' + escHtml(formatDateMedium(session.date)) + ' • ' + escHtml(formatTime(session.date)) + '</span><strong>' + escHtml(formatCurrency(sessionAmount(session))) + '</strong></div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="fin-sheet-actions">' +
            '<button class="fin-action fin-action--primary" type="button" id="fin-edit-detail">Edytuj płatność</button>' +
            '<button class="fin-action" type="button" id="fin-delete-detail">Usuń</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    const detail = document.getElementById('fin-payment-detail');
    detail.querySelector('#fin-close-detail').addEventListener('click', () => detail.remove());
    detail.querySelector('#fin-edit-detail').addEventListener('click', () => {
      detail.remove();
      openEditPayment(payment.id);
    });
    detail.querySelector('#fin-delete-detail').addEventListener('click', () => {
      detail.remove();
      confirmDeletePayment(payment.id);
    });
    detail.addEventListener('click', (event) => {
      if (event.target === detail) detail.remove();
    });
  }

  return {
    render,
    openAddPayment,
    openEditPayment,
    savePayment,
    closePaymentSheet,
    confirmDeletePayment,
    deletePayment,
    openPaymentDetail,
  };
})();

function renderFinance(params) {
  void params;
  const container = document.getElementById('view-container');
  if (!container) return;
  FinanceViews.render(container);
}
