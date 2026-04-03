/**
 * IS 875 (Part 2) - 1987 Live Load Database
 * Integrated Building Services (IBS) - Slab Design Tool
 */

const IS875_LOADS = {
  residential: {
    label: "Residential Buildings",
    icon: "🏠",
    subtypes: {
      bedroom:         { label: "Bedrooms & Lounges",              ll: 2.0 },
      living:          { label: "Living / Drawing Rooms",          ll: 2.0 },
      dining:          { label: "Dining Rooms",                    ll: 2.0 },
      kitchen:         { label: "Kitchens",                        ll: 2.0 },
      toilet:          { label: "Toilets & Bathrooms",             ll: 2.0 },
      balcony:         { label: "Balconies",                       ll: 3.0 },
      staircase:       { label: "Staircases & Landings",           ll: 3.0 },
      store:           { label: "Store Rooms",                     ll: 5.0 },
      roof_accessible: { label: "Accessible Roof (flat)",          ll: 1.5 },
      roof_garden:     { label: "Roof Garden",                     ll: 4.0 },
    }
  },
  office: {
    label: "Office Buildings",
    icon: "🏢",
    subtypes: {
      office_general:  { label: "General Office Space",            ll: 2.5 },
      office_files:    { label: "Office with Filing / Storage",    ll: 5.0 },
      reception:       { label: "Reception / Lobby / Corridors",   ll: 3.0 },
      conference:      { label: "Conference / Meeting Rooms",      ll: 3.0 },
      canteen:         { label: "Canteen / Staff Room",            ll: 3.0 },
      server_room:     { label: "Server / Electrical Room",        ll: 5.0 },
      toilet_office:   { label: "Toilets",                         ll: 2.0 },
      stair_office:    { label: "Staircases & Corridors",          ll: 4.0 },
      parking_below:   { label: "Parking (below office)",          ll: 5.0 },
    }
  },
  educational: {
    label: "Educational Buildings",
    icon: "🏫",
    subtypes: {
      classroom:       { label: "Classrooms",                      ll: 3.0 },
      corridor_edu:    { label: "Corridors & Passages",            ll: 4.0 },
      library_read:    { label: "Library Reading Room",            ll: 4.0 },
      library_stack:   { label: "Library Stack Room",              ll: 6.0 },
      lab:             { label: "Laboratories",                    ll: 3.0 },
      assembly:        { label: "Assembly Hall / Auditorium",      ll: 4.0 },
      gym:             { label: "Gymnasium",                       ll: 5.0 },
      dining_edu:      { label: "Dining Hall / Canteen",           ll: 3.0 },
    }
  },
  hospital: {
    label: "Hospital Buildings",
    icon: "🏥",
    subtypes: {
      ward:            { label: "Patient Wards",                   ll: 2.0 },
      corridor_hosp:   { label: "Corridors & Passages",            ll: 4.0 },
      operation:       { label: "Operation Theatres",              ll: 3.0 },
      xray:            { label: "X-Ray / Imaging Rooms",           ll: 3.0 },
      lab_hosp:        { label: "Laboratories",                    ll: 3.0 },
      pharmacy:        { label: "Pharmacy / Store",                ll: 5.0 },
      waiting:         { label: "Waiting / Reception Areas",       ll: 3.0 },
    }
  },
  industrial: {
    label: "Industrial / Factory",
    icon: "🏭",
    subtypes: {
      light_ind:       { label: "Light Industrial (general)",      ll: 5.0 },
      medium_ind:      { label: "Medium Industrial",               ll: 7.5 },
      heavy_ind:       { label: "Heavy Industrial / Plant Room",   ll: 10.0 },
      warehouse:       { label: "Warehouse / Storage",             ll: 7.5 },
      mezzanine:       { label: "Mezzanine Floor",                 ll: 5.0 },
    }
  },
  assembly: {
    label: "Assembly & Public Buildings",
    icon: "🏛️",
    subtypes: {
      fixed_seat:      { label: "Auditorium (Fixed Seating)",      ll: 4.0 },
      movable_seat:    { label: "Assembly Hall (Movable Seating)", ll: 5.0 },
      stage:           { label: "Stage Area",                      ll: 6.0 },
      lobby_public:    { label: "Lobbies & Foyers",                ll: 4.0 },
      museum:          { label: "Museum / Exhibition Hall",        ll: 4.0 },
      mall:            { label: "Shopping Mall / Retail",          ll: 4.0 },
      restaurant:      { label: "Restaurant / Food Court",         ll: 4.0 },
    }
  },
  parking: {
    label: "Parking Structures",
    icon: "🅿️",
    subtypes: {
      parking_car:     { label: "Car Parking (light vehicles)",    ll: 2.5 },
      parking_heavy:   { label: "Heavy Vehicle Parking",           ll: 7.5 },
      ramp:            { label: "Parking Ramp / Driveway",         ll: 5.0 },
    }
  }
};

/** Material Densities (kg/m³) — IS 875 Part 1 */
const MATERIAL_DENSITIES = {
  concrete_rcc:    { label: "RCC / Plain Concrete",         density: 2500 },
  concrete_plain:  { label: "Plain Concrete (PCC)",         density: 2400 },
  brick_masonry:   { label: "Brick Masonry",                density: 1900 },
  sand:            { label: "Sand / Filling Sand",           density: 1800 },
  gravel:          { label: "Gravel / Coarse Aggregate",    density: 1900 },
  murrum:          { label: "Murrum / Soil Fill",           density: 1800 },
  lime_concrete:   { label: "Lime Concrete",                density: 1900 },
  waterproof_comp: { label: "Waterproofing Compound",       density: 2000 },
  screed:          { label: "Cement Screed / Finishing",    density: 2100 },
  kota_stone:      { label: "Kota Stone / Natural Stone",   density: 2700 },
  marble:          { label: "Marble Flooring",              density: 2700 },
  tiles_ceramic:   { label: "Ceramic / Vitrified Tiles",    density: 2000 },
  cobba_brick:     { label: "Cobba (Brick Jelly Fill)",     density: 1700 },
  eps_foam:        { label: "EPS / Foam Insulation",        density: 25   },
};

/** Standard Finishing Load (IS 875) */
const FINISHING_LOAD_DEFAULT = 100; // kg/m²

/** IS 456 : 2000 — Design constants */
const IS456_CONSTANTS = {
  fck_options: [15, 20, 25, 30, 35, 40],   // MPa
  fy_options:  [250, 415, 500, 550],        // MPa
  cover_options: {
    mild:      { label: "Mild (≤25mm cover)",    c: 20 },
    moderate:  { label: "Moderate (30mm cover)", c: 25 },
    severe:    { label: "Severe (40mm cover)",   c: 35 },
    v_severe:  { label: "Very Severe (50mm cover)", c: 45 },
  },
  min_thickness: 120,   // mm
  delta_ratio:   350,   // L/350
  delta_max:     20,    // mm
  Lf:            1.5,   // load factor
};

if (typeof module !== "undefined") module.exports = { IS875_LOADS, MATERIAL_DENSITIES, IS456_CONSTANTS, FINISHING_LOAD_DEFAULT };
