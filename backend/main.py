import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field

import planner

load_dotenv()

app = FastAPI(
    title="NudgePlan API",
    description="Brain dump, Reality Check Engine, and Micro-Step Guard for NudgePlan.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class PlanRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw brain dump from the user.")


class PlanResponse(BaseModel):
    tasks: list[str]
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
        "gemini_configured": HAS_REAL_KEY,
        "mock_mode": MOCK,
    }


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


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[-1]
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"tasks": [cleaned], "breakdown": ""}
