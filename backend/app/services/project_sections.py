from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import ProjectSection
from app.schemas import ProjectGroupSectionCreate, ProjectGroupSectionPatch


def _require(db: Session, section_id: int) -> ProjectSection:
    row = db.get(ProjectSection, section_id)
    if row is None:
        raise AppError(404, "Section not found")
    return row


def _taken(db: Session, name: str, exclude_id: int | None = None) -> ProjectSection | None:
    stmt = select(ProjectSection).where(func.lower(ProjectSection.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(ProjectSection.id != exclude_id)
    return db.scalar(stmt)


def _payload(row: ProjectSection) -> dict:
    return {"id": row.id, "name": row.name, "position": row.position}


def list_sections(db: Session) -> list[dict]:
    rows = db.scalars(
        select(ProjectSection).order_by(ProjectSection.position, func.lower(ProjectSection.name), ProjectSection.id)
    ).all()
    return [_payload(row) for row in rows]


def create_section(db: Session, body: ProjectGroupSectionCreate) -> dict:
    if _taken(db, body.name) is not None:
        raise AppError(409, "A section with that name already exists")
    last = db.scalar(select(func.max(ProjectSection.position)))
    row = ProjectSection(name=body.name, position=0 if last is None else int(last) + 1)
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A section with that name already exists") from exc
    return _payload(row)


def patch_section(db: Session, section_id: int, body: ProjectGroupSectionPatch) -> dict:
    row = _require(db, section_id)
    if "name" in body.model_fields_set and body.name is not None:
        if _taken(db, body.name, exclude_id=row.id) is not None:
            raise AppError(409, "A section with that name already exists")
        row.name = body.name
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A section with that name already exists") from exc
    return _payload(row)


def delete_section(db: Session, section_id: int) -> None:
    row = _require(db, section_id)
    db.delete(row)
    db.flush()
