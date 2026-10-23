"""Offline tests for the NudgePlan planning engine and API.

Runs without a Gemini key (the app is in mock mode):

    python test_engine.py
"""

import sys

import engine
import main
from fastapi.testclient import TestClient


def test_parsing() -> None:
    parsed = engine.parse_brain_dump(
        "Finish the quarterly report 2h, call the dentist, gym at 6pm"
    )
    items = parsed["items"]
    assert len(items) == 3, items
    assert items[0]["title"] == "Finish the quarterly report"
    assert items[0]["dur"] == 120
    assert items[0]["effort"] == "high"
    gym = items[-1]
    assert gym["title"] == "Gym", gym
    assert gym["start"] == 18 * 60 and gym["fixed"], gym

    tomorrow = engine.parse_brain_dump("Tomorrow: write the essay intro, buy groceries")
    assert all(item["day"] == "tomorrow" for item in tomorrow["items"]), tomorrow
    assert tomorrow["items"][0]["effort"] == "high"

    tired = engine.parse_brain_dump(
        "I'm tired today. Study for the chem exam 90m, laundry"
    )
    assert tired["energy"] == "low", tired
    assert len(tired["items"]) == 2, tired
    assert tired["items"][0]["dur"] == 90

    stuck = engine.parse_brain_dump("I'm stuck on the budget spreadsheet")
    assert stuck["items"][0]["stuck"] is True
    assert len(stuck["items"][0]["steps"]) == 5, stuck

    print("[OK] brain dump parsing: titles, durations, fixed times, energy, stuck")


def test_scheduling() -> None:
    tasks = engine.parse_brain_dump(
        "Draft client proposal 90m, team sync at 10am, deep work research 120m"
    )["items"]
    engine.schedule_tasks(tasks, 9, 18, "medium")
    by_title = {task["title"]: task for task in tasks}

    sync = by_title["Team sync"]
    assert sync["start"] == 600, sync

    peaks = engine.peak_hours(9, 18, "medium")
    report = by_title["Draft client proposal"]
    assert report["start"] is not None
    assert report["start"] // 60 in peaks, (report, peaks)
    print("[OK] scheduler keeps fixed times and puts deep work in peak hours")

    overflow = engine.parse_brain_dump(
        "Write grant proposal 180m, client workshop prep 120m, inbox zero 45m"
    )["items"]
    reality = engine.reality_check(overflow, 9, 15, "medium")
    assert reality["over"] is True, reality
    assert reality["moves_needed"] >= 1, reality
    assert "Move" in reality["message"]
    print("[OK] reality check detects overload:", reality["message"])


def test_capacity() -> None:
    medium = engine.available_minutes(9, 18, "medium")
    low = engine.available_minutes(9, 18, "low")
    high = engine.available_minutes(9, 18, "high")
    assert low < medium < high, (low, medium, high)
    assert medium == 486, medium
    print(f"[OK] capacity shrinks with energy: {low} / {medium} / {high} min")


def test_micro_steps() -> None:
    steps = engine.generate_steps("Draft the launch proposal")
    assert 3 <= len(steps) <= 5, steps
    assert all(step["min"] <= 10 for step in steps), steps
    assert "blank page" in steps[0]["text"]

    generic = engine.generate_steps("Clean the garage")
    assert len(generic) == 5
    print("[OK] micro-step guard caps steps at 10 minutes")


def test_ai_normalisation() -> None:
    parsed = main._normalise_ai_items(
        {
            "energy": "high",
            "items": [
                {
                    "title": "Write the report",
                    "dur": 95,
                    "effort": "high",
                    "day": "today",
                    "pri": 5,
                    "start": "9:00",
                    "fixed": True,
                },
                {"title": "", "dur": 30},
            ],
        }
    )
    assert parsed is not None and parsed["energy"] == "high", parsed
    assert len(parsed["items"]) == 1, parsed
    item = parsed["items"][0]
    assert item["dur"] == 95, item
    assert item["pri"] == 3, item
    assert item["start"] is None and item["fixed"] is False, item
    print("[OK] AI task normalisation drops bad rows without dropping valid tasks")


def test_endpoints() -> None:
    with TestClient(main.app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "healthy"

        checkin = client.post(
            "/plan/checkin",
            json={
                "text": "I'm tired. Finish the report 2h, call mom at 5pm",
                "energy": "medium",
                "start_h": 9,
                "end_h": 18,
            },
        )
        assert checkin.status_code == 200, checkin.text
        body = checkin.json()
        assert body["energy"] == "low", body
        assert len(body["items"]) == 2, body
        assert body["items"][0]["dur"] == 120, body
        assert body["source"] == "offline", body
        assert "Added 2 tasks" in body["reply"], body["reply"]

        steps = client.post("/plan/steps", json={"title": "Write thesis outline"})
        assert steps.status_code == 200, steps.text
        assert len(steps.json()["steps"]) == 5, steps.text

        schedule = client.post(
            "/plan/schedule",
            json={
                "tasks": [
                    {
                        "title": "Deep work",
                        "dur": 120,
                        "effort": "high",
                        "day": "today",
                        "pri": 2,
                        "start": None,
                        "fixed": False,
                    }
                ],
                "start_h": 9,
                "end_h": 18,
                "energy": "medium",
            },
        )
        assert schedule.status_code == 200, schedule.text
        scheduled = schedule.json()["tasks"][0]
        assert scheduled["start"] is not None, schedule.text
        assert schedule.json()["reality"]["percent"] > 0, schedule.text

    print("[OK] /health, /plan/checkin, /plan/steps, /plan/schedule")


def main_check() -> int:
    test_parsing()
    test_capacity()
    test_scheduling()
    test_micro_steps()
    test_ai_normalisation()
    test_endpoints()
    print("\n[OK] All engine tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main_check())
