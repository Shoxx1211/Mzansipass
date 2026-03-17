# MzansiPass Fullstack (Dockerized)

## Quick start (requires Docker & Docker Compose)
1. Unzip project and `cd` into the folder.
2. Copy backend/.env.example to backend/.env and fill PAYSTACK_SECRET_KEY with your secret key.
3. Run:
   ```bash
   docker compose up --build
   ```
4. Open the apps:
   - User frontend: http://localhost:5173
   - Admin frontend: http://localhost:5174
   - Backend API: http://localhost:5000

## Notes
- The backend uses the env file `backend/.env.example` by default; replace with `.env` for production.
- Paystack public key is prefilled; add your secret key before running.
- Admin endpoints require header `X-ADMIN-KEY` set to SECRET_KEY (simple protection).

