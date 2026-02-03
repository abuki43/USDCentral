# USDCentral Backend

## Phase 1 — Auth Support

This Node.js + Express service verifies Firebase ID tokens and exposes a protected `/auth/me` endpoint. Future phases will extend it for Circle + LI.FI orchestration and webhooks.

### Setup

1. Create a Firebase service account and download the JSON key.
2. Populate the environment variables listed in `.env.example`.
3. Install dependencies and start the server.

```bash
cd backend
npm install
npm run dev
```

### LI.FI configuration

The LI.FI SDK requires an `integrator` string (set via `LIFI_INTEGRATOR`). This is **not** an API key; it’s a non-secret identifier used for attribution/analytics and sometimes rate-limiting.

### Swap worker

The backend runs a small swap-job worker that picks up pending jobs from Firestore and executes approval + swap transactions.

- `SWAP_WORKER_ENABLED` (default `true`)
- `SWAP_WORKER_INTERVAL_MS` (default `5000`)

### Test endpoint

```bash
curl -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" http://localhost:3000/auth/me
```
