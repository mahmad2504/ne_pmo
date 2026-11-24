from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import CatalogOut, DepartmentCreate, DepartmentPatch
from app.services import departments as service

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=list[CatalogOut], dependencies=[Depends(require_reader)])
def list_departments(db: Session = Depends(get_db, scope="function")):
    return service.list_departments(db)


@router.post("", status_code=201, response_model=CatalogOut, dependencies=[Depends(require_admin)])
def create_department(body: DepartmentCreate, response: Response, db: Session = Depends(get_db, scope="function")):
    payload = service.create_department(db, body)
    response.headers["Location"] = f"/api/departments/{payload['id']}"
    return payload


@router.patch("/{department_id}", response_model=CatalogOut, dependencies=[Depends(require_admin)])
def patch_department(department_id: int, body: DepartmentPatch, db: Session = Depends(get_db, scope="function")):
    return service.patch_department(db, department_id, body)


@router.delete("/{department_id}", dependencies=[Depends(require_admin)])
def delete_department(department_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_department(db, department_id)
    return RawResponse(status_code=204)
