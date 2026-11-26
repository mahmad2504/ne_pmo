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


def test_project_list_filters_by_resource(client):
    department = create_department(client)
    ada = create_person(client, name="Ada", email="ada@example.com", department_id=department["id"])
    grace = create_person(
        client, name="Grace", email="grace@example.com", department_id=department["id"]
    )
    active = create_project(client, name="Nimbus")
    stored = create_project(client, name="Orbit")
    other = create_project(client, name="Relay")
    assert client.post(f"/api/projects/{active['id']}/resources", json={"resource_id": ada["id"]}).status_code == 200
    assert client.post(f"/api/projects/{stored['id']}/resources", json={"resource_id": ada["id"]}).status_code == 200
    assert client.post(f"/api/projects/{other['id']}/resources", json={"resource_id": grace["id"]}).status_code == 200

    completed = client.patch(f"/api/projects/{stored['id']}", json={"status": "completed"})
    assert completed.status_code == 200
    archived = client.post(f"/api/projects/{stored['id']}/archive")
    assert archived.status_code == 200

    listed = client.get("/api/projects", params={"resource_id": ada["id"]})
    assert listed.status_code == 200
    assert {row["name"] for row in listed.json()} == {"Nimbus", "Orbit"}
    orbit = next(row for row in listed.json() if row["name"] == "Orbit")
    assert orbit["archived"] is True

    open_list = client.get("/api/projects")
    assert "Orbit" not in {row["name"] for row in open_list.json()}
    assert "Relay" in {row["name"] for row in open_list.json()}

    missing = client.get("/api/projects", params={"resource_id": 9999})
    assert missing.status_code == 404


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


def test_resigned_person_stays_assigned_but_cannot_be_added(client):
    department = create_department(client)
    ada = create_person(client, name="Ada", email="ada@example.com", department_id=department["id"])
    grace = create_person(
        client, name="Grace", email="grace@example.com", department_id=department["id"]
    )
    assert ada["resigned"] is False

    listed = client.get("/api/resources")
    assert {row["name"] for row in listed.json()} == {"Ada", "Grace"}

    current = create_project(client, name="Nimbus")
    other = create_project(client, name="Orbit")
    assigned = client.post(f"/api/projects/{current['id']}/resources", json={"resource_id": ada["id"]})
    assert assigned.status_code == 200

    resigned = client.patch(f"/api/resources/{ada['id']}", json={"resigned": True})
    assert resigned.status_code == 200
    assert resigned.json()["resigned"] is True
    assert resigned.json()["assignments"][0]["project_id"] == current["id"]

    hidden = client.get("/api/resources")
    assert [row["name"] for row in hidden.json()] == ["Grace"]
    shown = client.get("/api/resources", params={"include_resigned": True})
    assert {row["name"] for row in shown.json()} == {"Ada", "Grace"}
    only = client.get("/api/resources", params={"resigned_only": True})
    assert [row["name"] for row in only.json()] == ["Ada"]
    both = client.get("/api/resources", params={"include_resigned": True, "resigned_only": True})
    assert [row["name"] for row in both.json()] == ["Ada"]

    still = client.get(f"/api/projects/{current['id']}")
    assert still.json()["assignments"][0]["resource_id"] == ada["id"]
    assert still.json()["assignments"][0]["resigned"] is True
    assert still.json()["resource_count"] == 0
    assert still.json()["assignment_count"] == 0
    listed_projects = client.get("/api/projects")
    nimbus = next(item for item in listed_projects.json() if item["id"] == current["id"])
    assert nimbus["resource_count"] == 0
    assert nimbus["assignment_count"] == 0

    active = client.post(f"/api/projects/{current['id']}/resources", json={"resource_id": grace["id"]})
    assert active.status_code == 200
    with_grace = active.json()
    assert with_grace["resource_count"] == 1
    assert with_grace["assignment_count"] == 1
    assert {row["resource_id"] for row in with_grace["assignments"]} == {ada["id"], grace["id"]}
    assert next(row for row in with_grace["assignments"] if row["resource_id"] == ada["id"])["resigned"] is True

    blocked = client.post(f"/api/projects/{other['id']}/resources", json={"resource_id": ada["id"]})
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "That person has resigned"

    moved = client.post(
        f"/api/projects/{current['id']}/resources/{ada['id']}/move",
        json={"to_project_id": other["id"]},
    )
    assert moved.status_code == 409
    assert client.get(f"/api/projects/{current['id']}").json()["assignments"][0]["resource_id"] == ada["id"]

    kept = client.patch(
        f"/api/projects/{current['id']}/resources/{ada['id']}",
        json={"utilization_percent": 40},
    )
    assert kept.status_code == 200
    assert kept.json()["assignments"][0]["utilization_percent"] == 40

    cleared = client.patch(f"/api/resources/{ada['id']}", json={"resigned": False})
    assert cleared.status_code == 200
    empty = client.get("/api/resources", params={"resigned_only": True})
    assert empty.json() == []
    added = client.post(f"/api/projects/{other['id']}/resources", json={"resource_id": ada["id"]})
    assert added.status_code == 200
    assert {row["resource_id"] for row in added.json()["assignments"]} == {ada["id"]}
    assert grace["id"] not in {row["resource_id"] for row in added.json()["assignments"]}


def test_multi_project_filter_keeps_people_on_more_than_one_project(client):
    department = create_department(client)
    shared = create_person(client, name="Ada", email="ada@example.com", department_id=department["id"])
    single = create_person(
        client, name="Grace", email="grace@example.com", department_id=department["id"]
    )
    create_person(client, name="Lin", email="lin@example.com", department_id=department["id"])
    nimbus = create_project(client, name="Nimbus")
    orbit = create_project(client, name="Orbit")

    assert client.post(
        f"/api/projects/{nimbus['id']}/resources", json={"resource_id": shared["id"]}
    ).status_code == 200
    assert client.post(
        f"/api/projects/{orbit['id']}/resources", json={"resource_id": shared["id"]}
    ).status_code == 200
    assert client.post(
        f"/api/projects/{nimbus['id']}/resources", json={"resource_id": single["id"]}
    ).status_code == 200

    everyone = client.get("/api/resources")
    assert {row["name"] for row in everyone.json()} == {"Ada", "Grace", "Lin"}

    multiple = client.get("/api/resources", params={"project_count": "multiple"})
    assert multiple.status_code == 200
    assert [row["name"] for row in multiple.json()] == ["Ada"]
    assert len(multiple.json()[0]["assignments"]) == 2

    one = client.get("/api/resources", params={"project_count": "single"})
    assert [row["name"] for row in one.json()] == ["Grace"]
    assert len(one.json()[0]["assignments"]) == 1

    none = client.get("/api/resources", params={"project_count": "none"})
    assert [row["name"] for row in none.json()] == ["Lin"]
    assert none.json()[0]["assignments"] == []

    invalid = client.get("/api/resources", params={"project_count": "many"})
    assert invalid.status_code == 422


def _group_by_name(payload):
    return {row["name"]: row for row in payload["groups"]}


def test_a_view_can_group_projects_into_sections(client):
    alpha = create_project(client, name="Alpha")
    beta = create_project(client, name="Beta")
    chips = client.post("/api/project-groups", json={"name": "Chips"}).json()
    radio = client.post("/api/project-groups", json={"name": "Radio"}).json()
    placed = client.put(
        f"/api/projects/{alpha['id']}/groups",
        json={"group_ids": [chips["id"], radio["id"]]},
    )
    assert placed.status_code == 200

    assert client.post("/api/project-groups/9999/sections", json={"name": "Bring-up"}).status_code == 404

    first = client.post(f"/api/project-groups/{chips['id']}/sections", json={"name": "  Bring-up  "})
    assert first.status_code == 201, first.text
    bringup = first.json()
    assert bringup["name"] == "Bring-up"
    assert bringup["group_id"] == chips["id"]
    assert bringup["position"] == 0

    duplicate = client.post(f"/api/project-groups/{chips['id']}/sections", json={"name": "bring-up"})
    assert duplicate.status_code == 409

    other_view = client.post(f"/api/project-groups/{radio['id']}/sections", json={"name": "Bring-up"})
    assert other_view.status_code == 201, other_view.text
    radio_section = other_view.json()

    second = client.post(f"/api/project-groups/{chips['id']}/sections", json={"name": "Tapeout"})
    assert second.status_code == 201, second.text
    tapeout = second.json()
    assert tapeout["position"] == 1
    listed = client.get(f"/api/project-groups/{chips['id']}/sections")
    assert [row["name"] for row in listed.json()] == ["Bring-up", "Tapeout"]

    moved = client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": bringup["id"]},
    )
    assert moved.status_code == 200, moved.text
    groups = _group_by_name(moved.json())
    assert groups["Chips"]["section_id"] == bringup["id"]
    assert groups["Chips"]["section_name"] == "Bring-up"
    assert groups["Radio"]["section_id"] is None
    assert groups["Radio"]["section_name"] is None

    kept = client.put(
        f"/api/projects/{alpha['id']}/groups",
        json={"group_ids": [radio["id"], chips["id"]]},
    )
    assert kept.status_code == 200
    assert _group_by_name(kept.json())["Chips"]["section_id"] == bringup["id"]

    in_chips = client.get("/api/projects", params={"group_id": chips["id"]})
    listed_groups = _group_by_name(in_chips.json()[0])
    assert listed_groups["Chips"]["section_name"] == "Bring-up"
    assert listed_groups["Radio"]["section_id"] is None

    foreign = client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": radio_section["id"]},
    )
    assert foreign.status_code == 404

    shifted = client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": tapeout["id"]},
    )
    assert shifted.status_code == 200, shifted.text
    assert _group_by_name(shifted.json())["Chips"]["section_name"] == "Tapeout"

    cleared = client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": None},
    )
    assert cleared.status_code == 200, cleared.text
    assert _group_by_name(cleared.json())["Chips"]["section_id"] is None

    restored = client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": bringup["id"]},
    )
    assert restored.status_code == 200
    assert client.delete(f"/api/project-groups/{chips['id']}/sections/{bringup['id']}").status_code == 204
    after = client.get(f"/api/projects/{alpha['id']}")
    assert after.status_code == 200
    assert {row["name"] for row in after.json()["groups"]} == {"Chips", "Radio"}
    assert _group_by_name(after.json())["Chips"]["section_id"] is None
    remaining = client.get(f"/api/project-groups/{chips['id']}/sections")
    assert [row["name"] for row in remaining.json()] == ["Tapeout"]

    renamed = client.patch(
        f"/api/project-groups/{chips['id']}/sections/{tapeout['id']}",
        json={"name": "Silicon"},
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Silicon"
    assert client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": 9999},
    ).status_code == 404
    assert client.patch(
        f"/api/projects/{beta['id']}/groups/{chips['id']}",
        json={"section_id": tapeout["id"]},
    ).status_code == 404

    client.set_roles(["user"])
    assert client.get(f"/api/project-groups/{chips['id']}/sections").status_code == 200
    assert client.post(
        f"/api/project-groups/{chips['id']}/sections",
        json={"name": "Nope"},
    ).status_code == 403
    forbidden = client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": None},
    )
    assert forbidden.status_code == 403


def test_all_sections_are_separate_from_view_sections(client):
    alpha = create_project(client, name="Alpha")
    chips = client.post("/api/project-groups", json={"name": "Chips"}).json()
    view_section = client.post(f"/api/project-groups/{chips['id']}/sections", json={"name": "Bring-up"})
    assert view_section.status_code == 201, view_section.text
    placed = client.put(f"/api/projects/{alpha['id']}/groups", json={"group_ids": [chips["id"]]})
    assert placed.status_code == 200
    in_view = client.patch(
        f"/api/projects/{alpha['id']}/groups/{chips['id']}",
        json={"section_id": view_section.json()["id"]},
    )
    assert in_view.status_code == 200

    first = client.post("/api/project-sections", json={"name": "  Bring-up  "})
    assert first.status_code == 201, first.text
    active = first.json()
    assert active["name"] == "Bring-up"
    assert active["position"] == 0
    assert client.post("/api/project-sections", json={"name": "bring-up"}).status_code == 409

    second = client.post("/api/project-sections", json={"name": "Hold"})
    assert second.status_code == 201, second.text
    hold = second.json()
    assert hold["position"] == 1
    listed = client.get("/api/project-sections")
    assert [row["name"] for row in listed.json()] == ["Bring-up", "Hold"]

    moved = client.patch(f"/api/projects/{alpha['id']}/section", json={"section_id": active["id"]})
    assert moved.status_code == 200, moved.text
    assert moved.json()["section_id"] == active["id"]
    assert moved.json()["section_name"] == "Bring-up"
    chips_group = next(row for row in moved.json()["groups"] if row["name"] == "Chips")
    assert chips_group["section_id"] == view_section.json()["id"]
    assert chips_group["section_name"] == "Bring-up"

    on_all = client.get("/api/projects")
    listed_alpha = next(row for row in on_all.json() if row["name"] == "Alpha")
    assert listed_alpha["section_name"] == "Bring-up"

    shifted = client.patch(f"/api/projects/{alpha['id']}/section", json={"section_id": hold["id"]})
    assert shifted.status_code == 200, shifted.text
    assert shifted.json()["section_name"] == "Hold"
    still_view = next(row for row in shifted.json()["groups"] if row["name"] == "Chips")
    assert still_view["section_name"] == "Bring-up"

    cleared = client.patch(f"/api/projects/{alpha['id']}/section", json={"section_id": None})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["section_id"] is None
    assert cleared.json()["section_name"] is None

    restored = client.patch(f"/api/projects/{alpha['id']}/section", json={"section_id": active["id"]})
    assert restored.status_code == 200
    assert client.delete(f"/api/project-sections/{active['id']}").status_code == 204
    after = client.get(f"/api/projects/{alpha['id']}")
    assert after.status_code == 200
    assert after.json()["section_id"] is None
    assert next(row for row in after.json()["groups"] if row["name"] == "Chips")["section_name"] == "Bring-up"
    assert [row["name"] for row in client.get("/api/project-sections").json()] == ["Hold"]

    assert client.patch(
        f"/api/projects/{alpha['id']}/section",
        json={"section_id": 9999},
    ).status_code == 404

    client.set_roles(["user"])
    assert client.get("/api/project-sections").status_code == 200
    assert client.post("/api/project-sections", json={"name": "Nope"}).status_code == 403
    assert client.patch(
        f"/api/projects/{alpha['id']}/section",
        json={"section_id": None},
    ).status_code == 403
