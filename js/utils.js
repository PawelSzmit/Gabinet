/* ===========================================
   Utils - Helpers and utilities
   =========================================== */

const Utils = (() => {
  function generateUUID() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  }

  const POLISH_MONTHS = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  const POLISH_MONTHS_GENITIVE = [
    'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
  ];

  const POLISH_DAYS = [
    'Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'
  ];

  const POLISH_DAYS_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

  const DAY_MAP = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6
  };

  const DAY_NAMES_PL = {
    tuesday: 'Wtorek',
    wednesday: 'Środa',
    thursday: 'Czwartek',
    monday: 'Poniedziałek',
    friday: 'Piątek',
    saturday: 'Sobota',
    sunday: 'Niedziela'
  };

  function formatDatePL(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function formatDateLongPL(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${POLISH_MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getMonthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  function getDayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dayIndex = d.getDay();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }

  function getWeekDates(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      dates.push(day);
    }
    return dates;
  }

  function isDateInRange(dateStr, startStr, endStr) {
    return dateStr >= startStr && dateStr <= endStr;
  }

  function getMonthsBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let months = (end.getFullYear() - start.getFullYear()) * 12;
    months += end.getMonth() - start.getMonth();
    return Math.max(0, months);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('pl-PL', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount) + ' zł';
  }

  function formatTime(timeStr) {
    return timeStr ? timeStr.substring(0, 5) : '';
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  function showModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById(modalId).classList.remove('hidden');
  }

  function hideModals() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    overlay.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }

  function showConfirm(title, message, onConfirm) {
    document.getElementById('mc-title').textContent = title;
    document.getElementById('mc-message').textContent = message;
    showModal('modal-confirm');

    const confirmBtn = document.getElementById('mc-btn-confirm');
    const cancelBtn = document.getElementById('mc-btn-cancel');

    const cleanup = () => {
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      hideModals();
    };

    document.getElementById('mc-btn-confirm').addEventListener('click', () => {
      cleanup();
      onConfirm();
    });
    document.getElementById('mc-btn-cancel').addEventListener('click', cleanup);
  }

  function getPaymentMethodLabel(method) {
    const labels = {
      aliorBank: 'Alior Bank',
      ingBank: 'ING Bank',
      cash: 'Gotówka'
    };
    return labels[method] || method;
  }

  function getStatusLabel(status) {
    const labels = {
      scheduled: 'Zaplanowana',
      completed: 'Odbyła się',
      cancelled: 'Nie odbyła się'
    };
    return labels[status] || status;
  }

  function getGoalStatusLabel(status) {
    const labels = {
      inProgress: 'W toku',
      achieved: 'Osiągnięty',
      abandoned: 'Nieaktualny'
    };
    return labels[status] || status;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function calculateTherapyDuration(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const months = getMonthsBetween(start, now);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0) {
      return `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'}, ${remainingMonths} mies.`;
    }
    return `${remainingMonths} mies.`;
  }

  function todayISO() {
    return formatDateISO(new Date());
  }

  return {
    generateUUID,
    POLISH_MONTHS,
    POLISH_MONTHS_GENITIVE,
    POLISH_DAYS,
    POLISH_DAYS_SHORT,
    DAY_MAP,
    DAY_NAMES_PL,
    formatDatePL,
    formatDateLongPL,
    formatDateISO,
    getMonthKey,
    getDayOfWeek,
    getDaysInMonth,
    getFirstDayOfMonth,
    getWeekDates,
    isDateInRange,
    getMonthsBetween,
    formatCurrency,
    formatTime,
    debounce,
    showToast,
    showModal,
    hideModals,
    showConfirm,
    getPaymentMethodLabel,
    getStatusLabel,
    getGoalStatusLabel,
    escapeHtml,
    calculateTherapyDuration,
    todayISO
  };
})();
