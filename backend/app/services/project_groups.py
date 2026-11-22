from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import ProjectGroup, ProjectGroupMember
from app.schemas import ProjectGroupCreate, ProjectGroupPatch


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
