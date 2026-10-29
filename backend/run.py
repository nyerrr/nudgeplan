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
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _is_loopback(host: str) -> bool:
    return host in {"127.0.0.1", "::1", "localhost"}


def main() -> int:
    reload_flag = "--reload" in sys.argv

    if not _is_loopback(HOST) and not API_AUTH_TOKEN and not (
        SUPABASE_URL and SUPABASE_ANON_KEY and AUTH_REQUIRED
    ):
        print(
            "[ERROR] HOST is not loopback, but no authentication is configured. "
            "Set SUPABASE_URL/SUPABASE_ANON_KEY with AUTH_REQUIRED=true "
            "(recommended), or a strong API_AUTH_TOKEN."
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
