import os

os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user
from app.database import get_db
from app.main import app
from app.models import Base


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    def override_db():
        db = factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def set_roles(roles: list[str]):
        payload = {"sub": "test", "roles": list(roles)}
        app.dependency_overrides[get_current_user] = lambda: payload

    app.dependency_overrides[get_db] = override_db
    set_roles(["admin", "user"])
    with TestClient(app) as test_client:
        test_client.set_roles = set_roles
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def create_department(client, name="Engineering", description=None):
    response = client.post("/api/departments", json={"name": name, "description": description})
    assert response.status_code == 201, response.text
    return response.json()


def create_company(client, name="ARM", description=None):
    response = client.post("/api/companies", json={"name": name, "description": description})
    assert response.status_code == 201, response.text
    return response.json()


def create_designation(client, name="Software engineer", description=None):
    response = client.post("/api/designations", json={"name": name, "description": description})
    assert response.status_code == 201, response.text
    return response.json()


def create_person(client, name="Ada", email="ada@example.com", department_id=None, **extra):
    if department_id is None:
        department_id = create_department(client)["id"]
    response = client.post(
        "/api/resources",
        json={"name": name, "email": email, "department_id": department_id, **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_project(client, name="Alpha", **extra):
    response = client.post("/api/projects", json={"name": name, **extra})
    assert response.status_code == 201, response.text
    return response.json()
