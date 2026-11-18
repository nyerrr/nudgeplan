"""Test the model fallback chain without hitting the network.

Simulates a primary model failing (503) and verifies the request falls
through to the next model in the list.

Usage:
    python test_fallback.py
"""

import asyncio
import os
import sys
from types import SimpleNamespace

# Keep this offline test independent of any local Supabase configuration.
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_ANON_KEY"] = ""
os.environ["AUTH_REQUIRED"] = "false"

import main  # noqa: E402


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


class FakeAioModels:
    def __init__(self, models: FakeModels):
        self._models = models

    async def generate_content(self, model, contents, config=None):
        return self._models.generate_content(model, contents, config)


class FakeClient:
    def __init__(self, behaviour, sync_only: bool = False):
        self.models = FakeModels(behaviour)
        if not sync_only:
            self.aio = SimpleNamespace(models=FakeAioModels(self.models))


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
        text, used, errors = asyncio.run(main._generate_with_fallback("prompt"))
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
        text, used, errors = asyncio.run(main._generate_with_fallback("prompt"))
        assert text is None, "expected None when all models fail"
        assert used is None, "expected None model"
        assert len(errors) == 3, f"expected 3 errors, got {len(errors)}"
        print(f"[OK] all models failed -> 3 errors reported")

        # 3. Primary succeeds -> no fallback attempted
        main.client = FakeClient({"primary-model": '{"tasks": [], "breakdown": ""}'})
        text, used, errors = asyncio.run(main._generate_with_fallback("prompt"))
        assert used == "primary-model", f"expected primary-model, got {used}"
        assert main.client.models.calls == ["primary-model"], "fallback should not run"
        print("[OK] primary succeeded -> no fallback needed")

        # 4. A client without an async surface still works off the event loop.
        sync_fake = FakeClient({"primary-model": '{"tasks": [], "breakdown": ""}'}, sync_only=True)
        main.client = sync_fake
        text, used, errors = asyncio.run(main._generate_with_fallback("prompt"))
        assert text is not None and used == "primary-model", "sync client fallback failed"
        assert sync_fake.models.calls == ["primary-model"], "sync client call missing"
        print("[OK] sync-only client still works via a worker thread")

        print("\n[OK] All fallback cases passed.")
        return 0
    finally:
        main.client = original_client
        main.MODEL_NAME = original_primary
        main.MODEL_FALLBACKS = original_fallbacks


if __name__ == "__main__":
    sys.exit(main_check())
