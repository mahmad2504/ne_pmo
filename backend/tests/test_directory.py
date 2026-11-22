from tests.conftest import create_company, create_department, create_designation, create_person, create_project


def test_department_names_are_unique_ignoring_case(client):
    created = create_department(client, name="Engineering", description="  Chip design  ")
    assert created["description"] == "Chip design"
    conflict = client.post("/api/departments", json={"name": " engineering "})
    assert conflict.status_code == 409

    renamed = client.patch(f"/api/departments/{created['id']}", json={"name": "Hardware"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Hardware"


def test_department_delete_is_refused_while_people_remain(client):
    department = create_department(client, name="Software")
    create_person(client, department_id=department["id"], email="ada@example.com")
    blocked = client.delete(f"/api/departments/{department['id']}")
    assert blocked.status_code == 409
    assert "1 person" in blocked.json()["detail"]

    empty = create_department(client, name="Empty")
    assert client.delete(f"/api/departments/{empty['id']}").status_code == 204
    assert client.get("/api/departments").json()[0]["name"] == "Software"


def test_deleting_a_job_title_clears_it_on_people(client):
    department = create_department(client)
    title = create_designation(client, name="Senior engineer")
    person = create_person(
        client,
        department_id=department["id"],
        designation_id=title["id"],
        location="khi",
    )
    assert person["designation"]["name"] == "Senior engineer"
    assert person["location"] == "KHI"
    listed = client.get("/api/designations").json()
    assert listed[0]["resource_count"] == 1

    assert client.delete(f"/api/designations/{title['id']}").status_code == 204
    again = client.get(f"/api/resources/{person['id']}")
    assert again.status_code == 200
    assert again.json()["designation"] is None


def test_resource_filters_and_email_uniqueness(client):
    engineering = create_department(client, name="Engineering")
    operations = create_department(client, name="Operations")
    create_person(
        client,
        name="Ada Lovelace",
        email="Ada@Example.com",
        department_id=engineering["id"],
        location="ISB",
    )
    create_person(
        client,
        name="Grace Hopper",
        email="grace@example.com",
        department_id=operations["id"],
        location="LHR",
    )

    duplicate = client.post(
        "/api/resources",
        json={
            "name": "Other Ada",
            "email": "ada@example.com",
            "department_id": engineering["id"],
        },
    )
    assert duplicate.status_code == 409

    by_name = client.get("/api/resources", params={"q": "lovelace"})
    assert [row["name"] for row in by_name.json()] == ["Ada Lovelace"]
    assert by_name.json()[0]["email"] == "ada@example.com"

    by_department = client.get("/api/resources", params={"department_id": operations["id"]})
    assert [row["name"] for row in by_department.json()] == ["Grace Hopper"]

    by_location = client.get("/api/resources", params={"location": "isb"})
    assert [row["email"] for row in by_location.json()] == ["ada@example.com"]

    missing = client.post(
        "/api/resources",
        json={"name": "No Dept", "email": "nodept@example.com", "department_id": 9999},
    )
    assert missing.status_code == 400


def test_person_can_be_onboarded_with_several_companies(client):
    department = create_department(client)
    altera = create_company(client, name=" altera ", description="  FPGA  ")
    arm = create_company(client, name="ARM")
    assert altera["name"] == "altera"
    assert altera["description"] == "FPGA"
    conflict = client.post("/api/companies", json={"name": "arm"})
    assert conflict.status_code == 409

    person = create_person(
        client,
        department_id=department["id"],
        company_ids=[arm["id"], altera["id"], arm["id"]],
    )
    assert [company["name"] for company in person["companies"]] == ["altera", "ARM"]
    assert client.get("/api/companies").json()[0]["resource_count"] == 1

    kept = client.patch(f"/api/resources/{person['id']}", json={"name": "Ada Lovelace"})
    assert kept.status_code == 200
    assert [company["name"] for company in kept.json()["companies"]] == ["altera", "ARM"]

    both = client.get("/api/resources", params={"company_id": arm["id"]})
    assert [row["id"] for row in both.json()] == [person["id"]]

    cleared = client.patch(f"/api/resources/{person['id']}", json={"company_ids": []})
    assert cleared.status_code == 200
    assert cleared.json()["companies"] == []

    again = create_person(
        client,
        name="Grace",
        email="grace@example.com",
        department_id=department["id"],
        company_ids=[arm["id"], altera["id"]],
    )
    missing = client.post(
        "/api/resources",
        json={
            "name": "No Company",
            "email": "none@example.com",
            "department_id": department["id"],
            "company_ids": [9999],
        },
    )
    assert missing.status_code == 400

    assert client.delete(f"/api/companies/{altera['id']}").status_code == 204
    remaining = client.get(f"/api/resources/{again['id']}").json()
    assert [company["name"] for company in remaining["companies"]] == ["ARM"]
    assert client.get(f"/api/resources/{person['id']}").status_code == 200

    project = create_project(client)
    assigned = client.post(f"/api/projects/{project['id']}/resources", json={"resource_id": again["id"]})
    assert assigned.status_code == 200
    assert assigned.json()["assignments"][0]["companies"] == [{"name": "ARM", "icon": None}]


def test_company_icon_is_optional_and_must_be_an_image(client):
    icon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    created = client.post("/api/companies", json={"name": "Xilinx", "icon": icon})
    assert created.status_code == 201, created.text
    assert created.json()["icon"] == icon

    rejected = client.post("/api/companies", json={"name": "Other", "icon": "https://example.com/logo.png"})
    assert rejected.status_code == 422

    cleared = client.patch(f"/api/companies/{created.json()['id']}", json={"icon": ""})
    assert cleared.status_code == 200
    assert cleared.json()["icon"] is None


def test_reader_sees_directory_counts(client):
    department = create_department(client, name="Engineering")
    create_person(client, department_id=department["id"])
    client.set_roles(["user"])
    rows = client.get("/api/departments").json()
    assert rows[0]["resource_count"] == 1
