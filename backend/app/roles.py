from enum import Enum


PROJECT_ROLES: list[tuple[str, str]] = [
    ("director", "Director"),
    ("lead", "Lead"),
    ("member", "Member"),
    ("dv_engineer", "DV engineer"),
    ("rtl_engineer", "RTL engineer"),
    ("software_engineer", "Software engineer"),
    ("firmware_engineer", "Firmware engineer"),
]

LIFECYCLE: list[tuple[str, str]] = [
    ("assessment", "Assessment"),
    ("in_progress", "In Progress"),
    ("closing", "Closing"),
    ("completed", "Completed"),
]


class ProjectRole(str, Enum):
    director = "director"
    lead = "lead"
    member = "member"
    dv_engineer = "dv_engineer"
    rtl_engineer = "rtl_engineer"
    software_engineer = "software_engineer"
    firmware_engineer = "firmware_engineer"


class Lifecycle(str, Enum):
    assessment = "assessment"
    in_progress = "in_progress"
    closing = "closing"
    completed = "completed"


class ReportFlag(str, Enum):
    risk = "risk"
    issue = "issue"
    blocker = "blocker"
    decision = "decision"
