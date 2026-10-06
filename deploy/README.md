# Public Pulse technical beta

Render builds `frontend/` and serves its production output together with the
Flask passenger backend. `/api/auth/*` shares the app's HTTPS origin, preserving
the HttpOnly refresh cookie and CSRF protection. The backend database is Postgres.

## Launch

1. Connect Render to GitHub and create a Blueprint from `Shoxx1211/Mzansipass`.
2. Select branch `pulse-mvp-integration` and Blueprint path `render.yaml`.
3. Supply `VITE_MAPBOX_TOKEN` using the **public** `pk.` token from your local
   frontend environment. Render makes it available as a Docker build argument.
   If the token has URL restrictions, include the assigned public app domain
   in Mapbox's allowed URLs, then redeploy.
4. Review the Free web service and Free Postgres selections before creating.
   Render generates two independent backend secrets; do not replace them with
   development keys. An empty database is initialized once at container startup.
   Existing incomplete schemas stop startup and require a migration.
5. Wait for the service to be Live and use its assigned HTTPS URL. Verify account
   registration, login, refresh after a reload, destination search and trip tracking.

This configuration does not enable payments or NFC. Gemini is omitted because the
current implementation uses a browser-visible key; add a server proxy before
enabling it publicly. Local developer GIS diagnostics remain disabled in production.

## Free-tier limits

The free web service sleeps after inactivity, so an initial visit can be slow.
Free Postgres expires after 30 days: export or upgrade the database before expiry
to keep pilot accounts. This is a short public test, not permanent production hosting.
No paid plan is selected by this Blueprint. Automatic deployment is off.

## Checks

Run `npm ci --ignore-scripts && npm run build && npx vitest run` from `frontend/`.
Install `MzansiPass-fullstack/backend/requirements.txt` in Python 3.11 and run
`python -m unittest discover -s tests -v` from the backend directory.
Docker build requires `--build-arg VITE_MAPBOX_TOKEN=<public pk token>`.
