from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.clock import utcnow
from app.errors import AppError
from app.locations import LOCATIONS
from app.models import Company, Department, Designation, Project, ProjectResource, Resource, ResourceCompany
from app.schemas import ResourcePatch, ResourceWrite


def _resource_options():
    return (
        joinedload(Resource.department),
        joinedload(Resource.designation),
        joinedload(Resource.company_links).joinedload(ResourceCompany.company),
    )


def _require(db: Session, resource_id: int) -> Resource:
    row = db.scalar(
        select(Resource).options(*_resource_options()).where(Resource.id == resource_id)
    )
    if row is None:
        raise AppError(404, "Person not found")
    return row


def _require_department(db: Session, department_id: int) -> Department:
    row = db.get(Department, department_id)
    if row is None:
        raise AppError(400, "Department not found")
    return row


def _require_designation(db: Session, designation_id: int | None) -> Designation | None:
    if designation_id is None:
        return None
    row = db.get(Designation, designation_id)
    if row is None:
        raise AppError(400, "Job title not found")
    return row


def _replace_companies(db: Session, row: Resource, company_ids: list[int]) -> None:
    wanted: list[int] = []
    for company_id in company_ids:
        if company_id not in wanted:
            wanted.append(company_id)
    found: dict[int, Company] = {}
    if wanted:
        companies = db.scalars(select(Company).where(Company.id.in_(wanted))).all()
        found = {company.id: company for company in companies}
        if len(found) != len(wanted):
            raise AppError(400, "Company not found")
    current = {link.company_id: link for link in list(row.company_links)}
    for company_id, link in current.items():
        if company_id not in found:
            row.company_links.remove(link)
    for company_id in wanted:
        if company_id not in current:
            row.company_links.append(ResourceCompany(company=found[company_id]))


def _company_payloads(row: Resource) -> list[dict]:
    companies = sorted(
        (link.company for link in row.company_links),
        key=lambda company: (company.name.lower(), company.id),
    )
    return [
        {
            "id": company.id,
            "name": company.name,
            "description": company.description,
            "icon": company.icon,
        }
        for company in companies
    ]


def _assignment_payloads(db: Session, resource_id: int) -> list[dict]:
    rows = db.execute(
        select(Project.id, Project.name, ProjectResource.project_role)
        .join(ProjectResource, ProjectResource.project_id == Project.id)
        .where(ProjectResource.resource_id == resource_id)
        .order_by(func.lower(Project.name), Project.id)
    ).all()
    return [
        {"project_id": project_id, "project_name": name, "project_role": role}
        for project_id, name, role in rows
    ]


def _payload(db: Session, row: Resource) -> dict:
    department = row.department
    designation = row.designation
    return {
        "id": row.id,
        "name": row.name,
        "email": row.email,
        "location": row.location,
        "department": {
            "id": department.id,
            "name": department.name,
            "description": department.description,
        },
        "designation": None
        if designation is None
        else {
            "id": designation.id,
            "name": designation.name,
            "description": designation.description,
        },
        "companies": _company_payloads(row),
        "resigned": row.resigned,
        "assignments": _assignment_payloads(db, row.id),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def list_resources(
    db: Session,
    q: str | None = None,
    department_id: int | None = None,
    location: str | None = None,
    company_id: int | None = None,
    include_resigned: bool = False,
    resigned_only: bool = False,
    project_count: str | None = None,
) -> list[dict]:
    stmt = select(Resource).options(*_resource_options())
    if resigned_only:
        stmt = stmt.where(Resource.resigned.is_(True))
    elif not include_resigned:
        stmt = stmt.where(Resource.resigned.is_(False))
    needle = (q or "").strip().lower()
    if needle:
        stmt = stmt.where(
            or_(
                func.lower(Resource.name).contains(needle),
                func.lower(Resource.email).contains(needle),
            )
        )
    if department_id is not None:
        stmt = stmt.where(Resource.department_id == department_id)
    if company_id is not None:
        stmt = stmt.where(
            Resource.id.in_(
                select(ResourceCompany.resource_id).where(ResourceCompany.company_id == company_id)
            )
        )
    if location:
        code = location.strip().upper()
        if code not in LOCATIONS:
            raise AppError(422, "Invalid location")
        stmt = stmt.where(Resource.location == code)
    count = (project_count or "").strip().lower()
    if count:
        if count not in {"multiple", "single", "none"}:
            raise AppError(422, "Invalid project count")
        assigned = select(ProjectResource.resource_id).group_by(ProjectResource.resource_id)
        if count == "multiple":
            stmt = stmt.where(Resource.id.in_(assigned.having(func.count(ProjectResource.project_id) > 1)))
        elif count == "single":
            stmt = stmt.where(Resource.id.in_(assigned.having(func.count(ProjectResource.project_id) == 1)))
        else:
            stmt = stmt.where(~Resource.id.in_(select(ProjectResource.resource_id)))
    rows = db.scalars(stmt.order_by(func.lower(Resource.name), Resource.id)).unique().all()
    return [_payload(db, row) for row in rows]


def get_resource(db: Session, resource_id: int) -> dict:
    return _payload(db, _require(db, resource_id))


def create_resource(db: Session, body: ResourceWrite) -> dict:
    _require_department(db, body.department_id)
    _require_designation(db, body.designation_id)
    now = utcnow()
    row = Resource(
        name=body.name,
        department_id=body.department_id,
        email=str(body.email).lower(),
        location=body.location,
        designation_id=body.designation_id,
        resigned=body.resigned,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    _replace_companies(db, row, body.company_ids)
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A person with that email already exists") from exc
    db.refresh(row)
    return get_resource(db, row.id)


def patch_resource(db: Session, resource_id: int, body: ResourcePatch) -> dict:
    row = _require(db, resource_id)
    fields = body.model_fields_set
    if "department_id" in fields and body.department_id is not None:
        _require_department(db, body.department_id)
        row.department_id = body.department_id
    if "designation_id" in fields:
        _require_designation(db, body.designation_id)
        row.designation_id = body.designation_id
    if "name" in fields and body.name is not None:
        row.name = body.name
    if "email" in fields and body.email is not None:
        row.email = str(body.email).lower()
    if "location" in fields:
        row.location = body.location
    if "resigned" in fields and body.resigned is not None:
        row.resigned = body.resigned
    if "company_ids" in fields:
        _replace_companies(db, row, body.company_ids or [])
    row.updated_at = utcnow()
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A person with that email already exists") from exc
    return get_resource(db, row.id)


def delete_resource(db: Session, resource_id: int) -> None:
    row = _require(db, resource_id)
    db.delete(row)
    db.flush()
