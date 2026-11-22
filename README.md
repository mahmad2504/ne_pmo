# NE PM Tool

People directory and basic projects. The browser loads one React app. Sign-in is Keycloak. The API stores data in Postgres through `DATABASE_URL`, so the database can live on another host.

A signed-in `user` can read. An `admin` can also create, edit, and delete. A project role (Lead, Member, and the others) is stored on the assignment and does not grant extra rights.

## Run

Docker Desktop is required. The first Keycloak setup also needs Node.js on the host.

```powershell
docker compose up -d
```

Wait until the services are healthy, then create the realm:

```powershell
docker compose ps
cd test_example
npm run setup
```

| URL | What it is |
| --- | --- |
| http://localhost:5174 | The app. Passwords are entered on the Keycloak page. |
| http://localhost:8001/docs | API docs |
| http://localhost:8082/admin | Keycloak admin console (`admin` / `admin`) |

| User | Password | Roles |
| --- | --- | --- |
| alice | alice123 | user |
| bob | bob123 | user, admin |

`npm run setup` is safe to run again.

Ports 5174, 8001, and 8082 match a local PM stack. Stop that other stack first if it is already using them.

## Tests

```powershell
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest
```

Tests use an in-memory database. They do not need Docker.
