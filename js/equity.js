import { fetchYahoo, fetchYahooV7Quote, fetchFinnhubFundamentals, fetchEdgarFundamentals, fetchEqChartData, searchTickers, fetchFundamentals } from './api.js';
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
let _panelSources = {};

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
    const wInput = document.createElement('input');
    wInput.id = 'eq-group-input-' + gi;
    wInput.placeholder = 'Add ticker or name...';
    const wBtn = document.createElement('button');
    wBtn.textContent = '+';
    wBtn.onclick = () => addToGroup(gi);
    addRow.appendChild(wInput);
    addRow.appendChild(wBtn);
    // Attach inline autocomplete for this watchlist input
    attachTickerAutocomplete(wInput, sym => { wInput.value = sym; addToGroup(gi); });
    if (g.open) bodyDiv.appendChild(addRow);
    groupDiv.appendChild(bodyDiv);
    container.appendChild(groupDiv);
  }
}

// ── Source Popup ──
function showSourcePop(anchor, src) {
  document.getElementById('eq-src-pop')?.remove();
  const pop = document.createElement('div');
  pop.id = 'eq-src-pop';
  pop.className = 'eq-src-pop';

  let html = '';
  if (src.type === 'yahoo') {
    html = '<div class="eq-src-badge yahoo">Yahoo Finance</div>' +
           '<div class="eq-src-desc">' + (src.desc || 'Real-time market data') + '</div>';
  } else if (src.type === 'finnhub') {
    html = '<div class="eq-src-badge finnhub">Finnhub</div>' +
           '<div class="eq-src-desc">' + (src.desc || 'Finnhub financial data') + '</div>';
  } else if (src.type === 'computed') {
    html = '<div class="eq-src-badge computed">Computed</div>' +
           '<div class="eq-src-desc">' + (src.formula || '') + '</div>';
  } else if (src.type === 'edgar') {
    const accnUrl = src.cik && src.accn
      ? 'https://www.sec.gov/Archives/edgar/data/' + src.cik + '/' + src.accn.replace(/-/g, '') + '/'
      : null;
    html = '<div class="eq-src-badge edgar">SEC EDGAR</div>' +
           '<div class="eq-src-row"><span class="eq-src-lbl">Tag</span><span class="eq-src-val mono">' + (src.tag || '') + '</span></div>' +
           '<div class="eq-src-row"><span class="eq-src-lbl">Form</span><span class="eq-src-val">' + (src.form || '') + ' · ' + (src.period || '') + '</span></div>' +
           '<div class="eq-src-row"><span class="eq-src-lbl">Period end</span><span class="eq-src-val">' + (src.end || '') + '</span></div>' +
           '<div class="eq-src-row"><span class="eq-src-lbl">Filed</span><span class="eq-src-val">' + (src.filed || '') + '</span></div>' +
           '<div class="eq-src-row"><span class="eq-src-lbl">Method</span><span class="eq-src-val">' + (src.method || '') + '</span></div>' +
           (accnUrl ? '<a class="eq-src-link" href="' + accnUrl + '" target="_blank" rel="noopener">View filing →</a>' : '');
  }

  pop.innerHTML = html;
  document.body.appendChild(pop);

  // Position near anchor
  const rect = anchor.getBoundingClientRect();
  const pw = 240;
  let left = rect.right + 8;
  if (left + pw > window.innerWidth - 8) left = rect.left - pw - 8;
  pop.style.left = Math.max(8, left) + 'px';
  pop.style.top  = Math.max(8, rect.top) + 'px';

  const close = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 0);
}

// ── Data Panel ──
function renderDataPanel(v7, fund, chartMeta, fh) {
  const el = document.getElementById('eq-data-col');
  if (!el) return;

  function px(v) { return v != null ? '$' + v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'; }
  function fmtDollar(v) { return v != null ? '$' + fmtFinNum(v) : '—'; }

  // ── New panel helpers: dense terminal-style rows ──
  function row(label, value, cls, id) {
    return '<div class="eq-panel-row"' + (id ? ' id="' + id + '"' : '') + '>' +
      '<span class="eq-panel-lbl">' + label + '</span>' +
      '<span class="eq-panel-val' + (cls ? ' ' + cls : '') + '">' + (value != null ? value : '—') + '</span>' +
      '</div>';
  }
  function sect(title, rows, note) {
    return '<div class="eq-panel-section"><div class="eq-panel-hdr">' +
      '<span class="eq-panel-hdr-label">' + title + '</span>' +
      (note ? '<span class="eq-panel-hdr-note">' + note + '</span>' : '') +
      '</div>' + rows.join('') + '</div>';
  }
  // Source-tagged row (for EDGAR path)
  function sr(id, label, value, cls) {
    const src = _panelSources['eq-m-' + id];
    return '<div class="eq-panel-row' + (src ? ' eq-panel-src' : '') + '" id="eq-m-' + id + '">' +
      '<span class="eq-panel-lbl">' + label + '</span>' +
      '<span class="eq-panel-val' + (cls ? ' ' + cls : '') + '">' + (value ?? '—') + '</span>' +
      '</div>';
  }

  // ── Price & market data — always from Yahoo v7 / chartMeta ──
  const prc = fund?._source !== 'edgar' ? (fund?.price || {}) : {};
  const sum = fund?._source !== 'edgar' ? (fund?.summaryDetail || {}) : {};
  const price   = v7?.regularMarketPrice   ?? getRaw(prc.regularMarketPrice)   ?? chartMeta?.regularMarketPrice;
  const _prev   = chartMeta?.previousClose || chartMeta?.chartPreviousClose;
  const change  = v7?.regularMarketChange  ?? getRaw(prc.regularMarketChange)  ?? (price != null && _prev != null ? price - _prev : null);
  const changePct = v7?.regularMarketChangePercent ?? getRaw(prc.regularMarketChangePercent) ?? (change != null && _prev ? change / _prev : null);
  const vol     = v7?.regularMarketVolume  ?? getRaw(prc.regularMarketVolume)  ?? chartMeta?.regularMarketVolume;
  const avgVol  = v7?.averageDailyVolume3Month ?? getRaw(prc.averageDailyVolume3Month) ?? getRaw(sum.averageDailyVolume3Month);
  const high52  = v7?.fiftyTwoWeekHigh ?? getRaw(sum.fiftyTwoWeekHigh) ?? chartMeta?.fiftyTwoWeekHigh;
  const low52   = v7?.fiftyTwoWeekLow  ?? getRaw(sum.fiftyTwoWeekLow)  ?? chartMeta?.fiftyTwoWeekLow;
  const beta    = v7?.beta ?? getRaw(sum.beta);
  const fwdPE   = v7?.forwardPE ?? getRaw(prc.forwardPE) ?? getRaw(sum.forwardPE);
  const exchange = v7?.fullExchangeName || v7?.exchange || chartMeta?.fullExchangeName || '—';
  const divYield = v7?.trailingAnnualDividendYield ?? v7?.dividendYield ?? getRaw(fh?.financialData?.dividendYield) ?? null;

  // Range-aware change metric
  const useRange = eqRangeChangeAmt != null;
  const dispChange    = useRange ? eqRangeChangeAmt  : change;
  const dispChangePct = useRange ? eqRangeChangePct  : changePct;
  const changeLabel   = useRange ? 'Chg (' + eqCurrentRange + ')' : 'Change';
  const upDown = (dispChange || 0) >= 0;
  const changeStr = dispChange != null
    ? (upDown ? '+' : '') + dispChange.toFixed(2) + ' (' + (upDown ? '+' : '') + ((dispChangePct || 0) * 100).toFixed(2) + '%)'
    : '—';

  // ── EDGAR path ──
  if (fund?._source === 'edgar') {
    const sharesOut = fund.sharesOut ?? v7?.sharesOutstanding;
    const mktCap    = v7?.marketCap ?? (price && sharesOut ? price * sharesOut : null);
    const calcEPS   = fund.epsDiluted ?? (fund.netIncome && sharesOut ? fund.netIncome / sharesOut : null);
    const pe        = price && calcEPS && calcEPS > 0 ? price / calcEPS : null;
    const ps        = mktCap && fund.revenue    && fund.revenue    > 0 ? mktCap / fund.revenue    : null;
    const pb        = mktCap && fund.equity     && fund.equity     > 0 ? mktCap / fund.equity     : null;
    const pfcf      = mktCap && fund.freeCashFlow && fund.freeCashFlow > 0 ? mktCap / fund.freeCashFlow : null;
    // EV: prefer Yahoo's reported value, fall back to mktCap + netDebt
    const ev        = v7?.enterpriseValue ?? (mktCap != null && fund.netDebt != null ? mktCap + fund.netDebt : null);
    // EV/EBITDA: compute from ev+ebitda, or use Finnhub's pre-computed ratio directly
    const fhEvEbitda = getRaw(fh?.defaultKeyStatistics?.enterpriseToEbitda);
    const evEbitda  = (ev != null && fund.ebitda != null && fund.ebitda !== 0)
      ? ev / fund.ebitda
      : fhEvEbitda;

    // Build source map for this render
    _panelSources = {};
    const YS = { type: 'yahoo', desc: 'Yahoo Finance — real-time market data' };
    const CS = f => ({ type: 'computed', formula: f });
    _panelSources['eq-m-price']      = YS;
    _panelSources['eq-metric-change'] = YS;
    _panelSources['eq-m-vol']      = YS;
    _panelSources['eq-m-avgvol']   = YS;
    _panelSources['eq-m-mktcap']   = YS;
    _panelSources['eq-m-sharesout']= fund._sources?.sharesOut || YS;
    _panelSources['eq-m-high52']   = YS;
    _panelSources['eq-m-low52']    = YS;
    _panelSources['eq-m-pe']       = CS('Price ÷ EPS Diluted (EDGAR, TTM)');
    _panelSources['eq-m-fwdpe']    = { type: 'yahoo', desc: 'Analyst consensus forward EPS — may not be available for all tickers' };
    _panelSources['eq-m-ps']       = CS('Market Cap ÷ Revenue TTM (EDGAR)');
    _panelSources['eq-m-pb']       = CS('Market Cap ÷ Stockholders\' Equity (EDGAR)');
    _panelSources['eq-m-pfcf']     = CS('Market Cap ÷ Free Cash Flow TTM (EDGAR)');
    _panelSources['eq-m-evEbitda'] = (ev != null && fund.ebitda != null && fund.ebitda !== 0)
      ? (v7?.enterpriseValue != null
          ? { type: 'yahoo', desc: 'Enterprise Value (Yahoo Finance) ÷ EBITDA TTM (EDGAR: Op. Income + D&A)' }
          : CS('(Market Cap + Net Debt) ÷ EBITDA TTM — EBITDA = Op. Income + D&A (EDGAR)'))
      : { type: 'finnhub', desc: 'EV/EBITDA ratio from Finnhub (EDGAR EBITDA unavailable)' };
    _panelSources['eq-m-grossMargin'] = fund._sources?.grossMargin;
    _panelSources['eq-m-opMargin']    = fund._sources?.opMargin;
    _panelSources['eq-m-netMargin']   = fund._sources?.netMargin;
    _panelSources['eq-m-roe']         = fund._sources?.roe;
    _panelSources['eq-m-roa']         = fund._sources?.roa;
    _panelSources['eq-m-revenue']     = fund._sources?.revenue;
    _panelSources['eq-m-debtEq']      = fund._sources?.debtToEquity;
    _panelSources['eq-m-cr']          = fund._sources?.currentRatio;
    _panelSources['eq-m-fcf']         = fund._sources?.freeCashFlow;
    _panelSources['eq-m-eps']         = fund._sources?.epsDiluted;
    _panelSources['eq-m-divyield']    = YS;
    _panelSources['eq-m-beta']        = YS;
    _panelSources['eq-m-exchange']    = YS;

    // Source-tagged metric helper
    el.innerHTML = '<div class="eq-panel">' +
      sect('Price & Market', [
        sr('price',    'Price',         px(price)),
        // Change row uses eq-metric-change ID directly so updatePanelChange() and click handler both find it
        '<div class="eq-panel-row eq-panel-src" id="eq-metric-change">' +
          '<span class="eq-panel-lbl">' + changeLabel + '</span>' +
          '<span class="eq-panel-val ' + (upDown ? 'good' : 'bad') + '">' + changeStr + '</span>' +
        '</div>',
        sr('vol',      'Volume',        fmtFinNum(vol)),
        sr('avgvol',   'Avg Vol (3M)',  fmtFinNum(avgVol)),
        sr('mktcap',   'Market Cap',    fmtDollar(mktCap)),
        sr('sharesout','Shares Out',    fmtFinNum(sharesOut)),
        sr('high52',   '52W High',      px(high52)),
        sr('low52',    '52W Low',       px(low52)),
        sr('divyield', 'Div Yield',     divYield != null ? (divYield * 100).toFixed(2) + '%' : 'N/A'),
        sr('exchange', 'Exchange',      exchange),
      ]) +
      sect('Valuation', [
        sr('pe',       'P/E (TTM)',     pe       != null ? pe.toFixed(1)       + 'x' : '—', pe       != null && pe       > 0 && pe       < 25 ? 'good' : pe       != null && pe       < 40 ? 'warn' : ''),
        sr('fwdpe',    'Fwd P/E',       fwdPE    != null ? fwdPE.toFixed(1)    + 'x' : '—', fwdPE    != null && fwdPE    > 0 && fwdPE    < 20 ? 'good' : fwdPE    != null && fwdPE    < 35 ? 'warn' : ''),
        sr('ps',       'P/S',           ps       != null ? ps.toFixed(2)        + 'x' : '—', ps       != null && ps       > 0 && ps       < 5  ? 'good' : ps       != null && ps       < 10 ? 'warn' : ''),
        sr('pb',       'P/B',           pb       != null ? pb.toFixed(2)        + 'x' : '—', pb       != null && pb       > 0 && pb       < 3  ? 'good' : pb       != null && pb       < 6  ? 'warn' : ''),
        sr('pfcf',     'P/FCF',         pfcf     != null ? pfcf.toFixed(1)     + 'x' : '—', pfcf     != null && pfcf     > 0 && pfcf     < 25 ? 'good' : pfcf     != null && pfcf     < 50 ? 'warn' : ''),
        sr('evEbitda', 'EV/EBITDA',     evEbitda != null ? evEbitda.toFixed(1) + 'x' : '—', evEbitda != null && evEbitda > 0 && evEbitda < 15 ? 'good' : evEbitda != null && evEbitda < 25 ? 'warn' : ''),
      ], 'GAAP · EDGAR') +
      sect('Profitability', [
        sr('revenue',     'Revenue (TTM)',  fmtDollar(fund.revenue)),
        sr('grossMargin', 'Gross Margin',   fmtPct(fund.grossMargin),   fund.grossMargin != null && fund.grossMargin > 0.40 ? 'good' : fund.grossMargin != null && fund.grossMargin > 0.20 ? 'warn' : ''),
        sr('opMargin',    'Op Margin',      fmtPct(fund.opMargin),      fund.opMargin    != null && fund.opMargin    > 0.15 ? 'good' : fund.opMargin    != null && fund.opMargin    > 0.05 ? 'warn' : ''),
        sr('netMargin',   'Net Margin',     fmtPct(fund.netMargin),     fund.netMargin   != null && fund.netMargin   > 0.10 ? 'good' : fund.netMargin   != null && fund.netMargin   > 0.02 ? 'warn' : ''),
        sr('roe',         'ROE',            fmtPct(fund.roe),           fund.roe         != null && fund.roe         > 0.15 ? 'good' : fund.roe         != null && fund.roe         > 0.05 ? 'warn' : ''),
        sr('roa',         'ROA',            fmtPct(fund.roa),           fund.roa         != null && fund.roa         > 0.05 ? 'good' : fund.roa         != null && fund.roa         > 0.01 ? 'warn' : ''),
      ], 'GAAP · EDGAR') +
      sect('Financial Health', [
        sr('fcf',    'Free Cash Flow',  fmtDollar(fund.freeCashFlow), fund.freeCashFlow != null && fund.freeCashFlow > 0 ? 'good' : fund.freeCashFlow != null ? 'bad' : ''),
        sr('eps',    'EPS (TTM)',       fund.epsDiluted != null ? '$' + fund.epsDiluted.toFixed(2) : '—', fund.epsDiluted != null && fund.epsDiluted > 0 ? 'good' : fund.epsDiluted != null ? 'bad' : ''),
        sr('debtEq', 'Debt / Equity',  fund.debtToEquity != null ? fund.debtToEquity.toFixed(2) + 'x' : '—', fund.debtToEquity != null && fund.debtToEquity < 0.5 ? 'good' : fund.debtToEquity != null && fund.debtToEquity < 1.5 ? 'warn' : fund.debtToEquity != null ? 'bad' : ''),
        sr('cr',     'Current Ratio',  fund.currentRatio != null ? fund.currentRatio.toFixed(2) + 'x' : '—', fund.currentRatio != null && fund.currentRatio > 1.5 ? 'good' : fund.currentRatio != null && fund.currentRatio > 1 ? 'warn' : fund.currentRatio != null ? 'bad' : ''),
        sr('beta',   'Beta',           beta != null ? beta.toFixed(2) : '—', beta != null && beta < 1.5 ? 'good' : beta != null && beta < 2.5 ? 'warn' : ''),
      ], 'GAAP · EDGAR') +
      '</div>';

    // Wire source click handlers
    el.querySelectorAll('.eq-panel-src').forEach(m => {
      m.addEventListener('click', e => {
        const src = _panelSources[m.id];
        if (src) { showSourcePop(m, src); e.stopPropagation(); }
      });
    });
    return;
  }

  // ── Legacy path (Finnhub fallback) ──
  const fin   = fund?.financialData        || {};
  const stats = fund?.defaultKeyStatistics || {};
  const mktCap   = v7?.marketCap ?? getRaw(prc.marketCap) ?? getRaw(sum.marketCap);
  const sharesOut = v7?.sharesOutstanding  ?? getRaw(prc.sharesOutstanding);
  const trPE  = v7?.trailingPE ?? getRaw(prc.trailingPE) ?? getRaw(sum.trailingPE);
  const pb    = v7?.priceToBook ?? getRaw(prc.priceToBook) ?? getRaw(sum.priceToBook);
  const eps   = v7?.epsTrailingTwelveMonths ?? getRaw(prc.epsTrailingTwelveMonths);
  const ps    = getRaw(stats.priceToSalesTrailing12Months);
  const evEbitda = getRaw(stats.enterpriseToEbitda);
  const fcfRaw   = getRaw(fin.freeCashflow);
  const pfcf  = (mktCap && fcfRaw && fcfRaw > 0) ? mktCap / fcfRaw : null;
  const grossM = getRaw(fin.grossMargins);
  const opM    = getRaw(fin.operatingMargins);
  const netM   = getRaw(fin.profitMargins);
  const roe    = getRaw(fin.returnOnEquity);
  const roa    = getRaw(fin.returnOnAssets);
  const de     = getRaw(fin.debtToEquity);
  const cr     = getRaw(fin.currentRatio);
  const rev    = getRaw(fin.totalRevenue);

  el.innerHTML = '<div class="eq-panel">' +
    sect('Price & Market', [
      row('Price',        px(price)),
      row(changeLabel,    changeStr, upDown ? 'good' : 'bad', 'eq-metric-change'),
      row('Volume',       fmtFinNum(vol)),
      row('Avg Vol (3M)', fmtFinNum(avgVol)),
      row('Market Cap',   fmtDollar(mktCap)),
      row('Shares Out',   fmtFinNum(sharesOut)),
      row('52W High',     px(high52)),
      row('52W Low',      px(low52)),
      row('Div Yield',    divYield != null ? (divYield * 100).toFixed(2) + '%' : 'N/A'),
      row('Exchange',     exchange),
    ]) +
    sect('Valuation', [
      row('P/E (TTM)',  trPE     != null ? trPE.toFixed(1)     + 'x' : '—', trPE     != null && trPE     > 0 && trPE     < 25 ? 'good' : trPE     != null && trPE     < 40 ? 'warn' : ''),
      row('Fwd P/E',   fwdPE    != null ? fwdPE.toFixed(1)    + 'x' : '—', fwdPE    != null && fwdPE    > 0 && fwdPE    < 20 ? 'good' : fwdPE    != null && fwdPE    < 35 ? 'warn' : ''),
      row('P/B',       pb       != null ? pb.toFixed(2)        + 'x' : '—', pb       != null && pb       > 0 && pb       < 3  ? 'good' : pb       != null && pb       < 6  ? 'warn' : ''),
      row('P/S',       ps       != null ? ps.toFixed(2)        + 'x' : '—', ps       != null && ps       > 0 && ps       < 5  ? 'good' : ps       != null && ps       < 10 ? 'warn' : ''),
      row('P/FCF',     pfcf     != null ? pfcf.toFixed(1)     + 'x' : '—', pfcf     != null && pfcf     > 0 && pfcf     < 25 ? 'good' : pfcf     != null && pfcf     < 50 ? 'warn' : ''),
      row('EV/EBITDA', evEbitda != null ? evEbitda.toFixed(1) + 'x' : '—', evEbitda != null && evEbitda > 0 && evEbitda < 15 ? 'good' : evEbitda != null && evEbitda < 25 ? 'warn' : ''),
    ], 'Finnhub') +
    sect('Profitability', [
      row('Revenue (TTM)', fmtDollar(rev)),
      row('Gross Margin',  fmtPct(grossM), grossM != null && grossM > 0.40 ? 'good' : grossM != null && grossM > 0.20 ? 'warn' : ''),
      row('Op Margin',     fmtPct(opM),    opM    != null && opM    > 0.15 ? 'good' : opM    != null && opM    > 0.05 ? 'warn' : ''),
      row('Net Margin',    fmtPct(netM),   netM   != null && netM   > 0.10 ? 'good' : netM   != null && netM   > 0.02 ? 'warn' : ''),
      row('ROE',           fmtPct(roe),    roe    != null && roe    > 0.15 ? 'good' : roe    != null && roe    > 0.05 ? 'warn' : ''),
      row('ROA',           fmtPct(roa),    roa    != null && roa    > 0.05 ? 'good' : roa    != null && roa    > 0.01 ? 'warn' : ''),
    ], 'Finnhub') +
    sect('Financial Health', [
      row('Free Cash Flow', fmtDollar(fcfRaw), fcfRaw != null && fcfRaw > 0 ? 'good' : fcfRaw != null ? 'bad' : ''),
      row('EPS (TTM)',      eps != null ? '$' + eps.toFixed(2) : '—', eps != null && eps > 0 ? 'good' : eps != null ? 'bad' : ''),
      row('Debt / Equity',  de != null ? (de / 100).toFixed(2) + 'x' : '—', de != null && de / 100 < 0.5 ? 'good' : de != null && de / 100 < 1.5 ? 'warn' : de != null ? 'bad' : ''),
      row('Current Ratio',  cr != null ? cr.toFixed(2) + 'x' : '—', cr != null && cr > 1.5 ? 'good' : cr != null && cr > 1 ? 'warn' : cr != null ? 'bad' : ''),
      row('Beta',           beta != null ? beta.toFixed(2) : '—', beta != null && beta < 1.5 ? 'good' : beta != null && beta < 2.5 ? 'warn' : ''),
    ], 'Finnhub') +
    '</div>';
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
  const sampledVol = sampledIdx.map((origIdx, j) => ({ x: sampled[j].x, y: volPoints[origIdx]?.y ?? 0 }));
  const sampledVolColors = sampledIdx.map(i => (volPoints[i]?.up !== false) ? 'rgba(0,217,126,0.35)' : 'rgba(255,77,106,0.35)');
  const maxVol = Math.max(...sampledVol.map(v => v.y).filter(v => v > 0), 1);

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
  const sampledEma12 = sampledIdx.map((origIdx, j) => ({ x: sampled[j].x, y: ema12Full[origIdx] ?? null }));
  const sampledEma26 = sampledIdx.map((origIdx, j) => ({ x: sampled[j].x, y: ema26Full[origIdx] ?? null }));

  if (window._eqChartAbort) window._eqChartAbort.abort();
  window._eqChartAbort = new AbortController();
  const sig = { signal: window._eqChartAbort.signal };

  function getCanvasX(e, cvs) {
    const rect = cvs.getBoundingClientRect();
    return (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  }
  function clampToData(x) {
    const pts = eqChartInstance?._dataPts;
    if (pts && pts.length) return Math.max(pts[0].x, Math.min(pts[pts.length - 1].x, x));
    const area = eqChartInstance?.chartArea;
    if (area) return Math.max(area.left, Math.min(area.right, x));
    return x;
  }
  canvas.addEventListener('mousedown', e => {
    if (!eqChartInstance) return;
    eqChartInstance._dragStart = clampToData(getCanvasX(e, canvas)); eqChartInstance._dragEnd = null; eqChartInstance._dragging = true;
  }, sig);
  canvas.addEventListener('mousemove', e => {
    if (!eqChartInstance) return;
    const cx = getCanvasX(e, canvas);
    eqChartInstance._hoverX = cx;
    if (eqChartInstance._dragging) eqChartInstance._dragEnd = clampToData(cx);
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
      chart._dataPts = pts; // expose for drag clamping
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

  const rangeMs = sampled.length > 1 ? sampled[sampled.length - 1].x - sampled[0].x : 86400000;
  function pickUnit(ms) {
    if (ms > 90 * 86400000) return 'month';
    if (ms > 14 * 86400000) return 'week';
    if (ms > 3 * 86400000) return 'day';
    if (ms > 12 * 3600000) return 'hour';
    return 'minute';
  }
  const initUnit = pickUnit(rangeMs);

  eqChartInstance = new Chart(ctx, {
    type: 'line',
    plugins: [crosshairPlugin],
    data: {
      datasets: [
        { label: 'Price', data: sampled, borderColor: lineColor, borderWidth: 1.5, backgroundColor: fillColor, fill: true, tension: 0.2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: lineColor, yAxisID: 'y', order: 3 },
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
            const val = item.parsed?.y;
            if (val == null) return null;
            if (item.dataset.label === 'Volume') {
              return ' Vol: ' + (val >= 1e9 ? (val/1e9).toFixed(2)+'B' : val >= 1e6 ? (val/1e6).toFixed(2)+'M' : val >= 1e3 ? (val/1e3).toFixed(0)+'K' : val);
            }
            const prefix = item.dataset.label === 'Price' ? ' $' : ' ' + item.dataset.label + ': $';
            return prefix + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }}
        },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x',
            onZoomComplete({ chart }) {
              const xScale = chart.scales.x;
              const unit = pickUnit(xScale.max - xScale.min);
              if (chart.options.scales.x.time.unit !== unit) { chart.options.scales.x.time.unit = unit; chart.update('none'); }
            }
          },
          limits: { x: { minRange: 15 * 60 * 1000 } }
        }
      },
      scales: {
        x: { type: 'time', offset: false, bounds: 'data', time: { unit: initUnit, tooltipFormat: 'MMM d, yyyy h:mm a', displayFormats: { minute: 'h:mm a', hour: 'h:mm a', day: 'MMM d', week: 'MMM d', month: "MMM 'yy" } }, ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 8, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.03)' }, border: { color: '#1e1e22' } },
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
  const sampledIdx = [];
  for (let i = 0; i < ohlcPoints.length; i++) { if (i % step === 0 || i === ohlcPoints.length - 1) sampledIdx.push(i); }
  const sampled = sampledIdx.map(i => ohlcPoints[i]);

  // EMAs from close prices
  function calcEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = new Array(prices.length).fill(null);
    let prev = null, count = 0;
    for (let i = 0; i < prices.length; i++) {
      if (prices[i] == null) continue;
      if (prev === null) { count++; if (count < period) continue; let sum = 0, n = 0; for (let j = 0; j <= i; j++) { if (prices[j] != null) { sum += prices[j]; n++; } } prev = sum / n; }
      else { prev = prices[i] * k + prev * (1 - k); }
      ema[i] = prev;
    }
    return ema;
  }
  const closes = ohlcPoints.map(p => p.c);
  const ema12Full = calcEMA(closes, 12);
  const ema26Full = calcEMA(closes, 26);
  const sampledEma12 = sampledIdx.map((origIdx, j) => ({ x: sampled[j].x, y: ema12Full[origIdx] ?? null }));
  const sampledEma26 = sampledIdx.map((origIdx, j) => ({ x: sampled[j].x, y: ema26Full[origIdx] ?? null }));

  // Volume — match by timestamp
  const volMap = new Map((eqVolumePoints || []).map(v => [v.x, v]));
  const sampledVol = sampled.map(p => ({ x: p.x, y: volMap.get(p.x)?.y ?? 0 }));
  const sampledVolColors = sampled.map(p => p.c >= p.o ? 'rgba(0,217,126,0.35)' : 'rgba(255,77,106,0.35)');
  const maxVol = Math.max(...sampledVol.map(v => v.y).filter(v => v > 0), 1);

  // Dynamic time unit
  const rangeMs = sampled.length > 1 ? sampled[sampled.length - 1].x - sampled[0].x : 86400000;
  function pickUnit(ms) {
    if (ms > 90 * 86400000) return 'month';
    if (ms > 14 * 86400000) return 'week';
    if (ms > 3 * 86400000) return 'day';
    if (ms > 12 * 3600000) return 'hour';
    return 'minute';
  }
  const initUnit = pickUnit(rangeMs);

  eqChartInstance = new Chart(ctx, {
    type: 'candlestick',
    data: {
      datasets: [
        { label: eqCurrentSymbol || '', data: sampled, color: { up: '#00d97e', down: '#ff4d6a', unchanged: '#6b6b7a' }, yAxisID: 'y', order: 3 },
        { label: 'EMA 12', type: 'line', data: sampledEma12, borderColor: 'rgba(255,170,0,0.75)', borderWidth: 1, backgroundColor: 'transparent', fill: false, tension: 0.2, pointRadius: 0, pointHoverRadius: 0, spanGaps: true, yAxisID: 'y', order: 1 },
        { label: 'EMA 26', type: 'line', data: sampledEma26, borderColor: 'rgba(100,160,255,0.75)', borderWidth: 1, backgroundColor: 'transparent', fill: false, tension: 0.2, pointRadius: 0, pointHoverRadius: 0, spanGaps: true, yAxisID: 'y', order: 2 },
        { label: 'Volume', type: 'bar', data: sampledVol, backgroundColor: sampledVolColors, borderWidth: 0, yAxisID: 'y2', order: 10 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', align: 'end', labels: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, boxWidth: 20, boxHeight: 1, padding: 10, usePointStyle: false,
          filter: item => item.text !== (eqCurrentSymbol || '') && item.text !== 'Volume' } },
        tooltip: {
          mode: 'index', intersect: false,
          backgroundColor: '#1a1a1f', borderColor: '#2a2a30', borderWidth: 1, titleColor: '#6b6b7a', bodyColor: '#e8e8ed',
          titleFont: { family: "'IBM Plex Mono', monospace", size: 10 }, bodyFont: { family: "'IBM Plex Mono', monospace", size: 10 },
          callbacks: { label: item => {
            if (item.dataset.label === 'Volume') {
              const v = item.parsed?.y; if (v == null) return null;
              return ' Vol: ' + (v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v);
            }
            if (item.dataset.label === 'EMA 12' || item.dataset.label === 'EMA 26') {
              const v = item.parsed?.y; if (v == null) return null;
              return ' ' + item.dataset.label + ': $' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            const d = item.raw; if (!d) return null;
            return ['O: $' + (d.o||0).toFixed(2) + '   H: $' + (d.h||0).toFixed(2), 'L: $' + (d.l||0).toFixed(2) + '   C: $' + (d.c||0).toFixed(2)];
          }}
        },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x',
            onZoomComplete({ chart }) {
              const xScale = chart.scales.x;
              const unit = pickUnit(xScale.max - xScale.min);
              if (chart.options.scales.x.time.unit !== unit) { chart.options.scales.x.time.unit = unit; chart.update('none'); }
            }
          },
          limits: { x: { minRange: 15 * 60 * 1000 } }
        }
      },
      scales: {
        x: { type: 'time', offset: false, bounds: 'data', time: { unit: initUnit, tooltipFormat: 'MMM d, yyyy h:mm a', displayFormats: { minute: 'h:mm a', hour: 'h:mm a', day: 'MMM d', week: 'MMM d', month: "MMM 'yy" } }, ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 8, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.03)' }, border: { color: '#1e1e22' } },
        y: { position: 'right', ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 6, callback: v => v >= 1000 ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '$' + v.toFixed(2) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: '#1e1e22' } },
        y2: { type: 'linear', position: 'left', min: 0, max: maxVol * 5, grid: { display: false }, border: { display: false },
          afterBuildTicks(axis) { axis.ticks = [0, Math.round(maxVol / 2), maxVol].map(v => ({ value: v })); },
          ticks: { color: 'rgba(107,107,122,0.8)', font: { family: "'IBM Plex Mono', monospace", size: 8 },
            callback: v => { if (v === 0) return '0'; if (v >= 1e9) return (v/1e9).toFixed(1)+'B'; if (v >= 1e6) return (v/1e6).toFixed(1)+'M'; if (v >= 1e3) return (v/1e3).toFixed(0)+'K'; return v; }
          }
        }
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

  let _chartMeta = null, _v7 = null, _fund = null, _fh = null;

  function buildHeader(v7, chartMeta, fund, fh) {
    const hPrice = v7?.regularMarketPrice ?? chartMeta?.regularMarketPrice;
    const hPrev = chartMeta?.previousClose || chartMeta?.chartPreviousClose;
    const hChange = v7?.regularMarketChange ?? (hPrice != null && hPrev != null ? hPrice - hPrev : null);
    const hPct = v7?.regularMarketChangePercent ?? (hChange != null && hPrev ? hChange / hPrev : null);
    const name = v7?.longName || v7?.shortName || fund?._profile?.name || fh?._profile?.name || chartMeta?.longName || chartMeta?.shortName || symbol;
    const up = (hChange || 0) >= 0;

    // Company website — prefer EDGAR, then Finnhub profile
    const siteRaw = fund?.website || fh?._profile?.weburl || null;
    const site = siteRaw ? (siteRaw.startsWith('http') ? siteRaw : 'https://' + siteRaw) : null;
    const cik = fund?._cik || null;
    // SEC EDGAR accepts CIK numbers OR ticker symbols — always show filing links
    const secId = cik || symbol;

    let links = '';
    if (site) links += '<a class="eq-ext-link" href="' + site + '" target="_blank" rel="noopener" title="Company website">Website ↗</a>';
    links += '<a class="eq-ext-link" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + secId + '&type=10-K&dateb=&owner=include&count=5" target="_blank" rel="noopener" title="SEC 10-K filings">10-K ↗</a>';
    links += '<a class="eq-ext-link" href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + secId + '&type=10-Q&dateb=&owner=include&count=5" target="_blank" rel="noopener" title="SEC 10-Q filings">10-Q ↗</a>';

    if (headerEl) {
      headerEl.innerHTML =
        '<div class="eq-stock-name">' + name + '</div>' +
        '<div class="eq-stock-price">$' + (hPrice != null ? hPrice.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—') + '</div>' +
        '<span class="eq-stock-change ' + (up?'up':'down') + '">' + (up?'+':'') + (hChange||0).toFixed(2) + ' (' + (up?'+':'') + ((hPct||0)*100).toFixed(2) + '%)</span>' +
        (links ? '<div class="eq-header-links">' + links + '</div>' : '');
    }
  }

  loadEqChart(symbol, eqCurrentRange, eqCurrentInterval)
    .then(result => {
      _chartMeta = result?.meta || null;
      buildHeader(_v7, _chartMeta, _fund, _fh);
      renderDataPanel(_v7, _fund, _chartMeta, _fh);
    }).catch(() => {});

  fetchYahooV7Quote(symbol)
    .then(result => {
      _v7 = result;
      buildHeader(_v7, _chartMeta, _fund, _fh);
      renderDataPanel(_v7, _fund, _chartMeta, _fh);
    }).catch(() => {});

  // Run EDGAR + Finnhub + Yahoo v10 in parallel — EDGAR primary, others fill gaps
  Promise.all([
    fetchEdgarFundamentals(symbol).catch(() => null),
    fetchFinnhubFundamentals(symbol).catch(() => null),
    fetchFundamentals(symbol).catch(() => null),
  ]).then(([edgarFund, fhFund, yahooFund]) => {
    _fh = fhFund;
    const yFin = yahooFund?.financialData || {};
    const yRevenue = getRaw(yFin.totalRevenue);

    if (edgarFund) {
      // Supplement EDGAR revenue gap: try Finnhub, then Yahoo v10
      if (edgarFund.revenue == null) {
        const fhRev = fhFund?.financialData?.totalRevenue ?? null;
        const rev = fhRev != null ? fhRev : yRevenue;
        if (rev != null) {
          edgarFund.revenue = rev;
          edgarFund._sources = edgarFund._sources || {};
          edgarFund._sources.revenue = fhRev != null
            ? { type: 'finnhub', desc: 'Finnhub — TTM Revenue (EDGAR tag not matched)' }
            : { type: 'yahoo',   desc: 'Yahoo Finance — TTM Revenue (EDGAR tag not matched)' };
        }
      }
      _fund = edgarFund;
    } else if (fhFund) {
      // Supplement Finnhub revenue gap from Yahoo v10
      if (fhFund.financialData.totalRevenue == null && yRevenue != null) {
        fhFund.financialData.totalRevenue = yRevenue;
      }
      _fund = fhFund;
    } else if (yahooFund) {
      // Yahoo v10 as last-resort fund source (uses legacy panel path)
      _fund = yahooFund;
    }

    if (_fund) {
      buildHeader(_v7, _chartMeta, _fund, _fh);
      renderDataPanel(_v7, _fund, _chartMeta, _fh);
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
  el.querySelector('.eq-panel-lbl').textContent = 'Chg (' + eqCurrentRange + ')';
  const valEl = el.querySelector('.eq-panel-val');
  valEl.textContent = str;
  valEl.className = 'eq-panel-val ' + (up ? 'good' : 'bad');
}

// ── Ticker Autocomplete (shared: main search + watchlist inputs) ──
function attachTickerAutocomplete(input, onSelect) {
  // Create dropdown anchored to input
  const drop = document.createElement('div');
  drop.className = 'eq-search-drop';
  drop.style.display = 'none';
  // Insert after input's parent if it has .eq-search-input-wrap, else after input itself
  const wrap = input.closest('.eq-search-input-wrap') || input.parentElement;
  wrap.style.position = 'relative';
  wrap.appendChild(drop);

  let debounce = null;
  let activeIdx = -1;
  let lastResults = [];
  let docClickListener = null;

  function hideDrop() {
    drop.style.display = 'none';
    activeIdx = -1;
    if (docClickListener) {
      document.removeEventListener('click', docClickListener);
      docClickListener = null;
    }
  }

  function showDrop() {
    drop.style.display = 'block';
    if (!docClickListener) {
      docClickListener = e => {
        if (!input.contains(e.target) && !drop.contains(e.target)) hideDrop();
      };
      // Defer so the click that opened the drop doesn't immediately close it
      setTimeout(() => document.addEventListener('click', docClickListener), 0);
    }
  }

  function buildDrop(results) {
    lastResults = results;
    activeIdx = -1;
    if (!results.length) { hideDrop(); return; }
    drop.innerHTML = '';
    results.forEach(r => {
      const item = document.createElement('div');
      item.className = 'eq-search-item';
      item.innerHTML =
        '<span class="eq-search-sym">' + r.symbol + '</span>' +
        '<span class="eq-search-name">' + r.name + '</span>' +
        (r.exchange ? '<span class="eq-search-exch">' + r.exchange + '</span>' : '');
      item.addEventListener('mousedown', e => { e.preventDefault(); onSelect(r.symbol); hideDrop(); });
      drop.appendChild(item);
    });
    showDrop();
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounce);
    if (!q) { hideDrop(); return; }
    debounce = setTimeout(async () => { buildDrop(await searchTickers(q)); }, 260);
  });

  input.addEventListener('keydown', e => {
    if (drop.style.display === 'none') {
      if (e.key === 'Enter') { onSelect(input.value.trim().toUpperCase()); }
      return;
    }
    const items = drop.querySelectorAll('.eq-search-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, -1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && lastResults[activeIdx]) { onSelect(lastResults[activeIdx].symbol); hideDrop(); }
      else { hideDrop(); onSelect(input.value.trim().toUpperCase()); }
      return;
    } else if (e.key === 'Escape') { hideDrop(); return; }
    items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
  });
}

function initSearchAutocomplete() {
  const input = document.getElementById('eq-ticker-input');
  if (!input) return;
  attachTickerAutocomplete(input, sym => { input.value = sym; loadEquityStock(sym); });
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
  initSearchAutocomplete();
}
