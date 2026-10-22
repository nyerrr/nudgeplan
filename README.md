# NudgePlan

Brain dump in. A plan you can actually do out.

NudgePlan is an Android-first mobile app built with React Native + Expo, backed by a
Python FastAPI service that uses the Gemini API for task understanding and breakdown.

## Architecture

```
frontend/  React Native + Expo + TypeScript   (mobile UI, check-ins, task cards)
backend/   Python + FastAPI + google-genai    (AI calls, validation, planning)
```

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

`backend/.env` ships with `GEMINI_MOCK=true`, so it works with **no API key**.
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

Open http://localhost:8081 and type a brain dump.

### 3. Test the API directly

```powershell
cd backend
python test_pipeline.py   # offline, no key needed
python test_gemini.py     # live, needs a real key
```

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
| 1     | 1–4   | Working prototype: setup, brain dump, plan   |
| 2     | 5–8   | Reality Check Engine, Micro-Step Guard       |
| 3     | 9–12  | Supabase auth, persistence, EAS build        |

See `backend/README.md` and `frontend/README.md` for details.
