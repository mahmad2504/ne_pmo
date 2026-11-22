from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Department, Resource
from app.schemas import DepartmentCreate, DepartmentPatch


def _require(db: Session, department_id: int) -> Department:
    row = db.get(Department, department_id)
    if row is None:
        raise AppError(404, "Department not found")
    return row


def _taken(db: Session, name: str, exclude_id: int | None = None) -> Department | None:
    stmt = select(Department).where(func.lower(Department.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Department.id != exclude_id)
    return db.scalar(stmt)


def _count(db: Session, department_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Resource).where(Resource.department_id == department_id)
    ) or 0


def _payload(db: Session, row: Department) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "resource_count": _count(db, row.id),
    }


def list_departments(db: Session) -> list[dict]:
    rows = db.scalars(select(Department).order_by(func.lower(Department.name), Department.id)).all()
    return [_payload(db, row) for row in rows]


def create_department(db: Session, body: DepartmentCreate) -> dict:
    if _taken(db, body.name) is not None:
        raise AppError(409, "A department with that name already exists")
    row = Department(name=body.name, description=body.description)
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A department with that name already exists") from exc
    return _payload(db, row)


def patch_department(db: Session, department_id: int, body: DepartmentPatch) -> dict:
    row = _require(db, department_id)
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        if _taken(db, body.name, exclude_id=row.id) is not None:
            raise AppError(409, "A department with that name already exists")
        row.name = body.name
    if "description" in fields:
        row.description = body.description
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A department with that name already exists") from exc
    return _payload(db, row)


def delete_department(db: Session, department_id: int) -> None:
    row = _require(db, department_id)
    count = _count(db, row.id)
    if count:
        noun = "person" if count == 1 else "people"
        raise AppError(409, f"Cannot delete {row.name}. It is still assigned to {count} {noun}.")
    db.delete(row)
    db.flush()
