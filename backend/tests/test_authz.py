from tests.conftest import create_department, create_person, create_project


def test_health_is_open(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_missing_token_is_rejected(client):
    app_overrides = client.app.dependency_overrides
    from app.auth import get_current_user

    app_overrides.pop(get_current_user, None)
    response = client.get("/api/departments")
    assert response.status_code == 401


def test_token_without_app_role_cannot_read(client):
    client.set_roles([])
    response = client.get("/api/resources")
    assert response.status_code == 403


def test_reader_can_list_and_cannot_write(client):
    department = create_department(client)
    person = create_person(client, department_id=department["id"])
    project = create_project(client)

    client.set_roles(["user"])
    assert client.get("/api/departments").status_code == 200
    assert client.get("/api/designations").status_code == 200
    assert client.get("/api/companies").status_code == 200
    assert client.get("/api/resources").status_code == 200
    assert client.get(f"/api/resources/{person['id']}").status_code == 200
    assert client.get("/api/projects").status_code == 200
    assert client.get(f"/api/projects/{project['id']}").status_code == 200
    assert client.get("/api/project-roles").status_code == 200
    assert client.get("/api/locations").status_code == 200

    assert client.post("/api/departments", json={"name": "Blocked"}).status_code == 403
    assert client.post("/api/designations", json={"name": "Blocked"}).status_code == 403
    assert client.post("/api/companies", json={"name": "Blocked"}).status_code == 403
    assert client.post(
        "/api/resources",
        json={"name": "No", "email": "no@example.com", "department_id": department["id"]},
    ).status_code == 403
    assert client.patch(f"/api/resources/{person['id']}", json={"name": "Changed"}).status_code == 403
    assert client.delete(f"/api/resources/{person['id']}").status_code == 403
    assert client.post("/api/projects", json={"name": "Blocked"}).status_code == 403
    assert client.patch(f"/api/projects/{project['id']}", json={"name": "Changed"}).status_code == 403
    assert client.delete(f"/api/projects/{project['id']}").status_code == 403
    assert client.post(
        f"/api/projects/{project['id']}/resources",
        json={"resource_id": person["id"]},
    ).status_code == 403


def test_admin_without_user_role_can_read_and_write(client):
    client.set_roles(["admin"])
    response = client.post("/api/departments", json={"name": "Platform"})
    assert response.status_code == 201
    assert client.get("/api/departments").status_code == 200
