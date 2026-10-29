# NudgePlan Backend (FastAPI + Gemini)

## Setup (Windows / PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

`backend/.env` controls behaviour:

```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_MODEL_FALLBACKS=gemini-3.6-flash,gemini-3.8-flash
GEMINI_MOCK=false
PORT=8001
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
API_AUTH_TOKEN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
AUTH_REQUIRED=true
AI_RATE_LIMIT=30
AI_RATE_WINDOW_SECONDS=60
MAX_REQUEST_BYTES=65536
HOST=127.0.0.1
```

| `GEMINI_MOCK` | Behaviour                                             |
| ------------- | ----------------------------------------------------- |
| `true`       | Offline planner. No API key, no network, no cost.     |
| `false`      | Real Gemini calls. Needs a valid `GEMINI_API_KEY`.    |

The backend binds to loopback by default. Before exposing `HOST` beyond
loopback, configure **Supabase auth** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`AUTH_REQUIRED=true`) and put the API behind a TLS reverse proxy. The app sends
the signed-in user's Supabase access token as `Authorization: Bearer ...`; the
backend verifies it with Supabase before allowing `/ai/*` or `/plan/*`.

`API_AUTH_TOKEN` is only a local/self-hosted fallback for when Supabase is not
configured. It is ignored once Supabase is enabled, so it can never bypass real
user auth. If you use it, send it as `X-API-Key` from a trusted server, never
from the Expo bundle.

`CORS_ORIGINS` must contain exact browser origins only; `*` is rejected. The API
also applies a per-user/IP AI rate limit (`AI_RATE_LIMIT` requests per
`AI_RATE_WINDOW_SECONDS`), caps request bodies, and adds hardening headers.
Swagger docs are hidden automatically when Supabase auth is enabled; set
`ENABLE_DOCS=true` only on a private staging instance.

The database must also have Row Level Security enabled. Run
[`supabase_setup.sql`](../supabase_setup.sql) in the Supabase SQL editor; it
adds the `tasks.due_date` column and owner-only policies for every user table.

Get a free key at https://aistudio.google.com/apikey, paste it into
`GEMINI_API_KEY`, and set `GEMINI_MOCK=false`.

### Model choice

Google retires models often, so the defaults here are current as of October 2026:

| Model                | Status                                       |
| -------------------- | -------------------------------------------- |
| `gemini-2.5-flash`   | 404 for new API keys. Not usable.            |
| `gemini-2.0-flash`   | Shut down 2026-06-01.                        |
| `gemini-3.8-flash`   | Best quality, frequently 503 under load.     |
| `gemini-3.6-flash`   | Reliable and good quality. Fallback.         |
| `gemini-3.5-flash-lite` | Fastest and cheapest. **Default.**        |

The backend tries `GEMINI_MODEL` first, then each entry in
`GEMINI_MODEL_FALLBACKS`, so a 503 on one model self-heals instead of
failing the request. The response includes the `model` that actually served it.

## Run

```powershell
python run.py
```

Or with auto-reload during development:

```powershell
python run.py --reload
```

- API root: http://localhost:8001
- Health check: http://localhost:8001/health
- Interactive docs: http://localhost:8001/docs

The frontend may use HTTP only for loopback development. Remote or physical
device deployments must set `EXPO_PUBLIC_API_URL` to an HTTPS endpoint and the
Supabase public URL/anon key in `frontend/.env`. Do not put `API_AUTH_TOKEN` or
`GEMINI_API_KEY` in `EXPO_PUBLIC_*` variables: Expo inlines them into the app
bundle.

### Why port 8001 and not 8000

Local AI tooling (opencode, Ollama, LM Studio) treats port 8000 as a possible
OpenAI-compatible LLM server and polls `/v1/models` on it. Running the backend
on 8001 keeps your logs free of unrelated 404s.

### If you get `WinError 10013`

The port is blocked, usually by an orphaned uvicorn reloader child:

```powershell
python free_port.py 8001
python run.py --reload
```

## Testing

```powershell
python test_pipeline.py   # offline, no key needed, mocks the Gemini client
python test_fallback.py   # offline, verifies the model fallback chain
python test_gemini.py     # live, needs GEMINI_API_KEY and a running server
```

## Endpoints

| Method | Path       | Description                           |
| ------ | ---------- | ------------------------------------- |
| GET    | `/`        | Service status                        |
| GET    | `/health`  | Health check with active model/mode   |
| POST   | `/ai/plan` | Brain dump -> structured plan         |
| POST   | `/ai/steps` | Backward-compatible alias for `/plan/steps` |
| POST   | `/plan/checkin` | Brain dump -> app task shape with deadlines |
| POST   | `/plan/steps` | One task -> guarded micro-steps    |

`/ai/*` and `/plan/*` are the protected routes. `/` and `/health` stay public
for uptime checks. `/ai/steps` remains for older clients; the app uses
`/plan/steps`.

### Request

```json
{ "text": "Finish my report, do laundry, and go to the gym" }
```

### Response

```json
{
  "tasks": [
    {
      "title": "Draft the report outline",
      "minutes": 25,
      "energy": "high",
      "priority": "high",
      "due": "today",
      "steps": ["Open the document", "Write three headings", "Stop there"]
    },
    {
      "title": "Start one load of laundry",
      "minutes": 10,
      "energy": "low",
      "priority": "medium",
      "due": null,
      "steps": ["Collect the basket", "Press start"]
    }
  ],
  "breakdown": "Protect the morning for writing, then batch chores.",
  "raw": "{...}",
  "model": "gemini-3.6-flash"
}
```

`model` reports which model actually served the request. In `GEMINI_MOCK` mode
it is `null` and `source` is `offline`.

### App check-in and micro-step routes

The native app uses two narrower endpoints:

```json
POST /plan/checkin
{ "text": "I have a chemistry exam on November 5", "energy": "medium", "start_h": 9, "end_h": 18 }
```

The response is already in the app's task shape. `dueDate` is an ISO calendar
date, `start` is minutes after midnight, and every task carries guarded steps:

```json
{
  "items": [
    {
      "title": "Review chemistry lecture notes for the exam",
      "dur": 45,
      "effort": "med",
      "day": "today",
      "pri": 3,
      "start": null,
      "fixed": false,
      "done": false,
      "steps": [{ "text": "Open the notebook to the first topic", "min": 5, "done": false }],
      "dueDate": "2026-11-05"
    }
  ],
  "energy": "low",
  "reply": "Review one topic today, then stop.",
  "source": "gemini",
  "model": "gemini-3.5-flash-lite"
}
```

`POST /plan/steps` takes `{ "title", "effort", "dur" }` and returns
`{ "steps": [...], "source", "model" }`. This route has its own stricter
Micro-Step Guard prompt: the first step must be a physical action under five
minutes, every step names the exact object, and the last step stops at a clear
point. The app shows the reported `model` in Profile, so a fallback model is
visible instead of silently changing quality.

### The Micro-Step Guard

The model is never trusted directly. Every response passes through
`_normalise_plan()` in `main.py`:

| Field      | Guard                                                          |
| ---------- | -------------------------------------------------------------- |
| `title`    | Whitespace collapsed, empty titles drop the task               |
| `minutes`  | Coerced to int, clamped to 5-480, rounded to the nearest 5     |
| `energy`   | Must be `low`/`medium`/`high`, otherwise `medium`              |
| `priority` | Must be `low`/`medium`/`high`, otherwise `medium`              |
| `due`      | Only `today`, `tomorrow`, `next-week`, or a real future `YYYY-MM-DD` |
| `start`    | Optional clock time normalised to 24-hour `HH:MM`             |
| `steps`    | Max 5; empty steps get a synthetic `Start: <title>` first step |
| task count | Capped at 8                                                    |

Unparseable output returns zero tasks rather than inventing tasks from prose.
`frontend/src/lib/api.ts` validates the response shape again on the client, so a
stale or modified backend still cannot corrupt the UI.

### Prompting

The request pins `response_mime_type: application/json` and passes a Pydantic
`response_schema` (`PlanPayload`), so Gemini returns the exact shape above
instead of a JSON-ish paragraph that needs regex recovery.
