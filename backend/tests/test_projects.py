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


def test_a_project_can_sit_in_several_views(client):
    alpha = create_project(client, name="Alpha")
    beta = create_project(client, name="Beta")
    chips = client.post("/api/project-groups", json={"name": "Chips", "description": "Silicon"})
    radio = client.post("/api/project-groups", json={"name": "Radio"})
    labs = client.post("/api/project-groups", json={"name": "Labs"})
    assert chips.status_code == 201, chips.text
    chips_id = chips.json()["id"]
    radio_id = radio.json()["id"]
    labs_id = labs.json()["id"]

    duplicate = client.post("/api/project-groups", json={"name": "chips"})
    assert duplicate.status_code == 409

    placed = client.put(
        f"/api/projects/{alpha['id']}/groups",
        json={"group_ids": [radio_id, chips_id]},
    )
    assert placed.status_code == 200, placed.text
    assert [group["name"] for group in placed.json()["groups"]] == ["Chips", "Radio"]

    created = create_project(client, name="Gamma", group_ids=[chips_id])
    assert [group["name"] for group in created["groups"]] == ["Chips"]

    in_chips = client.get("/api/projects", params={"group_id": chips_id})
    in_radio = client.get("/api/projects", params={"group_id": radio_id})
    assert {row["name"] for row in in_chips.json()} == {"Gamma", "Alpha"}
    assert [row["name"] for row in in_radio.json()] == ["Alpha"]

    moved = client.post(
        f"/api/projects/{alpha['id']}/groups/move",
        json={"from_group_id": chips_id, "to_group_id": labs_id},
    )
    assert moved.status_code == 200, moved.text
    assert [group["name"] for group in moved.json()["groups"]] == ["Radio", "Labs"]
    assert [row["name"] for row in client.get("/api/projects", params={"group_id": chips_id}).json()] == ["Gamma"]
    assert [row["name"] for row in client.get("/api/projects", params={"group_id": labs_id}).json()] == ["Alpha"]

    missing = client.post(
        f"/api/projects/{beta['id']}/groups/move",
        json={"from_group_id": chips_id, "to_group_id": labs_id},
    )
    assert missing.status_code == 404

    cleared = client.put(f"/api/projects/{alpha['id']}/groups", json={"group_ids": []})
    assert cleared.status_code == 200
    assert cleared.json()["groups"] == []
    assert client.get(f"/api/projects/{alpha['id']}").status_code == 200
    ungrouped = client.get("/api/projects", params={"ungrouped": True})
    assert "Alpha" in [row["name"] for row in ungrouped.json()]
    assert "Gamma" not in [row["name"] for row in ungrouped.json()]

    assert client.delete(f"/api/project-groups/{chips_id}").status_code == 204
    gamma = client.get(f"/api/projects/{created['id']}")
    assert gamma.status_code == 200
    assert gamma.json()["groups"] == []

    both = client.get("/api/projects", params={"group_id": labs_id, "ungrouped": True})
    assert both.status_code == 422
    assert client.get("/api/projects", params={"group_id": 9999}).status_code == 404

    client.set_roles(["user"])
    assert client.get("/api/project-groups").status_code == 200
    assert client.post("/api/project-groups", json={"name": "Nope"}).status_code == 403
    forbidden = client.put(f"/api/projects/{beta['id']}/groups", json={"group_ids": [labs_id]})
    assert forbidden.status_code == 403
    forbidden_move = client.post(
        f"/api/projects/{beta['id']}/groups/move",
        json={"from_group_id": labs_id, "to_group_id": radio_id},
    )
    assert forbidden_move.status_code == 403


def test_project_list_skips_assignment_graphs(client):
    department = create_department(client)
    person = create_person(client, name="Ada", email="ada@example.com", department_id=department["id"])
    project = create_project(client, name="Nimbus")
    assigned = client.post(f"/api/projects/{project['id']}/resources", json={"resource_id": person["id"]})
    assert assigned.status_code == 200

    listed = client.get("/api/projects")
    assert listed.status_code == 200
    row = next(item for item in listed.json() if item["id"] == project["id"])
    assert row["resource_count"] == 1
    assert row["assignment_count"] == 1
    assert "assignments" not in row
    assert "contributions" not in row

    detail = client.get(f"/api/projects/{project['id']}")
    assert detail.status_code == 200
    assert [item["resource_id"] for item in detail.json()["assignments"]] == [person["id"]]
    assert detail.json()["contributions"] == []


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
