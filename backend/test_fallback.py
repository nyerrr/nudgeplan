"""Test the model fallback chain without hitting the network.

Simulates a primary model failing (503) and verifies the request falls
through to the next model in the list.

Usage:
    python test_fallback.py
"""

import sys
from types import SimpleNamespace

import main


class FakeModels:
    def __init__(self, behaviour: dict[str, Exception | str]):
        self.behaviour = behaviour
        self.calls: list[str] = []

    def generate_content(self, model, contents, config=None):
        self.calls.append(model)
        outcome = self.behaviour.get(model)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(text=outcome)


class FakeClient:
    def __init__(self, behaviour):
        self.models = FakeModels(behaviour)


def main_check() -> int:
    original_client = main.client
    original_primary = main.MODEL_NAME
    original_fallbacks = main.MODEL_FALLBACKS

    try:
        # 1. Primary fails with 503, first fallback succeeds
        main.MODEL_NAME = "primary-model"
        main.MODEL_FALLBACKS = ["backup-model", "last-resort"]
        main.client = FakeClient(
            {
                "primary-model": RuntimeError("503 UNAVAILABLE: high demand"),
                "backup-model": '{"tasks": ["A"], "breakdown": "ok"}',
            }
        )
        text, used, errors = main._generate_with_fallback("prompt")
        assert text is not None, "expected a successful response"
        assert used == "backup-model", f"expected backup-model, got {used}"
        assert main.client.models.calls == ["primary-model", "backup-model"], (
            f"unexpected call order: {main.client.models.calls}"
        )
        assert errors and "primary-model" in errors[0], f"errors not recorded: {errors}"
        print(f"[OK] 503 on primary -> fell back to {used}")

        # 2. Every model fails -> returns None with all errors
        main.client = FakeClient(
            {
                "primary-model": RuntimeError("boom"),
                "backup-model": RuntimeError("bang"),
                "last-resort": RuntimeError("crash"),
            }
        )
        text, used, errors = main._generate_with_fallback("prompt")
        assert text is None, "expected None when all models fail"
        assert used is None, "expected None model"
        assert len(errors) == 3, f"expected 3 errors, got {len(errors)}"
        print(f"[OK] all models failed -> 3 errors reported")

        # 3. Primary succeeds -> no fallback attempted
        main.client = FakeClient({"primary-model": '{"tasks": [], "breakdown": ""}'})
        text, used, errors = main._generate_with_fallback("prompt")
        assert used == "primary-model", f"expected primary-model, got {used}"
        assert main.client.models.calls == ["primary-model"], "fallback should not run"
        print("[OK] primary succeeded -> no fallback needed")

        print("\n[OK] All fallback cases passed.")
        return 0
    finally:
        main.client = original_client
        main.MODEL_NAME = original_primary
        main.MODEL_FALLBACKS = original_fallbacks


if __name__ == "__main__":
    sys.exit(main_check())
