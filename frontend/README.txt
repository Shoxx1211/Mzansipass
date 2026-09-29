Pulse Transit - Gauteng Phase 2D - unified infrastructure coverage matrix

Inputs required on your machine:
  Existing unified runtime from Phase 2A/B/C.
  Local Phase 2C private municipal GIS evidence file.
  Local Phase 2A Ekurhuleni normalized infrastructure.

1. Expand this archive in C:\Users\pc1\Mzansipass\frontend
2. From that folder run: .\scripts\transit\installGautengPhase2D.ps1
3. Open privately: src\data\transit\gauteng\unified-dev\reports\phase2d-location-matrix.html

What it adds:
- Existing 207 mapped municipal/bus/corridor shapes plus 28 GMS GIS group features if all Phase 2C layers are present.
- Source-separated municipal railway line shapes, municipal station observations and Gautrain published service station membership.
- Actual GIS-anchored geographic tests covering Metrobus, A Re Yeng, Tshwane Bus, Ekurhuleni IRPTN, all seven available GMS source groups, Gautrain, railway station proximity and a negative control.
- One private report with a breakdown of geometry matches and missing coverage, not passenger journeys.

Each numbered GMS GIS source-layer pair remains an UNASSIGNED municipal GIS route group, not a verified Harambee service.
Railway station and line proximity does not verify operating PRASA/Metrorail routes or stop order.
No route direction, boarding edge, transfer edge, exact fare or ETA is inferred.
GIS redistribution and commercial reuse permission still requires review.
No changes to the commuter planner. Private files are gitignored and excluded from the production app.

Developer-only optional custom GPS test pairs:
  Create a JSON file with an array: [{"name":"My test","origin":{"lat":-26.2,"lng":28.0},"destination":{"lat":-26.15,"lng":28.05}}]
  node scripts\transit\buildGautengPhase2D.mjs --pairs path\to\test-pairs.json
  (No commuter ever needs to enter GPS coordinates. This is for internal automated tests only.)
