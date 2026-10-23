"""Offline tests for the planning pipeline.

Mocks the Gemini client so no API key is required. Covers the structured task
contract, the Micro-Step Guard, and the offline planner.

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
        self.last_config = None

    def generate_content(self, model, contents, config=None):
        self.last_prompt = contents
        self.last_config = config
        return SimpleNamespace(text=self.payload)


class FakeClient:
    def __init__(self, payload: str):
        self.models = FakeModels(payload)


def call_api(raw: str):
    fake = FakeClient(raw)
    main.client = fake
    # The offline planner short-circuits before the Gemini client, so force the
    # real code path for these cases.
    main.MOCK = False
    main.HAS_REAL_KEY = True

    from fastapi.testclient import TestClient

    with TestClient(main.app) as client:
        res = client.post("/ai/plan", json={"text": "Finish report, laundry, gym"})

    return res, fake


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def test_clean_json() -> None:
    payload = json.dumps(
        {
            "tasks": [
                {
                    "title": "Draft the report outline",
                    "minutes": 25,
                    "energy": "high",
                    "priority": "high",
                    "due": "today",
                    "steps": ["Open the doc", "Write three headings"],
                },
                {
                    "title": "Start one laundry load",
                    "minutes": 10,
                    "energy": "low",
                    "priority": "medium",
                    "due": None,
                    "steps": ["Collect the basket", "Press start"],
                },
                {
                    "title": "Go to the gym",
                    "minutes": 40,
                    "energy": "high",
                    "priority": "low",
                    "due": "next-week",
                    "steps": ["Put shoes on", "Leave"],
                },
            ],
            "breakdown": "Protect the morning for writing, batch chores.",
        }
    )
    res, fake = call_api(payload)
    expect(res.status_code == 200, f"expected 200, got {res.status_code} -> {res.text}")

    body = res.json()
    expect(len(body["tasks"]) == 3, f"expected 3 tasks, got {len(body['tasks'])}")

    first = body["tasks"][0]
    expect(first["title"] == "Draft the report outline", "title was not preserved")
    expect(first["minutes"] == 25, f"expected 25 minutes, got {first['minutes']}")
    expect(first["energy"] == "high", "energy was not preserved")
    expect(first["priority"] == "high", "priority was not preserved")
    expect(first["due"] == "today", "due was not preserved")
    expect(len(first["steps"]) == 2, "steps were not preserved")

    expect(body["tasks"][1]["due"] is None, "null due should stay null")
    expect(body["model"], "response should report which model answered")
    expect("report" in fake.models.last_prompt.lower(), "the dump was not sent to the model")
    expect(
        fake.models.last_config.get("response_schema") is main.PlanPayload,
        "the JSON response schema was not attached to the request",
    )
    print(f"[OK] clean json: {len(body['tasks'])} structured tasks")


def test_markdown_fence() -> None:
    payload = "```json\n" + json.dumps(
        {
            "tasks": [
                {"title": "A", "minutes": 10, "steps": ["x"]},
                {"title": "B", "minutes": 15, "steps": ["y"]},
            ],
            "breakdown": "ok",
        }
    ) + "\n```"
    res, _ = call_api(payload)
    expect(res.status_code == 200, f"markdown fence failed: {res.text}")
    expect(len(res.json()["tasks"]) == 2, "expected 2 tasks inside a code fence")
    print("[OK] markdown fence: parsed")


def test_string_tasks_are_upgraded() -> None:
    """A model that ignores the schema should still produce usable tasks."""
    payload = json.dumps({"tasks": ["Call the dentist", "Pay rent"], "breakdown": ""})
    res, _ = call_api(payload)
    expect(res.status_code == 200, f"string tasks failed: {res.text}")

    tasks = res.json()["tasks"]
    expect(len(tasks) == 2, f"expected 2 tasks, got {len(tasks)}")
    for task in tasks:
        expect(isinstance(task, dict), "tasks must be objects, not strings")
        expect(task["title"], "task needs a title")
        expect(task["steps"], "Micro-Step Guard must add a first step")
        expect(task["minutes"] >= 5, "minutes must be clamped to a sane value")
    print(f"[OK] string tasks upgraded: {[t['title'] for t in tasks]}")


def test_guard_clamps_bad_values() -> None:
    payload = json.dumps(
        {
            "tasks": [
                {
                    "title": "  Lots   of   space  ",
                    "minutes": 9999,
                    "energy": "EXTREME",
                    "priority": "urgent",
                    "due": "next friday",
                    "steps": [],
                },
                {"title": "", "minutes": 20},
                {"minutes": 20, "steps": ["no title"]},
            ],
            "breakdown": "",
        }
    )
    res, _ = call_api(payload)
    expect(res.status_code == 200, f"guard case failed: {res.text}")

    body = res.json()
    tasks = body["tasks"]
    expect(len(tasks) == 1, f"untitled tasks should be dropped, got {len(tasks)}")

    task = tasks[0]
    expect(task["title"] == "Lots of space", f"whitespace not normalised: {task['title']!r}")
    expect(task["minutes"] == 480, f"minutes not clamped: {task['minutes']}")
    expect(task["energy"] == "medium", f"bad energy not defaulted: {task['energy']}")
    expect(task["priority"] == "medium", f"bad priority not defaulted: {task['priority']}")
    expect(task["due"] is None, f"unparseable due not dropped: {task['due']}")
    expect(task["steps"] == ["Start: Lots of space"], f"missing step not synthesised: {task['steps']}")
    expect(body["breakdown"], "empty breakdown should be filled in")
    print(f"[OK] guard clamped bad values: {task}")


def test_minutes_rounded() -> None:
    payload = json.dumps({"tasks": [{"title": "Round me", "minutes": 23}]})
    res, _ = call_api(payload)
    minutes = res.json()["tasks"][0]["minutes"]
    expect(minutes == 25, f"23 should round to 25, got {minutes}")
    print(f"[OK] minutes rounded to nearest 5: {minutes}")


def test_prose_wrapped_json() -> None:
    payload = 'Here is your plan:\n{"tasks": [{"title": "Extract me"}], "breakdown": "done"}\nHope that helps!'
    res, _ = call_api(payload)
    expect(res.status_code == 200, f"prose case failed: {res.text}")
    tasks = res.json()["tasks"]
    expect(len(tasks) == 1, f"expected the embedded JSON to be found, got {len(tasks)}")
    expect(tasks[0]["title"] == "Extract me", "wrong title extracted")
    print("[OK] prose-wrapped json extracted")


def test_malformed_output() -> None:
    """Unusable output must not invent a task from the prose."""
    res, _ = call_api("sorry I cannot help with that")
    expect(res.status_code == 200, f"malformed case failed: {res.text}")
    body = res.json()
    expect(body["tasks"] == [], f"expected no tasks, got {body['tasks']}")
    print("[OK] malformed output: returned no tasks instead of guessing")


def test_past_due_date_dropped() -> None:
    """A hallucinated date from stale training data must not reach the UI."""
    payload = json.dumps(
        {
            "tasks": [
                {"title": "Old date", "due": "2023-10-27", "minutes": 10},
                {"title": "Bad format", "due": "2024-13-45", "minutes": 10},
            ]
        }
    )
    res, _ = call_api(payload)
    expect(res.status_code == 200, f"due guard failed: {res.text}")
    tasks = res.json()["tasks"]
    expect(tasks[0]["due"] is None, f"past date kept: {tasks[0]['due']}")
    expect(tasks[1]["due"] is None, f"invalid date kept: {tasks[1]['due']}")
    print("[OK] past and invalid due dates dropped")


def test_prompt_includes_today() -> None:
    from datetime import date

    payload = json.dumps({"tasks": [{"title": "Whatever"}]})
    _, fake = call_api(payload)
    prompt = fake.models.last_prompt
    expect(date.today().isoformat() in prompt, "prompt is missing today's date")
    expect(date.today().strftime("%A") in prompt, "prompt is missing the weekday")
    print("[OK] prompt anchors relative dates to today")


def test_offline_planner() -> None:
    main.MOCK = True
    from fastapi.testclient import TestClient

    with TestClient(main.app) as client:
        res = client.post(
            "/ai/plan",
            json={"text": "finish my paper today, do laundry, and call the dentist tomorrow"},
        )

    expect(res.status_code == 200, f"offline: got {res.status_code} -> {res.text}")
    body = res.json()
    tasks = body["tasks"]
    expect(len(tasks) == 3, f"offline: expected 3 tasks, got {len(tasks)}")
    expect(body["model"] == "offline-planner", "offline plan should report its model")

    paper = tasks[0]
    expect(paper["energy"] == "high", f"writing should need high energy: {paper}")
    expect(paper["priority"] == "high", f"'today' should raise priority: {paper}")
    expect(paper["due"] == "today", f"'today' should set due: {paper}")
    expect(len(paper["steps"]) >= 2, f"offline steps missing: {paper}")

    dentist = tasks[-1]
    expect(dentist["due"] == "tomorrow", f"'tomorrow' should set due: {dentist}")
    expect(dentist["minutes"] <= 15, f"calls should be quick: {dentist}")

    for task in tasks:
        expect(task["title"][:1].isupper(), f"title should be capitalised: {task['title']}")
        expect(task["steps"], f"every task needs a first step: {task}")

    print("[OK] offline planner: " + ", ".join(f"{t['title']} ({t['minutes']}m)" for t in tasks))


def main_check() -> int:
    test_clean_json()
    test_markdown_fence()
    test_string_tasks_are_upgraded()
    test_guard_clamps_bad_values()
    test_minutes_rounded()
    test_prose_wrapped_json()
    test_malformed_output()
    test_past_due_date_dropped()
    test_prompt_includes_today()
    test_offline_planner()

    print("\n[OK] All pipeline cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main_check())
