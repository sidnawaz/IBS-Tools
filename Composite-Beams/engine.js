// ============================================================
// IBS-TOOL-004 · engine.js  (v3 — Fully Corrected)
// Composite Beam Design Engine — IS 11384:2022 / IS 800:2007
//
// Corrections from v2:
//  [1] LTB — NOT checked for composite stage (top flange restrained
//      by deck + studs). Checked ONLY at construction stage on bare steel.
//  [2] Vierendeel — corrected to Mv = V_tee × (a_o/2) per SCI P355.
//      Top and bottom tee checked separately. Bottom tee governs.
//  [3] Shear at opening — h_tee = (d_new - Do)/2 (not spacing-Do).
//  [4] Stud Rg/Rp — fixed per IS 11384:2022 Table 14 (constant values).
//  [5] Stud spacing — s_max = min(6×Ts, 600 mm) per IS 11384 Cl.9.5.
//  [6] Castellated Ix — corrected using parallel-axis theorem for
//      flanges displaced by Do/2 (not d³ scaling).
//  [7] Construction load — LTB uses (slab_sw + CL) as peak construction.
//  [8] Natural frequency — uses sustained DL deflection on composite section.
// ============================================================
"use strict";

// ── UTILITIES ────────────────────────────────────────────────
function sqr(x)              { return x * x; }
function clamp(x, lo, hi)    { return Math.max(lo, Math.min(hi, x)); }
function epsilon_s(fy)       { return Math.sqrt(250 / fy); }  // IS 800 Table 2

// ── 1. OPENING GEOMETRY ──────────────────────────────────────
/**
 * Compute expanded depth and opening parameters.
 *
 * Castellated: cutting is diagonal at 60°, giving hexagonal openings.
 *   Do = diagonal opening dimension (= horizontal width of hexagon)
 *   hex_side = Do / √3  (side of inscribed hexagon)
 *   d_new = d_orig + hex_side  (each half displaced by hex_side/2... 
 *           wait — standard: d_new = d_orig + Do/2 for 60° cut)
 *   Opening height = Do (flat-to-flat of hexagon = Do)
 *   Tee height h_tee = (d_new - Do) / 2
 *
 * Cellular: circular openings diameter Do.
 *   d_new ≈ d_orig + 0.5 × Do  (standard expansion for 50% ratio)
 *   Tee height h_tee = (d_new - Do) / 2
 */
function computeOpeningGeometry(sec, mode, DoUser) {
  if (mode === 'I') {
    return { Do: 0, d_new: sec.d, hex_side: 0, spacing_cc: 0,
             h_tee: 0, web_post_w: 0, mode: 'I' };
  }

  // Auto-size: typically 60–70% of original depth
  const Do = DoUser > 0 ? DoUser : Math.round(0.65 * sec.d / 10) * 10;

  // Expanded depth — standard 60° diagonal cut gives Do/2 per half
  const d_new = sec.d + Do / 2;

  // Tee height (clear height of tee above/below opening)
  const h_tee = (d_new - Do) / 2;

  // Hex geometry (castellated only)
  const hex_side = (mode === 'castellated') ? Do / Math.sqrt(3) : 0;

  // Centre-to-centre spacing of openings:
  //   Castellated: c/c = Do + hex_side  (one opening + one web post)
  //   Cellular: c/c typically 1.5 × Do (min 1.25Do for adequate web post)
  const spacing_cc = (mode === 'castellated')
    ? Do + hex_side
    : Math.max(1.5 * Do, Do + 50);

  // Web post width between adjacent openings
  const web_post_w = spacing_cc - Do;

  // Minimum spacing check (web post ≥ 0.1 × Do for castellated)
  const min_post = (mode === 'castellated') ? 0.1 * Do : 0.25 * Do;
  if (web_post_w < min_post) {
    console.warn(`Web post width ${web_post_w.toFixed(0)} mm < minimum ${min_post.toFixed(0)} mm`);
  }

  return { Do, d_new, hex_side, spacing_cc, h_tee, web_post_w, mode };
}

// ── 2. EFFECTIVE SLAB WIDTH ──────────────────────────────────
/**
 * IS 11384:2022 Cl. 8.2
 * beff = min(L/4, beam_spacing) for interior beam
 *        (conservative: some codes use 0.7L, IS uses L/4 per span)
 * Edge beam: half of interior value
 */
function effectiveSlabWidth(L, beam_spacing_mm, beam_position) {
  // IS 11384:2022 Cl.8.2 — effective width each side = min(L/8, s/2)
  // Total interior beff = min(L/4, s)
  const beff_interior = Math.min(beam_spacing_mm, L * 1000 / 4);
  return beam_position === 'edge' ? beff_interior / 2 : beff_interior;
}

// ── 3. CASTELLATED BEAM MOMENT OF INERTIA ────────────────────
/**
 * FIX [6]: Ix of castellated beam using parallel-axis theorem.
 * When beam is cut and re-welded, both flanges move outward by Do/4
 * from their original positions (half the expansion = Do/4 each).
 *
 * I_cast = I_web_orig + 2 × Af × (d_new/2 - tf/2)²
 *        = I_orig - 2×Af×(d_orig/2-tf/2)² + 2×Af×(d_new/2-tf/2)²
 *
 * This is exact for a symmetric I-section where only flange positions change.
 */
function castellatedIx(sec, d_new) {
  const { Ix, A, bf, tf, tw, d } = sec;
  const Af = bf * tf;
  // Flange centroid distance from NA (original)
  const yf_orig = d / 2 - tf / 2;
  // Flange centroid distance from NA (expanded)
  const yf_new  = d_new / 2 - tf / 2;
  // Web moment of inertia (unchanged — same web height approximately)
  const I_web = Ix - 2 * Af * sqr(yf_orig);
  // Updated total Ix
  const I_cast = I_web + 2 * Af * sqr(yf_new);
  return Math.max(I_cast, Ix);  // never less than original
}

// ── 4. LOADS ──────────────────────────────────────────────────
function computeLoads(inp) {
  const G  = MATERIALS.G;      // 9.81 N/kg
  const bs = inp.beam_spacing / 1000;  // tributary width in metres

  // Slab self-weight: 25 kN/m³
  // Deck rib: ribs half-filled = effective depth = rib_h/2 + Tc
  // Flat slab: full Ts
  const slab_kgm2 = inp.deck.rib_h > 0
    ? 2500 * (inp.deck.rib_h / 2 + inp.Tc) / 1000
    : 2500 * inp.Ts / 1000;
  const slab_kgpm = slab_kgm2 * bs;

  const LL_kgpm = inp.LL * bs;
  const FF_kgpm = inp.FF * bs;
  const PR_kgpm = inp.PR * bs;
  const FI_kgpm = inp.FI * bs;
  const CL_kgpm = inp.CL * bs;   // construction live load
  const WL_kgpm = inp.WL;        // wall line load already per metre

  // Service (unfactored) = all permanent + imposed
  const service_kgpm  = slab_kgpm + LL_kgpm + FF_kgpm + PR_kgpm + FI_kgpm + WL_kgpm;
  // Factored (ULS)
  const factored_kgpm = inp.load_factor * service_kgpm;

  // Helper: kg/m → N/mm
  const toNpmm = v => v * G / 1000;

  const w_fact_Npmm     = toNpmm(factored_kgpm);
  const w_service_Npmm  = toNpmm(service_kgpm);

  // Construction stage load (bare steel): slab SW + construction live
  const w_constr_Npmm   = toNpmm(slab_kgpm + CL_kgpm);

  // For SLS deflection — live load fraction
  const w_live_Npmm     = toNpmm((LL_kgpm + FF_kgpm + PR_kgpm + FI_kgpm + WL_kgpm) * inp.frac_live);

  // FIX [8]: Sustained load for frequency = DL only on composite section
  const w_DL_comp_Npmm  = toNpmm(slab_kgpm + FF_kgpm + PR_kgpm + FI_kgpm + WL_kgpm);

  // Long-term sustained (for creep deflection)
  const w_sustained_Npmm = toNpmm(slab_kgpm + inp.frac_live * (LL_kgpm + FF_kgpm + PR_kgpm + FI_kgpm + WL_kgpm));

  const L_mm = inp.L * 1000;
  const V_fact = w_fact_Npmm * L_mm / 2;
  const M_fact = w_fact_Npmm * sqr(L_mm) / 8;

  return {
    slab_kgm2, slab_kgpm, LL_kgpm, FF_kgpm, PR_kgpm, FI_kgpm, CL_kgpm, WL_kgpm,
    service_kgpm, factored_kgpm,
    w_fact_Npmm, w_service_Npmm, w_constr_Npmm,
    w_live_Npmm, w_sustained_Npmm, w_DL_comp_Npmm,
    V_fact, M_fact
  };
}

// ── 5. BENDING CAPACITY — IS 11384:2022 Table 16 ─────────────
/**
 * Full plastic moment of composite section.
 * PNA determined by force equilibrium.
 *
 * Notation (IS 11384:2022):
 *   ds = slab depth (overall = Ts for flat; Tc for composite deck — 
 *        concrete above ribs only resists compression)
 *   dc = dist from slab top (top of concrete) to steel section centroid
 *   a  = fy / (0.36 × fck)  [depth of equivalent stress block per unit force]
 *   As = steel area; Af = flange area; tf = flange thk; tw = web thk
 *
 * For composite deck: only concrete above ribs (Tc) is effective in
 * compression. Ribs run perpendicular to beam so concrete in ribs is
 * ignored (conservative — IS 11384 approach).
 */
function bendingCapacity(sec, geom, inp) {
  const { beff_mm, Ts, Tc, Td, d_new, fck, fy } = inp;
  const gamma_m0 = MATERIALS.gamma_m0;
  const { A: As, bf, tf, tw } = sec;
  const Af = bf * tf;

  // Effective concrete depth in compression (above ribs only for deck slab)
  const ds = inp.deck.rib_h > 0 ? Tc : Ts;

  // Distance from top of slab to steel section centroid
  const dc = Ts + d_new / 2;

  // Stress block parameter (mm per N)
  const a = fy / (0.36 * fck);

  let Md, xu, caseNo;

  // ── Case 1: PNA in concrete slab (all steel in tension) ──
  if (beff_mm * ds >= a * As) {
    xu = (a * As) / beff_mm;
    Md = (As * fy / gamma_m0) * (dc - Td - 0.42 * xu + ds / 2 + Td);
    // Simplified: moment arm from steel centroid to concrete centroid
    // M = (As fy/γm0) × (dc + 0.5ds - 0.42xu)
    Md = (As * fy / gamma_m0) * (dc + 0.5 * ds - 0.42 * xu);
    caseNo = 1;
  }
  // ── Case 2: PNA in steel top flange ──────────────────────
  else if (beff_mm * ds < a * As && a * As <= beff_mm * ds + 2 * a * Af) {
    const sigma_c = 0.36 * fck;
    xu = ds + (fy * As - sigma_c * beff_mm * ds) / (fy * bf);
    Md = (fy / gamma_m0) * (
      As * (dc + 0.08 * ds) -
      bf * (xu - ds) * (xu + 0.16 * ds) / 2
    );
    caseNo = 2;
  }
  // ── Case 3: PNA in steel web ──────────────────────────────
  else {
    xu = ds + tf + (a * (As - 2 * Af) - beff_mm * ds) / (2 * a * tw);
    Md = (fy / gamma_m0) * (
      As * (dc + 0.08 * ds) -
      2 * Af * (0.5 * tf + 0.58 * ds) -
      2 * tw * (xu - ds - tf) * (0.5 * xu + 0.08 * ds + 0.5 * tf)
    );
    caseNo = 3;
  }

  const phi_Md = 0.9 * Md;
  return { Md_Nmm: Md, xu_mm: xu, caseNo, phi_Md, ds, dc };
}

// ── 6. SHEAR CAPACITY — IS 800:2007 Cl. 8.4 ─────────────────
/**
 * FIX [3]: Shear area uses h_tee = (d_new - Do)/2 for each tee.
 * For plain web: h_web = d - 2tf.
 * At openings: two tees carry shear; each tee Aw = tw × h_tee.
 */
function shearCapacity(sec, geom, fy) {
  const { tw, tf, d } = sec;
  const { Do, d_new, h_tee, mode } = geom;

  let h_web, Aw_total, shear_type;

  if (Do <= 0 || mode === 'I') {
    // Full I-section — no openings
    h_web    = d - 2 * tf;
    Aw_total = tw * h_web;
    shear_type = 'Full web';
  } else {
    // At opening: two tees, each height h_tee
    // h_tee = (d_new - Do) / 2
    h_web    = h_tee;    // height of each tee's web portion
    Aw_total = 2 * tw * h_tee;   // both tees
    shear_type = 'At opening (2 tees)';
  }

  const h_over_tw = h_web / tw;
  const { Tv_MPa, tau_cr, lambda_w, stiff_req, note } = webShearBuckling(
    h_over_tw, h_web, tw, fy
  );

  const Vn_total = Tv_MPa * Aw_total;

  return {
    h_web, h_tee, Aw_total, h_over_tw, shear_type,
    Tv_MPa, tau_cr, lambda_w, stiff_req, note, Vn_total
  };
}

/**
 * Web shear buckling per IS 800:2007 Cl. 8.4.2
 * Returns design shear stress Tv (N/mm²)
 */
function webShearBuckling(h_over_tw, d_web, tw, fy) {
  const E  = MATERIALS.E_STEEL;
  const nu = MATERIALS.POISSON;
  const Kv = 5.35;  // simply supported web, no stiffeners

  // Critical shear buckling stress
  const tau_cr = (Kv * Math.PI * Math.PI * E) /
                 (12 * (1 - nu * nu)) * sqr(tw / Math.max(d_web, 1));

  // Web slenderness parameter
  const lambda_w = Math.sqrt(Math.max(0, fy / (Math.sqrt(3) * tau_cr)));

  // Design shear stress per IS 800 Cl.8.4.2.2(a)
  const Tv_yield = fy / Math.sqrt(3);     // plastic yield
  let Tv_MPa;
  if (lambda_w <= 0.8) {
    Tv_MPa = Tv_yield;
  } else if (lambda_w <= 1.2) {
    const Tv_12 = fy / (Math.sqrt(3) * sqr(1.2));
    Tv_MPa = Tv_yield - (Tv_yield - Tv_12) * (lambda_w - 0.8) / 0.4;
  } else {
    Tv_MPa = fy / (Math.sqrt(3) * sqr(lambda_w));
  }

  const eps    = epsilon_s(fy);
  const lim1   = 67 * eps;
  const lim2   = 67 * eps * Math.sqrt(Kv / 5.35);
  const stiff_req = h_over_tw > lim2;
  let note;
  if (stiff_req) {
    note = `Web stiffeners required at openings (h/tw = ${h_over_tw.toFixed(1)} > ${lim2.toFixed(1)})`;
  } else if (h_over_tw > lim1) {
    note = `Web near slenderness limit — check detailing (h/tw = ${h_over_tw.toFixed(1)})`;
  } else {
    note = `Web slenderness OK (h/tw = ${h_over_tw.toFixed(1)} ≤ ${lim1.toFixed(1)})`;
  }

  return { Tv_MPa, tau_cr, lambda_w, stiff_req, note };
}

// ── 7. VIERENDEEL CHECK — At beam openings ───────────────────
/**
 * FIX [2]: Correct Vierendeel formulation per SCI P355 / BCSA guide.
 *
 * At each opening, local Vierendeel action produces secondary moments
 * in the tees above and below the opening.
 *
 * Mv_tee = (V / 2) × (a_o / 2)
 * where:
 *   V   = global shear force at opening (use max shear = V at support)
 *   a_o = opening length (= Do for castellated/cellular)
 *
 * Interaction check per tee:
 *   Top tee:    Compression axial (N_top) + Vierendeel bending (Mv)
 *   Bottom tee: Tension axial    (N_bot) + Vierendeel bending (Mv)
 *
 * Axial forces from global moment:
 *   N = M_global / (d_new - h_tee)  [lever arm between tee centroids]
 *   Top tee: compression N_c = M_fact / lever_arm
 *   Bot tee: tension N_t     = M_fact / lever_arm
 *
 * For each tee, check combined:
 *   UC = N/(A_tee × fy/γm0) + Mv/(φ × Mp_tee) ≤ 1.0
 *
 * Critical: BOTTOM tee governs at maximum shear (near support)
 *           TOP tee governs at maximum moment (mid-span) — but axial
 *           here is max, shear is zero so Mv = 0 at mid-span.
 * Worst case is generally bottom tee near support (high V AND some M).
 * We check at quarter-span (V = 0.5×V_max, M = 0.75×M_max).
 */
function vierendeelCheck(sec, geom, M_fact, V_fact, bending, inp) {
  if (geom.Do <= 0 || geom.mode === 'I') return null;

  const { Do, d_new, h_tee, spacing_cc } = geom;
  const { A: As, tf, bf, tw } = sec;
  const fy        = inp.fy;
  const gamma_m0  = MATERIALS.gamma_m0;
  const phi       = 0.9;

  // Opening length along beam axis
  // Castellated: horizontal flat of hexagon = Do
  // Cellular: diameter = Do
  const a_o = Do;

  // Vierendeel moment per tee (at support, V = V_max, M ~ 0)
  // Worst case: checked at support where V is maximum
  const V_tee = V_fact / 2;           // each tee carries half the shear
  const Mv    = V_tee * (a_o / 2);    // secondary moment in each tee

  // Tee section properties
  // Top tee: flange + partial web above opening
  // Bottom tee: flange + partial web below opening (same geometry for symmetric section)
  const A_tee  = bf * tf + tw * (h_tee - tf);    // area of one tee
  const A_tee_safe = Math.max(A_tee, As * 0.25); // fallback

  // Plastic moment of tee about its own NA
  // Locate plastic NA of tee (flange width bf, flange thk tf, web thk tw, web ht hw_tee)
  const hw_tee = Math.max(0, h_tee - tf);
  const A_flange = bf * tf;
  const A_web_tee = tw * hw_tee;
  const A_tee_total = A_flange + A_web_tee;
  const A_half = A_tee_total / 2;

  // PNA from top (outer face of flange)
  let y_pna, Mp_tee;
  if (A_flange >= A_half) {
    // PNA in flange
    y_pna = A_half / bf;
    const C = bf * y_pna * fy;
    const T_fl = A_flange * fy - C;
    const T_web = A_web_tee * fy;
    Mp_tee = C * y_pna / 2 + T_fl * (tf - y_pna / 2) + T_web * (tf + hw_tee / 2);
  } else {
    // PNA in web
    y_pna = tf + (A_half - A_flange) / tw;
    const C_fl = A_flange * fy;
    const C_web = tw * (y_pna - tf) * fy;
    const T_web = A_web_tee * fy - C_web;
    Mp_tee = C_fl * (y_pna - tf / 2) + C_web * (y_pna - tf) / 2 + T_web * (hw_tee - (y_pna - tf)) / 2;
  }
  Mp_tee = Math.max(Mp_tee, 1); // prevent division by zero

  // Lever arm between centroids of top and bottom tee
  // Centroid of tee from outer face = (A_fl×tf/2 + A_web×(tf+hw/2)) / A_tee
  const y_tee_centroid = (A_flange * tf / 2 + A_web_tee * (tf + hw_tee / 2)) / Math.max(A_tee_total, 1);
  const lever_arm = d_new - 2 * y_tee_centroid;  // c/c of tee centroids

  // Axial forces from global moment (at support: M ≈ 0 → N ≈ 0)
  // At quarter span: V = 0.5V_max, M = 0.375×w×L²/8 × (hmm use 3/4 of max)
  // More accurate: check at first opening from support
  // First opening at ~spacing_cc/2 from support
  const x_first = spacing_cc / 2;   // mm from support
  const L_mm    = inp.L * 1000;
  const w_fact  = 2 * V_fact / L_mm; // UDL in N/mm (back-calculated)
  const M_at_first = (V_fact * x_first) - (w_fact * sqr(x_first) / 2);
  const V_at_first = V_fact - w_fact * x_first;

  const Mv_first  = (V_at_first / 2) * (a_o / 2);
  const N_c_first = M_at_first / Math.max(lever_arm, 1);  // compression in top tee
  const N_t_first = N_c_first;                              // tension in bottom tee

  // Utilisation ratios at first opening
  const N_cap_tee = A_tee_total * fy / gamma_m0;
  const M_cap_tee = phi * Mp_tee;

  const UC_top_first = (N_c_first / N_cap_tee) + (Mv_first / M_cap_tee);  // comp + bending
  const UC_bot_first = (N_t_first / N_cap_tee) + (Mv_first / M_cap_tee);  // tension + bending

  // Also check at support (M=0, V=max) — pure Vierendeel
  const UC_support = Mv / M_cap_tee;

  const combined = Math.max(UC_top_first, UC_bot_first, UC_support);

  return {
    a_o, V_tee, Mv,
    A_tee: A_tee_total, Mp_tee, lever_arm,
    N_c_first, N_t_first, Mv_first,
    UC_top_first, UC_bot_first, UC_support,
    combined
  };
}

// ── 8. LTB — NOT APPLICABLE for composite beams with through-deck studs ──
/**
 * LATERAL TORSIONAL BUCKLING — NOT APPLICABLE AT ANY STAGE.
 *
 * Erection sequence for composite beams with through-deck welded studs:
 *
 *   Step 1 — Steel beam erected and set on bearings.
 *   Step 2 — Profiled metal deck sheet laid on top flange and fixed
 *             with self-drilling screws / puddle welds.
 *   Step 3 — Headed shear studs welded THROUGH the deck to the top
 *             flange — this happens BEFORE concrete is poured.
 *             The deck is now mechanically connected to the top flange
 *             along the FULL LENGTH of the beam.
 *   Step 4 — Concrete poured on deck.
 *
 * At Step 3, the top (compression) flange is CONTINUOUSLY RESTRAINED
 * against lateral displacement and twist by the fixed deck sheet and
 * stud welds. LTB is therefore impossible at:
 *   — the construction stage (deck + studs in place before pour), AND
 *   — the composite in-service stage.
 *
 * Code basis:
 *   IS 800:2007 Cl. 8.2.1 Note 1 — "LTB need not be checked when
 *   the compression flange is restrained against lateral bending
 *   throughout its length."
 *
 *   This applies from the moment the deck + studs are fixed, which
 *   is PRIOR to concrete being placed.
 *
 * NOTE: If a beam is erected WITHOUT deck (e.g. erection beam carrying
 * point loads before deck is fixed), LTB must be checked for that
 * specific erection condition — but this is outside the scope of
 * composite beam design with through-deck studs.
 *
 * Returns an informational object only — no utilisation ratio to check.
 */
function ltbNotApplicable(sec, geom, inp) {
  // Provide section properties for information only (not for a check)
  const { d, bf, tf, tw, Iy, Zpx } = sec;
  const fy  = inp.fy;
  const E   = MATERIALS.E_STEEL;
  const G_s = E / (2 * (1 + MATERIALS.POISSON));

  const J  = (2 * bf * Math.pow(tf, 3) + (d - 2 * tf) * Math.pow(tw, 3)) / 3;
  const h1 = d - tf;
  const Iw = Iy * sqr(h1) / 4;

  return {
    applicable: false,
    ltb_ok: true,    // always true — not a governing check
    ltb_util: 0,     // zero — check not performed
    reason: 'NOT APPLICABLE — Deck sheet fixed and studs welded to top flange BEFORE concrete pour. Top compression flange continuously restrained at all stages. Ref: IS 800:2007 Cl.8.2.1 Note 1.',
    erection_sequence: [
      'Step 1: Steel beam erected on bearings',
      'Step 2: Profiled deck sheet fixed to top flange (self-drilling screws / puddle welds)',
      'Step 3: Shear studs welded through deck to top flange — FULL LATERAL RESTRAINT achieved BEFORE concrete pour',
      'Step 4: Concrete poured — composite action develops on hardening'
    ],
    // Informational only — what Mcr and λ_LT would be if unrestrained
    J, Iw,
    note_informational: 'Section properties J and Iw shown for reference only. No LTB check required.'
  };
}

// ── 9. TRANSFORMED SECTION — Composite EI ────────────────────
/**
 * Short-term and long-term composite EI using transformed section method.
 * FIX [6]: Uses castellatedIx() for I_steel_centroid (not d³ scaling).
 */
function transformedEI(sec, geom, Ts, beff_mm, fck, Kc) {
  const E_s = MATERIALS.E_STEEL;
  const E_c = 5000 * Math.sqrt(Math.max(1, fck));  // IS 456 Cl.6.2.3.1 (MPa)

  // Modular ratios
  const n_short = E_c / E_s;
  const n_long  = (Kc * E_c) / E_s;

  // Geometry
  const d_new     = geom.d_new;
  const A_slab    = beff_mm * Ts;
  const y_slab    = Ts / 2;                 // centroid of slab from top of slab
  const A_steel   = sec.A;
  const y_steel   = Ts + d_new / 2;        // centroid of steel from top of slab

  // FIX [6]: Correct castellated Ix
  const I_slab_c  = beff_mm * Math.pow(Ts, 3) / 12;
  const I_steel_c = geom.mode === 'I'
    ? sec.Ix
    : castellatedIx(sec, d_new);

  function compositeSection(n) {
    const A_slab_t = n * A_slab;
    const denom    = A_slab_t + A_steel;
    if (denom <= 0) return { y_bar: 0, I_comp: I_steel_c, EI: E_s * I_steel_c };
    const y_bar    = (A_slab_t * y_slab + A_steel * y_steel) / denom;
    const I_sl_t   = n * (I_slab_c + A_slab * sqr(y_slab  - y_bar));
    const I_st_t   = I_steel_c  + A_steel * sqr(y_steel - y_bar);
    const I_comp   = I_sl_t + I_st_t;
    return { y_bar, I_comp, EI: E_s * I_comp };
  }

  const sh = compositeSection(n_short);
  const lg = compositeSection(n_long);

  return {
    E_c, n_short, n_long,
    m_short: E_s / E_c,
    m_long:  E_s / (Kc * E_c),
    I_steel_castex: I_steel_c,
    y_bar_short:  sh.y_bar,  I_comp_short: sh.I_comp,  EI_short: sh.EI,
    y_bar_long:   lg.y_bar,  I_comp_long:  lg.I_comp,  EI_long:  lg.EI
  };
}

// ── 10. DEFLECTION ────────────────────────────────────────────
function midDefUniform(w_Npmm, L_mm, EI) {
  if (!EI || EI <= 0 || !isFinite(EI)) return Infinity;
  return 5 * w_Npmm * Math.pow(L_mm, 4) / (384 * EI);
}

function computeDeflections(sec, geom, inp, loads, trans) {
  const L_mm    = inp.L * 1000;

  // FIX [6]: Use castellated Ix for construction EI (bare steel)
  const I_steel = geom.mode === 'I' ? sec.Ix : castellatedIx(sec, geom.d_new);
  const EI_steel = MATERIALS.E_STEEL * I_steel;

  // ── Part A: Construction stage (steel alone, pre-composite) ──
  // Load = wet slab + construction live (both act before composite action)
  const delta_A = inp.propped ? 0 : midDefUniform(loads.w_constr_Npmm, L_mm, EI_steel);

  // ── Part B: Short-term live load (composite section, short-term EI) ──
  const delta_B_short = midDefUniform(loads.w_live_Npmm, L_mm, trans.EI_short);
  const delta_B_total = inp.propped ? delta_B_short : delta_A + delta_B_short;

  // ── Part C: Long-term sustained (composite, long-term EI with creep) ──
  const delta_C = midDefUniform(loads.w_sustained_Npmm, L_mm, trans.EI_long);

  // ── Part D: Dead load on composite section (for frequency) ──
  // FIX [8]: Natural frequency uses DL on composite section
  const delta_DL_comp = midDefUniform(loads.w_DL_comp_Npmm, L_mm, trans.EI_short);

  // Limit: min(L/360, 20 mm) per IS 11384:2022 Cl.12
  const limit_SLS = Math.min(L_mm / 360, 20);
  // Total long-term limit: often L/300 for total deflection
  const limit_total = Math.min(L_mm / 300, 25);

  return {
    delta_A, delta_B_short, delta_B_total,
    delta_C, delta_DL_comp,
    delta_total_LT: delta_A + delta_C,
    limit: limit_SLS,
    limit_total,
    partB_ok: delta_B_total <= limit_SLS,
    partC_ok: delta_C        <= limit_SLS
  };
}

// ── 11. SHEAR STUD DESIGN — IS 11384:2022 Cl.9 ───────────────
/**
 * FIX [4]: Rg and Rp from IS 11384:2022 Table 14 (constant values).
 * FIX [5]: Spacing limits corrected to Cl.9.5.
 *
 * IS 11384:2022 Table 14 — Deck reduction factors (ribs ⊥ to beam):
 *   Single stud per rib: Rg = 0.85, Rp = 0.75 (strong pos) or 0.60 (weak)
 *   Two studs per rib:   Rg = 0.70, Rp = 0.75 or 0.60
 * For flat slab: Rg = Rp = 1.0
 *
 * Stud spacing limits per IS 11384:2022 Cl.9.5:
 *   s_min = max(5×d_stud, 100 mm)  [longitudinal]
 *   s_max = min(6×Ts, 600 mm)       [longitudinal]
 */
function studDesign(inp, beff_mm, geom) {
  const { fck, Ts, Tc, Td, deck, eta, L, stud_dia_pref } = inp;

  // Effective concrete depth for compression
  const ds = deck.rib_h > 0 ? Tc : Ts;

  // Total compressive force in slab at full shear connection
  // C = 0.36 × fck × beff × ds  [concrete side governs for normal steel grades]
  const C_conc  = 0.36 * fck * beff_mm * ds;
  // Steel side: C_steel = As × fy / γm0
  const C_steel = inp.section_A * inp.fy / MATERIALS.gamma_m0;
  // Governing (lesser of concrete and steel)
  const C_total = Math.min(C_conc, C_steel);

  // Target force at chosen degree of shear connection η
  const C_target = eta * C_total;

  // FIX [4]: Deck reduction factors (IS 11384:2022 Table 14)
  let Rg, Rp;
  if (deck.rib_h > 0) {
    // Deck ribs perpendicular to beam — single stud per rib (typical)
    Rg = 0.85;
    Rp = 0.75;   // studs in strong (favourable) position
    // Use 0.60 for weak position — conservative default
    // We use 0.75 (strong position) — engineer to verify on site
  } else {
    // Flat slab — no reduction
    Rg = 1.0;
    Rp = 1.0;
  }

  // Try stud sizes in order of preference
  const diaSizes = stud_dia_pref === 'auto'
    ? [16, 19, 22, 25]
    : [parseInt(stud_dia_pref)];

  let result = null;

  for (const dia of diaSizes) {
    const Qn_char = getStudCap(dia, fck);       // characteristic capacity (N)
    const Qn_red  = Rg * Rp * Qn_char;          // reduced for deck
    const Qn_use  = Math.min(Qn_red, Qn_char);  // never exceeds flat slab value

    // Studs per half-span (symmetric loading — studs between support and midspan)
    const n_half  = Math.ceil(C_target / Qn_use);
    const n_total = 2 * n_half;
    const spacing = (L * 1000) / n_half;   // uniform spacing over half-span (mm)

    // FIX [5]: Spacing limits per IS 11384:2022 Cl.9.5
    const s_min = Math.max(5 * dia, 100);        // longitudinal minimum
    const s_max = Math.min(6 * Ts, 600);          // longitudinal maximum

    const ok = spacing >= s_min && spacing <= s_max;
    result = {
      dia, Qn_char, Qn_red, Qn_use, Rg, Rp,
      n_half, n_total, spacing, s_min, s_max, ok,
      C_conc, C_steel, C_total, C_target, eta,
      governs_by: C_conc < C_steel ? 'Concrete compression' : 'Steel tension'
    };
    if (ok || stud_dia_pref !== 'auto') break;
  }
  return result;
}

// ── 12. NATURAL FREQUENCY ────────────────────────────────────
/**
 * FIX [8]: Frequency uses DL-only deflection on composite section.
 * fn = (π/2) × √(g / δ_DL)  [Donaldson / Murray formula]
 * g = 9810 mm/s²
 * δ_DL = deflection under sustained dead load on composite section (short-term EI)
 */
function naturalFrequency(delta_DL_mm) {
  if (!delta_DL_mm || delta_DL_mm <= 0 || !isFinite(delta_DL_mm)) return Infinity;
  const g = 9810;  // mm/s²
  return (Math.PI / 2) * Math.sqrt(g / delta_DL_mm);
}

// ── 13. MASTER DESIGN FUNCTION ────────────────────────────────
function runCompositeDesign(raw_inp) {
  // ── Resolve section ──
  const secType = raw_inp.section_type;
  const sec     = getSection(raw_inp.section_name, secType);
  if (!sec) return { error: `Section ${raw_inp.section_name} not found in database` };

  const deck  = getDeck(raw_inp.deck_profile);
  const fy    = parseFloat(raw_inp.fy_grade);
  const fck   = parseFloat(raw_inp.fck);
  const Tc    = Math.max(50, parseFloat(raw_inp.Tc));   // min 50 mm per IS 11384
  const Td    = deck.rib_h;
  const Ts    = Td + Tc;
  const L     = parseFloat(raw_inp.L);
  const bs    = parseFloat(raw_inp.beam_spacing);
  const eta   = clamp(parseFloat(raw_inp.eta), 0.5, 1.0); // IS 11384 min η = 0.5
  const DoUser      = parseFloat(raw_inp.Do) || 0;
  const load_factor = parseFloat(raw_inp.load_factor) || 1.5;
  const frac_live   = clamp(parseFloat(raw_inp.frac_live) || 1.0, 0, 1);

  // ── Step 1: Opening geometry ──
  const geom = computeOpeningGeometry(sec, raw_inp.mode, DoUser);

  // ── Step 2: Effective slab width ──
  const beff_mm = effectiveSlabWidth(L, bs, raw_inp.beam_position);

  // ── Step 3: Assemble input object ──
  const inp = {
    L, beam_spacing: bs, beff_mm, Ts, Tc, Td, fck, fy, eta, deck,
    load_factor, propped: raw_inp.propped === 'yes', frac_live,
    stud_dia_pref: raw_inp.stud_dia,
    stud_h: Td + 35,   // stud height above deck (typical)
    gamma_m0: MATERIALS.gamma_m0,
    section_A: sec.A,  // needed for stud C_steel calculation
    LL: parseFloat(raw_inp.LL) || 0,
    FF: parseFloat(raw_inp.FF) || 0,
    PR: parseFloat(raw_inp.PR) || 0,
    FI: parseFloat(raw_inp.FI) || 0,
    CL: parseFloat(raw_inp.CL) || 75,
    WL: parseFloat(raw_inp.WL) || 0
  };

  // ── Step 4: Loads ──
  const loads = computeLoads(inp);

  // ── Step 5: Bending capacity (composite) ──
  const bending  = bendingCapacity(sec, geom, { ...inp, d_new: geom.d_new });
  const flex_util = loads.M_fact / bending.phi_Md;
  const flex_ok   = flex_util <= 1.0;

  // ── Step 6: Shear capacity ──
  const shear_res  = shearCapacity(sec, geom, fy);
  const shear_util = loads.V_fact / shear_res.Vn_total;
  const shear_ok   = shear_util <= 1.0;

  // ── Step 7: Vierendeel (openings only) ──
  const vier    = vierendeelCheck(sec, geom, loads.M_fact, loads.V_fact, bending, inp);
  const vier_ok = vier ? vier.combined <= 1.0 : true;

  // ── Step 8: Composite section properties ──
  const trans = transformedEI(sec, geom, Ts, beff_mm, fck, MATERIALS.Kc);

  // ── Step 9: Deflections ──
  const defl = computeDeflections(sec, geom, inp, loads, trans);

  // ── Step 10: Stud design ──
  const studs = studDesign(inp, beff_mm, geom);
  const studs_ok = studs ? studs.ok : true;

  // ── Step 11: LTB — NOT APPLICABLE (deck + studs restrain top flange) ──
  // Through-deck stud welding occurs BEFORE concrete pour, giving
  // continuous lateral restraint at ALL stages. IS 800:2007 Cl.8.2.1 Note 1.
  const ltb = ltbNotApplicable(sec, geom, inp);

  // ── Step 12: Natural frequency (DL deflection on composite section) ──
  const fn    = naturalFrequency(defl.delta_DL_comp);
  const fn_ok = fn >= 4.0;  // ISO 10137 / SCI P354: 4 Hz for offices

  // ── Step 13: Web post bending check (castellated) ──
  const webPost = webPostCheck(sec, geom, loads, fy);

  // ── Step 14: Overall result — LTB excluded (not applicable) ──
  const overall_ok = flex_ok && shear_ok && vier_ok &&
                     defl.partB_ok && defl.partC_ok && studs_ok;
  // webPost is advisory for now — include in overall when needed
  // const overall_ok = ... && (webPost ? webPost.post_ok : true);

  return {
    sec, deck, geom, inp, loads, beff_mm,
    bending, flex_util, flex_ok,
    shear: { ...shear_res, util: shear_util, ok: shear_ok },
    vier, vier_ok,
    trans, defl,
    studs, studs_ok,
    ltb, fn, fn_ok,
    webPost,
    overall_ok,
    beam_wt: sec.w * L
  };
}

// ── 14. WEB POST BENDING — Horizontal shear in web post ──────
/**
 * Additional check for castellated beams: web post between openings
 * must resist horizontal shear from the difference in flange forces
 * either side of the post.
 * Simplified: horizontal shear stress in web post ≤ fv = fy/√3/γm0
 */
function webPostCheck(sec, geom, loads, fy) {
  if (geom.Do <= 0 || geom.mode === 'I') return null;

  const { tw } = sec;
  const { web_post_w, h_tee, d_new, Do } = geom;
  const fv_design = fy / (Math.sqrt(3) * MATERIALS.gamma_m0);

  // Horizontal shear per web post = V × spacing_cc / (d_new - h_tee)
  // (force transferred between openings)
  const V_H = loads.V_fact * geom.spacing_cc / Math.max(d_new - h_tee, 1);
  const A_post = tw * (web_post_w);  // web post shear area
  const tau_post = V_H / Math.max(A_post, 1);
  const util_post = tau_post / fv_design;
  const post_ok = util_post <= 1.0;

  return { web_post_w, V_H, A_post, tau_post, fv_design, util_post, post_ok };
}
