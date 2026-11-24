from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import CatalogOut, DesignationCreate, DesignationPatch
from app.services import designations as service

router = APIRouter(prefix="/api/designations", tags=["designations"])


@router.get("", response_model=list[CatalogOut], dependencies=[Depends(require_reader)])
def list_designations(db: Session = Depends(get_db, scope="function")):
    return service.list_designations(db)


@router.post("", status_code=201, response_model=CatalogOut, dependencies=[Depends(require_admin)])
def create_designation(body: DesignationCreate, response: Response, db: Session = Depends(get_db, scope="function")):
    payload = service.create_designation(db, body)
    response.headers["Location"] = f"/api/designations/{payload['id']}"
    return payload


@router.patch("/{designation_id}", response_model=CatalogOut, dependencies=[Depends(require_admin)])
def patch_designation(designation_id: int, body: DesignationPatch, db: Session = Depends(get_db, scope="function")):
    return service.patch_designation(db, designation_id, body)


@router.delete("/{designation_id}", dependencies=[Depends(require_admin)])
def delete_designation(designation_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_designation(db, designation_id)
    return RawResponse(status_code=204)
