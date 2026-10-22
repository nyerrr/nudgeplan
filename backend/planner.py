"""Offline task breakdown used when no Gemini API key is available.

This is a local heuristic, not AI. It splits a brain dump into sentences and
gives each one a small, startable action. Its purpose is to let the mobile app
be developed and tested end to end before an API key exists.
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

MICRO_PREFIXES = [
    "Start: ",
    "Open: ",
    "Draft: ",
    "First 10 min of ",
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


def make_micro_step(statement: str, index: int) -> str:
    """Turn a statement into one small, startable action."""
    if ACTION_HINTS.search(statement):
        # Keep it actionable but small: name the first concrete move.
        verb_match = re.search(
            r"\b(finish|write|send|email|call|buy|clean|study|read|review|"
            r"prepare|submit|pay|pick up|do|fix|build|schedule|plan|reply|"
            r"meet|book|file|organize|pack|wash|cook|exercise|go|attend|"
            r"take|make|create|update|check|handle|finish|start|finish)\b",
            statement,
            re.IGNORECASE,
        )
        if verb_match:
            verb = verb_match.group(1).lower()
            rest = statement[verb_match.end() :].strip(" :,-")
            if rest:
                return f"{verb.capitalize()}: {rest}"

    prefix = MICRO_PREFIXES[index % len(MICRO_PREFIXES)]
    return f"{prefix}{statement}"


def breakdown(text: str) -> dict:
    """Build an offline plan from a brain dump."""
    statements = split_statements(text)

    if not statements:
        return {
            "tasks": [],
            "breakdown": "Nothing to plan yet. Add a few tasks to your brain dump.",
        }

    tasks = [make_micro_step(s, i) for i, s in enumerate(statements)]

    breakdown_text = (
        f"Offline mode: split your dump into {len(tasks)} startable step"
        f"{'s' if len(tasks) != 1 else ''}. "
        "Set a real GEMINI_API_KEY in backend/.env to enable AI planning."
    )

    return {"tasks": tasks, "breakdown": breakdown_text}
