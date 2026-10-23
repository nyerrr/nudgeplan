"""Pydantic contracts shared by the API routes and the mobile app."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Energy = Literal["low", "medium", "high"]
Effort = Literal["low", "med", "high"]
Day = Literal["today", "tomorrow"]


class MicroStep(BaseModel):
    id: str | None = None
    text: str = Field(..., min_length=1, max_length=120)
    min: int = Field(5, ge=1, le=60)
    done: bool = False


class ParsedTask(BaseModel):
    id: str | None = None
    title: str = Field(..., min_length=1, max_length=80)
    dur: int = Field(45, ge=5, le=480)
    effort: Effort = "med"
    day: Day = "today"
    pri: int = Field(2, ge=1, le=3)
    start: int | None = Field(
        None, ge=0, le=1439, description="Minutes since midnight."
    )
    fixed: bool = False
    done: bool = False
    stuck: bool = False
    steps: list[MicroStep] = Field(default_factory=list)


class CheckInRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw brain dump.")
    energy: Energy = "medium"
    start_h: int = Field(9, ge=0, le=23)
    end_h: int = Field(18, ge=1, le=24)


class CheckInResponse(BaseModel):
    items: list[ParsedTask] = Field(default_factory=list)
    energy: Energy | None = None
    reply: str
    model: str | None = None
    source: Literal["gemini", "offline"] = "offline"


class StepsRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    effort: Effort = "med"


class StepsResponse(BaseModel):
    steps: list[MicroStep]
    model: str | None = None
    source: Literal["gemini", "offline"] = "offline"


class PlanRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw brain dump from the user.")


class PlanResponse(BaseModel):
    tasks: list[str]
    breakdown: str
    raw: str
    model: str | None = None


class HealthResponse(BaseModel):
    status: str
    model: str
    gemini_configured: bool
    mock_mode: bool


class ScheduleRequest(BaseModel):
    tasks: list[ParsedTask]
    start_h: int = Field(9, ge=0, le=23)
    end_h: int = Field(18, ge=1, le=24)
    energy: Energy = "medium"


class RealityCheck(BaseModel):
    planned_min: int
    available_min: int
    percent: int
    over: bool
    tight: bool
    moves_needed: int
    message: str


class ScheduleResponse(BaseModel):
    tasks: list[ParsedTask]
    reality: RealityCheck
