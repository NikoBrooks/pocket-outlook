export function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtLarge(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return fmt(n);
}

export function fmtFinNum(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return (n * 100).toFixed(2) + '%';
}

// Abort fetch after ms to prevent proxy hangs from freezing the UI
export async function fetchWithTimeout(url, opts, ms) {
  ms = ms || 6000;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal })); }
  finally { clearTimeout(tid); }
}

// Unwrap Yahoo's {raw: N} or plain number (varies by API version / formatted param)
export function getRaw(v) {
  return (v != null && typeof v === 'object' && 'raw' in v) ? v.raw : v;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(/ (EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/, ''));
  if (isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function setCard(id, value, change, changePct, suffix = '', decimals = 2) {
  const card = document.getElementById('card-' + id);
  const priceEl = document.getElementById(id + '-price');
  const changeEl = document.getElementById(id + '-change');
  const pctEl = document.getElementById(id + '-pct');
  if (!card || !priceEl) return;
  const up = change >= 0;
  const dir = up ? 'up' : 'down';
  card.className = 'card ' + dir;
  const useDollar = ['spx','ndx','dji','gold','oil','btc','eth','dxy'].includes(id);
  const useLarge = ['spx','ndx','dji','gold','btc','eth'].includes(id);
  priceEl.textContent = (useDollar ? '$' : '') + (useLarge ? fmtLarge(value) : fmt(value, decimals)) + suffix;
  if (changeEl) { changeEl.className = 'change ' + dir; changeEl.textContent = (up ? '+' : '') + fmt(change, decimals); }
  if (pctEl && changePct != null) {
    pctEl.textContent = (up ? '▲' : '▼') + ' ' + Math.abs(changePct).toFixed(2) + '%';
    pctEl.style.color = up ? 'var(--green)' : 'var(--red)';
  }
}
