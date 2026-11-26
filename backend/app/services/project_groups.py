from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import ProjectGroup, ProjectGroupMember, ProjectGroupSection
from app.schemas import (
    ProjectGroupCreate,
    ProjectGroupPatch,
    ProjectGroupSectionCreate,
    ProjectGroupSectionPatch,
)


def _require(db: Session, group_id: int) -> ProjectGroup:
    row = db.get(ProjectGroup, group_id)
    if row is None:
        raise AppError(404, "View not found")
    return row


def _taken(db: Session, name: str, exclude_id: int | None = None) -> ProjectGroup | None:
    stmt = select(ProjectGroup).where(func.lower(ProjectGroup.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(ProjectGroup.id != exclude_id)
    return db.scalar(stmt)


def _count(db: Session, group_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(ProjectGroupMember)
        .where(ProjectGroupMember.group_id == group_id)
    ) or 0


def _payload(db: Session, row: ProjectGroup) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "position": row.position,
        "project_count": _count(db, row.id),
    }


def list_groups(db: Session) -> list[dict]:
    rows = db.scalars(
        select(ProjectGroup).order_by(ProjectGroup.position, func.lower(ProjectGroup.name), ProjectGroup.id)
    ).all()
    return [_payload(db, row) for row in rows]


def create_group(db: Session, body: ProjectGroupCreate) -> dict:
    if _taken(db, body.name) is not None:
        raise AppError(409, "A view with that name already exists")
    last = db.scalar(select(func.max(ProjectGroup.position)))
    row = ProjectGroup(
        name=body.name,
        description=body.description,
        position=0 if last is None else int(last) + 1,
    )
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A view with that name already exists") from exc
    return _payload(db, row)


def patch_group(db: Session, group_id: int, body: ProjectGroupPatch) -> dict:
    row = _require(db, group_id)
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        if _taken(db, body.name, exclude_id=row.id) is not None:
            raise AppError(409, "A view with that name already exists")
        row.name = body.name
    if "description" in fields:
        row.description = body.description
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A view with that name already exists") from exc
    return _payload(db, row)


def delete_group(db: Session, group_id: int) -> None:
    row = _require(db, group_id)
    db.delete(row)
    db.flush()


def _require_section(db: Session, group_id: int, section_id: int) -> ProjectGroupSection:
    _require(db, group_id)
    row = db.get(ProjectGroupSection, section_id)
    if row is None or row.group_id != group_id:
        raise AppError(404, "Section not found")
    return row


def _section_taken(db: Session, group_id: int, name: str, exclude_id: int | None = None) -> ProjectGroupSection | None:
    stmt = select(ProjectGroupSection).where(
        ProjectGroupSection.group_id == group_id,
        func.lower(ProjectGroupSection.name) == name.lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(ProjectGroupSection.id != exclude_id)
    return db.scalar(stmt)


def _section_payload(row: ProjectGroupSection) -> dict:
    return {
        "id": row.id,
        "group_id": row.group_id,
        "name": row.name,
        "position": row.position,
    }


def list_sections(db: Session, group_id: int) -> list[dict]:
    _require(db, group_id)
    rows = db.scalars(
        select(ProjectGroupSection)
        .where(ProjectGroupSection.group_id == group_id)
        .order_by(ProjectGroupSection.position, func.lower(ProjectGroupSection.name), ProjectGroupSection.id)
    ).all()
    return [_section_payload(row) for row in rows]


def create_section(db: Session, group_id: int, body: ProjectGroupSectionCreate) -> dict:
    _require(db, group_id)
    if _section_taken(db, group_id, body.name) is not None:
        raise AppError(409, "A section with that name already exists")
    last = db.scalar(
        select(func.max(ProjectGroupSection.position)).where(ProjectGroupSection.group_id == group_id)
    )
    row = ProjectGroupSection(
        group_id=group_id,
        name=body.name,
        position=0 if last is None else int(last) + 1,
    )
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A section with that name already exists") from exc
    return _section_payload(row)


def patch_section(db: Session, group_id: int, section_id: int, body: ProjectGroupSectionPatch) -> dict:
    row = _require_section(db, group_id, section_id)
    if "name" in body.model_fields_set and body.name is not None:
        if _section_taken(db, group_id, body.name, exclude_id=row.id) is not None:
            raise AppError(409, "A section with that name already exists")
        row.name = body.name
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A section with that name already exists") from exc
    return _section_payload(row)


def delete_section(db: Session, group_id: int, section_id: int) -> None:
    row = _require_section(db, group_id, section_id)
    db.delete(row)
    db.flush()
