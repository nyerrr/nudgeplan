# NudgePlan Frontend (React Native + Expo + TypeScript)

## Setup

```powershell
cd frontend
npm install
```

Optional: point the app at a backend other than the default.

```powershell
copy .env.example .env
```

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Defaults per platform if `EXPO_PUBLIC_API_URL` is not set:

| Target                | URL                     |
| --------------------- | ----------------------- |
| Android emulator      | `http://10.0.2.2:8000`  |
| iOS simulator / web   | `http://localhost:8000` |

## Run

```powershell
npx expo start
```

- Press `a` for Android emulator
- Press `w` for web
- Scan the QR code with Expo Go on a physical device

> Physical device: your phone and PC must be on the same WiFi, and set
> `EXPO_PUBLIC_API_URL=http://<your-pc-lan-ip>:8000` in `.env`.

## Current features

- Brain dump text input
- Calls `POST /ai/plan` on the FastAPI backend
- Renders the returned micro-steps and breakdown
- Loading and error states
