# Pulse guest access and nearby interchange MVP

## What is implemented

- **Explore as a guest** enters the same planner, tracker and statistics as a
  signed-in passenger without making an authentication request. The choice
  persists locally and starts even when the account server is unavailable.
- Guest trips use a dedicated local history key and recovery identity. Account
  histories remain separate. After successful sign-in, Pulse asks permission
  before copying guest trips into that account's **local** history; declining
  leaves the guest copy untouched. Sign-in does not create cloud backups.
- A guest can erase locally stored **trip history** from the Stats screen.
  Existing destination, location and fare-learning caches have independent
  lifecycles and are not represented by that button.
- Once an origin is available through GPS or manual selection, the homepage
  displays nearby mapped transport infrastructure: City of Johannesburg Rea
  Vaya BRT points, City of Tshwane A Re Yeng named GIS stops, pilot PRASA
  stations and Gautrain stations. PUTCO displays regional coverage hints only
  in the supported Soweto/Soshanguve screening areas.
- A recommendation with published shared-stop or multiple-leg evidence now
  lists **possible** change points, including route-to-route evidence on Rea
  Vaya and named PRASA rail interchanges. The active-trip panel also surfaces
  a candidate change location before a manually confirmed mode switch.

## Evidence guardrails

- All proximity figures are **straight-line**, not walkable-road distances.
- A Re Yeng stop names are official GIS data; the associated route codes were
  inferred by spatial proximity, not a verified timetable or stopping pattern.
- Rea Vaya BRT station points in this dataset have **no station names**.
  Route transfers are published shared-stop labels, not a guaranteed live
  connection, boarding direction or pedestrian path.
- PRASA is limited to corridors in `metrorail/gauteng-pilot-2026.json`. Its
  mapped stations are not proof of current train arrival or all calls.
- PUTCO Soshanguve has official zone and named transfer information but no
  GPS-resolved boarding-stop geometry here; do not give exact get-off advice.
- Taxi routes remain outside exact path and interchange guidance. No Uber or
  Bolt journeys are introduced.

## Next acceptance steps

1. Install a debug APK built with these changes and test first launch offline,
   guest plan, start, lock-screen background tracking, end, restart and Stats.
2. Verify that an existing registered passenger's history remains unaffected.
   Sign out, enter guest, record a trip and sign in again; test both **import**
   and **decline** decisions. Reinstalling removes guest data if app storage is
   wiped, so back up anything important before uninstalling.
3. Field-check named stations, entrances, actual line directions and safe
   walking interchanges in at least Johannesburg, Pretoria and Soshanguve.
4. Add verified operator stop sequences, operating-day evidence, and pedestrian
   transfer paths before issuing automatic **get off now** notifications.
5. Google sign-in is a separate next integration: configure Google OAuth
   clients and signing certificate SHA-256, align the Capacitor app ID with the
   Android application ID, add backend token verification and explicit account
   linking, then validate Android login on multiple physical devices.

Deployment, a new APK, and Google sign-in are **not** part of this code-only MVP.
