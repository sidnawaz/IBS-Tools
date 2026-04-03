/**
 * IBS Slab Design Engine — IS 456 : 2000 / IS 875
 * Integrated Building Services
 */

class SlabDesignEngine {
  constructor(params) {
    this.fck = params.fck;         // MPa
    this.fy  = params.fy;          // MPa
    this.c   = params.cover;       // mm clear cover
    this.Lf  = params.Lf || 1.5;  // load factor
    this.Ec  = 5000 * Math.sqrt(this.fck); // MPa
    this.b   = 1000; // per metre strip
    this.Db  = [8, 10, 12, 16, 20]; // available bar diameters
    this.delta_ratio = params.delta_ratio || 350;
    this.delta_max   = params.delta_max   || 20;
    this.min_t       = params.min_thickness || 120;
  }

  /** Effective depth given thickness and bar dia */
  effDepth(thickness, db) {
    return thickness - this.c - 1.5 * db;
  }

  /** Self weight of slab kg/m² */
  selfWeight(thickness) {
    return (thickness / 1000) * 2500;
  }

  /** Total factored load kg/m² */
  totalLoad(thickness, ll, finishL, extraLoads) {
    let extra = 0;
    if (extraLoads) {
      extra = extraLoads.reduce((s, x) => s + x.load, 0);
    }
    return ll + finishL + extra + this.selfWeight(thickness);
  }

  /** Deflection in mm (simplified elastic) */
  deflection(thickness, db, Lx_m, totalLoad_kgm2) {
    const W  = totalLoad_kgm2 * 9.81 / 1000; // N/mm per m width
    const d  = this.effDepth(thickness, db);
    const I  = (this.b * Math.pow(d, 3)) / 12;
    const Lx = Lx_m * 1000; // mm
    return (5 * W * Lx * Math.pow(Lx, 3)) / (384 * this.Ec * I);
  }

  /** Bending moments Mx, My using IS 456 coefficient method */
  bendingMoments(thickness, Lx_m, Ly_m, totalLoad_kgm2) {
    // kN/m² (convert kg to kN)
    const W = (totalLoad_kgm2 * 9.81) / (1000 * 10000); // t/m²
    const ratio = Math.pow(Ly_m / Lx_m, 4);
    const mx_coeff = ratio / (1 + ratio);
    const my_coeff = 1 - mx_coeff;
    const Mx = this.Lf * (1/8) * mx_coeff * W * Math.pow(Lx_m, 2); // t·m
    const My = this.Lf * (1/8) * my_coeff * W * Math.pow(Ly_m, 2);
    return { Mx, My };
  }

  /** Required Ast mm²/m */
  requiredAst(M_tm, thickness, db) {
    const M_Nmm = M_tm * 1e7;
    const d = this.effDepth(thickness, db);
    const numerator   = 4.6 * M_Nmm;
    const denominator = this.fck * this.b * Math.pow(d, 2);
    const term = Math.max(1 - (numerator / denominator), 0);
    const ast_flex = 0.5 * (this.fck / this.fy) * (1 - Math.sqrt(term)) * this.b * d;
    const ast_min  = (0.12 / 100) * this.b * thickness;
    return Math.max(ast_flex, ast_min, 0);
  }

  /** Bar spacing selection */
  barSpacing(Ast_req) {
    for (const dia of [...this.Db].sort((a,b)=>a-b)) {
      const adb = Math.PI * Math.pow(dia, 2) / 4;
      const s   = (1000 * adb) / Ast_req;
      if (s >= 100 && s <= 300) {
        return { dia, spacing: Math.floor(s / 10) * 10, Ast_prov: (1000 * adb) / (Math.floor(s/10)*10) };
      }
    }
    // fallback: smallest bar at 300
    const dia = this.Db[0];
    const adb = Math.PI * Math.pow(dia, 2) / 4;
    return { dia, spacing: 300, Ast_prov: (1000 * adb) / 300 };
  }

  /** Shear check (IS 456 Cl. 40) */
  shearCheck(thickness, Lx_m, totalLoad_kgm2) {
    const d   = this.effDepth(thickness, this.Db[1]);
    const Vu  = (totalLoad_kgm2 * 9.81 / 1000) * (Lx_m * 1000 / 2); // N/m
    const τv  = Vu / (this.b * d);
    // IS 456 Table 19 — τc for Ast/bd = 0.5%, fck=20
    const τc  = 0.36; // MPa (conservative for slabs)
    return {
      Vu: (Vu / 1000).toFixed(2),
      τv: τv.toFixed(3),
      τc: τc.toFixed(3),
      pass: τv <= τc,
    };
  }

  /** Iterate thickness for deflection control */
  findThickness(Lx_m, Ly_m, ll, finishL, extraLoads) {
    const delta_limit = Math.min((Lx_m * 1000) / this.delta_ratio, this.delta_max);
    let T = 500;
    let D = T;

    while (T >= this.min_t) {
      const W = this.totalLoad(T, ll, finishL, extraLoads);
      const δ = this.deflection(T, this.Db[0], Lx_m, W);
      if (δ <= delta_limit) {
        D = T;
        T -= 10;
      } else {
        break;
      }
    }
    return Math.max(D, this.min_t);
  }

  /** Full slab design */
  design(input) {
    let { Lx, Ly, ll, finishL, extraLoads, label } = input;
    if (Lx > Ly) [Lx, Ly] = [Ly, Lx];

    const thickness  = this.findThickness(Lx, Ly, ll, finishL, extraLoads);
    const W          = this.totalLoad(thickness, ll, finishL, extraLoads);
    const { Mx, My } = this.bendingMoments(thickness, Lx, Ly, W);

    const Astx = this.requiredAst(Mx, thickness, this.Db[0]);
    const Asty = this.requiredAst(My, thickness, this.Db[0]);

    const barX = this.barSpacing(Astx);
    const barY = this.barSpacing(Asty);

    const shear = this.shearCheck(thickness, Lx, W);
    const d_eff = this.effDepth(thickness, this.Db[0]);

    return {
      label,
      Lx, Ly,
      ll, finishL,
      extraLoads,
      thickness,
      d_eff,
      totalLoad: W.toFixed(1),
      Mx: Mx.toFixed(3),
      My: My.toFixed(3),
      Astx: Astx.toFixed(1),
      Asty: Asty.toFixed(1),
      barX,
      barY,
      shear,
      slabType: (Ly / Lx) > 2 ? "One-Way Slab" : "Two-Way Slab",
      lyLxRatio: (Ly / Lx).toFixed(2),
    };
  }
}
