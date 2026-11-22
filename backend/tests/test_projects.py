from tests.conftest import create_department, create_person, create_project


def test_project_defaults_and_assignment_role(client):
    department = create_department(client)
    ada = create_person(client, name="Ada", email="ada@example.com", department_id=department["id"])
    grace = create_person(
        client, name="Grace", email="grace@example.com", department_id=department["id"]
    )

    project = create_project(client, name="Nimbus", description="  First chip  ")
    assert project["status"] == "assessment"
    assert project["description"] == "First chip"
    assert project["assignment_count"] == 0

    assigned = client.post(f"/api/projects/{project['id']}/resources", json={"resource_id": ada["id"]})
    assert assigned.status_code == 200, assigned.text
    body = assigned.json()
    assert body["assignments"][0]["project_role"] == "member"
    assert body["assignments"][0]["department_name"] == "Engineering"
    assert body["assignment_count"] == 1

    again = client.post(f"/api/projects/{project['id']}/resources", json={"resource_id": ada["id"]})
    assert again.status_code == 409

    lead = client.post(
        f"/api/projects/{project['id']}/resources",
        json={"resource_id": grace["id"], "project_role": "lead"},
    )
    assert lead.status_code == 200
    roles = {row["email"]: row["project_role"] for row in lead.json()["assignments"]}
    assert roles == {"ada@example.com": "member", "grace@example.com": "lead"}

    changed = client.patch(
        f"/api/projects/{project['id']}/resources/{grace['id']}",
        json={"project_role": "director"},
    )
    assert changed.status_code == 200
    director = next(row for row in changed.json()["assignments"] if row["resource_id"] == grace["id"])
    assert director["project_role"] == "director"

    removed = client.delete(f"/api/projects/{project['id']}/resources/{ada['id']}")
    assert removed.status_code == 200
    assert [row["resource_id"] for row in removed.json()["assignments"]] == [grace["id"]]

    person = client.get(f"/api/resources/{grace['id']}").json()
    assert person["assignments"] == [
        {"project_id": project["id"], "project_name": "Nimbus", "project_role": "director"}
    ]


def test_invalid_project_role_is_rejected(client):
    department = create_department(client)
    person = create_person(client, department_id=department["id"])
    project = create_project(client)
    response = client.post(
        f"/api/projects/{project['id']}/resources",
        json={"resource_id": person["id"], "project_role": "owner"},
    )
    assert response.status_code == 422


def test_project_search_update_and_delete(client):
    alpha = create_project(client, name="Alpha", description="Radio work")
    create_project(client, name="Beta")
    found = client.get("/api/projects", params={"q": "radio"})
    assert [row["name"] for row in found.json()] == ["Alpha"]

    updated = client.patch(
        f"/api/projects/{alpha['id']}",
        json={"status": "in_progress", "description": None},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"
    assert updated.json()["description"] is None

    assert client.delete(f"/api/projects/{alpha['id']}").status_code == 204
    assert client.get(f"/api/projects/{alpha['id']}").status_code == 404


def test_reader_cannot_change_an_assignment(client):
    department = create_department(client)
    person = create_person(client, department_id=department["id"])
    project = create_project(client)
    client.post(f"/api/projects/{project['id']}/resources", json={"resource_id": person["id"], "project_role": "lead"})

    client.set_roles(["user"])
    detail = client.get(f"/api/projects/{project['id']}")
    assert detail.status_code == 200
    assert detail.json()["assignments"][0]["project_role"] == "lead"
    forbidden = client.patch(
        f"/api/projects/{project['id']}/resources/{person['id']}",
        json={"project_role": "member"},
    )
    assert forbidden.status_code == 403
