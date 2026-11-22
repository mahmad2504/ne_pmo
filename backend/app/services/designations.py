from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Designation, Resource
from app.schemas import DesignationCreate, DesignationPatch


def _require(db: Session, designation_id: int) -> Designation:
    row = db.get(Designation, designation_id)
    if row is None:
        raise AppError(404, "Job title not found")
    return row


def _taken(db: Session, name: str, exclude_id: int | None = None) -> Designation | None:
    stmt = select(Designation).where(func.lower(Designation.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Designation.id != exclude_id)
    return db.scalar(stmt)


def _count(db: Session, designation_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Resource).where(Resource.designation_id == designation_id)
    ) or 0


def _payload(db: Session, row: Designation) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "resource_count": _count(db, row.id),
    }


def list_designations(db: Session) -> list[dict]:
    rows = db.scalars(select(Designation).order_by(func.lower(Designation.name), Designation.id)).all()
    return [_payload(db, row) for row in rows]


def create_designation(db: Session, body: DesignationCreate) -> dict:
    if _taken(db, body.name) is not None:
        raise AppError(409, "A job title with that name already exists")
    row = Designation(name=body.name, description=body.description)
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A job title with that name already exists") from exc
    return _payload(db, row)


def patch_designation(db: Session, designation_id: int, body: DesignationPatch) -> dict:
    row = _require(db, designation_id)
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        if _taken(db, body.name, exclude_id=row.id) is not None:
            raise AppError(409, "A job title with that name already exists")
        row.name = body.name
    if "description" in fields:
        row.description = body.description
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A job title with that name already exists") from exc
    return _payload(db, row)


def delete_designation(db: Session, designation_id: int) -> None:
    row = _require(db, designation_id)
    db.execute(update(Resource).where(Resource.designation_id == row.id).values(designation_id=None))
    db.delete(row)
    db.flush()
