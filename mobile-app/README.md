# USDCentral Mobile App

## Phase 1 — Auth

This Expo + React Native app uses Firebase Auth and Firestore for identity and realtime user profiles. Zustand tracks session state and exposes simple auth actions.

### Setup

1. Create a Firebase project and enable Email/Password authentication.
2. Copy the Firebase web configuration into `app.json` under `expo.extra.firebase`.
3. Install dependencies and run the app.

```bash
cd mobile-app
npm install
npm run start
```

### Tests

```bash
cd mobile-app
npm test
```
