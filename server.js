import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// SEC requires a descriptive User-Agent for automated requests
const SEC_UA = process.env.SEC_UA || 'pocket-outlook/1.0 (contact@example.com)';
const EDGAR_HEADERS = { 'User-Agent': SEC_UA, 'Accept': 'application/json' };

// ── Serve frontend ──────────────────────────────────────────────────────────
app.use(express.static(__dirname));

// ── CIK cache (populated once, refreshed weekly) ────────────────────────────
let _cikMap = null;
let _cikTs  = 0;
const CIK_TTL = 7 * 24 * 60 * 60 * 1000;

async function getCik(ticker) {
  if (!_cikMap || Date.now() - _cikTs > CIK_TTL) {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: EDGAR_HEADERS });
    if (!res.ok) throw new Error('Failed to load SEC ticker map');
    const full = await res.json();
    _cikMap = {};
    for (const e of Object.values(full)) {
      _cikMap[e.ticker.toUpperCase()] = String(e.cik_str).padStart(10, '0');
    }
    _cikTs = Date.now();
  }
  const upper = ticker.toUpperCase();
  if (_cikMap[upper]) return _cikMap[upper];
  // Fallbacks for dual-class shares (e.g. BRK.A → BRK, GOOGL → GOOG)
  for (const alt of [upper.replace(/\.[A-Z]$/, ''), upper.slice(0, -1)]) {
    if (alt && alt !== upper && _cikMap[alt]) return _cikMap[alt];
  }
  return null;
}

// ── Per-concept fetcher ──────────────────────────────────────────────────────
async function getConcept(cik, tag) {
  try {
    const res = await fetch(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`,
      { headers: EDGAR_HEADERS }
    );
    return res.ok ? res.json() : null;
  } catch { return null; }
}

// ── Value extractors ─────────────────────────────────────────────────────────
const usd    = c => c?.units?.USD            ?? [];
const usdps  = c => c?.units?.['USD/shares'] ?? [];
const shares = c => c?.units?.shares         ?? [];
const pd     = e => (new Date(e.end) - new Date(e.start)) / 86400000;

/** Trailing-twelve-months for flow metrics (income statement, cash flow). */
function ttm(entries) {
  const f = entries
    .filter(e => (e.form === '10-K' || e.form === '10-Q') && e.val != null && e.start)
    .sort((a, b) => (new Date(b.end) - new Date(a.end)) || (pd(b) - pd(a)));
  if (!f.length) return null;

  const annualK = f.find(e => e.form === '10-K' && pd(e) > 340);
  const recentQ = f.find(e => e.form === '10-Q' && pd(e) > 60);
  if (!recentQ && !annualK) return null;
  if (!recentQ) return annualK.val;
  if (!annualK) return recentQ.val * (365 / pd(recentQ));
  if (new Date(annualK.end) >= new Date(recentQ.end)) return annualK.val;

  const priorQ = f.find(e => {
    if (e.form !== '10-Q') return false;
    const diff = (new Date(recentQ.end) - new Date(e.end)) / 86400000;
    return diff > 300 && diff < 420 && Math.abs(pd(e) - pd(recentQ)) < 30;
  });
  return priorQ
    ? annualK.val + recentQ.val - priorQ.val
    : annualK.val;
}

/** Most-recent value for balance-sheet (point-in-time) metrics. */
function latest(entries) {
  const f = entries
    .filter(e => (e.form === '10-K' || e.form === '10-Q') && e.val != null)
    .sort((a, b) => new Date(b.end) - new Date(a.end));
  return f[0]?.val ?? null;
}

/** Try each concept in order, return first non-null. */
function firstOf(concepts, extractor) {
  for (const c of concepts) {
    const v = extractor(c);
    if (v != null) return v;
  }
  return null;
}

// ── /api/fundamentals/:ticker ────────────────────────────────────────────────
app.get('/api/fundamentals/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const cik = await getCik(ticker);
    if (!cik) {
      return res.status(404).json({ error: `No SEC filing found for: ${ticker}` });
    }

    // Fire all concept requests in parallel (~14 small files vs one 5–30 MB blob)
    const [
      cRev1, cRev2, cRev3, cRev4, cRev5, cRev6,
      cNetInc,
      cEpsDil,
      cOpCF,
      cCapex1, cCapex2,
      cShares,
      cEquity1, cEquity2,
    ] = await Promise.all([
      getConcept(cik, 'RevenueFromContractWithCustomerExcludingAssessedTax'),
      getConcept(cik, 'RevenueFromContractWithCustomerIncludingAssessedTax'),
      getConcept(cik, 'Revenues'),
      getConcept(cik, 'SalesRevenueNet'),
      getConcept(cik, 'NetRevenues'),
      getConcept(cik, 'OperatingRevenue'),
      getConcept(cik, 'NetIncomeLoss'),
      getConcept(cik, 'EarningsPerShareDiluted'),
      getConcept(cik, 'NetCashProvidedByUsedInOperatingActivities'),
      getConcept(cik, 'PaymentsToAcquirePropertyPlantAndEquipment'),
      getConcept(cik, 'CapitalExpenditureContinuingOperations'),
      getConcept(cik, 'CommonStockSharesOutstanding'),
      getConcept(cik, 'StockholdersEquity'),
      getConcept(cik, 'StockholdersEquityAttributableToParent'),
    ]);

    // ── Flow metrics (TTM) ──
    const revenue = firstOf(
      [cRev1, cRev2, cRev3, cRev4, cRev5, cRev6],
      c => ttm(usd(c))
    );
    const netIncome          = ttm(usd(cNetInc));
    const eps                = ttm(usdps(cEpsDil));
    const operatingCashFlow  = ttm(usd(cOpCF));
    const capexRaw           = firstOf([cCapex1, cCapex2], c => ttm(usd(c)));
    const capex              = capexRaw != null ? Math.abs(capexRaw) : null;
    const freeCashFlow       = operatingCashFlow != null && capex != null
      ? operatingCashFlow - capex : null;

    // ── Balance-sheet metrics (most recent) ──
    const sharesOutstanding  = latest(shares(cShares));
    const bookValue          = firstOf([cEquity1, cEquity2], c => latest(usd(c)));
    const bookValuePerShare  = bookValue != null && sharesOutstanding
      ? bookValue / sharesOutstanding : null;

    if (!revenue && !netIncome && !operatingCashFlow) {
      return res.status(404).json({ error: `No XBRL data found for: ${ticker}` });
    }

    res.json({
      ticker,
      cik,
      metrics: {
        eps,
        revenue,
        netIncome,
        bookValue,
        bookValuePerShare,
        sharesOutstanding,
        operatingCashFlow,
        freeCashFlow,
      },
    });
  } catch (err) {
    console.error(`[fundamentals] ${ticker}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch fundamentals', detail: err.message });
  }
});

app.listen(PORT, () => console.log(`Pocket Outlook running on port ${PORT}`));
