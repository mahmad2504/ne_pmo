from fastapi import APIRouter, Depends

from app.auth import require_reader
from app.locations import LOCATIONS
from app.roles import LIFECYCLE, PROJECT_ROLES
from app.schemas import LocationOut, RoleOut

router = APIRouter(tags=["catalog"], dependencies=[Depends(require_reader)])


@router.get("/api/project-roles", response_model=list[RoleOut])
def project_roles():
    return [{"code": code, "label": label} for code, label in PROJECT_ROLES]


@router.get("/api/locations", response_model=list[LocationOut])
def locations():
    return [{"code": code, "label": code} for code in LOCATIONS]


@router.get("/api/lifecycle", response_model=list[RoleOut])
def lifecycle():
    return [{"code": code, "label": label} for code, label in LIFECYCLE]
