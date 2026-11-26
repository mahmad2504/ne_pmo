from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import ProjectGroupSectionCreate, ProjectGroupSectionPatch, ProjectSectionOut
from app.services import project_sections as service

router = APIRouter(prefix="/api/project-sections", tags=["project-sections"])


@router.get("", response_model=list[ProjectSectionOut], dependencies=[Depends(require_reader)])
def list_sections(db: Session = Depends(get_db, scope="function")):
    return service.list_sections(db)


@router.post("", status_code=201, response_model=ProjectSectionOut, dependencies=[Depends(require_admin)])
def create_section(body: ProjectGroupSectionCreate, response: Response, db: Session = Depends(get_db, scope="function")):
    payload = service.create_section(db, body)
    response.headers["Location"] = f"/api/project-sections/{payload['id']}"
    return payload


@router.patch("/{section_id}", response_model=ProjectSectionOut, dependencies=[Depends(require_admin)])
def patch_section(section_id: int, body: ProjectGroupSectionPatch, db: Session = Depends(get_db, scope="function")):
    return service.patch_section(db, section_id, body)


@router.delete("/{section_id}", dependencies=[Depends(require_admin)])
def delete_section(section_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_section(db, section_id)
    return RawResponse(status_code=204)
