from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import ProjectTag, Tag
from app.schemas import TagCreate, TagPatch


def _require_tag(db: Session, tag_id: int) -> Tag:
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise AppError(404, "Label not found")
    return tag


def _taken(db: Session, name: str, exclude_id: int | None = None) -> Tag | None:
    stmt = select(Tag).where(func.lower(Tag.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Tag.id != exclude_id)
    return db.scalar(stmt)


def _payload(db: Session, tag: Tag) -> dict:
    count = db.scalar(select(func.count()).select_from(ProjectTag).where(ProjectTag.tag_id == tag.id))
    return {
        "id": tag.id,
        "name": tag.name,
        "title": tag.title,
        "description": tag.description,
        "project_count": int(count or 0),
    }


def list_tags(db: Session) -> list[dict]:
    tags = list(db.scalars(select(Tag).order_by(func.lower(Tag.name), Tag.id)).all())
    return [_payload(db, tag) for tag in tags]


def create_tag(db: Session, body: TagCreate) -> dict:
    if _taken(db, body.name) is not None:
        raise AppError(409, "A label with that symbol already exists")
    tag = Tag(name=body.name, title=body.title, description=body.description)
    try:
        with db.begin_nested():
            db.add(tag)
            db.flush()
    except IntegrityError as exc:
        if _taken(db, body.name) is not None:
            raise AppError(409, "A label with that symbol already exists") from exc
        raise
    return _payload(db, tag)


def patch_tag(db: Session, tag_id: int, body: TagPatch) -> dict:
    tag = _require_tag(db, tag_id)
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        if _taken(db, body.name, exclude_id=tag.id) is not None:
            raise AppError(409, "A label with that symbol already exists")
        tag.name = body.name
    if "title" in fields and body.title is not None:
        tag.title = body.title
    if "description" in fields:
        tag.description = body.description
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A label with that symbol already exists") from exc
    return _payload(db, tag)


def delete_tag(db: Session, tag_id: int) -> None:
    tag = _require_tag(db, tag_id)
    db.delete(tag)
    db.flush()


def set_project_tags(db: Session, project_id: int, names: list[str]) -> None:
    tags: list[Tag] = []
    for name in names:
        tag = db.scalar(select(Tag).where(func.lower(Tag.name) == name.lower()))
        if tag is None:
            raise AppError(404, "Label not found")
        tags.append(tag)
    db.execute(delete(ProjectTag).where(ProjectTag.project_id == project_id))
    for tag in tags:
        db.add(ProjectTag(project_id=project_id, tag_id=tag.id))
    db.flush()
