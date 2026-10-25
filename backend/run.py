"""Start the NudgePlan backend.

Reads PORT from backend/.env so you never have to remember the flag:

    python run.py

For auto-reload during development:

    python run.py --reload
"""

import os
import sys

import uvicorn
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "8001"))
HOST = os.getenv("HOST", "127.0.0.1")
API_AUTH_TOKEN = os.getenv("API_AUTH_TOKEN", "").strip()


def _is_loopback(host: str) -> bool:
    return host in {"127.0.0.1", "::1", "localhost"}


def main() -> int:
    reload_flag = "--reload" in sys.argv

    if not _is_loopback(HOST) and not API_AUTH_TOKEN:
        print(
            "[ERROR] HOST is not loopback, but API_AUTH_TOKEN is not configured. "
            "Set a strong token before exposing the API."
        )
        return 1

    print(f"[INFO] NudgePlan API on http://{HOST}:{PORT}")
    print("[INFO] Docs at http://{0}:{1}/docs".format(HOST, PORT))
    if reload_flag:
        print("[INFO] Auto-reload enabled.")

    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=reload_flag,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
