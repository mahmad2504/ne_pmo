import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def database_url() -> str:
    return os.environ.get("DATABASE_URL", "sqlite:///./pm.db")


def _enable_sqlite_fk(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_engine() -> Engine:
    global _engine, _session_factory
    if _engine is None:
        url = database_url()
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        _engine = create_engine(url, connect_args=connect_args)
        if url.startswith("sqlite"):
            from sqlalchemy import event

            event.listen(_engine, "connect", _enable_sqlite_fk)
        _session_factory = sessionmaker(
            bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
    return _engine


def session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _session_factory is not None
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """Yield a session, then commit.

    Callers must use ``Depends(get_db, scope="function")``. FastAPI's default
    request scope runs this commit after the response is sent, so the screen
    can refetch and still receive a company that was just deleted.
    """
    db = session_factory()()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def ensure_postgres_database() -> None:
    url = database_url()
    if not url.startswith("postgresql"):
        return
    from sqlalchemy.engine.url import make_url

    parsed = make_url(url)
    target = parsed.database
    if not target:
        return
    maintenance = os.environ.get("POSTGRES_DB", "postgres")
    import psycopg
    from psycopg import sql

    connection = psycopg.connect(
        host=parsed.host or "localhost",
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        dbname=maintenance,
        autocommit=True,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target,))
            if cursor.fetchone() is None:
                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target)))
    finally:
        connection.close()


def _seed_companies() -> None:
    from sqlalchemy import func, select

    from app.models import Company

    db = session_factory()()
    try:
        for name in ("ARM", "Altera"):
            exists = db.scalar(select(Company.id).where(func.lower(Company.name) == name.lower()))
            if exists is None:
                db.add(Company(name=name))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _ensure_company_icon() -> None:
    from sqlalchemy import inspect, text

    engine = get_engine()
    inspector = inspect(engine)
    if "companies" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("companies")}
    if "icon" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE companies ADD COLUMN icon TEXT"))


def _column_names(table: str) -> set[str] | None:
    from sqlalchemy import inspect

    inspector = inspect(get_engine())
    if table not in inspector.get_table_names():
        return None
    return {column["name"] for column in inspector.get_columns(table)}


def _ensure_project_workspace() -> None:
    from sqlalchemy import text

    engine = get_engine()
    boolean = (
        "BOOLEAN NOT NULL DEFAULT false"
        if engine.dialect.name == "postgresql"
        else "BOOLEAN NOT NULL DEFAULT 0"
    )
    timestamp = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "DATETIME"
    statements: list[str] = []
    projects = _column_names("projects")
    if projects is not None:
        if "archived" not in projects:
            statements.append(f"ALTER TABLE projects ADD COLUMN archived {boolean}")
        if "reports_with_pmo" not in projects:
            statements.append(f"ALTER TABLE projects ADD COLUMN reports_with_pmo {boolean}")
        if "report_cadence_days" not in projects:
            statements.append("ALTER TABLE projects ADD COLUMN report_cadence_days INTEGER")
        if "external_url" not in projects:
            statements.append("ALTER TABLE projects ADD COLUMN external_url VARCHAR(2048)")
    assignments = _column_names("project_resources")
    if assignments is not None:
        if "utilization_percent" not in assignments:
            statements.append(
                "ALTER TABLE project_resources ADD COLUMN utilization_percent INTEGER NOT NULL DEFAULT 100"
            )
        if "onboarded" not in assignments:
            statements.append(f"ALTER TABLE project_resources ADD COLUMN onboarded {boolean}")
        if "started_at" not in assignments:
            statements.append(f"ALTER TABLE project_resources ADD COLUMN started_at {timestamp}")
    if not statements and assignments is None:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if assignments is not None:
            connection.execute(
                text("UPDATE project_resources SET started_at = CURRENT_TIMESTAMP WHERE started_at IS NULL")
            )


def _ensure_view_sections() -> None:
    from sqlalchemy import inspect, text

    columns = _column_names("project_group_members")
    if columns is None:
        return
    engine = get_engine()
    if "section_id" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE project_group_members "
                    "ADD COLUMN section_id INTEGER REFERENCES project_group_sections(id) ON DELETE SET NULL"
                )
            )
    indexes = {index["name"] for index in inspect(engine).get_indexes("project_group_members")}
    if "ix_project_group_members_section_id" not in indexes:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_project_group_members_section_id "
                    "ON project_group_members (section_id)"
                )
            )


def _ensure_all_sections() -> None:
    from sqlalchemy import inspect, text

    columns = _column_names("projects")
    if columns is None:
        return
    engine = get_engine()
    if "section_id" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE projects "
                    "ADD COLUMN section_id INTEGER REFERENCES project_sections(id) ON DELETE SET NULL"
                )
            )
    indexes = {index["name"] for index in inspect(engine).get_indexes("projects")}
    if "ix_projects_section_id" not in indexes:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_projects_section_id ON projects (section_id)"
                )
            )


def _ensure_resource_company_email() -> None:
    from sqlalchemy import text

    columns = _column_names("resource_companies")
    if columns is None or "email" in columns:
        return
    with get_engine().begin() as connection:
        connection.execute(text("ALTER TABLE resource_companies ADD COLUMN email VARCHAR(255)"))


def _ensure_resource_resigned() -> None:
    from sqlalchemy import text

    columns = _column_names("resources")
    if columns is None or "resigned" in columns:
        return
    engine = get_engine()
    boolean = (
        "BOOLEAN NOT NULL DEFAULT false"
        if engine.dialect.name == "postgresql"
        else "BOOLEAN NOT NULL DEFAULT 0"
    )
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE resources ADD COLUMN resigned {boolean}"))


def init_db() -> None:
    ensure_postgres_database()
    Base.metadata.create_all(get_engine())
    _ensure_company_icon()
    _ensure_project_workspace()
    _ensure_view_sections()
    _ensure_all_sections()
    _ensure_resource_resigned()
    _ensure_resource_company_email()
    _seed_companies()
