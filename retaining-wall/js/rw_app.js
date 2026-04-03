/**
 * Retaining Wall App Controller
 * Integrated Building Services (IBS)
 */

const RWApp = (() => {
  let result = null;

  const $ = id => document.getElementById(id);

  // ── Populate dropdowns ─────────────────────────────────────────────────────
  function init() {
    // Soil types
    const soilSel = $('soil-type');
    Object.entries(RW_SOILS).forEach(([k, v]) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = `${v.label} (φ=${v.phi}°, γ=${v.gamma} kg/m³)`;
      soilSel.appendChild(o);
    });
    soilSel.value = 'medium_sand';
    updateSoilDisplay('medium_sand');

    // Surcharge
    const surSel = $('surcharge-type');
    Object.entries(RW_SURCHARGE).forEach(([k, v]) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = v.label;
      surSel.appendChild(o);
    });

    soilSel.addEventListener('change', e => updateSoilDisplay(e.target.value));
    surSel.addEventListener('change', e => {
      const custom = e.target.value === 'custom';
      $('custom-sur-box').style.display = custom ? 'block' : 'none';
    });

    $('btn-design').addEventListener('click', runDesign);
    $('btn-reset').addEventListener('click', () => location.reload());
    $('btn-export').addEventListener('click', exportResults);

    // Dim mode toggle
    $('use-auto-dims').addEventListener('change', e => {
      $('custom-dims-section').style.display = e.target.checked ? 'none' : 'grid';
    });
  }

  function updateSoilDisplay(key) {
    const s = RW_SOILS[key];
    if (!s) return;
    $('soil-phi').textContent   = `${s.phi}°`;
    $('soil-gamma').textContent = `${s.gamma} kg/m³`;
    $('soil-mu').textContent    = s.mu;
    $('soil-c').textContent     = `${s.c} kN/m²`;
  }

  // ── Run Design ─────────────────────────────────────────────────────────────
  function runDesign() {
    const soilKey = $('soil-type').value;
    const soil    = RW_SOILS[soilKey];
    const surKey  = $('surcharge-type').value;
    const surcharge = surKey === 'custom'
      ? +$('custom-sur-val').value
      : (RW_SURCHARGE[surKey]?.q || 0);

    const H   = +$('wall-height').value;
    const sbc = +$('sbc-value').value;
    const fck = +$('fck-rw').value;
    const fy  = +$('fy-rw').value;
    const cov = +$('cover-rw').value;

    if (!H || H < 1 || H > 12) { showToast('Enter wall height between 1–12 m', 'warn'); return; }
    if (!sbc || sbc < 50)       { showToast('Enter valid SBC (min 50 kN/m²)', 'warn'); return; }

    const engine = new RetainingWallEngine({
      fck, fy, cover: cov,
      gamma: soil.gamma,
      phi:   soil.phi,
      c:     soil.c,
      mu:    soil.mu,
      surcharge,
      H,
      sbc,
    });

    // Custom or auto dims
    let customDims = null;
    if (!$('use-auto-dims').checked) {
      customDims = {
        stem_top:   +$('dim-stem-top').value,
        stem_bot:   +$('dim-stem-bot').value,
        base_thick: +$('dim-base-thick').value,
        base_width: +$('dim-base-width').value,
        toe_length: +$('dim-toe').value,
      };
    }

    try {
      result = engine.design(customDims);
      renderResults(result, soil, soilKey, surcharge, H, fck, fy);
      $('results-section').style.display = 'block';
      $('results-section').scrollIntoView({ behavior: 'smooth' });
    } catch(e) {
      showToast('Design error: ' + e.message, 'warn');
      console.error(e);
    }
  }

  // ── Render Results ─────────────────────────────────────────────────────────
  function renderResults(r, soil, soilKey, q, H, fck, fy) {
    const { dims, stab, stem, heel, toe, overallPass } = r;

    $('result-overall').innerHTML = overallPass
      ? `<span class="verdict pass">✅ DESIGN ACCEPTABLE — All stability checks PASS</span>`
      : `<span class="verdict fail">⚠️ DESIGN REQUIRES REVISION — One or more checks FAIL</span>`;

    // ── Wall Dimensions ──
    $('res-dims').innerHTML = `
      <div class="res-row"><span>Wall Height (H)</span><strong>${H} m</strong></div>
      <div class="res-row"><span>Base Width (B)</span><strong>${dims.base_width.toFixed(2)} m</strong></div>
      <div class="res-row"><span>Base Thickness</span><strong>${dims.base_thick.toFixed(2)} m</strong></div>
      <div class="res-row"><span>Stem (top / bottom)</span><strong>${dims.stem_top.toFixed(2)} / ${dims.stem_bot.toFixed(2)} m</strong></div>
      <div class="res-row"><span>Toe Length</span><strong>${dims.toe_length.toFixed(2)} m</strong></div>
      <div class="res-row"><span>Heel Length</span><strong>${dims.heel_length.toFixed(2)} m</strong></div>`;

    // ── Earth Pressure ──
    const ep = stab.ep;
    $('res-ep').innerHTML = `
      <div class="res-row"><span>Rankine Ka</span><strong>${r.stab.ep ? (Math.pow(Math.tan(Math.PI/4 - soil.phi*Math.PI/360), 2)).toFixed(3) : '—'}</strong></div>
      <div class="res-row"><span>Active Pressure at base</span><strong>${ep.pa_bot.toFixed(2)} kN/m²</strong></div>
      <div class="res-row"><span>Horiz. Force (Ph)</span><strong>${ep.Ph_total.toFixed(2)} kN/m</strong></div>
      <div class="res-row"><span>Overturning Moment</span><strong>${ep.M_ot.toFixed(2)} kN·m/m</strong></div>
      <div class="res-row"><span>Resisting Moment</span><strong>${stab.MR.toFixed(2)} kN·m/m</strong></div>
      <div class="res-row"><span>Surcharge (q)</span><strong>${q} kN/m²</strong></div>`;

    // ── Stability Checks ──
    $('res-stability').innerHTML = `
      <div class="res-row check-row ${stab.OT_pass?'pass':'fail'}">
        <span>Overturning FOS</span>
        <strong>${stab.FOS_OT.toFixed(2)} ${stab.OT_pass ? '✅' : '❌'} (min 2.0)</strong>
      </div>
      <div class="res-row check-row ${stab.SL_pass?'pass':'fail'}">
        <span>Sliding FOS</span>
        <strong>${stab.FOS_SL.toFixed(2)} ${stab.SL_pass ? '✅' : '❌'} (min 1.5)</strong>
      </div>
      <div class="res-row check-row ${stab.BP_pass?'pass':'fail'}">
        <span>Base Pressure (max)</span>
        <strong>${stab.p_max.toFixed(2)} kN/m² ${stab.BP_pass ? '✅' : '❌'} (SBC = ${$('sbc-value').value})</strong>
      </div>
      <div class="res-row"><span>Base Pressure (min)</span><strong>${stab.p_min.toFixed(2)} kN/m²</strong></div>
      <div class="res-row"><span>Eccentricity (e)</span><strong>${stab.e.toFixed(3)} m ${stab.e <= dims.base_width/6 ? '✅' : '⚠️'} (B/6 = ${(dims.base_width/6).toFixed(3)} m)</strong></div>`;

    // ── Stem Design ──
    $('res-stem').innerHTML = `
      <div class="res-row"><span>Design Moment (Mu)</span><strong>${stem.Mu} kN·m/m</strong></div>
      <div class="res-row"><span>Effective Depth (d)</span><strong>${stem.d} mm</strong></div>
      <div class="res-row"><span>Ast Required</span><strong>${stem.Ast_req} mm²/m</strong></div>
      <div class="res-row highlight"><span>Main Bars (Earth face)</span><strong>Ø${stem.bar.dia} @ ${stem.bar.spacing} mm c/c</strong></div>
      <div class="res-row"><span>Distribution Steel</span><strong>Ø8 @ 250 mm c/c (both faces)</strong></div>
      <div class="res-row check-row ${stem.shear_pass?'pass':'fail'}">
        <span>Shear (τv / τc)</span>
        <strong>${stem.tau_v} / ${stem.tau_c} MPa ${stem.shear_pass?'✅':'❌'}</strong>
      </div>`;

    // ── Base Slab ──
    $('res-base').innerHTML = `
      <div class="res-row"><span>Heel — Mu</span><strong>${heel.Mu} kN·m/m</strong></div>
      <div class="res-row"><span>Heel — Ast</span><strong>${heel.Ast_req} mm²/m</strong></div>
      <div class="res-row highlight"><span>Heel Bars (top)</span><strong>Ø${heel.bar.dia} @ ${heel.bar.spacing} mm c/c</strong></div>
      <div class="res-row"><span>Toe — Mu</span><strong>${toe.Mu} kN·m/m</strong></div>
      <div class="res-row"><span>Toe — Ast</span><strong>${toe.Ast_req} mm²/m</strong></div>
      <div class="res-row highlight"><span>Toe Bars (bottom)</span><strong>Ø${toe.bar.dia} @ ${toe.bar.spacing} mm c/c</strong></div>
      <div class="res-row"><span>Base Distribution</span><strong>Ø10 @ 200 mm c/c (transverse)</strong></div>`;
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportResults() {
    if (!result) { showToast('Run design first.', 'warn'); return; }
    const { dims, stab, stem, heel, toe } = result;
    let txt = `IBS RETAINING WALL DESIGN REPORT\n`;
    txt += `Generated: ${new Date().toLocaleString()}\n`;
    txt += `IS 456 : 2000 | Rankine Earth Pressure\n\n`;
    txt += `DIMENSIONS\n`;
    txt += `Height: ${dims.base_width} m base, stem ${dims.stem_top}/${dims.stem_bot} m\n\n`;
    txt += `STABILITY\nFOS Overturning: ${stab.FOS_OT.toFixed(2)}\nFOS Sliding: ${stab.FOS_SL.toFixed(2)}\nBase Pressure: ${stab.p_max.toFixed(2)} kN/m²\n\n`;
    txt += `STEM: Ø${stem.bar.dia} @ ${stem.bar.spacing} mm c/c\n`;
    txt += `HEEL: Ø${heel.bar.dia} @ ${heel.bar.spacing} mm c/c\n`;
    txt += `TOE:  Ø${toe.bar.dia}  @ ${toe.bar.spacing}  mm c/c\n`;
    const blob = new Blob([txt], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `IBS_RetainingWall_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    showToast('Report exported.', 'success');
  }

  function showToast(msg, type='info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', RWApp.init);
