// ============================================================
// IBS-TOOL-004 · report.js  (v2 – Full Calculation Sheet)
// Word document report — IS 11384:2022 Composite Beam Design
// Follows docx-js best practices (DXA widths, ShadingType.CLEAR)
// ============================================================
"use strict";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function readProjectInfo() {
  const g = (i) => (document.getElementById(i) ? document.getElementById(i).value : '').trim();
  const dateVal = g('proj_date');
  let dateDisp;
  if (dateVal) {
    const parts = dateVal.split('-');
    const months = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
    dateDisp = parts[2] + ' ' + months[parseInt(parts[1],10)-1] + ' ' + parts[0];
  } else {
    dateDisp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return {
    project:  g('proj_name')    || '(Project not specified)',
    building: g('proj_building')|| '(Building not specified)',
    floor:    g('proj_floor')   || '(Floor not specified)',
    beam_id:  g('proj_beam_id') || '(Beam ID not specified)',
    designer: g('eng_designer') || '—',
    checker:  g('eng_checker')  || '—',
    ref_no:   g('proj_ref')     || '—',
    date:     dateDisp,
    generated: new Date().toLocaleString('en-IN')
  };
}

async function generateReport(R) {
  if (typeof docx === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/docx/8.0.4/docx.umd.min.js');
  }
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
    PageBreak, PageNumber, LevelFormat
  } = docx;

  const PI = readProjectInfo();

  // A4 page: 11906 × 16838 DXA, margins 1080 DXA (~0.75")
  const CONTENT = 11906 - 2 * 1080;  // 9746 DXA
  const C = { L: 4200, V: 2800, U: 1500, S: 1246 };  // col widths, sum=9746

  // Colors
  const CL = {
    NAVY:"0A1E30", BLUE:"1A3A5C", MID:"2E6DA4", LIGHT:"8BA8C4",
    LIGHTER:"C5D9EB", PASS:"1A7A4A", FAIL:"A82020", WARN:"8A5A00",
    ROW:"F0F4F8", HDR:"1A3A5C", WHITE:"FFFFFF", GREY:"666666", LGREY:"AAAAAA"
  };

  // Borders
  const B1 = { style: BorderStyle.SINGLE, size: 1, color: CL.LIGHTER };
  const BA = { top: B1, bottom: B1, left: B1, right: B1 };
  const BN = { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE},
               left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} };
  const CM = { top: 70, bottom: 70, left: 110, right: 110 };

  // Text helpers
  const t  = (text, o={}) => new TextRun({ text: String(text), font:"Calibri", size:20, ...o });
  const tb = (text, o={}) => t(text, { bold:true, ...o });
  const tm = (text, o={}) => new TextRun({ text: String(text), font:"Courier New", size:20, ...o });

  // Paragraph helpers
  const P  = (ch, o={}) => new Paragraph({ children: Array.isArray(ch)?ch:[t(ch)], spacing:{after:60}, ...o });
  const PC = (ch, o={}) => P(Array.isArray(ch)?ch:[t(ch)], { alignment:AlignmentType.CENTER, ...o });
  const SP = (pt=100) => new Paragraph({ children:[], spacing:{after:pt} });
  const HR = (col=CL.MID, sz=6) => new Paragraph({
    children:[], spacing:{after:80, before:80},
    border:{ bottom:{ style:BorderStyle.SINGLE, size:sz, color:col } }
  });

  // Section heading
  const SH = (text, n) => new Paragraph({
    children: [tb(`${n}.  ${text}`, { size:24, color:CL.BLUE })],
    spacing: { before:280, after:100 },
    border: { bottom:{ style:BorderStyle.SINGLE, size:8, color:CL.MID } }
  });
  const SH2 = (text) => new Paragraph({
    children: [tb(text, { size:22, color:CL.MID })],
    spacing: { before:160, after:80 }
  });

  // Cell factory
  const CE = (runs, w, fill=CL.WHITE, align=AlignmentType.LEFT) => new TableCell({
    children: [new Paragraph({ children: Array.isArray(runs)?runs:[runs], spacing:{after:0}, alignment:align })],
    width: { size:w, type:WidthType.DXA },
    borders: BA, shading:{ type:ShadingType.CLEAR, fill }, margins: CM
  });

  // Header row factory
  const HR2 = (cols) => new TableRow({
    tableHeader: true,
    children: cols.map(([txt,w]) => new TableCell({
      children: [new Paragraph({ children:[tb(txt,{color:CL.WHITE,size:18})], spacing:{after:0} })],
      width:{ size:w, type:WidthType.DXA },
      borders:BA, shading:{ type:ShadingType.CLEAR, fill:CL.HDR }, margins:CM
    }))
  });

  // Data row: label | mono-value | unit | status
  const DR = (lbl, val, unit="", ok=null, alt=false) => {
    const fill = alt ? CL.ROW : CL.WHITE;
    return new TableRow({ children: [
      CE([t(lbl, {size:19})],                     C.L, fill),
      CE([tm(String(val), {size:19, bold:true})],  C.V, fill),
      CE([t(unit, {size:17, color:CL.GREY})],      C.U, fill),
      CE(ok!==null ? [tb(ok?'PASS \u2713':'FAIL \u2717', {color:ok?CL.PASS:CL.FAIL,size:18})] : [t('')],
         C.S, fill, AlignmentType.CENTER)
    ]});
  };

  // Build table
  const MT = (rows) => new Table({
    width:{ size:CONTENT, type:WidthType.DXA },
    columnWidths:[C.L, C.V, C.U, C.S], rows
  });

  // Shortcuts to result data
  const { sec, geom, inp, loads, bending, shear, vier, vier_ok,
          trans, defl, studs, ltb, fn, fn_ok, beff_mm, beam_wt } = R;
  const ld = loads;
  const f0  = v => isFinite(v) ? Math.round(v).toString() : "\u2014";
  const f2  = v => isFinite(v) ? v.toFixed(2) : "\u2014";
  const f3  = v => isFinite(v) ? v.toFixed(3) : "\u2014";
  const f4  = v => isFinite(v) ? v.toFixed(4) : "\u2014";
  const kN  = v => isFinite(v) ? (v/1000).toFixed(2) : "\u2014";
  const kNm = v => isFinite(v) ? (v/1e6).toFixed(3)  : "\u2014";
  const pct = v => isFinite(v) ? (v*100).toFixed(1)+"%": "\u2014";

  // ============================================================
  const ch = []; // document children array

  // ── COVER ────────────────────────────────────────────────
  ch.push(
    PC([tb("INTEGRATED BUILDING SERVICES", {size:32, color:CL.NAVY, allCaps:true})], {spacing:{before:0,after:40}}),
    PC([t("Structural Consultancy  |  Structural Audit  |  Project & Construction Management",
          {size:18, color:CL.MID, italics:true})], {spacing:{after:40}}),
    HR(CL.MID, 12), SP(80),
    PC([tb("STRUCTURAL CALCULATION SHEET", {size:36, color:CL.BLUE})], {spacing:{after:60}}),
    PC([t("Composite Beam Design  —  IS 11384 : 2022", {size:26, color:CL.MID})], {spacing:{after:180}})
  );

  // Project info 4-row 2-col table (no outer borders)
  const PH = Math.floor(CONTENT/2);
  const PR2 = Math.floor(PH*0.38);
  const PV2 = PH - PR2;
  const PRows = [
    [["Project",       PI.project],   ["Job / Ref. No.", PI.ref_no]],
    [["Building",      PI.building],  ["Date",           PI.date]],
    [["Floor Level",   PI.floor],     ["Designed by",    PI.designer]],
    [["Beam ID / Mark",PI.beam_id],   ["Checked by",     PI.checker]],
  ];
  ch.push(new Table({
    width:{ size:CONTENT, type:WidthType.DXA },
    columnWidths:[PR2,PV2,PR2,PV2],
    borders:{ top:{style:BorderStyle.SINGLE,size:8,color:CL.NAVY},
              bottom:{style:BorderStyle.SINGLE,size:8,color:CL.NAVY},
              left:BN.left, right:BN.right,
              insideH:{style:BorderStyle.SINGLE,size:1,color:CL.LIGHTER},
              insideV:BN.left },
    rows: PRows.map((pair, ri) => new TableRow({ children: pair.flatMap(([lbl,val]) => [
      new TableCell({ children:[new Paragraph({children:[tb(lbl+":", {size:18,color:CL.BLUE})],spacing:{after:0}})],
        width:{size:PR2,type:WidthType.DXA}, borders:BN,
        shading:{type:ShadingType.CLEAR, fill: ri%2===0?CL.ROW:CL.WHITE}, margins:CM }),
      new TableCell({ children:[new Paragraph({children:[tb(val,{size:20,color:CL.NAVY})],spacing:{after:0}})],
        width:{size:PV2,type:WidthType.DXA}, borders:BN,
        shading:{type:ShadingType.CLEAR, fill: ri%2===0?CL.ROW:CL.WHITE}, margins:CM })
    ])}))
  }), SP(120));

  // Overall status box
  const OC = R.overall_ok ? CL.PASS : CL.FAIL;
  const OT = R.overall_ok ? "DESIGN  SATISFACTORY" : "DESIGN  INADEQUATE";
  ch.push(new Table({
    width:{size:CONTENT,type:WidthType.DXA}, columnWidths:[CONTENT],
    rows:[new TableRow({ children:[new TableCell({
      children:[
        new Paragraph({children:[tb(OT,{size:28,color:CL.WHITE})], alignment:AlignmentType.CENTER,spacing:{after:0}}),
        new Paragraph({children:[t(`${sec.name}  |  ${geom.mode.toUpperCase()}  |  L = ${inp.L} m  |  Flex. utilisation: ${pct(R.flex_util)}`,
          {size:18,color:CL.WHITE})], alignment:AlignmentType.CENTER, spacing:{after:0}})
      ],
      width:{size:CONTENT,type:WidthType.DXA},
      shading:{type:ShadingType.CLEAR,fill:OC},
      margins:{top:140,bottom:140,left:200,right:200}, borders:BN
    })]})]}),
  SP(80), new Paragraph({ children:[new PageBreak()] }));

  // ── 1. PARAMETERS ────────────────────────────────────────
  ch.push(SH("Design Parameters", 1), SH2("1.1  Geometric Parameters"),
    MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["Note",C.S]]),
      DR("Span  L",                                f2(inp.L),           "m",   null, false),
      DR("Beam spacing / Tributary width",          f0(inp.beam_spacing),"mm",  null, true),
      DR("Beam position",                           inp.beam_position,   "",    null, false),
      DR("Effective slab width  beff",              f0(beff_mm),         "mm",  null, true),
      DR("Deck profile",                            inp.deck_profile,    "",    null, false),
      DR("Deck rib height  Td",                     f0(inp.Td),          "mm",  null, true),
      DR("Concrete topping  Tc",                    f0(inp.Tc),          "mm",  null, false),
      DR("Overall slab thickness  Ts",              f0(inp.Ts),          "mm",  null, true),
      DR("Opening diameter  Do",                    geom.Do>0?f0(geom.Do):"NIL","mm",null,false),
      DR("Expanded beam depth  d_new",              f2(geom.d_new),      "mm",  null, true),
    ])
  );

  ch.push(SP(80), SH2("1.2  Material Parameters"),
    MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["",C.S]]),
      DR("Concrete grade  fck",                    f0(inp.fck),         "MPa", null, false),
      DR("Concrete modulus  Ec = 5000\u221afck",   f0(trans.E_c),       "MPa", null, true),
      DR("Steel grade  fy",                        f0(inp.fy),          "MPa", null, false),
      DR("Steel modulus  Es",                      "200 000",           "MPa", null, true),
      DR("Creep factor  Kc",                       f2(MATERIALS.Kc),    "",    null, false),
      DR("Short-term modular ratio  Es/Ec",        f2(trans.m_short),   "",    null, true),
      DR("Long-term modular ratio  Es/(Kc\u00b7Ec)",f2(trans.m_long),   "",    null, false),
      DR("Partial material factor  \u03b3m0",      f2(MATERIALS.gamma_m0),"",  null, true),
      DR("ULS load factor",                        f2(inp.load_factor), "",    null, false),
      DR("Degree of shear connection  \u03b7",     f2(inp.eta),         "",    null, true),
      DR("Propped construction",                   inp.propped?"YES":"NO","",  null, false),
    ])
  );

  // ── 2. SECTION PROPERTIES ────────────────────────────────
  ch.push(SP(80), SH("Steel Section Properties", 2),
    MT([
      HR2([["Property",C.L],["Symbol",C.V],["Value",C.U],["Unit",C.S]]),
      DR("Section designation",  sec.name,    "",  null, false),
      DR("Overall depth",        "d",     f0(sec.d)+" mm",     null, true),
      DR("Flange width",         "bf",    f0(sec.bf)+" mm",    null, false),
      DR("Flange thickness",     "tf",    f2(sec.tf)+" mm",    null, true),
      DR("Web thickness",        "tw",    f2(sec.tw)+" mm",    null, false),
      DR("Area",                 "A",     f0(sec.A)+" mm\u00b2",null, true),
      DR("Moment of inertia",    "Ix",    (sec.Ix/1e4).toFixed(0)+" cm\u2074", null, false),
      DR("Elastic modulus",      "Zex",   f0(sec.Zex)+" mm\u00b3", null, true),
      DR("Plastic modulus",      "Zpx",   f0(sec.Zpx)+" mm\u00b3", null, false),
      DR("Radius of gyration",   "rx",    f2(sec.rx)+" mm",    null, true),
      DR("Self-weight",          "w",     f2(sec.w)+" kg/m",   null, false),
      DR("Total beam weight",    "W",     f2(beam_wt||sec.w*inp.L)+" kg", null, true),
    ])
  );

  // ── 3. LOADS ─────────────────────────────────────────────
  ch.push(SP(80), SH("Load Analysis", 3), SH2("3.1  Load Intensities"),
    MT([
      HR2([["Load Component",C.L],["Intensity",C.V],["Unit",C.U],["UDL N/mm",C.S]]),
      DR("Slab self weight (25 kN/m\u00b3 \u00d7 (Td/2+Tc))", f2(ld.slab_kgm2),  "kg/m\u00b2", null, false),
      DR("Live load  LL",          f2(inp.LL),  "kg/m\u00b2", null, true),
      DR("Floor finish  FF",       f2(inp.FF),  "kg/m\u00b2", null, false),
      DR("Partition  PR",          f2(inp.PR),  "kg/m\u00b2", null, true),
      DR("Filling  FI",            f2(inp.FI),  "kg/m\u00b2", null, false),
      DR("Construction load  CL",  f2(inp.CL),  "kg/m\u00b2", null, true),
      DR("Wall line load  WL",     f2(inp.WL),  "kg/m",       null, false),
    ])
  );
  ch.push(SP(60), SH2("3.2  Factored ULS Forces"),
    MT([
      HR2([["Quantity",C.L],["Value",C.V],["Unit",C.U],["",C.S]]),
      DR("Service UDL",                                        f2(ld.service_kgpm),  "kg/m",  null, false),
      DR("Factored UDL (\u00d7"+f2(inp.load_factor)+")",       f2(ld.factored_kgpm), "kg/m",  null, true),
      DR("Factored shear  Vf",                                  kN(ld.V_fact)+" kN  ("+f2(ld.V_fact/9810)+" t)", "", null, false),
      DR("Factored moment  Mf",                                 kNm(ld.M_fact)+" kN\u00b7m  ("+f2(ld.M_fact/(9810*1e3))+" t\u00b7m)", "", null, true),
    ])
  );

  // ── 4. BENDING ───────────────────────────────────────────
  ch.push(SP(80), SH("Bending Capacity  \u2014  IS 11384:2022 Table 16", 4),
    P([t("Plastic neutral axis location determined per IS 11384:2022 Table 16.  "+
         "a = fy/(0.36\u00b7fck) = "+f3(inp.fy/(0.36*inp.fck))+" mm",
         {size:19, color:CL.GREY})], {spacing:{after:80}}),
    MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["Status",C.S]]),
      DR("PNA Case",                    bending.caseNo.toString(),"",    null, false),
      DR("a = fy / (0.36\u00b7fck)",   f3(inp.fy/(0.36*inp.fck)),"",    null, true),
      DR("Deck depth  ds = Td",         f0(inp.Td),               "mm",  null, false),
      DR("dc (slab top to centroid)",   f2(inp.Ts+geom.d_new/2),  "mm",  null, true),
      DR("Plastic neutral axis  xu",    f2(bending.xu_mm),        "mm",  null, false),
      DR("Nominal capacity  Md",        kNm(bending.Md_Nmm),      "kN\u00b7m", null, true),
      DR("Design capacity  \u03c6Md (\u03c6=0.90)", kNm(bending.phi_Md), "kN\u00b7m", null, false),
      DR("Applied moment  Mf",          kNm(ld.M_fact),           "kN\u00b7m", null, true),
      DR("Utilisation  Mf / \u03c6Md",  f3(R.flex_util),          "",    R.flex_ok, false),
    ])
  );

  // ── 5. SHEAR ─────────────────────────────────────────────
  ch.push(SP(80), SH("Shear Capacity  \u2014  IS 800:2007 Cl. 8.4", 5),
    MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["Status",C.S]]),
      DR("Web height between holes  h_post",  f2(shear.h_post),   "mm",  null, false),
      DR("Each post height  h_each",           f2(shear.h_each),   "mm",  null, true),
      DR("Web thickness  tw",                  f2(sec.tw),         "mm",  null, false),
      DR("Slenderness ratio  h/tw",            f2(shear.h_over_tw),"",    null, true),
      DR("Buckling stress  \u03c4cr",          f2(shear.tau_cr),   "MPa", null, false),
      DR("Slenderness parameter  \u03bbw",     f3(shear.lambda_w), "",    null, true),
      DR("Design shear stress  Tv",            f2(shear.Tv_MPa),   "MPa", null, false),
      DR("Web area per post  Aw",              f0(shear.Aw),       "mm\u00b2", null, true),
      DR("Total shear capacity  Vn",           kN(shear.Vn_total), "kN",  null, false),
      DR("Applied shear  Vf",                  kN(ld.V_fact),      "kN",  null, true),
      DR("Utilisation  Vf / Vn",               f3(shear.util),     "",    shear.ok, false),
    ])
  );
  if (shear.note) ch.push(P([tb("Note: ",{color:CL.WARN}), t(shear.note,{color:CL.WARN,size:19})],{spacing:{after:60}}));
  if (shear.stiff_req) ch.push(P([tb("\u26a0  Web stiffeners required at openings.",{color:CL.FAIL,size:20})],{spacing:{after:60}}));

  // ── 6. VIERENDEEL ────────────────────────────────────────
  ch.push(SP(80), SH("Vierendeel Check at Beam Openings", 6));
  if (vier) {
    ch.push(MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["Status",C.S]]),
      DR("Applied shear  V",                       kN(ld.V_fact),        "kN",   null, false),
      DR("Vierendeel moment  Mv = V \u00d7 (d/4)", kNm(vier.Mv),        "kN\u00b7m",null,true),
      DR("Tee section area  A_tee = A/2",          f0(sec.A/2),          "mm\u00b2",null,false),
      DR("Tee capacity  \u03c6Mn_tee",             kNm(0.9*vier.Mn_tee),"kN\u00b7m",null,true),
      DR("Axial force  N_tee = Mf/d_eff",          kN(vier.N_tee),       "kN",   null, false),
      DR("Bending utilisation",                    f3(vier.util_bend),   "",     null, true),
      DR("Axial utilisation",                      f3(vier.util_axial),  "",     null, false),
      DR("Combined (M+N)",                         f3(vier.combined),    "",     vier_ok, true),
    ]));
  } else {
    ch.push(P("Not applicable — Full I-beam selected (no web openings).",{spacing:{after:80}}));
  }

  // ── 7. LTB ───────────────────────────────────────────────
  ch.push(SP(80), SH("Lateral Torsional Buckling  \u2014  IS 800:2007 Cl. 8.2", 7),
    P([t("Checked at construction stage — steel beam supporting wet concrete without composite action.",
         {size:19,color:CL.GREY})],{spacing:{after:80}}),
    MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["Status",C.S]]),
      DR("Effective length  Le = L",       f2(inp.L*1000),       "mm",  null, false),
      DR("LTB slenderness  \u03bbLT",      f4(ltb.lambda_LT),    "",    null, true),
      DR("Imperfection factor \u03b1",     "0.21 (rolled)",      "",    null, false),
      DR("Reduction factor  \u03c7LT",     f4(ltb.chi_LT),       "",    null, true),
      DR("LTB capacity  Md_ltb",           kNm(ltb.Md_ltb),      "kN\u00b7m",null,false),
      DR("Construction moment",            kNm(ltb.M_construction_Nmm),"kN\u00b7m",null,true),
      DR("Utilisation  M / \u03c6Md_ltb", f3(ltb.ltb_util),     "",    ltb.ltb_ok, false),
    ])
  );

  // ── 8. DEFLECTION ────────────────────────────────────────
  ch.push(SP(80), SH("Deflection Checks  \u2014  IS 11384:2022", 8), SH2("8.1  Composite Section Properties"),
    MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["",C.S]]),
      DR("Centroid from slab top (short-term)",  f2(trans.y_bar_short),  "mm",       null, false),
      DR("Centroid from slab top (long-term)",   f2(trans.y_bar_long),   "mm",       null, true),
      DR("Composite I (short-term)",             (trans.I_comp_short/1e4).toFixed(0),"cm\u2074",null,false),
      DR("Composite I (long-term)",              (trans.I_comp_long/1e4).toFixed(0), "cm\u2074",null,true),
      DR("EI composite (short)",                 (trans.EI_short/1e12).toFixed(3),   "GN\u00b7mm\u00b2",null,false),
      DR("EI composite (long)",                  (trans.EI_long/1e12).toFixed(3),    "GN\u00b7mm\u00b2",null,true),
    ])
  );
  ch.push(SP(60), SH2("8.2  Deflection Results  (\u03b4 = 5wL\u2074 / 384EI)"),
    MT([
      HR2([["Stage",C.L],["\u03b4 (mm)",C.V],["Limit (mm)",C.U],["Status",C.S]]),
      DR("Part A — Construction (steel-only dead)",   f2(defl.delta_A),       inp.propped?"Propped-N/A":f2(defl.limit), inp.propped?null:(defl.delta_A<=defl.limit), false),
      DR("Part B — Short-term live (composite)",      f2(defl.delta_B_short), f2(defl.limit), null, true),
      DR("Part B total SLS",                          f2(defl.delta_B_total), f2(defl.limit), defl.partB_ok, false),
      DR("Part C — Long-term sustained",              f2(defl.delta_C),       f2(defl.limit), defl.partC_ok, true),
      DR("Total long-term  (A + C)",                  f2(defl.delta_total_LT),"Informational",null, false),
    ]),
    P([tb("Limit: ",{size:19}), t("min(L/360, 20 mm) = "+f2(defl.limit)+" mm  [IS 11384:2022 Cl. 12]",{size:19,color:CL.GREY})],{spacing:{after:80}})
  );
  ch.push(SH2("8.3  Floor Natural Frequency"),
    MT([
      HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["Status",C.S]]),
      DR("Service deflection \u03b4_Bshort",  f2(defl.delta_B_short), "mm", null, false),
      DR("fn = (\u03c0/2)\u221a(g/\u03b4)",   f2(fn),                  "Hz", fn_ok, true),
      DR("Minimum (ISO 10137, offices)",       "4.0",                   "Hz", null, false),
    ])
  );

  // ── 9. STUDS ─────────────────────────────────────────────
  ch.push(SP(80), SH("Shear Stud Connectors  \u2014  IS 11384:2022 Cl. 9", 9));
  if (studs) {
    ch.push(SH2("9.1  Stud Capacity"),
      MT([
        HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["",C.S]]),
        DR("Stud diameter",                 studs.dia+" mm",       "",    null, false),
        DR("Qn (characteristic, fck=25)",   kN(studs.Qn_N),       "kN",  null, true),
        DR("fck scale factor",              f3(inp.fck/25),        "",    null, false),
        DR("Deck reduction  Rg",            f3(studs.Rg),          "",    null, true),
        DR("Position factor  Rp",           f3(studs.Rp),          "",    null, false),
        DR("Qn reduced (Rg\u00b7Rp\u00b7Qn)", kN(studs.Qn_red),  "kN",  null, true),
      ])
    );
    ch.push(SP(60), SH2("9.2  Connector Layout"),
      MT([
        HR2([["Parameter",C.L],["Value",C.V],["Unit",C.U],["Status",C.S]]),
        DR("Slab compression  Cs = 0.36\u00b7fck\u00b7beff\u00b7Ts", kN(studs.C_slab), "kN", null, false),
        DR("Target force (\u03b7 \u00d7 Cs)",     kN(studs.C_target),  "kN",  null, true),
        DR("Studs per half-span  n_half",          studs.n_half.toString(),"",  null, false),
        DR("Total studs",                          studs.n_total.toString(),"", null, true),
        DR("Spacing (uniform over half-span)",     f0(studs.spacing),   "mm",  studs.ok, false),
        DR("Min spacing (5d or 150 mm)",           f0(studs.s_min),     "mm",  null, true),
        DR("Max spacing (600 mm or 4\u00d7Ts)",   f0(studs.s_max),     "mm",  null, false),
      ])
    );
  } else {
    ch.push(P("Stud data not available.",{spacing:{after:80}}));
  }

  // ── 10. SUMMARY ──────────────────────────────────────────
  ch.push(SP(80), SH("Summary of All Design Checks", 10));
  const SD = [
    ["Bending  (ULS)",                pct(R.flex_util),                 R.flex_ok],
    ["Shear  (ULS)",                  pct(shear.util),                  shear.ok],
    vier ? ["Vierendeel  (opening)",  pct(vier.combined),               vier_ok] : null,
    ["LTB  (construction stage)",     pct(ltb.ltb_util),               ltb.ltb_ok],
    ["Deflection — Part B  (SLS)",    f2(defl.delta_B_total)+" / "+f2(defl.limit)+" mm", defl.partB_ok],
    ["Deflection — Part C  (LT)",     f2(defl.delta_C)+" / "+f2(defl.limit)+" mm",       defl.partC_ok],
    ["Floor frequency",               f2(fn)+" Hz",                     fn_ok],
    studs ? ["Stud spacing",          f0(studs.spacing)+" mm",         studs.ok] : null,
    ["OVERALL ASSESSMENT",            R.overall_ok?"SATISFACTORY":"INADEQUATE", R.overall_ok],
  ].filter(Boolean);

  const SW = Math.floor(CONTENT*0.55), SW2 = CONTENT-SW;
  ch.push(new Table({
    width:{size:CONTENT,type:WidthType.DXA}, columnWidths:[SW,SW2],
    rows:[
      new TableRow({ tableHeader:true, children:[
        new TableCell({ children:[new Paragraph({children:[tb("Check Item",{color:CL.WHITE,size:20})],spacing:{after:0}})],
          width:{size:SW,type:WidthType.DXA}, shading:{type:ShadingType.CLEAR,fill:CL.NAVY}, margins:CM, borders:BA }),
        new TableCell({ children:[new Paragraph({children:[tb("Result",{color:CL.WHITE,size:20})],spacing:{after:0},alignment:AlignmentType.CENTER})],
          width:{size:SW2,type:WidthType.DXA}, shading:{type:ShadingType.CLEAR,fill:CL.NAVY}, margins:CM, borders:BA })
      ]}),
      ...SD.map(([lbl,val,ok],i) => {
        const last = lbl.startsWith("OVERALL");
        const bg   = last ? (ok?CL.PASS:CL.FAIL) : (i%2===0?CL.ROW:CL.WHITE);
        const tc   = last ? CL.WHITE : (ok?CL.PASS:CL.FAIL);
        const sz   = last ? 22 : 20;
        return new TableRow({ children:[
          new TableCell({ children:[new Paragraph({children:[tb(lbl,{size:sz,color:last?CL.WHITE:CL.NAVY})],spacing:{after:0}})],
            width:{size:SW,type:WidthType.DXA}, shading:{type:ShadingType.CLEAR,fill:bg}, margins:CM, borders:BA }),
          new TableCell({ children:[new Paragraph({children:[tb((ok?"\u2713 PASS  ":"\u2717 FAIL  ")+val,{size:sz,color:tc})],spacing:{after:0},alignment:AlignmentType.CENTER})],
            width:{size:SW2,type:WidthType.DXA}, shading:{type:ShadingType.CLEAR,fill:bg}, margins:CM, borders:BA })
        ]});
      })
    ]
  }));

  // ── SIGN-OFF ─────────────────────────────────────────────
  ch.push(SP(200), HR(CL.MID,6));
  const HS = Math.floor(CONTENT/2);
  ch.push(new Table({
    width:{size:CONTENT,type:WidthType.DXA}, columnWidths:[HS,CONTENT-HS],
    borders:{top:BN.top,bottom:BN.bottom,left:BN.left,right:BN.right,insideH:BN.top,insideV:BN.left},
    rows:[new TableRow({ children:[
      new TableCell({ children:[
        P([tb("Prepared by:",{size:20,color:CL.BLUE})]), SP(80),
        P([tb(PI.designer||"________________________",{size:22})]),
        P([t("Structural Engineer",{size:18,color:CL.GREY})]),
        P([t("Integrated Building Services",{size:18,color:CL.GREY})]),
      ], width:{size:HS,type:WidthType.DXA}, borders:BN, margins:{top:100,bottom:100,left:0,right:200} }),
      new TableCell({ children:[
        P([tb("Checked by:",{size:20,color:CL.BLUE})]), SP(80),
        P([tb(PI.checker||"________________________",{size:22})]),
        P([t("Structural Engineer",{size:18,color:CL.GREY})]),
        P([t("Integrated Building Services",{size:18,color:CL.GREY})]),
      ], width:{size:CONTENT-HS,type:WidthType.DXA}, borders:BN, margins:{top:100,bottom:100,left:200,right:0} })
    ]})]
  }));
  ch.push(
    SP(100),
    PC([t("Generated by IBS-TOOL-004  |  IS 11384:2022  |  "+PI.generated,{size:16,color:CL.LGREY})]),
    PC([t("DISCLAIMER: Preliminary design only. Verify with a qualified structural engineer before use in construction.",
          {size:15,color:CL.LGREY,italics:true})])
  );

  // ── HEADER / FOOTER ───────────────────────────────────────
  const HDR = { default: new Header({ children:[
    new Paragraph({
      children:[
        tb("IBS \u2014 COMPOSITE BEAM DESIGN",{size:18,color:CL.BLUE}),
        t("  |  "+PI.project+"  |  "+PI.building+"  |  Beam: "+PI.beam_id,{size:18,color:CL.GREY})
      ],
      spacing:{after:0},
      border:{bottom:{style:BorderStyle.SINGLE,size:4,color:CL.MID}}
    })
  ]})}
  const FTR = { default: new Footer({ children:[
    new Paragraph({
      children:[
        t("Ref: "+PI.ref_no+"  |  IS 11384:2022  |  Page ",{size:16,color:CL.LGREY}),
        new TextRun({children:[PageNumber.CURRENT],size:16,color:CL.LGREY}),
        t(" of ",{size:16,color:CL.LGREY}),
        new TextRun({children:[PageNumber.TOTAL_PAGES],size:16,color:CL.LGREY}),
        t("  |  Date: "+PI.date,{size:16,color:CL.LGREY})
      ],
      spacing:{before:0}, alignment:AlignmentType.CENTER,
      border:{top:{style:BorderStyle.SINGLE,size:4,color:CL.MID}}
    })
  ]})}

  // ── BUILD ────────────────────────────────────────────────
  const document2 = new Document({
    creator:"Integrated Building Services",
    title:"Composite Beam Design — IS 11384:2022",
    subject:PI.project+" — "+PI.building+" — "+PI.beam_id,
    styles:{
      default:{ document:{ run:{ font:"Calibri", size:20, color:"000000" } } },
      paragraphStyles:[{
        id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal",
        run:{size:28,bold:true,font:"Calibri",color:CL.BLUE},
        paragraph:{spacing:{before:280,after:120},outlineLevel:0}
      }]
    },
    numbering:{ config:[{
      reference:"bullets",
      levels:[{level:0,format:LevelFormat.BULLET,text:"\u2022",
               alignment:AlignmentType.LEFT,
               style:{paragraph:{indent:{left:720,hanging:360}}}}]
    }]},
    sections:[{
      properties:{ page:{
        size:{width:11906,height:16838},
        margin:{top:1080,right:1080,bottom:1080,left:1080}
      }},
      headers: HDR,
      footers: FTR,
      children: ch
    }]
  });

  const blob = await Packer.toBlob(document2);
  const url  = URL.createObjectURL(blob);
  const a    = window.document.createElement('a');
  const beamTag = (PI.beam_id||'Beam').replace(/[^a-zA-Z0-9\-]/g,'_');
  const dateTag = new Date().toISOString().slice(0,10);
  a.href     = url;
  a.download = `IBS-TOOL-004_${beamTag}_${sec.name}_${dateTag}.docx`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
