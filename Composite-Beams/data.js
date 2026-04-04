// ============================================================
// IBS-TOOL-004 · data.js
// Complete ISMB & ISWB database (IS 808), deck profiles
// ============================================================

const ISMB_DB = [
  { name:"ISMB100",  w:11.5,  d:100,  A:1460,   Ix:2575000,   Iy:408000,   Zex:51500,   Zey:10900,  Zpx:57439,   Zpy:20592,  bf:75,  tf:7.2,  tw:4.0,  dw:65.0,   rx:42.0,  ry:16.7 },
  { name:"ISMB125",  w:13.0,  d:125,  A:1660,   Ix:4490000,   Iy:437000,   Zex:71800,   Zey:11700,  Zpx:80180,   Zpy:21906,  bf:75,  tf:7.6,  tw:4.4,  dw:89.2,   rx:52.0,  ry:16.2 },
  { name:"ISMB150",  w:14.9,  d:150,  A:1900,   Ix:7264000,   Iy:526000,   Zex:96900,   Zey:13100,  Zpx:108384,  Zpy:25096,  bf:80,  tf:7.6,  tw:4.8,  dw:113.9,  rx:61.8,  ry:16.6 },
  { name:"ISMB175",  w:19.3,  d:175,  A:2462,   Ix:12720000,  Iy:850000,   Zex:145400,  Zey:18900,  Zpx:163032,  Zpy:36023,  bf:90,  tf:8.6,  tw:5.5,  dw:134.5,  rx:71.9,  ry:18.6 },
  { name:"ISMB200",  w:25.4,  d:200,  A:3233,   Ix:22354000,  Iy:1500000,  Zex:223500,  Zey:30000,  Zpx:249689,  Zpy:55449,  bf:100, tf:10.8, tw:5.7,  dw:152.7,  rx:83.2,  ry:21.5 },
  { name:"ISMB225",  w:31.2,  d:225,  A:3972,   Ix:34418000,  Iy:2183000,  Zex:305900,  Zey:39700,  Zpx:342647,  Zpy:73517,  bf:110, tf:11.8, tw:6.5,  dw:173.3,  rx:93.1,  ry:23.4 },
  { name:"ISMB250",  w:37.3,  d:250,  A:4755,   Ix:51316000,  Iy:3345000,  Zex:410500,  Zey:53500,  Zpx:458422,  Zpy:100334, bf:125, tf:12.5, tw:6.9,  dw:194.1,  rx:103.9, ry:26.5 },
  { name:"ISMB300",  w:44.2,  d:300,  A:5626,   Ix:86036000,  Iy:4539000,  Zex:573600,  Zey:64800,  Zpx:641277,  Zpy:125390, bf:140, tf:12.4, tw:7.5,  dw:241.5,  rx:123.7, ry:28.4 },
  { name:"ISMB350",  w:52.4,  d:350,  A:6671,   Ix:136303000, Iy:5377000,  Zex:778900,  Zey:76800,  Zpx:877009,  Zpy:144435, bf:140, tf:14.2, tw:8.1,  dw:288.0,  rx:142.9, ry:28.4 },
  { name:"ISMB400",  w:61.6,  d:400,  A:7846,   Ix:204584000, Iy:6221000,  Zex:1022900, Zey:88900,  Zpx:1161478, Zpy:164087, bf:140, tf:16.0, tw:8.9,  dw:334.4,  rx:161.5, ry:28.2 },
  { name:"ISMB450",  w:72.4,  d:450,  A:9227,   Ix:303908000, Iy:8340000,  Zex:1350700, Zey:111200, Zpx:1534205, Zpy:204922, bf:150, tf:17.4, tw:9.4,  dw:379.2,  rx:181.5, ry:30.1 },
  { name:"ISMB500",  w:86.9,  d:500,  A:11074,  Ix:452183000, Iy:13698000, Zex:1808700, Zey:152200, Zpx:2047546, Zpy:290750, bf:180, tf:17.2, tw:10.2, dw:424.1,  rx:202.1, ry:35.2 },
  { name:"ISMB550",  w:103.7, d:550,  A:13211,  Ix:648936000, Iy:18338000, Zex:2359800, Zey:193000, Zpx:2678361, Zpy:364403, bf:190, tf:19.3, tw:11.2, dw:467.5,  rx:221.6, ry:37.3 },
  { name:"ISMB600",  w:122.6, d:600,  A:15621,  Ix:918130000, Iy:26510000, Zex:3060400, Zey:252500, Zpx:3465377, Zpy:478742, bf:210, tf:20.8, tw:12.0, dw:509.7,  rx:242.4, ry:41.2 }
];

const ISWB_DB = [
  { name:"ISWB150",  w:17.0,  d:150,  A:2167,   Ix:8385000,   Iy:1054000,  Zex:111800,  Zey:21100,  Zpx:123872,  Zpy:39400,  bf:100, tf:7.4,  tw:5.4,  dw:113.5,  rx:62.2,  ry:22.1 },
  { name:"ISWB175",  w:22.1,  d:175,  A:2816,   Ix:15521000,  Iy:1842000,  Zex:177400,  Zey:33500,  Zpx:197200,  Zpy:61990,  bf:110, tf:8.0,  tw:5.8,  dw:133.7,  rx:74.3,  ry:25.6 },
  { name:"ISWB200",  w:25.9,  d:200,  A:3300,   Ix:22645000,  Iy:2431000,  Zex:226500,  Zey:40500,  Zpx:254990,  Zpy:76090,  bf:120, tf:9.0,  tw:6.1,  dw:154.1,  rx:82.8,  ry:27.2 },
  { name:"ISWB225",  w:33.4,  d:225,  A:4253,   Ix:38500000,  Iy:4093000,  Zex:342200,  Zey:58800,  Zpx:384100,  Zpy:109800, bf:140, tf:9.9,  tw:6.4,  dw:177.2,  rx:95.1,  ry:31.0 },
  { name:"ISWB250",  w:39.7,  d:250,  A:5057,   Ix:61500000,  Iy:5779000,  Zex:492000,  Zey:74100,  Zpx:551200,  Zpy:138500, bf:156, tf:10.7, tw:6.7,  dw:199.5,  rx:110.2, ry:33.8 },
  { name:"ISWB300",  w:48.1,  d:300,  A:6125,   Ix:98215000,  Iy:9918000,  Zex:654800,  Zey:109100, Zpx:739000,  Zpy:204600, bf:182, tf:10.4, tw:7.1,  dw:253.1,  rx:126.6, ry:40.2 },
  { name:"ISWB350",  w:56.9,  d:350,  A:7242,   Ix:160600000, Iy:13318000, Zex:918100,  Zey:133200, Zpx:1036800, Zpy:249700, bf:200, tf:11.4, tw:7.5,  dw:299.1,  rx:149.0, ry:42.9 },
  { name:"ISWB400",  w:66.7,  d:400,  A:8494,   Ix:247500000, Iy:19337000, Zex:1237500, Zey:173200, Zpx:1395500, Zpy:325500, bf:224, tf:12.7, tw:8.0,  dw:344.0,  rx:170.8, ry:47.7 },
  { name:"ISWB450",  w:79.4,  d:450,  A:10110,  Ix:370800000, Iy:30816000, Zex:1647000, Zey:231600, Zpx:1850700, Zpy:433200, bf:266, tf:13.0, tw:8.6,  dw:389.8,  rx:191.5, ry:55.2 },
  { name:"ISWB500",  w:94.5,  d:500,  A:12031,  Ix:525800000, Iy:39305000, Zex:2103200, Zey:281500, Zpx:2369500, Zpy:528000, bf:279, tf:14.7, tw:9.0,  dw:437.0,  rx:209.0, ry:57.1 },
  { name:"ISWB550",  w:104.0, d:550,  A:13240,  Ix:705600000, Iy:38818000, Zex:2566000, Zey:310700, Zpx:2891400, Zpy:582600, bf:250, tf:15.4, tw:9.8,  dw:483.0,  rx:230.9, ry:54.1 },
  { name:"ISWB600",  w:145.1, d:600,  A:18476,  Ix:1186200000,Iy:83340000, Zex:3954000, Zey:476200, Zpx:4436000, Zpy:892800, bf:350, tf:15.4, tw:11.2, dw:530.0,  rx:253.2, ry:67.2 }
];

// JSW Deck Profiles (TR50, TR60+, TR80+) — key geometry
// rib_h = rib height (Td), pitch = rib pitch (mm), rib_t = rib thickness (mm)
const DECK_PROFILES = {
  TR50: {
    name: "JSW TR50",
    rib_h: 50,     // mm  (Td used in slab self-weight calc)
    pitch: 150,    // mm  between ribs
    rib_top: 95,   // mm  top of rib width
    rib_bot: 55,   // mm  bottom rib width
    t_sheet: 0.75, // mm  sheet thickness
    min_topping: 50, // mm min concrete above deck (IS 11384)
    description: "Shallow deck – general floors up to 4 m unshored span",
    max_unshored: 4.0  // m
  },
  TR60: {
    name: "JSW TR60+",
    rib_h: 60,
    pitch: 185,
    rib_top: 120,
    rib_bot: 65,
    t_sheet: 0.75,
    min_topping: 50,
    description: "Medium deck – general floors up to 5 m unshored span",
    max_unshored: 5.0
  },
  TR80: {
    name: "JSW TR80+",
    rib_h: 80,
    pitch: 200,
    rib_top: 140,
    rib_bot: 80,
    t_sheet: 0.75,
    min_topping: 50,
    description: "Deep deck – long spans up to 6 m unshored span",
    max_unshored: 6.0
  },
  flat: {
    name: "Flat Slab (no deck)",
    rib_h: 0,
    pitch: 0,
    rib_top: 0,
    rib_bot: 0,
    t_sheet: 0,
    min_topping: 0,
    description: "Flat RC slab – full slab depth used directly",
    max_unshored: 999
  }
};

// Stud capacity table (IS 11384:2022 Table 9)
// Qn in kN for various fck and dia; base at fck=25
const STUD_TABLE = {
  16: { Q_fck25: 42.0,  h_min: 80,  dhead: 25 },
  19: { Q_fck25: 55.0,  h_min: 95,  dhead: 30 },
  22: { Q_fck25: 79.0,  h_min: 110, dhead: 35 },
  25: { Q_fck25: 100.0, h_min: 125, dhead: 38 }
};

// Material properties
const MATERIALS = {
  G: 9.81,            // N per kg (gravity)
  E_STEEL: 200000,    // MPa (IS 800 clause 2.2.4.1)
  POISSON: 0.3,
  gamma_m0: 1.10,     // partial factor for fy (IS 800)
  gamma_m1: 1.25,     // partial factor for buckling
  gamma_c:  1.50,     // partial factor for concrete
  Kc: 0.5,            // creep factor for long-term modular ratio
  concrete_density: 25000  // N/m³ (25 kN/m³)
};

// Section utilities
function getSectionDB(type) {
  return type === 'ISWB' ? ISWB_DB : ISMB_DB;
}
function getSection(name, type) {
  const db = getSectionDB(type);
  return db.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
}
function getDeck(key) {
  return DECK_PROFILES[key] || DECK_PROFILES.flat;
}
function getStudCap(dia, fck) {
  const diaDat = STUD_TABLE[dia] || STUD_TABLE[22];
  // Scale linearly with fck per IS 11384
  return (diaDat.Q_fck25 * 1000) * (fck / 25.0);  // returns N
}
