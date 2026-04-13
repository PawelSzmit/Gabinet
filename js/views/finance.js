// finance.js - Refreshed finance workspace for Gabinet PWA

'use strict';

const FinanceViews = (() => {
  let currentTab = 'dashboard';
  let containerRef = null;
  let paymentFilters = { method: 'all', from: '', to: '' };
  let chartPeriod = 6;

  function injectStyles() {
    if (document.getElementById('fin-styles')) return;
    const style = document.createElement('style');
    style.id = 'fin-styles';
    style.textContent = [
      '.fin-view{display:flex;flex-direction:column;gap:14px;padding:18px 18px calc(var(--tab-bar-height) + 30px);font-family:var(--font-sans,"Manrope",sans-serif);scrollbar-width:none}',
      '.fin-view::-webkit-scrollbar{display:none}',
      '.fin-shell,.fin-tabs,.fin-section,.fin-payment-row,.fin-sheet-panel{background:color-mix(in srgb,var(--surface-raised,#f7f2eb) 92%, transparent);border:1px solid var(--border,rgba(73,102,79,.14));box-shadow:var(--shadow-sm)}',
      '.fin-shell{border-radius:30px;padding:24px}',
      '.fin-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start}',
      '.fin-kicker{display:inline-block;margin-bottom:10px;font-size:.72rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--blue,#49664f)}',
      '.fin-title{margin:0;font-family:var(--font-display,"Fraunces",serif);font-size:clamp(1.5rem,3vw,2.4rem);line-height:1;letter-spacing:-.04em;color:var(--text,#243126);white-space:nowrap}',
      '.fin-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}',
      '.fin-period-toggle{display:flex;gap:4px;background:rgba(255,255,255,.48);border-radius:999px;padding:4px;border:1px solid var(--border,rgba(73,102,79,.12))}',
      '.fin-period-btn{border:none;background:transparent;padding:7px 11px;border-radius:999px;font-size:.74rem;font-weight:800;cursor:pointer;color:var(--text-secondary,rgba(36,49,38,.68))}',
      '.fin-period-btn.active{background:#fff;color:var(--blue,#49664f);box-shadow:0 4px 10px rgba(31,43,35,.08)}',
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
      '.fin-method-row,.fin-debt-row,.fin-action-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;padding:14px 16px;border-radius:20px;background:rgba(255,255,255,.62);border:1px solid var(--border,rgba(73,102,79,.1))}',
      '.fin-method-label,.fin-debt-name,.fin-action-row strong{color:var(--text,#243126);font-weight:700}',
      '.fin-method-amount,.fin-debt-amount{color:var(--text,#243126);font-weight:800;text-align:right;white-space:nowrap}',
      '.fin-debt-count,.fin-action-row span{color:var(--text-secondary,rgba(36,49,38,.68));font-size:.82rem;text-align:right;white-space:nowrap}',
      '.fin-method-badge{display:inline-flex;align-items:center;padding:.35rem .7rem;border-radius:999px;font-size:.74rem;font-weight:800}',
      '.fin-method-badge.badge-alior{background:rgba(191,97,82,.12);color:var(--red,#bf6152)}',
      '.fin-method-badge.badge-ing{background:rgba(204,139,86,.14);color:var(--orange,#cc8b56)}',
      '.fin-method-badge.badge-cash{background:rgba(107,144,115,.14);color:var(--green,#6b9073)}',
      '.fin-method-badge.badge-pm4{background:rgba(73,102,79,.1);color:var(--blue,#49664f)}',
      '.fin-method-badge.badge-split{background:rgba(73,102,79,.1);color:var(--blue,#49664f)}',
      '.fin-split-label{display:flex;align-items:center;gap:.5rem;font-size:.88rem;font-weight:600;cursor:pointer;color:var(--text,#243126)}',
      '.fin-split-label input[type=checkbox]{width:17px;height:17px;accent-color:var(--blue,#49664f);cursor:pointer}',
      '.fin-split-amount-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}',
      '.fin-split-amount-item{display:flex;flex-direction:column;gap:6px}',
      '.fin-split-amount-label{font-size:.78rem;font-weight:700;color:var(--text-secondary,rgba(36,49,38,.68));text-transform:uppercase;letter-spacing:.06em}',
      '.fin-split-amount-readonly{background:var(--surface-raised,#f7f2eb)!important;color:var(--text-secondary,rgba(36,49,38,.68))!important;cursor:default}',
      '.fin-detail-split{padding-left:24px;border-left:2px solid var(--border,rgba(73,102,79,.14))}',
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
      '.fin-balance-info{margin-top:8px;padding:10px 14px;border-radius:14px;font-size:.84rem;line-height:1.55}',
      '.fin-balance-info--over{background:rgba(107,144,115,.12);color:#3a5c42}',
      '.fin-balance-info--under{background:rgba(204,139,86,.14);color:#8a5a1a}',
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
    return AppState.patients.find((patient) => patient.id === id) || null;
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

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function monthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function sessionAmount(session) {
    const patient = getPatient(session.patientId);
    return session.paymentAmount !== null && session.paymentAmount !== undefined
      ? session.paymentAmount
      : (patient ? patient.sessionRate : 0);
  }

  function normalizeFinanceMethodId(methodId) {
    if (typeof normalizePaymentMethodId === 'function') {
      return normalizePaymentMethodId(methodId);
    }
    return methodId || null;
  }

  function paymentPrimaryMethodId(payment) {
    return normalizeFinanceMethodId(payment && (payment.methodId || payment.method));
  }

  function paymentSecondaryMethodId(payment) {
    return normalizeFinanceMethodId(payment && (payment.splitMethodId || payment.splitMethod));
  }

  function paymentMethodLabelForDate(methodId, referenceDate) {
    const normalizedMethodId = normalizeFinanceMethodId(methodId);
    if (!normalizedMethodId) return '—';

    if (typeof getResolvedPaymentMethodLabelForDate === 'function') {
      return getResolvedPaymentMethodLabelForDate(normalizedMethodId, referenceDate);
    }

    if (typeof getPaymentMethodLabelForDate === 'function') {
      return getPaymentMethodLabelForDate(normalizedMethodId, referenceDate) || normalizedMethodId;
    }

    return normalizedMethodId;
  }

  function paymentMethodCurrentLabel(methodId, fallbackDate) {
    const normalizedMethodId = normalizeFinanceMethodId(methodId);
    if (!normalizedMethodId) return '—';

    if (typeof getCurrentPaymentMethodLabel === 'function') {
      const label = getCurrentPaymentMethodLabel(normalizedMethodId);
      if (label) return label;
    }

    if (typeof getPaymentMethodLabelForDate === 'function') {
      const label = getPaymentMethodLabelForDate(normalizedMethodId, fallbackDate || new Date());
      if (label) return label;
    }

    return normalizedMethodId;
  }

  function paymentMethodClass(methodId, isSplit) {
    if (isSplit) return 'badge-split';
    const normalizedMethodId = normalizeFinanceMethodId(methodId);
    const map = {
      pm1: 'badge-alior',
      pm2: 'badge-ing',
      pm3: 'badge-cash',
      pm4: 'badge-pm4',
    };
    return map[normalizedMethodId] || 'badge-split';
  }

  function paymentCompoundLabel(payment) {
    if (!payment) return '—';
    const date = payment.date || new Date();
    const primaryId = paymentPrimaryMethodId(payment);
    if (!payment.isSplit) {
      return paymentMethodLabelForDate(primaryId, date);
    }
    const secondaryId = paymentSecondaryMethodId(payment);
    return paymentMethodLabelForDate(primaryId, date) + ' + ' + paymentMethodLabelForDate(secondaryId, date);
  }

  function activeMethodOptions(referenceDate) {
    if (typeof getActivePaymentMethodOptions === 'function') {
      return getActivePaymentMethodOptions(referenceDate).map((option) => ({
        id: normalizeFinanceMethodId(option.id),
        label: option.label,
      })).filter((option) => option.id && option.label);
    }
    return [];
  }

  function paymentMethodOptionsForDate(referenceDate, selectedIds = []) {
    const options = [];
    const seen = new Set();

    activeMethodOptions(referenceDate).forEach((option) => {
      if (!option.id || seen.has(option.id)) return;
      seen.add(option.id);
      options.push(option);
    });

    selectedIds
      .map(normalizeFinanceMethodId)
      .filter(Boolean)
      .forEach((methodId) => {
        if (seen.has(methodId)) return;
        seen.add(methodId);
        options.push({
          id: methodId,
          label: paymentMethodLabelForDate(methodId, referenceDate),
        });
      });

    return options;
  }

  function splitSecondaryMethodOptions(options, primaryMethodId) {
    const normalizedPrimary = normalizeFinanceMethodId(primaryMethodId);
    return (Array.isArray(options) ? options : []).filter((option) => option.id !== normalizedPrimary);
  }

  function currentFilterMethodOptions() {
    return activeMethodOptions(new Date());
  }

  function currentMonthSessions() {
    const key = monthKey(new Date());
    return getSessions().filter((session) => monthKey(session.date) === key);
  }

  function paymentsForMonth(key) {
    return getPayments().filter((payment) => monthKey(payment.date) === key);
  }

  function currentMonthPayments() {
    return paymentsForMonth(monthKey(new Date()));
  }

  function paymentDayKey(paymentDate) {
    const date = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
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
      const full = sessionAmount(session);
      const owed = session.isPartiallyPaid && session.partialPaymentAmount
        ? full - session.partialPaymentAmount
        : full;
      grouped[session.patientId].total += owed;
    });
    return grouped;
  }

  function revenueByMethod(periodPayments) {
    const totals = {};
    periodPayments.forEach((payment) => {
      const primaryMethod = paymentPrimaryMethodId(payment);
      const secondaryMethod = paymentSecondaryMethodId(payment);
      if (payment.isSplit && payment.splitAmounts) {
        if (primaryMethod) totals[primaryMethod] = (totals[primaryMethod] || 0) + (Number(payment.splitAmounts.primary) || 0);
        if (secondaryMethod) totals[secondaryMethod] = (totals[secondaryMethod] || 0) + (Number(payment.splitAmounts.secondary) || 0);
        return;
      }

      if (!primaryMethod) return;
      totals[primaryMethod] = (totals[primaryMethod] || 0) + (Number(payment.amount) || 0);
    });
    return totals;
  }

  function monthlyRevenueSeries(limit = 6) {
    const now = new Date();
    const points = [];
    for (let index = limit - 1; index >= 0; index -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = monthKey(monthDate);
      const total = paymentsForMonth(key)
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      points.push({
        label: monthDate.toLocaleDateString('pl-PL', { month: 'short' }),
        value: total,
      });
    }
    return points;
  }

  function renderRevenueBars(period) {
    const points = monthlyRevenueSeries(period);
    const max = Math.max(...points.map((point) => point.value), 1);
    const cols = period <= 3 ? 3 : period <= 6 ? 6 : 12;
    return (
      '<div class="fin-bar-chart" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' +
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
    const monthPayments = currentMonthPayments();
    const completed = monthSessions.filter((session) => session.status === 'completed').length;
    const coveredSessions = monthPayments.reduce((sum, payment) => sum + ((payment.sessionIds || []).length), 0);
    const monthRevenue = monthPayments
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const outstanding = outstandingSessions();
    const outstandingTotal = outstanding.reduce((sum, session) => {
      const full = sessionAmount(session);
      const owed = session.isPartiallyPaid && session.partialPaymentAmount
        ? full - session.partialPaymentAmount
        : full;
      return sum + owed;
    }, 0);
    const methods = revenueByMethod(monthPayments);
    const methodIds = Array.from(new Set(
      currentFilterMethodOptions().map((option) => option.id)
        .concat(Object.keys(methods))
    ));
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
    const yearlyRevenue = getPayments()
      .filter((payment) => new Date(payment.date).getFullYear() === new Date().getFullYear())
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const averageMonthlyRevenue = yearlyRevenue / (new Date().getMonth() + 1);

    return (
      '<div class="fin-dashboard">' +
        '<section class="fin-shell">' +
          '<div class="fin-hero">' +
            '<div>' +
              '<span class="fin-kicker">Finanse</span>' +
              '<h1 class="fin-title">Kondycja finansowa gabinetu</h1>' +
              '<div class="fin-actions">' +
                '<button class="fin-action fin-action--primary" id="fin-open-add-payment">Zarejestruj płatność</button>' +
              '</div>' +
            '</div>' +
            '<div class="fin-highlight">' +
              '<span class="fin-highlight__eyebrow">Bieżący miesiąc</span>' +
              '<strong>' + escHtml(formatCurrency(monthRevenue)) + '</strong>' +
              '<span>' + monthPayments.length + ' płatności zapisanych i ' + coveredSessions + ' sesji objętych rozliczeniami.</span>' +
            '</div>' +
          '</div>' +
          '<div class="fin-metric-grid">' +
            '<article class="fin-metric"><span>Przychód</span><strong>' + escHtml(formatCurrency(monthRevenue)) + '</strong></article>' +
            '<article class="fin-metric"><span>Należności</span><strong>' + escHtml(formatCurrency(outstandingTotal)) + '</strong></article>' +
            '<article class="fin-metric"><span>Pacjenci z zaległościami</span><strong>' + Object.keys(debtMap).length + '</strong></article>' +
            '<article class="fin-metric"><span>Śr. przychód / miesiąc</span><strong>' + escHtml(formatCurrency(averageMonthlyRevenue)) + '</strong></article>' +
          '</div>' +
        '</section>' +

        '<div class="fin-split">' +
          '<section class="fin-section">' +
            '<h2 class="fin-section-title">Metody płatności</h2>' +
            '<div class="fin-method-list">' +
              (methodIds.map((methodId) => (
                '<div class="fin-method-row">' +
                  '<span class="fin-method-label"><span class="fin-method-badge ' + paymentMethodClass(methodId, false) + '">' + escHtml(paymentMethodCurrentLabel(methodId, new Date())) + '</span></span>' +
                  '<span class="fin-method-amount">' + escHtml(formatCurrency(methods[methodId] || 0)) + '</span>' +
                '</div>'
              )).join('') || '<p class="fin-empty">Brak aktywnych metod płatności.</p>') +
            '</div>' +
          '</section>' +

          '<section class="fin-section">' +
            '<h2 class="fin-section-title">Rzeczy wymagające uwagi</h2>' +
            '<div class="fin-actions-list">' +
              '<div class="fin-action-row"><strong>' + outstanding.length + ' sesji do rozliczenia</strong></div>' +
              '<div class="fin-action-row"><strong>' + Object.keys(debtMap).length + ' pacjentów z należnościami</strong></div>' +
              '<div class="fin-action-row"><strong>' + completed + ' odbytych spotkań w tym miesiącu</strong></div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<section class="fin-section">' +
          '<div class="fin-section-header">' +
            '<h2 class="fin-section-title" style="margin:0">Trend przychodów</h2>' +
            '<div class="fin-period-toggle" id="fin-period-toggle">' +
              '<button class="fin-period-btn' + (chartPeriod === 3  ? ' active' : '') + '" data-period="3">3 mies.</button>' +
              '<button class="fin-period-btn' + (chartPeriod === 6  ? ' active' : '') + '" data-period="6">6 mies.</button>' +
              '<button class="fin-period-btn' + (chartPeriod === 12 ? ' active' : '') + '" data-period="12">12 mies.</button>' +
            '</div>' +
          '</div>' +
          '<div id="fin-bars-wrap" style="margin-top:14px">' + renderRevenueBars(chartPeriod) + '</div>' +
        '</section>' +

        '<section class="fin-section">' +
          '<h2 class="fin-section-title">Zaległości według pacjenta</h2>' +
          (debtRows || '<p class="fin-empty">Brak zaległości. Gabinet jest rozliczony na dziś.</p>') +
        '</section>' +
      '</div>'
    );
  }

  function paymentDisplayAmount(payment, filterMethod) {
    if (filterMethod === 'all' || !payment.isSplit || !payment.splitAmounts) return payment.amount;
    if (paymentPrimaryMethodId(payment) === filterMethod) return payment.splitAmounts.primary;
    if (paymentSecondaryMethodId(payment) === filterMethod) return payment.splitAmounts.secondary;
    return payment.amount;
  }

  function filteredPayments() {
    return getPayments()
      .filter((payment) => {
        if (paymentFilters.method !== 'all') {
          var matchesPrimary = paymentPrimaryMethodId(payment) === paymentFilters.method;
          var matchesSplit = payment.isSplit && paymentSecondaryMethodId(payment) === paymentFilters.method;
          if (!matchesPrimary && !matchesSplit) return false;
        }
        const paymentDateKey = paymentDayKey(payment.date);
        if (paymentFilters.from && paymentDateKey < paymentFilters.from) return false;
        if (paymentFilters.to && paymentDateKey > paymentFilters.to) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function renderPayments() {
    const filterOptions = currentFilterMethodOptions();
    if (paymentFilters.method !== 'all' && !filterOptions.some((option) => option.id === paymentFilters.method)) {
      paymentFilters.method = 'all';
    }
    const payments = filteredPayments();
    const total = payments.reduce((sum, payment) => sum + paymentDisplayAmount(payment, paymentFilters.method), 0);
    return (
      '<div class="fin-payments">' +
        '<section class="fin-shell">' +
          '<div class="fin-payments-toolbar">' +
            '<button class="fin-action fin-action--primary" id="fin-open-add-payment">Zarejestruj płatność</button>' +
            '<div class="fin-filter-row">' +
              '<button class="fin-chip ' + (paymentFilters.method === 'all' ? 'active' : '') + '" data-method="all">Wszystkie</button>' +
              filterOptions.map((option) => (
                '<button class="fin-chip ' + (paymentFilters.method === option.id ? 'active' : '') + '" data-method="' + escHtml(option.id) + '">' + escHtml(option.label) + '</button>'
              )).join('') +
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
                    '<span class="fin-method-badge ' + paymentMethodClass(paymentPrimaryMethodId(payment), payment.isSplit) + '">' + escHtml(paymentCompoundLabel(payment)) + '</span>' +
                    '<span class="fin-payment-amount">' + escHtml(formatCurrency(paymentDisplayAmount(payment, paymentFilters.method))) + '</span>' +
                  '</div>' +
                  '<span class="fin-payment-patient">' + escHtml(display) + '</span>' +
                  '<div class="fin-payment-sub">' +
                    (fullName ? '<span>' + escHtml(fullName) + '</span>' : '') +
                    '<span>' + (payment.sessionIds || []).length + ' sesji</span>' +
                  '</div>' +
                  (payment.note ? '<div class="fin-payment-note">' + escHtml(payment.note) + '</div>' : '') +
                  (payment.isSplit && payment.splitAmounts
                    ? '<div class="fin-payment-note" style="margin-top:6px;font-weight:700">'
                      + escHtml(paymentMethodLabelForDate(paymentPrimaryMethodId(payment), payment.date)) + ': ' + escHtml(formatCurrency(payment.splitAmounts.primary))
                      + ' · ' + escHtml(paymentMethodLabelForDate(paymentSecondaryMethodId(payment), payment.date)) + ': ' + escHtml(formatCurrency(payment.splitAmounts.secondary))
                      + '</div>'
                    : '') +
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

  function bindViewEvents(container) {
    container.querySelectorAll('.fin-tab').forEach((button) => {
      button.addEventListener('click', () => {
        currentTab = button.dataset.tab;
        render(container);
      });
    });

    container.querySelectorAll('#fin-open-add-payment').forEach((button) => {
      button.addEventListener('click', () => openAddPayment());
    });

    const periodToggle = container.querySelector('#fin-period-toggle');
    if (periodToggle) {
      periodToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-period]');
        if (!btn) return;
        chartPeriod = Number(btn.dataset.period);
        const barsWrap = container.querySelector('#fin-bars-wrap');
        if (barsWrap) barsWrap.innerHTML = renderRevenueBars(chartPeriod);
        periodToggle.querySelectorAll('.fin-period-btn').forEach((b) => {
          b.classList.toggle('active', Number(b.dataset.period) === chartPeriod);
        });
      });
    }

    container.querySelectorAll('.fin-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        paymentFilters.method = chip.dataset.method;
        render(container);
      });
    });

    const filterFrom = container.querySelector('#fin-filter-from');
    const filterTo = container.querySelector('#fin-filter-to');
    if (filterFrom) {
      filterFrom.addEventListener('change', () => {
        paymentFilters.from = filterFrom.value;
        render(container);
      });
    }
    if (filterTo) {
      filterTo.addEventListener('change', () => {
        paymentFilters.to = filterTo.value;
        render(container);
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

  function renderMethodToggle(id, selected, options, emptyText) {
    const methodOptions = Array.isArray(options) ? options : [];
    if (!methodOptions.length) {
      return '<div class="fin-empty">' + escHtml(emptyText || 'Brak dostepnych metod platnosci dla wybranej daty.') + '</div>';
    }
    return (
      '<div class="fin-method-toggle" id="' + id + '">' +
        methodOptions.map((option) => (
          '<button class="fin-method-btn ' + (selected === option.id ? 'active' : '') + '" type="button" data-method="' + escHtml(option.id) + '">' + escHtml(option.label) + '</button>'
        )).join('') +
      '</div>'
    );
  }

  function renderPaymentSheet(payment, prefill) {
    const isEdit = Boolean(payment);
    const patients = AppState.activePatients.slice().sort((a, b) => displayPatientName(a).localeCompare(displayPatientName(b), 'pl'));
    const isSplit = payment ? Boolean(payment.isSplit) : false;
    const paymentDateValue = paymentDayKey(payment ? payment.date : new Date()) || new Date().toISOString().slice(0, 10);
    const baseSelectedMethod = payment ? paymentPrimaryMethodId(payment) : null;
    const baseSelectedMethod2 = payment ? paymentSecondaryMethodId(payment) : null;
    const methodOptions = paymentMethodOptionsForDate(paymentDateValue, [baseSelectedMethod, baseSelectedMethod2]);
    const selectedMethod = baseSelectedMethod || (methodOptions[0] ? methodOptions[0].id : '');
    const secondaryMethodOptions = splitSecondaryMethodOptions(methodOptions, selectedMethod);
    const selectedMethod2 = baseSelectedMethod2 || (secondaryMethodOptions[0] ? secondaryMethodOptions[0].id : '');
    const splitAmount2    = (payment && payment.splitAmounts) ? payment.splitAmounts.secondary : '';
    const patientId = payment ? payment.patientId : (prefill ? (prefill.patientId || '') : '');
    const selectedIds = payment ? (payment.sessionIds || []) : (prefill ? (prefill.sessionIds || []) : []);
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
              '<input class="fin-input" type="date" id="fin-sheet-date" value="' + escHtml(paymentDateValue) + '">' +
            '</div>' +
            '<div class="fin-form-group fin-form-group--full">' +
              '<label>Metoda płatności</label>' +
              '<div id="fin-method-toggle-wrap">' + renderMethodToggle('fin-method-toggle', selectedMethod, methodOptions, 'Brak aktywnych metod platnosci dla wybranej daty.') + '</div>' +
              '<input type="hidden" id="fin-sheet-method" value="' + escHtml(selectedMethod) + '">' +
            '</div>' +
            // Split toggle
            '<div class="fin-form-group fin-form-group--full">' +
              '<label class="fin-split-label">' +
                '<input type="checkbox" id="fin-split-toggle"' + (isSplit ? ' checked' : '') + '>' +
                ' Podziel na dwie formy płatności' +
              '</label>' +
            '</div>' +
            // Second method row (hidden unless split)
            '<div class="fin-form-group fin-form-group--full" id="fin-split-row" style="' + (isSplit ? '' : 'display:none') + '">' +
              '<label>Druga forma płatności</label>' +
              '<div id="fin-method2-toggle-wrap">' + renderMethodToggle('fin-method2-toggle', selectedMethod2, secondaryMethodOptions, 'Brak drugiej aktywnej metody dla wybranej daty.') + '</div>' +
              '<input type="hidden" id="fin-sheet-method2" value="' + escHtml(selectedMethod2) + '">' +
              '<div class="fin-split-amount-row">' +
                '<div class="fin-split-amount-item">' +
                  '<span class="fin-split-amount-label" id="fin-split-label1">Kwota — pierwsza forma</span>' +
                  '<input class="fin-input fin-split-amount-readonly" type="text" id="fin-split-amount1" readonly placeholder="auto">' +
                '</div>' +
                '<div class="fin-split-amount-item">' +
                  '<span class="fin-split-amount-label">Kwota — druga forma (zł)</span>' +
                  '<input class="fin-input" type="number" id="fin-split-amount2" min="0.01" step="0.01" value="' + escHtml(String(splitAmount2)) + '" placeholder="0.00">' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="fin-form-group fin-form-group--full">' +
              '<label>Sesje do rozliczenia</label>' +
              '<div class="fin-session-list" id="fin-sheet-sessions">' +
                (patientId ? renderSessionCheckboxes(patientId, selectedIds) : '<p class="fin-empty">Wybierz pacjenta, aby zobaczyć sesje.</p>') +
              '</div>' +
            '</div>' +
            '<div class="fin-form-group">' +
              '<label for="fin-sheet-amount">Łączna kwota (zł)</label>' +
              '<input class="fin-input" type="number" id="fin-sheet-amount" min="0" step="0.01" value="' + escHtml(String((payment && payment.amount) || '0')) + '" placeholder="0.00">' +
              '<div id="fin-sheet-balance-info" class="fin-balance-info" style="display:none"></div>' +
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

  function openPaymentSheet(payment, prefill) {
    const existing = document.getElementById('fin-payment-sheet');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', renderPaymentSheet(payment, prefill));
    bindPaymentSheetEvents(payment, prefill);
  }

  // Opens a new-payment sheet pre-filled for a specific session (called from calendar detail).
  function openAddPaymentForSession(session) {
    openPaymentSheet(null, { patientId: session.patientId, sessionIds: [session.id] });
  }

  function bindPaymentSheetEvents(payment, prefill) {
    const sheet = document.getElementById('fin-payment-sheet');
    if (!sheet) return;
    const patientSelect = sheet.querySelector('#fin-sheet-patient');
    const paymentDateInput = sheet.querySelector('#fin-sheet-date');
    const sessionsWrap = sheet.querySelector('#fin-sheet-sessions');
    const amountInput = sheet.querySelector('#fin-sheet-amount');
    const balanceInfo = sheet.querySelector('#fin-sheet-balance-info');
    const methodInput = sheet.querySelector('#fin-sheet-method');
    const methodInput2 = sheet.querySelector('#fin-sheet-method2');
    const methodToggleWrap = sheet.querySelector('#fin-method-toggle-wrap');
    const method2ToggleWrap = sheet.querySelector('#fin-method2-toggle-wrap');
    const selectedIds = payment ? (payment.sessionIds || []) : (prefill ? (prefill.sessionIds || []) : []);
    const splitToggle = sheet.querySelector('#fin-split-toggle');
    const splitRow = sheet.querySelector('#fin-split-row');
    const splitAmt2 = sheet.querySelector('#fin-split-amount2');
    const splitAmt1 = sheet.querySelector('#fin-split-amount1');

    function updateBalanceInfo() {
      const expected = selectedTotal(sheet);
      const paid = parseFloat(amountInput.value) || 0;
      const diff = paid - expected;
      if (!expected || paid === expected) {
        balanceInfo.style.display = 'none';
        return;
      }
      balanceInfo.style.display = '';
      if (diff > 0) {
        balanceInfo.className = 'fin-balance-info fin-balance-info--over';
        balanceInfo.textContent = 'Nadpłata: ' + formatCurrency(diff) + '. Różnica pozostaje nieprzypisana.';
      } else {
        // underpayment — figure out which sessions are fully/partially covered
        const sessionIds = selectedSessionIds(sheet);
        const sessions = sessionIds
          .map(id => getSessions().find(s => s.id === id))
          .filter(Boolean)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        let remaining = paid;
        let fullyCovered = 0;
        let partialSession = null;
        let partialPaid = 0;
        for (const s of sessions) {
          const rate = sessionAmount(s);
          if (remaining >= rate) { remaining -= rate; fullyCovered++; }
          else if (remaining > 0) { partialSession = s; partialPaid = remaining; remaining = 0; }
          else break;
        }
        const unpaidCount = sessions.length - fullyCovered - (partialSession ? 1 : 0);
        let msg = '';
        if (fullyCovered > 0) msg += fullyCovered + ' ' + (fullyCovered === 1 ? 'sesja opłacona w całości' : 'sesje opłacone w całości') + '. ';
        if (partialSession) {
          const rate = sessionAmount(partialSession);
          msg += 'Sesja ' + formatDateMedium(partialSession.date) + ' opłacona częściowo (' + formatCurrency(partialPaid) + ' z ' + formatCurrency(rate) + '). ';
        }
        if (unpaidCount > 0) msg += unpaidCount + ' ' + (unpaidCount === 1 ? 'sesja pozostaje nieopłacona' : 'sesje pozostają nieopłacone') + '.';
        balanceInfo.className = 'fin-balance-info fin-balance-info--under';
        balanceInfo.textContent = msg.trim();
      }
    }

    function updateSplitAmount1() {
      if (!splitAmt1 || !splitAmt2) return;
      const total = parseFloat(amountInput.value) || 0;
      const amt2  = parseFloat(splitAmt2.value) || 0;
      const amt1  = Math.max(0, total - amt2);
      splitAmt1.value = amt1 > 0 ? amt1.toFixed(2) : '';
    }

    function refreshTotal() {
      const expected = selectedTotal(sheet);
      // Only auto-fill if user hasn't manually changed the amount
      if (!amountInput.dataset.userEdited) {
        amountInput.value = expected > 0 ? expected.toFixed(2) : '0.00';
      }
      updateBalanceInfo();
      updateSplitAmount1();
    }

    function bindCheckboxes() {
      sheet.querySelectorAll('.fin-session-cb').forEach((checkbox) => {
        checkbox.addEventListener('change', refreshTotal);
      });
      refreshTotal();
    }

    function bindMethodToggle(toggleElement, hiddenInput) {
      if (!toggleElement || !hiddenInput) return;
      toggleElement.querySelectorAll('.fin-method-btn').forEach((button) => {
        button.addEventListener('click', () => {
          toggleElement.querySelectorAll('.fin-method-btn').forEach((item) => item.classList.remove('active'));
          button.classList.add('active');
          hiddenInput.value = button.dataset.method;
          if (hiddenInput === methodInput) {
            refreshMethodOptions();
          }
        });
      });
    }

    function refreshMethodOptions() {
      const dateValue = paymentDateInput ? paymentDateInput.value : new Date().toISOString().slice(0, 10);
      const options = paymentMethodOptionsForDate(dateValue, [methodInput.value, methodInput2 ? methodInput2.value : null]);
      const selectedPrimary = options.some((option) => option.id === methodInput.value)
        ? methodInput.value
        : (options[0] ? options[0].id : '');

      methodInput.value = selectedPrimary;
      if (methodToggleWrap) {
        methodToggleWrap.innerHTML = renderMethodToggle('fin-method-toggle', selectedPrimary, options, 'Brak aktywnych metod platnosci dla wybranej daty.');
        bindMethodToggle(methodToggleWrap.querySelector('#fin-method-toggle'), methodInput);
      }

      if (methodInput2) {
        const secondaryOptions = splitSecondaryMethodOptions(options, selectedPrimary);
        const selectedSecondary = secondaryOptions.some((option) => option.id === methodInput2.value)
          ? methodInput2.value
          : ((secondaryOptions[0] || {}).id || '');
        methodInput2.value = selectedSecondary;
        if (method2ToggleWrap) {
          method2ToggleWrap.innerHTML = renderMethodToggle('fin-method2-toggle', selectedSecondary, secondaryOptions, 'Brak drugiej aktywnej metody dla wybranej daty.');
          bindMethodToggle(method2ToggleWrap.querySelector('#fin-method2-toggle'), methodInput2);
        }
      }

      updateSplitAmount1();
    }

    if (patientSelect) {
      patientSelect.addEventListener('change', () => {
        sessionsWrap.innerHTML = patientSelect.value
          ? renderSessionCheckboxes(patientSelect.value, [])
          : '<p class="fin-empty">Wybierz pacjenta, aby zobaczyć sesje.</p>';
        bindCheckboxes();
      });
    }

    if (splitToggle && splitRow) {
      splitToggle.addEventListener('change', () => {
        splitRow.style.display = splitToggle.checked ? '' : 'none';
        if (splitToggle.checked) updateSplitAmount1();
      });
    }
    if (paymentDateInput) {
      paymentDateInput.addEventListener('change', refreshMethodOptions);
    }
    if (splitAmt2) {
      splitAmt2.addEventListener('input', updateSplitAmount1);
    }

    if (amountInput) {
      amountInput.addEventListener('input', () => {
        amountInput.dataset.userEdited = '1';
        updateBalanceInfo();
        updateSplitAmount1();
      });
    }

    bindCheckboxes();
    refreshMethodOptions();
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
    const method = normalizeFinanceMethodId(sheet.querySelector('#fin-sheet-method').value);
    const note = sheet.querySelector('#fin-sheet-note').value.trim();
    const sessionIds = selectedSessionIds(sheet);

    // Split fields
    const splitToggle = sheet.querySelector('#fin-split-toggle');
    const isSplit = splitToggle ? splitToggle.checked : false;
    const splitMethod = isSplit ? normalizeFinanceMethodId(sheet.querySelector('#fin-sheet-method2').value) : null;
    const splitAmt2Raw = isSplit ? parseFloat(sheet.querySelector('#fin-split-amount2').value) : 0;

    if (!method) {
      toast('Nieprawidłowa metoda płatności', 'warning');
      return;
    }
    if (isSplit && !splitMethod) {
      toast('Nieprawidłowa druga metoda płatności', 'warning');
      return;
    }

    if (!patientId) {
      toast('Wybierz pacjenta.', 'warning');
      return;
    }
    if (!date) {
      toast('Podaj datę płatności.', 'warning');
      return;
    }
    if (typeof getPaymentMethodLabelForDate === 'function' && !getPaymentMethodLabelForDate(method, date)) {
      toast('Wybrana metoda nie ma nazwy dla tej daty płatności.', 'warning');
      return;
    }
    if (isSplit && typeof getPaymentMethodLabelForDate === 'function' && !getPaymentMethodLabelForDate(splitMethod, date)) {
      toast('Druga metoda nie ma nazwy dla tej daty płatności.', 'warning');
      return;
    }
    if (!sessionIds.length) {
      toast('Wybierz co najmniej jedną sesję.', 'warning');
      return;
    }

    const amount = parseFloat(sheet.querySelector('#fin-sheet-amount').value) || selectedTotal(sheet);

    // Validate amount when split
    if (isSplit && amount <= 0) {
      toast('Kwota płatności musi być większa od zera.', 'warning');
      return;
    }

    // Validate split
    if (isSplit) {
      if (!splitMethod || splitMethod === method) {
        toast('Wybierz dwie różne metody płatności.', 'warning');
        return;
      }
      if (!splitAmt2Raw || splitAmt2Raw <= 0) {
        toast('Podaj kwotę dla drugiej formy płatności.', 'warning');
        return;
      }
      if (splitAmt2Raw >= amount) {
        toast('Kwota drugiej formy nie może być równa ani większa od łącznej kwoty.', 'warning');
        return;
      }
    }

    const splitAmounts = isSplit
      ? { primary: parseFloat((amount - splitAmt2Raw).toFixed(2)), secondary: parseFloat(splitAmt2Raw.toFixed(2)) }
      : null;

    try {
      if (typeof savePaymentRecord !== 'function') {
        throw new Error('Brak helpera savePaymentRecord.');
      }

      savePaymentRecord({
        id: existingId || null,
        patientId,
        date,
        amount,
        method,
        methodId: method,
        isSplit,
        splitMethod,
        splitMethodId: splitMethod,
        splitAmounts,
        sessionIds,
        note,
      });
    } catch (error) {
      toast('Nie udało się zapisać płatności: ' + error.message, 'error');
      return;
    }

    persistData();
    closePaymentSheet();
    if (containerRef) render(containerRef);
    // Refresh calendar view if it is currently visible (opened from session detail)
    if (typeof CalendarViews !== 'undefined' && typeof CalendarViews._refresh === 'function') {
      CalendarViews._refresh();
    }
    toast(existingId ? 'Płatność zaktualizowana.' : 'Płatność zapisana.', 'success');
  }

  function confirmDeletePayment(paymentId) {
    if (!confirm('Czy na pewno chcesz usunąć tę płatność? Sesje wrócą do stanu nieopłaconych.')) return;
    deletePayment(paymentId);
  }

  function deletePayment(paymentId) {
    if (typeof deletePaymentRecord !== 'function') return;
    const payment = deletePaymentRecord(paymentId);
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
            (payment.isSplit
              ? '<div class="fin-detail-row"><span>Metoda</span><strong class="fin-method-badge badge-split">' + escHtml(paymentCompoundLabel(payment)) + '</strong></div>' +
                '<div class="fin-detail-row fin-detail-split"><span>' + escHtml(paymentMethodLabelForDate(paymentPrimaryMethodId(payment), payment.date)) + '</span><strong>' + escHtml(formatCurrency(payment.splitAmounts ? payment.splitAmounts.primary : 0)) + '</strong></div>' +
                '<div class="fin-detail-row fin-detail-split"><span>' + escHtml(paymentMethodLabelForDate(paymentSecondaryMethodId(payment), payment.date)) + '</span><strong>' + escHtml(formatCurrency(payment.splitAmounts ? payment.splitAmounts.secondary : 0)) + '</strong></div>'
              : '<div class="fin-detail-row"><span>Metoda</span><strong class="fin-method-badge ' + paymentMethodClass(paymentPrimaryMethodId(payment), false) + '">' + escHtml(paymentMethodLabelForDate(paymentPrimaryMethodId(payment), payment.date)) + '</strong></div>') +
            '<div class="fin-detail-row"><span>Kwota łączna</span><strong>' + escHtml(formatCurrency(payment.amount)) + '</strong></div>' +
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
    openAddPaymentForSession,
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
