# Pulse — Gauteng published transport source register
Last reviewed: 2026-10-02 | Phase: operator-source-first planning pilot

## Product contract
Pulse should return the available operator route candidates **near the passenger's chosen origin that actually connect to the destination**, including validated transfers, each leg's service distance, source-dated ticket fare and total cost. Keep the default UI to two calm screens; show provenance under "See steps" or "See connection".

Never infer a minibus taxi association service from a driving path; never present a broad operator coverage area as a confirmed boarding stop; never divide zone-based PUTCO tickets into an invented rand/km tariff; never claim the sum of priced legs is a full fare if one paid access leg is unknown; never charge twice for a Rea Vaya transfer documented as one continuous tap journey; never present a 2023 tariff as 2026.

## Source register and implementation readiness

| Operator | Primary reference | 2026 status | Fare rule in Pulse | Route/stop evidence |
|---|---|---|---|---|
| Rea Vaya | https://reavaya.org.za/fares/ | Tariffs 1 Jul 2026–30 Jun 2027 (official) | Seven distance bands with **published peak AND published off-peak amounts**; see src/services/publishedFareCatalog.ts | City Johannesburg BRT GIS point data, official canonical line geometries, partial detailed route/transfer graph. Direction and stop sequence not complete. |
| Rea Vaya transfers | https://reavaya.org.za/transferring-buses/ | Official published guidance | Within a continuing Rea Vaya journey, a feeder/trunk transfer can be one fare; leaving station and re-tapping may create a new trip | Treat interchange/tap pattern as part of the fare context |
| Rea Vaya published route inventory | https://reavaya.org.za/rea-vaya-operating-routes/ | Operator lists trunk, feeder, complementary routes; site contains inconsistent time-window statements | Not sufficient by itself for exact passenger fare | Some GIS geometry routes lack direction or named stop coordinates; don't invent |
| PUTCO Soweto | https://putco.co.za/smartap/ | 2023 source zone guide still linked, and 2026 Soweto fare notice downloadable; use 2026 notice for current ticket values | **Zone-pair and product**, not R/km; Soweto zone-to-fare matrix not yet fully normalized into frontend dataset | Official Soweto service area published at https://putco.co.za/commuter-bus-services/ ; exact GIS stops/timetable not yet normalized |
| PUTCO June increase | https://putco.co.za/fuel-related-fare-increase-june-2026/ | 10% increase effective 1 Jun 2026 | Do not mechanically multiply stale ticket tables: 2026 official final notice has precedence over 2023 | n/a |
| PUTCO Soshanguve | https://putco.co.za/smartap/ | Local official fare table transcribed into putco/soshanguve/fares.json effective 1 Jun 2026 | Explicit Soshanguve zone-pair lookup; do not reuse for Soweto | Zone names, codes and transfers available, but no route geometry |
| Gautrain | https://www.gautrain.co.za/commuter/farecalc | Official online fare calculator and official Sept 2026 fare bulletin | Station-to-station matrix in repository; station access fare requires its own evidence | Official named stations, train service lines, partial buses |
| A Re Yeng | https://www.tshwane.gov.za | Existing municipal route GIS normalization | Use municipality-published tariff if source date matches; no universal R/km from road distance | Routes, stops and some terminals; trip-time validation pending |
| PRASA Metrorail | https://www.prasa.com/ | Not yet an updated operator stop-sequence + dated fare import for Soweto corridors | Fare unavailable until sourced | Don't equate mapped historic stations with current operations |
| Minibus taxis | Local taxi associations; SANTACO updates where specific association route is documented | No comprehensive and current association boarding-place / destination fare table loaded | Per-route published or pilot-observed fare only, tagged with date and association. Road-distance bands are explicitly non-official guidance | Road access is not proof a minibus-taxi service exists |

## Next data-ingestion operations (not complete yet)
1. Download and transcribe **2026 final PUTCO Soweto fare notice PDF** linked from the official SmartTap page. Validate each zone name, ticket code, cash rate and 10/12/44/52-trip product. Record all values' last-valid date and citation URL. Source was available but PDF content could not be retrieved through current automated environment; do not silently substitute older values.
2. Map PUTCO's official Soweto zone definitions to actual geographic boarding stops from operator/City of Johannesburg licensed GIS; QA stop-to-zone assignment on the street.
3. Link Rea Vaya route-direction, stop order and measured onboard distance for tap-in/out. Only then present one precise fare for a specific commuter's journey rather than a whole-system range.
4. Build an operator-independent transfer graph and one-ticket fare engine. Cost = sum of paid journeys including access and egress, not sum of every Rea Vaya bus leg if part of one continuing fare.
5. In the 2-screen UI, return only origin-to-destination routes; separately list mapped near-start operator possibilities when no confirmed connecting service is known.
6. Test representative routes with passengers for Soweto/Johannesburg/Boksburg, including origin GPS confidence, service applicability, transfer sites, actual receipts and fare evidence.
7. Review publisher licensing, attribution, download automation and updated tariff schedules before large-scale redistribution. Publication on the web does **not** automatically mean permanent freshness or reuse rights.

## Test matrix
- Rea Vaya 2026/27 band endpoints: 5, 10, 15, 25, 35, 45 km inclusive, both peak and off peak.
- Rea Vaya transfer rules: continuous vs station exit/re-entry.
- PUTCO Soshanguve zone-pairs only; never substitute Soweto.
- Soweto → Boksburg: don't suggest a PUTCO through-ride just because of a generic Joburg radius.
- High location uncertainty: do not claim a nearby boarding point.
- Closing AI navigation: return to home, never a blank tab.

This is a living source register, not a claim that all these operator fare/stop feeds are fully implemented.
