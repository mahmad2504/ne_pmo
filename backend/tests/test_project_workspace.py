from tests.conftest import create_company, create_department, create_person, create_project


def _label(client, name="Hot", title="Hot item"):
    response = client.post("/api/tags", json={"name": name, "title": title})
    assert response.status_code == 201, response.text
    return response.json()


def test_cadence_labels_and_archive(client):
    label = _label(client, name="rtl", title="RTL")
    project = create_project(client, name="Nimbus")
    assert project["archived"] is False
    assert project["reports_with_pmo"] is False
    assert project["report_cadence_days"] is None
    assert project["resource_count"] == 0
    assert project["tags"] == []

    updated = client.patch(
        f"/api/projects/{project['id']}",
        json={"report_cadence_days": 7, "reports_with_pmo": True, "tags": ["RTL"]},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["report_cadence_days"] == 7
    assert body["reports_with_pmo"] is True
    assert body["tags"][0]["id"] == label["id"]
    assert body["tags"][0]["name"] == "rtl"

    missing = client.patch(f"/api/projects/{project['id']}", json={"tags": ["nope"]})
    assert missing.status_code == 404

    too_soon = client.post(f"/api/projects/{project['id']}/archive")
    assert too_soon.status_code == 422

    completed = client.patch(f"/api/projects/{project['id']}", json={"status": "completed"})
    assert completed.status_code == 200
    archived = client.post(f"/api/projects/{project['id']}/archive")
    assert archived.status_code == 200, archived.text
    assert archived.json()["archived"] is True

    live = client.get("/api/projects")
    assert project["id"] not in [row["id"] for row in live.json()]
    stored = client.get("/api/projects", params={"archived": True})
    assert [row["name"] for row in stored.json()] == ["Nimbus"]
    by_label = client.get("/api/projects", params={"archived": True, "tag_id": label["id"]})
    assert [row["name"] for row in by_label.json()] == ["Nimbus"]

    reopen = client.patch(f"/api/projects/{project['id']}", json={"status": "in_progress"})
    assert reopen.status_code == 422

    restored = client.post(f"/api/projects/{project['id']}/unarchive")
    assert restored.status_code == 200
    assert restored.json()["archived"] is False
    assert client.get("/api/projects").json()[0]["name"] == "Nimbus"

    cleared = client.patch(f"/api/projects/{project['id']}", json={"report_cadence_days": None, "tags": []})
    assert cleared.status_code == 200
    assert cleared.json()["report_cadence_days"] is None
    assert cleared.json()["tags"] == []


def test_utilization_and_recorded_contribution(client):
    department = create_department(client)
    ada = create_person(client, name="Ada", email="ada@example.com", department_id=department["id"])
    project = create_project(client, name="Nimbus")
    other = create_project(client, name="Other")

    assigned = client.post(
        f"/api/projects/{project['id']}/resources",
        json={"resource_id": ada["id"], "utilization_percent": 40, "onboarded": True, "project_role": "lead"},
    )
    assert assigned.status_code == 200, assigned.text
    row = assigned.json()["assignments"][0]
    assert row["utilization_percent"] == 40
    assert row["onboarded"] is True
    assert row["project_role"] == "lead"
    assert row["started_at"]

    changed = client.patch(
        f"/api/projects/{project['id']}/resources/{ada['id']}",
        json={"utilization_percent": 25},
    )
    assert changed.status_code == 200
    assert changed.json()["assignments"][0]["utilization_percent"] == 25
    assert changed.json()["assignments"][0]["project_role"] == "lead"

    recorded = client.post(
        f"/api/projects/{project['id']}/resources/{ada['id']}/move",
        json={
            "unassigned": True,
            "started_at": "2026-01-01T00:00:00Z",
            "ended_at": "2026-02-01T00:00:00Z",
            "highlights": "  Brought up the block  ",
        },
    )
    assert recorded.status_code == 200, recorded.text
    body = recorded.json()
    assert body["assignments"] == []
    assert body["contributions"][0]["name"] == "Ada"
    assert body["contributions"][0]["utilization_percent"] == 25
    assert body["contributions"][0]["highlights"] == "Brought up the block"
    contribution_id = body["contributions"][0]["id"]

    edited = client.patch(
        f"/api/projects/{project['id']}/contributions/{contribution_id}",
        json={"highlights": "Closed the block", "project_role": "member"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["contributions"][0]["highlights"] == "Closed the block"
    assert edited.json()["contributions"][0]["project_role"] == "member"

    backwards = client.patch(
        f"/api/projects/{project['id']}/contributions/{contribution_id}",
        json={"ended_at": "2025-01-01T00:00:00Z"},
    )
    assert backwards.status_code == 422

    client.post(
        f"/api/projects/{project['id']}/resources",
        json={"resource_id": ada["id"], "utilization_percent": 10},
    )
    moved = client.post(
        f"/api/projects/{project['id']}/resources/{ada['id']}/move",
        json={"to_project_id": other["id"]},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["assignments"] == []
    destination = client.get(f"/api/projects/{other['id']}").json()
    assert destination["assignments"][0]["resource_id"] == ada["id"]
    assert destination["assignments"][0]["utilization_percent"] == 10

    removed = client.delete(f"/api/projects/{project['id']}/contributions/{contribution_id}")
    assert removed.status_code == 200
    assert contribution_id not in [row["id"] for row in removed.json()["contributions"]]


def test_assignment_lists_companies_and_project_count(client):
    department = create_department(client)
    arm = create_company(client, name="ARM")
    ada = create_person(
        client,
        name="Ada",
        email="ada@example.com",
        department_id=department["id"],
        company_ids=[arm["id"]],
    )
    first = create_project(client, name="Nimbus")
    second = create_project(client, name="Other")
    for project in (first, second):
        assigned = client.post(
            f"/api/projects/{project['id']}/resources",
            json={"resource_id": ada["id"]},
        )
        assert assigned.status_code == 200, assigned.text

    for project in (first, second):
        row = client.get(f"/api/projects/{project['id']}").json()["assignments"][0]
        assert row["project_count"] == 2
        assert row["companies"] == [{"name": "ARM", "icon": None}]


def test_status_reports(client):
    project = create_project(client, name="Nimbus")
    empty = client.get(f"/api/projects/{project['id']}/status-reports")
    assert empty.status_code == 200
    assert empty.json() == {"items": [], "total": 0, "latest_report_at": None}

    created = client.post(
        f"/api/projects/{project['id']}/status-reports",
        json={"body": "<p>On track</p><script>alert(1)</script>", "flag": "risk"},
    )
    assert created.status_code == 201, created.text
    report = created.json()
    assert report["body"] == "<p>On track</p>"
    assert report["flag"] == "risk"
    assert "<script>" not in report["body"]

    blank = client.post(f"/api/projects/{project['id']}/status-reports", json={"body": "   "})
    assert blank.status_code == 422

    listed = client.get(f"/api/projects/{project['id']}/status-reports", params={"limit": 1})
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == report["id"]

    detail = client.get(f"/api/projects/{project['id']}").json()
    assert detail["status_report_count"] == 1
    assert detail["latest_report_at"] == report["created_at"]

    edited = client.patch(
        f"/api/projects/{project['id']}/status-reports/{report['id']}",
        json={"body": "Slipped a day", "flag": None},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["body"] == "Slipped a day"
    assert edited.json()["flag"] is None

    assert client.delete(f"/api/projects/{project['id']}/status-reports/{report['id']}").status_code == 204
    assert client.get(f"/api/projects/{project['id']}").json()["status_report_count"] == 0


def test_labels_are_a_catalog(client):
    first = _label(client, name="dv", title="Design verification")
    duplicate = client.post("/api/tags", json={"name": "DV", "title": "Again"})
    assert duplicate.status_code == 409
    renamed = client.patch(f"/api/tags/{first['id']}", json={"title": "DV work"})
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "DV work"

    project = create_project(client, name="Chip", tags=["dv"])
    assert project["tags"][0]["name"] == "dv"
    listed = client.get("/api/tags")
    assert listed.json()[0]["project_count"] == 1

    client.set_roles(["user"])
    assert client.get("/api/tags").status_code == 200
    assert client.post("/api/tags", json={"name": "x", "title": "X"}).status_code == 403
    assert client.post(f"/api/projects/{project['id']}/archive").status_code == 403

    client.set_roles(["admin", "user"])
    assert client.delete(f"/api/tags/{first['id']}").status_code == 204
    assert client.get(f"/api/projects/{project['id']}").json()["tags"] == []


def test_external_link(client):
    project = create_project(client, name="Nimbus", external_url="https://example.com/docs")
    assert project["external_url"] == "https://example.com/docs"
    listed = client.get("/api/projects")
    assert listed.status_code == 200
    assert listed.json()[0]["external_url"] == "https://example.com/docs"
    fetched = client.get(f"/api/projects/{project['id']}")
    assert fetched.json()["external_url"] == "https://example.com/docs"

    bare = client.patch(f"/api/projects/{project['id']}", json={"external_url": "example.com/board"})
    assert bare.status_code == 200, bare.text
    assert bare.json()["external_url"] == "https://example.com/board"

    cleared = client.patch(f"/api/projects/{project['id']}", json={"external_url": ""})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["external_url"] is None
    again = client.patch(f"/api/projects/{project['id']}", json={"external_url": "https://example.com/docs"})
    assert again.status_code == 200
    nulled = client.patch(f"/api/projects/{project['id']}", json={"external_url": None})
    assert nulled.status_code == 200
    assert nulled.json()["external_url"] is None

    rejected = client.patch(f"/api/projects/{project['id']}", json={"external_url": "javascript:alert(1)"})
    assert rejected.status_code == 422
