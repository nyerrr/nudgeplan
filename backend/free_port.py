"""Free a TCP port that is stuck in LISTENING state.

Windows can leave a socket bound by an orphaned child process (for example
uvicorn's --reload worker). The parent is gone but the port stays blocked,
which makes the next `uvicorn` run fail with:

    ERROR: [WinError 10013] An attempt was made to access a socket in a
    way forbidden by its access permissions

Usage:
    python free_port.py          # frees port 8001 (default)
    python free_port.py 8081     # frees port 8081
"""

import os
import subprocess
import sys


def pids_on_port(port: int) -> list[int]:
    out = subprocess.run(
        ["netstat", "-ano"], capture_output=True, text=True, check=False
    ).stdout

    pids: set[int] = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        local = parts[1]
        state = parts[3]
        pid = parts[4]
        if state != "LISTENING":
            continue
        if local.rsplit(":", 1)[-1] == str(port) and pid.isdigit():
            pids.add(int(pid))
    return sorted(pids)


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    pids = pids_on_port(port)

    if not pids:
        print(f"[OK] Port {port} is free.")
        return 0

    print(f"[INFO] Port {port} is held by PID(s): {', '.join(map(str, pids))}")
    for pid in pids:
        # Kill children first so an orphaned worker releases the socket.
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            check=False,
        )
        # The parent may be gone already while the child still holds the socket.
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/F"],
            capture_output=True,
            check=False,
        )

    import time

    for _ in range(10):
        if not pids_on_port(port):
            print(f"[OK] Port {port} is free.")
            return 0
        time.sleep(0.5)

    print(f"[FAIL] Port {port} is still held. Try: netstat -ano | findstr :{port}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
