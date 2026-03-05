import { fetchChartData } from './api.js';

export const chartInstances = {};
export const chartRawPoints = {};
export const chartState = {
  1: { symbol: '%5EGSPC', label: 'S&P 500' },
  2: { symbol: '%5EIRX',  label: '3-Mo T-Bill' },
  3: { symbol: 'GC%3DF',  label: 'Gold Futures' },
};
export let currentRange = '1y', currentInterval = '1d';

export function setPctBadge(chartNum, pct) {
  const el = document.getElementById('chart' + chartNum + '-pct');
  if (!el) return;
  const up = pct >= 0;
  el.textContent = (up ? '+' : '') + pct.toFixed(2) + '%';
  el.className = 'chart-pct-badge ' + (up ? 'up' : 'down');
}

export function attachDragMeasure(canvasId, chartNum) {
  const canvas = document.getElementById(canvasId);
  const dragEl = document.getElementById('chart' + chartNum + '-drag-pct');
  if (!canvas || !dragEl) return;
  let isDragging = false, dragStartX = null;
  canvas.addEventListener('mousedown', e => { isDragging = true; dragStartX = e.offsetX; dragEl.classList.remove('visible'); });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging || dragStartX === null) return;
    const chart = chartInstances[canvasId]; if (!chart) return;
    const points = chartRawPoints[canvasId]; if (!points || !points.length) return;
    const step = Math.max(1, Math.floor(points.length / 80));
    const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    const area = chart.chartArea; if (!area) return;
    const tw = area.right - area.left;
    const s = Math.max(0, Math.min(1, (Math.min(dragStartX, e.offsetX) - area.left) / tw));
    const en = Math.max(0, Math.min(1, (Math.max(dragStartX, e.offsetX) - area.left) / tw));
    const si = Math.floor(s * (sampled.length - 1));
    const ei = Math.min(sampled.length - 1, Math.floor(en * (sampled.length - 1)));
    if (ei <= si) return;
    const pct = ((sampled[ei].y - sampled[si].y) / sampled[si].y) * 100;
    const up = pct >= 0;
    dragEl.textContent = (up ? '+' : '') + pct.toFixed(2) + '%  •  ' + sampled[si].x + ' → ' + sampled[ei].x;
    dragEl.className = 'chart-drag-pct visible ' + (up ? 'up' : 'down');
  });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; setTimeout(() => dragEl.classList.remove('visible'), 1800); });
}

export function renderChart(canvasId, points, label, livePrice, prevClose) {
  const chartNum = canvasId.replace('chart', '');
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); delete chartInstances[canvasId]; }
  chartRawPoints[canvasId] = points;
  const canvas = document.getElementById(canvasId);

  function getCanvasX(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
  }
  canvas.addEventListener('mousedown', e => {
    const chart = chartInstances[canvasId];
    if (!chart) return;
    chart._dragStart = getCanvasX(e, canvas); chart._dragEnd = null; chart._dragging = true;
  });
  canvas.addEventListener('mousemove', e => {
    const chart = chartInstances[canvasId];
    if (!chart) return;
    chart._hoverX = getCanvasX(e, canvas);
    if (chart._dragging) chart._dragEnd = getCanvasX(e, canvas);
    chart.draw();
  });
  canvas.addEventListener('mouseup', () => {
    const chart = chartInstances[canvasId];
    if (chart) chart._dragging = false;
  });
  canvas.addEventListener('mouseleave', () => {
    const chart = chartInstances[canvasId];
    if (chart) { chart._hoverX = null; chart._dragStart = null; chart._dragEnd = null; chart._dragging = false; chart.draw(); }
    const tip = document.getElementById('drag-tooltip');
    if (tip) tip.style.display = 'none';
  });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const chart = chartInstances[canvasId];
    if (!chart) return;
    chart._dragStart = getCanvasX(e, canvas); chart._dragEnd = null; chart._dragging = true;
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const chart = chartInstances[canvasId];
    if (!chart) return;
    chart._hoverX = getCanvasX(e, canvas);
    if (chart._dragging) chart._dragEnd = getCanvasX(e, canvas);
    chart.draw();
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    const chart = chartInstances[canvasId];
    if (chart) { chart._dragging = false; }
    setTimeout(() => {
      const tip = document.getElementById('drag-tooltip');
      if (tip) tip.style.display = 'none';
    }, 1800);
  });

  const first = points[0].y, last = points[points.length - 1].y;
  const badgeFirst = prevClose || first;
  const badgeLast = livePrice || last;
  const totalPct = ((badgeLast - badgeFirst) / badgeFirst) * 100;
  const isUp = last >= first;
  const lineColor = isUp ? '#00d97e' : '#ff4d6a';
  const fillColor = isUp ? 'rgba(0,217,126,0.07)' : 'rgba(255,77,106,0.07)';
  const step = Math.max(1, Math.floor(points.length / 80));
  const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  setPctBadge(chartNum, totalPct);

  const crosshairPlugin = {
    id: 'crosshair_' + canvasId,
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

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    plugins: [crosshairPlugin],
    data: { labels: sampled.map(p => p.x), datasets: [
      { data: sampled.map(p => p.y), borderColor: lineColor, borderWidth: 1.5, backgroundColor: fillColor, fill: true, tension: 0.2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: lineColor }
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false, backgroundColor: '#1a1a1f', borderColor: '#2a2a30', borderWidth: 1, titleColor: '#6b6b7a', bodyColor: '#e8e8ed', titleFont: { family: "'IBM Plex Mono', monospace", size: 10 }, bodyFont: { family: "'IBM Plex Mono', monospace", size: 11, weight: '600' }, padding: 10, callbacks: { label: item => ' ' + item.raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } }
      },
      scales: {
        x: { ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 8, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.03)' }, border: { color: '#1e1e22' } },
        y: { position: 'right', ticks: { color: '#6b6b7a', font: { family: "'IBM Plex Mono', monospace", size: 9 }, maxTicksLimit: 5, callback: v => v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { color: '#1e1e22' } }
      }
    }
  });
  attachDragMeasure(canvasId, chartNum);
}

export async function loadChart(chartNum, range, interval) {
  const state = chartState[chartNum];
  const canvasId = 'chart' + chartNum;
  const loadingEl = document.getElementById(canvasId + '-loading');
  loadingEl.classList.remove('hidden'); loadingEl.textContent = 'Loading chart...';
  try {
    const result = await fetchChartData(state.symbol, range, interval);
    const points = result.points;
    if (points.length === 0) throw new Error('No data');
    loadingEl.classList.add('hidden');
    renderChart(canvasId, points, state.label, result.livePrice, result.prevClose);
  } catch(e) { loadingEl.textContent = 'Chart unavailable'; }
}

export function loadAllCharts(range, interval) {
  range = range || currentRange; interval = interval || currentInterval;
  loadChart(1, range, interval); loadChart(2, range, interval); loadChart(3, range, interval);
}

export function initCharts() {
  // Chart instrument tabs
  document.querySelectorAll('.chart-tabs').forEach(tabGroup => {
    tabGroup.addEventListener('click', e => {
      const btn = e.target.closest('.chart-tab'); if (!btn) return;
      const chartNum = parseInt(tabGroup.dataset.chart);
      chartState[chartNum] = { symbol: btn.dataset.symbol, label: btn.dataset.label };
      document.getElementById('chart' + chartNum + '-title').textContent = btn.dataset.label;
      tabGroup.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      loadChart(chartNum, currentRange, currentInterval);
    });
  });

  // Overview range tabs (scoped to .range-tabs, not #eq-range-tabs)
  document.querySelectorAll('.range-tabs .range-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-tabs .range-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range; currentInterval = btn.dataset.interval;
      loadAllCharts(currentRange, currentInterval);
    });
  });
}
