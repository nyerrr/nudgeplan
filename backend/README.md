# NudgePlan Backend (FastAPI + Gemini)

The backend turns a natural-language brain dump into structured tasks, schedules
them against your working hours and energy, runs the Reality Check, and breaks
stuck tasks into micro-steps.

The deterministic engine (`engine.py`) does all of this without a network call.
Gemini is optional: when configured, it improves parsing of messy language and
micro-step wording. If a Gemini call fails, the route silently falls back to the
local engine instead of returning an error.

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
GEMINI_MODEL=gemini-3.6-flash
GEMINI_MODEL_FALLBACKS=gemini-3.5-flash-lite,gemini-3.8-flash
GEMINI_MOCK=true
PORT=8001
```

| `GEMINI_MOCK` | Behaviour                                             |
| ------------- | ----------------------------------------------------- |
| `true`        | Offline planner. No API key, no network, no cost.     |
| `false`       | Real Gemini calls when a valid key is configured.     |

The service still runs in offline mode if `GEMINI_MOCK=false` but the key is
missing or is still the `your_gemini_api_key_here` placeholder.

Get a free key at https://aistudio.google.com/apikey, paste it into
`GEMINI_API_KEY`, and set `GEMINI_MOCK=false`.

### Model choice

Google retires models often, so the defaults here are current as of October 2026:

| Model                | Status                                       |
| -------------------- | -------------------------------------------- |
| `gemini-2.5-flash`   | 404 for new API keys. Not usable.            |
| `gemini-2.0-flash`   | Shut down 2026-06-01.                        |
| `gemini-3.8-flash`   | Best quality, frequently 503 under load.     |
| `gemini-3.6-flash`   | Reliable and good quality. **Default.**      |
| `gemini-3.5-flash-lite` | Fastest and cheapest. Fallback.           |

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
python test_engine.py     # offline engine rules + API contracts
python test_pipeline.py   # offline, mocks the Gemini client
python test_fallback.py   # offline, verifies the model fallback chain
python test_gemini.py     # live, needs GEMINI_API_KEY and a running server
```

`test_engine.py` covers brain-dump parsing, fixed times, durations, energy-aware
capacity, peak-hour placement, the Reality Check, the 10-minute cap on
micro-steps, AI-row normalisation (bad rows are dropped without discarding valid
tasks), and the `/health`, `/plan/checkin`, `/plan/steps`, and `/plan/schedule`
contracts through FastAPI's test client.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/` | Service status |
| GET | `/health` | Health, active model, mock mode |
| POST | `/plan/checkin` | Brain dump -> structured tasks + energy + reply |
| POST | `/plan/steps` | Task -> micro-steps of 10 minutes or less |
| POST | `/plan/schedule` | Tasks -> scheduled tasks + Reality Check |
| POST | `/ai/plan` | Legacy brain dump -> micro-step strings |

### `POST /plan/checkin`

Request:

```json
{
  "text": "I'm tired today. Study for the chem exam 90m, laundry",
  "energy": "medium",
  "start_h": 9,
  "end_h": 18
}
```

Response:

```json
{
  "items": [
    {
      "id": "t1...",
      "title": "Study for the chem exam",
      "dur": 90,
      "effort": "high",
      "day": "today",
      "pri": 2,
      "start": null,
      "fixed": false,
      "done": false,
      "stuck": false,
      "steps": []
    },
    {
      "id": "t1...",
      "title": "Laundry",
      "dur": 20,
      "effort": "low",
      "day": "today",
      "pri": 2,
      "start": null,
      "fixed": false,
      "done": false,
      "stuck": false,
      "steps": []
    }
  ],
  "energy": "low",
  "reply": "Low energy noted. I will protect your open hours.\nAdded 2 tasks. ...",
  "model": "offline-planner",
  "source": "offline"
}
```

`source` is `gemini` when AI parsing was used, otherwise `offline`. The mobile app
uses the returned items and reply, then applies its own scheduling and Reality
Check locally so the UI responds instantly.

### `POST /plan/steps`

Request:

```json
{ "title": "Draft client proposal", "effort": "high" }
```

Response:

```json
{
  "steps": [
    { "text": "Open a blank page and name it", "min": 2, "done": false },
    { "text": "List the 3 points you must cover", "min": 5, "done": false }
  ],
  "model": "offline-planner",
  "source": "offline"
}
```

Every step is capped at 10 minutes.

### `POST /plan/schedule`

Request:

```json
{
  "tasks": [
    {
      "title": "Draft client proposal",
      "dur": 90,
      "effort": "high",
      "day": "today",
      "pri": 2,
      "start": null,
      "fixed": false
    }
  ],
  "start_h": 9,
  "end_h": 18,
  "energy": "medium"
}
```

Response includes `tasks` with assigned `start` minutes (minutes since midnight)
and `reality`:

```json
{
  "tasks": [
    {
      "id": "t1...",
      "title": "Draft client proposal",
      "dur": 90,
      "effort": "high",
      "day": "today",
      "pri": 2,
      "start": 540,
      "fixed": false,
      "done": false,
      "stuck": false,
      "steps": []
    }
  ],
  "reality": {
    "planned_min": 90,
    "available_min": 486,
    "percent": 19,
    "over": false,
    "tight": false,
    "moves_needed": 1,
    "message": "Your day is at 19% capacity. You have open hours."
  }
}
```

### `POST /ai/plan` (legacy)

Kept for compatibility with the original prototype and tests:

```json
{ "text": "Finish my report, do laundry, and go to the gym" }
```

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
it is `offline-planner`.

### The Micro-Step Guard

The model is never trusted directly. Every response passes through
`_normalise_plan()` in `main.py`:

| Field      | Guard                                                          |
| ---------- | -------------------------------------------------------------- |
| `title`    | Whitespace collapsed, empty titles drop the task               |
| `minutes`  | Coerced to int, clamped to 5-480, rounded to the nearest 5     |
| `energy`   | Must be `low`/`medium`/`high`, otherwise `medium`              |
| `priority` | Must be `low`/`medium`/`high`, otherwise `medium`              |
| `due`      | Only `today`, `tomorrow`, `next-week`, or `YYYY-MM-DD`; else null |
| `steps`    | Max 5; empty steps get a synthetic `Start: <title>` first step |
| task count | Capped at 8                                                    |

Unparseable output returns zero tasks rather than inventing tasks from prose.
`frontend/src/api/plan.ts` applies the same rules again on the client, so a
stale or modified backend still cannot corrupt the UI.

### Prompting

The request pins `response_mime_type: application/json` and passes a Pydantic
`response_schema` (`PlanPayload`), so Gemini returns the exact shape above
instead of a JSON-ish paragraph that needs regex recovery.
