// ============================================================
// IBS-TOOL-004 · app.js
// UI controller — renders inputs → results → visualisations
// ============================================================

"use strict";

// ── On load ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date as default
  const dateEl = document.getElementById('proj_date');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
  populateSectionDropdown();
  attachDeckListener();
  attachSectionListener();
  attachModeListener();
  updateDeckInfo();
  updateSectionPreview();
});

// ── Section dropdown ────────────────────────────────────────
function populateSectionDropdown() {
  const typeEl  = document.getElementById('section_type');
  const nameEl  = document.getElementById('section_name');
  const type    = typeEl ? typeEl.value : 'ISMB';
  const db      = getSectionDB(type);

  nameEl.innerHTML = '';
  db.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = `${s.name} (d=${s.d}mm, w=${s.w}kg/m)`;
    if (s.name === 'ISMB300') opt.selected = true;
    nameEl.appendChild(opt);
  });
  updateSectionPreview();
}

function attachSectionListener() {
  document.getElementById('section_type').addEventListener('change', populateSectionDropdown);
  document.getElementById('section_name').addEventListener('change', updateSectionPreview);
}

function updateSectionPreview() {
  const type = document.getElementById('section_type').value;
  const name = document.getElementById('section_name').value;
  const sec  = getSection(name, type);
  const el   = document.getElementById('preview-props');
  if (!sec || !el) return;
  el.innerHTML = '';
  const props = [
    ['d', sec.d, 'mm'], ['bf', sec.bf, 'mm'], ['tf', sec.tf, 'mm'],
    ['tw', sec.tw, 'mm'], ['A', sec.A, 'mm²'], ['Ix', (sec.Ix/1e4).toFixed(0), 'cm⁴'],
    ['Zex', sec.Zex, 'mm³'], ['Zpx', sec.Zpx, 'mm³'], ['w', sec.w, 'kg/m']
  ];
  props.forEach(([k, v, u]) => {
    el.innerHTML += `<div class="preview-item">
      <span class="preview-key">${k}</span>
      <span class="preview-val">${typeof v === 'number' ? v.toFixed ? v.toFixed(0) : v : v} <small style="opacity:.5;font-size:.6rem">${u}</small></span>
    </div>`;
  });
}

// ── Deck info box ───────────────────────────────────────────
function attachDeckListener() {
  document.getElementById('deck_profile').addEventListener('change', updateDeckInfo);
}
function updateDeckInfo() {
  const key  = document.getElementById('deck_profile').value;
  const deck = getDeck(key);
  const el   = document.getElementById('deck-info');
  if (!el) return;
  el.innerHTML = `<strong>${deck.name}</strong> — ${deck.description}<br>
    Rib height Td = <b>${deck.rib_h} mm</b> | Min topping = <b>${deck.min_topping} mm</b> | Max unshored span = <b>${deck.max_unshored} m</b>`;
}

// ── Mode toggle ─────────────────────────────────────────────
function attachModeListener() {
  document.getElementById('mode').addEventListener('change', () => {
    const mode = document.getElementById('mode').value;
    const dof  = document.getElementById('do-field');
    if (dof) dof.style.display = mode === 'I' ? 'none' : '';
  });
}

// ── Read inputs ─────────────────────────────────────────────
function readInputs() {
  const gv = id => document.getElementById(id)?.value;
  const gf = id => parseFloat(gv(id)) || 0;
  return {
    L:             gf('span'),
    beam_spacing:  gf('beam_spacing'),
    beam_position: gv('beam_position'),
    deck_profile:  gv('deck_profile'),
    Tc:            Math.max(50, gf('Tc')),
    fck:           gf('fck'),
    section_type:  gv('section_type'),
    section_name:  gv('section_name'),
    mode:          gv('mode'),
    Do:            gf('Do'),
    fy_grade:      gv('fy_grade'),
    LL:            gf('LL'),
    FF:            gf('FF'),
    PR:            gf('PR'),
    FI:            gf('FI'),
    CL:            gf('CL'),
    WL:            gf('WL'),
    propped:       gv('propped'),
    frac_live:     parseFloat(gv('frac_live')) || 1.0,
    load_factor:   parseFloat(gv('load_factor')) || 1.5,
    stud_dia:      gv('stud_dia'),
    eta:           parseFloat(gv('eta')) || 1.0
  };
}

// ── Run design ──────────────────────────────────────────────
let lastResult = null;

function runDesign() {
  const inp = readInputs();
  const R   = runCompositeDesign(inp);

  if (R.error) {
    alert('Error: ' + R.error);
    return;
  }
  lastResult = R;

  document.getElementById('outputPlaceholder').style.display = 'none';
  const content = document.getElementById('outputContent');
  content.style.display = 'block';
  content.innerHTML = buildResultHTML(R);
  content.scrollIntoView({ behavior: 'smooth', block: 'start' });

  drawBeamDiagram(R);
  drawStudLayout(R);
  drawLoadBars(R);
}

// ── Result HTML builder ─────────────────────────────────────
function buildResultHTML(R) {
  const f2 = v => isFinite(v) ? v.toFixed(2) : '—';
  const f3 = v => isFinite(v) ? v.toFixed(3) : '—';
  const f0 = v => isFinite(v) ? Math.round(v) : '—';
  const kN  = v => (v/1000).toFixed(2);
  const kNm = v => (v/1e6).toFixed(3);
  const mm  = v => v.toFixed(2);

  const statusBadge = ok => `<span class="result-status ${ok?'status-pass':'status-fail'}">${ok?'PASS ✓':'FAIL ✗'}</span>`;
  const utilCard = (name, util, ok, sub) => {
    const cls = ok ? 'pass' : 'fail';
    const pct = Math.min(util * 100, 110).toFixed(0);
    return `<div class="check-card ${cls} animate-in">
      <div class="check-name">${name}</div>
      <div class="check-util ${cls}">${(util*100).toFixed(1)}%</div>
      <div class="check-label ${cls}">${ok?'PASS':'FAIL'}</div>
      ${sub ? `<div class="check-sub">${sub}</div>` : ''}
      <div class="util-bar-wrap">
        <div class="util-bar-bg"><div class="util-bar-fill ${cls}" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  };

  const { sec, geom, inp, loads, bending, shear, vier, vier_ok, defl, trans, studs, ltb, fn, fn_ok, webPost } = R;

  // Check cards
  const cards = [
    utilCard('Bending (ULS)',            R.flex_util,  R.flex_ok,  `φMd = ${kNm(bending.phi_Md)} kN·m`),
    utilCard('Shear (ULS)',              shear.util,   shear.ok,   `Vn = ${kN(shear.Vn_total)} kN`),
    vier ? utilCard('Vierendeel',        vier.combined,vier_ok,    `Mv = ${kNm(vier.Mv)} kN·m`) : '',
    webPost ? utilCard('Web Post Shear', webPost.util_post, webPost.post_ok, `τ = ${webPost.tau_post.toFixed(1)} MPa`) : '',
    utilCard('Deflect. B (SLS)',         defl.delta_B_total/defl.limit, defl.partB_ok, `${mm(defl.delta_B_total)} / ${mm(defl.limit)} mm`),
    utilCard('Deflect. C (Long-term)',   defl.delta_C/defl.limit,       defl.partC_ok, `${mm(defl.delta_C)} / ${mm(defl.limit)} mm`),
    utilCard('Floor Frequency',          4.0/Math.max(fn,0.01), fn_ok,  `fn = ${f2(fn)} Hz`),
  ].filter(Boolean).join('');

  // Table row helper
  const tr = (label, val, unit='', ok=null) => `
    <tr>
      <td>${label}</td>
      <td class="mono">${val}</td>
      <td class="unit">${unit}</td>
      ${ok!==null ? `<td class="${ok?'pass-td':'fail-td'}">${ok?'✓ PASS':'✗ FAIL'}</td>` : '<td></td>'}
    </tr>`;

  const loadsTable = `
    <div class="detail-block animate-in stagger-1">
      <div class="detail-block-title">Load Summary</div>
      <div id="load-bars-canvas" class="load-bar-wrap" style="margin-bottom:12px"></div>
      <table class="dtable">
        <thead><tr><th>Load Component</th><th>Value</th><th>Unit</th><th></th></tr></thead>
        <tbody>
          ${tr('Slab self weight (25 kN/m³ × (Td/2+Tc))', f2(loads.slab_kgm2),    'kg/m²')}
          ${tr('Live load LL',                              f2(inp.LL),              'kg/m²')}
          ${tr('Floor finish FF',                           f2(inp.FF),              'kg/m²')}
          ${tr('Partition PR',                              f2(inp.PR),              'kg/m²')}
          ${tr('Filling FI',                                f2(inp.FI),              'kg/m²')}
          ${tr('Construction load CL',                      f2(inp.CL),              'kg/m²')}
          ${tr('Wall line load WL',                         f2(inp.WL),              'kg/m')}
          ${tr('Service UDL (total)',                        f2(loads.service_kgpm),  'kg/m')}
          ${tr('Factored UDL (×'+inp.load_factor+')',        f2(loads.factored_kgpm), 'kg/m')}
          ${tr('Construction UDL (slab SW + CL)',            f2(loads.w_constr_Npmm*1000/MATERIALS.G), 'kg/m')}
          ${tr('Factored Shear Vf',                         kN(loads.V_fact),        'kN')}
          ${tr('Factored Moment Mf',                        kNm(loads.M_fact),       'kN·m')}
        </tbody>
      </table>
    </div>`;

  const bendTable = `
    <div class="detail-block animate-in stagger-2">
      <div class="detail-block-title">Bending Capacity — IS 11384:2022 Table 16</div>
      <table class="dtable">
        <thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
        <tbody>
          ${tr('PNA Case',                                  bending.caseNo.toString())}
          ${tr('Effective concrete depth ds',                f2(bending.ds),           'mm')}
          ${tr('Steel centroid from slab top dc',            f2(bending.dc),           'mm')}
          ${tr('a = fy / (0.36·fck)',                        f3(inp.fy/(0.36*inp.fck)))}
          ${tr('Plastic neutral axis xu',                    f2(bending.xu_mm),        'mm')}
          ${tr('Nominal capacity Md',                        kNm(bending.Md_Nmm),      'kN·m')}
          ${tr('Design capacity φMd  (φ = 0.90)',            kNm(bending.phi_Md),      'kN·m')}
          ${tr('Applied moment Mf',                          kNm(loads.M_fact),        'kN·m')}
          ${tr('Utilisation Mf / φMd',                       f3(R.flex_util),          '', R.flex_ok)}
        </tbody>
      </table>
    </div>`;

  const shearTable = `
    <div class="detail-block animate-in stagger-2">
      <div class="detail-block-title">Shear Capacity — IS 800:2007 Cl. 8.4</div>
      <table class="dtable">
        <thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
        <tbody>
          ${tr('Shear section',                   shear.shear_type)}
          ${tr('Tee height h_tee (each)',          f2(shear.h_tee||shear.h_web),  'mm')}
          ${tr('h / tw ratio',                     f2(shear.h_over_tw))}
          ${tr('Shear buckling stress Tv',         f2(shear.Tv_MPa),              'MPa')}
          ${tr('Total shear area Aw (both tees)',  f0(shear.Aw_total),            'mm²')}
          ${tr('Total shear capacity Vn',          kN(shear.Vn_total),            'kN')}
          ${tr('Applied shear Vf',                 kN(loads.V_fact),              'kN')}
          ${tr('Utilisation Vf / Vn',              f3(shear.util),                '', shear.ok)}
        </tbody>
      </table>
      ${shear.note ? `<div class="notes-box"><strong>Web Check</strong>${shear.note}</div>` : ''}
    </div>`;

  const vierTable = vier ? `
    <div class="detail-block animate-in stagger-3">
      <div class="detail-block-title">Vierendeel Check — IS 11384:2022 / SCI P355</div>
      <div class="notes-box" style="margin-bottom:10px">
        <strong>Method</strong>Each tee carries V/2. Secondary moment Mv = (V/2) × (Do/2). 
        Checked at first opening from support (worst combined M+V case).
      </div>
      <table class="dtable">
        <thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
        <tbody>
          ${tr('Opening length ao = Do',           f0(vier.a_o),            'mm')}
          ${tr('Shear per tee V_tee = V/2',        kN(vier.V_tee),          'kN')}
          ${tr('Vierendeel moment Mv = V_tee×ao/2',kNm(vier.Mv),            'kN·m')}
          ${tr('Lever arm (tee c/c)',               f2(vier.lever_arm),      'mm')}
          ${tr('Tee section area',                  f0(vier.A_tee),          'mm²')}
          ${tr('Tee plastic moment Mp_tee',         kNm(vier.Mp_tee),        'kN·m')}
          ${tr('Axial (compression, top tee)',       kN(vier.N_c_first),      'kN')}
          ${tr('UC — top tee (comp + Vier.bending)',f3(vier.UC_top_first),   '', vier.UC_top_first<=1.0)}
          ${tr('UC — bottom tee (tens + Vier.bending)',f3(vier.UC_bot_first),'', vier.UC_bot_first<=1.0)}
          ${tr('UC — at support (pure Vierendeel)', f3(vier.UC_support),     '', vier.UC_support<=1.0)}
          ${tr('Combined (governing)',              f3(vier.combined),        '', vier_ok)}
        </tbody>
      </table>
    </div>` : '';

  const webPostTable = webPost ? `
    <div class="detail-block animate-in stagger-3">
      <div class="detail-block-title">Web Post Horizontal Shear</div>
      <table class="dtable">
        <thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
        <tbody>
          ${tr('Web post width',          f2(webPost.web_post_w), 'mm')}
          ${tr('Horizontal shear V_H',    kN(webPost.V_H),        'kN')}
          ${tr('Post shear area A_post',  f0(webPost.A_post),     'mm²')}
          ${tr('Shear stress τ_post',     f2(webPost.tau_post),   'MPa')}
          ${tr('Design shear stress fv',  f2(webPost.fv_design),  'MPa')}
          ${tr('Utilisation',             f3(webPost.util_post),  '', webPost.post_ok)}
        </tbody>
      </table>
    </div>` : '';

  const ltbTable = `
    <div class="detail-block animate-in stagger-3">
      <div class="detail-block-title">Lateral Torsional Buckling — IS 800:2007 Cl. 8.2.1</div>
      <div class="notes-box" style="margin-bottom:0;background:#d4f0e0;border-color:#1a7a4a">
        <strong style="color:#1a7a4a;font-size:0.85rem">✓ LTB — NOT APPLICABLE AT ANY STAGE</strong>
        <ul style="margin-top:6px;color:#1a5a3a;font-size:0.82rem">
          <li style="margin-bottom:3px"><strong>Step 1:</strong> Steel beam erected on bearings.</li>
          <li style="margin-bottom:3px"><strong>Step 2:</strong> Profiled deck sheet laid on top flange and fixed with self-drilling screws.</li>
          <li style="margin-bottom:3px"><strong>Step 3:</strong> Shear studs welded <em>through the deck</em> to the top flange — <strong>FULL CONTINUOUS LATERAL RESTRAINT provided BEFORE concrete is poured.</strong></li>
          <li style="margin-bottom:3px"><strong>Step 4:</strong> Concrete poured and composite action develops.</li>
          <li style="margin-top:6px;padding-top:6px;border-top:1px solid #a0c8a0">
            Top compression flange is restrained against lateral displacement and twist from Step 3 onward — 
            covering both the construction stage and the in-service composite stage.<br>
            <strong>Code ref: IS 800:2007 Cl. 8.2.1 Note 1</strong> — LTB need not be checked when 
            the compression flange is restrained against lateral bending throughout its length.
          </li>
        </ul>
      </div>
    </div>`;

  const deflTable = `
    <div class="detail-block animate-in stagger-4">
      <div class="detail-block-title">Deflection — IS 11384:2022</div>
      <table class="dtable">
        <thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
        <tbody>
          ${tr('Ec = 5000√fck',                    f0(trans.E_c),                'MPa')}
          ${tr('Modular ratio n (short-term)',       f2(trans.m_short))}
          ${tr('Modular ratio n (long-term)',        f2(trans.m_long))}
          ${tr('Castellated Ix (flanges displaced)', (trans.I_steel_castex/1e4).toFixed(0), 'cm⁴')}
          ${tr('EI composite (short-term)',          (trans.EI_short/1e12).toFixed(3),'GN·mm²')}
          ${tr('EI composite (long-term)',           (trans.EI_long/1e12).toFixed(3), 'GN·mm²')}
          ${tr('Part A — Construction δ (slab SW+CL on steel)',  mm(defl.delta_A),  'mm')}
          ${tr('Part B — Short-term live δ (composite)',         mm(defl.delta_B_short), 'mm')}
          ${tr('Part B total SLS (A+B if unpropped)',            mm(defl.delta_B_total), 'mm', defl.partB_ok)}
          ${tr('Limit = min(L/360, 20 mm)',                      mm(defl.limit),    'mm')}
          ${tr('Part C — Long-term sustained δ (composite)',     mm(defl.delta_C),  'mm', defl.partC_ok)}
          ${tr('Total long-term (A + C)',                        mm(defl.delta_total_LT), 'mm')}
          ${tr('δ DL on composite (for frequency)',              mm(defl.delta_DL_comp),  'mm')}
          ${tr('Floor frequency fn = (π/2)√(g/δ_DL)',           f2(fn),            'Hz', fn_ok)}
        </tbody>
      </table>
    </div>`;

  const studTable = studs ? `
    <div class="detail-block animate-in stagger-4">
      <div class="detail-block-title">Shear Stud Connectors — IS 11384:2022 Cl. 9</div>
      <div id="stud-layout-canvas"></div>
      <table class="dtable" style="margin-top:10px">
        <thead><tr><th>Item</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
        <tbody>
          ${tr('Stud diameter',                        studs.dia,                              'mm')}
          ${tr('Qn characteristic (fck scaled)',        (studs.Qn_char/1000).toFixed(2),       'kN')}
          ${tr('Rg (IS 11384:2022 Table 14)',           studs.Rg.toFixed(2))}
          ${tr('Rp (strong position)',                   studs.Rp.toFixed(2))}
          ${tr('Qn reduced (Rg·Rp·Qn)',                 (studs.Qn_red/1000).toFixed(2),        'kN')}
          ${tr('C_concrete (0.36·fck·beff·ds)',          (studs.C_conc/1000).toFixed(1),        'kN')}
          ${tr('C_steel (As·fy/γm0)',                    (studs.C_steel/1000).toFixed(1),       'kN')}
          ${tr('C_total (governing)',                     (studs.C_total/1000).toFixed(1),       'kN')}
          ${tr('Governs by',                             studs.governs_by)}
          ${tr('Target force (η × C_total)',             (studs.C_target/1000).toFixed(1),      'kN')}
          ${tr('Studs per half-span',                    studs.n_half.toString())}
          ${tr('Total studs (full span)',                 studs.n_total.toString())}
          ${tr('Spacing (uniform over half-span)',        f0(studs.spacing),                     'mm', studs.ok)}
          ${tr('Min spacing: max(5d, 100 mm)',            f0(studs.s_min),                       'mm')}
          ${tr('Max spacing: min(6Ts, 600 mm)',           f0(studs.s_max),                       'mm')}
        </tbody>
      </table>
    </div>` : '';

  return `
    <div class="result-header">
      <div>
        <div class="result-title">Design Results — ${sec.name} · ${geom.mode.toUpperCase()}</div>
        <div class="result-subtitle">L = ${inp.L} m · beff = ${f0(R.beff_mm)} mm · Ts = ${inp.Ts} mm · M${inp.fck} concrete · fy = ${inp.fy} MPa · η = ${inp.eta}</div>
      </div>
      ${statusBadge(R.overall_ok)}
    </div>
    <div class="result-body">
      <div class="check-grid" style="margin-bottom:24px">${cards}</div>

      <!-- Beam diagram -->
      <div class="detail-block animate-in stagger-1">
        <div class="detail-block-title">Beam Elevation & Cross-Section</div>
        <div class="section-diagram"><canvas id="beam-diagram" width="700" height="200"></canvas></div>
      </div>

      ${loadsTable}
      ${bendTable}
      ${shearTable}
      ${vierTable}
      ${webPostTable}
      ${ltbTable}
      ${deflTable}
      ${studTable}

      <!-- Design Notes -->
      <div class="notes-box animate-in stagger-5">
        <strong>Design Basis Notes</strong>
        <ul>
          <li>Bending — IS 11384:2022 Table 16, PNA Case ${bending.caseNo}. Effective concrete depth = ${f2(bending.ds)} mm (Tc above ribs).</li>
          <li>Shear — IS 800:2007 Cl.8.4. ${geom.Do > 0 ? `At openings: two tees, each h_tee = ${f2(shear.h_tee||0)} mm.` : 'Full web shear.'}</li>
          ${geom.Do > 0 ? `<li>Vierendeel — Mv = (V/2)×(Do/2) at each tee per SCI P355. Top and bottom tee checked separately.</li>` : ''}
          ${geom.Do > 0 ? `<li>Web post horizontal shear checked between openings.</li>` : ''}
          <li><strong>LTB — NOT APPLICABLE at any stage.</strong> Deck sheet fixed + studs welded to top flange BEFORE concrete pour — full continuous lateral restraint from erection stage onward. IS 800:2007 Cl.8.2.1 Note 1.</li>
          <li>Deflection limits: min(L/360, 20 mm) per IS 11384:2022 Cl.12.</li>
          <li>Floor frequency uses DL deflection on composite section. Minimum 4 Hz per ISO 10137.</li>
          <li>Stud Rg = ${studs?studs.Rg:'—'}, Rp = ${studs?studs.Rp:'—'} per IS 11384:2022 Table 14. Spacing limit: min(6Ts, 600) = ${studs?f0(studs.s_max):'—'} mm.</li>
          <li>Construction: ${inp.propped ? 'PROPPED — Part A deflection = 0; LTB Le = L/2.' : 'UNPROPPED — Part A deflection included; LTB Le = L.'}</li>
          ${shear.stiff_req ? '<li style="color:#a82020"><strong>⚠ Web stiffeners required at openings — h/tw exceeds limit.</strong></li>' : ''}
        </ul>
      </div>
    </div>
    <div class="report-btn-wrap">
      <button class="report-btn" onclick="generateReport(lastResult)">⬇ Download Word Report (.docx)</button>
      <button class="report-btn secondary" onclick="window.print()">🖨 Print</button>
    </div>`;
}

// ── Canvas: Beam diagram ─────────────────────────────────────
function drawBeamDiagram(R) {
  setTimeout(() => {
    const canvas = document.getElementById('beam-diagram');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const geom = R.geom;
    const sec  = R.sec;
    const inp  = R.inp;
    const studs = R.studs;

    // Scale: draw beam in left 2/3, section in right 1/3
    const beamW = 460, beamX0 = 20, secX0 = 510;
    const scale = beamW / (inp.L * 1000);
    const midY  = 120;

    // --- Slab
    const slabH = Math.max(16, inp.Ts / 10);
    ctx.fillStyle = '#c5d9eb';
    ctx.fillRect(beamX0, midY - slabH - 30, beamW, slabH);
    ctx.strokeStyle = '#8ba8c4'; ctx.lineWidth = 1;
    ctx.strokeRect(beamX0, midY - slabH - 30, beamW, slabH);
    ctx.fillStyle = '#2e6da4'; ctx.font = '10px IBM Plex Mono';
    ctx.fillText(`Slab Ts=${inp.Ts}mm`, beamX0 + 8, midY - slabH - 20);

    // --- Beam elevation
    const dScale = geom.d_new / 10;
    const beamTop = midY - slabH - 30 + slabH;
    const beamBot = beamTop + dScale;

    // Flanges
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(beamX0, beamTop, beamW, sec.tf / 10);
    ctx.fillRect(beamX0, beamBot - sec.tf / 10, beamW, sec.tf / 10);

    // Web
    const webH = dScale - 2 * sec.tf / 10;
    const webX = beamX0 + beamW / 2 - sec.tw / 2;
    ctx.fillStyle = '#2e6da4';
    ctx.fillRect(beamX0 + beamW / 2 - sec.tw * 1.5, beamTop + sec.tf / 10, sec.tw * 3, webH);

    // Openings for castellated/cellular
    if (geom.Do > 0 && studs) {
      const nOpen = Math.ceil(inp.L * 1000 / geom.spacing);
      const openR = geom.Do / 2 / 10;
      const cy = beamTop + dScale / 2;
      for (let i = 1; i < nOpen; i++) {
        const cx = beamX0 + (i / nOpen) * beamW;
        ctx.beginPath();
        ctx.ellipse(cx, cy, openR, openR * 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0a1e30';
        ctx.fill();
      }
    }

    // Studs
    if (studs) {
      const spacing_px = (inp.L * 1000 / studs.n_half) * scale;
      for (let i = 0; i <= studs.n_half * 2; i++) {
        const sx = beamX0 + i * spacing_px;
        if (sx > beamX0 + beamW) break;
        ctx.beginPath();
        ctx.moveTo(sx, beamTop - 2);
        ctx.lineTo(sx, beamTop - 12);
        ctx.strokeStyle = '#e8801a'; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, beamTop - 14, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#e8801a'; ctx.fill();
      }
    }

    // Supports
    const drawTriangle = (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 18); ctx.lineTo(x + 12, y + 18);
      ctx.closePath(); ctx.fillStyle = '#8ba8c4'; ctx.fill();
    };
    drawTriangle(beamX0, beamBot + 4);
    drawTriangle(beamX0 + beamW, beamBot + 4);

    // Label
    ctx.fillStyle = '#1a3a5c'; ctx.font = 'bold 11px IBM Plex Mono';
    ctx.fillText(`L = ${inp.L} m`, beamX0 + beamW / 2 - 25, beamBot + 30);

    // ── Cross section (right side)
    const sx0 = secX0 + 60, sy0 = 40, scl = 0.18;
    const sdH = sec.d * scl, sfW = sec.bf * scl, sTf = sec.tf * scl, sTw = sec.tw * scl;

    // Slab above
    ctx.fillStyle = '#c5d9eb';
    ctx.fillRect(sx0 - sfW / 2 - 20, sy0, sfW + 40, inp.Ts * scl);
    ctx.strokeStyle = '#8ba8c4'; ctx.lineWidth = 0.8;
    ctx.strokeRect(sx0 - sfW / 2 - 20, sy0, sfW + 40, inp.Ts * scl);

    const beamY0 = sy0 + inp.Ts * scl;
    // Top flange
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(sx0 - sfW / 2, beamY0, sfW, sTf);
    // Web
    ctx.fillStyle = '#2e6da4';
    ctx.fillRect(sx0 - sTw / 2, beamY0 + sTf, sTw, sdH - 2 * sTf);
    // Bottom flange
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(sx0 - sfW / 2, beamY0 + sdH - sTf, sfW, sTf);

    // Labels
    ctx.fillStyle = '#2e6da4'; ctx.font = '10px IBM Plex Mono';
    ctx.fillText(`bf=${sec.bf}`, sx0 - 20, beamY0 - 5);
    ctx.fillText(`d=${Math.round(geom.d_new)}`, sx0 + sfW / 2 + 4, beamY0 + sdH / 2);
    ctx.fillText('X-SECTION', sx0 - 28, sy0 - 5);

    // Stud on cross-section
    if (studs) {
      ctx.beginPath();
      ctx.moveTo(sx0, beamY0 - 2); ctx.lineTo(sx0, sy0 - 2);
      ctx.strokeStyle = '#e8801a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(sx0, sy0 - 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e8801a'; ctx.fill();
    }
  }, 100);
}

// ── Canvas: Stud layout ─────────────────────────────────────
function drawStudLayout(R) {
  setTimeout(() => {
    const el = document.getElementById('stud-layout-canvas');
    if (!el || !R.studs) return;

    const st = R.studs;
    const L  = R.inp.L;
    const W  = 680, H = 60;

    el.innerHTML = `<svg width="${W}" height="${H}" style="background:#e4ecf4;border-radius:4px;display:block">
      <!-- Beam outline -->
      <rect x="10" y="20" width="${W-20}" height="20" rx="2" fill="#2e6da4" opacity=".3"/>
      <!-- Mid line -->
      <line x1="${W/2}" y1="15" x2="${W/2}" y2="45" stroke="#1a3a5c" stroke-dasharray="3,3" stroke-width="1"/>
      <!-- Studs -->
      ${Array.from({length: st.n_half * 2 + 1}, (_,i) => {
        const x = 10 + (i / (st.n_half * 2)) * (W - 20);
        return `<line x1="${x}" y1="14" x2="${x}" y2="26" stroke="#e8801a" stroke-width="2"/>
                <circle cx="${x}" cy="12" r="3.5" fill="#e8801a"/>`;
      }).join('')}
      <!-- Span label -->
      <text x="${W/2}" y="${H-4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#2e6da4">
        ${st.n_total} studs Ø${st.dia} @ ${Math.round(st.spacing)} mm c/c | L = ${L} m
      </text>
    </svg>`;
  }, 150);
}

// ── Load bars ───────────────────────────────────────────────
function drawLoadBars(R) {
  setTimeout(() => {
    const el = document.getElementById('load-bars-canvas');
    if (!el) return;
    const loads = R.loads;
    const inp   = R.inp;

    const items = [
      { name: 'Slab self',  val: loads.slab_kgm2,  color: '#2e6da4' },
      { name: 'Live LL',    val: inp.LL,             color: '#1a7a4a' },
      { name: 'Finish FF',  val: inp.FF,             color: '#8ba8c4' },
      { name: 'Partition',  val: inp.PR,             color: '#e8801a' },
      { name: 'Wall WL',    val: inp.WL,             color: '#a82020' },
    ];
    const total = items.reduce((s, i) => s + i.val, 0) || 1;

    el.innerHTML = items.map(item => `
      <div class="load-row">
        <span class="load-name">${item.name}</span>
        <div class="load-bar-outer">
          <div class="load-bar-inner" style="width:${(item.val/total*100).toFixed(1)}%;background:${item.color}"></div>
        </div>
        <span class="load-val">${item.val.toFixed(0)} kg/m²</span>
      </div>`).join('');
  }, 120);
}

// Helper for getElementById shorthand
function id(s) { return document.getElementById(s); }
