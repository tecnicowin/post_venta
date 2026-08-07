const Utils = {
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  formatCurrency(amount, decimals = 2) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  formatCurrencyBs(amount, rate, decimals = 2) {
    const bsAmount = (parseFloat(amount) || 0) * (parseFloat(rate) || 1);
    return 'Bs. ' + bsAmount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  parseCurrency(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    return parseFloat(str.toString().replace(/[$,Bs.\s]/g, '')) || 0;
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-VE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  },

  getToday() {
    return new Date().toISOString().split('T')[0];
  },

  getNow() {
    return new Date().toISOString();
  },

  calcIVA(subtotal, ivaRate) {
    const rate = parseFloat(ivaRate) || 0;
    return (parseFloat(subtotal) || 0) * rate;
  },

  validatePhone(phone) {
    const validPrefixes = ['0212', '0412', '0416', '0422', '0424', '0414'];
    if (!phone) return false;
    const cleaned = phone.replace(/\s/g, '');
    return validPrefixes.some(p => cleaned.startsWith(p)) && cleaned.length >= 11;
  },

  validateCedula(cedula) {
    return cedula && cedula.length >= 6;
  },

  validateRif(rif) {
    return rif && /^[VJPG]-\d{8,10}$/i.test(rif.replace(/\s/g, ''));
  },

  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  numberToLetter(num) {
    if (num === 0) return 'CERO';
    const ones = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (num === 100) return 'CIEN';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 30) return num === 20 ? 'VEINTE' : 'VEINTI' + ones[num - 20];
    if (num < 100) {
      const t = tens[Math.floor(num / 10)];
      const o = ones[num % 10];
      return t + (o ? ' Y ' + o : '');
    }
    if (num < 1000) {
      const h = hundreds[Math.floor(num / 100)];
      const rest = num % 100;
      if (rest === 0) return h;
      return h + ' ' + Utils.numberToLetter(rest);
    }
    if (num < 1000000) {
      const thousands = Math.floor(num / 1000);
      const rest = num % 1000;
      const thWord = thousands === 1 ? 'MIL' : Utils.numberToLetter(thousands) + ' MIL';
      if (rest === 0) return thWord;
      return thWord + ' ' + Utils.numberToLetter(rest);
    }
    return num.toString();
  },

  escapeXml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
};
