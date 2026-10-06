FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
ARG VITE_MAPBOX_TOKEN
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN VITE_AUTH_API_BASE_URL=/api VITE_APP_ENV=production
RUN case "$VITE_MAPBOX_TOKEN" in pk.*) ;; *) echo "Set VITE_MAPBOX_TOKEN to a public pk. token"; exit 1 ;; esac && npm run build

FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PULSE_STATIC_DIR=/app/frontend-dist
WORKDIR /app/backend
COPY MzansiPass-fullstack/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY MzansiPass-fullstack/backend/ ./
COPY --from=frontend /build/dist /app/frontend-dist
EXPOSE 10000
CMD ["sh", "-c", "python init_pilot_db.py && exec gunicorn public_wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers 2 --threads 2 --timeout 120 --access-logfile - --error-logfile -"]
