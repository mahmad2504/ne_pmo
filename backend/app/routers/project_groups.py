from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import (
    ProjectGroupCreate,
    ProjectGroupOut,
    ProjectGroupPatch,
    ProjectGroupSectionCreate,
    ProjectGroupSectionOut,
    ProjectGroupSectionPatch,
)
from app.services import project_groups as service

router = APIRouter(prefix="/api/project-groups", tags=["project-groups"])


@router.get("", response_model=list[ProjectGroupOut], dependencies=[Depends(require_reader)])
def list_groups(db: Session = Depends(get_db, scope="function")):
    return service.list_groups(db)


@router.post("", status_code=201, response_model=ProjectGroupOut, dependencies=[Depends(require_admin)])
def create_group(body: ProjectGroupCreate, response: Response, db: Session = Depends(get_db, scope="function")):
    payload = service.create_group(db, body)
    response.headers["Location"] = f"/api/project-groups/{payload['id']}"
    return payload


@router.patch("/{group_id}", response_model=ProjectGroupOut, dependencies=[Depends(require_admin)])
def patch_group(group_id: int, body: ProjectGroupPatch, db: Session = Depends(get_db, scope="function")):
    return service.patch_group(db, group_id, body)


@router.delete("/{group_id}", dependencies=[Depends(require_admin)])
def delete_group(group_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_group(db, group_id)
    return RawResponse(status_code=204)


@router.get(
    "/{group_id}/sections",
    response_model=list[ProjectGroupSectionOut],
    dependencies=[Depends(require_reader)],
)
def list_sections(group_id: int, db: Session = Depends(get_db, scope="function")):
    return service.list_sections(db, group_id)


@router.post(
    "/{group_id}/sections",
    status_code=201,
    response_model=ProjectGroupSectionOut,
    dependencies=[Depends(require_admin)],
)
def create_section(
    group_id: int,
    body: ProjectGroupSectionCreate,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
):
    payload = service.create_section(db, group_id, body)
    response.headers["Location"] = f"/api/project-groups/{group_id}/sections/{payload['id']}"
    return payload


@router.patch(
    "/{group_id}/sections/{section_id}",
    response_model=ProjectGroupSectionOut,
    dependencies=[Depends(require_admin)],
)
def patch_section(
    group_id: int,
    section_id: int,
    body: ProjectGroupSectionPatch,
    db: Session = Depends(get_db, scope="function"),
):
    return service.patch_section(db, group_id, section_id, body)


@router.delete(
    "/{group_id}/sections/{section_id}",
    dependencies=[Depends(require_admin)],
)
def delete_section(group_id: int, section_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_section(db, group_id, section_id)
    return RawResponse(status_code=204)
