from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Company, ResourceCompany
from app.schemas import CompanyCreate, CompanyPatch


def _require(db: Session, company_id: int) -> Company:
    row = db.get(Company, company_id)
    if row is None:
        raise AppError(404, "Company not found")
    return row


def _taken(db: Session, name: str, exclude_id: int | None = None) -> Company | None:
    stmt = select(Company).where(func.lower(Company.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Company.id != exclude_id)
    return db.scalar(stmt)


def _count(db: Session, company_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(ResourceCompany)
        .where(ResourceCompany.company_id == company_id)
    ) or 0


def _payload(db: Session, row: Company) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "icon": row.icon,
        "resource_count": _count(db, row.id),
    }


def list_companies(db: Session) -> list[dict]:
    rows = db.scalars(select(Company).order_by(func.lower(Company.name), Company.id)).all()
    return [_payload(db, row) for row in rows]


def create_company(db: Session, body: CompanyCreate) -> dict:
    if _taken(db, body.name) is not None:
        raise AppError(409, "A company with that name already exists")
    row = Company(name=body.name, description=body.description, icon=body.icon)
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A company with that name already exists") from exc
    return _payload(db, row)


def patch_company(db: Session, company_id: int, body: CompanyPatch) -> dict:
    row = _require(db, company_id)
    fields = body.model_fields_set
    if "name" in fields and body.name is not None:
        if _taken(db, body.name, exclude_id=row.id) is not None:
            raise AppError(409, "A company with that name already exists")
        row.name = body.name
    if "description" in fields:
        row.description = body.description
    if "icon" in fields:
        row.icon = body.icon
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError as exc:
        raise AppError(409, "A company with that name already exists") from exc
    return _payload(db, row)


def delete_company(db: Session, company_id: int) -> None:
    row = _require(db, company_id)
    db.delete(row)
    db.flush()
