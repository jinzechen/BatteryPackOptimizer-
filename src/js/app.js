import { optimize, WireDB, CellPresets } from './optimizer.js';
import { render2D } from './renderer2d.js';
import { initNative, takePhoto, savePref, loadPref, vibrate, exportFile, isNative } from './native.js';

let layout = null;
let view = '2d';
let threeLoaded = false;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const v = id => parseFloat((id).value) || 0;

function toast(msg, dur = 2500) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

function readParams() {
  return {
    compartment: { L: v('#comp-L'), W: v('#comp-W'), H: v('#comp-H'), shellT: v('#shell-t') },
    cell: { L: v('#cell-L'), W: v('#cell-W'), H: v('#cell-H'), ah: v('#cell-ah'), v: v('#cell-v') },
    bms: { L: v('#bms-L'), W: v('#bms-W'), H: v('#bms-H') },
    aux: { epoxyT: v('#epoxy-t'), tabT: v('#tab-t'), compositeT: v('#composite-t'), cellGap: v('#cell-gap') },
    wire: { gauge: $('#wire-gauge').value, exit: $('#wire-exit').value, count: parseInt($('#wire-count').value) || 2 },
    seriesCount: parseInt($('#series-count').value) || 16,
  };
}

function initPresets() {
  const sel = $('#cell-preset');
  CellPresets.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.m} (${p.L}×${p.W}×${p.H})`;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => {
    const p = CellPresets.find(c => c.id === sel.value);
    if (p && p.L > 0) {
      $('#cell-L').value = p.L; $('#cell-W').value = p.W; $('#cell-H').value = p.H;
      $('#cell-ah').value = p.ah; $('#cell-v').value = p.v;
    }
  });
}

function updateResults(r, p) {
  const b = r.best;
  const wInfo = WireDB[p.wire.gauge] || {};
  const totV = (p.seriesCount * p.cell.v).toFixed(1);
  const kwh = (totV * p.cell.ah / 1000).toFixed(2);

  $('#rLay').textContent = `${b.rows}×${b.cols}`;
  $('#rLayD').textContent = `${b.ori.label} | ${p.seriesCount}S`;

  const uc = b.util > 70 ? 'ok' : b.util > 40 ? 'warn' : 'fail';
  $('#rUtil').textContent = `${b.util.toFixed(1)}%`;
  $('#rUtil').className = `rv ${uc}`;
  $('#rUtilD').textContent = `整体${b.utilO.toFixed(1)}%`;

  $('#rWire').textContent = `${(b.wLen / 1000).toFixed(2)}m`;
  $('#rWireD').textContent = `${p.wire.gauge} | ø${wInfo.od || '?'}mm`;

  $('#rPack').textContent = `${totV}V`;
  $('#rPackD').textContent = `${p.cell.ah}Ah | ${kwh}kWh`;

  $('#rFit').textContent = b.fits ? '✓ 通过' : '✗ 超限';
  $('#rFit').className = `rv ${b.fits ? 'ok' : 'fail'}`;
  $('#rFitD').textContent = b.fits
    ? `${b.totL.toFixed(0)}×${b.totW.toFixed(0)}×${b.totH.toFixed(0)}mm`
    : '超出电池仓内部空间';

  $('#vizInfo').textContent = `${p.seriesCount}S | ${b.ori.L}×${b.ori.W}×${b.ori.H} | ${b.rows}×${b.cols}`;
}

function doOptimize() {
  const ld = $('#loading');
  ld.classList.add('show');

  requestAnimationFrame(() => setTimeout(() => {
    try {
      const p = readParams();
      if (p.cell.L <= 0 || p.cell.W <= 0) { toast('请输入有效电芯尺寸'); return; }
      if (p.seriesCount <= 0) { toast('请输入有效串联数'); return; }

      const r = optimize(p);
      if (r.error) { toast(r.error, 4000); return; }

      layout = r;
      updateResults(r, p);

      const c2d = $('#c2d');
      c2d.style.display = 'block';
      $('#c3d').classList.remove('show');
      $('#comparePanel').classList.remove('show');
      render2D(c2d, r, p);
      view = '2d';

      vibrate(30);
      toast(`优化完成: ${r.best.rows}行×${r.best.cols}列, 利用率${r.best.util.toFixed(1)}%`);
    } catch (e) {
      console.error(e);
      toast('计算出错: ' + e.message);
    } finally {
      ld.classList.remove('show');
    }
  }, 50));
}

function showSeries() {
  const p = readParams();
  const flow = $('#sFlow');
  let html = '';
  for (let i = 1; i <= p.seriesCount; i++) {
    if (i > 1) html += '<span class="sa">→</span>';
    html += `<div class="si">`;
    if (i === 1) html += `<span class="p">总正极</span><br>`;
    html += `S${i}`;
    if (i === p.seriesCount) html += `<br><span class="n">总负极</span>`;
    else html += `<br><small style="color:var(--t3)">${(p.cell.v * i).toFixed(1)}V</small>`;
    html += `</div>`;
  }
  flow.innerHTML = html;
  $('#modalSeries').classList.add('open');
}

async function doCompare() {
  toast('正在推算所有预设电芯...');
  setTimeout(async () => {
    const p = readParams();
    const results = [];
    CellPresets.forEach(preset => {
      if (preset.L <= 0) return;
      const tp = JSON.parse(JSON.stringify(p));
      tp.cell = { L: preset.L, W: preset.W, H: preset.H, ah: preset.ah, v: preset.v };
      const r = optimize(tp);
      if (!r.error) {
        results.push({
          model: preset.m, cell: tp.cell, best: r.best,
          v: (tp.seriesCount * tp.cell.v).toFixed(1),
          kwh: (tp.seriesCount * tp.cell.v * tp.cell.ah / 1000).toFixed(2),
          fits: r.best.fits,
          params: tp,
        });
      }
    });

    let html = `<table class="cmp-table"><thead><tr>
      <th>型号</th><th>尺寸</th><th>排布</th><th>利用率</th>
      <th>走线</th><th>电压</th><th>能量</th><th>校验</th></tr></thead><tbody>`;
    results.forEach(r => {
      html += `<tr onclick="window._viewCmp(${results.indexOf(r)})"><td><b>${r.model}</b></td>
        <td class="mono">${r.cell.L}×${r.cell.W}×${r.cell.H}</td>
        <td class="mono">${r.best.rows}×${r.best.cols}</td>
        <td class="mono">${r.best.util.toFixed(1)}%</td>
        <td class="mono">${(r.best.wLen/1000).toFixed(2)}m</td>
        <td class="mono">${r.v}V</td>
        <td class="mono">${r.kwh}kWh</td>
        <td><span class="badge ${r.fits?'badge-ok':'badge-no'}">${r.fits?'✓':'✗'}</span></td></tr>`;
    });
    html += '</tbody></table>';

    $('#comparePanel').innerHTML = html;
    $('#comparePanel').classList.add('show');
    $('#c2d').style.display = 'none';
    $('#c3d').classList.remove('show');
    $$$$('[data-view]').forEach(b => b.classList.remove('active'));
    $('[data-view="compare"]').classList.add('active');
    view = 'compare';

    window._viewCmp = idx => {
      const r = results[idx];
      $('#cell-L').value = r.cell.L; $('#cell-W').value = r.cell.W; $('#cell-H').value = r.cell.H;
      $('#cell-ah').value = r.cell.ah; $('#cell-v').value = r.cell.v;
      doOptimize();
      switchView('2d');
    };

    toast(`已完成 ${results.length} 款电芯推算`);
  }, 50);
}

async function doCamera() {
  const base64 = await takePhoto();
  if (!base64) { toast('拍照取消'); return; }
  // Show image in a prompt-like flow
  const text = prompt('请根据照片确认电芯型号或尺寸\n\n格式: "173.9×71.7×207.2" 或型号如 "LF280N"');
  if (!text) return;
  const dim = text.match(/([\d.]+)\s*[×xX\*]\s*([\d.]+)\s*[×xX\*]\s*([\d.]+)/);
  if (dim) {
    $('#cell-L').value = dim[1]; $('#cell-W').value = dim[2]; $('#cell-H').value = dim[3];
    toast(`已识别: ${dim[1]}×${dim[2]}×${dim[3]}mm`);
    return;
  }
  const found = CellPresets.find(p => text.toLowerCase().includes(p.m.toLowerCase()) || p.m.toLowerCase().includes(text.toLowerCase().trim()));
  if (found) {
    $('#cell-preset').value = found.id;
    $('#cell-preset').dispatchEvent(new Event('change'));
    toast(`匹配: ${found.m}`);
    return;
  }
  toast('未识别，请手动输入');
}

function switchView(vw) {
  view = vw;
  $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === vw));
  ('#c2d').style.display = vw === '2d' ? 'block' : 'none';
  $('#c3d').classList.toggle('show', vw === '3d');
  $('#comparePanel').classList.toggle('show', vw === 'compare');

  if (vw === '3d' && layout) {
    (async () => {
      if (!threeLoaded) {
        const { init3D, render3D, resize3D } = await import('./renderer3d.js');
        init3D($('#c3d'));
        window._render3D = render3D;
        window._resize3D = resize3D;
        threeLoaded = true;
        window.addEventListener('resize', () => resize3D());
      }
      window._render3D(layout, readParams());
    })();
  }
  if (vw === '2d' && layout) {
    render2D($('#c2d'), layout, readParams());
  }
}

async function doExport() {
  if (!layout) { toast('请先优化'); return; }
  await exportFile('battery_layout.json', { params: readParams(), result: layout });
  toast('已导出方案');
}

async function loadSaved() {
  const saved = await loadPref('lastParams');
  if (saved) {
    try {
      if (saved.compartment) { $('#comp-L').value = saved.compartment.L; $('#comp-W').value = saved.compartment.W; $('#comp-H').value = saved.compartment.H; $('#shell-t').value = saved.compartment.shellT; }
      if (saved.cell) { $('#cell-L').value = saved.cell.L; $('#cell-W').value = saved.cell.W; $('#cell-H').value = saved.cell.H; $('#cell-ah').value = saved.cell.ah; $('#cell-v').value = saved.cell.v; }
      if (saved.seriesCount) $('#series-count').value = saved.seriesCount;
    } catch {}
  }
}

function bindEvents() {
  // Calc buttons
  $('#btnCalc').onclick = doOptimize;
  $('#btnCalc2').onclick = doOptimize;

  // Menu toggle (mobile)
  const panel = $('#panel');
  $('#btnMenu').onclick = () => {
    panel.classList.toggle('open');
    let mask = document.querySelector('.panel-mask');
    if (!mask) { mask = document.createElement('div'); mask.className = 'panel-mask'; document.body.appendChild(mask); }
    mask.classList.toggle('show', panel.classList.contains('open'));
    mask.onclick = () => { panel.classList.remove('open'); mask.classList.remove('show'); };
  };

  // Param groups
  $$$$('.pg-hdr').forEach(h => h.onclick = () => h.parentElement.classList.toggle('shut'));

  // View tabs
  $$('[data-view]').forEach(b => b.onclick = () => switchView(b.dataset.view));

  // Other buttons
  ('#btnSeries').onclick = showSeries;
  $('#btnCompare').onclick = doCompare;
  $('#btnCam').onclick = doCamera;
  $('#btnExport').onclick = doExport;

  // Close modals
  $('#modalSeries').onclick = function(e) { if (e.target === this) this.classList.remove('open'); };

  // Resize
  window.addEventListener('resize', () => {
    if (view === '2d' && layout) render2D($('#c2d'), layout, readParams());
    if (threeLoaded && window._resize3D) window._resize3D();
  });

  // Auto-save params
  const saveTimer = { t: null };
  $$$$('.fr input, .fr select').forEach(el => {
    el.addEventListener('change', () => {
      clearTimeout(saveTimer.t);
      saveTimer.t = setTimeout(() => savePref('lastParams', readParams()), 1000);
    });
  });
}

export async function initApp() {
  await initNative();
  initPresets();
  await loadSaved();
  bindEvents();
}

// ========== AI Agent 集成 ==========
import { aiAgent } from './ai-agent.js';
import { aiUI } from './ai-ui.js';

// 初始化 AI
document.addEventListener('DOMContentLoaded', () => {
  aiUI.init();
});

// 拦截优化按钮，添加 AI 辅助
const originalRun = window.runOptimization;
if (typeof originalRun === 'function') {
  window.runOptimization = async function (...args) {
    const result = originalRun.apply(this, args);

    if (aiAgent.isConfigured() && aiAgent.config.autoOptimize) {
      try {
        aiUI.showLoading('AI is analyzing optimization results...');
        const aiResult = await aiAgent.optimizeWithAI(
          getOptimizationParams(),
          result
        );
        aiUI.showOptimizationResult(aiResult, getOptimizationParams(), result);
      } catch (e) {
        console.warn('AI optimization failed:', e);
      }
    }

    return result;
  };
}

function getOptimizationParams() {
  // 从页面表单获取当前参数
  const params = {};
  document.querySelectorAll('input, select').forEach(el => {
    if (el.name || el.id) {
      params[el.name || el.id] = el.value;
    }
  });
  return params;
}

// 全局暴露 AI 优化入口
window.runAIOptimization = async function () {
  if (!aiAgent.isConfigured()) {
    aiUI._togglePanel('settings');
    aiUI._toast('Please configure AI first', true);
    return;
  }

  try {
    aiUI.showLoading('AI is analyzing your battery pack design...');
    const params = getOptimizationParams();
    const currentResult = window.lastOptimizationResult || {};
    const aiResult = await aiAgent.optimizeWithAI(params, currentResult);
    aiUI.showOptimizationResult(aiResult, params, currentResult);
  } catch (e) {
    aiUI._toast(`AI Error: ${e.message}`, true);
  }
};
