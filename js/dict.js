export const DEFINITIONS = {
  "S&P 500": {
    title: "S&P 500",
    body: "The Standard & Poor's 500 — a stock market index tracking the 500 largest publicly traded U.S. companies by market cap. Widely considered the best single gauge of large-cap U.S. equities and a proxy for the overall market.",
    formula: null,
    tip: "Buffett famously recommends most investors simply buy a low-cost S&P 500 index fund and hold it forever."
  },
  "NASDAQ": {
    title: "NASDAQ Composite",
    body: "An index of over 3,000 stocks listed on the NASDAQ exchange, heavily weighted toward technology and growth companies. More volatile than the S&P 500 due to its tech concentration.",
    formula: null,
    tip: "When the NASDAQ significantly diverges from the S&P 500, it often signals a rotation between growth and value stocks."
  },
  "Dow Jones": {
    title: "Dow Jones Industrial Average",
    body: "One of the oldest stock indices — tracks 30 large, blue-chip U.S. companies. Price-weighted (higher-priced stocks have more influence), which makes it less representative than market-cap-weighted indices like the S&P 500.",
    formula: null,
    tip: "Value investors often pay less attention to the Dow than the S&P 500 due to its small sample size and price-weighting methodology."
  },
  "VIX": {
    title: "VIX — CBOE Volatility Index",
    body: "Measures the market's expectation of 30-day volatility, derived from S&P 500 options prices. Often called the Fear Index. Spikes during market stress and falls during calm periods.",
    formula: "Derived from weighted S&P 500 option prices across strikes",
    tip: "Warren Buffett's paraphrase: Be greedy when others are fearful. A high VIX often marks buying opportunities for long-term value investors."
  },
  "3-Mo T-Bill": {
    title: "3-Month Treasury Bill",
    body: "Short-term U.S. government debt maturing in 90 days. Considered the closest thing to a risk-free rate of return. Used as the baseline in many valuation models including CAPM.",
    formula: "Risk-Free Rate — the floor below which no rational investor should accept returns",
    tip: "When T-Bill yields are high, the hurdle rate for stocks rises. A stock must offer returns meaningfully above the T-Bill rate to justify the added risk."
  },
  "10-Yr Treasury": {
    title: "10-Year Treasury Yield",
    body: "The annualized return on U.S. government bonds maturing in 10 years. The most watched interest rate in the world — influences mortgage rates, corporate borrowing costs, and stock valuations.",
    formula: "Often used as the discount rate in DCF valuation models",
    tip: "Rising 10-year yields compress equity valuations, especially for growth stocks with earnings far in the future. Value stocks tend to be more resilient."
  },
  "30-Yr Treasury": {
    title: "30-Year Treasury Yield",
    body: "The yield on 30-year U.S. government bonds. Reflects long-term inflation expectations and growth outlook. A key benchmark for mortgage rates and long-duration asset pricing.",
    formula: null,
    tip: "The spread between 30-year and 2-year yields is a classic recession predictor — inversion has preceded every U.S. recession since 1955."
  },
  "USD Index": {
    title: "U.S. Dollar Index (DXY)",
    body: "Measures the value of the U.S. dollar against a basket of six major currencies (EUR, JPY, GBP, CAD, SEK, CHF). A rising DXY generally pressures commodities, emerging markets, and multinational earnings.",
    formula: "Geometric weighted average: EUR 57.6%, JPY 13.6%, GBP 11.9%, others",
    tip: "For value investors with international exposure, a strong dollar erodes the USD value of foreign earnings — worth factoring into cross-border valuations."
  },
  "CPI": {
    title: "Consumer Price Index (CPI)",
    body: "Measures the average change in prices paid by consumers for goods and services. The primary gauge of inflation in the U.S., published monthly by the Bureau of Labor Statistics.",
    formula: "CPI = (Cost of basket in current period / Cost of basket in base period) x 100",
    tip: "High inflation erodes the real value of fixed cash flows. Value investors prefer businesses with pricing power — the ability to raise prices without losing customers."
  },
  "Fed Funds Rate": {
    title: "Federal Funds Rate",
    body: "The interest rate at which banks lend reserve balances to other banks overnight. Set by the Federal Reserve FOMC. The most influential interest rate in the world — it cascades through all other borrowing costs.",
    formula: null,
    tip: "Low rates make stocks relatively more attractive (TINA — There Is No Alternative). High rates raise the discount rate, compressing valuations across all asset classes."
  },
  "FOMC": {
    title: "Federal Open Market Committee",
    body: "The 12-member committee within the Federal Reserve that sets U.S. monetary policy. Meets 8 times per year to decide whether to raise, lower, or hold the Federal Funds Rate.",
    formula: null,
    tip: "FOMC meeting dates are key calendar events — markets often move significantly on rate decisions and the language in the Fed statement (the dot plot)."
  },
  "Gold Futures": {
    title: "Gold Futures",
    body: "Contracts to buy or sell gold at a predetermined price at a future date. Used by investors as a hedge against inflation, currency debasement, and systemic risk. Gold has no yield but historically preserves purchasing power.",
    formula: null,
    tip: "Buffett famously avoids gold. But many value investors like Lyn Alden hold it as macro insurance against currency debasement scenarios."
  },
  "Brent Crude": {
    title: "Brent Crude Oil",
    body: "The international benchmark for oil prices, sourced from the North Sea. Used to price roughly two-thirds of global oil supplies. A key input into inflation, transportation costs, and energy sector valuations.",
    formula: null,
    tip: "Energy companies are classic value territory — cyclical, capital-intensive, often trading below intrinsic value at cycle lows."
  },
  "Bitcoin": {
    title: "Bitcoin (BTC)",
    body: "The first and largest cryptocurrency by market cap. A decentralized digital asset with a fixed supply of 21 million coins. Increasingly held by institutions as digital gold — a store of value outside the traditional financial system.",
    formula: null,
    tip: "Traditional value investors are divided on Bitcoin. Some like Lyn Alden see it as legitimate macro insurance. Others like Buffett and Munger view it as purely speculative."
  },
  "Ethereum": {
    title: "Ethereum (ETH)",
    body: "The second-largest cryptocurrency — a programmable blockchain platform that enables smart contracts and decentralized applications. ETH is used to pay for computation on the network (gas fees).",
    formula: null,
    tip: "Unlike Bitcoin's fixed supply, Ethereum's issuance model has shifted post-merge. It can be analyzed more like a tech platform — fee revenue and protocol metrics are emerging as valuation tools."
  },

  // ── Equity Fundamentals ─────────────────────────────────────────────────

  "Market Cap": {
    title: "Market Capitalization",
    body: "Share Price × Shares Outstanding. The market's real-time assessment of a company's total equity value. Used to classify companies: Micro (<$300M), Small (<$2B), Mid (<$10B), Large (<$200B), Mega (>$200B). It is not the same as intrinsic value — that's the whole point of fundamental analysis.",
    formula: "Market Cap = Share Price × Shares Outstanding",
    tip: "Market cap tells you what the market is paying, not what the business is worth. Finding the gap between the two is the entire game."
  },
  "Shares Outstanding": {
    title: "Shares Outstanding",
    body: "The total number of shares currently held by all shareholders — including insiders, institutions, and the public. Dilution (issuing new shares) shrinks each share's ownership stake. Buybacks reduce the count and increase per-share earnings.",
    formula: null,
    tip: "Buffett loves buybacks when done at prices below intrinsic value — they're the most capital-efficient use of excess cash. Watch for companies that buy back shares at inflated prices."
  },
  "Volume": {
    title: "Trading Volume",
    body: "The number of shares traded in a given session. High volume confirms price moves — a strong rally or sell-off on high volume carries more weight than one on thin volume. Unusually high volume often signals an important event.",
    formula: null,
    tip: "Volume is most useful as a confirmation tool. A breakout to new highs on 3× average volume is much more credible than one on light volume."
  },
  "Avg Vol (3M)": {
    title: "Average Volume (3-Month)",
    body: "The rolling 3-month daily average of shares traded. Provides the baseline for interpreting today's volume. If today's volume is 5× the average, something meaningful is happening — an earnings report, news event, or institutional repositioning.",
    formula: null,
    tip: "Institutional investors (funds, pensions) move markets with their volume. Unusual volume spikes often precede or follow institutional activity."
  },
  "52W High": {
    title: "52-Week High",
    body: "The highest price the stock has traded at over the past 52 weeks. Stocks often face resistance near their 52-week highs as sellers who bought at the top look to break even. A breakout above this level on high volume can be significant.",
    formula: null,
    tip: "Contrarian value investors look at stocks near 52-week lows, not highs. But momentum investors do the opposite. Knowing which camp you're in matters."
  },
  "52W Low": {
    title: "52-Week Low",
    body: "The lowest price the stock has traded at over the past 52 weeks. A stock near its 52-week low may be undervalued — or in serious trouble. The key question is whether the decline reflects temporary pessimism or a genuine deterioration in the business.",
    formula: null,
    tip: "Graham's approach: buy stocks near 52-week lows only when the underlying business is still sound. Cheap is not the same as value."
  },
  "Div Yield": {
    title: "Dividend Yield",
    body: "Annual dividends paid per share divided by the current share price. A 4% yield means you receive $4 annually for every $100 invested. Note: a rising yield can mean the dividend grew (good) or the stock price fell (potentially bad).",
    formula: "Dividend Yield = Annual Dividend Per Share ÷ Share Price",
    tip: "A sustainable, growing dividend from a profitable business is a hallmark of quality. Beware of very high yields — they often signal a dividend cut is coming."
  },
  "Beta": {
    title: "Beta (Market Sensitivity)",
    body: "Measures a stock's historical price volatility relative to the S&P 500. Beta of 1.0 = moves with the market. Beta of 1.5 = 50% more volatile. Beta of 0.5 = half as volatile. Negative beta means the stock tends to move opposite to the market.",
    formula: "Beta = Cov(Stock, Market) ÷ Var(Market)",
    tip: "Buffett ignores beta as a measure of risk — he defines risk as the probability of permanent capital loss, not price volatility. A great business at a fair price has low real risk regardless of its beta."
  },
  "EPS (TTM)": {
    title: "Earnings Per Share (TTM)",
    body: "Net income attributable to common shareholders divided by shares outstanding, over the trailing twelve months. The foundational per-share profitability metric. It's the 'E' in the P/E ratio. Diluted EPS accounts for stock options, warrants, and convertible securities.",
    formula: "EPS = Net Income ÷ Diluted Shares Outstanding",
    tip: "EPS can be managed through accounting choices. Always cross-reference with Free Cash Flow per share — if EPS is growing but FCF isn't, investigate why."
  },
  "P/E (TTM)": {
    title: "Price-to-Earnings Ratio (TTM)",
    body: "The price you pay for each dollar of trailing earnings. A P/E of 20x means you're paying $20 for every $1 of annual profit. Lower generally means cheaper, but context matters — a cyclical company at a low P/E near peak earnings may be expensive on normalized earnings.",
    formula: "P/E = Share Price ÷ EPS (Trailing Twelve Months)",
    tip: "Graham's rule of thumb: avoid stocks above 15× earnings for value investing. But quality compounders like Buffett's favorites often deserve premiums — the key is earnings quality and durability."
  },
  "Fwd P/E": {
    title: "Forward P/E",
    body: "Like P/E but uses analyst consensus estimates for next year's earnings instead of the last 12 months. More forward-looking but inherently less reliable — analyst estimates are frequently revised and are often wrong, especially during uncertainty.",
    formula: "Forward P/E = Share Price ÷ Estimated Next-Year EPS",
    tip: "Forward P/E is most useful when the business is highly predictable. For cyclicals and turnarounds, forward estimates are often garbage. Trust TTM earnings more."
  },
  "P/S": {
    title: "Price-to-Sales Ratio",
    body: "Market cap divided by trailing twelve months revenue. Useful for unprofitable companies or early-stage businesses where earnings don't yet exist. A P/S of 5x means the market values the company at $5 for every $1 of annual revenue.",
    formula: "P/S = Market Cap ÷ Annual Revenue",
    tip: "P/S must be interpreted alongside margins. A 2% net margin business deserves a far lower P/S than a 30% margin business. High P/S only makes sense if margins are or will be high."
  },
  "P/B": {
    title: "Price-to-Book Ratio",
    body: "Share price divided by book value per share (total assets minus total liabilities). A P/B below 1.0 means you're buying assets at a discount to their accounting value. Classic Graham-style deep value territory — though accounting book value can diverge sharply from economic reality.",
    formula: "P/B = Market Cap ÷ Shareholders' Equity",
    tip: "P/B is most meaningful for asset-heavy businesses: banks, insurers, industrials. For software or brand-driven companies, intangible assets dominate and book value is nearly meaningless."
  },
  "P/FCF": {
    title: "Price-to-Free Cash Flow",
    body: "Market cap divided by free cash flow. Many serious investors consider this the most honest valuation multiple — cash flow is far harder to manipulate through accounting than earnings. A P/FCF of 20x means you're paying $20 for every $1 of actual cash the business generates.",
    formula: "P/FCF = Market Cap ÷ Free Cash Flow",
    tip: "This is what Buffett means by 'owner earnings' yield. Flip it: a P/FCF of 15× gives a 6.7% free cash flow yield. Compare that to the 10-year Treasury yield to assess relative value."
  },
  "EV/EBITDA": {
    title: "EV/EBITDA",
    body: "Enterprise Value divided by EBITDA. Compares the full acquisition cost of a business (market cap + debt − cash) to its operating earnings power before non-cash and financing charges. Widely used in M&A because it's capital-structure neutral — useful for comparing companies with different debt levels.",
    formula: "EV/EBITDA = (Market Cap + Debt − Cash) ÷ (Operating Income + D&A)",
    tip: "EV/EBITDA below 10× is often considered value territory. Beware: EBITDA ignores capex, which is a real cash cost. For capital-intensive businesses, prefer EV/EBIT or EV/FCF."
  },
  "Revenue (TTM)": {
    title: "Revenue (Trailing Twelve Months)",
    body: "Total top-line sales over the last 12 months. The starting point of every income statement — everything else flows from here. Revenue growth is necessary for compounding, but volume without margins doesn't create value.",
    formula: null,
    tip: "A company can grow revenue forever and still destroy value if margins are deteriorating. Always pair revenue growth with margin analysis — the combination tells the real story."
  },
  "Gross Margin": {
    title: "Gross Margin",
    body: "The percentage of revenue remaining after subtracting the direct cost of producing goods or services (COGS). High gross margins indicate pricing power or a scalable model. Software businesses often exceed 70%; grocery retail runs at 20-25%.",
    formula: "Gross Margin = (Revenue − COGS) ÷ Revenue",
    tip: "Consistent, high gross margins are one of Buffett's clearest signals of a durable competitive advantage (moat). A company that can raise prices without losing customers has pricing power — the most valuable business attribute."
  },
  "Op Margin": {
    title: "Operating Margin",
    body: "Operating income divided by revenue — the percentage of sales left after paying all operating expenses (COGS, SG&A, R&D) but before interest and taxes. Shows how efficiently management runs the core business, independent of how it's financed.",
    formula: "Op Margin = Operating Income ÷ Revenue",
    tip: "Buffett specifically looks for consistently high and stable operating margins over many years as evidence of competitive moat. Volatile or declining operating margins are a red flag."
  },
  "Net Margin": {
    title: "Net Profit Margin",
    body: "Net income divided by revenue — the ultimate bottom line as a percentage of sales. What's left for shareholders after every expense: COGS, operating costs, interest, and taxes. Highly industry-dependent: grocery at 1-2%, software at 20-30%+.",
    formula: "Net Margin = Net Income ÷ Revenue",
    tip: "Compare net margins against industry peers, not in isolation. A 5% net margin could be excellent in retail and terrible in software. Trend over time matters as much as the absolute level."
  },
  "ROE": {
    title: "Return on Equity",
    body: "Net income divided by shareholders' equity. Measures how effectively management generates profit from the capital shareholders have invested. A classic Buffett metric — he looks for companies that consistently generate 15%+ ROE without relying on excessive debt to do it.",
    formula: "ROE = Net Income ÷ Shareholders' Equity",
    tip: "High ROE is meaningful only when driven by genuine profitability, not by loading up on debt (which shrinks the equity denominator). Always check the debt-to-equity ratio alongside ROE."
  },
  "ROA": {
    title: "Return on Assets",
    body: "Net income divided by total assets. Measures how efficiently a company uses its entire asset base to generate profit. Less sensitive to capital structure than ROE since it looks at all assets, not just equity. Particularly useful for comparing banks, industrials, and asset-heavy businesses.",
    formula: "ROA = Net Income ÷ Total Assets",
    tip: "A consistently high ROA (10%+) indicates a business that generates strong returns without needing a huge asset base — a hallmark of great businesses like Coca-Cola or Visa."
  },
  "Free Cash Flow": {
    title: "Free Cash Flow (FCF)",
    body: "Operating cash flow minus capital expenditures. The real cash a business generates after maintaining and investing in its asset base. What Buffett calls 'owner earnings' — the money that could theoretically be distributed to shareholders. Unlike net income, FCF is very difficult to fabricate.",
    formula: "FCF = Operating Cash Flow − Capital Expenditures",
    tip: "If a company reports high net income but consistently negative FCF, dig into why. Aggressive revenue recognition, working capital problems, or excessive capex can all mask a business that's burning cash while showing 'profit.'"
  },
  "Debt / Equity": {
    title: "Debt-to-Equity Ratio",
    body: "Total long-term debt divided by shareholders' equity. Measures financial leverage — how much borrowed money the company uses relative to owners' capital. Higher D/E amplifies both returns and risk. A company with more debt than equity is considered highly leveraged.",
    formula: "D/E = Long-Term Debt ÷ Shareholders' Equity",
    tip: "Buffett's preference: companies that could pay off all debt within a few years of earnings. Excessive debt is dangerous because it removes the margin of safety when business conditions deteriorate."
  },
  "Current Ratio": {
    title: "Current Ratio",
    body: "Current assets divided by current liabilities. Measures short-term liquidity — can the company cover its obligations due within the next 12 months? A ratio above 1.5 is comfortable. Below 1.0 means current liabilities exceed current assets — a potential solvency red flag.",
    formula: "Current Ratio = Current Assets ÷ Current Liabilities",
    tip: "A very low current ratio can indicate liquidity stress. But some businesses (like subscription companies with deferred revenue) naturally run low current ratios without risk. Context matters."
  },
  "Enterprise Value": {
    title: "Enterprise Value (EV)",
    body: "The theoretical total acquisition price of a company — market cap plus total debt minus cash. EV represents what a buyer would actually pay, because they inherit the debt and receive the cash. Used as the numerator in EV-based valuation multiples like EV/EBITDA.",
    formula: "EV = Market Cap + Total Debt − Cash & Equivalents",
    tip: "EV is the correct denominator when comparing companies with different capital structures. A cash-rich company at a high market cap may actually be cheap on an EV basis."
  },
  "EBITDA": {
    title: "EBITDA",
    body: "Earnings Before Interest, Taxes, Depreciation, and Amortization. A rough proxy for operating cash flow that strips out non-cash charges and financing costs. Widely used in valuation multiples and debt covenants because it enables comparison across companies with different capital structures and tax situations.",
    formula: "EBITDA = Operating Income + Depreciation & Amortization",
    tip: "Munger famously called EBITDA 'earnings before all the bad stuff.' It ignores capex (a real cash cost) and taxes (a real cash obligation). Always look at FCF alongside EBITDA for a complete picture."
  }
};

const TERM_LOCATIONS = {
  // Overview
  'S&P 500':          { card: 'S&P 500 card',          chart: 'Chart 1 — SPX tab' },
  'NASDAQ':           { card: 'NASDAQ card',            chart: 'Chart 1 — NDX tab' },
  'Dow Jones':        { card: 'Dow Jones card',         chart: 'Chart 1 — DOW tab' },
  'VIX':              { card: 'VIX card',               chart: 'Chart 1 — VIX tab' },
  '3-Mo T-Bill':      { card: 'Rates & Macro section',  chart: 'Chart 2 — 3-MO tab' },
  '10-Yr Treasury':   { card: 'Rates & Macro section',  chart: 'Chart 2 — 10-YR tab' },
  '30-Yr Treasury':   { card: 'Rates & Macro section',  chart: 'Chart 2 — 30-YR tab' },
  'USD Index':        { card: 'Rates & Macro section',  chart: 'Chart 2 — DXY tab' },
  'CPI':              { card: 'CPI card',               chart: null },
  'Fed Funds Rate':   { card: 'Fed Funds Rate card',    chart: null },
  'FOMC':             { card: 'Next FOMC Meeting card', chart: null },
  'Gold Futures':     { card: 'Commodities section',    chart: 'Chart 3 — GOLD tab' },
  'Brent Crude':      { card: 'Commodities section',    chart: 'Chart 3 — OIL tab' },
  'Bitcoin':          { card: 'Digital Assets section', chart: 'Chart 3 — BTC tab' },
  'Ethereum':         { card: 'Digital Assets section', chart: 'Chart 3 — ETH tab' },
  // Equity — Price & Market
  'Market Cap':       { card: 'Equity → Price & Market', chart: null },
  'Shares Outstanding': { card: 'Equity → Price & Market', chart: null },
  'Volume':           { card: 'Equity → Price & Market', chart: null },
  'Avg Vol (3M)':     { card: 'Equity → Price & Market', chart: null },
  '52W High':         { card: 'Equity → Price & Market', chart: null },
  '52W Low':          { card: 'Equity → Price & Market', chart: null },
  'Div Yield':        { card: 'Equity → Price & Market', chart: null },
  'Beta':             { card: 'Equity → Price & Market', chart: null },
  // Equity — Valuation
  'EPS (TTM)':        { card: 'Equity → Financial Health', chart: null },
  'P/E (TTM)':        { card: 'Equity → Valuation',     chart: null },
  'Fwd P/E':          { card: 'Equity → Valuation',     chart: null },
  'P/S':              { card: 'Equity → Valuation',     chart: null },
  'P/B':              { card: 'Equity → Valuation',     chart: null },
  'P/FCF':            { card: 'Equity → Valuation',     chart: null },
  'EV/EBITDA':        { card: 'Equity → Valuation',     chart: null },
  'Enterprise Value': { card: 'Equity → Valuation',     chart: null },
  'EBITDA':           { card: 'Equity → Valuation',     chart: null },
  // Equity — Profitability
  'Revenue (TTM)':    { card: 'Equity → Profitability', chart: null },
  'Gross Margin':     { card: 'Equity → Profitability', chart: null },
  'Op Margin':        { card: 'Equity → Profitability', chart: null },
  'Net Margin':       { card: 'Equity → Profitability', chart: null },
  'ROE':              { card: 'Equity → Profitability', chart: null },
  'ROA':              { card: 'Equity → Profitability', chart: null },
  // Equity — Financial Health
  'Free Cash Flow':   { card: 'Equity → Financial Health', chart: null },
  'Debt / Equity':    { card: 'Equity → Financial Health', chart: null },
  'Current Ratio':    { card: 'Equity → Financial Health', chart: null },
};

let dictRendered = false;

export function renderDictionary() {
  if (dictRendered) return;
  dictRendered = true;
  const list = document.getElementById('dictList');
  list.innerHTML = '';
  Object.keys(DEFINITIONS).forEach(function(key) {
    const def = DEFINITIONS[key];
    const loc = TERM_LOCATIONS[key] || {};
    const item = document.createElement('div');
    item.className = 'dict-item';
    item.dataset.key = key;
    item.dataset.search = (def.title + ' ' + def.body).toLowerCase();

    const header = document.createElement('div');
    header.className = 'dict-item-header';
    const term = document.createElement('span');
    term.className = 'dict-item-term';
    term.textContent = def.title;
    header.appendChild(term);
    if (loc.card) {
      const tag = document.createElement('span');
      tag.className = 'dict-item-tag';
      tag.textContent = loc.card;
      header.appendChild(tag);
    }
    item.appendChild(header);

    const body = document.createElement('div');
    body.className = 'dict-item-body';
    body.textContent = def.body;
    item.appendChild(body);

    if (def.formula) {
      const form = document.createElement('div');
      form.className = 'dict-item-formula';
      form.textContent = def.formula;
      item.appendChild(form);
    }

    if (loc.chart) {
      const chartLoc = document.createElement('div');
      chartLoc.className = 'dict-item-chartloc';
      chartLoc.textContent = '■ ' + loc.chart;
      item.appendChild(chartLoc);
    }

    if (def.tip) {
      const expandBtn = document.createElement('div');
      expandBtn.className = 'dict-item-expand';
      expandBtn.textContent = '\u25B8 Value Investor Take';
      item.appendChild(expandBtn);
      const tipEl = document.createElement('div');
      tipEl.className = 'dict-item-tip';
      const tipLabel = document.createElement('span');
      tipLabel.className = 'dict-item-tip-label';
      tipLabel.textContent = 'Value Investor Take';
      tipEl.appendChild(tipLabel);
      tipEl.appendChild(document.createTextNode(def.tip));
      item.appendChild(tipEl);
    }

    item.addEventListener('click', function() { item.classList.toggle('expanded'); });
    list.appendChild(item);
  });
}

export function filterDictionary(query) {
  renderDictionary();
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.dict-item').forEach(item => {
    item.style.display = (!q || item.dataset.search.includes(q)) ? '' : 'none';
  });
}

export function toggleDictionary(key) {
  const panel = document.getElementById('dictPanel');
  const overlay = document.getElementById('dictOverlay');
  const isOpen = panel.classList.contains('open');
  if (isOpen && !key) {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    panel.classList.add('open');
    overlay.classList.add('open');
    renderDictionary();
    if (key) {
      setTimeout(() => {
        const el = document.querySelector('[data-key="' + key + '"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('expanded'); }
      }, 320);
    }
  }
}

export function openDictionary(key) { toggleDictionary(key); }
