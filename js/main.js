import { setGreeting, fetchAll, loadFedData, loadAllNews, updateClock } from './overview.js';
import { loadAllCharts, initCharts } from './charts.js';
import { initEquity, loadEquityStock, addWatchlistGroup, setEqChartType, renderWatchlist, deleteGroup, toggleGroup, addToGroup, removeFromGroup } from './equity.js';
import { toggleDictionary, filterDictionary } from './dict.js';

// ── Tab Navigation ──
export function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  event.target.classList.add('active');
  document.body.style.overflow = tab === 'equity' ? 'hidden' : '';
  if (tab === 'equity') renderWatchlist();

  // Dictionary is overview-only: hide FAB and close panel on other tabs
  const fab = document.getElementById('dictFab');
  if (fab) fab.style.display = tab === 'overview' ? '' : 'none';
  if (tab !== 'overview') {
    const panel = document.getElementById('dictPanel');
    const overlay = document.getElementById('dictOverlay');
    if (panel?.classList.contains('open')) {
      panel.classList.remove('open');
      overlay?.classList.remove('open');
    }
  }
}

// ── Expose globals for inline HTML handlers ──
window.switchTab        = switchTab;
window.fetchAll         = fetchAll;
window.loadEquityStock  = loadEquityStock;
window.addWatchlistGroup = addWatchlistGroup;
window.setEqChartType   = setEqChartType;
window.toggleDictionary = toggleDictionary;
window.filterDictionary = filterDictionary;
// Watchlist group handlers (used in dynamically generated HTML)
window.deleteGroup      = deleteGroup;
window.toggleGroup      = toggleGroup;
window.addToGroup       = addToGroup;
window.removeFromGroup  = removeFromGroup;

// ── Clock ──
setInterval(updateClock, 1000);
updateClock();

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  initEquity();
});

// ── Init ──
setGreeting();
fetchAll();
loadAllCharts();
loadFedData();
loadAllNews();

setInterval(fetchAll, 60000);
setInterval(loadAllCharts, 300000);
setInterval(loadAllNews, 600000);
