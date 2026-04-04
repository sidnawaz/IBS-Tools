// ============================================================
// IBS-TOOL-004 · engine.js
// Composite Beam Design Engine — IS 11384:2022
// All functions pure (no DOM access)
// ============================================================

"use strict";

// ── UTIL ────────────────────────────────────────────────────
function sqr(x) { return x * x; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function epsilon(fy) { return Math.sqrt(250 / fy); }

// ── GEOMETRY ────────────────────────────────────────────────
/**
 * Compute opening geometry for castellated / cellular beams
 * @param {object} sec  – section record
 * @param {string} mode – 'castellated'|'cellular'|'I'
 * @param {number} Do   – user override, 0 = auto
 * @returns {object}
 */
function computeOpeningGeometry(sec, mode, DoUser) {
  if (mode === 'I' || DoUser === 0 && mode === 'I') {
    return { Do: 0, d_new: sec.d, hex_side: 0, spacing: 0, mode: 'I' };
  }
  // Auto-size opening: typically 0.6 × d for castellated
  const Do = DoUser > 0 ? DoUser : Math.round(0.6 * sec.d / 10) * 10;
  const d_new = sec.d + (mode === 'castellated' ? Do / 2 : Do * 0.6);
  const hex_side = (mode === 'castellated') ? Do / Math.sqrt(3) : 0;
  const spacing = (mode === 'castellated')
    ? Math.max(Do + hex_side, 225)
    : Math.max(1.5 * Do, 225);   // cellular: c/c typically 1.5Do
  return { Do, d_new, hex_side, spacing, mode };
}

// ── EFFECTIVE SLAB WIDTH ────────────────────────────────────
/**
 * IS 11384:2022 Cl. 8.2 — effective width of compression flange
 */
function effectiveSlabWidth(L, beam_spacing_mm, beam_position) {
  // beff = min(0.7L, beam spacing) for interior; half for edge
  const beff_interior = Math.min(beam_spacing_mm, 0.7 * L * 1000);
  return beam_position === 'edge' ? 0.5 * beff_interior : beff_interior;
}

// ── LOADS ───────────────────────────────────────────────────
/**
 * Compute all loads in N/mm (line load along beam)
 */
function computeLoads(inp) {
  const G = MATERIALS.G;
  const bs = inp.beam_spacing / 1000;   // m

  // Slab self weight: 25 kN/m³ × (Td/2 + Tc)/1000 [m] (deck ribs half-filled)
  const slab_kgm2 = inp.deck.rib_h > 0
    ? 2500 * (inp.deck.rib_h / 2 + inp.Tc) / 1000
    : 2500 * inp.Ts / 1000;
  const slab_kgpm = slab_kgm2 * bs;

  const LL_kgpm  = inp.LL  * bs;
  const FF_kgpm  = inp.FF  * bs;
  const PR_kgpm  = inp.PR  * bs;
  const FI_kgpm  = inp.FI  * bs;
  const CL_kgpm  = inp.CL  * bs;
  const WL_kgpm  = inp.WL;

  const service_kgpm = slab_kgpm + LL_kgpm + FF_kgpm + PR_kgpm + FI_kgpm + WL_kgpm;
  const factored_kgpm = inp.load_factor * service_kgpm;

  // Convert to N/mm
  const toNpmm = (v) => v * G / 1000;

  const L_mm = inp.L * 1000;
  const w_fact_Npmm = toNpmm(factored_kgpm);
  const w_service_Npmm = toNpmm(service_kgpm);
  const w_dead_Npmm  = toNpmm(slab_kgpm + CL_kgpm);
  const w_live_Npmm  = toNpmm((LL_kgpm + FF_kgpm + PR_kgpm + FI_kgpm + WL_kgpm) * inp.frac_live);
  const w_sustained_Npmm = toNpmm(slab_kgpm + inp.frac_live * (LL_kgpm + FF_kgpm + PR_kgpm + FI_kgpm + WL_kgpm));

  // ULS shear and moment
  const V_fact = w_fact_Npmm * L_mm / 2;         // N
  const M_fact = w_fact_Npmm * L_mm * L_mm / 8;  // N·mm

  return {
    slab_kgm2, slab_kgpm, LL_kgpm, FF_kgpm, PR_kgpm, FI_kgpm, CL_kgpm, WL_kgpm,
    service_kgpm, factored_kgpm,
    w_fact_Npmm, w_service_Npmm, w_dead_Npmm, w_live_Npmm, w_sustained_Npmm,
    V_fact, M_fact
  };
}

// ── BENDING CAPACITY (IS 11384:2022 Table 16) ───────────────
/**
 * Full composite bending capacity
 * Returns {Md_Nmm, xu_mm, case, phi_Md}
 */
function bendingCapacity(sec, geom, inp) {
  const { beff_mm, Ts, d_new, fck, fy, gamma_m0 } = inp;
  const { A: As, bf, tf, tw } = sec;
  const Af = bf * tf;
  const ds = inp.deck.rib_h;  // deck depth (used as ds in Table 16)
  const dc = Ts + d_new / 2;  // distance from slab top to steel centroid
  const a = fy / (0.36 * fck);

  let Md, xu, caseNo;

  // Case 1: PNA in slab
  if (beff_mm * ds > a * As) {
    xu = (a * As) / beff_mm;
    Md = (As * fy / gamma_m0) * (dc + 0.5 * ds - 0.42 * xu);
    caseNo = 1;
  }
  // Case 2: PNA in top flange
  else if (beff_mm * ds < a * As && a * As <= beff_mm * ds + 2 * a * Af) {
    const sigma_c = 0.36 * fck;
    xu = ds + (fy * As - sigma_c * beff_mm * ds) / (fy * bf);
    Md = (fy / gamma_m0) * (
      As * (dc + 0.08 * ds) -
      bf * (xu - ds) * (xu + 0.16 * ds) / 2
    );
    caseNo = 2;
  }
  // Case 3: PNA in web
  else {
    xu = ds + tf + (a * (As - 2 * Af) - beff_mm * ds) / (2 * a * tw);
    Md = (fy / gamma_m0) * (
      As * (dc + 0.08 * ds) -
      2 * Af * (0.5 * tf + 0.58 * ds) -
      2 * tw * (xu - ds - tf) * (0.5 * xu + 0.08 * ds + 0.5 * tf)
    );
    caseNo = 3;
  }

  const phi_Md = 0.9 * Md;  // φ = 0.9
  return { Md_Nmm: Md, xu_mm: xu, caseNo, phi_Md };
}

// ── SHEAR CAPACITY (IS 800:2007 Cl.8.4) ────────────────────
/**
 * Shear capacity considering web openings for castellated/cellular
 */
function shearCapacity(sec, geom, fy) {
  const { tw } = sec;
  const { Do, spacing, mode, d_new } = geom;

  let h_post, h_each;
  if (Do <= 0) {
    h_post = sec.d - 2 * sec.tf;
    h_each = h_post;
  } else {
    h_post = spacing - Do;
    if (h_post <= 0) h_post = Math.max(1, sec.d - 2 * sec.tf);
    h_each = h_post / 2;
  }

  const Aw = tw * h_each;
  const h_over_tw = h_each / tw;
  const { Tv_MPa, tau_cr, lambda_w, stiff_req, note } = webShearBuckling(h_over_tw, h_each, tw, fy);

  const Vn_post = Tv_MPa * Aw;
  const Vn_total = Do > 0 ? 2 * Vn_post : Vn_post;

  return { h_post, h_each, Aw, h_over_tw, Tv_MPa, tau_cr, lambda_w, stiff_req, note, Vn_total };
}

function webShearBuckling(h_over_tw, d_web, tw, fy) {
  const E = MATERIALS.E_STEEL;
  const nu = MATERIALS.POISSON;
  const Kv = 5.35;
  const tau_cr = (Kv * Math.PI * Math.PI * E) / (12 * (1 - nu * nu)) * sqr(tw / Math.max(d_web, 1));
  const lambda_w = Math.sqrt(Math.max(0, fy / (Math.sqrt(3) * tau_cr)));

  const Tv_08 = fy / Math.sqrt(3);
  let Tv_MPa;
  if (lambda_w <= 0.8) {
    Tv_MPa = Tv_08;
  } else if (lambda_w < 1.2) {
    const Tv_12 = fy / (Math.sqrt(3) * sqr(1.2));
    Tv_MPa = Tv_08 + (Tv_12 - Tv_08) * (lambda_w - 0.8) / (1.2 - 0.8);
  } else {
    Tv_MPa = fy / (Math.sqrt(3) * sqr(lambda_w));
  }

  const eps = epsilon(fy);
  const thresh1 = 67 * eps;
  const thresh2 = 67 * eps * Math.sqrt(Kv / 5.35);
  const stiff_req = h_over_tw > thresh2;
  let note = '';
  if (stiff_req) {
    note = `Web stiffeners required (h/tw = ${h_over_tw.toFixed(1)} > ${thresh2.toFixed(1)})`;
  } else if (h_over_tw > thresh1) {
    note = `Web near slenderness limit (h/tw = ${h_over_tw.toFixed(1)})`;
  } else {
    note = `Web slenderness OK (h/tw = ${h_over_tw.toFixed(1)} ≤ ${thresh1.toFixed(1)})`;
  }

  return { Tv_MPa, tau_cr, lambda_w, stiff_req, note };
}

// ── VIERENDEEL CHECK (Castellated / Cellular only) ──────────
function vierendeelCheck(sec, geom, M_fact, V_fact, xu, Ts, d_new, fy) {
  if (geom.Do <= 0) return null;
  const { A: As, d, tf } = sec;
  const phi = 0.9;
  const gamma_m0 = MATERIALS.gamma_m0;

  // Vierendeel moment at opening: simplified as V × (d/4)
  const Mv = V_fact * (d / 4);

  // T-section (top and bottom tee)
  const A_tee = 0.5 * As;
  const steel_centroid = Ts + d_new / 2;
  const z = Math.abs(steel_centroid - xu);
  const Z_tee = A_tee * z;
  const Mn_tee = fy * Z_tee;

  // Axial force in tee from global moment
  const d_eff = Math.max(1, d - tf);
  const N_tee = M_fact / d_eff;

  const util_bend  = Mv / (phi * Mn_tee);
  const util_axial = N_tee / (A_tee * fy / gamma_m0);
  const combined   = util_bend + util_axial;

  return { Mv, Mn_tee, N_tee, util_bend, util_axial, combined };
}

// ── COMPOSITE EI (Short & Long term) ────────────────────────
function transformedEI(sec, d_new, Ts, beff, fck, Kc) {
  const E_c = 5000 * Math.sqrt(Math.max(1, fck));  // IS 456 Cl. 6.2.3.1
  const E_s = MATERIALS.E_STEEL;
  const n_short = E_c / E_s;
  const n_long  = (Kc * E_c) / E_s;

  const A_slab = beff * Ts;
  const y_slab = Ts / 2;
  const A_steel = sec.A;
  const y_steel = Ts + d_new / 2;

  const I_slab_centroid = beff * Math.pow(Ts, 3) / 12;
  const d_orig = sec.d;
  const I_steel_centroid = sec.Ix * Math.pow(d_new / d_orig, 3);

  function compositeI(n) {
    const A_slab_t = n * A_slab;
    const denom = A_slab_t + A_steel;
    const y_bar = (A_slab_t * y_slab + A_steel * y_steel) / denom;
    const I_slab_t = n * (I_slab_centroid + A_slab * sqr(y_slab - y_bar));
    const I_steel_t = I_steel_centroid + A_steel * sqr(y_steel - y_bar);
    const I_comp = I_slab_t + I_steel_t;
    return { y_bar, I_comp, EI: E_s * I_comp };
  }

  const short = compositeI(n_short);
  const long  = compositeI(n_long);

  return {
    E_c, n_short, n_long,
    m_short: E_s / E_c,
    m_long:  E_s / (Kc * E_c),
    ...short,   // y_bar_short, I_comp_short, EI_short  (we rename below)
    y_bar_short: short.y_bar, I_comp_short: short.I_comp, EI_short: short.EI,
    y_bar_long:  long.y_bar,  I_comp_long:  long.I_comp,  EI_long:  long.EI
  };
}

// ── DEFLECTION ──────────────────────────────────────────────
function midDefUniform(w_Npmm, L_mm, EI) {
  if (!EI || EI <= 0) return Infinity;
  return 5 * w_Npmm * Math.pow(L_mm, 4) / (384 * EI);
}

function computeDeflections(sec, geom, inp, loads, trans) {
  const L_mm = inp.L * 1000;
  const d_orig = sec.d;
  const I_steel_cast = sec.Ix * Math.pow(geom.d_new / d_orig, 3);
  const EI_steel = MATERIALS.E_STEEL * I_steel_cast;

  // Part A: Construction (unpropped only): dead + construction load on steel alone
  const delta_A = inp.propped ? 0 : midDefUniform(loads.w_dead_Npmm, L_mm, EI_steel);

  // Part B: Short-term live load on composite section
  const delta_B_short = midDefUniform(loads.w_live_Npmm, L_mm, trans.EI_short);
  const delta_B_total = inp.propped ? delta_B_short : delta_A + delta_B_short;

  // Part C: Long-term sustained on composite (creep)
  const delta_C = midDefUniform(loads.w_sustained_Npmm, L_mm, trans.EI_long);

  // Limits: L/360 but cap at 20 mm (IS 11384)
  const limit = Math.min(L_mm / 360, 20);

  return {
    delta_A,
    delta_B_short, delta_B_total,
    delta_C,
    delta_total_LT: delta_A + delta_C,
    limit,
    partB_ok: delta_B_total <= limit,
    partC_ok: delta_C <= limit
  };
}

// ── STUD CONNECTORS (IS 11384:2022 Cl.9) ────────────────────
/**
 * Full stud design including deck reduction factor (IS 11384 Cl.9.4.2)
 */
function studDesign(inp, beff_mm, geom) {
  const { fck, Ts, deck, eta, L, stud_dia_pref } = inp;
  const { Do } = geom;

  // Total compressive force for full shear connection
  const A_slab = beff_mm * Ts;
  const C_slab = 0.36 * fck * A_slab;  // N (concrete compression block)
  const C_total = C_slab;               // for symmetric section ≤ C_slab (governs for Fy=250)

  // Target force with chosen η (degree of shear connection)
  const C_target = eta * C_total;

  // Try stud sizes
  const diaSizes = stud_dia_pref === 'auto' ? [16, 19, 22, 25] : [parseInt(stud_dia_pref)];
  let result = null;

  for (const dia of diaSizes) {
    const Qn_N = getStudCap(dia, fck);

    // Deck reduction factor (IS 11384:2022 Cl.9.4.2)
    let Rg = 1.0, Rp = 1.0;
    if (deck.rib_h > 0) {
      // Ribs perpendicular to beam
      const hr = deck.rib_h;
      const wr = deck.rib_top;
      Rg = 0.85 / Math.sqrt(1);  // single stud in rib
      Rp = (wr / hr) * (inp.stud_h / hr - 1.0);  // simplified
      Rp = clamp(Rp, 0, 1.0);
      Rg = clamp(Rg, 0, 0.85);
    }
    const Qn_red = Rg * Rp * Qn_N;
    const Qn_use = Math.max(Qn_red, 0.3 * Qn_N);  // lower bound

    const n_half = Math.ceil(C_target / Qn_use);  // studs per half span
    const n_total = 2 * n_half;
    const spacing = (L * 1000) / n_half;           // uniform over half-span

    const s_min = Math.max(5 * dia, 150);           // IS 11384 Cl.9.5.1
    const s_max = Math.min(600, 4 * (Ts + geom.d_new));  // IS 11384 Cl.9.5.2

    const ok = spacing >= s_min && spacing <= s_max;
    result = { dia, Qn_N, Qn_red, Rg, Rp, n_half, n_total, spacing, s_min, s_max, ok, C_slab, C_target, eta };
    if (ok || stud_dia_pref !== 'auto') break;
  }
  return result;
}

// ── NATURAL FREQUENCY ────────────────────────────────────────
/**
 * Simplified floor frequency check (Donaldson / AISC SteelConst)
 * fn = π/2 × √(g / δ_service)
 */
function naturalFrequency(delta_service_mm) {
  if (!delta_service_mm || delta_service_mm <= 0) return Infinity;
  const g = 9810;  // mm/s²
  return (Math.PI / 2) * Math.sqrt(g / delta_service_mm);  // Hz
}

// ── WEIGHT REPORT ────────────────────────────────────────────
function beamWeight(sec, L) {
  return sec.w * L;  // kg (w in kg/m)
}

// ── MASTER DESIGN FUNCTION ───────────────────────────────────
function runCompositeDesign(raw_inp) {
  // Resolve section
  const secType = raw_inp.section_type;
  const sec = getSection(raw_inp.section_name, secType);
  if (!sec) return { error: `Section ${raw_inp.section_name} not found` };

  const deck  = getDeck(raw_inp.deck_profile);
  const fy    = parseFloat(raw_inp.fy_grade);
  const fck   = parseFloat(raw_inp.fck);
  const Tc    = parseFloat(raw_inp.Tc);
  const Td    = deck.rib_h;           // deck rib height
  const Ts    = Td + Tc;              // overall slab thickness
  const L     = parseFloat(raw_inp.L);
  const bs    = parseFloat(raw_inp.beam_spacing);
  const eta   = parseFloat(raw_inp.eta);
  const DoUser = parseFloat(raw_inp.Do);
  const load_factor = parseFloat(raw_inp.load_factor);

  // Stud height = rib_h + 35 mm (typical for headed studs above deck)
  const stud_h = Td + 35;

  // 1 — Opening geometry
  const geom = computeOpeningGeometry(sec, raw_inp.mode, DoUser);

  // 2 — Effective slab width
  const beff_mm = effectiveSlabWidth(L, bs, raw_inp.beam_position);

  // 3 — Build engineering input object
  const inp = {
    L, beam_spacing: bs, beff_mm, Ts, Tc, Td, fck, fy, eta, deck,
    load_factor, propped: raw_inp.propped === 'yes', frac_live: parseFloat(raw_inp.frac_live),
    stud_dia_pref: raw_inp.stud_dia, stud_h,
    gamma_m0: MATERIALS.gamma_m0,
    LL: parseFloat(raw_inp.LL), FF: parseFloat(raw_inp.FF),
    PR: parseFloat(raw_inp.PR), FI: parseFloat(raw_inp.FI),
    CL: parseFloat(raw_inp.CL), WL: parseFloat(raw_inp.WL)
  };

  // 4 — Loads
  const loads = computeLoads(inp);

  // 5 — Bending
  const bending = bendingCapacity(sec, geom, { ...inp, d_new: geom.d_new });
  const flex_util = loads.M_fact / bending.phi_Md;
  const flex_ok = flex_util <= 1.0;

  // 6 — Shear
  const shear_res = shearCapacity(sec, geom, fy);
  const shear_util = loads.V_fact / shear_res.Vn_total;
  const shear_ok = shear_util <= 1.0;

  // 7 — Vierendeel
  const vier = vierendeelCheck(sec, geom, loads.M_fact, loads.V_fact, bending.xu_mm, Ts, geom.d_new, fy);
  const vier_ok = vier ? vier.combined <= 1.0 : true;

  // 8 — Deflection
  const trans = transformedEI(sec, geom.d_new, Ts, beff_mm, fck, MATERIALS.Kc);
  const defl  = computeDeflections(sec, geom, inp, loads, trans);

  // 9 — Stud design
  const studs = studDesign(inp, beff_mm, geom);

  // 10 — Natural frequency
  const delta_service_mm = defl.delta_B_short;
  const fn = naturalFrequency(delta_service_mm);
  const fn_ok = fn >= 4.0;  // ISO 10137 min 4 Hz for offices

  // 11 — Lateral torsional buckling check (during construction, unpropped)
  const ltb = ltbCheck(sec, geom, L, fy, loads);

  // 12 — Summary
  const overall_ok = flex_ok && shear_ok && vier_ok && defl.partB_ok && defl.partC_ok && studs.ok;

  return {
    sec, deck, geom, inp, loads, beff_mm,
    bending, flex_util, flex_ok,
    shear: { ...shear_res, util: shear_util, ok: shear_ok },
    vier, vier_ok,
    trans, defl,
    studs, fn, fn_ok, ltb,
    overall_ok,
    beam_wt: beamWeight(sec, L)
  };
}

// ── LTB CHECK (IS 800:2007 Cl.8.2 — construction stage) ─────
function ltbCheck(sec, geom, L, fy, loads) {
  // Effective length for LTB during construction (unpropped)
  // Simplified: Le = L for simply supported without intermediate restraint
  const Le_mm = L * 1000;
  const { d, bf, tf, tw, Ix, Iy, Zex, Zpx } = sec;
  const E = MATERIALS.E_STEEL;
  const G_steel = E / (2 * (1 + MATERIALS.POISSON));
  const Iy_mm4 = Iy;
  const h1 = d - tf;

  // St. Venant torsion constant J (approx)
  const J = (2 * bf * Math.pow(tf, 3) + (d - 2 * tf) * Math.pow(tw, 3)) / 3;

  // Warping constant Iw (doubly symmetric)
  const Iw = Iy * sqr(h1) / 4;

  // Elastic LTB moment (IS 800 Cl.8.2.2)
  const M_cr = (Math.PI / Le_mm) * Math.sqrt(E * Iy_mm4 * G_steel * J +
    sqr(Math.PI * E / Le_mm) * Iy_mm4 * Iw);

  const lambda_LT = Math.sqrt(fy * Zpx / M_cr);
  const phi_LT = 0.5 * (1 + 0.21 * (lambda_LT - 0.2) + sqr(lambda_LT));
  const chi_LT = Math.min(1.0, 1 / (phi_LT + Math.sqrt(sqr(phi_LT) - sqr(lambda_LT))));

  const Md_ltb = chi_LT * fy * Zpx / MATERIALS.gamma_m0;
  // During construction: moment from dead load only
  const M_construction_Nmm = loads.w_dead_Npmm * sqr(L * 1000) / 8;
  const ltb_util = M_construction_Nmm / (0.9 * Md_ltb);
  const ltb_ok = ltb_util <= 1.0;

  return { lambda_LT, chi_LT, Md_ltb, M_construction_Nmm, ltb_util, ltb_ok };
}
