/**
 * Retaining Wall Design Engine
 * IS 456 : 2000 | Rankine Earth Pressure Theory
 * Integrated Building Services (IBS)
 */

class RetainingWallEngine {
  constructor(p) {
    this.fck    = p.fck;
    this.fy     = p.fy;
    this.cover  = p.cover || 50;   // mm — retaining wall cover (severe exposure)
    this.Lf     = 1.5;
    this.Ec     = 5000 * Math.sqrt(p.fck);
    this.b      = 1000;            // per metre run

    // Soil
    this.gamma  = p.gamma;         // kg/m³
    this.phi    = p.phi * Math.PI / 180;  // radians
    this.c      = p.c || 0;        // kN/m² cohesion
    this.mu     = p.mu;            // base friction coefficient
    this.q_sur  = p.surcharge || 0; // kN/m² surcharge

    // Wall dimensions
    this.H      = p.H;             // total retained height (m)
    this.sbc    = p.sbc;           // safe bearing capacity kN/m²

    // Compute Rankine Ka
    this.Ka = Math.pow(Math.tan(Math.PI/4 - this.phi/2), 2);
    this.Kp = Math.pow(Math.tan(Math.PI/4 + this.phi/2), 2);

    // Concrete unit weight
    this.gamma_c = 25;   // kN/m³
    this.gamma_s  = this.gamma * 9.81 / 1000; // kN/m³
  }

  /** Auto-proportion wall dimensions from H */
  autoDimensions() {
    const H = this.H;
    return {
      stem_top:    Math.max(0.20, H * 0.07),     // m
      stem_bot:    Math.max(0.30, H * 0.10),     // m
      base_thick:  Math.max(0.30, H * 0.10),     // m
      base_width:  Math.max(0.6*H, Math.min(0.7*H, 0.65*H)), // m
      toe_length:  Math.max(0.3, H * 0.10),      // m
      // heel = base_width - toe - stem_bot
    };
  }

  /** Rankine active earth pressure */
  earthPressure(dims) {
    const { base_thick: Bt, base_width: B, toe_length: Lt, stem_bot } = dims;
    const Hs = this.H;                           // retained soil height above base top
    const H_total = Hs + Bt;                     // total wall height incl. base

    const gamma_s = this.gamma_s;
    const Ka      = this.Ka;
    const q       = this.q_sur;

    // Active earth pressure at base of stem (kN/m²)
    const pa_bot  = Ka * (gamma_s * Hs + q);
    const pa_top  = Ka * q;

    // Total horizontal force per m run (kN/m)
    const Ph_soil = 0.5 * Ka * gamma_s * Hs * Hs;
    const Ph_sur  = Ka * q * Hs;
    const Ph_total= Ph_soil + Ph_sur;

    // Height of resultant from base of wall
    const y_soil  = Hs / 3;
    const y_sur   = Hs / 2;
    const M_ot    = Ph_soil * y_soil + Ph_sur * y_sur;  // overturning moment kN·m/m

    return { pa_bot, pa_top, Ph_soil, Ph_sur, Ph_total, M_ot, y_soil, y_sur };
  }

  /** Self weights and resisting moment */
  stabilityAnalysis(dims) {
    const { stem_top, stem_bot, base_thick: Bt, base_width: B, toe_length: Lt } = dims;
    const heel_length = B - Lt - stem_bot;
    const Hs = this.H;

    const gamma_c = this.gamma_c;
    const gamma_s = this.gamma_s;
    const q       = this.q_sur;

    // Component weights (kN/m)
    const W_base = gamma_c * B * Bt;
    const W_stem = gamma_c * 0.5 * (stem_top + stem_bot) * Hs;
    const W_soil_heel = gamma_s * heel_length * Hs;
    const W_sur  = q * heel_length;

    const W_total = W_base + W_stem + W_soil_heel + W_sur;

    // Moment arms from toe (m)
    const x_base = B / 2;
    const x_stem = Lt + stem_bot / 2;
    const x_soil_heel = Lt + stem_bot + heel_length / 2;
    const x_sur  = x_soil_heel;

    // Resisting moment about toe
    const MR = W_base * x_base + W_stem * x_stem + W_soil_heel * x_soil_heel + W_sur * x_sur;

    // Earth pressure forces
    const ep = this.earthPressure(dims);
    const { Ph_total, M_ot } = ep;

    // ── Stability Checks ──
    // Overturning
    const FOS_OT = MR / M_ot;

    // Sliding
    const Fr = this.mu * W_total;   // friction force
    const Pp = 0.5 * this.Kp * gamma_s * Bt * Bt; // passive resistance at toe
    const FOS_SL = (Fr + Pp) / Ph_total;

    // Base pressure
    const e_dist = B / 2 - (MR - M_ot) / W_total;  // eccentricity
    const e      = Math.abs(B / 2 - (MR - M_ot) / W_total);
    const p_max  = (W_total / B) * (1 + 6 * e / B);
    const p_min  = (W_total / B) * (1 - 6 * e / B);
    const FOS_BP = this.sbc / p_max;

    return {
      dims, heel_length,
      W_base, W_stem, W_soil_heel, W_sur, W_total,
      MR, ep,
      FOS_OT,  OT_pass:  FOS_OT  >= RW_FOS.overturning,
      FOS_SL,  SL_pass:  FOS_SL  >= RW_FOS.sliding,
      p_max, p_min, e, FOS_BP,
      BP_pass: p_max <= this.sbc,
    };
  }

  /** Stem design — cantilever fixed at base */
  stemDesign(dims, ep) {
    const Hs   = this.H;
    const { pa_bot, Ph_soil, Ph_sur, M_ot } = ep;

    // Design moment at base of stem (factored)
    const Mu   = this.Lf * M_ot;  // kN·m/m
    const Mu_Nmm = Mu * 1e6;

    const D  = dims.stem_bot * 1000;   // mm
    const d  = D - this.cover - 8;    // effective depth (mm)

    const fck = this.fck, fy = this.fy;
    const numerator   = 4.6 * Mu_Nmm;
    const denominator = fck * this.b * d * d;
    const term        = Math.max(1 - numerator / denominator, 0);
    const Ast_req     = Math.max(
      0.5 * (fck / fy) * (1 - Math.sqrt(term)) * this.b * d,
      0.12 / 100 * this.b * D
    );

    const bar = this._pickBar(Ast_req);

    // Shear at base
    const Vu   = this.Lf * (Ph_soil + Ph_sur);  // kN/m
    const tau_v= (Vu * 1000) / (this.b * d);     // MPa
    const tau_c= 0.36;                            // conservative

    return {
      Mu: Mu.toFixed(2), d: d.toFixed(0),
      Ast_req: Ast_req.toFixed(1),
      bar,
      Vu: Vu.toFixed(2),
      tau_v: tau_v.toFixed(3),
      tau_c: tau_c.toFixed(3),
      shear_pass: tau_v <= tau_c,
    };
  }

  /** Heel slab design */
  heelDesign(stab) {
    const { W_soil_heel, W_sur, p_min, ep, heel_length } = stab;
    const L = heel_length;

    // Net upward pressure on heel — soil weight dominates downward
    const net_down = (W_soil_heel / L + W_sur / L) - p_min;
    const Mu = this.Lf * net_down * L * L / 2;  // kN·m/m
    const Mu_Nmm = Mu * 1e6;

    const D = stab.dims.base_thick * 1000;
    const d = D - this.cover - 8;

    const fck = this.fck, fy = this.fy;
    const numerator   = 4.6 * Mu_Nmm;
    const denominator = fck * this.b * d * d;
    const term        = Math.max(1 - numerator / denominator, 0);
    const Ast_req     = Math.max(
      0.5 * (fck / fy) * (1 - Math.sqrt(term)) * this.b * d,
      0.12 / 100 * this.b * D
    );

    return {
      Mu: Math.abs(Mu).toFixed(2),
      Ast_req: Ast_req.toFixed(1),
      bar: this._pickBar(Ast_req),
    };
  }

  /** Toe slab design */
  toeDesign(stab) {
    const { p_max, ep } = stab;
    const L  = stab.dims.toe_length;
    const Mu = this.Lf * p_max * L * L / 2;
    const Mu_Nmm = Mu * 1e6;

    const D = stab.dims.base_thick * 1000;
    const d = D - this.cover - 8;

    const fck = this.fck, fy = this.fy;
    const numerator   = 4.6 * Mu_Nmm;
    const denominator = fck * this.b * d * d;
    const term        = Math.max(1 - numerator / denominator, 0);
    const Ast_req     = Math.max(
      0.5 * (fck / fy) * (1 - Math.sqrt(term)) * this.b * d,
      0.12 / 100 * this.b * D
    );

    return {
      Mu: Mu.toFixed(2),
      Ast_req: Ast_req.toFixed(1),
      bar: this._pickBar(Ast_req),
    };
  }

  /** Pick bar diameter and spacing */
  _pickBar(Ast_req) {
    const diameters = [10, 12, 16, 20, 25];
    for (const dia of diameters) {
      const adb = Math.PI * dia * dia / 4;
      const s   = (1000 * adb) / Ast_req;
      if (s >= 100 && s <= 200) {
        return { dia, spacing: Math.floor(s / 10) * 10, Ast_prov: (1000 * adb) / (Math.floor(s/10)*10) };
      }
    }
    const dia = 16;
    const adb = Math.PI * dia * dia / 4;
    const s   = Math.max(100, Math.floor((1000 * adb / Ast_req) / 10) * 10);
    return { dia, spacing: s, Ast_prov: (1000 * adb) / s };
  }

  /** Full design run */
  design(customDims) {
    const dims = customDims || this.autoDimensions();
    dims.heel_length = dims.base_width - dims.toe_length - dims.stem_bot;

    const stab  = this.stabilityAnalysis(dims);
    const stem  = this.stemDesign(dims, stab.ep);
    const heel  = this.heelDesign(stab);
    const toe   = this.toeDesign(stab);

    const overallPass = stab.OT_pass && stab.SL_pass && stab.BP_pass;

    return { dims, stab, stem, heel, toe, overallPass };
  }
}
