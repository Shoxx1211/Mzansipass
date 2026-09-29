import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Rea Vaya Phase 1B Schedule 7 Normalizer
//
// SOURCE
//   src/data/transit/gauteng/reavaya/raw/
//     phase-1b-service-specification-2026.pdf
//
// OUTPUT
//   src/data/transit/gauteng/reavaya/phase-1b-network.json
//   src/data/transit/gauteng/reavaya/phase-1b-normalization-report.json
//
// Scope:
// - official Phase 1B(b) route descriptions and one-way distances
// - official Phase 1B station inventory and physical-address labels
// - published feeder/complementary stop lists, preserving source order
// - conservative service metadata from Schedule 7
//
// NOT inferred:
// - GPS coordinates
// - GIS route geometry
// - exact stop coordinates
// - T2/T3 full ordered stop sequences
// - exact timetable departures
// - live arrivals / ETA
//
// Important fare rule:
// Schedule 7 embeds the OLD 2025/26 fare table. It is retained only
// as historical provenance and MUST NOT replace the current fares.json.
// ============================================================

const ROOT = path.resolve("src/data/transit/gauteng/reavaya");
const SOURCE_PDF = path.join(ROOT, "raw", "phase-1b-service-specification-2026.pdf");
const ROUTES_FILE = path.join(ROOT, "routes.json");
const OUTPUT_FILE = path.join(ROOT, "phase-1b-network.json");
const REPORT_FILE = path.join(ROOT, "phase-1b-normalization-report.json");

const STATIONS = [
  { name: "Thokoza Park Station", physicalAddress: "Chris Hani & Ntuli St." },
  { name: "Lake View Station", physicalAddress: "Chris Hani & Roodepoort Rd." },
  { name: "Klipspruit Valley Station", physicalAddress: "Klipspruit Valley Rd & Chris Hani" },
  { name: "Boomtown Station", physicalAddress: "Mooki & Sofasonke St." },
  { name: "Orlando Police Station", physicalAddress: "Mooki btwn Mashupa & Rathebe Str" },
  { name: "Orlando Stadium Station", physicalAddress: "Mooki btwn Martha Louw & Mofokeng St" },
  { name: "Noordgesig Extension", physicalAddress: "Diepkloof Overbridge & Soweto Hwy" },
  { name: "New Canada", physicalAddress: "Adjacent to New Canada Railway Station" },
  { name: "Bosmont", physicalAddress: "Highgate" },
  { name: "Industria West", physicalAddress: "Mariasburg Road" },
  { name: "Coronationville", physicalAddress: "Fulton Road" },
  { name: "Westbury", physicalAddress: "Westbury - Bernard Isaacs School" },
  { name: "Helen Joseph Hospital", physicalAddress: "Adjacent to Helen Joseph Hospital" },
  { name: "UJ Kingsway Campus", physicalAddress: "UJ Rossmore Campus - Kingsway Street" },
  { name: "UJ Sophiatown Res", physicalAddress: "Campus Square" },
  { name: "SABC Media Park", physicalAddress: "SABC Stanley Park" },
  { name: "Milpark", physicalAddress: "Owl Street" },
  { name: "Wits Station", physicalAddress: "Wits West Campus Empire Road" },
  { name: "Parktown", physicalAddress: "Hillside Road" },
  { name: "Constitutional Hill", physicalAddress: "Joubert Street" },
  { name: "Park Station", physicalAddress: "Rissik Street at Park Station" },
  { name: "Joburg Theatre", physicalAddress: "Loveday Street" },
  { name: "Harrison Street", physicalAddress: "Harrison Street South of Kerk Street" },
  { name: "Library Gardens Station Eastbound", physicalAddress: "Market & Rissik St" },
  { name: "Rissik Street", physicalAddress: "Commissioner" },
].map((station, index) => ({
  id: `reavaya-phase1b-station-${String(index + 1).padStart(2, "0")}`,
  ...station,
  coordinates: null,
  coordinateStatus: "not-provided-in-schedule-7",
}));

const ROUTES = [
  {
    code: "F6",
    family: "feeder",
    title: "Bosmont Station to Lea Glen",
    distanceKmOneDirection: 10,
    pathDescription: "Bosmont Rea Vaya Station at Main Reef / Commando Road, west along Main Reef Road to Hebbard Road, Robertville, and return.",
    publishedStops: [
      "Bosmont",
      "Main Reef&Steps",
      "Main Reef&Shaft",
      "Main Reef&Roberts",
      "Main Reef&Winze",
      "Main Reef&Granville Avenue",
      "Helpmekaar&Baobab",
      "Helpmekaar&Minerva",
      "Wildplum&Waxflower",
      "Wildplum&Wild Olive",
      "Buffalo 1",
      "Buffalo",
    ],
  },
  {
    code: "F7",
    family: "feeder",
    title: "Amalgam to Bosmont Station",
    distanceKmOneDirection: 10,
    pathDescription: "Bosmont Rea Vaya Station at Main Reef / Commando Road, east along Main Reef Road to Crownwood / Church and Main Reef Road, Amalgam, and return.",
    publishedStops: [
      "Bosmont",
      "Main Reef & Aalwyn road",
      "Main Reef&Croesus station",
      "Main Reef &Bed lounge",
      "Langlaagte Police station",
      "Main Reef&George Harrison Park",
      "Main Reef& Engen garage",
      "Langlaagte testing station",
      "Coach str& Carriage close",
    ],
  },
  {
    code: "F8",
    family: "feeder",
    title: "Westbury Station to Greymont",
    distanceKmOneDirection: 7,
    pathDescription: "Westbury Rea Vaya Station at Bernard Isaacs School in Fuel Road, via Steytler Road, Eric Place, 8th Road and Long Road to 10th Street.",
    publishedStops: [
      "10th&5th str",
      "Meyers&5th str",
      "Long&Second",
      "Waterval&8th str",
      "Van Zyl&8th str",
      "Spring road&8th str",
      "Eric&Police station",
      "Eric&Bessie",
      "Steytler&Eric",
      "Steytler&Dowing",
      "Steytler&Saythy",
      "Westbury station east",
      "Coronation Park",
      "Plumstead str",
      "Landsdown str",
      "Westbury station west",
    ],
  },
  {
    code: "F9",
    family: "feeder",
    title: "Mapetla to Thokoza Park",
    distanceKmOneDirection: 4.6,
    pathDescription: "From Tshithuthune Avenue / Sekhukhune Street via Manotshe Extension, Mabalane Street and Chris Hani Road to Thokoza Park Station.",
    publishedStops: [
      "Thokoza park",
      "Chris Hani&Dinizulu",
      "Mabalane&Umkhomazi",
      "pick&Pay",
      "Umhlali&Mabalane",
      "Phumuzile Primary school",
      "Mabalane&Manotshe",
      "Teleka Semane&Manotshe",
      "Mapetla High school",
      "Fanie&Sekhukhune",
      "Chiawela flats",
    ],
  },
  {
    code: "F10",
    family: "feeder",
    title: "Pimville to Klipspruit Rea Vaya Station (Lakeview Station)",
    distanceKmOneDirection: 4,
    pathDescription: "From Morobadilepe Street / Mndoni Street in Pimville via Modjadji, Mokoerekoere, Mokgalo, Mohloka, Chris Hani Road and Klipspruit Valley Road to Klipspruit Valley Station.",
    publishedStops: [
      "Lakeview",
      "Chris Hani road&Klipspruit Valley Road",
      "Kennys Brick&Tiles",
      "Mohloka str&Modjadji",
      "Pimville mall",
      "Mpondonde&Modjadji",
      "Mpondonde&Morobadilepe",
    ],
  },
  {
    code: "F11",
    family: "feeder",
    title: "Bellevue East / Yeoville to City",
    distanceKmOneDirection: 6.6,
    pathDescription: "From St Georges Street / Delarey through Bellevue East and Yeoville via Bedford, Raleigh, Joe Slovo, Doris, Tudhope, Abel, Kotze and the inner city; return uses Pretoria Street and Hillbrow Street because of one-way roads.",
    publishedStops: [
      "Library station east",
      "Rissik station",
      "Park station",
      "Jhb Theatre",
      "Kotze",
      "Pretoria&Klein",
      "Pretoria&Twist",
      "Pretoria&Claim",
      "Abel&Catherine",
      "Abel&Tudhope",
      "Tudhope&Barnato",
      "Hillbrow&Tudhope",
      "Hillbrow&Joe Slovo",
      "Raleigh&Joe Slovo",
      "Raleigh&Fortesque",
      "Raleigh&Kenmere",
      "Bedford&Muller",
      "St George&Cavedish",
      "St George&Arthur",
      "St George&Delarey",
    ],
  },
  {
    code: "F12",
    family: "feeder",
    title: "Parktown Distribution Route",
    distanceKmOneDirection: 5.1,
    pathDescription: "From Constitution Hill Station around the Metropolitan Centre via Joubert / Loveday / Hoofd, then toward Victoria, Jubilee, York, Carse O'Gowrie and the Parktown / hospital precinct.",
    publishedStops: [
      "Library station east",
      "Rissik station",
      "Park station",
      "Jhb Theatre",
      "Empire&Queens",
      "Clarendon&Nel",
      "Boundary&Willie",
      "Carse O Gowrie&Jubilee",
      "Wits Medical school",
      "Jhb hospital",
      "St Davids and Business school",
      "St Andrews and Blackwood",
      "Victoria&Empire",
      "Conhill",
      "Park station",
      "Harrison station",
      "Library station east",
    ],
  },
  {
    code: "C4",
    family: "complementary",
    title: "Windsor West and Cresta to Parktown and City",
    distanceKmOneDirection: 16,
    pathDescription: "From Beyers Naude Drive / Princes Avenue, Windsor West, south via Beyers Naude, Kingsway, Stanley and Empire into the Johannesburg inner-city trunk corridor.",
    publishedStops: [
      "Chancellor house",
      "Library station east",
      "Rissik station",
      "Park station",
      "Jhb Theater",
      "Parktown station",
      "Wits station",
      "Milpark station",
      "Sabc media park",
      "UJ Sophiatown Res station",
      "Main&1st avenue",
      "Main&4th avenue",
      "Beyers Naude&Westpark cemetery",
      "Beyers Naude&John Adamson",
      "Beyers Naude&Fire department",
      "Beyers Naude&Olive Schreine",
      "Beyers Naude&Northcliff",
      "Beyers Naude&Salnero",
      "Beyers Naude&Heatway square",
      "Beyers Naude&Lewisham Road",
      "Beyers Naude&Cresta Mall",
      "Beyers Naude&Judges Avenue",
      "Beyers Naude&Heatway square",
      "Beyers Naude&Alexander str",
      "Beyers Naude&Princess str",
    ],
  },
  {
    code: "C5",
    family: "complementary",
    title: "Florida North to Parktown and Library Gardens",
    distanceKmOneDirection: 14.7,
    pathDescription: "From Flora Centre / Ontdekkers Road through Main Road, Perth Road, Kingsway, Stanley and Empire into Parktown and the Johannesburg inner city.",
    publishedStops: [
      "Library station east",
      "Rissik station",
      "Park station",
      "Jhb Theatre",
      "Parktown station",
      "Wits station",
      "Milpark station",
      "Sabc Media park",
      "UJ Sophiatown station",
      "UJ Kingsway campus",
      "Helen Joseph Hospital",
      "Perth&Portland",
      "End&Perth Road",
      "Main road&Concord Road",
      "Main road&Dowling",
      "Main road&Sophiatown Police station",
      "Main road&Brown str",
      "Main road&Ackerman",
      "Main road&17th avenue",
      "Main road Pro west car",
      "Ontdekkers&Pluto",
      "Ontdekkers&10th avenue",
      "Ontdekkers&7th str",
      "Ontdekkers&Hendrik Potgieter",
      "Ontdekkers &Oupad",
      "Ontdekkers&Koppie",
      "Beacons road&Gouduis",
      "Ontdekkers&Conrad",
    ],
  },
  {
    code: "C6",
    family: "complementary",
    title: "Meadowlands to Orlando Stadium and Bosmont Rea Vaya Station",
    distanceKmOneDirection: 21,
    pathDescription: "From Elias Motsoaledi Road / Mashinini Street in Meadowlands through Vincent, Forbes, Sanders, Marsh, Hlongwane, Mophiring, Mooki, Main Road, Canada Road and Commando Road to Bosmont Rea Vaya Station.",
    publishedStops: [
      "Mashinini & Cele east",
      "Mashinini & Caluza",
      "Mashinini & Ekupoleni",
      "Vincent&Shinkhova",
      "Vincent&Shink Forbes",
      "Forbes &Isigwe",
      "Sandres&Mojadji",
      "Heckroodt&Odendaal Police Station",
      "Marsh&Yende",
      "Hlongoane&Boikhutso",
      "Hlongoane&Undertaker",
      "Mophiring&Oliver",
      "Mophiring&Nkwanca",
      "Armitage&Klipvalley",
      "Orlando stadium",
      "Noordgesig ext",
      "New Canada",
      "Bosmont",
      "Industria West",
      "Coronationville",
      "Westbury station west",
      "Helen Joseph hospital",
      "UJ Kingsway campus",
      "UJ Sophiatown",
      "Milpark station",
    ],
  },
  {
    code: "T2",
    family: "trunk",
    title: "Thokoza Park to Braamfontein via Soweto Highway",
    distanceKmOneDirection: 22.5,
    pathDescription: "From Thokoza Park BRT Station via Chris Hani Road, Klipspruit Valley Road, Pela, Mooki, Soweto Highway, Pat Mbatha Bus and Taxiway, Miriam Makeba, Market and Rissik into Braamfontein / inner city, returning via Park and Harrison.",
    publishedStops: null,
    narrativeMentionedStations: [
      "Thokoza Park BRT Station",
      "Rissik Station",
      "Park Station",
      "JHB Theatre",
      "Harrison Station",
    ],
  },
  {
    code: "T3",
    family: "trunk",
    title: "Thokoza Park to Parktown and Library Gardens",
    distanceKmOneDirection: 23,
    pathDescription: "From Thokoza Park BRT Station via Chris Hani Road, Klipspruit Valley Road, Pela, Mooki, Main Road, Canada Road, Commando, Fuel, Harmony, Perth, Kingsway, Stanley and Empire into Parktown and Library Gardens.",
    publishedStops: null,
    narrativeMentionedStations: [
      "Thokoza Park BRT Station",
      "Rissik Station",
      "Park Station",
      "JHB Theatre Station",
      "Conhill Station",
      "Library Gardens Station",
    ],
  },
];

const familyCount = (family) => ROUTES.filter((route) => route.family === family).length;
const round1 = (value) => Math.round((value + Number.EPSILON) * 10) / 10;

async function fileExists(filename) {
  try {
    await fs.access(filename);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filename) {
  const raw = await fs.readFile(filename, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function main() {
  console.log("");
  console.log("================================================");
  console.log(" Pulse Transit - Rea Vaya Phase 1B Normalizer");
  console.log("================================================");

  const pdf = await fs.readFile(SOURCE_PDF);
  const signature = pdf.subarray(0, 5).toString("ascii");

  if (signature !== "%PDF-") {
    throw new Error(`Phase 1B source is not a PDF. Signature: ${signature}`);
  }

  const errors = [];
  const warnings = [];

  const codes = ROUTES.map((route) => route.code);
  const duplicateCodes = codes.filter((code, index) => codes.indexOf(code) !== index);

  if (duplicateCodes.length) {
    errors.push(`Duplicate route codes: ${[...new Set(duplicateCodes)].join(", ")}`);
  }

  if (ROUTES.length !== 12) {
    errors.push(`Expected 12 Schedule 7 Phase 1B routes, found ${ROUTES.length}.`);
  }

  if (familyCount("feeder") !== 7) errors.push(`Expected 7 feeder routes, found ${familyCount("feeder")}.`);
  if (familyCount("complementary") !== 3) errors.push(`Expected 3 complementary routes, found ${familyCount("complementary")}.`);
  if (familyCount("trunk") !== 2) errors.push(`Expected 2 trunk routes, found ${familyCount("trunk")}.`);

  if (STATIONS.length !== 25) {
    errors.push(`Expected 25 published Phase 1B stations, found ${STATIONS.length}.`);
  }

  const distanceTotal = round1(
    ROUTES.reduce((sum, route) => sum + route.distanceKmOneDirection, 0)
  );

  if (distanceTotal !== 144.5) {
    errors.push(`Expected one-direction route-distance total 144.5 km, found ${distanceTotal} km.`);
  }

  for (const route of ROUTES) {
    if (!(route.distanceKmOneDirection > 0)) {
      errors.push(`${route.code}: invalid route distance.`);
    }

    if (route.family === "trunk") {
      if (route.publishedStops !== null) {
        errors.push(`${route.code}: trunk stop list must remain null because Schedule 7 does not publish a route-specific stop table for T2/T3.`);
      }
    } else if (!Array.isArray(route.publishedStops) || route.publishedStops.length === 0) {
      errors.push(`${route.code}: expected published feeder/complementary stop list.`);
    }
  }

  let codedInventoryCrossCheck = {
    filePresent: false,
    missingCodes: [],
    passed: null,
  };

  if (await fileExists(ROUTES_FILE)) {
    codedInventoryCrossCheck.filePresent = true;
    const existing = await readJson(ROUTES_FILE);
    const existingCodes = new Set((existing.routes ?? []).map((route) => route.routeCode));
    codedInventoryCrossCheck.missingCodes = codes.filter((code) => !existingCodes.has(code));
    codedInventoryCrossCheck.passed = codedInventoryCrossCheck.missingCodes.length === 0;

    if (!codedInventoryCrossCheck.passed) {
      errors.push(`routes.json is missing Schedule 7 codes: ${codedInventoryCrossCheck.missingCodes.join(", ")}`);
    }
  } else {
    warnings.push("routes.json was not present, so the Schedule 7 route codes could not be cross-checked against the coded route inventory.");
  }

  warnings.push("Published feeder/complementary stop-list order is preserved exactly as a source list, but directionality is not separated by the document; repeated stop names are therefore retained.");
  warnings.push("T2 and T3 have route narratives and distances but no route-specific ordered stop table in Schedule 7; no full trunk stop sequence is inferred.");
  warnings.push("The PDF contains only an Annexure B cover page labelled 'Weekday Timetables Sample'; no actual departure-time table is normalized from this file.");
  warnings.push("Schedule 7 contains 2025/26 fare values. Pulse already has a newer 2026/27 fare dataset, so the embedded tender fare table must not overwrite fares.json.");

  const normalizedRoutes = ROUTES.map((route) => ({
    id: `reavaya-phase1b-${route.code.toLowerCase()}`,
    routeCode: route.code,
    routeFamily: route.family,
    title: route.title,
    distanceKmOneDirection: route.distanceKmOneDirection,
    distanceSourceStatus: "official-schedule-7",
    pathDescription: route.pathDescription,
    pathGeometry: null,
    geometryStatus: "not-provided-as-gis-geometry-in-schedule-7",
    publishedStops: route.publishedStops,
    publishedStopCount: Array.isArray(route.publishedStops) ? route.publishedStops.length : null,
    stopListStatus:
      route.family === "trunk"
        ? "route-specific-ordered-stop-table-not-published-in-schedule-7"
        : "published-feeder-complementary-list-order-preserved",
    stopDirectionality: route.family === "trunk" ? null : "not-separated-by-source",
    narrativeMentionedStations: route.narrativeMentionedStations ?? [],
    sourcePages: {
      routeDescription: route.code === "F6" || route.code === "F7" || route.code === "F8" ? 216
        : ["F9", "F10", "F11", "F12", "C4"].includes(route.code) ? 217
        : 218,
      distanceTable: 219,
      stopList: route.family === "trunk" ? null :
        route.code === "C4" ? [221, 222] :
        route.code === "C5" ? [222, 223] :
        route.code === "C6" ? [223, 224] :
        route.code === "F6" || route.code === "F7" ? 224 :
        route.code === "F8" ? [224, 225] :
        route.code === "F9" || route.code === "F10" || route.code === "F11" ? 225 :
        route.code === "F12" ? 226 : null,
    },
  }));

  const output = {
    schemaVersion: 1,
    operatorId: "reavaya",
    phase: "1B(b)",
    source: {
      authority: "City of Johannesburg Transport Department",
      documentTitle: "Rea Vaya Phase 1B (b) - Supply and Delivery of Quality Road-Based Public Transport Services",
      sourceType: "official-tender-service-specification",
      sourceFile: "raw/phase-1b-service-specification-2026.pdf",
      sourcePdfBytes: pdf.length,
      confidence: "official",
      schedule: "Schedule 7",
      relevantPages: {
        routeDescriptionsAndDistances: [216, 217, 218, 219],
        stationsAndBusStops: [221, 222, 223, 224, 225, 226],
        embeddedHistoricalFareTable: 220,
        timetableSampleCoverOnly: 249,
      },
    },
    serviceSummary: {
      sourceWording: "Services are described as operating from 05:00, with the last bus leaving Johannesburg CBD at 22:00.",
      firstServiceTime: "05:00",
      lastBusLeavesJohannesburgCBD: "22:00",
      continuousAllRoutesClaimed: false,
      exactRouteTimetablesStored: false,
    },
    routeDistanceSummary: {
      routeCount: normalizedRoutes.length,
      oneDirectionDistanceTotalKm: distanceTotal,
      sourceWarning: "Schedule 7 states routes and distances may change based on operational requirements and demand levels.",
    },
    routes: normalizedRoutes,
    stations: {
      count: STATIONS.length,
      records: STATIONS,
      coordinatesAvailable: false,
      note: "Schedule 7 publishes physical-address labels but not latitude/longitude coordinates.",
    },
    fareReferenceInTender: {
      effectiveFrom: "2025-07-01",
      effectiveTo: "2026-06-30",
      status: "historical-source-reference-only",
      useForCurrentAppFare: false,
      currentFareFile: "fares.json",
      note: "Do not overwrite the current 2026/27 Rea Vaya fare dataset with the older fare table embedded in this tender document.",
    },
    timetableReference: {
      schedule7SaysTimetablesRequireCityApproval: true,
      annexureBTitle: "Weekday Timetables Sample",
      actualDepartureRowsPresentInThisPdf: false,
      exactTimetableNormalized: false,
    },
    capabilities: {
      officialPhase1BRouteEndpointsAndDistances: true,
      officialPhase1BStationInventory: true,
      publishedFeederComplementaryStopLists: true,
      completeTrunkStopSequences: false,
      stationCoordinates: false,
      routeGeometry: false,
      exactTimetables: false,
      realtime: false,
    },
    appRules: [
      "Use Schedule 7 distances as official Phase 1B route-distance metadata; do not substitute Mapbox driving distance for these published values.",
      "Do not treat feeder/complementary stop-list order as direction-separated unless another official source confirms directionality.",
      "Do not infer full T2/T3 stop sequences from the global station inventory.",
      "Do not geocode physical-address labels and then label the result as an official station coordinate; GIS coordinates require a separate verified source.",
      "Do not overwrite current 2026/27 Rea Vaya fares with the older 2025/26 Schedule 7 fare table.",
      "Do not present exact departure times or live ETA from this dataset.",
    ],
  };

  const stopListRoutes = normalizedRoutes.filter((route) => Array.isArray(route.publishedStops));
  const totalPublishedStopEntries = stopListRoutes.reduce((sum, route) => sum + route.publishedStops.length, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    operatorId: "reavaya",
    phase: "1B(b)",
    officialPdfValidated: true,
    sourcePdfBytes: pdf.length,
    routeCount: normalizedRoutes.length,
    familyCounts: {
      feeder: familyCount("feeder"),
      complementary: familyCount("complementary"),
      trunk: familyCount("trunk"),
    },
    oneDirectionDistanceTotalKm: distanceTotal,
    stationInventoryCount: STATIONS.length,
    routesWithPublishedStopLists: stopListRoutes.length,
    routesWithoutPublishedStopLists: normalizedRoutes.filter((route) => !Array.isArray(route.publishedStops)).map((route) => route.routeCode),
    totalPublishedStopEntries,
    routeStopCounts: Object.fromEntries(
      normalizedRoutes.map((route) => [route.routeCode, route.publishedStopCount])
    ),
    codedInventoryCrossCheck,
    currentFareDatasetProtectedFromHistoricalTenderFare: true,
    exactTimetableNormalized: false,
    errorCount: errors.length,
    errors,
    warningCount: warnings.length,
    warnings,
    qaPassed: errors.length === 0,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("Phase 1B Schedule 7 normalization complete.");
  console.log("");
  console.log(`Routes normalized: ${report.routeCount}`);
  console.log(`  Feeder: ${report.familyCounts.feeder}`);
  console.log(`  Complementary: ${report.familyCounts.complementary}`);
  console.log(`  Trunk: ${report.familyCounts.trunk}`);
  console.log(`One-direction distance total: ${report.oneDirectionDistanceTotalKm} km`);
  console.log(`Published stations: ${report.stationInventoryCount}`);
  console.log(`Routes with published stop lists: ${report.routesWithPublishedStopLists}`);
  console.log(`Published stop entries: ${report.totalPublishedStopEntries}`);
  console.log(`Routes without route-specific stop lists: ${report.routesWithoutPublishedStopLists.join(", ")}`);
  console.log("");
  console.log(`QA errors: ${report.errorCount}`);
  console.log(`Warnings: ${report.warningCount}`);

  if (warnings.length) {
    console.log("");
    for (const warning of warnings) console.log(`WARNING: ${warning}`);
  }

  console.log("");
  console.log("Created:");
  console.log(`  ${OUTPUT_FILE}`);
  console.log(`  ${REPORT_FILE}`);
  console.log("");
  console.log("Important: no GIS geometry, station coordinates, exact timetable or live ETA were inferred.");

  if (errors.length) {
    console.log("");
    for (const error of errors) console.error(`ERROR: ${error}`);
    throw new Error("Rea Vaya Phase 1B Schedule 7 QA failed.");
  }
}

main().catch((error) => {
  console.error("");
  console.error("Rea Vaya Phase 1B normalization failed:");
  console.error(error);
  process.exitCode = 1;
});
