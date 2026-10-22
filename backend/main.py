import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel, Field

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

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


class PlanRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw brain dump from the user.")


class PlanResponse(BaseModel):
    tasks: list[str]
    breakdown: str
    raw: str


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "NudgePlan API",
        "gemini_configured": bool(api_key),
    }


@app.get("/health")
def health():
    return {"status": "healthy", "model": MODEL_NAME, "gemini_configured": bool(api_key)}


@app.post("/ai/plan", response_model=PlanResponse)
async def plan_tasks(req: PlanRequest):
    if client is None:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    prompt = (
        "You are the NudgePlan planning assistant. The user dumped everything on their mind.\n"
        "Break the dump into concrete, actionable tasks and keep each step small enough "
        "to start in under 10 minutes.\n\n"
        "Return STRICT JSON with this shape:\n"
        '{"tasks": ["task one", "task two"], "breakdown": "short explanation of the plan"}\n\n'
        f"User dump:\n{req.text}"
    )

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        raw = response.text or ""
        parsed = _parse_json(raw)
        return PlanResponse(
            tasks=parsed.get("tasks", []),
            breakdown=parsed.get("breakdown", ""),
            raw=raw,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}") from exc


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
