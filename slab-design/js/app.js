/**
 * IBS Slab Design App — Application Controller
 * Integrated Building Services | www.ibuildings.in
 */

const App = (() => {
  // ── App State ──────────────────────────────────────────────────────────────
  let state = {
    step: 1,           // 1=Config, 2=Slabs, 3=Loads, 4=Review, 5=Results
    config: {
      fck: 25, fy: 415, cover: 25, finishLoad: 100,
      delta_ratio: 350, delta_max: 20, min_thickness: 120, Lf: 1.5
    },
    slabs: [],         // array of slab objects
    activeSlab: null,  // index
    results: [],       // design results
  };

  // ── DOM Helpers ────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  // ── Step Navigation ────────────────────────────────────────────────────────
  function gotoStep(n) {
    state.step = n;
    document.querySelectorAll('.step-panel').forEach((p, i) => {
      p.classList.toggle('active', i + 1 === n);
    });
    document.querySelectorAll('.step-item').forEach((s, i) => {
      s.classList.toggle('done', i + 1 < n);
      s.classList.toggle('current', i + 1 === n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Step 1: Global Config ──────────────────────────────────────────────────
  function initStep1() {
    $('fck-select').value  = state.config.fck;
    $('fy-select').value   = state.config.fy;
    $('cover-select').value= state.config.cover;
    $('finish-load').value = state.config.finishLoad;

    $('btn-step1-next').addEventListener('click', () => {
      state.config.fck           = +$('fck-select').value;
      state.config.fy            = +$('fy-select').value;
      state.config.cover         = +$('cover-select').value;
      state.config.finishLoad    = +$('finish-load').value || 100;
      state.config.delta_ratio   = +$('delta-ratio').value || 350;
      state.config.delta_max     = +$('delta-max').value   || 20;
      state.config.min_thickness = +$('min-thick').value   || 120;
      state.config.Lf            = +$('load-factor').value || 1.5;
      gotoStep(2);
    });
  }

  // ── Step 2: Slab Entry ─────────────────────────────────────────────────────
  function initStep2() {
    renderSlabList();

    $('btn-add-slab').addEventListener('click', () => {
      state.slabs.push({
        id: Date.now(),
        label: `Slab ${state.slabs.length + 1}`,
        Lx: '', Ly: '',
        buildingType: 'residential',
        spaceType: 'bedroom',
        ll: 2.0,
        hasSunk: false, sunkThick: 0, sunkMaterial: 'sand',
        hasWP:   false, wpThick:   0, wpMaterial:   'waterproof_comp',
        hasCobba:false, cobbaThick:0, cobbaMaterial:'cobba_brick',
        extraLoads: [],
      });
      renderSlabList();
      state.activeSlab = state.slabs.length - 1;
      openSlabEditor(state.activeSlab);
    });

    $('btn-step2-back').addEventListener('click', () => gotoStep(1));
    $('btn-step2-next').addEventListener('click', () => {
      if (state.slabs.length === 0) {
        showToast('Add at least one slab to continue.', 'warn');
        return;
      }
      const invalid = state.slabs.filter(s => !s.Lx || !s.Ly);
      if (invalid.length) {
        showToast('All slabs must have Lx and Ly defined.', 'warn');
        return;
      }
      buildLoadReview();
      gotoStep(3);
    });
  }

  function renderSlabList() {
    const list = $('slab-list');
    list.innerHTML = '';
    if (state.slabs.length === 0) {
      list.innerHTML = '<div class="empty-state"><span>📐</span><p>No slabs added yet. Click "+ Add Slab" to begin.</p></div>';
      return;
    }
    state.slabs.forEach((s, i) => {
      const card = el('div', 'slab-card');
      const typInfo = IS875_LOADS[s.buildingType];
      const spaceInfo = typInfo?.subtypes[s.spaceType];
      card.innerHTML = `
        <div class="slab-card-header">
          <span class="slab-tag">${typInfo?.icon || '📐'} ${s.label}</span>
          <div class="slab-actions">
            <button class="btn-icon btn-edit" onclick="App.openSlabEditor(${i})">✏️ Edit</button>
            <button class="btn-icon btn-del"  onclick="App.deleteSlab(${i})">🗑️</button>
          </div>
        </div>
        <div class="slab-card-body">
          <div class="slab-meta"><span>Lx</span><strong>${s.Lx || '—'} m</strong></div>
          <div class="slab-meta"><span>Ly</span><strong>${s.Ly || '—'} m</strong></div>
          <div class="slab-meta"><span>Space</span><strong>${spaceInfo?.label || '—'}</strong></div>
          <div class="slab-meta"><span>LL</span><strong>${s.ll} kN/m²</strong></div>
          ${s.hasSunk  ? `<div class="slab-badge sunk">Sunk</div>` : ''}
          ${s.hasWP    ? `<div class="slab-badge wp">Waterproofing</div>` : ''}
          ${s.hasCobba ? `<div class="slab-badge cobba">Cobba</div>` : ''}
        </div>`;
      list.appendChild(card);
    });
  }

  window.App = window.App || {};
  window.App.openSlabEditor = openSlabEditor;
  window.App.deleteSlab     = deleteSlab;

  function deleteSlab(i) {
    if (!confirm('Delete this slab?')) return;
    state.slabs.splice(i, 1);
    renderSlabList();
  }

  function openSlabEditor(i) {
    state.activeSlab = i;
    const s = state.slabs[i];
    const modal = $('slab-modal');
    modal.classList.add('open');

    // Populate form
    $('slab-label').value   = s.label;
    $('slab-lx').value      = s.Lx;
    $('slab-ly').value      = s.Ly;
    $('building-type').value= s.buildingType;
    updateSpaceTypeOptions(s.buildingType, s.spaceType);

    // Filling loads
    $('has-sunk').checked    = s.hasSunk;
    $('sunk-thick').value    = s.sunkThick;
    $('sunk-material').value = s.sunkMaterial;
    toggleSection('sunk-details', s.hasSunk);

    $('has-wp').checked    = s.hasWP;
    $('wp-thick').value    = s.wpThick;
    $('wp-material').value = s.wpMaterial;
    toggleSection('wp-details', s.hasWP);

    $('has-cobba').checked      = s.hasCobba;
    $('cobba-thick').value      = s.cobbaThick;
    $('cobba-material').value   = s.cobbaMaterial;
    toggleSection('cobba-details', s.hasCobba);
  }

  function updateSpaceTypeOptions(buildingType, selectedSpace) {
    const sel = $('space-type');
    sel.innerHTML = '';
    const subtypes = IS875_LOADS[buildingType]?.subtypes || {};
    Object.entries(subtypes).forEach(([key, val]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${val.label} — ${val.ll} kN/m²`;
      if (key === selectedSpace) opt.selected = true;
      sel.appendChild(opt);
    });
    updateLLDisplay(buildingType, sel.value);
  }

  function updateLLDisplay(buildingType, spaceKey) {
    const ll = IS875_LOADS[buildingType]?.subtypes[spaceKey]?.ll || 0;
    $('ll-display').textContent = `${ll} kN/m² (IS 875 Part 2)`;
    return ll;
  }

  function toggleSection(id, show) {
    $(id).style.display = show ? 'grid' : 'none';
  }

  function initModalListeners() {
    $('building-type').addEventListener('change', e => {
      updateSpaceTypeOptions(e.target.value, '');
    });
    $('space-type').addEventListener('change', e => {
      updateLLDisplay($('building-type').value, e.target.value);
    });
    ['sunk','wp','cobba'].forEach(type => {
      $(`has-${type}`).addEventListener('change', e => {
        toggleSection(`${type}-details`, e.target.checked);
      });
    });

    $('btn-save-slab').addEventListener('click', saveSlab);
    $('btn-cancel-slab').addEventListener('click', () => {
      $('slab-modal').classList.remove('open');
    });
    $('modal-overlay').addEventListener('click', () => {
      $('slab-modal').classList.remove('open');
    });
  }

  function saveSlab() {
    const i = state.activeSlab;
    const s = state.slabs[i];
    const bt = $('building-type').value;
    const st = $('space-type').value;

    s.label         = $('slab-label').value || `Slab ${i+1}`;
    s.Lx            = +$('slab-lx').value;
    s.Ly            = +$('slab-ly').value;
    s.buildingType  = bt;
    s.spaceType     = st;
    s.ll            = IS875_LOADS[bt]?.subtypes[st]?.ll || 2.0;

    s.hasSunk       = $('has-sunk').checked;
    s.sunkThick     = +$('sunk-thick').value;
    s.sunkMaterial  = $('sunk-material').value;

    s.hasWP         = $('has-wp').checked;
    s.wpThick       = +$('wp-thick').value;
    s.wpMaterial    = $('wp-material').value;

    s.hasCobba      = $('has-cobba').checked;
    s.cobbaThick    = +$('cobba-thick').value;
    s.cobbaMaterial = $('cobba-material').value;

    if (!s.Lx || !s.Ly) {
      showToast('Please enter valid Lx and Ly values.', 'warn');
      return;
    }

    // Compute extra loads from filling
    s.extraLoads = [];
    if (s.hasSunk && s.sunkThick > 0) {
      const density = MATERIAL_DENSITIES[s.sunkMaterial]?.density || 1800;
      s.extraLoads.push({ name: `Sunk Fill (${MATERIAL_DENSITIES[s.sunkMaterial]?.label})`, load: (s.sunkThick/1000)*density });
    }
    if (s.hasWP && s.wpThick > 0) {
      const density = MATERIAL_DENSITIES[s.wpMaterial]?.density || 2000;
      s.extraLoads.push({ name: `Waterproofing (${MATERIAL_DENSITIES[s.wpMaterial]?.label})`, load: (s.wpThick/1000)*density });
    }
    if (s.hasCobba && s.cobbaThick > 0) {
      const density = MATERIAL_DENSITIES[s.cobbaMaterial]?.density || 1700;
      s.extraLoads.push({ name: `Cobba (${MATERIAL_DENSITIES[s.cobbaMaterial]?.label})`, load: (s.cobbaThick/1000)*density });
    }

    $('slab-modal').classList.remove('open');
    renderSlabList();
    showToast(`${s.label} saved successfully.`, 'success');
  }

  // ── Step 3: Load Review ────────────────────────────────────────────────────
  function buildLoadReview() {
    const container = $('load-review-container');
    container.innerHTML = '';

    state.slabs.forEach((s, i) => {
      const typInfo   = IS875_LOADS[s.buildingType];
      const spaceInfo = typInfo?.subtypes[s.spaceType];
      const totalExtra = s.extraLoads.reduce((sum, x) => sum + x.load, 0);
      const approxSW   = 150; // rough self weight
      const totalEst   = s.ll * 101.97 + state.config.finishLoad + totalExtra + approxSW;

      const card = el('div', 'review-card');
      card.innerHTML = `
        <div class="review-card-header">
          <h3>${typInfo?.icon} ${s.label}</h3>
          <span class="slab-type-badge">${(s.Ly/s.Lx) > 2 ? 'One-Way' : 'Two-Way'} Slab</span>
        </div>
        <div class="review-grid">
          <div class="review-row"><span>Span Lx × Ly</span><strong>${s.Lx}m × ${s.Ly}m</strong></div>
          <div class="review-row"><span>Space Type</span><strong>${spaceInfo?.label}</strong></div>
          <div class="review-row highlight"><span>Live Load (IS 875)</span><strong>${s.ll} kN/m²</strong></div>
          <div class="review-row"><span>Finishing Load</span><strong>${state.config.finishLoad} kg/m²</strong></div>
          ${s.extraLoads.map(x => `
            <div class="review-row extra"><span>↳ ${x.name}</span><strong>${x.load.toFixed(0)} kg/m²</strong></div>
          `).join('')}
          <div class="review-row total"><span>Estimated Total Load</span><strong>≈ ${totalEst.toFixed(0)} kg/m²</strong></div>
        </div>
        <div class="review-actions">
          <label class="approval-check">
            <input type="checkbox" id="approve-${i}" class="approve-cb" data-idx="${i}">
            <span>I approve the load parameters for ${s.label}</span>
          </label>
        </div>`;
      container.appendChild(card);
    });

    $('btn-step3-back').addEventListener('click', () => gotoStep(2));
    $('btn-step3-design').addEventListener('click', () => {
      const cbs = document.querySelectorAll('.approve-cb');
      const allApproved = [...cbs].every(cb => cb.checked);
      if (!allApproved) {
        showToast('Please approve all slab load parameters before proceeding.', 'warn');
        return;
      }
      runDesign();
      gotoStep(4);
    });
  }

  // ── Step 4: Processing ─────────────────────────────────────────────────────
  function runDesign() {
    const engine = new SlabDesignEngine({
      fck: state.config.fck,
      fy:  state.config.fy,
      cover: state.config.cover,
      Lf: state.config.Lf,
      delta_ratio: state.config.delta_ratio,
      delta_max:   state.config.delta_max,
      min_thickness: state.config.min_thickness,
    });

    state.results = [];

    // Animate progress bar
    const bar = $('progress-bar');
    let pct = 0;
    const interval = setInterval(() => {
      pct = Math.min(pct + (100 / state.slabs.length / 10), 95);
      bar.style.width = pct + '%';
    }, 80);

    setTimeout(() => {
      state.slabs.forEach(s => {
        try {
          const result = engine.design({
            Lx: s.Lx, Ly: s.Ly,
            ll: s.ll * 101.97,   // kN/m² → kg/m²
            finishL: state.config.finishLoad,
            extraLoads: s.extraLoads,
            label: s.label,
          });
          result.buildingType = s.buildingType;
          result.spaceType    = s.spaceType;
          state.results.push({ ...result, status: 'ok' });
        } catch(e) {
          state.results.push({ label: s.label, status: 'error', error: e.message });
        }
      });

      clearInterval(interval);
      bar.style.width = '100%';

      setTimeout(() => {
        renderResults();
        gotoStep(5);
      }, 400);
    }, state.slabs.length * 200 + 600);
  }

  // ── Step 5: Results ────────────────────────────────────────────────────────
  function renderResults() {
    const container = $('results-container');
    container.innerHTML = '';

    state.results.forEach((r, i) => {
      if (r.status === 'error') {
        const card = el('div', 'result-card error-card');
        card.innerHTML = `<h3>❌ ${r.label}</h3><p>${r.error}</p>`;
        container.appendChild(card);
        return;
      }

      const shearStatus = r.shear.pass ? '✅ PASS' : '⚠️ FAIL';
      const typInfo     = IS875_LOADS[r.buildingType];

      const card = el('div', 'result-card');
      card.innerHTML = `
        <div class="result-header">
          <div class="result-title">
            <span class="result-icon">${typInfo?.icon || '📐'}</span>
            <div>
              <h3>${r.label}</h3>
              <span class="result-subtitle">${r.slabType} | Ly/Lx = ${r.lyLxRatio}</span>
            </div>
          </div>
          <div class="result-badge ${r.shear.pass ? 'pass':'fail'}">${shearStatus}</div>
        </div>

        <div class="result-sections">
          <div class="result-section">
            <h4>🔢 Loading</h4>
            <div class="result-row"><span>Total Load</span><strong>${r.totalLoad} kg/m²</strong></div>
            <div class="result-row"><span>LL (IS 875)</span><strong>${r.ll.toFixed(0)} kg/m²</strong></div>
          </div>
          <div class="result-section">
            <h4>📏 Geometry</h4>
            <div class="result-row"><span>Thickness (D)</span><strong>${r.thickness} mm</strong></div>
            <div class="result-row"><span>Effective Depth (d)</span><strong>${r.d_eff.toFixed(1)} mm</strong></div>
          </div>
          <div class="result-section">
            <h4>⚡ Moments</h4>
            <div class="result-row"><span>Mx</span><strong>${r.Mx} t·m</strong></div>
            <div class="result-row"><span>My</span><strong>${r.My} t·m</strong></div>
          </div>
          <div class="result-section">
            <h4>🔩 Reinforcement</h4>
            <div class="result-row"><span>Ast,x (req.)</span><strong>${r.Astx} mm²/m</strong></div>
            <div class="result-row"><span>Ast,y (req.)</span><strong>${r.Asty} mm²/m</strong></div>
            <div class="result-row highlight-bar"><span>Bars (x-dir)</span><strong>Ø${r.barX.dia} @ ${r.barX.spacing} mm c/c</strong></div>
            <div class="result-row highlight-bar"><span>Bars (y-dir)</span><strong>Ø${r.barY.dia} @ ${r.barY.spacing} mm c/c</strong></div>
          </div>
          <div class="result-section">
            <h4>✂️ Shear Check</h4>
            <div class="result-row"><span>τv (actual)</span><strong>${r.shear.τv} MPa</strong></div>
            <div class="result-row"><span>τc (permissible)</span><strong>${r.shear.τc} MPa</strong></div>
            <div class="result-row"><span>Status</span><strong>${shearStatus}</strong></div>
          </div>
        </div>`;
      container.appendChild(card);
    });

    // Summary stats
    const passed = state.results.filter(r => r.status === 'ok' && r.shear.pass).length;
    $('summary-bar').innerHTML = `
      <span>✅ ${passed} / ${state.results.length} designs passed</span>
      <span>fck = ${state.config.fck} MPa | fy = ${state.config.fy} MPa | Cover = ${state.config.cover} mm</span>`;

    // Export button
    $('btn-export').addEventListener('click', exportReport);
  }

  // ── Export Report ──────────────────────────────────────────────────────────
  function exportReport() {
    let csv = 'Slab,Lx(m),Ly(m),Type,Live Load(kN/m²),Total Load(kg/m²),Thickness(mm),Mx(t.m),My(t.m),Ast-x(mm²/m),Ast-y(mm²/m),Bar-X,Bar-Y,Shear\n';
    state.results.forEach((r, i) => {
      if (r.status !== 'ok') return;
      const s = state.slabs[i];
      csv += `"${r.label}",${r.Lx},${r.Ly},"${r.slabType}",${s.ll},${r.totalLoad},${r.thickness},${r.Mx},${r.My},${r.Astx},${r.Asty},"Ø${r.barX.dia}@${r.barX.spacing}mm","Ø${r.barY.dia}@${r.barY.spacing}mm","${r.shear.pass?'PASS':'FAIL'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `IBS_Slab_Design_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('Report exported as CSV.', 'success');
  }

  // ── Toast Notifications ────────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    const t = el('div', `toast toast-${type}`, msg);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    populateMaterialOptions();
    initStep1();
    initStep2();
    initModalListeners();
    gotoStep(1);
  }

  function populateMaterialOptions() {
    const targets = ['sunk-material', 'wp-material', 'cobba-material'];
    targets.forEach(id => {
      const sel = $(id);
      if (!sel) return;
      Object.entries(MATERIAL_DENSITIES).forEach(([key, val]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${val.label} (${val.density} kg/m³)`;
        sel.appendChild(opt);
      });
    });

    // Set sensible defaults
    $('wp-material').value    = 'waterproof_comp';
    $('cobba-material').value = 'cobba_brick';
  }

  return { init, openSlabEditor, deleteSlab };
})();

document.addEventListener('DOMContentLoaded', App.init);
