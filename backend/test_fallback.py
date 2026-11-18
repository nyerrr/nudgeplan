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


class CaptureAioModels:
    """Capture the request config so unit conversions can be asserted."""

    def __init__(self):
        self.config = None

    async def generate_content(self, model, contents, config=None):
        self.config = config
        return SimpleNamespace(text="ok")


class FakeClient:
    def __init__(self, behaviour, sync_only: bool = False):
        self.models = FakeModels(behaviour)
        if not sync_only:
            self.aio = SimpleNamespace(models=FakeAioModels(self.models))


class SlowAioModels:
    """Simulates a model that never answers inside the overall budget."""

    def __init__(self, delay: float):
        self.delay = delay
        self.calls = 0

    async def generate_content(self, model, contents, config=None):
        self.calls += 1
        await asyncio.sleep(self.delay)
        return SimpleNamespace(text='{"tasks": [], "breakdown": ""}')


def main_check() -> int:
    original_client = main.client
    original_primary = main.MODEL_NAME
    original_fallbacks = main.MODEL_FALLBACKS
    original_timeout = main.GEMINI_TIMEOUT_SECONDS
    original_total = main.GEMINI_TOTAL_TIMEOUT_SECONDS

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

        # 5. google-genai expects milliseconds. Passing seconds made every call
        #    abort in ~30ms with ConnectTimeout, silently forcing offline mode.
        capture = CaptureAioModels()
        main.client = SimpleNamespace(aio=SimpleNamespace(models=capture))
        main.GEMINI_TIMEOUT_SECONDS = 30
        text = asyncio.run(
            main._generate_once("prompt", main.PlanPayload, "test-model", timeout=30)
        )
        assert text == "ok", "capture client should return text"
        timeout_ms = capture.config["http_options"].timeout
        assert timeout_ms == 30_000, f"expected 30000 ms, got {timeout_ms}"
        print("[OK] Gemini timeout converts seconds to milliseconds")

        capture = CaptureAioModels()
        main.client = SimpleNamespace(aio=SimpleNamespace(models=capture))
        asyncio.run(main._generate_once("prompt", main.PlanPayload, "test-model"))
        timeout_ms = capture.config["http_options"].timeout
        assert timeout_ms == 30_000, f"expected global 30000 ms, got {timeout_ms}"
        print("[OK] Gemini default timeout also uses milliseconds")

        # 7. A slow chain is cancelled before the app's 60s request timeout.
        #    The per-attempt wait_for adds a 1s slack, so the fake model must
        #    hang slightly longer than that for the overall deadline to win.
        main._model_cooldown_until.clear()
        main.GEMINI_TOTAL_TIMEOUT_SECONDS = 0.01
        slow = SlowAioModels(delay=1.2)
        main.client = SimpleNamespace(
            models=FakeModels({}), aio=SimpleNamespace(models=slow)
        )
        text, used, errors = asyncio.run(main._generate_with_fallback("prompt"))
        assert text is None and used is None, "slow chain should time out"
        assert any("total timeout" in error for error in errors), (
            f"timeout not reported: {errors}"
        )
        assert slow.calls == 1, "fallbacks should stop after the budget expires"
        print("[OK] overall timeout cancels the fallback chain")

        print("\n[OK] All fallback cases passed.")
        return 0
    finally:
        main.client = original_client
        main.MODEL_NAME = original_primary
        main.MODEL_FALLBACKS = original_fallbacks
        main.GEMINI_TIMEOUT_SECONDS = original_timeout
        main.GEMINI_TOTAL_TIMEOUT_SECONDS = original_total


if __name__ == "__main__":
    sys.exit(main_check())
