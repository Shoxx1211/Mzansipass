# Pulse taxi data integration: evidence and licensing gate

## Status (6 November 2026)

The app has a **source-aware taxi-rank ingestion path** and a nearby minibus
rank candidate card. It **does not yet ship a live OSM taxi-rank extract**:
`frontend/src/data/transit/gauteng/taxi/osm-facilities.json` has an empty
`facilities` array and `extractedAt: null`. Without actual permitted data,
Pulse will not fabricate ranks. This is infrastructure, **not full taxi coverage**.

The guest-access, other nearby bus/rail coverage and published interchange
evidence developed in `PULSE_GUEST_NEARBY_TRANSFER_MVP.md` remain separate.

## Source permissions and trust boundary

| Source | Discovered data | Reuse position | Pulse status |
| --- | --- | --- | --- |
| OpenStreetMap | Taxi amenities, some explicitly labelled minibus ranks | ODbL 1.0; attribution and share-alike compliance required | Import pipeline ready, no extract shipped |
| Johannesburg Corporate GIS | ArcGIS `Transportation/MapServer` layer 23 (taxi ranks), 24 (taxi routes), 55–58 (minibus formal/informal ranks and holding) | Municipality's online GIS terms restrict commercial reuse without written consent | **Blocked for copying into Pulse**; record discovery metadata only |
| Ekurhuleni GIS | Taxi rank points, taxi route/corridor map layers | Published municipal GIS policy restricts redistribution | **Blocked** pending specific permission |
| Gauteng / CSIR | Taxi facilities survey and geographic layer | Public viewing is not proof of commercial redistribution rights | **Blocked** pending explicit licence/partnership |
| Farezi | Claimed verified rank-to-rank routes and fare API | Commercial API requires contract/usage conditions | **Blocked** pending commercial evaluation |

Useful links:

- Johannesburg maps: https://eservices.joburg.org.za/sites/cgismaps/Pages/Transportation-Theme.aspx
- Johannesburg GIS terms: https://eservices.joburg.org.za/disclaimer
- Ekurhuleni map layers: https://gis.ekurhuleni.gov.za/arcgis/rest/services/GMS/Corridor_1/MapServer/layers
- Ekurhuleni GIS policy: https://www.ekurhuleni.gov.za/wp-content/uploads/2023/07/0304C_GISPolicy.pdf
- CSIR taxi facilities: https://pta-gis-2-web1.csir.co.za/server2/rest/services/Hosted/GP_Taxi_Facilities/FeatureServer
- Farezi API: https://farezi.co.za/api-docs
- OSM attribution/licence: https://www.openstreetmap.org/copyright

## Import only a separately licensed OSM snapshot

1. From an Overpass-compatible OpenStreetMap export endpoint, export Gauteng
   amenities (no municipality GIS datasets or third-party proprietary data).
   Example query, using a coarse bounding box for discovery:

   ```overpass
   [out:json][timeout:180];
   (nwr["amenity"="taxi"](-27,27.1,-24.9,29.95);
    nwr["taxi_vehicle"](-27,27.1,-24.9,29.95););
   out center tags;
   ```

2. Review the Overpass export provenance and current ODbL obligations.
   Save the raw export **outside the app code tree**. Do not merge in
   Johannesburg, Ekurhuleni, CSIR or scraped Google Maps data.
3. From `frontend/`, run:

   ```bash
   node scripts/transit/importOsmTaxiFacilities.mjs /path/to/overpass-export.json --accept-odbl
   node scripts/transit/testImportOsmTaxiFacilities.mjs
   npm run type-check
   npm run build
   ```

   The importer only keeps valid Gauteng-screened nodes, ways and relations.
   Generic taxi stands are stored as `taxi-type-unconfirmed` and do **not**
   appear under minibus discovery. Features with explicit minibus evidence
   are marked `minibus-indicated`, not verified. Source feature links and
   extraction timestamp are retained.

4. Publish an appropriately licensed derived database and required attribution
   under the ODbL terms when distributing the derived data; do not assume the
   application's MIT code licence replaces ODbL. Review whether any merged
   database triggers ODbL share-alike and keep OSM data separately sourced.
5. Inspect a sample of results in Johannesburg, Soweto, Pretoria and Ekurhuleni
   for false positives, missing ranks, access barriers, and GPS precision.
   Do not label a physical rank entrance solely from an OSM centroid.

## Journey planner guardrails

- A mapped taxi rank is a **possible facility**, not proof that a taxi serves
  an origin/destination pair. Taxi fares remain provisional distance estimates.
- Never derive rank-to-rank routes, stop sequences, service schedules or
  "get off now" instructions from map proximity or bare line geometry.
- A bus/rail stop near a rank can become a **candidate interchange only**.
  Actual walking connection, boarding position and direction must be field-
  checked. Mode-specific journey steps should have operator/association
  evidence or a supported verified route dataset before being promoted.
- We should request route/rank redistribution rights from municipality/CSIR
  custodians, or obtain a commercial route API agreement, before claiming
  a complete Gauteng minibus network.

## Practical next data milestone

1. Secure a permitted OSM snapshot and audit 30–50 candidate rank locations.
2. Obtain written permissions or a commercial data agreement for verified
   operating routes, destinations, interchange bays, and fares.
3. Join verified taxi edges to the existing Rea Vaya, A Re Yeng, PUTCO and
   PRASA graph by physical interchange nodes and verified transfer directions.
4. Run on-device field tests before publishing directions to commuters.

No official municipal taxi data has been copied, and no third party has been
contacted or charged on Pulse's behalf.
