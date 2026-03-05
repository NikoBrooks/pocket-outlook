import { fetchYahoo, fetchYahooV7Quote, fetchFundamentals, fetchFinnhubFundamentals, fetchEqChartData } from './api.js';
import { fmt, fmtFinNum, fmtPct, getRaw } from './utils.js';

// ── Module State ──
let eqChartInstance = null;
let eqLinePoints = [];
let eqOhlcPoints = [];
let eqVolumePoints = [];
export let eqCurrentSymbol = null;
let eqCurrentRange = '1y', eqCurrentInterval = '1d';
let eqChartType = 'line';
let eqRangeChangeAmt = null, eqRangeChangePct = null;
let watchlistGroups = [];

// ── Watchlist Persistence ──
function loadWatchlistGroups() {
  const v2 = localStorage.getItem('eq-watchlist-v2');
  if (v2) { watchlistGroups = JSON.parse(v2); return; }
  const old = JSON.parse(localStorage.getItem('eq-watchlist') || '["AAPL","MSFT","NVDA"]');
  watchlistGroups = [{ name: 'Watchlist', open: true, tickers: old }];
  saveWatchlistGroups();
}

function saveWatchlistGroups() {
  localStorage.setItem('eq-watchlist-v2', JSON.stringify(watchlistGroups));
}

export function addWatchlistGroup() {
  const name = prompt('Group name:');
  if (!name || !name.trim()) return;
  watchlistGroups.push({ name: name.trim(), open: true, tickers: [] });
  saveWatchlistGroups();
  renderWatchlist();
}

export function deleteGroup(idx) {
  const g = watchlistGroups[idx];
  if (g.tickers.length && !confirm('Delete group "' + g.name + '" and its ' + g.tickers.length + ' stock(s)?')) return;
  watchlistGroups.splice(idx, 1);
  saveWatchlistGroups();
  renderWatchlist();
}

export function toggleGroup(idx) {
  watchlistGroups[idx].open = !watchlistGroups[idx].open;
  saveWatchlistGroups();
  renderWatchlist();
}

export function addToGroup(groupIdx) {
  const input = document.getElementById('eq-group-input-' + groupIdx);
  if (!input) return;
  const sym = input.value.trim().toUpperCase().replace(/[^A-Z0-9.\-^]/g, '');
  if (!sym || sym.length > 8) return;
  if (!watchlistGroups[groupIdx].tickers.includes(sym)) {
    watchlistGroups[groupIdx].tickers.push(sym);
    saveWatchlistGroups();
  }
  input.value = '';
  renderWatchlist();
}

export function removeFromGroup(groupIdx, sym) {
  watchlistGroups[groupIdx].tickers = watchlistGroups[groupIdx].tickers.filter(t => t !== sym);
  saveWatchlistGroups();
  renderWatchlist();
}

export async function renderWatchlist() {
  loadWatchlistGroups();
  const container = document.getElementById('eq-watchlist-body');
  if (!container) return;
  container.innerHTML = '';
  for (let gi = 0; gi < watchlistGroups.length; gi++) {
    const g = watchlistGroups[gi];
    const groupDiv = document.createElement('div');
    groupDiv.className = 'eq-group' + (g.open ? ' open' : '');
    groupDiv.innerHTML =
      '<div class="eq-group-header" onclick="toggleGroup(' + gi + ')">' +
        '<span class="eq-group-caret">&#9658;</span>' +
        '<span class="eq-group-name">' + g.name + '</span>' +
        '<button class="eq-group-delete" onclick="event.stopPropagation();deleteGroup(' + gi + ')" title="Delete group">&times;</button>' +
      '</div>';
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'eq-group-body' + (g.open ? '' : ' collapsed');
    if (g.open && g.tickers.length > 0) {
      const rows = await Promise.all(g.tickers.map(async sym => {
        try { const d = await fetchYahoo(sym); return { sym, price: d.price, change: d.change, pct: d.pct, ok: true }; }
        catch(e) { return { sym, ok: false }; }
      }));
      rows.forEach(r => {
        const item = document.createElement('div');
        item.className = 'eq-watch-item' + (eqCurrentSymbol === r.sym ? ' active' : '');
        item.onclick = () => { document.getElementById('eq-ticker-input').value = r.sym; loadEquityStock(r.sym); };
        const up = r.ok && r.change >= 0;
        item.innerHTML =
          '<div class="eq-watch-left"><div class="eq-watch-ticker">' + r.sym + '</div></div>' +
          '<div class="eq-watch-right">' +
            (r.ok
              ? '<div class="eq-watch-price">$' + r.price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + '</div>' +
                '<div class="eq-watch-pct ' + (up?'up':'down') + '">' + (up?'+':'') + r.pct.toFixed(2) + '%</div>'
              : '<div class="eq-watch-price" style="color:var(--muted)">—</div>') +
            '<button class="eq-watch-remove" onclick="event.stopPropagation();removeFromGroup(' + gi + ',\'' + r.sym + '\')" title="Remove">&times;</button>' +
          '</div>';
        bodyDiv.appendChild(item);
      });
    } else if (g.open && g.tickers.length === 0) {
      bodyDiv.innerHTML = '<div style="padding:8px 14px;font-size:10px;color:var(--muted)">No stocks added.</div>';
    }
    const addRow = document.createElement('div');
    addRow.className = 'eq-watch-add-row';
    addRow.innerHTML =
      '<input id="eq-group-input-' + gi + '" placeholder="Add ticker..." ' +
        'onkeydown="if(event.key===\'Enter\')addToGroup(' + gi + ')" />' +
      '<button onclick="addToGroup(' + gi + ')">+</button>';
    if (g.open) bodyDiv.appendChild(addRow);
    groupDiv.appendChild(bodyDiv);
    container.appendChild(groupDiv);
  }
}

// ── Data Panel ──
function renderDataPanel(v7, fund, chartMeta) {
  const el = document.getElementById('eq-data-col');
  if (!el) return;
  const fin = fund?.financialData || {};
  const stats = fund?.defaultKeyStatistics || {};
  const prc = fund?.price || {};
  const sum = fund?.summaryDetail || {};

  function metric(label, value, cls, id) {
    return '<div class="eq-metric"' + (id ? ' id="' + id + '"' : '') + '><div class="eq-metric-label">' + label + '</div><div class="eq-metric-value' + (cls ? ' ' + cls : '') + '">' + (value != null ? value : '—') + '</div></div>';
  }
  function section(title, metrics) {
    return '<div class="eq-data-section"><div class="eq-data-section-title">' + title + '</div><div class="eq-metrics-grid">' + metrics.join('') + '</div></div>';
  }

  const price = v7?.regularMarketPrice ?? getRaw(prc.regularMarketPrice) ?? chartMeta?.regularMarketPrice;
  const _prev = chartMeta?.previousClose || chartMeta?.chartPreviousClose;
  const change = v7?.regularMarketChange ?? getRaw(prc.regularMarketChange) ?? (price != null && _prev != null ? price - _prev : null);
  const changePct = v7?.regularMarketChangePercent ?? getRaw(prc.regularMarketChangePercent) ?? (change != null && _prev ? change / _prev : null);
  const vol = v7?.regularMarketVolume ?? getRaw(prc.regularMarketVolume) ?? chartMeta?.regularMarketVolume;
  const avgVol = v7?.averageDailyVolume3Month ?? getRaw(prc.averageDailyVolume3Month) ?? getRaw(sum.averageDailyVolume3Month);
  const mktCap = v7?.marketCap ?? getRaw(prc.marketCap) ?? getRaw(sum.marketCap);
  const sharesOut = v7?.sharesOutstanding ?? getRaw(prc.sharesOutstanding);
  const high52 = v7?.fiftyTwoWeekHigh ?? getRaw(sum.fiftyTwoWeekHigh) ?? chartMeta?.fiftyTwoWeekHigh;
  const low52 = v7?.fiftyTwoWeekLow ?? getRaw(sum.fiftyTwoWeekLow) ?? chartMeta?.fiftyTwoWeekLow;
  const trPE = v7?.trailingPE ?? getRaw(prc.trailingPE) ?? getRaw(sum.trailingPE);
  const fwdPE = v7?.forwardPE ?? getRaw(prc.forwardPE) ?? getRaw(sum.forwardPE);
  const pb = v7?.priceToBook ?? getRaw(prc.priceToBook) ?? getRaw(sum.priceToBook);
  const eps = v7?.epsTrailingTwelveMonths ?? getRaw(prc.epsTrailingTwelveMonths);
  const beta = v7?.beta ?? getRaw(sum.beta);
  const ps = getRaw(stats.priceToSalesTrailing12Months);
  const evEbitda = getRaw(stats.enterpriseToEbitda);
  const fcfRaw = getRaw(fin.freeCashflow);
  const pfcf = (mktCap && fcfRaw && fcfRaw > 0) ? mktCap / fcfRaw : null;
  const grossM = getRaw(fin.grossMargins);
  const opM = getRaw(fin.operatingMargins);
  const netM = getRaw(fin.profitMargins);
  const roe = getRaw(fin.returnOnEquity);
  const roa = getRaw(fin.returnOnAssets);
  const de = getRaw(fin.debtToEquity);
  const cr = getRaw(fin.currentRatio);
  const rev = getRaw(fin.totalRevenue);
  const useRange = eqRangeChangeAmt != null;
  const dispChange = useRange ? eqRangeChangeAmt : change;
  const dispChangePct = useRange ? eqRangeChangePct : changePct;
  const changeLabel = useRange ? 'Chg (' + eqCurrentRange + ')' : 'Change';
  const upDown = (dispChange || 0) >= 0;
  const changeStr = dispChange != null
    ? (upDown ? '+' : '') + dispChange.toFixed(2) + ' (' + (upDown ? '+' : '') + ((dispChangePct || 0) * 100).toFixed(2) + '%)'
    : '—';

  el.innerHTML =
    section('Price & Market', [
      metric('Price', price != null ? '$' + price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'),
      metric(changeLabel, changeStr, upDown ? 'good' : 'bad', 'eq-metric-change'),
      metric('Volume', fmtFinNum(vol)),
      metric('Avg Volume', fmtFinNum(avgVol)),
      metric('Market Cap', '$' + fmtFinNum(mktCap)),
      metric('Shares Out', fmtFinNum(sharesOut)),
      metric('52W High', high52 != null ? '$' + high52.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'),
      metric('52W Low', low52 != null ? '$' + low52.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'),
    ]) +
    section('Valuation', [
      metric('P/E (TTM)', trPE != null ? trPE.toFixed(1) + 'x' : '—', trPE != null && trPE > 0 && trPE < 25 ? 'good' : trPE != null && trPE < 40 ? 'warn' : ''),
      metric('Forward P/E', fwdPE != null ? fwdPE.toFixed(1) + 'x' : '—', fwdPE != null && fwdPE > 0 && fwdPE < 20 ? 'good' : fwdPE != null && fwdPE < 35 ? 'warn' : ''),
      metric('P/B', pb != null ? pb.toFixed(2) + 'x' : '—', pb != null && pb > 0 && pb < 3 ? 'good' : pb != null && pb < 6 ? 'warn' : ''),
      metric('P/S', ps != null ? ps.toFixed(2) + 'x' : '—', ps != null && ps > 0 && ps < 5 ? 'good' : ps != null && ps < 10 ? 'warn' : ''),
      metric('P/FCF', pfcf != null ? pfcf.toFixed(1) + 'x' : '—', pfcf != null && pfcf > 0 && pfcf < 25 ? 'good' : pfcf != null && pfcf < 50 ? 'warn' : ''),
      metric('EV/EBITDA', evEbitda != null ? evEbitda.toFixed(1) + 'x' : '—', evEbitda != null && evEbitda > 0 && evEbitda < 15 ? 'good' : evEbitda != null && evEbitda < 25 ? 'warn' : ''),
    ]) +
    section('Profitability', [
      metric('Gross Margin', fmtPct(grossM), grossM != null && grossM > 0.40 ? 'good' : grossM != null && grossM > 0.20 ? 'warn' : ''),
      metric('Op Margin', fmtPct(opM), opM != null && opM > 0.15 ? 'good' : opM != null && opM > 0.05 ? 'warn' : ''),
      metric('Net Margin', fmtPct(netM), netM != null && netM > 0.10 ? 'good' : netM != null && netM > 0.02 ? 'warn' : ''),
      metric('ROE', fmtPct(roe), roe != null && roe > 0.15 ? 'good' : roe != null && roe > 0.05 ? 'warn' : ''),
      metric('ROA', fmtPct(roa), roa != null && roa > 0.05 ? 'good' : roa != null && roa > 0.01 ? 'warn' : ''),
      metric('Revenue', '$' + fmtFinNum(rev)),
    ]) +
    section('Financial Health', [
      metric('Debt/Equity', de != null ? (de / 100).toFixed(2) + 'x' : '—', de != null && de / 100 < 0.5 ? 'good' : de != null && de / 100 < 1.5 ? 'warn' : de != null ? 'bad' : ''),
      metric('Current Ratio', cr != null ? cr.toFixed(2) + 'x' : '—', cr != null && cr > 1.5 ? 'good' : cr != null && cr > 1 ? 'warn' : cr != null ? 'bad' : ''),
      metric('Free Cash Flow', '$' + fmtFinNum(fcfRaw), fcfRaw != null && fcfRaw > 0 ? 'good' : fcfRaw != null ? 'bad' : ''),
      metric('EPS (TTM)', eps != null ? '$' + eps.toFixed(2) : '—', eps != null && eps > 0 ? 'good' : eps != null ? 'bad' : ''),
      metric('Beta', beta != null ? beta.toFixed(2) : '—', beta != null && beta < 1.5 ? 'good' : beta != null && beta < 2.5 ? 'warn' : ''),
      metric('Exchange', v7?.fullExchangeName || v7?.exchange || getRaw(prc.exchangeName) || chartMeta?.fullExchangeName || chartMeta?.exchangeName || '—'),
    ]);
}

// ── Equity Chart Rendering ──
function renderEqLineChart(points, livePrice, prevClose) {
  const canvas = document.getElementById('eq-chart');
  if (!canvas || !points || !points.length) return;
  const ctx = canvas.getContext('2d');
  if (eqChartInstance) { eqChartInstance.destroy(); eqChartInstance = null; }
  const first = points[0].y, last = points[points.length - 1].y;
  const badgeFirst = prevClose || first, badgeLast = livePrice || last;
  const totalPct = ((badgeLast - badgeFirst) / badgeFirst) * 100;
  const isUp = badgeLast >= badgeFirst;
  eqRangeChangeAmt = badgeLast - badgeFirst;
  eqRangeChangePct = totalPct / 100;
  const lineColor = isUp ? '#00d97e' : '#ff4d6a';
  const fillColor = isUp ? 'rgba(0,217,126,0.07)' : 'rgba(255,77,106,0.07)';
  const pctEl = document.getElementById('eq-chart-pct');
  if (pctEl) { pctEl.textContent = (totalPct >= 0 ? '+' : '') + totalPct.toFixed(2) + '%'; pctEl.className = 'chart-pct-badge ' + (totalPct >= 0 ? 'up' : 'down'); }
  const step = Math.max(1, Math.floor(points.length / 300));
  const sampledIdx = [];
  for (let i = 0; i < points.length; i++) { if (i % step === 0 || i === points.length - 1) sampledIdx.push(i); }
  const sampled = sampledIdx.map(i => points[i]);

  const volPoints = (eqVolumePoints.length === points.length) ? eqVolumePoints : [];
  const sampledVol = sampledIdx.map(i => volPoints[i]?.y ?? 0);
  const sampledVolColors = sampledIdx.map(i => (volPoints[i]?.up !== false) ? 'rgba(0,217,126,0.35)' : 'rgba(255,77,106,0.35)');
  const maxVol = Math.max(...sampledVol.filter(v => v > 0), 1);

  function calcEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = new Array(prices.length).fill(null);
    let prev = null, count = 0;
    for (let i = 0; i < prices.length; i++) {
      if (prices[i] == null) continue;
      if (prev === null) {
        count++;
        if (count < period) continue;
        let sum = 0, n = 0;
        for (let j = 0; j <= i; j++) { if (prices[j] != null) { sum += prices[j]; n++; } }
        prev = sum / n;
      } else {
        prev = prices[i] * k + prev * (1 - k);
      }
      ema[i] = prev;
    }
    return ema;
  }
  const closes = points.map(p => p.y);
  const ema12Full = calcEMA(closes, 12);
  const ema26Full = calcEMA(closes, 26);
  const sampledEma12 = sampledIdx.map(i => ema12Full[i]);
  const sampledEma26 = sampledIdx.map(i => ema26Full[i]);

  if (window._eqChartAbort) window._eqChartAbort.abort();
  window._eqChartAbort = new AbortController();
  const sig = { signal: window._eqChartAbort.signal };

  function getCanvasX(e, cvs) {
    const rect = cvs.getBoundingClientRect();
    return (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  }
  canvas.addEventListener('mousedown', e => {
    if (!eqChartInstance) return;
    eqChartInstance._dragStart = getCanvasX(e, canvas); eqChartInstance._dragEnd = null; eqChartInstance._dragging = true;
  }, sig);
  canvas.addEventListener('mousemove', e => {
    if (!eqChartInstance) return;
    eqChartInstance._hoverX = getCanvasX(e, canvas);
    if (eqChartInstance._dragging) eqChartInstance._dragEnd = getCanvasX(e, canvas);
    eqChartInstance.draw();
  }, sig);
  canvas.addEventListener('mouseup', () => { if (eqChartInstance) eqChartInstance._dragging = false; }, sig);
  canvas.addEventListener('mouseleave', () => {
    if (eqChartInstance) {
      eqChartInstance._hoverX = null; eqChartInstance._dragStart = null;
      eqChartInstance._dragEnd = null; eqChartInstance._dragging = false;
      eqChartInstance.draw();
    }
    const tip = document.getElementById('drag-tooltip');
    if (tip) tip.style.display = 'none';
  }, sig);
  canvas.addEventListener('dblclick', () => { if (eqChartInstance) eqChartInstance.resetZoom(); }, sig);

  const crosshairPlugin = {
    id: 'eq_crosshair',
    afterDraw(chart) {
      const ctx2 = chart.ctx;
      const area = chart.chartArea;
      const meta = chart.getDatasetMeta(0);
      const pts = meta.data;
      if (!pts || pts.length === 0) return;
      ctx2.save();
      function getLineY(px) {
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i], p1 = pts[i + 1];
          if (px >= p0.x && px <= p1.x) {
            const t = (px - p0.x) / (p1.x - p0.x);
            return p0.y + t * (p1.y - p0.y);
          }
        }
        if (px <= pts[0].x) return pts[0].y;
        return pts[pts.length - 1].y;
      }
      if (chart._dragStart != null && chart._dragEnd != null) {
        const x1 = Math.min(chart._dragStart, chart._dragEnd);
        const x2 = Math.max(chart._dragStart, chart._dragEnd);
        if (x2 - x1 > 4) {
          ctx2.beginPath();
          ctx2.moveTo(x1, area.bottom);
          ctx2.lineTo(x1, getLineY(x1));
          for (let i = 0; i < pts.length; i++) {
            if (pts[i].x >= x1 && pts[i].x <= x2) ctx2.lineTo(pts[i].x, pts[i].y);
          }
          ctx2.lineTo(x2, getLineY(x2));
          ctx2.lineTo(x2, area.bottom);
          ctx2.closePath();
          ctx2.fillStyle = 'rgba(255,255,255,0.07)';
          ctx2.fill();
          ctx2.setLineDash([]);
          ctx2.lineWidth = 1;
          ctx2.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx2.beginPath(); ctx2.moveTo(x1, getLineY(x1)); ctx2.lineTo(x1, area.bottom); ctx2.stroke();
          ctx2.beginPath(); ctx2.moveTo(x2, getLineY(x2)); ctx2.lineTo(x2, area.bottom); ctx2.stroke();
          const yScale = chart.scales.y;
          const v1 = yScale.getValueForPixel(getLineY(x1));
          const v2 = yScale.getValueForPixel(getLineY(x2));
          if (v1 && v2) {
            const pct = ((v2 - v1) / Math.abs(v1)) * 100;
            const sign = pct >= 0 ? '+' : '';
            const tip = document.getElementById('drag-tooltip');
            if (tip) {
              tip.textContent = sign + pct.toFixed(2) + '%';
              tip.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';
              const rect = canvas.getBoundingClientRect();
              const cx = rect.left + (x1 + x2) / 2;
              const ty = rect.top + area.top - 36;
              tip.style.left = Math.max(8, cx - 40) + 'px';
              tip.style.top = ty + 'px';
              tip.style.display = 'block';
            }
          }
        } else {
          const tip = document.getElementById('drag-tooltip');
          if (tip) tip.style.display = 'none';
        }
      } else {
        const tip = document.getElementById('drag-tooltip');
        if (tip) tip.style.display = 'none';
      }
      if (chart._hoverX != null) {
        ctx2.strokeStyle = 'rgba(200,200,220,0.18)';
        ctx2.lineWidth = 1;
        ctx2.setLineDash([3, 4]);
        ctx2.beginPath();
        ctx2.moveTo(chart._hoverX, area.top);
        ctx2.lineTo(chart._hoverX, area.bottom);
        ctx2.stroke();
      }
      ctx2.restore();
    }
  };

  eqChartInstance = new Chart(ctx, {
    type: 'line',
    plugins: [crosshairPlugin],
    data: {
      labels: sampled.map(p => p.x),
      datasets: [
        { label: 'Price', data: sampled.map(p => p.y), borderColor: lineColor, borderWidth: 1.5, backgroundColor: fillColor, fill: true, tension: 0.2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: lineColor, yAxisID: 'y', order: 3 },
        { label: 'EMA 12', data: sampledEma12, borderColor: 'rgba(255,170,0,0.75)', borderWidth: 1, backgroundColor: 'transparent', fill: false, tension: 0.2, pointRadius: 0, pointHoverRadius: 0, spanGaps: true, yAxisID: 'y', order: 1 },
        { label: 'EMA 26', data: sampledEma26, borderColor: 'rgba(100,160,255,0.75)', borderWidth: 1, backgroundColor: 'transparent', fill: false, tension: 0.2, pointRadius: 0, pointHoverRadius: 0, spanGaps: true, yAxisID: 'y', order: 2 },
        { label: 'Volume', type: 'bar', data: sampledVol, backgroundColor: sampledVolColors, borderWidth: 0, yAxisID: 'y2', order: 10 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: {
        legend: { display: true, position: 'top', align: 'end', labels: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, boxWidth: 20, boxHeight: 1, padding: 10, usePointStyle: false,
          filter: item => item.text !== 'Price' && item.text !== 'Volume' } },
        tooltip: { mode: 'index', intersect: false, backgroundColor: '#1a1a1f', borderColor: '#2a2a30', borderWidth: 1, titleColor: '#6b6b7a', bodyColor: '#e8e8ed', titleFont: { family: "'IBM Plex Mono', monospace", size: 10 }, bodyFont: { family: "'IBM Plex Mono', monospace", size: 11, weight: '600' }, padding: 10,
          callbacks: { label: item => {
            if (item.raw == null) return null;
            if (item.dataset.label === 'Volume') {
              const v = item.raw;
              return ' Vol: ' + (v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v);
            }
            const prefix = item.dataset.label === 'Price' ? ' $' : ' ' + item.dataset.label + ': $';
            return prefix + item.raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }}
        },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
          limits: { x: { minRange: 2 } }
        }
      },
      scales: {
        x: { ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 8, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.03)' }, border: { color: '#1e1e22' } },
        y: { position: 'right', ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 5, callback: v => v >= 1000 ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '$' + v.toFixed(2) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: '#1e1e22' } },
        y2: { type: 'linear', position: 'left', min: 0, max: maxVol * 5, grid: { display: false }, border: { display: false },
          afterBuildTicks(axis) {
            axis.ticks = [0, Math.round(maxVol / 2), maxVol].map(v => ({ value: v }));
          },
          ticks: { color: 'rgba(107,107,122,0.8)', font: { family: "'IBM Plex Mono', monospace", size: 8 },
            callback: v => {
              if (v === 0) return '0';
              if (v >= 1e9) return (v/1e9).toFixed(1)+'B';
              if (v >= 1e6) return (v/1e6).toFixed(1)+'M';
              if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
              return v;
            }
          }
        }
      }
    }
  });
}

function renderEqCandleChart(ohlcPoints) {
  const canvas = document.getElementById('eq-chart');
  if (!canvas || !ohlcPoints || !ohlcPoints.length) return;
  try { if (!Chart.registry.controllers.get('candlestick')) throw new Error('no candlestick'); } catch(e) { renderEqLineChart(eqLinePoints); return; }
  const ctx = canvas.getContext('2d');
  if (eqChartInstance) { eqChartInstance.destroy(); eqChartInstance = null; }
  if (ohlcPoints.length > 0) {
    const first = ohlcPoints[0].o, last = ohlcPoints[ohlcPoints.length - 1].c;
    eqRangeChangeAmt = last - first;
    eqRangeChangePct = first !== 0 ? (last - first) / first : 0;
  }
  const step = Math.max(1, Math.floor(ohlcPoints.length / 200));
  const sampled = ohlcPoints.filter((_, i) => i % step === 0 || i === ohlcPoints.length - 1);
  const timeUnit = (eqCurrentInterval === '5m' || eqCurrentInterval === '30m') ? 'hour' : (eqCurrentInterval === '1wk') ? 'month' : 'day';
  eqChartInstance = new Chart(ctx, {
    type: 'candlestick',
    data: { datasets: [{ label: eqCurrentSymbol || '', data: sampled, color: { up: '#00d97e', down: '#ff4d6a', unchanged: '#6b6b7a' } }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1a1a1f', borderColor: '#2a2a30', borderWidth: 1, titleColor: '#6b6b7a', bodyColor: '#e8e8ed', titleFont: { family: "'IBM Plex Mono', monospace", size: 10 }, bodyFont: { family: "'IBM Plex Mono', monospace", size: 10 }, callbacks: { label: ctx => { const d = ctx.raw; if (!d) return ''; return ['O: $' + (d.o||0).toFixed(2) + '   H: $' + (d.h||0).toFixed(2), 'L: $' + (d.l||0).toFixed(2) + '   C: $' + (d.c||0).toFixed(2)]; } } }
      },
      scales: {
        x: { type: 'time', time: { unit: timeUnit, displayFormats: { hour: 'h:mm a', day: 'MMM d', month: 'MMM yy' } }, ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 8, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.03)' }, border: { color: '#1e1e22' } },
        y: { position: 'right', ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 6, callback: v => v >= 1000 ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '$' + v.toFixed(2) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: '#1e1e22' } }
      }
    }
  });
}

async function loadEqChart(symbol, range, interval) {
  const loadingEl = document.getElementById('eq-chart-loading');
  if (loadingEl) { loadingEl.style.display = 'flex'; loadingEl.textContent = 'Loading chart...'; }
  try {
    const result = await fetchEqChartData(symbol, range, interval);
    eqLinePoints = result.linePoints;
    eqOhlcPoints = result.ohlcPoints;
    eqVolumePoints = result.volumePoints || [];
    if (loadingEl) loadingEl.style.display = 'none';
    if (eqChartType === 'candle') renderEqCandleChart(eqOhlcPoints);
    else renderEqLineChart(eqLinePoints, result.livePrice, result.prevClose);
    return result;
  } catch(e) {
    if (loadingEl) { loadingEl.style.display = 'flex'; loadingEl.textContent = 'Chart unavailable'; }
    return null;
  }
}

export function setEqChartType(type) {
  eqChartType = type;
  document.getElementById('eq-toggle-line').classList.toggle('active', type === 'line');
  document.getElementById('eq-toggle-candle').classList.toggle('active', type === 'candle');
  if (type === 'candle' && eqOhlcPoints.length) renderEqCandleChart(eqOhlcPoints);
  else if (type === 'line' && eqLinePoints.length) renderEqLineChart(eqLinePoints);
  else if (eqCurrentSymbol) loadEqChart(eqCurrentSymbol, eqCurrentRange, eqCurrentInterval);
}

export async function loadEquityStock(symbol) {
  if (!symbol) return;
  eqCurrentSymbol = symbol;
  eqRangeChangeAmt = null; eqRangeChangePct = null;
  const titleEl = document.getElementById('eq-chart-title');
  if (titleEl) titleEl.textContent = symbol;
  const headerEl = document.getElementById('eq-stock-header');
  if (headerEl) { headerEl.style.display = 'flex'; headerEl.innerHTML = '<span style="font-size:11px;color:var(--muted)">Loading ' + symbol + '...</span>'; }
  const dataEl = document.getElementById('eq-data-col');
  if (dataEl) dataEl.innerHTML = '<div style="padding:40px 20px;font-size:10px;color:var(--muted);text-align:center">Loading...</div>';

  let _chartMeta = null, _v7 = null, _fund = null;

  function buildHeader(v7, chartMeta, fund) {
    const hPrice = v7?.regularMarketPrice ?? chartMeta?.regularMarketPrice;
    const hPrev = chartMeta?.previousClose || chartMeta?.chartPreviousClose;
    const hChange = v7?.regularMarketChange ?? (hPrice != null && hPrev != null ? hPrice - hPrev : null);
    const hPct = v7?.regularMarketChangePercent ?? (hChange != null && hPrev ? hChange / hPrev : null);
    const name = v7?.longName || v7?.shortName || fund?._profile?.name || chartMeta?.longName || chartMeta?.shortName || symbol;
    const up = (hChange || 0) >= 0;
    if (headerEl) {
      headerEl.innerHTML =
        '<div class="eq-stock-name">' + name + '</div>' +
        '<div class="eq-stock-price">$' + (hPrice != null ? hPrice.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—') + '</div>' +
        '<span class="eq-stock-change ' + (up?'up':'down') + '">' + (up?'+':'') + (hChange||0).toFixed(2) + ' (' + (up?'+':'') + ((hPct||0)*100).toFixed(2) + '%)</span>';
    }
  }

  loadEqChart(symbol, eqCurrentRange, eqCurrentInterval)
    .then(result => {
      _chartMeta = result?.meta || null;
      buildHeader(_v7, _chartMeta, _fund);
      renderDataPanel(_v7, _fund, _chartMeta);
    }).catch(() => {});

  fetchYahooV7Quote(symbol)
    .then(result => {
      _v7 = result;
      buildHeader(_v7, _chartMeta, _fund);
      renderDataPanel(_v7, _fund, _chartMeta);
    }).catch(() => {});

  fetchFinnhubFundamentals(symbol)
    .then(fhFund => {
      if (fhFund) {
        _fund = fhFund;
        buildHeader(_v7, _chartMeta, _fund);
        renderDataPanel(_v7, _fund, _chartMeta);
      } else {
        return fetchFundamentals(symbol);
      }
    })
    .then(yFund => {
      if (yFund && !_fund) {
        _fund = yFund;
        renderDataPanel(_v7, _fund, _chartMeta);
      }
    }).catch(() => {});

  setTimeout(() => {
    document.querySelectorAll('.eq-watch-item').forEach(el => {
      const ticker = el.querySelector('.eq-watch-ticker')?.textContent;
      el.classList.toggle('active', ticker === symbol);
    });
  }, 500);
}

// ── Update Change metric in panel without full re-render ──
function updatePanelChange() {
  const el = document.getElementById('eq-metric-change');
  if (!el || eqRangeChangeAmt == null) return;
  const up = eqRangeChangeAmt >= 0;
  const pct = (eqRangeChangePct || 0) * 100;
  const str = (up ? '+' : '') + eqRangeChangeAmt.toFixed(2) + ' (' + (up ? '+' : '') + pct.toFixed(2) + '%)';
  el.querySelector('.eq-metric-label').textContent = 'Chg (' + eqCurrentRange + ')';
  const valEl = el.querySelector('.eq-metric-value');
  valEl.textContent = str;
  valEl.className = 'eq-metric-value ' + (up ? 'good' : 'bad');
}

// ── Equity Tab Init ──
export function initEquity() {
  document.querySelectorAll('#eq-range-tabs .range-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#eq-range-tabs .range-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      eqCurrentRange = btn.dataset.range;
      eqCurrentInterval = btn.dataset.interval;
      if (eqCurrentSymbol) loadEqChart(eqCurrentSymbol, eqCurrentRange, eqCurrentInterval).then(updatePanelChange);
    });
  });
}
