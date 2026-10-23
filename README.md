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

- `frontend/src/lib/engine.ts` - TypeScript port of parsing, capacity, scheduling,
  Reality Check, and micro-step generation. Used offline and as an instant fallback.
- `backend/engine.py` - Python mirror of the same rules, covered by `test_engine.py`.
- `backend/main.py` - API routes. Gemini is optional; every route degrades to the
  deterministic engine when mock mode is on or a call fails.

## Quick start (no Android phone required)

You can develop and test everything in a web browser. The code stays
Android-first, so nothing needs to change when you get a device.

### 1. Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

`backend/.env.example` ships with `GEMINI_MOCK=true`, so it works with **no API key**.
To use real AI later, get a free key at https://aistudio.google.com/apikey,
paste it into `GEMINI_API_KEY`, and set `GEMINI_MOCK=false`.

```powershell
python run.py
```

Backend runs on http://localhost:8001

### 2. Frontend

```powershell
cd frontend
npm install
npx expo start --web
```

Open http://localhost:8081 and type a brain dump, or open Profile and try the
prototype demos.

### 3. Test the API directly

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
