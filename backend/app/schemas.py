from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from pydantic.functional_serializers import PlainSerializer

from app.clock import iso
from app.locations import LOCATIONS
from app.normalize import blank_to_none, normalize_location
from app.roles import Lifecycle, ProjectRole


def _iso_value(value: datetime | None) -> str | None:
    if value is None:
        return None
    return iso(value)


Utc = Annotated[datetime, PlainSerializer(_iso_value, return_type=str, when_used="json")]


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
        return self


class ResourceOut(APIModel):
    id: int
    name: str
    email: str
    location: str | None
    department: DepartmentRef
    designation: DesignationRef | None
    companies: list[CompanyRef]
    assignments: list[ResourceAssignment]
    created_at: Utc
    updated_at: Utc


class ProjectWrite(APIModel):
    name: str = Field(max_length=255)
    description: str | None = None
    status: Lifecycle = Lifecycle.assessment

    @field_validator("name", mode="before")
    @classmethod
    def name_clean(cls, value):
        return _clean_name(value, required=True)

    @field_validator("description", mode="before")
    @classmethod
    def description_clean(cls, value):
        return blank_to_none(value)


class ProjectPatch(APIModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    status: Lifecycle | None = None

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
    def reject_null_required(self):
        if "name" in self.model_fields_set and not self.name:
            raise ValueError("Name is required")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Status is required")
        return self


class AssignmentWrite(APIModel):
    resource_id: int
    project_role: ProjectRole = ProjectRole.member


class AssignmentPatch(APIModel):
    project_role: ProjectRole


class ProjectAssignment(APIModel):
    resource_id: int
    name: str
    email: str
    department_name: str
    designation_name: str | None
    companies: list[AssignmentCompany]
    project_role: str


class ProjectOut(APIModel):
    id: int
    name: str
    description: str | None
    status: str
    assignment_count: int
    assignments: list[ProjectAssignment]
    created_at: Utc
    updated_at: Utc


class RoleOut(APIModel):
    code: str
    label: str


class LocationOut(APIModel):
    code: str
    label: str
