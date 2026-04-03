/**
 * Retaining Wall Design Database
 * IS 456 : 2000 | IS 875 Part 5 | IBS Structural Tools
 */

const RW_SOILS = {
  loose_sand:   { label: "Loose Sand",                 gamma: 1600, phi: 28, c: 0,    mu: 0.40 },
  medium_sand:  { label: "Medium Dense Sand",          gamma: 1750, phi: 32, c: 0,    mu: 0.45 },
  dense_sand:   { label: "Dense Sand / Gravel",        gamma: 1900, phi: 36, c: 0,    mu: 0.50 },
  sandy_silt:   { label: "Sandy Silt",                 gamma: 1700, phi: 25, c: 5,    mu: 0.35 },
  stiff_clay:   { label: "Stiff Clay",                 gamma: 1800, phi: 20, c: 20,   mu: 0.30 },
  medium_clay:  { label: "Medium Clay",                gamma: 1750, phi: 15, c: 30,   mu: 0.25 },
  soft_clay:    { label: "Soft Clay",                  gamma: 1650, phi: 10, c: 40,   mu: 0.20 },
  murrum:       { label: "Murrum / Laterite",          gamma: 1900, phi: 30, c: 10,   mu: 0.42 },
  gravel:       { label: "Well Graded Gravel",         gamma: 2000, phi: 38, c: 0,    mu: 0.55 },
  rock_fill:    { label: "Rock Fill / Broken Stone",   gamma: 2200, phi: 40, c: 0,    mu: 0.60 },
};

const RW_SURCHARGE = {
  none:         { label: "No Surcharge",                    q: 0    },
  light:        { label: "Light Traffic (road, 5 kN/m²)",  q: 5    },
  medium:       { label: "Medium Traffic (10 kN/m²)",       q: 10   },
  heavy:        { label: "Heavy Traffic (20 kN/m²)",        q: 20   },
  floor_load:   { label: "Floor Load (15 kN/m²)",           q: 15   },
  crane_load:   { label: "Crane / Industrial (25 kN/m²)",   q: 25   },
  custom:       { label: "Custom Surcharge",                 q: null },
};

const RW_WALL_TYPES = {
  cantilever: {
    label: "Cantilever Retaining Wall",
    desc:  "Stem + base slab (heel & toe). Most common for H = 2–7 m.",
    icon:  "🧱"
  },
  gravity: {
    label: "Gravity Retaining Wall",
    desc:  "Mass concrete / masonry. Resists by self-weight. H < 3 m.",
    icon:  "🏔️"
  },
};

const RW_CONCRETE = {
  15: "M15",  20: "M20",  25: "M25",  30: "M30",
};

const RW_STEEL = {
  415: "Fe 415 HYSD",
  500: "Fe 500 HYSD",
};

const RW_FOS = {
  sliding:     1.5,
  overturning: 2.0,
  bearing:     1.0,  // SBC must not be exceeded
};

if (typeof module !== 'undefined') module.exports = { RW_SOILS, RW_SURCHARGE, RW_WALL_TYPES, RW_CONCRETE, RW_STEEL, RW_FOS };
