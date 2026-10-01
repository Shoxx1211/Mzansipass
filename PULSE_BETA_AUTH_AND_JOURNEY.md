# Pulse: secure technical-pilot and multimodal acceptance runbook

## Scope

This branch is prepared for a **supervised technical pilot**, not an open
public beta. Demo password login is removed. Passenger account credentials
are checked by the Flask/PostgreSQL backend. Journey fares and GPS legs
are recorded locally, not synced across commuters' devices.

The pilot continues to focus on South African public transport. Uber and Bolt
are deliberately excluded.

## 1. Start the passenger backend on Windows

From the repository root in PowerShell:

```powershell
cd MzansiPass-fullstack
Copy-Item backend\.env.example backend\.env
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Edit `backend\.env` and replace the two DIFFERENT placeholder values for
`SECRET_KEY` and `JWT_SECRET_KEY` using the generated outputs.
Never commit the `.env` file. For the disposable local pilot,
`PULSE_BOOTSTRAP_DB=1` lets SQLAlchemy create missing tables.
For an existing persistent deployment database, set it to 0 and run reviewed
Flask-Migrate schema migrations instead; `create_all()` does not upgrade
existing tables.

```powershell
docker compose up -d --build db backend
docker compose logs -f backend
```

The API is exposed at `http://localhost:5000` to the Vite proxy.
The browser uses `/api/auth/*` on the SAME HTTPS origin as Pulse, and the
proxy rewrites this to the Flask `/auth/*` endpoints. Never use an unsecured
public HTTP origin for real account credentials. Local Vite uses a self-signed
development certificate; use a properly trusted HTTPS certificate for the
invited beta.

Existing demo user sessions do not authenticate. Users must create a new
account with a 12+ character password. The login service must be running.
Authentication will fail closed rather than silently switching back to demo
login.

## 2. Run the checks

In another PowerShell terminal:

```powershell
cd frontend
npm ci
npm run type-check
npx vitest run tests/multimodalJourney.test.ts
npm run build
npm run dev
```

Python passenger-auth tests run in CI against a disposable SQLite database;
to run locally install the Python requirements in a virtual environment and
execute:

```powershell
cd MzansiPass-fullstack\backend
python -m unittest discover -s tests -v
```

Do **not** run the Python tests against an existing Postgres database: the
test module explicitly chooses a disposable SQLite connection.

GitHub Actions workflow:
`.github/workflows/pulse-beta-ci.yml`

## 3. Authentication acceptance checklist

- New email can register; invalid password cannot sign in.
- Duplicate account cannot register again.
- User passwords aren't written to browser localStorage.
- Refresh works with matching CSRF cookie and header and fails without it.
- Sign out invalidates the refresh token; the old demo stored session is ignored.
- Delete account requires password re-entry.
- Another account cannot be offered a trip owned by the previous logged-in user.
- Unfinished NFC/payment endpoints reject pilot traffic.

**Still needed before a larger external beta**: email ownership verification,
password reset and formal account-privacy/retention review, proper database
migration and backup plan, and a server-side history-sync design with explicit
user consent. The current browser history remains device-local.

## 4. Deterministic three-leg acceptance scenario

The unit test uses a synthetic taxi -> municipal bus -> walk ledger.
Coordinates/stops are NOT represented as a verified real route.
Run `npx vitest run tests/multimodalJourney.test.ts`.

Expected:
1. Start at 0 km in taxi.
2. At 8.4 GPS km, commuter confirms transfer and R18 taxi fare.
3. Bus starts at 8.4 GPS km, not zero and not trip end.
4. At 21.6 GPS km, commuter confirms next transfer and R24 bus fare.
5. Walk begins at 21.6 GPS km; trip ends at 22.9 GPS km.
6. Total actual spend R42 and 22.9 tracked km, all three legs.
7. If trip ends before boarding bus, bus and walk remain unboarded.
8. Unknown fare on a boarded leg is kept UNKNOWN, not counted as R0 fare.
9. GPS going backwards cannot create negative leg distance.
10. No automatic mode changes are inferred from GPS speed.

## 5. Field validation — required, not replaced by unit tests

Select ONE existing, physically checkable corridor with two verified
boarding points. For example, a known minibus taxi connection to an
operating bus/rail route plus the final walk. Do not present unverified
GIS geometry as boarding guidance.

Run the same scenario on at least two Android phones, checking:
- Each address/pin is exact (street number when available).
- Boarding point, direction and transfer are physically verified.
- The commuter confirms transfers in a safe place, not while driving.
- User-reported fare for each vehicle is recorded separately.
- Total spend in Stats is sum of CONFIRMED fares only.
- The active trip does not disappear on a short network interruption.
- Screen lock/app reopen exposes 'Resume trip' only for the same account.
- GPS uncertainty and unverified operator timetables are visible.

Record actual operator, stop, fare, time, transfers, GPS drift, and which
device/OS worked. Do not claim a corridor passed until a real journey has
been completed and evidence reviewed.

## 6. Production boundaries

Use a trusted HTTPS reverse proxy to forward only `/api/auth/*` to the
Python backend. Store secrets only in deployment secret storage.
Review `PULSE_ALLOWED_ORIGINS`, cookie flags, CORS and security headers.
Use real schema migrations on persistent PostgreSQL.
The `PULSE_ENABLE_PAYMENT_ROUTES` flag remains disabled by default.

Location traces and exact home addresses deserve stronger handling before
a public launch: data minimisation, encryption at rest where appropriate,
clear location consent, privacy notice, retention and deletion controls.
