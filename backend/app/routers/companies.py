from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import CatalogOut, CompanyCreate, CompanyPatch
from app.services import companies as service

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=list[CatalogOut], dependencies=[Depends(require_reader)])
def list_companies(db: Session = Depends(get_db)):
    return service.list_companies(db)


@router.post("", status_code=201, response_model=CatalogOut, dependencies=[Depends(require_admin)])
def create_company(body: CompanyCreate, response: Response, db: Session = Depends(get_db)):
    payload = service.create_company(db, body)
    response.headers["Location"] = f"/api/companies/{payload['id']}"
    return payload


@router.patch("/{company_id}", response_model=CatalogOut, dependencies=[Depends(require_admin)])
def patch_company(company_id: int, body: CompanyPatch, db: Session = Depends(get_db)):
    return service.patch_company(db, company_id, body)


@router.delete("/{company_id}", dependencies=[Depends(require_admin)])
def delete_company(company_id: int, db: Session = Depends(get_db)):
    service.delete_company(db, company_id)
    return RawResponse(status_code=204)
