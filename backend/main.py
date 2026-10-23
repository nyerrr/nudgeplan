import json
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import ValidationError

import engine
import planner
from models import (
    CheckInRequest,
    CheckInResponse,
    HealthResponse,
    MicroStep,
    ParsedTask,
    PlanRequest,
    PlanResponse,
    RealityCheck,
    ScheduleRequest,
    ScheduleResponse,
    StepsRequest,
    StepsResponse,
)

load_dotenv()

app = FastAPI(
    title="NudgePlan API",
    description=(
        "Brain dump, Reality Check Engine, and Micro-Step Guard for NudgePlan. "
        "The deterministic engine runs offline; Gemini upgrades the language "
        "understanding when a key is configured."
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:19006",
        "http://localhost:8081",
        "http://127.0.0.1:19006",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

api_key = os.getenv("GEMINI_API_KEY")
HAS_REAL_KEY = bool(api_key) and "your_gemini_api_key" not in api_key
client = genai.Client(api_key=api_key) if HAS_REAL_KEY else None

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

# Offline mode: use the local engine instead of the Gemini API.
MOCK = os.getenv("GEMINI_MOCK", "").strip().lower() in {"1", "true", "yes", "on"}

if not HAS_REAL_KEY and not MOCK:
    print(
        "\n[WARNING] No usable GEMINI_API_KEY found.\n"
        "          Option A: add your key to backend/.env (https://aistudio.google.com/apikey)\n"
        "          Option B: set GEMINI_MOCK=true in backend/.env to use the offline planner\n"
    )
elif MOCK:
    print("\n[INFO] GEMINI_MOCK=true - using the offline planner, no API key needed.\n")


# ---------------------------------------------------------------------------
# Root + health
# ---------------------------------------------------------------------------


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "NudgePlan API",
        "gemini_configured": HAS_REAL_KEY,
        "mock_mode": MOCK,
        "port": PORT,
    }


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="healthy",
        model="offline-planner" if MOCK or not HAS_REAL_KEY else MODEL_NAME,
        gemini_configured=HAS_REAL_KEY,
        mock_mode=MOCK,
    )


# ---------------------------------------------------------------------------
# Legacy endpoint: plain brain dump -> list of micro-step strings
# ---------------------------------------------------------------------------


@app.post("/ai/plan", response_model=PlanResponse)
async def plan_tasks(req: PlanRequest):
    if MOCK or not HAS_REAL_KEY:
        offline = planner.breakdown(req.text)
        return PlanResponse(
            tasks=offline["tasks"],
            breakdown=offline["breakdown"],
            raw="(offline planner - no Gemini API call made)",
        )

    prompt = (
        "You are the NudgePlan planning assistant. The user dumped everything on their mind.\n"
        "Break the dump into concrete, actionable tasks and keep each step small enough "
        "to start in under 10 minutes.\n\n"
        "Return STRICT JSON with this shape:\n"
        '{"tasks": ["task one", "task two"], "breakdown": "short explanation of the plan"}\n\n'
        f"User dump:\n{req.text}"
    )

    raw, used_model, errors = _generate_with_fallback(prompt)
    if raw is None:
        raise HTTPException(
            status_code=502,
            detail=(
                "All Gemini models failed. "
                + "; ".join(errors)
                + ". Check GEMINI_API_KEY and GEMINI_MODEL in backend/.env."
            ),
        )

    parsed = _parse_json(raw)
    return PlanResponse(
        tasks=parsed.get("tasks", []),
        breakdown=parsed.get("breakdown", ""),
        raw=raw,
        model=used_model,
    )


# ---------------------------------------------------------------------------
# Check-in: structured parsing for the mobile app
# ---------------------------------------------------------------------------


@app.post("/plan/checkin", response_model=CheckInResponse)
def checkin(req: CheckInRequest):
    local = engine.parse_brain_dump(req.text)
    source = "offline"
    used_model: str | None = None

    if not MOCK and HAS_REAL_KEY:
        prompt = _checkin_prompt(req.text)
        payload, used_model, _errors = _generate_json(prompt)
        parsed = _normalise_ai_items(payload) if payload else None
        if parsed and (parsed["items"] or parsed["energy"]):
            local = parsed
            source = "gemini"

    items = local["items"]
    energy = local.get("energy")
    return CheckInResponse(
        items=[ParsedTask(**item) for item in items],
        energy=energy,
        reply=engine.checkin_reply(items, energy),
        model=used_model or ("offline-planner" if source == "offline" else None),
        source=source,
    )


# ---------------------------------------------------------------------------
# Micro-Step Guard endpoint
# ---------------------------------------------------------------------------


@app.post("/plan/steps", response_model=StepsResponse)
def steps(req: StepsRequest):
    fallback = engine.generate_steps(req.title)
    source = "offline"
    used_model: str | None = None

    if not MOCK and HAS_REAL_KEY:
        prompt = _steps_prompt(req.title, req.effort)
        payload, used_model, _errors = _generate_json(prompt)
        ai_steps = _normalise_ai_steps(payload)
        if ai_steps:
            fallback = ai_steps
            source = "gemini"

    return StepsResponse(
        steps=[MicroStep(**step) for step in fallback],
        model=used_model or ("offline-planner" if source == "offline" else None),
        source=source,
    )


# ---------------------------------------------------------------------------
# Scheduling + Reality Check (deterministic)
# ---------------------------------------------------------------------------


@app.post("/plan/schedule", response_model=ScheduleResponse)
def schedule(req: ScheduleRequest):
    tasks = [task.model_dump() for task in req.tasks]
    engine.schedule_tasks(tasks, req.start_h, req.end_h, req.energy)
    reality = engine.reality_check(tasks, req.start_h, req.end_h, req.energy)
    return ScheduleResponse(
        tasks=[ParsedTask(**task) for task in tasks],
        reality=RealityCheck(**reality),
    )


# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------


def _checkin_prompt(text: str) -> str:
    return (
        "You are the NudgePlan check-in parser. The user dumped what is on "
        "their mind. Turn it into tasks the app can schedule.\n\n"
        "Return STRICT JSON only, no markdown:\n"
        "{\n"
        '  "energy": "low" | "medium" | "high" | null,\n'
        '  "items": [\n'
        "    {\n"
        '      "title": "short imperative task title",\n'
        '      "dur": 45,\n'
        '      "effort": "low" | "med" | "high",\n'
        '      "day": "today" | "tomorrow",\n'
        '      "pri": 1 | 2 | 3,\n'
        '      "start": null,\n'
        '      "fixed": false,\n'
        '      "stuck": false\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- dur is minutes, rounded to 5, between 10 and 240.\n"
        "- start is minutes since midnight when the user gave a clock time, "
        "otherwise null; set fixed=true whenever start is set.\n"
        "- effort high = deep writing, coding, study, design; low = admin, "
        "errands, calls.\n"
        "- pri: 3 when urgent, due or important; 1 when optional.\n"
        "- day is tomorrow only when the user says tomorrow.\n"
        "- stuck is true when the user says they are avoiding, dreading or "
        "cannot start it.\n"
        "- If the user only reports energy, return an empty items list.\n"
        "- Do not invent tasks.\n\n"
        f"User dump:\n{text}"
    )


def _steps_prompt(title: str, effort: str) -> str:
    return (
        "You are the NudgePlan Micro-Step Guard. Break the task below into "
        "3 to 5 concrete steps. Every step must be startable in 10 minutes or "
        "less. The first step should remove friction (open the file, gather "
        "materials, name the document).\n\n"
        f"Task: {title}\nEffort: {effort}\n\n"
        "Return STRICT JSON only:\n"
        '{"steps": [{"text": "step text", "min": 5}]}\n'
    )


def _generate_json(prompt: str) -> tuple[dict[str, Any] | None, str | None, list[str]]:
    raw, used_model, errors = _generate_with_fallback(prompt)
    if raw is None:
        return None, None, errors
    try:
        payload = json.loads(_strip_fence(raw))
    except (json.JSONDecodeError, TypeError):
        return None, used_model, errors + [f"{used_model}: invalid JSON"]
    if not isinstance(payload, dict):
        return None, used_model, errors + [f"{used_model}: JSON is not an object"]
    return payload, used_model, errors


def _normalise_ai_items(payload: dict[str, Any]) -> dict[str, Any] | None:
    raw_items = payload.get("items")
    if raw_items is None:
        raw_items = []
    if not isinstance(raw_items, list):
        return None

    energy = payload.get("energy")
    if energy not in {"low", "medium", "high"}:
        energy = None

    items: list[dict[str, Any]] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        start = (
            engine.safe_int(raw.get("start"), -1)
            if raw.get("start") is not None
            else None
        )
        if start is not None and not 0 <= start <= 1439:
            start = None
        try:
            task = ParsedTask(
                id=engine.new_id(),
                title=str(raw.get("title", "")).strip()[:70],
                dur=engine.safe_int(raw.get("dur"), 45),
                effort=raw.get("effort")
                if raw.get("effort") in {"low", "med", "high"}
                else "med",
                day=raw.get("day")
                if raw.get("day") in {"today", "tomorrow"}
                else "today",
                pri=max(1, min(3, engine.safe_int(raw.get("pri"), 2))),
                start=start,
                fixed=start is not None,
                stuck=bool(raw.get("stuck")),
            )
        except ValidationError:
            continue
        if len(task.title) < 2:
            continue
        task.dur = int(round(max(10, min(240, task.dur)) / 5) * 5)
        if task.stuck:
            task.steps = [
                MicroStep(**step) for step in engine.generate_steps(task.title)
            ]
        items.append(task.model_dump())

    return {"items": items, "energy": energy}


def _normalise_ai_steps(payload: dict[str, Any]) -> list[dict[str, Any]] | None:
    raw_steps = payload.get("steps")
    if not isinstance(raw_steps, list) or not raw_steps:
        return None
    steps: list[dict[str, Any]] = []
    for raw in raw_steps[:6]:
        if not isinstance(raw, dict):
            continue
        text = str(raw.get("text", "")).strip()
        if len(text) < 3:
            continue
        minutes = max(1, min(10, engine.safe_int(raw.get("min"), 5)))
        steps.append(
            {
                "id": engine.new_id("s"),
                "text": text[:120],
                "min": minutes,
                "done": False,
            }
        )
    return steps or None


def _generate_with_fallback(prompt: str) -> tuple[str | None, str | None, list[str]]:
    """Try each model in turn, returning (text, model_used, errors)."""
    errors: list[str] = []
    for model in [MODEL_NAME, *MODEL_FALLBACKS]:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={"response_mime_type": "application/json"},
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


def _strip_fence(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[-1]
    return cleaned


def _parse_json(text: str) -> dict:
    try:
        return json.loads(_strip_fence(text))
    except json.JSONDecodeError:
        return {"tasks": [text.strip()], "breakdown": ""}
