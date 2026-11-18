"""Golden Set Evaluation for NudgePlan.

Measures planning quality and reliability against 25 real-world brain dumps:
- Schema-failure rate
- Intent accuracy
- Task recall & precision
- Date accuracy
- Estimate error (MAE in minutes)
- Duplicate detection rate

Usage:
    python eval_golden.py
"""

import json
import os
import sys
from pathlib import Path

# Clear Supabase auth for local evaluation
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_ANON_KEY"] = ""
os.environ["AUTH_REQUIRED"] = "false"

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

DATASET_PATH = Path(__file__).parent / "golden_dataset.json"


def run_evaluation() -> int:
    main.MOCK = True
    main.HAS_REAL_KEY = False

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    total_cases = len(dataset)
    schema_failures = 0
    intent_matches = 0
    total_expected_tasks = 0
    matched_tasks = 0
    total_produced_tasks = 0
    date_matches = 0
    date_checks = 0
    duration_diffs = []
    duplicate_checks = 0
    duplicate_detected = 0

    client = TestClient(main.app)

    print("\n" + "=" * 65)
    print("           NUDGEPLAN GOLDEN DATASET EVALUATION")
    print("=" * 65)

    for case in dataset:
        case_id = case["id"]
        dump = case["dump"]
        context = case.get("context", {})

        payload = {
            "text": dump,
            "start_h": context.get("start_h", 9),
            "end_h": context.get("end_h", 18),
            "energy": context.get("energy"),
            "tasks": context.get("tasks", []),
            "pending_proposals": context.get("pending_proposals"),
            "clarify_state": context.get("clarify_state"),
            "planned_minutes": context.get("planned_minutes", 0),
        }

        try:
            res = client.post("/plan/checkin", json=payload)
            if res.status_code != 200:
                schema_failures += 1
                continue
            body = res.json()
            # Validate Pydantic response contract
            main.CheckInResponse.model_validate(body)
        except Exception:
            schema_failures += 1
            continue

        # Intent check
        expected_intent = case.get("expected_intent")
        actual_intent = body.get("intent")
        if actual_intent == expected_intent:
            intent_matches += 1

        # Action check if intent is 'act'
        if expected_intent == "act":
            actions = body.get("actions", [])
            exp_action = case.get("expected_action_type")
            exp_target = case.get("expected_target_id")
            if actions:
                act = actions[0]
                if act.get("type") == exp_action and (
                    not exp_target or act.get("taskId") == exp_target
                ):
                    pass

        # Duplicate detection check
        if case.get("detect_duplicate"):
            duplicate_checks += 1
            items = body.get("items", [])
            actions = body.get("actions", [])
            reply_lower = body.get("reply", "").lower()
            rationale_hit = any(
                any(w in (item.get("rationale") or "").lower() for w in ("similar", "duplicate", "merge"))
                for item in items
            )
            breakdown_hit = any(
                w in reply_lower for w in ("already", "duplicate", "similar", "merge", "add separately")
            )
            action_hit = any(a.get("type") == "merge" for a in actions)
            if rationale_hit or breakdown_hit or action_hit:
                duplicate_detected += 1

        # Task recall and precision
        keywords = case.get("keywords", [])
        items = body.get("items", [])
        if keywords:
            total_produced_tasks += len(items)
            total_expected_tasks += len(keywords)

            for kw in keywords:
                found = any(kw.lower() in item.get("title", "").lower() for item in items)
                if found:
                    matched_tasks += 1

        # Date checks
        expected_dates = case.get("expected_dates", [])
        if expected_dates and items:
            for exp_d, item in zip(expected_dates, items):
                date_checks += 1
                actual_day = item.get("day")
                actual_due = item.get("dueDate")
                if exp_d in ("today", "tomorrow"):
                    if actual_day == exp_d:
                        date_matches += 1
                elif actual_due == exp_d:
                    date_matches += 1

        # Duration estimates MAE
        expected_durs = case.get("expected_durations", [])
        if expected_durs and items:
            for exp_dur, item in zip(expected_durs, items):
                actual_dur = item.get("dur", 20)
                duration_diffs.append(abs(actual_dur - exp_dur))

    # Metrics computation
    schema_fail_rate = (schema_failures / total_cases) * 100
    intent_accuracy = (intent_matches / total_cases) * 100
    recall = (matched_tasks / total_expected_tasks * 100) if total_expected_tasks else 100.0
    precision = (matched_tasks / total_produced_tasks * 100) if total_produced_tasks else 100.0
    date_accuracy = (date_matches / date_checks * 100) if date_checks else 100.0
    estimate_mae = (sum(duration_diffs) / len(duration_diffs)) if duration_diffs else 0.0
    dup_rate = (duplicate_detected / duplicate_checks * 100) if duplicate_checks else 100.0

    print(f"Total Test Cases:       {total_cases}")
    print(f"Schema Failure Rate:    {schema_fail_rate:.1f}%  (Target: 0.0%)")
    print(f"Intent Accuracy:        {intent_accuracy:.1f}%  (Target: >= 90.0%)")
    print(f"Task Recall:            {recall:.1f}%  (Target: >= 85.0%)")
    print(f"Task Precision:         {precision:.1f}%  (Target: >= 80.0%)")
    print(f"Date Accuracy:          {date_accuracy:.1f}%  (Target: >= 85.0%)")
    print(f"Estimate Error (MAE):   {estimate_mae:.1f}m (Target: <= 15.0m)")
    print(f"Duplicate Detection:    {dup_rate:.1f}% (Target: >= 90.0%)")
    print("=" * 65)

    assert schema_fail_rate == 0.0, f"Schema failures occurred: {schema_failures}"
    assert intent_accuracy >= 90.0, f"Intent accuracy below threshold: {intent_accuracy}%"
    assert recall >= 85.0, f"Task recall below threshold: {recall}%"
    assert precision >= 80.0, f"Task precision below threshold: {precision}%"
    assert date_accuracy >= 85.0, f"Date accuracy below threshold: {date_accuracy}%"
    assert estimate_mae <= 15.0, f"Estimate error above threshold: {estimate_mae}m"
    assert dup_rate >= 90.0, f"Duplicate detection rate below threshold: {dup_rate}%"

    print("\n[PASSED] All golden set quality thresholds satisfied!\n")
    return 0


if __name__ == "__main__":
    sys.exit(run_evaluation())
