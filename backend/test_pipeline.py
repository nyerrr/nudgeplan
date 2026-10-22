"""Offline test for the Gemini code path.

Mocks the Gemini client so no API key is required. Verifies that the
prompt is built, the response is parsed, and the API returns the
right shape.

Usage:
    python test_pipeline.py
"""

import json
import sys
from types import SimpleNamespace

import main


class FakeModels:
    def __init__(self, payload: str):
        self.payload = payload
        self.last_prompt = None

    def generate_content(self, model, contents, config=None):
        self.last_prompt = contents
        return SimpleNamespace(text=self.payload)


class FakeClient:
    def __init__(self, payload: str):
        self.models = FakeModels(payload)


def run_case(name: str, raw: str, expected_task_count: int):
    fake = FakeClient(raw)
    main.client = fake
    original = main.MODEL_NAME

    from fastapi.testclient import TestClient

    with TestClient(main.app) as client:
        res = client.post("/ai/plan", json={"text": "Finish report, laundry, gym"})

    assert res.status_code == 200, f"{name}: expected 200, got {res.status_code} -> {res.text}"
    body = res.json()
    assert len(body["tasks"]) == expected_task_count, (
        f"{name}: expected {expected_task_count} tasks, got {len(body['tasks'])}"
    )
    assert "tasks" in body and "breakdown" in body and "raw" in body
    assert "report" in fake.models.last_prompt.lower()
    main.MODEL_NAME = original
    print(f"[OK] {name}: {len(body['tasks'])} tasks, breakdown={body['breakdown'][:60]!r}")


def main_check() -> int:
    # 1. Clean JSON response
    run_case(
        "clean json",
        json.dumps(
            {
                "tasks": ["Draft outline", "One laundry load", "20 min gym"],
                "breakdown": "Split the report, batch chores, keep the gym short.",
            }
        ),
        3,
    )

    # 2. JSON wrapped in a markdown code fence
    run_case(
        "markdown fence",
        "```json\n" + json.dumps({"tasks": ["A", "B"], "breakdown": "ok"}) + "\n```",
        2,
    )

    # 3. Malformed output -> falls back to a single task, does not crash
    run_case("malformed json", "sorry I cannot help", 1)

    print("\n[OK] All pipeline cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main_check())
