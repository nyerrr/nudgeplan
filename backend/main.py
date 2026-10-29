"""NudgePlan API.

Brain dump in, startable plan out.

The contract is deliberately small: Gemini (or the offline planner) returns a
list of structured tasks, and everything downstream - the confirmation screen,
the Reality Check, the Micro-Step Guard - works from that shape. The model is
never trusted directly: every field is clamped and normalised here, so a bad
generation degrades into something usable instead of breaking the UI.
"""

import asyncio
import json
import os
import re
import secrets
import time
from datetime import date, timedelta
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

import auth as supabase_auth
import planner

load_dotenv()

_TRUTHY = {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, minimum: int = 0) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except ValueError:
        return default


configured_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:8081,http://localhost:19006"
    ).split(",")
    if origin.strip()
]
if "*" in configured_origins:
    raise RuntimeError("CORS_ORIGINS must list explicit origins; '*' is unsafe.")
for origin in configured_origins:
    if not origin.startswith(("http://", "https://")):
        raise RuntimeError(f"Invalid CORS origin: {origin!r}")
api_auth_token = os.getenv("API_AUTH_TOKEN", "").strip()
supabase_auth_enabled = supabase_auth.auth_enabled()

# Keep the interactive docs available while developing locally. Once Supabase
# auth is enabled (production), hide them unless explicitly requested.
_docs_setting = os.getenv("ENABLE_DOCS")
docs_enabled = (
    _docs_setting.strip().lower() in _TRUTHY
    if _docs_setting is not None
    else not supabase_auth_enabled
)

app = FastAPI(
    title="NudgePlan API",
    description="Brain dump, Reality Check Engine, and Micro-Step Guard for NudgePlan.",
    version="0.2.0",
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

# Only the AI endpoints cost money, so only they are gated. `/` and `/health`
# stay public so uptime checks and the in-app status badge keep working.
PROTECTED_PREFIXES = ("/ai/", "/plan/")

AI_RATE_LIMIT = _env_int("AI_RATE_LIMIT", 30, 0)
AI_RATE_WINDOW_SECONDS = _env_int("AI_RATE_WINDOW_SECONDS", 60, 1)
MAX_REQUEST_BYTES = _env_int("MAX_REQUEST_BYTES", 65_536, 1_024)
_rate_lock = asyncio.Lock()
_rate_hits: dict[str, list[float]] = {}


async def _authenticate(request: Request) -> JSONResponse | None:
    """Return a 401 response when the caller may not use the AI endpoints.

    Supabase is authoritative whenever it is configured, so a static API key
    can never bypass real user authentication. The static key remains as a
    local/self-hosted fallback only while Supabase is not configured.
    """
    if supabase_auth_enabled:
        token = supabase_auth.bearer_token(request.headers.get("authorization"))
        if not token:
            return JSONResponse(
                {"detail": "Sign in to use AI planning."},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id, error = await supabase_auth.user_id_for_token(token)
        if error or not user_id:
            return JSONResponse(
                {"detail": error or "Your session is not valid."},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )

        request.state.user_id = user_id
        return None

    if api_auth_token:
        supplied = request.headers.get("x-api-key", "")
        if not secrets.compare_digest(supplied, api_auth_token):
            return JSONResponse(
                {"detail": "Authentication required"}, status_code=401
            )
        request.state.api_key_authenticated = True
        return None

    # Local development without Supabase, or AUTH_REQUIRED=false.
    return None


async def _rate_limited(subject: str) -> bool:
    """Small in-process guard against accidental loops and API-cost abuse."""
    if AI_RATE_LIMIT <= 0:
        return False

    now = time.monotonic()
    cutoff = now - AI_RATE_WINDOW_SECONDS
    async with _rate_lock:
        hits = _rate_hits.get(subject)
        if hits is None:
            hits = []
            _rate_hits[subject] = hits
        while hits and hits[0] <= cutoff:
            hits.pop(0)
        if len(hits) >= AI_RATE_LIMIT:
            return True
        hits.append(now)

        # Keep the dictionary bounded on a long-running process.
        if len(_rate_hits) > 4_096:
            for key in [
                key for key, values in _rate_hits.items() if not values or values[-1] <= cutoff
            ]:
                _rate_hits.pop(key, None)
        return False


def _with_security_headers(response, request: Request):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    )
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cache-Control"] = "no-store"

    forwarded_proto = (
        request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    )
    if request.url.scheme == "https" or forwarded_proto == "https":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

    # The API only returns JSON. Keep a strict policy for it, but leave the
    # Swagger UI pages alone so the docs still render when enabled.
    if not request.url.path.startswith(("/docs", "/redoc", "/openapi.json")):
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
    return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        is_protected = request.url.path.startswith(PROTECTED_PREFIXES)
        if request.method != "OPTIONS" and is_protected:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    too_large = int(content_length) > MAX_REQUEST_BYTES
                except ValueError:
                    too_large = False
                if too_large:
                    return _with_security_headers(
                        JSONResponse(
                            {"detail": "Request body is too large."},
                            status_code=413,
                        ),
                        request,
                    )

            rejection = await _authenticate(request)
            if rejection is not None:
                return _with_security_headers(rejection, request)

            subject = getattr(request.state, "user_id", None) or (
                f"ip:{request.client.host}" if request.client else "ip:unknown"
            )
            if await _rate_limited(subject):
                return _with_security_headers(
                    JSONResponse(
                        {"detail": "Too many AI requests. Try again shortly."},
                        status_code=429,
                        headers={"Retry-After": str(AI_RATE_WINDOW_SECONDS)},
                    ),
                    request,
                )

        response = await call_next(request)
        return _with_security_headers(response, request)


app.add_middleware(SecurityHeadersMiddleware)

# Added last so it is the outermost layer: a 401 from the auth check still
# carries CORS headers, which a browser needs in order to read the response.
_cors_headers = ["Content-Type", "Authorization"]
if api_auth_token and not supabase_auth_enabled:
    _cors_headers.append("X-API-Key")
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=_cors_headers,
    max_age=600,
)

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
MAX_STEPS = 4
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
    start: str | None = Field(
        None,
        description="Fixed clock time in 24-hour HH:MM when the dump names one, else null.",
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


class StepOut(BaseModel):
    """A single micro-step returned to the app."""

    id: str | None = None
    text: str
    min: int = 5
    done: bool = False


class TaskOut(BaseModel):
    """The task shape the React Native app already uses."""

    id: str | None = None
    title: str
    dur: int
    effort: Literal["low", "med", "high"]
    day: Literal["today", "tomorrow"]
    pri: int
    start: int | None = None
    fixed: bool = False
    done: bool = False
    stuck: bool = False
    steps: list[StepOut] = Field(default_factory=list)
    dueDate: str | None = None


class CheckInRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=12_000)
    energy: Energy = "medium"
    start_h: int = Field(9, ge=0, le=23)
    end_h: int = Field(18, ge=1, le=24)


class CheckInResponse(BaseModel):
    items: list[TaskOut]
    energy: Energy | None = None
    reply: str = ""
    source: Literal["gemini", "offline"] = "gemini"
    model: str | None = None


class MicroStep(BaseModel):
    text: str
    minutes: int = 5


class StepPayload(BaseModel):
    steps: list[MicroStep] = Field(default_factory=list)


class StepsRequest(BaseModel):
    """Shared request for both the app route and the legacy /ai/steps route."""

    title: str = Field(
        ..., min_length=1, max_length=400, description="The task to break down."
    )
    effort: str = Field(
        "med", pattern="^(low|med|high)$", description="How heavy the task feels."
    )
    dur: int = Field(
        45, ge=5, le=480, description="How long the user has for the whole task."
    )


class StepsResponse(BaseModel):
    """Superset of the legacy response so old clients keep working."""

    steps: list[StepOut]
    raw: str = ""
    source: Literal["gemini", "offline"] = "offline"
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


def _steps_response(title: str, effort: str, dur: int) -> StepsResponse:
    """Generate guarded steps for the app route and the legacy alias."""
    clean_title = _clean_text(title, 160) or "Start with the smallest move."
    offline = _steps_from_offline(clean_title, dur)

    if MOCK or not HAS_REAL_KEY:
        return StepsResponse(
            steps=offline,
            raw="(offline planner - no Gemini API call made)",
            source="offline",
            model="offline-planner",
        )

    raw, used_model, errors = _generate_with_fallback(
        build_steps_prompt(clean_title, effort, dur),
        schema=StepPayload,
    )
    if raw is None:
        # Degrading beats failing here: the user still gets usable steps.
        return StepsResponse(
            steps=offline,
            raw="; ".join(errors),
            source="offline",
            model=None,
        )

    steps = _normalise_steps(_parse_json(raw), clean_title, dur)
    if not steps:
        return StepsResponse(
            steps=offline,
            raw=raw,
            source="offline",
            model=used_model,
        )

    return StepsResponse(steps=steps, raw=raw, source="gemini", model=used_model)


@app.post("/ai/steps", response_model=StepsResponse)
async def ai_steps(req: StepsRequest):
    """Backward-compatible alias for the app's /plan/steps route."""
    return _steps_response(req.title, req.effort, req.dur)


@app.post("/plan/checkin", response_model=CheckInResponse)
async def plan_checkin(req: CheckInRequest):
    """The conversational check-in used by the app.

    Gemini turns the dump into the same structured tasks as ``/ai/plan``. The
    response is then converted to the app's task shape, including an ISO
    ``dueDate`` so a future exam or deadline is never silently dropped.
    """
    if MOCK or not HAS_REAL_KEY:
        tasks, breakdown = _normalise_plan(planner.breakdown(req.text))
        return _checkin_response(req, tasks, breakdown, "offline", None)

    raw, used_model, errors = _generate_with_fallback(
        build_checkin_prompt(req.text, req.start_h, req.end_h)
    )
    if raw is None:
        tasks, breakdown = _normalise_plan(planner.breakdown(req.text))
        return _checkin_response(req, tasks, breakdown, "offline", None)

    tasks, breakdown = _normalise_plan(_parse_json(raw))
    return _checkin_response(req, tasks, breakdown, "gemini", used_model)


@app.post("/plan/steps", response_model=StepsResponse)
async def plan_steps(req: StepsRequest):
    """Break one task into Micro-Step Guard-approved steps."""
    return _steps_response(req.title, req.effort, req.dur)


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
- "start" is a 24-hour HH:MM clock time ONLY when the user fixed a time ("at \
6pm", "after lunch" is not fixed). Otherwise null.
- "steps" is 2 to 4 micro-steps. The FIRST step must be startable in under 10 \
minutes and must not require making a decision.
- Do not invent tasks the user did not mention. Do not merge unrelated things.
- "breakdown" is 1 or 2 sentences explaining the plan.

Return STRICT JSON and nothing else, matching exactly this shape:

{{"tasks": [{{"title": "...", "minutes": 20, "energy": "medium", \
"priority": "high", "due": "today", "start": null, "steps": ["...", "..."]}}], \
"breakdown": "..."}}

User dump:
{text}
"""


CHECKIN_PROMPT_TEMPLATE = """You are the NudgePlan planning assistant. The user \
dumped everything on their mind.

Today is {weekday}, {today}. Their work window is {start_h}:00 to {end_h}:00. \
Resolve relative dates ("Friday", "next week", "Nov 5") against today, and never \
return a date in the past.

Turn the dump into 2 to {max_tasks} concrete tasks. Rules:

- Each task is ONE specific action, not a project. "Draft the intro paragraph" \
is a task; "write the paper" is not.
- If the dump mentions a dated event or deadline (an exam, appointment, \
interview, birthday), do NOT turn the event itself into a task. Create the \
preparation action and put the event date in "due" as YYYY-MM-DD. The task must \
still be startable today or tomorrow.
- "minutes" is a realistic focused-work estimate between {min_minutes} and \
{max_minutes}. Do not inflate it.
- "energy" is the mental energy required: "low", "medium", or "high".
- "priority" is "low", "medium", or "high". Use "high" only when there is a \
real deadline or consequence.
- "due" is the deadline or intended day. Use "today", "tomorrow", or an ISO date \
(YYYY-MM-DD). Use null when there is no timing signal.
- "start" is a 24-hour HH:MM clock time ONLY when the user fixed one ("at 6pm"). \
"After lunch" and "this afternoon" are not fixed times; use null.
- "steps" is 3 to 5 micro-steps. The FIRST step must take 5 minutes or less and \
must be a physical action, never a decision ("open", "gather", "write the date"). \
Each step starts with a verb and names the exact object. Do not use vague steps \
such as "work on it", "focus", or "make progress". Match the size of the task: \
3 steps for a 15-minute task, and 4 or 5 meaty steps for a 1-2 hour task. The \
final step must finish or consolidate the work, not just close an app.
- Never invent chapter numbers, page numbers, file names, app names, or people. \
When you do not know the exact location, say "the assigned chapter", "the open \
document", or "the relevant file".
- Do not invent tasks the user did not mention. Do not merge unrelated things.
- "breakdown" is 1 or 2 sentences explaining the plan. If there is a real \
deadline, mention the date.

Return STRICT JSON and nothing else, matching exactly this shape:

{{"tasks": [{{"title": "...", "minutes": 20, "energy": "medium", \
"priority": "high", "due": "2026-11-05", "start": null, "steps": ["...", "..."]}}], \
"breakdown": "..."}}

User dump:
{text}
"""


STEPS_PROMPT_TEMPLATE = """You are the Micro-Step Guard for NudgePlan. The user \
is stuck on one task and needs the smallest honest first move.

Task: {title}
Effort: {effort}
Planned time: {dur} minutes

Return 3 to 5 micro-steps in order. Rules:

- The first step must take 5 minutes or less and be a physical action the user \
can do immediately. It must not require a decision. "Open the document at the \
introduction" is good. "Decide what to write" is not.
- Every step starts with a verb and names the exact object or place.
- Keep each step between 2 and 20 minutes. Use the planned time sensibly: for \
tasks of 45 minutes or more, make the main work steps 15-20 minutes each and use \
4 or 5 steps. For short tasks, use 2-10 minute steps. It is fine to leave buffer, \
but do not turn a 2-hour task into a 20-minute checklist.
- No vague steps such as "work on it", "focus", "make progress", or "do your best".
- The last step must leave the task in a useful state: save, submit, summarize, or \
write down the next question. Simply closing an app or book is not enough.
- Do not invent chapter numbers, page numbers, file names, app names, or people. \
Use "the assigned chapter" or "the relevant file" when the exact location is unknown.
- Do not invent facts the user did not give. Generic setup is fine when needed.

Return STRICT JSON and nothing else:

{{"steps": [{{"text": "Open ...", "minutes": 5}}, {{"text": "...", "minutes": 10}}]}}
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


def build_checkin_prompt(text: str, start_h: int, end_h: int) -> str:
    today = date.today()
    return CHECKIN_PROMPT_TEMPLATE.format(
        today=today.isoformat(),
        weekday=today.strftime("%A"),
        start_h=start_h,
        end_h=end_h,
        max_tasks=MAX_TASKS,
        min_minutes=MIN_MINUTES,
        max_minutes=MAX_MINUTES,
        text=text,
    )


def build_steps_prompt(title: str, effort: str, dur: int) -> str:
    return STEPS_PROMPT_TEMPLATE.format(
        title=title,
        effort=_coerce_level(effort, "medium"),
        dur=_coerce_minutes(dur),
    )


def _generate_with_fallback(
    prompt: str, schema: type[BaseModel] = PlanPayload
) -> tuple[str | None, str | None, list[str]]:
    """Try each model in turn, returning (text, model_used, errors)."""
    errors: list[str] = []
    for model in [MODEL_NAME, *MODEL_FALLBACKS]:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": schema,
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
        start=_coerce_start(entry.get("start") or entry.get("start_time")),
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


CLOCK_RE = re.compile(r"^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$", re.I)
LOW_ENERGY_RE = re.compile(
    r"\b(tired|exhausted|burnt out|burned out|drained|sleepy|low energy|wiped|"
    r"rough day|no energy)\b",
    re.I,
)
HIGH_ENERGY_RE = re.compile(
    r"\b(energized|energised|well rested|rested|fresh|high energy|pumped|"
    r"full of energy)\b",
    re.I,
)
VAGUE_FIRST_RE = re.compile(
    r"^(?:start working|begin working|work on (?:it|this|the task)|"
    r"focus on (?:it|this|the task)|think about|decide|make a plan|"
    r"figure out)\b",
    re.I,
)
QUICK_STEP_RE = re.compile(
    r"\b(open|unlock|gather|put on|collect|find|click|dial|save|close|"
    r"submit|send|press|start|pick up|fill|grab|clear)\b",
    re.I,
)
FOCUS_STEP_RE = re.compile(
    r"\b(read|review|write|draft|answer|highlight|type|copy|study|"
    r"practice|solve|summarize|summarise|outline)\b",
    re.I,
)
TRAVEL_STEP_RE = re.compile(r"\b(drive|commute|travel|walk|ride|bus|train)\b", re.I)


def _coerce_start(value: object) -> str | None:
    """Normalise an optional fixed time to 24-hour HH:MM."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        minutes = int(value)
        if 0 <= minutes < 24 * 60:
            return f"{minutes // 60:02d}:{minutes % 60:02d}"
        return None

    text = " ".join(str(value).split()).lower()
    if not text or text in {"none", "null", "n/a", "no time"}:
        return None
    match = CLOCK_RE.match(text)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    meridiem = (match.group(3) or "").lower()
    if minute > 59 or hour > 23:
        return None
    if meridiem == "pm" and hour < 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _clock_to_minutes(value: str | None) -> int | None:
    if not value:
        return None
    try:
        hour, minute = (int(part) for part in value.split(":", 1))
    except (TypeError, ValueError):
        return None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour * 60 + minute


def _due_to_iso(due: str | None) -> str | None:
    if due is None:
        return None
    today = date.today()
    if due == "today":
        return today.isoformat()
    if due == "tomorrow":
        return (today + timedelta(days=1)).isoformat()
    if due == "next-week":
        return (today + timedelta(days=7)).isoformat()
    if ISO_DATE.match(due):
        return due
    return None


def _detect_energy(text: str) -> Energy | None:
    if LOW_ENERGY_RE.search(text):
        return "low"
    if HIGH_ENERGY_RE.search(text):
        return "high"
    return None


def _clamp_step_minutes(value: object, default: int = 5) -> int:
    try:
        minutes = int(float(value))
    except (TypeError, ValueError):
        minutes = default
    minutes = max(2, min(20, minutes))
    if minutes <= 5:
        return max(2, minutes)
    return max(5, int(round(minutes / 5.0)) * 5)


def _suggested_step_minutes(total: int, count: int, index: int) -> int:
    if index == 0:
        return 5
    remaining = max(5, total - 5)
    slots = max(1, count - 1)
    return _clamp_step_minutes(min(15, remaining / slots))


def _minutes_for_step(text: str, total: int, count: int, index: int) -> int:
    if index == 0:
        return 5
    if QUICK_STEP_RE.search(text):
        return 5
    if TRAVEL_STEP_RE.search(text):
        return 10
    if FOCUS_STEP_RE.search(text):
        return min(15, max(10, _suggested_step_minutes(total, count, index)))
    return _suggested_step_minutes(total, count, index)


def _fit_step_minutes(minutes: list[int], total: int) -> list[int]:
    """Keep step timers honest when a model returns too many steps.

    A 15-minute task should not show five 5-10 minute steps. If the suggested
    timers exceed the task budget, scale them down while keeping at least one
    minute per step. Timers that already fit are left alone so finished work
    still gets a realistic estimate.
    """
    if not minutes:
        return []
    budget = max(int(total), len(minutes), 1)
    if sum(minutes) <= budget:
        return minutes

    scale = budget / sum(minutes)
    fitted = [max(1, int(round(value * scale))) for value in minutes]
    while sum(fitted) > budget:
        index = max(range(len(fitted)), key=lambda i: fitted[i])
        if fitted[index] <= 1:
            break
        fitted[index] -= 1
    return fitted


def _steps_from_texts(texts: list[str], total_minutes: int) -> list[StepOut]:
    cleaned: list[str] = []
    for text in texts:
        value = _clean_text(text, 120)
        if value and value not in cleaned:
            cleaned.append(value)
        if len(cleaned) >= 5:
            break
    if not cleaned:
        return []

    raw_minutes = [
        _minutes_for_step(text, total_minutes, len(cleaned), index)
        for index, text in enumerate(cleaned)
    ]
    minutes = _fit_step_minutes(raw_minutes, total_minutes)
    return [
        StepOut(text=text, min=minutes[index], done=False)
        for index, text in enumerate(cleaned)
    ]


def _steps_from_offline(title: str, dur: int) -> list[StepOut]:
    return _steps_from_texts(planner.make_steps(title), dur)


def _normalise_steps(parsed: dict, title: str, dur: int) -> list[StepOut]:
    """Apply a stricter Micro-Step Guard to a dedicated steps response."""
    raw_steps = parsed.get("steps")
    if isinstance(raw_steps, str):
        raw_steps = [raw_steps]
    if not isinstance(raw_steps, list):
        raw_steps = []

    items: list[StepOut] = []
    for entry in raw_steps:
        text = ""
        minutes: object = None
        if isinstance(entry, str):
            text = _clean_text(entry, 120)
        elif isinstance(entry, dict):
            text = _clean_text(entry.get("text") or entry.get("step"), 120)
            minutes = entry.get("minutes") or entry.get("min")
        if not text or any(item.text == text for item in items):
            continue
        default = _suggested_step_minutes(dur, max(3, len(raw_steps)), len(items))
        items.append(
            StepOut(
                text=text,
                min=_clamp_step_minutes(minutes, default),
                done=False,
            )
        )
        if len(items) >= 5:
            break

    # A model that returns too few steps gets the deterministic setup steps as
    # a safety net. The user should never see a one-step "breakdown".
    fallback = planner.make_steps(title)
    for text in fallback:
        if len(items) >= 3:
            break
        clean = _clean_text(text, 120)
        if clean and all(item.text != clean for item in items):
            items.append(
                StepOut(
                    text=clean,
                    min=_suggested_step_minutes(dur, 3, len(items)),
                    done=False,
                )
            )

    if items and VAGUE_FIRST_RE.search(items[0].text):
        replacement = _clean_text(fallback[0] if fallback else "", 120)
        if replacement:
            items[0] = StepOut(text=replacement, min=5, done=False)

    if items and items[0].min > 10:
        items[0].min = 5

    items = items[:5]
    fitted = _fit_step_minutes([item.min for item in items], dur)
    for item, minutes in zip(items, fitted):
        item.min = minutes
    return items


def _task_out(task: PlannedTask) -> TaskOut:
    due = _due_to_iso(task.due)
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    # ``day`` already carries today/tomorrow scheduling. A real deadline badge
    # is only useful for dates beyond that immediate window.
    due_date = due if due and due > tomorrow else None
    start = _clock_to_minutes(task.start)
    steps = _steps_from_texts(task.steps, task.minutes)
    return TaskOut(
        title=task.title,
        dur=task.minutes,
        effort={"high": "high", "low": "low"}.get(task.energy, "med"),
        day="tomorrow" if due == tomorrow else "today",
        pri={"high": 3, "low": 1}.get(task.priority, 2),
        start=start,
        fixed=start is not None,
        done=False,
        stuck=bool(steps),
        steps=steps,
        dueDate=due_date,
    )


def _checkin_response(
    req: CheckInRequest,
    tasks: list[PlannedTask],
    breakdown: str,
    source: Literal["gemini", "offline"],
    model: str | None,
) -> CheckInResponse:
    items = [_task_out(task) for task in tasks]
    return CheckInResponse(
        items=items,
        energy=_detect_energy(req.text),
        reply=breakdown.strip(),
        source=source,
        model=model,
    )
