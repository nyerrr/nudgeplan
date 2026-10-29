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
process.env.EXPO_PUBLIC_API_URL
```

Find your LAN IP with `ipconfig` (look for IPv4 Address).

## API URL defaults

| Target              | URL                     |
| ------------------- | ----------------------- |
| Web / iOS simulator | `http://localhost:8001` |
| Android emulator    | `http://10.0.2.2:8001`  |

`EXPO_PUBLIC_API_URL` overrides all of these. Live Gemini responses can take
longer than a local parse, so requests wait up to 60 seconds by default. Set
`EXPO_PUBLIC_API_TIMEOUT_MS` if you need a different budget.

API and Supabase URLs must use HTTPS outside loopback development. Never put
`GEMINI_API_KEY`, `API_AUTH_TOKEN`, or any other backend secret in an
`EXPO_PUBLIC_*` variable: Expo inlines those values into the JavaScript bundle.
AI requests authenticate with the signed-in user's Supabase access token.

## Current features

### Navigation

- Home, Plan, Focus, and Insights tabs, plus a central Check-in button
- Profile and About screens reachable from Home and Profile
- Custom state-based tab navigator (no react-navigation dependency)

### Sign-in

- First launch shows a login screen with Google, email magic-link, and
  "Continue without an account"
- Signed-in sessions persist through Supabase; guest sessions stay local
- Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
  to enable real auth. Without them the app runs in local demo/guest mode.
- Guest mode keeps the app fully offline and usable without an account
- The Supabase anon key is public by design. Row Level Security, not secrecy,
  protects user rows; run `supabase_setup.sql` before deploying.

### Home

- Time-aware greeting and quick brain-dump bar with a simulated voice sample
- Reality Check card: planned vs. open time, capacity %, move/keep actions
- Low/Medium/High energy selector that re-runs the schedule
- Up-next task list with inline completion
- Upcoming deadlines after tomorrow, with days-left labels for exams and fixed dates
- Nudge card with "Start now" and "Later" actions

### Plan

- Today/Tomorrow toggle
- Capacity meter and energy-by-hour visualization
- Peak-hour hint that counts high-effort tasks placed in the peak
- Timeline of scheduled tasks and a "Needs room" section
- Task sheet for create/edit/delete, including duration, effort, day, priority,
  optional fixed start time, deadline, "Add to calendar", and "Break into steps"

### Check-in

- Conversational chat with typing indicator
- Demo chips for common brain dumps
- Calls `POST /plan/checkin`; falls back to local parsing if the backend is down
- Parsed task cards, capacity warning, and CTAs such as "Move N to tomorrow",
  "View plan", and "Open focus"

### Focus (Micro-Step Guard)

- Task picker for open tasks
- Breaks a task into steps of 10 minutes or less
- Countdown timer with Start/Pause, Reset, and Skip 1 min
- Step checklist, "Done with this step", and "Make it smaller"
- Add your own step

### Insights

- Completion by day, capacity today, micro-steps finished, check-in streak
- Energy-by-hour chart and recent Reality Check history

### Profile

- Name, working hours, nudges toggle, Auto/Light/Dark theme
- About screen
- Prototype demos: brain dump, overload, get unstuck, low energy, reset

### Persistence and theme

- AsyncStorage persists tasks, chat, history, settings, theme, and step progress
- Poppins fonts, Ionicons, LinearGradient, and safe-area insets
- Light and dark palettes from the original prototype

## Code map

```
App.tsx                     App shell, fonts, screen switch
src/state.tsx               Central provider: state, persistence, actions, demos
src/theme.ts                Light/dark palettes and typography
src/types.ts                Shared types
src/lib/engine.ts           Parsing, energy curve, scheduling, Reality Check, steps
src/lib/api.ts              Backend calls with timeout and null fallback
src/lib/storage.ts          AsyncStorage load/save
src/components/             UI kit, task rows, tab bar, toast, task sheet
src/screens/                Home, Plan, Check-in, Focus, Insights, Profile, About
```

## Testing and checks

```powershell
npx tsc --noEmit
npx expo export --platform web
```

With the backend running (`python run.py` in `backend/`), try:

1. Check in with "I'm tired today. Study for the chem exam 90m, laundry".
2. Confirm the Reality Check warning and "Move N to tomorrow".
3. Open Focus, break down "Draft client proposal", start the timer, and complete
   a step.
4. Reload the page and confirm tasks, chat, and settings persist.
5. Open Profile and run "Reset the demo" to return to the seeded state.

If the backend is not running, the app still works; check-ins and breakdowns
use the local engine, and the UI simply skips AI-authored wording.
