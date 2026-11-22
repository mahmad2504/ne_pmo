from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse
from sqlalchemy.orm import Session

from app.auth import require_admin, require_reader
from app.database import get_db
from app.schemas import TagCreate, TagOut, TagPatch
from app.services import tags as service

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut], dependencies=[Depends(require_reader)])
def list_tags(db: Session = Depends(get_db)):
    return service.list_tags(db)


@router.post("", status_code=201, response_model=TagOut, dependencies=[Depends(require_admin)])
def create_tag(body: TagCreate, response: Response, db: Session = Depends(get_db)):
    payload = service.create_tag(db, body)
    response.headers["Location"] = f"/api/tags/{payload['id']}"
    return payload


@router.patch("/{tag_id}", response_model=TagOut, dependencies=[Depends(require_admin)])
def patch_tag(tag_id: int, body: TagPatch, db: Session = Depends(get_db)):
    return service.patch_tag(db, tag_id, body)


@router.delete("/{tag_id}", dependencies=[Depends(require_admin)])
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    service.delete_tag(db, tag_id)
    return RawResponse(status_code=204)
