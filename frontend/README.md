# NudgePlan Frontend (React Native + Expo + TypeScript)

## Setup

```powershell
cd frontend
npm install
```

## Run

### Option A: Web browser (no phone, no emulator needed)

```powershell
npx expo start --web
```

Opens at http://localhost:8081. This is the fastest way to iterate when you
do not have an Android device. The API defaults to `http://localhost:8001`,
which is already correct for web.

### Option B: Android emulator (requires Android Studio)

```powershell
npx expo start
```

Press `a`. The emulator reaches the backend at `http://10.0.2.2:8001`
(this default is already set in `App.tsx`).

### Option C: Physical Android phone (requires Expo Go)

Your phone and PC must be on the same WiFi. Set your PC's LAN IP in
`frontend/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8001
```

Find your LAN IP with `ipconfig` (look for IPv4 Address).

## API URL defaults

| Target              | URL                     |
| ------------------- | ----------------------- |
| Web / iOS simulator | `http://localhost:8001` |
| Android emulator    | `http://10.0.2.2:8001`  |

`EXPO_PUBLIC_API_URL` overrides all of these.

## Current features

- Brain dump text input
- Calls `POST /ai/plan` on the FastAPI backend
- Renders returned micro-steps and breakdown
- Loading and error states
