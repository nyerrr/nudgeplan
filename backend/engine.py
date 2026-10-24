"""Deterministic planning engine for NudgePlan.

This module is a Python port of the prototype in NudgePlan.html. It holds the
rules that make NudgePlan behave the same with or without an AI key:

* brain-dump parsing (titles, duration, effort, day, priority, fixed time)
* the energy curve and capacity calculation
* the Reality Check Engine (how many tasks have to move)
* the Micro-Step Guard (small, startable steps)

Gemini is used for the fuzzy language work; this module is the safety net and
the source of truth for scheduling.
"""

from __future__ import annotations

import copy
import math
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# Constants (mirrored in frontend/src/lib/engine.ts)
# ---------------------------------------------------------------------------

ENERGY_FACTOR = {"low": 0.7, "medium": 0.9, "high": 1.0}
EFFORT_FACTOR = {"low": 0.72, "medium": 1.0, "high": 1.08}

# Typical cognitive energy by hour. Mornings peak for most people.
ENERGY_BY_HOUR = {
    5: 35,
    6: 40,
    7: 50,
    8: 58,
    9: 78,
    10: 94,
    11: 90,
    12: 68,
    13: 46,
    14: 42,
    15: 56,
    16: 70,
    17: 58,
    18: 48,
    19: 40,
    20: 35,
    21: 30,
    22: 28,
}

EFFORT_RANK = {"high": 3, "med": 2, "low": 1}

LEAD = re.compile(
    r"^\s*(?:(?:and|also|so|ok|okay|um|plus)\s+)?"
    r"(?:i\s+(?:also\s+)?(?:need|have|got|want|must|should|gotta)\s+to\s+"
    r"|i'?ve\s+got\s+to\s+"
    r"|(?:need|have|got|want)\s+to\s+"
    r"|gotta\s+|must\s+|should\s+"
    r"|remember\s+to\s+|don'?t\s+forget\s+to\s+"
    r"|i'?ll\s+|i\s+will\s+)",
    re.IGNORECASE,
)

HIGH_EFFORT = re.compile(
    r"\b(write|draft|study|research|report|proposal|essay|thesis|code|design|"
    r"plan|exam|present|presentation|analy\w*|prepare|prep|build|model|outline|"
    r"revise|learn|project|budget|spreadsheet)\b",
    re.IGNORECASE,
)

LOW_EFFORT = re.compile(
    r"\b(email|emails|reply|call|laundry|groc\w*|book|pay|clean|buy|text|order|"
    r"dishes|gym|walk|chores|message|errand\w*|dentist)\b",
    re.IGNORECASE,
)

STUCK = re.compile(
    r"stuck|avoid|putting off|procrastinat|dread|can'?t (?:get )?start",
    re.IGNORECASE,
)

LOW_ENERGY = re.compile(
    r"\b(tired|exhausted|burnt out|burned out|drained|sleepy|low energy|wiped)\b",
    re.IGNORECASE,
)

HIGH_ENERGY = re.compile(
    r"\b(energi[sz]ed|well rested|rested|fresh|high energy|pumped)\b",
    re.IGNORECASE,
)

TIME = re.compile(
    r"(?:\bat|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b",
    re.IGNORECASE,
)

DURATION = re.compile(
    r"\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b",
    re.IGNORECASE,
)

URGENT = re.compile(r"urgent|asap|due|deadline|important", re.IGNORECASE)
OPTIONAL = re.compile(
    r"maybe|if time|optional|someday|eventually", re.IGNORECASE
)

STUCK_PHRASES = re.compile(
    r"\b(?:i'?m|i am|i keep|keep|i have been|i've been)?\s*"
    r"(?:stuck on|stuck with|stuck|avoiding|putting off|procrastinating on|"
    r"dreading|can'?t start|can'?t get started on)\b",
    re.IGNORECASE,
)

TRAILING_PREPOSITION = re.compile(r"\b(for|at|by|on|due|in|about)\s*$", re.I)
EDGE_PUNCTUATION = re.compile(r"^[\s,.:;-]+|[\s,.:;-]+$")

# Micro-step templates, matched against task titles.
STEP_SETS: list[tuple[re.Pattern[str], list[tuple[str, int]]]] = [
    (
        re.compile(
            r"budget|spreadsheet|invoice|tax|expense|bill|pay\b|finance",
            re.IGNORECASE,
        ),
        [
            ("Gather the files or numbers in one place", 5),
            ("Set up the headers or form fields", 5),
            ("Enter the first 5 items", 10),
            ("Check the totals once", 5),
            ("Save it and note what is left", 2),
        ],
    ),
    (
        re.compile(
            r"write|draft|essay|report|proposal|post|thesis|outline|document|"
            r"slides|present|intro|article",
            re.IGNORECASE,
        ),
        [
            ("Open a blank page and name it", 2),
            ("List the 3 points you must cover", 5),
            ("Write a rough first paragraph, no editing", 10),
            ("Fill in one point at a time", 10),
            ("Read it once and fix the gaps", 8),
        ],
    ),
    (
        re.compile(
            r"study|exam|read|learn|revise|chem|math|class|lecture|notes",
            re.IGNORECASE,
        ),
        [
            ("Clear your desk and open the material", 3),
            ("Skim the headings for 5 minutes", 5),
            ("Write 3 questions you cannot answer yet", 5),
            ("Answer one question from memory", 10),
            ("Quiz yourself on what you wrote", 10),
        ],
    ),
    (
        re.compile(
            r"email|reply|inbox|message|text|call|book|order", re.IGNORECASE
        ),
        [
            ("Open the inbox or contact list", 1),
            ("Handle the 2 quickest ones first", 5),
            ("Flag anything that needs more than 5 minutes", 3),
            ("Handle the most urgent one", 10),
            ("Close it and note follow-ups", 2),
        ],
    ),
    (
        re.compile(
            r"code|bug|fix|pull request|deploy|test|build|review|research",
            re.IGNORECASE,
        ),
        [
            ("Open the repo, file or source you need", 2),
            ("Write the next single step as one sentence", 3),
            ("Make the smallest possible change", 10),
            ("Run it or check it", 5),
            ("Note what is left for next time", 2),
        ],
    ),
]

GENERIC_STEPS = [
    ("Write what done looks like in one line", 2),
    ("Gather what you need in one place", 5),
    ("Work for 10 minutes only", 10),
    ("Take a 2 minute break", 2),
    ("Do one more 10 minute round", 10),
]


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def new_id(prefix: str = "t") -> str:
    return f"{prefix}{int(time.time() * 1000):x}{uuid.uuid4().hex[:5]}"


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def available_minutes(start_h: int, end_h: int, energy: str) -> int:
    factor = ENERGY_FACTOR.get(energy, ENERGY_FACTOR["medium"])
    return max(60, round((end_h - start_h) * 60 * factor))


def energy_at(hour: int, energy: str) -> int:
    factor = EFFORT_FACTOR.get(energy, 1.0)
    base = ENERGY_BY_HOUR.get(hour, 40)
    return min(100, round(base * factor))


def hours_range(start_h: int, end_h: int) -> list[int]:
    return list(range(start_h, end_h))


def peak_hours(start_h: int, end_h: int, energy: str) -> set[int]:
    hours = hours_range(start_h, end_h)
    if not hours:
        return set()
    top = max(energy_at(h, energy) for h in hours)
    return {h for h in hours if energy_at(h, energy) >= 0.82 * top}


def percent(planned_min: int, available: int) -> int:
    if available <= 0:
        return 0
    return round(planned_min / available * 100)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def _split_statements(text: str) -> list[tuple[str, str]]:
    """Split a brain dump, carrying a "Tomorrow:" prefix across segments."""
    segments = re.split(
        r"\n+|;|\.(?:\s+|$)|\s*,\s*|\s+(?:and then|then|also)\s+",
        text,
        flags=re.IGNORECASE,
    )
    out: list[tuple[str, str]] = []
    carry = "today"
    for raw in segments:
        seg = (raw or "").strip()
        if not seg:
            continue
        prefix = re.match(r"^(tomorrow|today)\s*:\s*", seg, re.IGNORECASE)
        if prefix:
            carry = prefix.group(1).lower()
            seg = seg[prefix.end() :]
        if seg.strip():
            out.append((seg.strip(), carry))
    return out


def _parse_time(seg: str) -> tuple[int | None, str]:
    match = TIME.search(seg)
    if not match:
        return None, seg
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    meridiem = (match.group(3) or "").lower()
    if hour > 23 or minute >= 60:
        return None, seg
    if meridiem == "pm" and hour < 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0
    elif not meridiem and hour <= 6:
        # "gym at 6" in a daytime plan means 6 PM.
        hour += 12
    return hour * 60 + minute, seg.replace(match.group(0), " ")


def _parse_duration(seg: str) -> tuple[int | None, str]:
    match = DURATION.search(seg)
    if not match:
        return None, seg
    value = float(match.group(1))
    minutes = value * 60 if match.group(2).lower().startswith("h") else value
    return round(minutes), seg.replace(match.group(0), " ")


def _clean_title(seg: str) -> str:
    title = seg
    title = re.sub(r"\b(tomorrow|today)\b", " ", title, flags=re.IGNORECASE)
    title = STUCK_PHRASES.sub(" ", title)
    for _ in range(3):
        title = LEAD.sub("", title)
    title = re.sub(r"\s+", " ", title)
    title = TRAILING_PREPOSITION.sub("", title)
    title = EDGE_PUNCTUATION.sub("", title)
    title = title.strip()
    if len(title) < 2:
        return ""
    title = title[0].upper() + title[1:]
    return title[:70]


def parse_brain_dump(text: str) -> dict[str, Any]:
    """Parse a free-form brain dump into structured task candidates.

    Returns ``{"items": [...], "energy": "low" | "high" | None}``.
    """
    items: list[dict[str, Any]] = []
    detected_energy: str | None = None

    for seg, carry in _split_statements(text or ""):
        words = len(seg.split())
        if words <= 7 and LOW_ENERGY.search(seg):
            detected_energy = "low"
            continue
        if words <= 7 and HIGH_ENERGY.search(seg):
            detected_energy = "high"
            continue

        day = carry
        if re.search(r"\btomorrow\b", seg, re.IGNORECASE):
            day = "tomorrow"

        stuck = bool(STUCK.search(seg))

        start, rest = _parse_time(seg)
        duration, rest = _parse_duration(rest)
        title = _clean_title(rest)
        if not title:
            continue

        effort = (
            "high"
            if HIGH_EFFORT.search(title)
            else "low"
            if LOW_EFFORT.search(title)
            else "med"
        )
        if duration is None:
            duration = 90 if effort == "high" else 20 if effort == "low" else 45
        duration = int(round(clamp(duration, 10, 240) / 5) * 5)

        if URGENT.search(seg):
            priority = 3
        elif OPTIONAL.search(seg):
            priority = 1
        else:
            priority = 2

        items.append(
            {
                "id": new_id(),
                "title": title,
                "dur": duration,
                "effort": effort,
                "day": day,
                "pri": priority,
                "start": start,
                "fixed": start is not None,
                "done": False,
                "stuck": stuck,
                "steps": generate_steps(title) if stuck else [],
            }
        )

    return {"items": items, "energy": detected_energy}


# ---------------------------------------------------------------------------
# Micro-Step Guard
# ---------------------------------------------------------------------------


def generate_steps(title: str) -> list[dict[str, Any]]:
    """Return a short set of steps that each start in 10 minutes or less."""
    chosen = GENERIC_STEPS
    for pattern, steps in STEP_SETS:
        if pattern.search(title):
            chosen = steps
            break
    return [
        {"id": new_id("s"), "text": text, "min": minutes, "done": False}
        for text, minutes in chosen
    ]


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------


def _find_slot(
    task: dict[str, Any],
    busy: list[tuple[int, int]],
    start_h: int,
    end_h: int,
    energy: str,
) -> int | None:
    duration = int(task["dur"])
    day_start = start_h * 60
    day_end = end_h * 60

    def is_free(candidate: int) -> bool:
        return all(
            candidate + duration <= b_start or candidate >= b_end
            for b_start, b_end in busy
        )

    tries = [
        minute
        for minute in range(day_start, day_end - duration + 1, 15)
        if is_free(minute)
    ]
    if not tries:
        return None

    peaks = peak_hours(start_h, end_h, energy)
    if task.get("effort") == "high":
        peak_slots = [m for m in tries if (m // 60) in peaks]
        if peak_slots:
            return peak_slots[0]
    if task.get("effort") == "low":
        off_peak = [m for m in tries if (m // 60) not in peaks]
        if off_peak:
            return off_peak[0]
    return tries[0]


def schedule_tasks(
    tasks: Iterable[dict[str, Any]],
    start_h: int = 9,
    end_h: int = 18,
    energy: str = "medium",
) -> list[dict[str, Any]]:
    """Place unfixed tasks into free slots, mutating and returning the list.

    Fixed tasks keep their start. High-effort work is placed in the user's
    peak energy hours; low-effort work is kept out of them when possible.
    """
    task_list = list(tasks)
    for day in ("today", "tomorrow"):
        day_tasks = [t for t in task_list if t.get("day") == day]
        busy = [
            (int(t["start"]), int(t["start"]) + int(t["dur"]))
            for t in day_tasks
            if t.get("fixed") and t.get("start") is not None
        ]
        auto = sorted(
            [t for t in day_tasks if not t.get("fixed")],
            key=lambda t: (
                EFFORT_RANK.get(t.get("effort", "med"), 2),
                int(t.get("pri", 2)),
            ),
            reverse=True,
        )
        for task in auto:
            task["start"] = None
        for task in auto:
            slot = _find_slot(task, busy, start_h, end_h, energy)
            if slot is not None:
                task["start"] = slot
                busy.append((slot, slot + int(task["dur"])))
    return task_list


# ---------------------------------------------------------------------------
# Reality Check Engine
# ---------------------------------------------------------------------------


def move_candidates(tasks: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        [
            t
            for t in tasks
            if t.get("day") == "today" and not t.get("done")
        ],
        key=lambda t: (int(t.get("pri", 2)), -int(t.get("dur", 0))),
    )


def moves_needed(
    tasks: Iterable[dict[str, Any]],
    start_h: int = 9,
    end_h: int = 18,
    energy: str = "medium",
) -> int:
    task_list = list(tasks)
    planned = sum(
        int(t["dur"]) for t in task_list if t.get("day") == "today"
    )
    available = available_minutes(start_h, end_h, energy)
    count = 0
    candidates = move_candidates(task_list)
    while planned > available and count < len(candidates):
        planned -= int(candidates[count]["dur"])
        count += 1
    return max(1, count)


def reality_check(
    tasks: Iterable[dict[str, Any]],
    start_h: int = 9,
    end_h: int = 18,
    energy: str = "medium",
) -> dict[str, Any]:
    task_list = list(tasks)
    planned = sum(
        int(t["dur"]) for t in task_list if t.get("day") == "today"
    )
    available = available_minutes(start_h, end_h, energy)
    pct = percent(planned, available)
    over = pct > 100
    tight = pct >= 85
    moves = moves_needed(task_list, start_h, end_h, energy)

    if over:
        message = (
            f"Your day is at {pct}% capacity. Move {moves} task"
            f"{'s' if moves > 1 else ''}?"
        )
    elif tight:
        message = f"Your day is at {pct}% capacity. Move 1 task?"
    elif pct >= 60:
        message = (
            f"Your day is at {pct}% capacity. You have room for one small task."
        )
    else:
        message = f"Your day is at {pct}% capacity. You have open hours."

    return {
        "planned_min": planned,
        "available_min": available,
        "percent": pct,
        "over": over,
        "tight": tight,
        "moves_needed": moves,
        "message": message,
    }


# ---------------------------------------------------------------------------
# Check-in reply
# ---------------------------------------------------------------------------


def checkin_reply(items: list[dict[str, Any]], energy: str | None) -> str:
    if not items and not energy:
        return (
            "I did not find a task in that. Try: Write report 2h, "
            "call Sam at 4pm, gym tomorrow."
        )

    lines: list[str] = []
    if energy == "low":
        lines.append("Low energy noted. I will protect your open hours.")
    elif energy == "high":
        lines.append("Good energy noted. I will use your peak hours well.")

    if items:
        lines.append(
            f"Added {len(items)} task{'s' if len(items) > 1 else ''}. "
            "Heavy work goes in your peak hours when there is room."
        )

    stuck = [item for item in items if item.get("stuck") or item.get("steps")]
    if stuck:
        first = stuck[0]
        step_count = len(first.get("steps") or generate_steps(first["title"]))
        lines.append(
            f'I split "{first["title"]}" into {step_count} small steps.'
        )
    return "\n".join(lines)


def apply_parsed(
    parsed: dict[str, Any],
    start_h: int = 9,
    end_h: int = 18,
    energy: str = "medium",
) -> dict[str, Any]:
    """Convenience helper for tests: parse, schedule, and summarise."""
    items = copy.deepcopy(parsed.get("items", []))
    resolved_energy = parsed.get("energy") or energy
    schedule_tasks(items, start_h, end_h, resolved_energy)
    return {
        "items": items,
        "energy": parsed.get("energy"),
        "reply": checkin_reply(items, parsed.get("energy")),
        "reality": reality_check(items, start_h, end_h, resolved_energy),
    }


def today_iso() -> str:
    return datetime.now().date().isoformat()


def yesterday_iso() -> str:
    return (datetime.now() - timedelta(days=1)).date().isoformat()


def streak_from_days(days: Iterable[str]) -> int:
    """Count consecutive check-in days ending today (or yesterday)."""
    unique = sorted({d for d in days if d}, reverse=True)
    if not unique:
        return 0
    today = datetime.now().date()
    try:
        cursor = datetime.fromisoformat(unique[0]).date()
    except ValueError:
        return 0
    if cursor not in (today, today - timedelta(days=1)):
        return 0
    streak = 1
    for value in unique[1:]:
        try:
            day = datetime.fromisoformat(value).date()
        except ValueError:
            break
        if day == cursor - timedelta(days=1):
            streak += 1
            cursor = day
        else:
            break
    return streak


def safe_int(value: Any, default: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number):
        return default
    return number
