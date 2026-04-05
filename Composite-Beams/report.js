// ============================================================
// IBS-TOOL-004 · report.js  (v3 — fully aligned with engine v3)
// Word document calculation sheet — IS 11384:2022
// All field names verified against engine.js v3 output
// LTB correctly stated as NOT APPLICABLE at any stage
// Vierendeel uses corrected SCI P355 formulation
// Stud fields use Qn_char, Qn_red, C_conc, C_steel, C_total
// Deflection uses delta_DL_comp for frequency
// ============================================================
"use strict";

// ── Robust CDN loader with multiple fallbacks ────────────────
// docx library is large (~1MB). We try 3 CDN sources in order.
// The UMD build exposes the global variable 'docx'.
const DOCX_CDNS = [
  // jsdelivr — most reliable, definitely has 8.5.0
  'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
  // unpkg — second fallback
  'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  // older 7.8.2 on cdnjs as last resort (API compatible)
  'https://cdnjs.cloudflare.com/ajax/libs/docx/7.8.2/docx.umd.min.js',
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // If already loaded from this src, resolve immediately
    if (document.querySelector(`script[data-docx-cdn]`) && window.docx) {
      resolve(); return;
    }
    const s = document.createElement('script');
    s.src = src;
    s['data-docx-cdn'] = '1';
    s.onload  = () => { resolve(); };
    s.onerror = () => { reject(new Error('CDN failed: ' + src)); };
    document.head.appendChild(s);
  });
}

async function loadDocxLibrary() {
  // Already loaded?
  if (window.docx && window.docx.Document) return;

  let lastErr;
  for (const url of DOCX_CDNS) {
    try {
      await loadScript(url);
      // Verify it actually loaded the global
      if (window.docx && window.docx.Document) return;
      throw new Error('Library loaded but window.docx not found');
    } catch (e) {
      lastErr = e;
      console.warn('docx CDN attempt failed:', url, e.message);
    }
  }
  throw new Error(
    'Could not load the Word document library from any CDN.\n' +
    'Please check your internet connection and try again.\n' +
    'Last error: ' + (lastErr ? lastErr.message : 'unknown')
  );
}

// ── Read project fields from UI ─────────────────────────────
function readProjectInfo() {
  const g = (i) => (document.getElementById(i) ? document.getElementById(i).value : '').trim();
  const dateVal = g('proj_date');
  let dateDisp;
  if (dateVal) {
    const parts  = dateVal.split('-');
    const months = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
    dateDisp = parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  } else {
    dateDisp = new Date().toLocaleDateString('en-IN',
      { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return {
    project:  g('proj_name')     || '(Project not specified)',
    building: g('proj_building') || '(Building not specified)',
    floor:    g('proj_floor')    || '(Floor not specified)',
    beam_id:  g('proj_beam_id')  || '(Beam ID not specified)',
    designer: g('eng_designer')  || '\u2014',
    checker:  g('eng_checker')   || '\u2014',
    ref_no:   g('proj_ref')      || '\u2014',
    date:     dateDisp,
    generated: new Date().toLocaleString('en-IN')
  };
}

// ── Main generator ──────────────────────────────────────────
async function generateReport(R) {
  // Load docx library (tries 3 CDNs automatically)
  await loadDocxLibrary();

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
    PageBreak, PageNumber, LevelFormat
  } = docx;

  // ── Validate result object ────────────────────────────────
  if (!R || R.error) {
    throw new Error('Design result is invalid or missing. Please run the design first.');
  }
  if (!R.sec || !R.geom || !R.loads || !R.bending) {
    throw new Error('Design result is incomplete. Please re-run the design and try again.');
  }

  const PI = readProjectInfo();

  // ── Page layout (A4, 0.75" margins) ──────────────────────
  const PAGE_W   = 11906;
  const MARGIN   = 1080;
  const CONTENT  = PAGE_W - 2 * MARGIN;   // 9746 DXA
  const C = { L: 4300, V: 2700, U: 1500, S: 1246 };  // sum = 9746

  // ── Colours ───────────────────────────────────────────────
  const CL = {
    NAVY:"0A1E30", BLUE:"1A3A5C", MID:"2E6DA4", LIGHT:"8BA8C4",
    LIGHTER:"C5D9EB", PASS:"1A7A4A", PASS_BG:"D4F0E0",
    FAIL:"A82020", FAIL_BG:"FDE8E8",
    WARN:"8A5A00", ROW:"F0F4F8",
    HDR:"1A3A5C", WHITE:"FFFFFF", GREY:"666666", LGREY:"AAAAAA"
  };

  // ── Borders ───────────────────────────────────────────────
  const B1 = { style: BorderStyle.SINGLE, size: 1, color: CL.LIGHTER };
  const BA = { top: B1, bottom: B1, left: B1, right: B1 };
  const BN = {
    top:    { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left:   { style: BorderStyle.NONE }, right:  { style: BorderStyle.NONE }
  };
  const CM = { top: 70, bottom: 70, left: 110, right: 110 };

  // ── Text helpers ──────────────────────────────────────────
  const t  = (text, o = {}) => new TextRun({ text: String(text === null || text === undefined ? '\u2014' : text), font: "Calibri", size: 20, ...o });
  const tb = (text, o = {}) => t(text, { bold: true, ...o });
  const tm = (text, o = {}) => new TextRun({ text: String(text === null || text === undefined ? '\u2014' : text), font: "Courier New", size: 19, bold: true, ...o });

  // ── Paragraph helpers ─────────────────────────────────────
  const P  = (ch, o = {}) => new Paragraph({ children: Array.isArray(ch) ? ch : [t(ch)], spacing: { after: 60 }, ...o });
  const PC = (ch, o = {}) => P(Array.isArray(ch) ? ch : [t(ch)], { alignment: AlignmentType.CENTER, ...o });
  const SP = (pt = 100)   => new Paragraph({ children: [], spacing: { after: pt } });
  const HR = (col = CL.MID, sz = 6) => new Paragraph({
    children: [], spacing: { after: 80, before: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: sz, color: col } }
  });

  // ── Section headings ──────────────────────────────────────
  const SH  = (text, n) => new Paragraph({
    children: [tb(`${n}.\u2002${text}`, { size: 24, color: CL.BLUE })],
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: CL.MID } }
  });
  const SH2 = (text) => new Paragraph({
    children: [tb(text, { size: 21, color: CL.MID })],
    spacing: { before: 160, after: 80 }
  });

  // ── Cell factory ─────────────────────────────────────────
  const CE = (runs, w, fill = CL.WHITE, align = AlignmentType.LEFT) =>
    new TableCell({
      children: [new Paragraph({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: 0 }, alignment: align })],
      width: { size: w, type: WidthType.DXA },
      borders: BA,
      shading: { type: ShadingType.CLEAR, fill },
      margins: CM
    });

  // ── Header row ────────────────────────────────────────────
  const HR2 = (cols) => new TableRow({
    tableHeader: true,
    children: cols.map(([txt, w]) => new TableCell({
      children: [new Paragraph({ children: [tb(txt, { color: CL.WHITE, size: 18 })], spacing: { after: 0 } })],
      width: { size: w, type: WidthType.DXA },
      borders: BA,
      shading: { type: ShadingType.CLEAR, fill: CL.HDR },
      margins: CM
    }))
  });

  // ── Data row — label | value | unit | status ──────────────
  const DR = (lbl, val, unit = "", ok = null, alt = false) => {
    const fill = alt ? CL.ROW : CL.WHITE;
    const statusRun = ok !== null
      ? [tb(ok ? 'PASS \u2713' : 'FAIL \u2717', { color: ok ? CL.PASS : CL.FAIL, size: 18 })]
      : [t('')];
    return new TableRow({
      children: [
        CE([t(lbl, { size: 19 })],          C.L, fill),
        CE([tm(String(val !== null && val !== undefined ? val : '\u2014'))], C.V, fill),
        CE([t(unit, { size: 17, color: CL.GREY })], C.U, fill),
        CE(statusRun, C.S, fill, AlignmentType.CENTER)
      ]
    });
  };

  // ── Standard 4-col table ─────────────────────────────────
  const MT = (rows) => new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [C.L, C.V, C.U, C.S],
    rows
  });

  // ── Info/note box (full-width coloured cell) ──────────────
  const infoBox = (runs, fill, borderCol) => new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [CONTENT],
    rows: [new TableRow({ children: [new TableCell({
      children: Array.isArray(runs)
        ? runs.map(r => Array.isArray(r) ? new Paragraph({ children: r, spacing: { after: 40 } }) : r)
        : [new Paragraph({ children: Array.isArray(runs) ? runs : [t(runs)], spacing: { after: 0 } })],
      width: { size: CONTENT, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 6, color: borderCol },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: borderCol },
        left:   { style: BorderStyle.SINGLE, size: 16, color: borderCol },
        right:  { style: BorderStyle.SINGLE, size: 6, color: borderCol }
      }
    })] })]
  });

  // ── Number formatters ─────────────────────────────────────
  const f0  = v => (v !== null && isFinite(v)) ? Math.round(v).toString()  : '\u2014';
  const f2  = v => (v !== null && isFinite(v)) ? v.toFixed(2)              : '\u2014';
  const f3  = v => (v !== null && isFinite(v)) ? v.toFixed(3)              : '\u2014';
  const f4  = v => (v !== null && isFinite(v)) ? v.toFixed(4)              : '\u2014';
  const kN  = v => (v !== null && isFinite(v)) ? (v / 1000).toFixed(2)    : '\u2014';
  const kNm = v => (v !== null && isFinite(v)) ? (v / 1e6).toFixed(3)     : '\u2014';
  const pct = v => (v !== null && isFinite(v)) ? (v * 100).toFixed(1) + '%': '\u2014';

  // ── Destructure result ────────────────────────────────────
  const {
    sec, geom, inp, loads, bending, shear, vier, vier_ok,
    trans, defl, studs, ltb, fn, fn_ok, beff_mm, beam_wt, webPost
  } = R;
  const ld = loads;

  // ============================================================
  // BUILD DOCUMENT
  // ============================================================
  const ch = [];

  // ── COVER PAGE ───────────────────────────────────────────
  ch.push(
    PC([tb("INTEGRATED BUILDING SERVICES", { size: 34, color: CL.NAVY, allCaps: true })],
       { spacing: { before: 0, after: 40 } }),
    PC([t("Structural Consultancy  |  Structural Audit  |  Project & Construction Management",
         { size: 18, color: CL.MID, italics: true })], { spacing: { after: 40 } }),
    HR(CL.MID, 14),
    SP(80),
    PC([tb("STRUCTURAL CALCULATION SHEET", { size: 38, color: CL.BLUE })],
       { spacing: { after: 60 } }),
    PC([t("Composite Beam Design  \u2014  IS 11384 : 2022  /  IS 800 : 2007  /  IS 808",
         { size: 24, color: CL.MID })], { spacing: { after: 200 } })
  );

  // Project info block (4 rows × 2 columns)
  const PH  = Math.floor(CONTENT / 2);
  const PLW = Math.floor(PH * 0.40);
  const PVW = PH - PLW;
  const PDATA = [
    [["Project Name",   PI.project],   ["Job / Ref. No.",  PI.ref_no]],
    [["Building / Block",PI.building], ["Date",            PI.date]],
    [["Floor Level",    PI.floor],     ["Designed by",     PI.designer]],
    [["Beam ID / Mark", PI.beam_id],   ["Checked by",      PI.checker]],
  ];

  ch.push(new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [PLW, PVW, PLW, PVW],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 10, color: CL.NAVY },
      bottom: { style: BorderStyle.SINGLE, size: 10, color: CL.NAVY },
      left:   BN.left, right: BN.right,
      insideH: { style: BorderStyle.SINGLE, size: 1, color: CL.LIGHTER },
      insideV: BN.left
    },
    rows: PDATA.map((pair, ri) => new TableRow({
      children: pair.flatMap(([lbl, val]) => [
        new TableCell({
          children: [new Paragraph({ children: [tb(lbl + ':', { size: 18, color: CL.BLUE })], spacing: { after: 0 } })],
          width: { size: PLW, type: WidthType.DXA }, borders: BN,
          shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? CL.ROW : CL.WHITE }, margins: CM
        }),
        new TableCell({
          children: [new Paragraph({ children: [tb(val, { size: 20, color: CL.NAVY })], spacing: { after: 0 } })],
          width: { size: PVW, type: WidthType.DXA }, borders: BN,
          shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? CL.ROW : CL.WHITE }, margins: CM
        })
      ])
    }))
  }), SP(120));

  // Overall PASS / FAIL banner
  const OC = R.overall_ok ? CL.PASS : CL.FAIL;
  ch.push(new Table({
    width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [CONTENT],
    rows: [new TableRow({ children: [new TableCell({
      children: [
        new Paragraph({ children: [tb(R.overall_ok ? "DESIGN  SATISFACTORY" : "DESIGN  INADEQUATE",
          { size: 30, color: CL.WHITE })], alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
        new Paragraph({ children: [t(
          `${sec.name}  |  ${geom.mode.toUpperCase()}  |  L = ${inp.L}\u202fm  |  ` +
          `M${inp.fck} concrete  |  fy = ${inp.fy} MPa  |  \u03b7 = ${inp.eta}`,
          { size: 18, color: CL.WHITE })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })
      ],
      width: { size: CONTENT, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: OC },
      margins: { top: 140, bottom: 140, left: 200, right: 200 }, borders: BN
    })] })]
  }), SP(80), new Paragraph({ children: [new PageBreak()] }));

  // ── 1. DESIGN PARAMETERS ────────────────────────────────
  ch.push(SH("Design Parameters", 1), SH2("1.1  Geometry"));
  ch.push(MT([
    HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["", C.S]]),
    DR("Span  L",                              f2(inp.L),           "m",   null, false),
    DR("Tributary / Beam spacing",             f0(inp.beam_spacing),"mm",  null, true),
    DR("Beam position",                        inp.beam_position,   "",    null, false),
    DR("Effective slab width  beff (IS 11384:2022 Cl.8.2)", f0(beff_mm), "mm", null, true),
    DR("Deck profile",                         inp.deck_profile,    "",    null, false),
    DR("Deck rib height  Td",                  f0(inp.Td),          "mm",  null, true),
    DR("Concrete topping above deck  Tc (min 50)", f0(inp.Tc),      "mm",  null, false),
    DR("Overall slab depth  Ts = Td + Tc",     f0(inp.Ts),          "mm",  null, true),
    DR("Beam mode",                            geom.mode.toUpperCase(), "", null, false),
    DR("Opening diameter  Do",                 geom.Do > 0 ? f0(geom.Do) : "NIL", "mm", null, true),
    DR("Expanded beam depth  d_new",           f2(geom.d_new),      "mm",  null, false),
    DR("Tee height above / below opening  h_tee", geom.h_tee > 0 ? f2(geom.h_tee) : "N/A", "mm", null, true),
    DR("Web post width  (c/c spacing \u2212 Do)", geom.web_post_w > 0 ? f2(geom.web_post_w) : "N/A", "mm", null, false),
    DR("Opening c/c spacing",                 geom.spacing_cc > 0 ? f2(geom.spacing_cc) : "N/A", "mm", null, true),
    DR("Construction method",                  inp.propped ? "PROPPED" : "UNPROPPED", "", null, false),
  ]));

  ch.push(SP(80), SH2("1.2  Materials"));
  ch.push(MT([
    HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["", C.S]]),
    DR("Concrete grade  fck",                  f0(inp.fck),             "MPa", null, false),
    DR("Concrete modulus  Ec = 5000\u221afck (IS 456)", f0(trans.E_c),  "MPa", null, true),
    DR("Steel yield strength  fy",             f0(inp.fy),              "MPa", null, false),
    DR("Steel elastic modulus  Es",            "200 000",               "MPa", null, true),
    DR("Partial factor for steel  \u03b3m0",   f2(MATERIALS.gamma_m0),  "",    null, false),
    DR("ULS load factor  \u03b3f",             f2(inp.load_factor),     "",    null, true),
    DR("Degree of shear connection  \u03b7",   f2(inp.eta),             "",    null, false),
    DR("Long-term creep factor  Kc",           f2(MATERIALS.Kc),        "",    null, true),
    DR("Short-term modular ratio  m = Es/Ec",  f2(trans.m_short),       "",    null, false),
    DR("Long-term modular ratio  m\u2113 = Es/(Kc\u00b7Ec)", f2(trans.m_long), "", null, true),
    DR("Fraction of LL for deflection",        f2(inp.frac_live),       "",    null, false),
  ]));

  // ── 2. STEEL SECTION PROPERTIES ─────────────────────────
  ch.push(SP(80), SH("Steel Section Properties  (IS 808)", 2));
  ch.push(MT([
    HR2([["Property", C.L], ["Symbol", C.V], ["Value", C.U], ["Unit", C.S]]),
    DR("Section designation",      sec.name,  "",  null, false),
    DR("Overall depth",            "d",        f0(sec.d)+" mm",                   null, true),
    DR("Flange width",             "bf",       f0(sec.bf)+" mm",                  null, false),
    DR("Flange thickness",         "tf",       f2(sec.tf)+" mm",                  null, true),
    DR("Web thickness",            "tw",       f2(sec.tw)+" mm",                  null, false),
    DR("Cross-section area",       "A",        f0(sec.A)+" mm\u00b2",             null, true),
    DR("Moment of inertia (major)","Ix",       (sec.Ix/1e4).toFixed(0)+" cm\u2074",null, false),
    DR("Elastic section modulus",  "Zex",      f0(sec.Zex)+" mm\u00b3",          null, true),
    DR("Plastic section modulus",  "Zpx",      f0(sec.Zpx)+" mm\u00b3",          null, false),
    DR("Minor axis inertia",       "Iy",       (sec.Iy/1e4).toFixed(0)+" cm\u2074",null, true),
    DR("Radius of gyration (major)","rx",      f2(sec.rx)+" mm",                  null, false),
    DR("Self-weight",              "w",        f2(sec.w)+" kg/m",                 null, true),
    DR("Total beam weight (L="+f2(inp.L)+"m)","W_beam", f2(beam_wt)+" kg",       null, false),
    DR("Castellated Ix (flanges displaced)","Ixx_cast",
       geom.mode !== 'I' ? (trans.I_steel_castex/1e4).toFixed(0)+" cm\u2074" : "N/A (plain I)", null, true),
  ]));

  // ── 3. LOAD ANALYSIS ────────────────────────────────────
  ch.push(SP(80), SH("Load Analysis", 3), SH2("3.1  Load Intensities"));
  ch.push(MT([
    HR2([["Load Component", C.L], ["Intensity", C.V], ["Unit", C.U], ["UDL along beam (N/mm)", C.S]]),
    DR("Slab self weight  [25 kN/m\u00b3 \u00d7 (Td/2 + Tc)]",
       f2(ld.slab_kgm2), "kg/m\u00b2", null, false),
    DR("Live load  LL",              f2(inp.LL),  "kg/m\u00b2", null, true),
    DR("Floor finish  FF",           f2(inp.FF),  "kg/m\u00b2", null, false),
    DR("Partition  PR",              f2(inp.PR),  "kg/m\u00b2", null, true),
    DR("Filling / misc.  FI",        f2(inp.FI),  "kg/m\u00b2", null, false),
    DR("Construction live load  CL", f2(inp.CL),  "kg/m\u00b2", null, true),
    DR("Wall line load  WL",         f2(inp.WL),  "kg/m",       null, false),
  ]));

  ch.push(SP(60), SH2("3.2  ULS Factored Forces  (\u03b3f = " + f2(inp.load_factor) + ")"));
  ch.push(MT([
    HR2([["Quantity", C.L], ["Value", C.V], ["Unit", C.U], ["", C.S]]),
    DR("Service UDL  (total along beam)",              f2(ld.service_kgpm),   "kg/m",       null, false),
    DR("Factored UDL  (\u03b3f \u00d7 service)",       f2(ld.factored_kgpm),  "kg/m",       null, true),
    DR("Construction UDL  (slab SW + CL on steel)",
       f2(ld.w_constr_Npmm * 1000 / MATERIALS.G),     "kg/m",       null, false),
    DR("Factored shear  Vf",
       kN(ld.V_fact)+" kN  ("+f2(ld.V_fact/9810)+" t)",   "",       null, true),
    DR("Factored moment  Mf",
       kNm(ld.M_fact)+" kN\u00b7m  ("+f2(ld.M_fact/(9810*1e3))+" t\u00b7m)", "", null, false),
  ]));

  // ── 4. BENDING CAPACITY ─────────────────────────────────
  ch.push(SP(80), SH("Bending Capacity  \u2014  IS 11384:2022 Table 16", 4));
  ch.push(infoBox([
    [tb("Method: ", { size: 19, color: CL.BLUE }),
     t("Plastic stress block. Effective concrete depth ds = Tc (above ribs only). PNA located by force equilibrium.", { size: 19 })],
    [tb("a = fy / (0.36 \u00b7 fck) = ", { size: 18, color: CL.GREY }),
     t(f3(inp.fy / (0.36 * inp.fck)) + "  |  beff = " + f0(beff_mm) + " mm  |  ds = " + f0(bending.ds) + " mm", { size: 18, color: CL.GREY })]
  ], CL.ROW, CL.MID), SP(60));

  ch.push(MT([
    HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["Status", C.S]]),
    DR("PNA Case",                            bending.caseNo.toString(),  "",            null, false),
    DR("Effective concrete depth  ds",        f0(bending.ds),             "mm",          null, true),
    DR("Distance slab top to steel centroid  dc", f2(bending.dc),         "mm",          null, false),
    DR("Stress block parameter  a = fy/(0.36\u00b7fck)", f3(inp.fy/(0.36*inp.fck)), "", null, true),
    DR("Plastic neutral axis  xu",            f2(bending.xu_mm),          "mm",          null, false),
    DR("Nominal composite moment  Md",        kNm(bending.Md_Nmm),        "kN\u00b7m",   null, true),
    DR("Design capacity  \u03c6Md  (\u03c6 = 0.90)", kNm(bending.phi_Md),"kN\u00b7m",   null, false),
    DR("Applied factored moment  Mf",         kNm(ld.M_fact),             "kN\u00b7m",   null, true),
    DR("Utilisation ratio  Mf / \u03c6Md",   f3(R.flex_util),            "",            R.flex_ok, false),
  ]));

  // ── 5. SHEAR CAPACITY ───────────────────────────────────
  ch.push(SP(80), SH("Shear Capacity  \u2014  IS 800:2007 Cl. 8.4", 5));
  ch.push(MT([
    HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["Status", C.S]]),
    DR("Shear section type",                  shear.shear_type,            "",            null, false),
    DR("Tee height (each tee)  h_tee",        geom.Do > 0 ? f2(shear.h_tee) : "N/A", "mm", null, true),
    DR("Full web height  h_web",              f2(shear.h_web),             "mm",          null, false),
    DR("Web thickness  tw",                   f2(sec.tw),                  "mm",          null, true),
    DR("Slenderness  h / tw",                 f2(shear.h_over_tw),         "",            null, false),
    DR("Critical buckling stress  \u03c4cr",  f2(shear.tau_cr),            "MPa",         null, true),
    DR("Slenderness parameter  \u03bbw",      f3(shear.lambda_w),          "",            null, false),
    DR("Design shear stress  Tv",             f2(shear.Tv_MPa),            "MPa",         null, true),
    DR("Total shear area  Aw (both tees)",    f0(shear.Aw_total),          "mm\u00b2",    null, false),
    DR("Total shear capacity  Vn",            kN(shear.Vn_total),          "kN",          null, true),
    DR("Applied factored shear  Vf",          kN(ld.V_fact),               "kN",          null, false),
    DR("Utilisation ratio  Vf / Vn",          f3(shear.util),              "",            shear.ok, true),
  ]));
  if (shear.note) {
    ch.push(P([tb("Web check: ", { color: CL.WARN }), t(shear.note, { color: CL.WARN, size: 19 })],
      { spacing: { after: 60 } }));
  }
  if (shear.stiff_req) {
    ch.push(P([tb("\u26a0  Web stiffeners required at openings — h/tw exceeds IS 800 limit.",
      { color: CL.FAIL, size: 20 })], { spacing: { after: 60 } }));
  }

  // ── 6. VIERENDEEL CHECK ─────────────────────────────────
  ch.push(SP(80), SH("Vierendeel Check at Beam Openings", 6));
  if (vier) {
    ch.push(infoBox([
      [tb("Method  (SCI P355 / BCSA): ", { size: 19, color: CL.BLUE }),
       t("Each tee carries V/2. Secondary moment Mv = (V/2) \u00d7 (Do/2). Checked at first opening from support (worst V + M interaction).", { size: 19 })],
      [tb("Top tee: ", { size: 18, color: CL.GREY }),
       t("axial compression (from global M) + Vierendeel bending", { size: 18, color: CL.GREY })],
      [tb("Bottom tee: ", { size: 18, color: CL.GREY }),
       t("axial tension + Vierendeel bending  \u2192  governs at support", { size: 18, color: CL.GREY })]
    ], CL.ROW, CL.MID), SP(60));

    ch.push(MT([
      HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["Status", C.S]]),
      DR("Opening length along beam  ao = Do", f0(vier.a_o),            "mm",          null, false),
      DR("Shear per tee  V_tee = Vf / 2",     kN(vier.V_tee),          "kN",          null, true),
      DR("Vierendeel moment  Mv = V_tee \u00d7 ao/2", kNm(vier.Mv),   "kN\u00b7m",   null, false),
      DR("Tee section area  A_tee",            f0(vier.A_tee),          "mm\u00b2",    null, true),
      DR("Tee plastic moment  Mp_tee",         kNm(vier.Mp_tee),        "kN\u00b7m",  null, false),
      DR("Lever arm (tee centroid to centroid)",f2(vier.lever_arm),     "mm",          null, true),
      DR("Axial force in tee  N  (at first opening)", kN(vier.N_c_first),"kN",        null, false),
      DR("UC \u2014 Top tee  (comp + Vierendeel)",  f3(vier.UC_top_first), "",  vier.UC_top_first <= 1.0, true),
      DR("UC \u2014 Bottom tee  (tension + Vierendeel)", f3(vier.UC_bot_first), "", vier.UC_bot_first <= 1.0, false),
      DR("UC \u2014 At support  (pure Vierendeel)",  f3(vier.UC_support),   "", vier.UC_support <= 1.0, true),
      DR("Combined UC  (governing)",           f3(vier.combined),       "",            vier_ok, false),
    ]));
  } else {
    ch.push(P("Not applicable \u2014 Full I-beam selected (no web openings).", { spacing: { after: 80 } }));
  }

  // ── 6a. WEB POST HORIZONTAL SHEAR ───────────────────────
  if (webPost) {
    ch.push(SP(60), SH2("6a.  Web Post Horizontal Shear Check  (IS 800:2007 Cl. 8.4)"));
    ch.push(MT([
      HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["Status", C.S]]),
      DR("Web post width between openings",    f2(webPost.web_post_w),  "mm",  null, false),
      DR("Horizontal shear in post  V_H",      kN(webPost.V_H),         "kN",  null, true),
      DR("Post shear area  A_post",            f0(webPost.A_post),      "mm\u00b2", null, false),
      DR("Shear stress in post  \u03c4_post",  f2(webPost.tau_post),    "MPa", null, true),
      DR("Design shear stress  fv = fy/(\u221a3 \u00d7 \u03b3m0)",
                                               f2(webPost.fv_design),   "MPa", null, false),
      DR("Utilisation  \u03c4_post / fv",      f3(webPost.util_post),   "",    webPost.post_ok, true),
    ]));
  }

  // ── 7. LATERAL TORSIONAL BUCKLING ───────────────────────
  ch.push(SP(80), SH("Lateral Torsional Buckling  \u2014  IS 800:2007 Cl. 8.2.1", 7));
  ch.push(infoBox([
    [tb("LTB \u2014 NOT APPLICABLE AT ANY STAGE", { size: 22, color: CL.WHITE })],
    [t("IS 800:2007 Cl. 8.2.1 Note 1: LTB need not be checked when the compression flange is restrained against lateral bending throughout its length.", { size: 18, color: CL.WHITE })]
  ], CL.PASS, CL.PASS), SP(60));

  // Erection sequence table
  const seqCols = [900, CONTENT - 900];
  const seqData = [
    ["1", "Steel beam erected and set on bearings."],
    ["2", "Profiled deck sheet placed on top flange and fixed with self-drilling screws / puddle welds to the top flange."],
    ["3", "SHEAR STUDS WELDED THROUGH DECK to top flange — FULL CONTINUOUS LATERAL RESTRAINT provided BEFORE concrete is poured. Top flange cannot displace or rotate laterally from this point onward."],
    ["4", "Concrete poured. Composite action develops on curing. Top flange remains continuously restrained throughout service life."],
  ];
  ch.push(new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: seqCols,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [tb("Step", { color: CL.WHITE, size: 18 })], spacing: { after: 0 } })],
            width: { size: seqCols[0], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: CL.HDR }, margins: CM, borders: BA }),
          new TableCell({ children: [new Paragraph({ children: [tb("Erection Sequence & Lateral Restraint Status", { color: CL.WHITE, size: 18 })], spacing: { after: 0 } })],
            width: { size: seqCols[1], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: CL.HDR }, margins: CM, borders: BA })
        ]
      }),
      ...seqData.map(([step, desc], i) => {
        const isKey = step === "3";
        const fill  = isKey ? CL.PASS_BG : (i % 2 === 0 ? CL.ROW : CL.WHITE);
        const col   = isKey ? CL.PASS : CL.NAVY;
        return new TableRow({ children: [
          new TableCell({ children: [new Paragraph({ children: [tb(step, { size: 20, color: col })], spacing: { after: 0 }, alignment: AlignmentType.CENTER })],
            width: { size: seqCols[0], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill }, margins: CM, borders: BA }),
          new TableCell({ children: [new Paragraph({ children: [isKey ? tb(desc, { size: 19, color: CL.PASS }) : t(desc, { size: 19 })], spacing: { after: 0 } })],
            width: { size: seqCols[1], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill }, margins: CM, borders: BA })
        ]});
      })
    ]
  }), SP(60));
  ch.push(P([
    tb("Conclusion: ", { size: 19, color: CL.BLUE }),
    t("No LTB utilisation check is performed. Section torsional properties for reference: " +
      "J = " + (ltb.J / 1000).toFixed(0) + " mm\u00b3, " +
      "Iw = " + (ltb.Iw / 1e9).toFixed(3) + " \u00d710\u2079 mm\u2076.",
      { size: 19, color: CL.GREY })
  ], { spacing: { after: 80 } }));

  // ── 8. DEFLECTION CHECKS ────────────────────────────────
  ch.push(SP(80), SH("Deflection Checks  \u2014  IS 11384:2022 Cl. 12", 8));
  ch.push(SH2("8.1  Composite Section Properties (Transformed Section Method)"));
  ch.push(MT([
    HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["", C.S]]),
    DR("Concrete modulus  Ec = 5000\u221afck",          f0(trans.E_c),          "MPa",           null, false),
    DR("Short-term modular ratio  m = Es/Ec",           f2(trans.m_short),       "",              null, true),
    DR("Long-term modular ratio  m\u2113 = Es/(Kc\u00b7Ec)", f2(trans.m_long),  "",              null, false),
    DR("Composite NA from slab top (short-term)",       f2(trans.y_bar_short),  "mm",            null, true),
    DR("Composite NA from slab top (long-term)",        f2(trans.y_bar_long),   "mm",            null, false),
    DR("Composite Ix (short-term)",           (trans.I_comp_short/1e4).toFixed(0), "cm\u2074",  null, true),
    DR("Composite Ix (long-term)",            (trans.I_comp_long/1e4).toFixed(0),  "cm\u2074",  null, false),
    DR("EI composite (short-term)",           (trans.EI_short/1e12).toFixed(3),    "GN\u00b7mm\u00b2", null, true),
    DR("EI composite (long-term)",            (trans.EI_long/1e12).toFixed(3),     "GN\u00b7mm\u00b2", null, false),
  ]));

  ch.push(SP(60), SH2("8.2  Deflection Results  [\u03b4 = 5wL\u2074 / 384EI]"));
  ch.push(MT([
    HR2([["Stage / Load", C.L], ["\u03b4 (mm)", C.V], ["Limit (mm)", C.U], ["Status", C.S]]),
    DR("Part A \u2014 Construction  [slab SW + CL on steel alone]",
       f2(defl.delta_A),       inp.propped ? "Propped \u2014 N/A" : f2(defl.limit),
       inp.propped ? null : (defl.delta_A <= defl.limit), false),
    DR("Part B \u2014 Short-term live  [composite section, short-term EI]",
       f2(defl.delta_B_short), f2(defl.limit), null, true),
    DR("Part B total (SLS service check)  [A + B if unpropped]",
       f2(defl.delta_B_total), f2(defl.limit), defl.partB_ok, false),
    DR("Part C \u2014 Long-term sustained  [composite section, long-term EI with creep]",
       f2(defl.delta_C),       f2(defl.limit), defl.partC_ok, true),
    DR("Total long-term  (A + C)",
       f2(defl.delta_total_LT), "Informational", null, false),
  ]));
  ch.push(P([
    tb("Limit: ", { size: 19 }),
    t("min(L/360, 20\u202fmm) = min(" + f2(inp.L * 1000 / 360) + ", 20) = " +
      f2(defl.limit) + "\u202fmm  [IS 11384:2022 Cl. 12]", { size: 19, color: CL.GREY })
  ], { spacing: { after: 80 } }));

  ch.push(SH2("8.3  Floor Natural Frequency  [ISO 10137 / SCI P354]"));
  ch.push(infoBox([
    [tb("Basis: ", { size: 18, color: CL.GREY }),
     t("Murray / Donaldson formula: fn = (\u03c0/2)\u221a(g/\u03b4_DL). \u03b4_DL = deflection under permanent DL only on composite section.", { size: 18, color: CL.GREY })]
  ], CL.ROW, CL.LIGHT), SP(40));
  ch.push(MT([
    HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["Status", C.S]]),
    DR("DL deflection on composite section  \u03b4_DL",  f2(defl.delta_DL_comp), "mm", null, false),
    DR("Natural frequency  fn = (\u03c0/2)\u221a(g/\u03b4_DL)", f2(fn),           "Hz", fn_ok, true),
    DR("Minimum recommended  (offices, ISO 10137)",      "4.0",                   "Hz", null, false),
  ]));

  // ── 9. SHEAR STUD CONNECTORS ────────────────────────────
  ch.push(SP(80), SH("Shear Stud Connectors  \u2014  IS 11384:2022 Cl. 9", 9));
  if (studs) {
    ch.push(SH2("9.1  Stud Capacity  (IS 11384:2022 Table 14)"));
    ch.push(MT([
      HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["", C.S]]),
      DR("Stud diameter",                                studs.dia + " mm",        "",            null, false),
      DR("Characteristic capacity  Qn  (fck-scaled)",   kN(studs.Qn_char),        "kN",          null, true),
      DR("Deck reduction factor  Rg  (single stud/rib)", f2(studs.Rg),            "",            null, false),
      DR("Position factor  Rp  (strong/favourable pos.)",f2(studs.Rp),            "",            null, true),
      DR("Qn reduced  (Rg \u00d7 Rp \u00d7 Qn)",        kN(studs.Qn_red),         "kN",          null, false),
      DR("Qn used in design",                            kN(studs.Qn_use),         "kN",          null, true),
    ]));

    ch.push(SP(60), SH2("9.2  Compressive Force & Stud Layout"));
    ch.push(MT([
      HR2([["Parameter", C.L], ["Value", C.V], ["Unit", C.U], ["Status", C.S]]),
      DR("Concrete compression  Cc = 0.36\u00b7fck\u00b7beff\u00b7ds", kN(studs.C_conc), "kN", null, false),
      DR("Steel tension  Cs = As\u00b7fy/\u03b3m0",        kN(studs.C_steel),       "kN",          null, true),
      DR("Governing compressive force  C_total",          kN(studs.C_total),        "kN",          null, false),
      DR("Governs by",                                    studs.governs_by,         "",            null, true),
      DR("Target force  (\u03b7 \u00d7 C_total)",          kN(studs.C_target),       "kN",          null, false),
      DR("Studs required per half-span  n_half",          studs.n_half.toString(),  "",            null, true),
      DR("Total studs over full span  n_total",           studs.n_total.toString(), "",            null, false),
      DR("Stud spacing  (uniform over half-span)",        f0(studs.spacing),        "mm",          studs.ok, true),
      DR("Minimum spacing  max(5d, 100\u202fmm)  [Cl.9.5]", f0(studs.s_min),       "mm",          null, false),
      DR("Maximum spacing  min(6Ts, 600\u202fmm)  [Cl.9.5]", f0(studs.s_max),      "mm",          null, true),
    ]));
  } else {
    ch.push(P("Stud design data not available.", { spacing: { after: 80 } }));
  }

  // ── 10. DESIGN SUMMARY ──────────────────────────────────
  ch.push(SP(80), SH("Summary of All Design Checks", 10));
  const SD = [
    ["Bending  (ULS)",                    pct(R.flex_util),                                  R.flex_ok],
    ["Shear  (ULS)",                      pct(shear.util),                                   shear.ok],
    vier ? ["Vierendeel  (at openings)",  pct(vier.combined),                                vier_ok] : null,
    webPost ? ["Web Post Shear",          pct(webPost.util_post),                            webPost.post_ok] : null,
    ["LTB  (all stages)",                 "NOT APPLICABLE \u2014 top flange continuously restrained", true],
    ["Deflection  Part B  (SLS)",         f2(defl.delta_B_total) + " / " + f2(defl.limit) + " mm", defl.partB_ok],
    ["Deflection  Part C  (long-term)",   f2(defl.delta_C) + " / " + f2(defl.limit) + " mm", defl.partC_ok],
    ["Floor natural frequency",           f2(fn) + " Hz  (\u2265 4.0 Hz)",                   fn_ok],
    studs ? ["Stud spacing",             f0(studs.spacing) + " mm  (" + f0(studs.s_min) + "\u2013" + f0(studs.s_max) + " mm)", studs.ok] : null,
    ["OVERALL ASSESSMENT",               R.overall_ok ? "SATISFACTORY" : "INADEQUATE",       R.overall_ok],
  ].filter(Boolean);

  const SW = Math.floor(CONTENT * 0.58), SW2 = CONTENT - SW;
  ch.push(new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [SW, SW2],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [tb("Check", { color: CL.WHITE, size: 20 })], spacing: { after: 0 } })],
            width: { size: SW, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: CL.NAVY }, margins: CM, borders: BA }),
          new TableCell({ children: [new Paragraph({ children: [tb("Result", { color: CL.WHITE, size: 20 })], spacing: { after: 0 }, alignment: AlignmentType.CENTER })],
            width: { size: SW2, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: CL.NAVY }, margins: CM, borders: BA })
        ]
      }),
      ...SD.map(([lbl, val, ok], i) => {
        const isLast = lbl.startsWith("OVERALL");
        const isNA   = val.includes("NOT APPLICABLE");
        const fill   = isLast ? (ok ? CL.PASS : CL.FAIL) : (i % 2 === 0 ? CL.ROW : CL.WHITE);
        const txtCol = isLast ? CL.WHITE : (isNA ? CL.PASS : (ok ? CL.PASS : CL.FAIL));
        const sz     = isLast ? 22 : 19;
        const icon   = isNA ? "\u2713 N/A  " : (ok ? "\u2713 PASS  " : "\u2717 FAIL  ");
        return new TableRow({ children: [
          new TableCell({ children: [new Paragraph({ children: [tb(lbl, { size: sz, color: isLast ? CL.WHITE : CL.NAVY })], spacing: { after: 0 } })],
            width: { size: SW, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill }, margins: CM, borders: BA }),
          new TableCell({ children: [new Paragraph({ children: [tb(icon + val, { size: sz, color: txtCol })], spacing: { after: 0 }, alignment: AlignmentType.CENTER })],
            width: { size: SW2, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill }, margins: CM, borders: BA })
        ]});
      })
    ]
  }));

  // ── SIGN-OFF ─────────────────────────────────────────────
  ch.push(SP(200), HR(CL.MID, 6));
  const HS = Math.floor(CONTENT / 2);
  ch.push(new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [HS, CONTENT - HS],
    borders: { top: BN.top, bottom: BN.bottom, left: BN.left, right: BN.right, insideH: BN.top, insideV: BN.left },
    rows: [new TableRow({ children: [
      new TableCell({ children: [
        P([tb("Prepared by:", { size: 20, color: CL.BLUE })]), SP(80),
        P([tb(PI.designer || "________________________", { size: 22 })]),
        P([t("Structural Engineer", { size: 18, color: CL.GREY })]),
        P([t("Integrated Building Services", { size: 18, color: CL.GREY })]),
      ], width: { size: HS, type: WidthType.DXA }, borders: BN, margins: { top: 100, bottom: 100, left: 0, right: 200 } }),
      new TableCell({ children: [
        P([tb("Checked by:", { size: 20, color: CL.BLUE })]), SP(80),
        P([tb(PI.checker || "________________________", { size: 22 })]),
        P([t("Structural Engineer", { size: 18, color: CL.GREY })]),
        P([t("Integrated Building Services", { size: 18, color: CL.GREY })]),
      ], width: { size: CONTENT - HS, type: WidthType.DXA }, borders: BN, margins: { top: 100, bottom: 100, left: 200, right: 0 } })
    ]})]
  }));
  ch.push(
    SP(100),
    PC([t("Generated by IBS-TOOL-004  |  IS 11384:2022 / IS 800:2007 / IS 808  |  " + PI.generated,
         { size: 16, color: CL.LGREY })]),
    PC([t("DISCLAIMER: This calculation is for preliminary design and estimation only. " +
          "All results must be independently verified by a qualified structural engineer " +
          "before use in construction or submission to authorities.",
         { size: 15, color: CL.LGREY, italics: true })])
  );

  // ── HEADER & FOOTER ──────────────────────────────────────
  const HDR = {
    default: new Header({ children: [new Paragraph({
      children: [
        tb("IBS \u2014 COMPOSITE BEAM DESIGN CALCULATION", { size: 18, color: CL.BLUE }),
        t("  |  " + PI.project + "  |  " + PI.building + "  |  Beam: " + PI.beam_id, { size: 18, color: CL.GREY })
      ],
      spacing: { after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: CL.MID } }
    })] })
  };
  const FTR = {
    default: new Footer({ children: [new Paragraph({
      children: [
        t("Ref: " + PI.ref_no + "  |  IS 11384:2022  |  Page ", { size: 16, color: CL.LGREY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: CL.LGREY }),
        t(" of ", { size: 16, color: CL.LGREY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: CL.LGREY }),
        t("  |  Date: " + PI.date, { size: 16, color: CL.LGREY })
      ],
      spacing: { before: 0 }, alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: CL.MID } }
    })] })
  };

  // ── ASSEMBLE & DOWNLOAD ───────────────────────────────────
  const doc = new Document({
    creator: "Integrated Building Services",
    title:   "Composite Beam Design \u2014 IS 11384:2022",
    subject: PI.project + " \u2014 " + PI.building + " \u2014 " + PI.beam_id,
    styles: {
      default: { document: { run: { font: "Calibri", size: 20, color: "000000" } } },
      paragraphStyles: [{
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { size: 28, bold: true, font: "Calibri", color: CL.BLUE },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 }
      }]
    },
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      headers: HDR,
      footers: FTR,
      children: ch
    }]
  });

  const blob = await Packer.toBlob(doc);
  if (!blob || blob.size === 0) {
    throw new Error('Generated document is empty. This may be a library version issue.');
  }
  const url  = URL.createObjectURL(blob);
  const a    = window.document.createElement('a');
  const beamTag = (PI.beam_id || 'Beam').replace(/[^a-zA-Z0-9\-]/g, '_');
  const dateTag = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `IBS-TOOL-004_${beamTag}_${sec.name}_${dateTag}.docx`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
