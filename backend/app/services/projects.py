from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.clock import utcnow
from app.errors import AppError
from app.models import Project, ProjectResource, Resource, ResourceCompany
from app.roles import ProjectRole
from app.schemas import AssignmentPatch, AssignmentWrite, ProjectPatch, ProjectWrite


def _require_project(db: Session, project_id: int) -> Project:
    row = db.get(Project, project_id)
    if row is None:
        raise AppError(404, "Project not found")
    return row


def _person_options():
    return (
        joinedload(Resource.department),
        joinedload(Resource.designation),
        joinedload(Resource.company_links).joinedload(ResourceCompany.company),
    )


def _companies(person: Resource) -> list[dict]:
    companies = sorted(
        (link.company for link in person.company_links),
        key=lambda company: (company.name.lower(), company.id),
    )
    return [{"name": company.name, "icon": company.icon} for company in companies]


def _require_resource(db: Session, resource_id: int) -> Resource:
    row = db.scalar(select(Resource).options(*_person_options()).where(Resource.id == resource_id))
    if row is None:
        raise AppError(404, "Person not found")
    return row


def _assignment_rows(db: Session, project_id: int) -> list[ProjectResource]:
    return list(
        db.scalars(
            select(ProjectResource)
            .options(
                joinedload(ProjectResource.resource).joinedload(Resource.department),
                joinedload(ProjectResource.resource).joinedload(Resource.designation),
                joinedload(ProjectResource.resource)
                .joinedload(Resource.company_links)
                .joinedload(ResourceCompany.company),
            )
            .where(ProjectResource.project_id == project_id)
            .join(Resource, Resource.id == ProjectResource.resource_id)
            .order_by(func.lower(Resource.name), Resource.id)
        ).unique().all()
    )


def _payload(db: Session, row: Project) -> dict:
    assignments = []
    for link in _assignment_rows(db, row.id):
        person = link.resource
        assignments.append(
            {
                "resource_id": person.id,
                "name": person.name,
                "email": person.email,
                "department_name": person.department.name,
                "designation_name": None if person.designation is None else person.designation.name,
                "companies": _companies(person),
                "project_role": link.project_role,
            }
        )
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "status": row.status,
        "assignment_count": len(assignments),
        "assignments": assignments,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def list_projects(db: Session, q: str | None = None) -> list[dict]:
    stmt = select(Project)
    needle = (q or "").strip().lower()
    if needle:
        stmt = stmt.where(
            or_(
                func.lower(Project.name).contains(needle),
                func.lower(func.coalesce(Project.description, "")).contains(needle),
            )
        )
    rows = db.scalars(stmt.order_by(Project.updated_at.desc(), func.lower(Project.name), Project.id)).all()
    return [_payload(db, row) for row in rows]


def get_project(db: Session, project_id: int) -> dict:
    return _payload(db, _require_project(db, project_id))


def create_project(db: Session, body: ProjectWrite) -> dict:
    now = utcnow()
    row = Project(
        name=body.name,
        description=body.description,
        status=body.status.value,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return _payload(db, row)


def patch_project(db: Session, project_id: int, body: ProjectPatch) -> dict:
    row = _require_project(db, project_id)
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        row.name = body.name
    if "description" in fields:
        row.description = body.description
    if "status" in fields and body.status is not None:
        row.status = body.status.value
    row.updated_at = utcnow()
    db.flush()
    return _payload(db, row)


def delete_project(db: Session, project_id: int) -> None:
    row = _require_project(db, project_id)
    db.delete(row)
    db.flush()


def assign_resource(db: Session, project_id: int, body: AssignmentWrite) -> dict:
    project = _require_project(db, project_id)
    _require_resource(db, body.resource_id)
    existing = db.get(ProjectResource, (project_id, body.resource_id))
    if existing is not None:
        raise AppError(409, "That person is already on this project")
    role = body.project_role.value if isinstance(body.project_role, ProjectRole) else body.project_role
    db.add(
        ProjectResource(
            project_id=project_id,
            resource_id=body.resource_id,
            project_role=role,
        )
    )
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)


def update_assignment(db: Session, project_id: int, resource_id: int, body: AssignmentPatch) -> dict:
    project = _require_project(db, project_id)
    link = db.get(ProjectResource, (project_id, resource_id))
    if link is None:
        raise AppError(404, "That person is not on this project")
    link.project_role = body.project_role.value
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)


def remove_assignment(db: Session, project_id: int, resource_id: int) -> dict:
    project = _require_project(db, project_id)
    link = db.get(ProjectResource, (project_id, resource_id))
    if link is None:
        raise AppError(404, "That person is not on this project")
    db.delete(link)
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)
