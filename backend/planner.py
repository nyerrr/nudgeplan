"""Offline task breakdown used when no Gemini API key is available.

This is a local heuristic, not AI. Its job is to keep the app usable end to end
with no key and no network, and to return exactly the same structured shape as
the Gemini path so nothing downstream has to know the difference.

Every task it produces still goes through the same Micro-Step Guard in
``main.py``, so the two paths cannot drift apart.
"""

import re

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

DUE_RULES = [
    (re.compile(r"\b(today|tonight|this morning|this afternoon|this evening)\b", re.I), "today"),
    (re.compile(r"\btomorrow\b", re.I), "tomorrow"),
    (re.compile(r"\b(next week|this week|weekend|saturday|sunday)\b", re.I), "next-week"),
]

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


def estimate_minutes(statement: str) -> int:
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


def detect_due(statement: str) -> str | None:
    for pattern, due in DUE_RULES:
        if pattern.search(statement):
            return due
    return None


def make_steps(statement: str) -> list[str]:
    for pattern, steps in STEP_SHAPES:
        if pattern.search(statement):
            return list(steps)
    return [
        f"Decide the very first move for: {statement}",
        "Do that move for 10 minutes",
        "Stop and note what is next",
    ]


def breakdown(text: str) -> dict:
    """Build an offline plan from a brain dump, using the same task shape."""
    statements = split_statements(text)

    if not statements:
        return {
            "tasks": [],
            "breakdown": "Nothing to plan yet. Add a few tasks to your brain dump.",
        }

    tasks = []
    for statement in statements:
        tasks.append(
            {
                "title": task_title(statement),
                "minutes": estimate_minutes(statement),
                "energy": estimate_energy(statement),
                "priority": estimate_priority(statement),
                "due": detect_due(statement),
                "steps": make_steps(statement),
            }
        )

    breakdown_text = (
        f"Offline mode: split your dump into {len(tasks)} startable task"
        f"{'s' if len(tasks) != 1 else ''}. "
        "Add a GEMINI_API_KEY to backend/.env to let Gemini do this."
    )

    return {"tasks": tasks, "breakdown": breakdown_text}
