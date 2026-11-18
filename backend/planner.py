"""Offline task breakdown used when no Gemini API key is available.

This is a local heuristic, not AI. Its job is to keep the app usable end to end
with no key and no network, and to return exactly the same structured shape as
the Gemini path so nothing downstream has to know the difference.

Every task it produces still goes through the same Micro-Step Guard in
``main.py``, so the two paths cannot drift apart.
"""

import difflib
import re
from datetime import date, timedelta

# Verbs that suggest a real, concrete task hiding in a brain dump.
ACTION_HINTS = re.compile(
    r"\b(need to|have to|should|must|finish|write|send|email|call|buy|clean|"
    r"study|read|review|prepare|submit|pay|pick up|laundry|gym|fix|build|"
    r"schedule|plan|reply|meet|book|file|organize|pack|wash|cook|exercise)\b",
    re.IGNORECASE,
)

# Leading filler that should not survive into a task title.
FILLER = re.compile(
    r"^\s*(and|then|also|plus|so|but|after that|afterwards|finally|"
    r"i|i'm|i need to|i have to|i should|i must|todo|to do|also need|"
    r"remember to|don't forget to)\b[:,]?\s*",
    re.IGNORECASE,
)

# Minutes by kind of work. Ordered: first match wins.
MINUTES_RULES = [
    (re.compile(r"\b(call|text|message|email|reply|pay|book|renew|confirm)\b", re.I), 10),
    (re.compile(r"\b(send|submit|file|schedule|order|buy|pick up|return)\b", re.I), 15),
    (re.compile(r"\b(clean|laundry|tidy|wash|sort|pack|organize|dishes)\b", re.I), 25),
    (re.compile(r"\b(read|review|study|watch|listen|revise)\b", re.I), 30),
    (re.compile(r"\b(gym|workout|exercise|run|walk|swim|train)\b", re.I), 40),
    (re.compile(r"\b(write|draft|finish|build|fix|create|prepare|practice)\b", re.I), 45),
]

HIGH_ENERGY = re.compile(
    r"\b(write|draft|study|finish|build|prepare|practice|revise|code|design)\b", re.I
)
LOW_ENERGY = re.compile(
    r"\b(call|text|email|pay|buy|clean|laundry|sort|pack|tidy|wash|file)\b", re.I
)

URGENT = re.compile(r"\b(today|tonight|deadline|due|urgent|asap|before \d)\b", re.I)
SOMEDAY = re.compile(r"\b(someday|maybe|eventually|at some point)\b", re.I)

# Small talk is a chat turn, not a task. Match only when the whole statement is
# a greeting/thanks, so "hello, call the dentist" still becomes a task.
NON_ACTIONABLE = re.compile(
    r"^\s*(?:hi|hello|hey|yo|sup|good\s+(?:morning|afternoon|evening)|"
    r"thanks|thank\s+you|ok|okay|cool|nice|great|"
    r"how\s+are\s+you(?:\s+doing)?|what'?s\s+up)(?:\s+there)?[\s!.,?]*$",
    re.I,
)
EMPTY_REPLY = (
    "Hi! Tell me what you need to get done — even a messy list works — "
    "and I'll turn it into a plan."
)

DUE_RULES = [
    (re.compile(r"\b(today|tonight|this morning|this afternoon|this evening)\b", re.I), "today"),
    (re.compile(r"\btomorrow\b", re.I), "tomorrow"),
    (re.compile(r"\b(next week|this week|weekend|saturday|sunday)\b", re.I), "next-week"),
]

MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
MONTH_RE = r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
ISO_RE = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
MONTH_FIRST_RE = re.compile(
    rf"\b({MONTH_RE})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s*(\d{{4}}))?\b",
    re.I,
)
DAY_FIRST_RE = re.compile(
    rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({MONTH_RE})(?:,?\s*(\d{{4}}))?\b",
    re.I,
)

# Micro-step shapes by kind of work. These are generic on purpose: the offline
# planner cannot know the specifics, so it names the first physical move.
STEP_SHAPES = [
    (
        re.compile(r"\b(call|text|message|email|reply)\b", re.I),
        ["Find the contact or thread", "Write the one thing you need to say", "Send it"],
    ),
    (
        re.compile(r"\b(write|draft|finish|build|code|design)\b", re.I),
        [
            "Open the document at the right section",
            "Work for 10 minutes without editing",
            "Stop and note the next sentence",
        ],
    ),
    (
        re.compile(r"\b(read|review|study|revise)\b", re.I),
        [
            "Open the material at the right page",
            "Read or review for 15 minutes",
            "Write down one thing you learned",
        ],
    ),
    (
        re.compile(r"\b(clean|laundry|tidy|wash|sort|pack|organize|dishes)\b", re.I),
        ["Collect what belongs together", "Do one pass only", "Stop when the timer ends"],
    ),
    (
        re.compile(r"\b(buy|pay|order|book|pick up|return)\b", re.I),
        ["Find the account, list, or item", "Do the one action", "Save the confirmation"],
    ),
    (
        re.compile(r"\b(gym|workout|exercise|run|walk|swim|train)\b", re.I),
        ["Put on what you need", "Start with 5 minutes", "Stop at your planned time"],
    ),
]


def split_statements(text: str) -> list[str]:
    """Split a brain dump into candidate statements."""
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []

    # Split on sentence boundaries, commas, and connector words.
    raw_parts = re.split(
        r"(?<=[.!?;])\s+"
        r"|,\s*"
        r"|\s+(?:and|then|also|plus|after that|afterwards|finally)\s+",
        text,
        flags=re.IGNORECASE,
    )

    statements = []
    for part in raw_parts:
        cleaned = FILLER.sub("", part).strip(" .!?;,")
        if NON_ACTIONABLE.match(cleaned):
            continue
        if len(cleaned) > 2:
            statements.append(cleaned)
    return statements


def task_title(statement: str) -> str:
    """Turn a statement into a title that starts with a verb."""
    if ACTION_HINTS.search(statement):
        verb_match = re.search(
            r"\b(finish|write|send|email|call|buy|clean|study|read|review|"
            r"prepare|submit|pay|pick up|do|fix|build|schedule|plan|reply|"
            r"meet|book|file|organize|pack|wash|cook|exercise|go|attend|"
            r"take|make|create|update|check|handle|start)\b",
            statement,
            re.IGNORECASE,
        )
        if verb_match:
            verb = verb_match.group(1).lower()
            rest = statement[verb_match.end() :].strip(" :,-")
            if rest:
                return f"{verb.capitalize()} {rest}"
    # No recognised verb: keep the statement but cap it so it stays scannable.
    return statement[:1].upper() + statement[1:]


EXPLICIT_HOURS_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b", re.I)
EXPLICIT_MINS_RE = re.compile(r"\b(\d+)\s*(?:minutes?|mins?|m)\b", re.I)


def estimate_minutes(statement: str) -> int:
    h_match = EXPLICIT_HOURS_RE.search(statement)
    if h_match:
        try:
            return max(5, min(480, int(round(float(h_match.group(1)) * 60))))
        except ValueError:
            pass
    m_match = EXPLICIT_MINS_RE.search(statement)
    if m_match:
        try:
            return max(5, min(480, int(m_match.group(1))))
        except ValueError:
            pass
    for pattern, minutes in MINUTES_RULES:
        if pattern.search(statement):
            return minutes
    return 20


def estimate_energy(statement: str) -> str:
    if HIGH_ENERGY.search(statement):
        return "high"
    if LOW_ENERGY.search(statement):
        return "low"
    return "medium"


def estimate_priority(statement: str) -> str:
    if SOMEDAY.search(statement):
        return "low"
    if URGENT.search(statement):
        return "high"
    return "medium"


def _month_number(value: str) -> int | None:
    return MONTHS.get(value[:3].lower())


def _explicit_date(statement: str) -> str | None:
    """Return an ISO date when the dump contains an explicit calendar date."""
    today = date.today()
    maximum = today + timedelta(days=366)

    iso = ISO_RE.search(statement)
    if iso:
        try:
            parsed = date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        except ValueError:
            parsed = None
        if parsed is not None and today <= parsed <= maximum:
            return parsed.isoformat()

    candidates: list[tuple[str, str, str | None]] = []
    month_first = MONTH_FIRST_RE.search(statement)
    if month_first:
        candidates.append((month_first.group(1), month_first.group(2), month_first.group(3)))
    day_first = DAY_FIRST_RE.search(statement)
    if day_first:
        candidates.append((day_first.group(2), day_first.group(1), day_first.group(3)))

    for month_name, day_text, year_text in candidates:
        month = _month_number(month_name)
        if month is None:
            continue
        try:
            year = int(year_text) if year_text else today.year
            parsed = date(year, month, int(day_text))
        except ValueError:
            continue
        if parsed < today and not year_text:
            try:
                parsed = date(year + 1, month, int(day_text))
            except ValueError:
                continue
        if today <= parsed <= maximum:
            return parsed.isoformat()
    return None


def detect_due(statement: str) -> str | None:
    explicit = _explicit_date(statement)
    if explicit:
        return explicit
    for pattern, due in DUE_RULES:
        if pattern.search(statement):
            return due
    return None


def strip_date_phrase(statement: str) -> str:
    cleaned = ISO_RE.sub(" ", statement)
    cleaned = MONTH_FIRST_RE.sub(" ", cleaned)
    cleaned = DAY_FIRST_RE.sub(" ", cleaned)
    cleaned = re.sub(r"\b(?:on|by|due|before|until)\s*$", "", cleaned, flags=re.I)
    return re.sub(r"\s+", " ", cleaned).strip(" .,:;-")


def make_steps(statement: str) -> list[str]:
    for pattern, steps in STEP_SHAPES:
        if pattern.search(statement):
            return list(steps)
    return [
        "Open the file, app, or place where this task happens",
        "Set a 10 minute timer",
        "Do the smallest visible piece for 10 minutes",
        "Stop and write down what is next",
    ]


EVENT_RE = re.compile(
    r"\b(dentist|doctor|meeting|flight|class|appointment|interview|exam at \d|call at \d|meet at \d)\b",
    re.I,
)
REMINDER_RE = re.compile(
    r"\b(remind|remember to|pay bill|take pill|take med|medication|renew)\b",
    re.I,
)
CLARIFY_AMBIGUOUS_RE = re.compile(
    r"^\s*(?:i have (?:an?|my) (?:exam|test|appointment|interview|flight)|doctor(?:'s)? appointment|dentist(?:'s)? appointment)\s*[\.!?]*$",
    re.I,
)

MOVE_RE = re.compile(
    r"^\s*(?:please\s+|can you\s+|could you\s+)?(?:move|reschedule|push) (?:the )?(.+?) (?:to|for) (tomorrow|today|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[.!?]*$",
    re.I,
)
COMPLETE_RE = re.compile(
    r"^\s*(?:please\s+|can you\s+|could you\s+)?(?:"
    r"mark\s+(?:the\s+)?(.+?)\s+(?:as\s+)?done"
    r"|(?:complete|finish|done with|mark\s+done|i(?:'ve| have)?\s+(?:done|finished|completed))\s+(?:the\s+)?(.+?)"
    r")\s*[.!?]*$",
    re.I,
)
DELETE_RE = re.compile(
    r"^\s*(?:please\s+|can you\s+|could you\s+)?(?:delete|remove|cancel|drop) (?:the )?(.+?)\s*[.!?]*$",
    re.I,
)
RESIZE_RE = re.compile(
    r"^\s*(?:please\s+|can you\s+|could you\s+)?(?:resize|make|change|shorten|extend) (?:the )?(.+?) (?:to |for |by )?(\d+)\s*(?:m|mins|minutes)?\s*[.!?]*$",
    re.I,
)
MERGE_RE = re.compile(
    r"^\s*(?:please\s+|can you\s+|could you\s+)?merge (?:the )?(.+?) (?:and|with|into) (?:the )?(.+?)\s*[.!?]*$",
    re.I,
)
QUERY_NEXT_RE = re.compile(
    r"\b(what should i do (?:first|next)|what('?s| is) next|where (?:do|should) i start|what do i start with|prioritize my day|what first)\b",
    re.I,
)
ORDINAL_MAP = {
    "first": 0,
    "1st": 0,
    "second": 1,
    "2nd": 1,
    "third": 2,
    "3rd": 2,
    "fourth": 3,
    "4th": 4 - 1,
    "fifth": 4,
    "5th": 4,
}


def fuzzy_similarity(s1: str, s2: str) -> float:
    w1 = " ".join(s1.lower().split())
    w2 = " ".join(s2.lower().split())
    if not w1 or not w2:
        return 0.0
    if w1 == w2:
        return 1.0
    tokens1 = set(w1.split())
    tokens2 = set(w2.split())
    overlap = len(tokens1 & tokens2) / max(len(tokens1 | tokens2), 1)
    seq = difflib.SequenceMatcher(None, w1, w2).ratio()
    containment = 0.0
    if tokens1.issubset(tokens2) or tokens2.issubset(tokens1) or w1 in w2 or w2 in w1:
        containment = 0.85
    return max(overlap, seq, containment)


def detect_kind(statement: str) -> str:
    if EVENT_RE.search(statement):
        return "event"
    if REMINDER_RE.search(statement):
        return "reminder"
    return "task"


def _find_matching_task(query: str, existing: list[dict]) -> dict | None:
    if not existing:
        return None
    q = (query or "").strip().lower()
    # Ordinal reference to existing tasks (e.g. "the first task", "second one")
    for word, idx in ORDINAL_MAP.items():
        if re.search(rf"\b{re.escape(word)}\b(?:\s+(?:task|one|item))?\b", q):
            active = [t for t in existing if not t.get("done")]
            pool = active if active else existing
            if 0 <= idx < len(pool):
                return pool[idx]
    if q in {"it", "that", "that one", "this", "this one", "the task"}:
        active = [t for t in existing if not t.get("done")]
        pool = active if active else existing
        return pool[0] if pool else None
    best_match = None
    best_score = 0.0
    for task in existing:
        title = task.get("title", "")
        score = fuzzy_similarity(query, title)
        if score > best_score:
            best_score = score
            best_match = task
    return best_match if best_score >= 0.55 else None


def _recommend_next(existing: list[dict], context: dict) -> str:
    active = [t for t in existing if not t.get("done") and t.get("day") == "today"]
    if not active:
        active = [t for t in existing if not t.get("done")]
    if not active:
        return "You don't have any active tasks right now. Want to add what you need to get done?"
    energy = context.get("energy")
    def score(t: dict):
        pri = int(t.get("pri", 2) or 2)
        dur = int(t.get("dur", 30) or 30)
        start = t.get("start")
        fixed = 0 if t.get("fixed") or start is not None else 1
        # Prefer fixed/soon, then priority; if low energy prefer shorter tasks
        energy_bias = dur if energy == "low" else -dur
        return (fixed, -pri, energy_bias, dur)
    pick = sorted(active, key=score)[0]
    reason = "it fits your current energy" if energy == "low" else "it's a good next step"
    return f'Start with "{pick.get("title", "your next task")}" — {reason}. If that feels heavy, tell me and I can break it down.'


def breakdown(text: str, context: dict | None = None) -> dict:
    """Build an offline plan or action response from a user turn."""
    context = context or {}
    text_clean = re.sub(r"\s+", " ", text.strip())
    if not text_clean or NON_ACTIONABLE.match(text_clean):
        return {"intent": "chat", "tasks": [], "actions": [], "breakdown": EMPTY_REPLY}

    existing_tasks = context.get("tasks", [])
    pending_proposals = context.get("pending_proposals", [])
    clarify_state = context.get("clarify_state")

    # 1. Check if this completes a previous clarify flow
    if clarify_state and clarify_state.get("original_request"):
        orig = clarify_state["original_request"]
        text_clean = f"{orig}. {text_clean}"

    # 2. Check for modification of pending review proposals
    if pending_proposals:
        lower = text_clean.lower()
        target_idx = None
        for word, idx in ORDINAL_MAP.items():
            if word in lower:
                target_idx = idx
                break
        if target_idx is not None and target_idx < len(pending_proposals):
            prop = dict(pending_proposals[target_idx])
            dur = prop.get("dur", 45)
            if "shorter" in lower or "half" in lower:
                dur = max(10, int(round((dur / 2.0) / 5.0)) * 5)
            elif "longer" in lower:
                dur = min(240, dur + 15)
            min_match = re.search(r"(\d+)\s*(?:m|mins|minutes)", lower)
            if min_match:
                dur = max(5, int(min_match.group(1)))
            prop["minutes"] = dur
            prop["dur"] = dur

            tasks_out = []
            for i, p in enumerate(pending_proposals):
                item = dict(p)
                if i == target_idx:
                    item["minutes"] = dur
                    item["dur"] = dur
                tasks_out.append(item)
            return {
                "intent": "plan",
                "tasks": tasks_out,
                "actions": [],
                "breakdown": f"Updated proposal #{target_idx + 1} duration to {dur} minutes.",
            }

    # 3. Check for Actions on existing tasks
    # 3a. Move action
    m_move = MOVE_RE.match(text_clean)
    if m_move:
        target_name = m_move.group(1).strip()
        dest = m_move.group(2).strip().lower()
        matched = _find_matching_task(target_name, existing_tasks)
        if matched and matched.get("id"):
            action = {"type": "move", "task_id": matched["id"]}
            if dest in ("today", "tomorrow"):
                action["day"] = dest
                action["rationale"] = f"Moved to {dest} as requested"
            else:
                action["start"] = dest
                action["rationale"] = f"Rescheduled for {dest}"
            return {
                "intent": "act",
                "tasks": [],
                "actions": [action],
                "breakdown": f"Moved '{matched.get('title')}' to {dest}.",
            }

    # 3b. Complete action
    m_comp = COMPLETE_RE.match(text_clean)
    if m_comp:
        target_name = (m_comp.group(1) or m_comp.group(2) or "").strip()
        matched = _find_matching_task(target_name, existing_tasks)
        if matched and matched.get("id"):
            return {
                "intent": "act",
                "tasks": [],
                "actions": [
                    {
                        "type": "complete",
                        "task_id": matched["id"],
                        "rationale": "Marked complete as requested",
                    }
                ],
                "breakdown": f"Marked '{matched.get('title')}' as done.",
            }

    # 3c. Delete action
    m_del = DELETE_RE.match(text_clean)
    if m_del:
        target_name = m_del.group(1).strip()
        matched = _find_matching_task(target_name, existing_tasks)
        if matched and matched.get("id"):
            return {
                "intent": "act",
                "tasks": [],
                "actions": [
                    {
                        "type": "delete",
                        "task_id": matched["id"],
                        "rationale": "Deleted as requested",
                    }
                ],
                "breakdown": f"Removed '{matched.get('title')}' from your plan.",
            }

    # 3d. Resize action
    m_res = RESIZE_RE.match(text_clean)
    if m_res:
        target_name = m_res.group(1).strip()
        mins = int(m_res.group(2))
        matched = _find_matching_task(target_name, existing_tasks)
        if matched and matched.get("id"):
            return {
                "intent": "act",
                "tasks": [],
                "actions": [
                    {
                        "type": "resize",
                        "task_id": matched["id"],
                        "minutes": mins,
                        "rationale": f"Resized to {mins} minutes",
                    }
                ],
                "breakdown": f"Resized '{matched.get('title')}' to {mins} minutes.",
            }

    # 3e. Merge action
    m_mrg = MERGE_RE.match(text_clean)
    if m_mrg:
        t1_name = m_mrg.group(1).strip()
        t2_name = m_mrg.group(2).strip()
        match1 = _find_matching_task(t1_name, existing_tasks)
        match2 = _find_matching_task(t2_name, existing_tasks)
        if match1 and match2 and match1.get("id") and match2.get("id"):
            combined_title = f"{match1.get('title')} & {match2.get('title')}"
            return {
                "intent": "act",
                "tasks": [],
                "actions": [
                    {
                        "type": "merge",
                        "task_id": match1["id"],
                        "target_task_id": match2["id"],
                        "title": combined_title,
                        "rationale": "Merged tasks together",
                    }
                ],
                "breakdown": f"Merged '{match1.get('title')}' and '{match2.get('title')}'.",
            }

    # 3f. Plan/query questions (no plan changes)
    if QUERY_NEXT_RE.search(text_clean):
        return {
            "intent": "chat",
            "tasks": [],
            "actions": [],
            "breakdown": _recommend_next(existing_tasks, context),
        }

    # 4. Clarify check for ambiguous requests
    if CLARIFY_AMBIGUOUS_RE.match(text_clean):
        return {
            "intent": "clarify",
            "tasks": [],
            "actions": [],
            "breakdown": "When is your exam or appointment? Let me know the date or time so I can set up your prep tasks.",
            "clarify_state": {
                "original_request": text_clean,
                "question": "When is your exam or appointment?",
            },
        }

    # 5. Normal task generation
    statements = split_statements(text_clean)
    if not statements:
        return {"intent": "chat", "tasks": [], "actions": [], "breakdown": EMPTY_REPLY}

    tasks = []
    for statement in statements:
        due = detect_due(statement)
        title_source = (
            strip_date_phrase(statement)
            if due and _explicit_date(statement)
            else statement
        )
        task_name = task_title(title_source)

        # Check duplicate against existing
        is_duplicate = False
        matched_exist = _find_matching_task(task_name, existing_tasks)
        if matched_exist:
            is_duplicate = True

        kind = detect_kind(statement)
        minutes = estimate_minutes(statement)
        # Calibration check: if context has history indicating low completion, calibrate slightly
        hist = context.get("completion_history")
        if hist and isinstance(hist, dict) and hist.get("rate", 100) < 60:
            minutes = int(round((minutes * 1.2) / 5.0)) * 5

        tasks.append(
            {
                "title": task_name,
                "minutes": minutes,
                "energy": estimate_energy(statement),
                "priority": estimate_priority(statement),
                "due": due,
                "kind": kind,
                "rationale": (
                    "Similar to existing task; check if duplicate"
                    if is_duplicate
                    else f"Estimated {minutes}m based on task type"
                ),
                "steps": make_steps(title_source),
            }
        )

    breakdown_text = (
        f"Offline mode: split your dump into {len(tasks)} startable task"
        f"{'s' if len(tasks) != 1 else ''}."
    )

    return {
        "intent": "plan",
        "tasks": tasks,
        "actions": [],
        "breakdown": breakdown_text,
    }
