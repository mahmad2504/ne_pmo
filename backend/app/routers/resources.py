from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import ResourceOut, ResourcePatch, ResourceWrite
from app.services import resources as service

router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("", response_model=list[ResourceOut], dependencies=[Depends(require_reader)])
def list_resources(
    q: str | None = None,
    department_id: int | None = None,
    location: str | None = None,
    company_id: int | None = None,
    include_resigned: bool = False,
    resigned_only: bool = False,
    project_count: str | None = None,
    db: Session = Depends(get_db, scope="function"),
):
    return service.list_resources(
        db,
        q=q,
        department_id=department_id,
        location=location,
        company_id=company_id,
        include_resigned=include_resigned,
        resigned_only=resigned_only,
        project_count=project_count,
    )


@router.get("/{resource_id}", response_model=ResourceOut, dependencies=[Depends(require_reader)])
def get_resource(resource_id: int, db: Session = Depends(get_db, scope="function")):
    return service.get_resource(db, resource_id)


@router.post("", status_code=201, response_model=ResourceOut, dependencies=[Depends(require_admin)])
def create_resource(body: ResourceWrite, response: Response, db: Session = Depends(get_db, scope="function")):
    payload = service.create_resource(db, body)
    response.headers["Location"] = f"/api/resources/{payload['id']}"
    return payload


@router.patch("/{resource_id}", response_model=ResourceOut, dependencies=[Depends(require_admin)])
def patch_resource(resource_id: int, body: ResourcePatch, db: Session = Depends(get_db, scope="function")):
    return service.patch_resource(db, resource_id, body)


@router.delete("/{resource_id}", dependencies=[Depends(require_admin)])
def delete_resource(resource_id: int, db: Session = Depends(get_db, scope="function")):
    service.delete_resource(db, resource_id)
    return RawResponse(status_code=204)
