from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import (
    AssignmentPatch,
    AssignmentWrite,
    ContributionPatch,
    MoveAssignment,
    ProjectGroupMove,
    ProjectGroupsWrite,
    ProjectListItem,
    ProjectOut,
    ProjectPatch,
    ProjectWrite,
    StatusReportCreate,
    StatusReportList,
    StatusReportOut,
    StatusReportPatch,
)
from app.services import projects as service

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectListItem], dependencies=[Depends(require_reader)])
def list_projects(
    q: str | None = None,
    group_id: int | None = None,
    ungrouped: bool = False,
    archived: bool = False,
    tag_id: int | None = None,
    resource_id: int | None = None,
    db: Session = Depends(get_db, scope="function"),
):
    return service.list_projects(
        db,
        q=q,
        group_id=group_id,
        ungrouped=ungrouped,
        archived=archived,
        tag_id=tag_id,
        resource_id=resource_id,
    )


@router.post("", status_code=201, response_model=ProjectOut, dependencies=[Depends(require_admin)])
def create_project(body: ProjectWrite, response: Response, db: Session = Depends(get_db, scope="function")):
    payload = service.create_project(db, body)
    response.headers["Location"] = f"/api/projects/{payload['id']}"
    return payload


@router.get("/{project_id}", response_model=ProjectOut, dependencies=[Depends(require_reader)])
def get_project(project_id: int, db: Session = Depends(get_db, scope="function")):
    return service.get_project(db, project_id)


@router.patch("/{project_id}", response_model=ProjectOut, dependencies=[Depends(require_admin)])
def patch_project(project_id: int, body: ProjectPatch, db: Session = Depends(get_db, scope="function")):
    return service.patch_project(db, project_id, body)


@router.post("/{project_id}/archive", response_model=ProjectOut, dependencies=[Depends(require_admin)])
def archive_project(project_id: int, db: Session = Depends(get_db, scope="function")):
    return service.archive_project(db, project_id)


@router.post("/{project_id}/unarchive", response_model=ProjectOut, dependencies=[Depends(require_admin)])
def unarchive_project(project_id: int, db: Session = Depends(get_db, scope="function")):
    return service.unarchive_project(db, project_id)


@router.delete("/{project_id}", dependencies=[Depends(require_admin)])
def delete_project(project_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_project(db, project_id)
    return RawResponse(status_code=204)


@router.post(
    "/{project_id}/resources",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def assign_resource(project_id: int, body: AssignmentWrite, db: Session = Depends(get_db, scope="function")):
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
    db: Session = Depends(get_db, scope="function"),
):
    return service.update_assignment(db, project_id, resource_id, body)


@router.delete(
    "/{project_id}/resources/{resource_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def remove_assignment(project_id: int, resource_id: int, db: Session = Depends(get_db, scope="function")):
    return service.remove_assignment(db, project_id, resource_id)


@router.post(
    "/{project_id}/resources/{resource_id}/move",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def move_assignment(
    project_id: int,
    resource_id: int,
    body: MoveAssignment,
    db: Session = Depends(get_db, scope="function"),
):
    return service.move_assignment(db, project_id, resource_id, body)


@router.patch(
    "/{project_id}/contributions/{contribution_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def patch_contribution(
    project_id: int,
    contribution_id: int,
    body: ContributionPatch,
    db: Session = Depends(get_db, scope="function"),
):
    return service.patch_contribution(db, project_id, contribution_id, body)


@router.delete(
    "/{project_id}/contributions/{contribution_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def delete_contribution(project_id: int, contribution_id: int, db: Session = Depends(get_db, scope="function")):
    return service.delete_contribution(db, project_id, contribution_id)


@router.get(
    "/{project_id}/status-reports",
    response_model=StatusReportList,
    dependencies=[Depends(require_reader)],
)
def list_status_reports(
    project_id: int,
    limit: int | None = Query(default=None, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db, scope="function"),
):
    return service.list_status_reports(db, project_id, limit, offset)


@router.post(
    "/{project_id}/status-reports",
    status_code=201,
    response_model=StatusReportOut,
    dependencies=[Depends(require_admin)],
)
def create_status_report(project_id: int, body: StatusReportCreate, db: Session = Depends(get_db, scope="function")):
    return service.create_status_report(db, project_id, body)


@router.patch(
    "/{project_id}/status-reports/{report_id}",
    response_model=StatusReportOut,
    dependencies=[Depends(require_admin)],
)
def patch_status_report(
    project_id: int,
    report_id: int,
    body: StatusReportPatch,
    db: Session = Depends(get_db, scope="function"),
):
    return service.patch_status_report(db, project_id, report_id, body)


@router.delete(
    "/{project_id}/status-reports/{report_id}",
    dependencies=[Depends(require_admin)],
)
def delete_status_report(project_id: int, report_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_status_report(db, project_id, report_id)
    return RawResponse(status_code=204)


@router.put(
    "/{project_id}/groups",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def set_groups(project_id: int, body: ProjectGroupsWrite, db: Session = Depends(get_db, scope="function")):
    return service.set_project_groups(db, project_id, body.group_ids)


@router.post(
    "/{project_id}/groups/move",
    response_model=ProjectOut,
    dependencies=[Depends(require_admin)],
)
def move_group(project_id: int, body: ProjectGroupMove, db: Session = Depends(get_db, scope="function")):
    return service.move_project_group(db, project_id, body.from_group_id, body.to_group_id)
