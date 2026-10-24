# NudgePlan Frontend (React Native + Expo + TypeScript)

The mobile app is Android-first but runs in the browser for fast iteration. It
works offline by default: planning, scheduling, Reality Check, and micro-step
generation all run locally in `src/lib/engine.ts`.

## Run the frontend and backend

Use two separate PowerShell terminals from the repository root.

### Terminal 1: Backend

```powershell
cd C:\Users\Dave\nudgeplan\backend

py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```

The backend runs at http://localhost:8001. Verify it is running with:

```powershell
Invoke-RestMethod http://localhost:8001/health
```

The default `.env` uses offline mode, so a Gemini API key is not required.

### Terminal 2: Frontend

```powershell
cd C:\Users\Dave\nudgeplan\frontend
npm install
npx expo start --web
```

Open http://localhost:8081 in a browser. The frontend uses
`http://localhost:8001` for the backend by default.

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
(this default is set in `src/lib/api.ts`).

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

## Navigation

Routing is file-based via [expo-router](https://docs.expo.dev/router/introduction/).
The file tree *is* the navigation structure.

```
app/
  _layout.tsx            Root stack: tabs + the three modal flows
  (tabs)/
    _layout.tsx          Bottom tab bar
    index.tsx            Today     - daily plan, energy, Reality Check summary
    dump.tsx             Dump      - conversational brain dump
    plan.tsx             Plan      - every task, filterable
    you.tsx              You       - preferences and settings
  confirm.tsx            Modal - review and tune extracted tasks
  reality-check.tsx      Modal - hours + energy, then suggested changes
  task/[id].tsx          Modal - one task, with its micro-steps
```

The core loop is:

```
Dump  ->  Confirm  ->  Reality Check  ->  Today
```

`Today` is the landing surface. `Dump` is where you get things out of your
head. `Plan` holds everything else. `You` holds defaults.

## Project layout

```
src/
  theme.ts                Design tokens: colours, spacing, radii, type scale
  types.ts                Shared types
  state.tsx               Central provider: state, persistence, actions, demos
  lib/
    engine.ts             Parsing, energy curve, scheduling, Reality Check, steps
    api.ts                Backend calls with timeout and null fallback
    storage.ts            AsyncStorage load/save
    notifications.ts      Notification helpers
    useVoiceInput.ts      Voice input hook
  components/
    ui.tsx                Primitives
    TabBar.tsx            Bottom navigation
    TaskRow.tsx           Task display
    TaskSheet.tsx         Task create/edit
    EnergyStrip.tsx       Energy visualization
    Icon.tsx              Icon wrapper
    Toast.tsx             Toast notifications
  screens/                Home, Plan, Check-in, Focus, Insights, Profile, About, etc.
```

## Data flow

The app can run fully offline - parsing, scheduling, Reality Check, and
micro-step generation all run locally in `src/lib/engine.ts`. When the backend
is available, `src/lib/api.ts` calls it; otherwise it falls back to the local
engine.

## Design system

- Light and dark palettes from `src/theme.ts`
- Poppins fonts, Ionicons, LinearGradient, and safe-area insets
- Energy is colour coded: low/medium/high

## Current features

### Navigation

- Home, Plan, Focus, and Insights tabs, plus a central Check-in button
- Profile and About screens reachable from Home and Profile
- Custom state-based tab navigator

### Home

- Time-aware greeting and quick brain-dump bar
- Reality Check card: planned vs. open time, capacity %, move/keep actions
- Low/Medium/High energy selector that re-runs the schedule
- Up-next task list with inline completion
- Nudges

### Plan

- Today/Tomorrow toggle
- Capacity meter and energy-by-hour visualization
- Timeline of scheduled tasks and a "Needs room" section
- Task sheet for create/edit/delete

### Check-in

- Conversational chat with typing indicator
- Demo chips for common brain dumps
- Calls `POST /plan/checkin`; falls back to local parsing if the backend is down
- Parsed task cards, capacity warning, and CTAs

### Focus (Micro-Step Guard)

- Task picker for open tasks
- Breaks a task into steps of 10 minutes or less
- Countdown timer with Start/Pause, Reset
- Step checklist and "Make it smaller"

### Insights

- Completion by day, capacity today, micro-steps finished, check-in streak
- Energy-by-hour chart and recent Reality Check history

### Profile

- Name, working hours, nudges toggle, Auto/Light/Dark theme
- About screen
- Prototype demos: brain dump, overload, get unstuck, low energy, reset

### Persistence and theme

- AsyncStorage persists tasks, chat, history, settings, theme, and step progress
- Light and dark themes

## Testing and checks

```powershell
npx tsc --noEmit
npx expo export --platform web
```

With the backend running (`python run.py` in `backend/`), try the check-in flow,
Reality Check, Focus mode, and verify persistence after reload.

If the backend is not running, the app still works; check-ins and breakdowns
use the local engine.
