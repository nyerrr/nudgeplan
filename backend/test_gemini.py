"""Quick check that FastAPI can talk to the Gemini API.

Usage:
    python test_gemini.py
"""

import json
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
SAMPLE = "I need to finish my research paper, do laundry, and go to the gym today."


def main() -> int:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        print("[FAIL] GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.")
        return 1

    print(f"[INFO] Testing {BASE_URL}/ai/plan ...")
    try:
        response = httpx.post(f"{BASE_URL}/ai/plan", json={"text": SAMPLE}, timeout=60.0)
    except httpx.ConnectError:
        print(f"[FAIL] Cannot reach {BASE_URL}. Start the server with: uvicorn main:app --reload")
        return 1

    if response.status_code != 200:
        print(f"[FAIL] HTTP {response.status_code}: {response.text}")
        return 1

    payload = response.json()
    tasks = payload.get("tasks", [])
    if not tasks:
        print(f"[FAIL] No tasks returned. Raw: {payload.get('raw', '')[:300]}")
        return 1

    print("[OK] Gemini request succeeded via FastAPI.")
    print(f"[OK] {len(tasks)} micro-steps returned:")
    for i, task in enumerate(tasks, 1):
        print(f"  {i}. {task}")
    print("\n[INFO] Full response:")
    print(json.dumps(payload, indent=2)[:800])
    return 0


if __name__ == "__main__":
    sys.exit(main())
