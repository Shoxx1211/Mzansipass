// src/data/transportZones.ts

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface TransportStop {
  id: string;
  name: string;
  location: Coordinate;
  type:
    | "station"
    | "stop"
    | "rank"
    | "corridor";
}

export interface TransportNetworkZone {
  id: string;
  name: string;
  city: string;

  enabled: boolean;

  coverageRadiusKm: number;

  center: Coordinate;

  stops: TransportStop[];

  strengths: {
    cheapest: boolean;
    fastest: boolean;
    safest: boolean;
    reliable: boolean;
    leastWalking: boolean;
  };
}

// ======================================================
// JOHANNESBURG - REA VAYA
// ======================================================

export const REA_VAYA_ZONE: TransportNetworkZone = {
  id: "rea-vaya",

  name: "Rea Vaya",

  city: "Johannesburg",

  enabled: true,

  coverageRadiusKm: 35,

  center: {
    lat: -26.2041,
    lng: 28.0473
  },

  stops: [

    // MAIN STATIONS
    {
      id: "rv_thokoza_park",
      name: "Thokoza Park Station",
      type: "station",
      location: {
        lat: -26.2346,
        lng: 27.9068
      }
    },

    {
      id: "rv_parktown",
      name: "Parktown Station",
      type: "station",
      location: {
        lat: -26.1829,
        lng: 28.0405
      }
    },

    {
      id: "rv_ellis_park",
      name: "Ellis Park Station",
      type: "station",
      location: {
        lat: -26.2049,
        lng: 28.0588
      }
    },

    // FEEDER / COMPLEMENTARY
    {
      id: "rv_braamfontein",
      name: "Braamfontein Stop",
      type: "stop",
      location: {
        lat: -26.1921,
        lng: 28.0379
      }
    },

    {
      id: "rv_uj_soweto",
      name: "UJ Soweto Stop",
      type: "stop",
      location: {
        lat: -26.2601,
        lng: 27.8542
      }
    },

    // CORRIDORS
    {
      id: "rv_empire_corridor",
      name: "Empire Road Corridor",
      type: "corridor",
      location: {
        lat: -26.1818,
        lng: 28.0245
      }
    }
  ],

  strengths: {
    cheapest: true,
    fastest: true,
    safest: true,
    reliable: true,
    leastWalking: false
  }
};

// ======================================================
// GAUTRAIN
// ======================================================

export const GAUTRAIN_ZONE: TransportNetworkZone = {
  id: "gautrain",

  name: "Gautrain",

  city: "Gauteng",

  enabled: true,

  coverageRadiusKm: 80,

  center: {
    lat: -26.1367,
    lng: 28.2411
  },

  stops: [

    {
      id: "gt_park",
      name: "Park Station",
      type: "station",
      location: {
        lat: -26.2048,
        lng: 28.0436
      }
    },

    {
      id: "gt_sandton",
      name: "Sandton Station",
      type: "station",
      location: {
        lat: -26.1076,
        lng: 28.0567
      }
    },

    {
      id: "gt_midrand",
      name: "Midrand Station",
      type: "station",
      location: {
        lat: -25.9994,
        lng: 28.1269
      }
    },

    {
      id: "gt_pretoria",
      name: "Pretoria Station",
      type: "station",
      location: {
        lat: -25.7479,
        lng: 28.1881
      }
    },

    {
      id: "gt_or_tambo",
      name: "OR Tambo Station",
      type: "station",
      location: {
        lat: -26.1337,
        lng: 28.2420
      }
    }
  ],

  strengths: {
    cheapest: false,
    fastest: true,
    safest: true,
    reliable: true,
    leastWalking: true
  }
};

// ======================================================
// TSHWANE A RE YENG
// ======================================================

export const A_RE_YENG_ZONE: TransportNetworkZone = {
  id: "a-re-yeng",

  name: "A Re Yeng",

  city: "Pretoria",

  enabled: true,

  coverageRadiusKm: 30,

  center: {
    lat: -25.7479,
    lng: 28.2293
  },

  stops: [

    {
      id: "ary_church_square",
      name: "Church Square Station",
      type: "station",
      location: {
        lat: -25.7461,
        lng: 28.1881
      }
    },

    {
      id: "ary_hatfield",
      name: "Hatfield Stop",
      type: "stop",
      location: {
        lat: -25.7484,
        lng: 28.2316
      }
    }
  ],

  strengths: {
    cheapest: true,
    fastest: true,
    safest: true,
    reliable: true,
    leastWalking: false
  }
};

// ======================================================
// TAXI NETWORK
// ======================================================

export const TAXI_ZONE: TransportNetworkZone = {
  id: "taxi",

  name: "Minibus Taxi",

  city: "South Africa",

  enabled: true,

  coverageRadiusKm: 999,

  center: {
    lat: -26.2041,
    lng: 28.0473
  },

  stops: [

    {
      id: "taxi_bara",
      name: "Bara Taxi Rank",
      type: "rank",
      location: {
        lat: -26.2608,
        lng: 27.9426
      }
    },

    {
      id: "taxi_noord",
      name: "Noord Taxi Rank",
      type: "rank",
      location: {
        lat: -26.1951,
        lng: 28.0403
      }
    },

    // MAIN ROAD PICKUP CORRIDORS
    {
      id: "taxi_louis_botha",
      name: "Louis Botha Corridor",
      type: "corridor",
      location: {
        lat: -26.1635,
        lng: 28.0762
      }
    },

    {
      id: "taxi_empire",
      name: "Empire Road Corridor",
      type: "corridor",
      location: {
        lat: -26.1818,
        lng: 28.0245
      }
    }
  ],

  strengths: {
    cheapest: true,
    fastest: false,
    safest: false,
    reliable: false,
    leastWalking: true
  }
};

// ======================================================
// EXPORT ALL
// ======================================================

export const TRANSPORT_ZONES: TransportNetworkZone[] = [
  REA_VAYA_ZONE,
  GAUTRAIN_ZONE,
  A_RE_YENG_ZONE,
  TAXI_ZONE
];