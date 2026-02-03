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

### Test endpoint

```bash
curl -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" http://localhost:3000/auth/me
```
