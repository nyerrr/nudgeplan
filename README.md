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
| **About** | Product story, problem/solution, audience, roadmap, and team |

Everything persists locally with AsyncStorage, including tasks, chat, theme,
working hours, and completed steps.

## Architecture

```
frontend/  React Native + Expo + TypeScript   (UI, local engine, persistence)
backend/   Python + FastAPI + google-genai    (parsing, planning, AI calls)
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

- `frontend/src/lib/engine.ts` - TypeScript port of parsing, capacity, scheduling,
  Reality Check, and micro-step generation. Used offline and as an instant fallback.
- `backend/engine.py` - Python mirror of the same rules, covered by `test_engine.py`.
- `backend/main.py` - API routes. Gemini is optional; every route degrades to the
  deterministic engine when mock mode is on or a call fails.

Screens live in `frontend/src/screens/` as components, wired through `App.tsx` and the
app state. See `frontend/README.md` for the map.

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

`backend/.env.example` ships with `GEMINI_MOCK=true`, so it works with **no API key**.
To use real AI later, get a free key at https://aistudio.google.com/apikey,
paste it into `GEMINI_API_KEY`, and set `GEMINI_MOCK=false`.

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

The web and emulator defaults live in `frontend/src/api/plan.ts` and
`frontend/src/lib/api.ts`; `EXPO_PUBLIC_API_URL` overrides both.

### 4. Test the API directly

```powershell
cd backend
python test_engine.py     # offline engine + API contract
python test_pipeline.py   # offline, mocks the Gemini client
python test_fallback.py   # offline, verifies the model fallback chain
python test_gemini.py     # live, needs a real key and a running server
```

Frontend checks:

```powershell
cd frontend
npx tsc --noEmit
npx expo export --platform web
```

## API at a glance

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Health + active model/mode |
| POST | `/plan/checkin` | Brain dump -> parsed tasks, energy, reply |
| POST | `/plan/steps` | Task -> micro-steps of 10 minutes or less |
| POST | `/plan/schedule` | Tasks -> scheduled tasks + Reality Check |
| POST | `/ai/plan` | Legacy brain dump -> list of micro-step strings |

See `backend/README.md` for request/response examples and
`frontend/README.md` for screen and state details.

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
