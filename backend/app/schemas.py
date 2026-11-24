from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from pydantic.functional_serializers import PlainSerializer

from app.clock import iso
from app.locations import LOCATIONS
from app.normalize import blank_to_none, normalize_external_url, normalize_location, normalize_tags
from app.report_html import clean_report_body
from app.roles import Lifecycle, ProjectRole, ReportFlag


def _iso_value(value: datetime | None) -> str | None:
    if value is None:
        return None
    return iso(value)


Utc = Annotated[datetime, PlainSerializer(_iso_value, return_type=str, when_used="json")]
UtcOpt = Annotated[datetime | None, PlainSerializer(_iso_value, return_type=str | None, when_used="json")]


class APIModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


def _clean_name(value: str | None, *, required: bool) -> str | None:
    if value is None:
        if required:
            raise ValueError("Name is required")
        return None
    if not isinstance(value, str):
        raise ValueError("Name is required")
    text = " ".join(value.split())
    if not text:
        raise ValueError("Name is required")
    if len(text) > 255:
        raise ValueError("Name is too long")
    return text


class NamedCreate(APIModel):
    name: str
    description: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        return _clean_name(value, required=True)

    @field_validator("description", mode="before")
    @classmethod
    def description_clean(cls, value):
        return blank_to_none(value)


class NamedPatch(APIModel):
    name: str | None = None
    description: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        if value is None:
            return None
        return _clean_name(value, required=True)

    @field_validator("description", mode="before")
    @classmethod
    def description_clean(cls, value):
        if value is None:
            return None
        return blank_to_none(value)

    @model_validator(mode="after")
    def reject_blank_name(self):
        if "name" in self.model_fields_set and not self.name:
            raise ValueError("Name is required")
        return self


class DepartmentCreate(NamedCreate):
    pass


class DepartmentPatch(NamedPatch):
    pass


class DesignationCreate(NamedCreate):
    pass


class DesignationPatch(NamedPatch):
    pass


_ICON_PREFIXES = ("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,", "data:image/gif;base64,")
_ICON_LIMIT = 100_000


def _clean_icon(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Icon must be an image")
    text = "".join(value.split())
    if not text:
        return None
    if len(text) > _ICON_LIMIT or not text.startswith(_ICON_PREFIXES):
        raise ValueError("Icon must be a small PNG, JPEG, WebP, or GIF")
    return text


class CompanyCreate(NamedCreate):
    icon: str | None = None

    @field_validator("icon", mode="before")
    @classmethod
    def icon_clean(cls, value):
        return _clean_icon(value)


class CompanyPatch(NamedPatch):
    icon: str | None = None

    @field_validator("icon", mode="before")
    @classmethod
    def icon_clean(cls, value):
        return _clean_icon(value)


class CatalogOut(APIModel):
    id: int
    name: str
    description: str | None
    icon: str | None = None
    resource_count: int


class DepartmentRef(APIModel):
    id: int
    name: str
    description: str | None = None


class DesignationRef(APIModel):
    id: int
    name: str
    description: str | None = None


class CompanyRef(APIModel):
    id: int
    name: str
    description: str | None = None
    icon: str | None = None


class AssignmentCompany(APIModel):
    name: str
    icon: str | None = None


def _clean_company_ids(value):
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("Companies must be a list")
    unique: list[int] = []
    for item in value:
        if isinstance(item, bool):
            raise ValueError("Invalid company")
        if isinstance(item, str):
            text = item.strip()
            if not text.isdigit():
                raise ValueError("Invalid company")
            item = int(text)
        if not isinstance(item, int):
            raise ValueError("Invalid company")
        if item not in unique:
            unique.append(item)
    return unique


class ResourceAssignment(APIModel):
    project_id: int
    project_name: str
    project_role: str


class ResourceWrite(APIModel):
    name: str = Field(max_length=255)
    department_id: int
    email: EmailStr
    location: str | None = None
    designation_id: int | None = None
    company_ids: list[int] = Field(default_factory=list)
    resigned: bool = False

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        return _clean_name(value, required=True)

    @field_validator("email", mode="before")
    @classmethod
    def email_clean(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("location", mode="before")
    @classmethod
    def location_clean(cls, value):
        return normalize_location(value)

    @field_validator("designation_id", mode="before")
    @classmethod
    def designation_clean(cls, value):
        if value is None or value == "":
            return None
        return value

    @field_validator("department_id", mode="before")
    @classmethod
    def department_id_clean(cls, value):
        if value is None or value == "":
            raise ValueError("Department is required")
        return value

    @field_validator("company_ids", mode="before")
    @classmethod
    def company_ids_clean(cls, value):
        cleaned = _clean_company_ids([] if value is None else value)
        return [] if cleaned is None else cleaned

    @field_validator("location")
    @classmethod
    def location_code(cls, value: str | None):
        if value is not None and value not in LOCATIONS:
            raise ValueError("Invalid location")
        return value


class ResourcePatch(APIModel):
    name: str | None = Field(default=None, max_length=255)
    department_id: int | None = None
    email: EmailStr | None = None
    location: str | None = None
    designation_id: int | None = None
    company_ids: list[int] | None = None
    resigned: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        if value is None:
            return None
        return _clean_name(value, required=True)

    @field_validator("email", mode="before")
    @classmethod
    def email_clean(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("location", mode="before")
    @classmethod
    def location_clean(cls, value):
        return normalize_location(value)

    @field_validator("designation_id", mode="before")
    @classmethod
    def designation_clean(cls, value):
        if value is None or value == "":
            return None
        return value

    @field_validator("department_id", mode="before")
    @classmethod
    def department_id_clean(cls, value):
        if value is None or value == "":
            return None
        return value

    @field_validator("company_ids", mode="before")
    @classmethod
    def company_ids_clean(cls, value):
        if value is None:
            return None
        return _clean_company_ids(value)

    @model_validator(mode="after")
    def reject_null_required(self):
        if "name" in self.model_fields_set and not self.name:
            raise ValueError("Name is required")
        if "department_id" in self.model_fields_set and self.department_id is None:
            raise ValueError("Department is required")
        if "email" in self.model_fields_set and not self.email:
            raise ValueError("Email is required")
        if "resigned" in self.model_fields_set and self.resigned is None:
            raise ValueError("Resigned is required")
        return self


class ResourceOut(APIModel):
    id: int
    name: str
    email: str
    location: str | None
    department: DepartmentRef
    designation: DesignationRef | None
    companies: list[CompanyRef]
    resigned: bool
    assignments: list[ResourceAssignment]
    created_at: Utc
    updated_at: Utc


def _clean_id_list(value, *, invalid: str):
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError(invalid)
    unique: list[int] = []
    for item in value:
        if isinstance(item, bool):
            raise ValueError(invalid)
        if isinstance(item, str):
            text = item.strip()
            if not text.isdigit():
                raise ValueError(invalid)
            item = int(text)
        if not isinstance(item, int):
            raise ValueError(invalid)
        if item not in unique:
            unique.append(item)
    return unique


class ProjectGroupCreate(NamedCreate):
    pass


class ProjectGroupPatch(NamedPatch):
    pass


class ProjectGroupOut(APIModel):
    id: int
    name: str
    description: str | None
    position: int
    project_count: int


class ProjectGroupRef(APIModel):
    id: int
    name: str


class ProjectGroupsWrite(APIModel):
    group_ids: list[int] = Field(default_factory=list)

    @field_validator("group_ids", mode="before")
    @classmethod
    def group_ids_clean(cls, value):
        cleaned = _clean_id_list([] if value is None else value, invalid="Invalid view")
        return [] if cleaned is None else cleaned


class ProjectGroupMove(APIModel):
    from_group_id: int
    to_group_id: int


def _clean_symbol(value: str | None, *, required: bool) -> str | None:
    if value is None:
        if required:
            raise ValueError("Symbol is required")
        return None
    if not isinstance(value, str):
        raise ValueError("Symbol is required")
    text = " ".join(value.split())
    if not text:
        raise ValueError("Symbol is required")
    if len(text) > 64:
        raise ValueError("A label can be at most 64 characters")
    return text


def _clean_title(value: str | None, *, required: bool) -> str | None:
    if value is None:
        if required:
            raise ValueError("Title is required")
        return None
    if not isinstance(value, str):
        raise ValueError("Title is required")
    text = " ".join(value.split())
    if not text:
        raise ValueError("Title is required")
    if len(text) > 255:
        raise ValueError("Title is too long")
    return text


def _clean_tag_list(value):
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("Labels must be a list")
    return normalize_tags(value)


class TagCreate(APIModel):
    name: str
    title: str
    description: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        return _clean_symbol(value, required=True)

    @field_validator("title", mode="before")
    @classmethod
    def title_clean(cls, value):
        return _clean_title(value, required=True)

    @field_validator("description", mode="before")
    @classmethod
    def description_clean(cls, value):
        return blank_to_none(value)


class TagPatch(APIModel):
    name: str | None = None
    title: str | None = None
    description: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        if value is None:
            return None
        return _clean_symbol(value, required=True)

    @field_validator("title", mode="before")
    @classmethod
    def title_clean(cls, value):
        if value is None:
            return None
        return _clean_title(value, required=True)

    @field_validator("description", mode="before")
    @classmethod
    def description_clean(cls, value):
        if value is None:
            return None
        return blank_to_none(value)

    @model_validator(mode="after")
    def reject_blank(self):
        if "name" in self.model_fields_set and not self.name:
            raise ValueError("Symbol is required")
        if "title" in self.model_fields_set and not self.title:
            raise ValueError("Title is required")
        return self


class TagOut(APIModel):
    id: int
    name: str
    title: str
    description: str | None
    project_count: int


class TagRef(APIModel):
    id: int
    name: str
    title: str
    description: str | None = None


class ProjectWrite(APIModel):
    name: str = Field(max_length=255)
    description: str | None = None
    status: Lifecycle = Lifecycle.assessment
    group_ids: list[int] = Field(default_factory=list)
    report_cadence_days: int | None = Field(default=None, ge=0, le=365)
    reports_with_pmo: bool = False
    external_url: str | None = None
    tags: list[str] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        return _clean_name(value, required=True)

    @field_validator("description", mode="before")
    @classmethod
    def description_clean(cls, value):
        return blank_to_none(value)

    @field_validator("external_url", mode="before")
    @classmethod
    def external_url_clean(cls, value):
        return normalize_external_url(value)

    @field_validator("group_ids", mode="before")
    @classmethod
    def group_ids_clean(cls, value):
        cleaned = _clean_id_list([] if value is None else value, invalid="Invalid view")
        return [] if cleaned is None else cleaned

    @field_validator("tags", mode="before")
    @classmethod
    def tags_clean(cls, value):
        cleaned = _clean_tag_list([] if value is None else value)
        return [] if cleaned is None else cleaned


class ProjectPatch(APIModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    status: Lifecycle | None = None
    reports_with_pmo: bool | None = None
    report_cadence_days: int | None = Field(default=None, ge=0, le=365)
    external_url: str | None = None
    tags: list[str] | None = None

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        if value is None:
            return None
        return _clean_name(value, required=True)

    @field_validator("description", mode="before")
    @classmethod
    def description_clean(cls, value):
        if value is None:
            return None
        return blank_to_none(value)

    @field_validator("external_url", mode="before")
    @classmethod
    def external_url_clean(cls, value):
        return normalize_external_url(value)

    @field_validator("tags", mode="before")
    @classmethod
    def tags_clean(cls, value):
        return _clean_tag_list(value)

    @model_validator(mode="after")
    def reject_null_required(self):
        if "name" in self.model_fields_set and not self.name:
            raise ValueError("Name is required")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Status is required")
        if "reports_with_pmo" in self.model_fields_set and self.reports_with_pmo is None:
            raise ValueError("Reporting with PMO is required")
        if "tags" in self.model_fields_set and self.tags is None:
            raise ValueError("Labels must be a list")
        return self


class AssignmentWrite(APIModel):
    resource_id: int
    project_role: ProjectRole = ProjectRole.member
    utilization_percent: int = Field(default=100, ge=0, le=100)
    onboarded: bool = False
    started_at: datetime | None = None


class AssignmentPatch(APIModel):
    project_role: ProjectRole | None = None
    utilization_percent: int | None = Field(default=None, ge=0, le=100)
    onboarded: bool | None = None

    @model_validator(mode="after")
    def require_a_change(self):
        present = {"project_role", "utilization_percent", "onboarded"} & self.model_fields_set
        if not present or any(getattr(self, name) is None for name in present):
            raise ValueError("Provide a project role, utilization, or onboarded flag")
        return self


class MoveAssignment(APIModel):
    unassigned: bool = False
    to_project_id: int | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    highlights: str | None = Field(default=None, max_length=4000)

    @field_validator("highlights", mode="before")
    @classmethod
    def highlights_clean(cls, value):
        return blank_to_none(value)


class ContributionPatch(APIModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    utilization_percent: int | None = Field(default=None, ge=0, le=100)
    project_role: ProjectRole | None = None
    highlights: str | None = Field(default=None, max_length=4000)

    @field_validator("highlights", mode="before")
    @classmethod
    def highlights_clean(cls, value):
        return blank_to_none(value)


class ProjectAssignment(APIModel):
    resource_id: int
    name: str
    email: str
    department_name: str
    designation_name: str | None
    companies: list[AssignmentCompany]
    resigned: bool
    project_role: str
    utilization_percent: int
    onboarded: bool
    project_count: int
    started_at: Utc


class ContributionOut(APIModel):
    id: int
    resource_id: int
    name: str
    email: str
    department_name: str
    designation_name: str | None
    companies: list[AssignmentCompany]
    started_at: Utc
    ended_at: Utc
    utilization_percent: int
    project_role: str
    highlights: str | None


class ProjectListItem(APIModel):
    id: int
    name: str
    description: str | None
    status: str
    archived: bool
    reports_with_pmo: bool
    report_cadence_days: int | None
    external_url: str | None
    tags: list[TagRef]
    assignment_count: int
    resource_count: int
    status_report_count: int
    latest_report_at: UtcOpt = None
    groups: list[ProjectGroupRef]
    created_at: Utc
    updated_at: Utc


class ProjectOut(ProjectListItem):
    assignments: list[ProjectAssignment]
    contributions: list[ContributionOut]


def _clean_report_flag(value):
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return value


class StatusReportCreate(APIModel):
    body: str
    created_at: datetime | None = None
    flag: ReportFlag | None = None

    @field_validator("body", mode="before")
    @classmethod
    def body_clean(cls, value):
        return clean_report_body(value)

    @field_validator("flag", mode="before")
    @classmethod
    def flag_clean(cls, value):
        return _clean_report_flag(value)


class StatusReportPatch(APIModel):
    body: str
    created_at: datetime | None = None
    flag: ReportFlag | None = None

    @field_validator("body", mode="before")
    @classmethod
    def body_clean(cls, value):
        return clean_report_body(value)

    @field_validator("flag", mode="before")
    @classmethod
    def flag_clean(cls, value):
        return _clean_report_flag(value)


class StatusReportOut(APIModel):
    id: int
    project_id: int
    body: str
    flag: str | None
    created_at: Utc
    updated_at: Utc


class StatusReportList(APIModel):
    items: list[StatusReportOut]
    total: int
    latest_report_at: UtcOpt = None


class RoleOut(APIModel):
    code: str
    label: str


class LocationOut(APIModel):
    code: str
    label: str
