"""NudgePlan API.

Brain dump in, startable plan out.

The contract is deliberately small: Gemini (or the offline planner) returns a
list of structured tasks, and everything downstream - the confirmation screen,
the Reality Check, the Micro-Step Guard - works from that shape. The model is
never trusted directly: every field is clamped and normalised here, so a bad
generation degrades into something usable instead of breaking the UI.
"""

import json
import os
import re
import secrets
from datetime import date, timedelta
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

import planner

load_dotenv()

app = FastAPI(
    title="NudgePlan API",
    description="Brain dump, Reality Check Engine, and Micro-Step Guard for NudgePlan.",
    version="0.2.0",
)

configured_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:8081,http://localhost:19006"
    ).split(",")
    if origin.strip()
]
api_auth_token = os.getenv("API_AUTH_TOKEN", "").strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if (
            api_auth_token
            and request.method != "OPTIONS"
            and request.url.path not in {"/", "/health"}
        ):
            supplied = request.headers.get("x-api-key", "")
            if not secrets.compare_digest(supplied, api_auth_token):
                return JSONResponse({"detail": "Authentication required"}, status_code=401)

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response


app.add_middleware(SecurityHeadersMiddleware)

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None

# Current model defaults (see https://ai.google.dev/gemini-api/docs/models):
#   gemini-2.0-flash  -> shut down 2026-06-01
#   gemini-2.5-flash  -> access limited to users who used it before, so a
#                        brand new API key may be denied
# Google recommends 3.8 Flash or 3.5 Flash-Lite for new projects.
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

# Tried in order if the primary model is unavailable for this key.
MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv(
        "GEMINI_MODEL_FALLBACKS", "gemini-3.6-flash,gemini-3.5-flash-lite"
    ).split(",")
    if m.strip()
]

# Port 8001 by default. Port 8000 is probed by local AI tooling (opencode,
# Ollama, LM Studio) that treats it as a possible OpenAI-compatible LLM
# server, which fills the logs with unrelated 404s.
PORT = int(os.getenv("PORT", "8001"))

# Offline mode: use the local heuristic planner instead of the Gemini API.
MOCK = os.getenv("GEMINI_MOCK", "").strip().lower() in {"1", "true", "yes", "on"}
HAS_REAL_KEY = bool(api_key) and "your_gemini_api_key" not in api_key

if not HAS_REAL_KEY and not MOCK:
    print(
        "\n[WARNING] No usable GEMINI_API_KEY found.\n"
        "          Option A: add your key to backend/.env (https://aistudio.google.com/apikey)\n"
        "          Option B: set GEMINI_MOCK=true in backend/.env to use the offline planner\n"
    )
elif MOCK:
    print("\n[INFO] GEMINI_MOCK=true - using the offline planner, no API key needed.\n")


Energy = Literal["low", "medium", "high"]
Priority = Literal["low", "medium", "high"]

ALLOWED_LEVELS = {"low", "medium", "high"}
MAX_TASKS = 8
MIN_MINUTES = 5
MAX_MINUTES = 480

DUE_ALIASES = {
    "today": "today",
    "tonight": "today",
    "this morning": "today",
    "this afternoon": "today",
    "this evening": "today",
    "tomorrow": "tomorrow",
    "tmrw": "tomorrow",
    "next week": "next-week",
    "next-week": "next-week",
    "this week": "next-week",
    "weekend": "next-week",
}
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Models routinely guess a date from stale training data ("2023-10-27" for
# "by Friday"). Anything before today or absurdly far out is not a real due
# date, so it is dropped rather than shown to the user.
MAX_DUE_DAYS = 366


class PlannedTask(BaseModel):
    """One task the user can start right now."""

    title: str = Field(..., description="A single, specific action.")
    minutes: int = Field(20, description="Realistic focused-work estimate.")
    energy: Energy = Field("medium", description="Mental energy this needs.")
    priority: Priority = Field("medium", description="How much it matters today.")
    due: str | None = Field(
        None, description="'today', 'tomorrow', 'next-week', or an ISO date."
    )
    steps: list[str] = Field(
        default_factory=list, description="Micro-steps; the first must start in <10 min."
    )


class PlanPayload(BaseModel):
    """The exact JSON shape we ask Gemini to produce."""

    tasks: list[PlannedTask]
    breakdown: str = ""


class PlanRequest(BaseModel):
    text: str = Field(
        ..., min_length=1, max_length=12_000, description="Raw brain dump from the user."
    )


class PlanResponse(BaseModel):
    tasks: list[PlannedTask]
    breakdown: str
    raw: str
    model: str | None = None


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "NudgePlan API",
        "gemini_configured": HAS_REAL_KEY,
        "mock_mode": MOCK,
        "port": PORT,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "offline-planner" if MOCK else MODEL_NAME,
        "fallbacks": [] if MOCK else MODEL_FALLBACKS,
        "gemini_configured": HAS_REAL_KEY,
        "mock_mode": MOCK,
    }


@app.post("/ai/plan", response_model=PlanResponse)
async def plan_tasks(req: PlanRequest):
    if MOCK or not HAS_REAL_KEY:
        offline = planner.breakdown(req.text)
        # Run the offline plan through the same guard, so both code paths are
        # guaranteed to satisfy the same contract.
        tasks, breakdown = _normalise_plan(offline)
        return PlanResponse(
            tasks=tasks,
            breakdown=breakdown,
            raw="(offline planner - no Gemini API call made)",
            model="offline-planner",
        )

    raw, used_model, errors = _generate_with_fallback(build_prompt(req.text))
    if raw is None:
        raise HTTPException(
            status_code=502,
            detail=(
                "All Gemini models failed. "
                + "; ".join(errors)
                + ". Check GEMINI_API_KEY and GEMINI_MODEL in backend/.env."
            ),
        )

    tasks, breakdown = _normalise_plan(_parse_json(raw))
    return PlanResponse(
        tasks=tasks,
        breakdown=breakdown,
        raw=raw,
        model=used_model,
    )


PROMPT_TEMPLATE = """You are the NudgePlan planning assistant. The user dumped \
everything on their mind.

Today is {weekday}, {today}. Resolve relative dates ("Friday", "next week") \
against that date, and never return a date in the past.

Turn the dump into 2 to {max_tasks} concrete tasks. Rules:

- Each task is ONE specific action, not a project. "Draft the intro paragraph" \
is a task; "write the paper" is not.
- "minutes" is a realistic focused-work estimate between {min_minutes} and \
{max_minutes}. Do not inflate it.
- "energy" is the mental energy required: "low", "medium", or "high".
- "priority" is "low", "medium", or "high". Use "high" only when there is a \
real deadline or consequence.
- "due" is set ONLY when the dump implies timing. Use "today", "tomorrow", \
"next-week", or an ISO date (YYYY-MM-DD). Otherwise null.
- "steps" is 2 to 4 micro-steps. The FIRST step must be startable in under 10 \
minutes and must not require making a decision.
- Do not invent tasks the user did not mention. Do not merge unrelated things.
- "breakdown" is 1 or 2 sentences explaining the plan.

Return STRICT JSON and nothing else, matching exactly this shape:

{{"tasks": [{{"title": "...", "minutes": 20, "energy": "medium", \
"priority": "high", "due": "today", "steps": ["...", "..."]}}], \
"breakdown": "..."}}

User dump:
{text}
"""


def build_prompt(text: str) -> str:
    today = date.today()
    return PROMPT_TEMPLATE.format(
        today=today.isoformat(),
        weekday=today.strftime("%A"),
        max_tasks=MAX_TASKS,
        min_minutes=MIN_MINUTES,
        max_minutes=MAX_MINUTES,
        text=text,
    )


def _generate_with_fallback(prompt: str) -> tuple[str | None, str | None, list[str]]:
    """Try each model in turn, returning (text, model_used, errors)."""
    errors: list[str] = []
    for model in [MODEL_NAME, *MODEL_FALLBACKS]:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": PlanPayload,
                },
            )
            text = response.text or ""
            if text.strip():
                return text, model, errors
            errors.append(f"{model}: empty response")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{model}: {_short_error(exc)}")
    return None, None, errors


def _short_error(exc: Exception) -> str:
    text = " ".join(str(exc).split())
    return text[:160] if text else exc.__class__.__name__


def _parse_json(text: str) -> dict:
    """Parse the model's reply, tolerating code fences and prose wrappers."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[-1]
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Some models wrap the object in prose. Try the outermost braces.
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            return {}
        try:
            parsed = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            return {}
    return parsed if isinstance(parsed, dict) else {}


def _normalise_plan(parsed: dict) -> tuple[list[PlannedTask], str]:
    """Apply the Micro-Step Guard to whatever the model produced."""
    raw_tasks = parsed.get("tasks")
    if isinstance(raw_tasks, str):
        raw_tasks = [raw_tasks]
    if not isinstance(raw_tasks, list):
        raw_tasks = []

    tasks: list[PlannedTask] = []
    for entry in raw_tasks:
        task = _normalise_task(entry)
        if task is not None:
            tasks.append(task)
        if len(tasks) >= MAX_TASKS:
            break

    breakdown = _clean_text(parsed.get("breakdown"), 400)
    if not breakdown and tasks:
        count = len(tasks)
        breakdown = f"Split your dump into {count} startable task{'s' if count != 1 else ''}."

    return tasks, breakdown


def _normalise_task(entry: object) -> PlannedTask | None:
    if isinstance(entry, str):
        entry = {"title": entry}
    if not isinstance(entry, dict):
        return None

    title = _clean_text(entry.get("title") or entry.get("task"), 140)
    if not title:
        return None

    return PlannedTask(
        title=title,
        minutes=_coerce_minutes(entry.get("minutes")),
        energy=_coerce_level(entry.get("energy"), "medium"),
        priority=_coerce_level(entry.get("priority"), "medium"),
        due=_coerce_due(entry.get("due")),
        steps=_coerce_steps(entry.get("steps"), title),
    )


def _clean_text(value: object, limit: int) -> str:
    if value is None:
        return ""
    text = " ".join(str(value).split())
    return text[:limit]


def _coerce_minutes(value: object) -> int:
    try:
        minutes = int(float(value))  # accepts 25, "25", 25.4
    except (TypeError, ValueError):
        return 20
    minutes = max(MIN_MINUTES, min(MAX_MINUTES, minutes))
    # Round to the nearest 5: estimates are not precise and never should look so.
    return max(MIN_MINUTES, int(round(minutes / 5.0)) * 5)


def _coerce_level(value: object, default: str) -> str:
    text = str(value or "").strip().lower()
    if text in ALLOWED_LEVELS:
        return text
    aliases = {"med": "medium", "mid": "medium", "hi": "high", "lo": "low"}
    return aliases.get(text, default)


def _coerce_due(value: object) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split()).lower()
    if not text or text in {"none", "null", "no deadline", "n/a"}:
        return None
    if text in DUE_ALIASES:
        return DUE_ALIASES[text]
    if ISO_DATE.match(text):
        try:
            parsed = date.fromisoformat(text)
        except ValueError:
            return None
        today = date.today()
        if parsed < today or parsed > today + timedelta(days=MAX_DUE_DAYS):
            return None
        return text
    return None


def _coerce_steps(value: object, title: str) -> list[str]:
    items: list[str] = []

    if isinstance(value, str):
        parts = re.split(r"\n|;", value)
    elif isinstance(value, list):
        parts = value
    else:
        parts = []

    for part in parts:
        if isinstance(part, dict):
            part = part.get("text") or part.get("step") or part.get("title")
        text = _clean_text(part, 120)
        if text:
            items.append(text)
        if len(items) >= 5:
            break

    # Micro-Step Guard: a task with no first step is a task that will not start.
    if not items:
        items = [f"Start: {title}"]

    return items
