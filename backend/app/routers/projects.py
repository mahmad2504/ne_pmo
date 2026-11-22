from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import AssignmentPatch, AssignmentWrite, ProjectOut, ProjectPatch, ProjectWrite
from app.services import projects as service

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut], dependencies=[Depends(require_reader)])
def list_projects(q: str | None = None, db: Session = Depends(get_db)):
    return service.list_projects(db, q=q)


@router.post("", status_code=201, response_model=ProjectOut, dependencies=[Depends(require_admin)])
def create_project(body: ProjectWrite, response: Response, db: Session = Depends(get_db)):
    payload = service.create_project(db, body)
    response.headers["Location"] = f"/api/projects/{payload['id']}"
    return payload


@router.get("/{project_id}", response_model=ProjectOut, dependencies=[Depends(require_reader)])
def get_project(project_id: int, db: Session = Depends(get_db)):
    return service.get_project(db, project_id)


@router.patch("/{project_id}", response_model=ProjectOut, dependencies=[Depends(require_admin)])
def patch_project(project_id: int, body: ProjectPatch, db: Session = Depends(get_db)):
    return service.patch_project(db, project_id, body)


@router.delete("/{project_id}", dependencies=[Depends(require_admin)])
def delete_project(project_id: int, db: Session = Depends(get_db)):
    service.delete_project(db, project_id)
    return RawResponse(status_code=204)


@router.post(
    "/{project_id}/resources",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def assign_resource(project_id: int, body: AssignmentWrite, db: Session = Depends(get_db)):
    return service.assign_resource(db, project_id, body)


@router.patch(
    "/{project_id}/resources/{resource_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def update_assignment(
    project_id: int,
    resource_id: int,
    body: AssignmentPatch,
    db: Session = Depends(get_db),
):
    return service.update_assignment(db, project_id, resource_id, body)


@router.delete(
    "/{project_id}/resources/{resource_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def remove_assignment(project_id: int, resource_id: int, db: Session = Depends(get_db)):
    return service.remove_assignment(db, project_id, resource_id)
