# NudgePlan

Brain dump in. A plan you can actually do out.

NudgePlan is an Android-first mobile app built with React Native + Expo, backed by a
Python FastAPI service. It turns a short, messy check-in into a realistic day:
tasks are parsed, scheduled around your energy curve, checked against your open
hours, and split into startable micro-steps when you feel stuck.

The app is fully usable **offline** (`GEMINI_MOCK=true`, no API key). A Gemini key
only upgrades the language understanding; the planning logic is deterministic and
shared by the backend and the mobile client.

## What is in the app

| Area | What it does |
| ---- | ------------ |
| **Home** | Greeting, quick check-in bar, Reality Check engine, energy selector, up-next list, gentle nudges |
| **Plan** | Today/tomorrow timeline, capacity meter, energy-by-hour strip, "needs room" tasks, task create/edit sheet |
| **Check-in** | Conversational brain dump with demo chips, typing state, parsed task cards, and one-tap actions |
| **Focus** | Task picker, Micro-Step Guard breakdown, countdown timer, step checklists, "make it smaller" |
| **Insights** | Completion history, capacity, micro-step count, check-in streak, recent reality checks |
| **Profile** | Name, working hours, nudges, auto/light/dark theme, prototype demos, reset |
| **Sign-in** | Real Supabase Google/email sign-in with guest skip, persisted session, and sign-out from Profile |
| **About** | Product story, problem/solution, audience, roadmap, and team |

Signed-in plans sync to Supabase and are cached on-device for offline use.
Guest plans stay device-local. See `supabase_setup.sql` for the required
Row Level Security policies.

## Deployment

See [DEPLOY.md](DEPLOY.md) for the Render backend, the Supabase redirect
setup, and building a shareable Android APK or installable iPhone app with EAS.

## Architecture

```
frontend/  React Native + Expo Router + TypeScript (UI and local plan state)
backend/   Python + FastAPI + google-genai          (parsing and AI calls)
```

## The core loop

```
Dump  ->  Confirm  ->  Reality Check  ->  Today
```

- **Dump** - say everything on your mind, however messy.
- **Confirm** - review what was extracted, tune it, drop what is not real.
- **Reality Check** - set your available hours and energy. It never
  auto-schedules: it measures your workload against what you can realistically
  do, then proposes the fewest moves that make the day fit ("you have six hours
  of tasks but only three available - move the lowest-priority one to
  tomorrow").
- **Today** - your steps, sized to start in under ten minutes.

- `frontend/app/` - Expo Router screens and modal flows.
- `frontend/src/lib/realityCheck.ts` - deterministic capacity and workload rules.
- `backend/main.py` - API routes and Gemini response validation. Gemini is
  optional; mock mode uses the deterministic planner.

See `frontend/README.md` for the route and component map.

## Quick start (no Android phone required)

You can develop and test everything in a web browser. The code stays
Android-first, so nothing needs to change when you get a device.

Run the backend and the frontend in **two separate PowerShell terminals** from
the repository root. First-time setup only needs to be done once; after that,
`python run.py` and `npx expo start --web` are the only two commands you need.

### 1. Backend (Terminal 1)

First-time setup:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Start the server:

```powershell
cd backend
python run.py
```

- API: http://localhost:8001
- Health check: http://localhost:8001/health
- Interactive docs: http://localhost:8001/docs

Use `python run.py --reload` for auto-reload during development.

With no `GEMINI_API_KEY`, the backend automatically uses the offline planner, so
it works **without a key**. To use real AI, get a free key at
https://aistudio.google.com/apikey, paste it into `GEMINI_API_KEY`, and set
`GEMINI_MOCK=false`.

### 2. Frontend (Terminal 2)

First-time setup (skip if `frontend/node_modules` already exists):

```powershell
cd frontend
npm install
```

Start the dev server:

```powershell
cd frontend
npx expo start --web
```

Open http://localhost:8081 and type a brain dump, or open Profile and try the
prototype demos.

Navigation on web: `Today` / `Dump` / `Plan` / `You` along the bottom, plus
the `Confirm`, `Reality Check`, and task detail screens that open on top.

### 3. Pick your target

| Target | Command | Backend URL |
| ------ | ------- | ----------- |
| Web browser | `npx expo start --web` | `http://localhost:8001` |
| Android emulator | `npx expo start`, then press `a` | `http://10.0.2.2:8001` |
| Physical Android phone | set `EXPO_PUBLIC_API_URL=http://<your-pc-lan-ip>:8001` in `frontend/.env`, then `npx expo start` | your PC's LAN IP |

The web and emulator defaults live in `frontend/src/api/plan.ts`;
`EXPO_PUBLIC_API_URL` overrides them.

### 4. Test the API directly

```powershell
cd backend
python test_pipeline.py   # offline, mocks the Gemini client
python test_fallback.py   # offline, verifies the model fallback chain
python test_gemini.py     # live, needs a real key and a running server
```

Frontend checks:

```powershell
cd frontend
npm run typecheck
npm run export:web
```

## API at a glance

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Health + active model/mode |
| POST | `/ai/plan` | Brain dump -> validated tasks and micro-steps |
| POST | `/plan/checkin` | Brain dump -> app task shape with deadlines |
| POST | `/plan/steps` | One task -> guarded micro-steps |

`/ai/*` and `/plan/*` are protected. In production the app sends a Supabase
user token; locally, without Supabase configured, the API stays open for
development. See [`SECURITY-REVIEW.md`](SECURITY-REVIEW.md) for the current
threat model and deployment checklist, `backend/README.md` for request/response
examples, and `frontend/README.md` for the route and state details.

## Troubleshooting

### `ERROR: [WinError 10013]` when starting the backend

The port is blocked, usually by an orphaned uvicorn reloader child process:

```powershell
cd backend
python free_port.py 8001
python run.py --reload
```

### Port 8081 already in use (Metro)

```powershell
cd backend
python free_port.py 8081
```

### `net::ERR_CONNECTION_REFUSED` in the browser

The backend is not running. Start it in another terminal:

```powershell
cd backend
python run.py
```

Then check it responds:

```powershell
Invoke-RestMethod http://localhost:8001/health
```

## Roadmap

| Phase | Weeks | Focus                                        |
| ----- | ----- | -------------------------------------------- |
| 1     | 1-4   | Working prototype: brain dump, plan, check-in |
| 2     | 5-8   | Reality Check Engine, Micro-Step Guard        |
| 3     | 9-12  | Supabase auth, cloud sync, EAS build          |

See `backend/README.md` and `frontend/README.md` for details.
