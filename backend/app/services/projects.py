from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.clock import as_utc, utcnow
from app.errors import AppError
from app.models import (
    Project,
    ProjectContribution,
    ProjectGroup,
    ProjectGroupMember,
    ProjectGroupSection,
    ProjectResource,
    ProjectSection,
    ProjectStatusReport,
    ProjectTag,
    Resource,
    ResourceCompany,
    Tag,
)
from app.roles import ProjectRole
from app.schemas import (
    AssignmentPatch,
    AssignmentWrite,
    ContributionPatch,
    MoveAssignment,
    ProjectPatch,
    ProjectWrite,
    StatusReportCreate,
    StatusReportPatch,
)
from app.services.tags import set_project_tags


def _require_project(db: Session, project_id: int) -> Project:
    row = db.get(Project, project_id)
    if row is None:
        raise AppError(404, "Project not found")
    return row


def _person_options():
    return (
        joinedload(Resource.department),
        joinedload(Resource.designation),
        joinedload(Resource.company_links).joinedload(ResourceCompany.company),
    )


def _companies(person: Resource) -> list[dict]:
    links = sorted(
        person.company_links,
        key=lambda link: (link.company.name.lower(), link.company.id),
    )
    return [
        {"name": link.company.name, "icon": link.company.icon, "email": link.email}
        for link in links
    ]


def _person_fields(person: Resource) -> dict:
    return {
        "resource_id": person.id,
        "name": person.name,
        "email": person.email,
        "department_name": person.department.name,
        "designation_name": None if person.designation is None else person.designation.name,
        "companies": _companies(person),
        "resigned": person.resigned,
    }


def _require_resource(db: Session, resource_id: int) -> Resource:
    row = db.scalar(select(Resource).options(*_person_options()).where(Resource.id == resource_id))
    if row is None:
        raise AppError(404, "Person not found")
    return row


def _resource_project_counts(db: Session, resource_ids: list[int]) -> dict[int, int]:
    if not resource_ids:
        return {}
    rows = db.execute(
        select(ProjectResource.resource_id, func.count())
        .where(ProjectResource.resource_id.in_(resource_ids))
        .group_by(ProjectResource.resource_id)
    ).all()
    return {resource_id: int(count) for resource_id, count in rows}


def _assignment_rows(db: Session, project_id: int) -> list[ProjectResource]:
    return list(
        db.scalars(
            select(ProjectResource)
            .options(
                joinedload(ProjectResource.resource).joinedload(Resource.department),
                joinedload(ProjectResource.resource).joinedload(Resource.designation),
                joinedload(ProjectResource.resource)
                .joinedload(Resource.company_links)
                .joinedload(ResourceCompany.company),
            )
            .where(ProjectResource.project_id == project_id)
            .join(Resource, Resource.id == ProjectResource.resource_id)
            .order_by(func.lower(Resource.name), Resource.id)
        ).unique().all()
    )


def _require_groups(db: Session, group_ids: list[int]) -> None:
    if not group_ids:
        return
    found = set(db.scalars(select(ProjectGroup.id).where(ProjectGroup.id.in_(group_ids))).all())
    if found != set(group_ids):
        raise AppError(404, "View not found")


def _group_map(db: Session, project_ids: list[int]) -> dict[int, list[dict]]:
    result = {project_id: [] for project_id in project_ids}
    if not project_ids:
        return result
    rows = db.execute(
        select(
            ProjectGroupMember.project_id,
            ProjectGroup.id,
            ProjectGroup.name,
            ProjectGroupMember.section_id,
            ProjectGroupSection.name,
        )
        .join(ProjectGroup, ProjectGroup.id == ProjectGroupMember.group_id)
        .outerjoin(ProjectGroupSection, ProjectGroupSection.id == ProjectGroupMember.section_id)
        .where(ProjectGroupMember.project_id.in_(project_ids))
        .order_by(ProjectGroup.position, func.lower(ProjectGroup.name), ProjectGroup.id)
    ).all()
    for project_id, group_id, name, section_id, section_name in rows:
        result[project_id].append(
            {
                "id": group_id,
                "name": name,
                "section_id": section_id,
                "section_name": section_name,
            }
        )
    return result


def _tag_map(db: Session, project_ids: list[int]) -> dict[int, list[dict]]:
    result = {project_id: [] for project_id in project_ids}
    if not project_ids:
        return result
    rows = db.execute(
        select(ProjectTag.project_id, Tag.id, Tag.name, Tag.title, Tag.description)
        .join(Tag, Tag.id == ProjectTag.tag_id)
        .where(ProjectTag.project_id.in_(project_ids))
        .order_by(func.lower(Tag.name), Tag.id)
    ).all()
    for project_id, tag_id, name, title, description in rows:
        result[project_id].append(
            {"id": tag_id, "name": name, "title": title, "description": description}
        )
    return result


def _assignment_counts(db: Session, project_ids: list[int]) -> dict[int, int]:
    result = {project_id: 0 for project_id in project_ids}
    if not project_ids:
        return result
    rows = db.execute(
        select(ProjectResource.project_id, func.count(ProjectResource.resource_id))
        .join(Resource, Resource.id == ProjectResource.resource_id)
        .where(
            ProjectResource.project_id.in_(project_ids),
            Resource.resigned.is_(False),
        )
        .group_by(ProjectResource.project_id)
    ).all()
    for project_id, count in rows:
        result[project_id] = int(count)
    return result


def _report_stats(db: Session, project_ids: list[int]) -> dict[int, dict]:
    result = {project_id: {"status_report_count": 0, "latest_report_at": None} for project_id in project_ids}
    if not project_ids:
        return result
    rows = db.execute(
        select(
            ProjectStatusReport.project_id,
            func.count(ProjectStatusReport.id),
            func.max(ProjectStatusReport.created_at),
        )
        .where(ProjectStatusReport.project_id.in_(project_ids))
        .group_by(ProjectStatusReport.project_id)
    ).all()
    for project_id, count, latest in rows:
        result[project_id] = {"status_report_count": int(count), "latest_report_at": latest}
    return result


def _contribution_rows(db: Session, project_ids: list[int]) -> dict[int, list[dict]]:
    result = {project_id: [] for project_id in project_ids}
    if not project_ids:
        return result
    rows = list(
        db.scalars(
            select(ProjectContribution)
            .options(
                joinedload(ProjectContribution.resource).joinedload(Resource.department),
                joinedload(ProjectContribution.resource).joinedload(Resource.designation),
                joinedload(ProjectContribution.resource)
                .joinedload(Resource.company_links)
                .joinedload(ResourceCompany.company),
            )
            .where(ProjectContribution.project_id.in_(project_ids))
            .order_by(ProjectContribution.ended_at.desc(), ProjectContribution.id.desc())
        ).unique().all()
    )
    for row in rows:
        result[row.project_id].append(
            {
                "id": row.id,
                **_person_fields(row.resource),
                "started_at": row.started_at,
                "ended_at": row.ended_at,
                "utilization_percent": row.utilization_percent,
                "project_role": row.project_role,
                "highlights": row.highlights,
            }
        )
    return result


def _replace_groups(db: Session, project_id: int, group_ids: list[int]) -> None:
    _require_groups(db, group_ids)
    existing = list(
        db.scalars(select(ProjectGroupMember).where(ProjectGroupMember.project_id == project_id)).all()
    )
    current = {row.group_id for row in existing}
    wanted = set(group_ids)
    for row in existing:
        if row.group_id not in wanted:
            db.delete(row)
    for group_id in group_ids:
        if group_id not in current:
            db.add(ProjectGroupMember(project_id=project_id, group_id=group_id))
    db.flush()


def _payload(
    db: Session,
    row: Project,
    groups: list[dict] | None = None,
    tags: list[dict] | None = None,
    stats: dict | None = None,
    contributions: list[dict] | None = None,
) -> dict:
    assignments = []
    for link in _assignment_rows(db, row.id):
        person = link.resource
        assignments.append(
            {
                **_person_fields(person),
                "project_role": link.project_role,
                "utilization_percent": link.utilization_percent,
                "onboarded": link.onboarded,
                "started_at": link.started_at,
            }
        )
    counts = _resource_project_counts(db, [item["resource_id"] for item in assignments])
    for item in assignments:
        item["project_count"] = counts.get(item["resource_id"], 0)
    if groups is None:
        groups = _group_map(db, [row.id]).get(row.id, [])
    if tags is None:
        tags = _tag_map(db, [row.id]).get(row.id, [])
    if stats is None:
        stats = _report_stats(db, [row.id]).get(row.id, {"status_report_count": 0, "latest_report_at": None})
    if contributions is None:
        contributions = _contribution_rows(db, [row.id]).get(row.id, [])
    active_count = sum(1 for item in assignments if not item["resigned"])
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "status": row.status,
        "archived": row.archived,
        "reports_with_pmo": row.reports_with_pmo,
        "report_cadence_days": row.report_cadence_days,
        "external_url": row.external_url,
        "tags": tags,
        "assignment_count": active_count,
        "resource_count": active_count,
        "status_report_count": stats["status_report_count"],
        "latest_report_at": stats["latest_report_at"],
        "assignments": assignments,
        "contributions": contributions,
        "groups": groups,
        "section_id": row.section_id,
        "section_name": _section_name(db, row.section_id),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _section_name(db: Session, section_id: int | None) -> str | None:
    if section_id is None:
        return None
    return db.scalar(select(ProjectSection.name).where(ProjectSection.id == section_id))


def _section_names(db: Session, rows: list[Project]) -> dict[int, str]:
    ids = {row.section_id for row in rows if row.section_id is not None}
    if not ids:
        return {}
    found = db.execute(
        select(ProjectSection.id, ProjectSection.name).where(ProjectSection.id.in_(ids))
    ).all()
    return {section_id: name for section_id, name in found}


def _list_payload(
    row: Project,
    groups: list[dict],
    tags: list[dict],
    stats: dict,
    assignment_count: int,
    section_name: str | None = None,
) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "status": row.status,
        "archived": row.archived,
        "reports_with_pmo": row.reports_with_pmo,
        "report_cadence_days": row.report_cadence_days,
        "external_url": row.external_url,
        "tags": tags,
        "assignment_count": assignment_count,
        "resource_count": assignment_count,
        "status_report_count": stats["status_report_count"],
        "latest_report_at": stats["latest_report_at"],
        "groups": groups,
        "section_id": row.section_id,
        "section_name": section_name if row.section_id is not None else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _list_payloads(db: Session, rows: list[Project]) -> list[dict]:
    ids = [row.id for row in rows]
    grouped = _group_map(db, ids)
    tagged = _tag_map(db, ids)
    stats = _report_stats(db, ids)
    counts = _assignment_counts(db, ids)
    names = _section_names(db, rows)
    empty_stats = {"status_report_count": 0, "latest_report_at": None}
    return [
        _list_payload(
            row,
            grouped.get(row.id, []),
            tagged.get(row.id, []),
            stats.get(row.id, empty_stats),
            counts.get(row.id, 0),
            names.get(row.section_id) if row.section_id is not None else None,
        )
        for row in rows
    ]


def list_projects(
    db: Session,
    q: str | None = None,
    group_id: int | None = None,
    ungrouped: bool = False,
    archived: bool = False,
    tag_id: int | None = None,
    resource_id: int | None = None,
) -> list[dict]:
    if group_id is not None and ungrouped:
        raise AppError(422, "Choose a view or ungrouped projects")
    if group_id is not None and db.get(ProjectGroup, group_id) is None:
        raise AppError(404, "View not found")
    if tag_id is not None and db.get(Tag, tag_id) is None:
        raise AppError(404, "Label not found")
    if resource_id is not None and db.get(Resource, resource_id) is None:
        raise AppError(404, "Person not found")
    stmt = select(Project)
    if resource_id is None:
        stmt = stmt.where(Project.archived.is_(archived))
    else:
        stmt = stmt.where(
            Project.id.in_(
                select(ProjectResource.project_id).where(ProjectResource.resource_id == resource_id)
            )
        )
    if group_id is not None:
        stmt = stmt.where(
            Project.id.in_(
                select(ProjectGroupMember.project_id).where(ProjectGroupMember.group_id == group_id)
            )
        )
    if ungrouped:
        stmt = stmt.where(~Project.id.in_(select(ProjectGroupMember.project_id)))
    if tag_id is not None:
        stmt = stmt.where(
            Project.id.in_(select(ProjectTag.project_id).where(ProjectTag.tag_id == tag_id))
        )
    needle = (q or "").strip().lower()
    if needle:
        stmt = stmt.where(
            or_(
                func.lower(Project.name).contains(needle),
                func.lower(func.coalesce(Project.description, "")).contains(needle),
            )
        )
    rows = list(db.scalars(stmt.order_by(Project.updated_at.desc(), func.lower(Project.name), Project.id)).all())
    return _list_payloads(db, rows)


def get_project(db: Session, project_id: int) -> dict:
    return _payload(db, _require_project(db, project_id))


def create_project(db: Session, body: ProjectWrite) -> dict:
    now = utcnow()
    row = Project(
        name=body.name,
        description=body.description,
        status=body.status.value,
        reports_with_pmo=body.reports_with_pmo,
        report_cadence_days=body.report_cadence_days,
        external_url=body.external_url,
        created_at=now,
        updated_at=now,
    )
    _require_groups(db, body.group_ids)
    db.add(row)
    db.flush()
    _replace_groups(db, row.id, body.group_ids)
    if body.tags:
        set_project_tags(db, row.id, body.tags)
    return _payload(db, row)


def patch_project(db: Session, project_id: int, body: ProjectPatch) -> dict:
    row = _require_project(db, project_id)
    fields = body.model_fields_set
    if row.archived and "status" in fields and body.status is not None and body.status.value != "completed":
        raise AppError(422, "An archived project stays completed")
    if "name" in fields and body.name is not None:
        row.name = body.name
    if "description" in fields:
        row.description = body.description
    if "status" in fields and body.status is not None:
        row.status = body.status.value
    if "reports_with_pmo" in fields and body.reports_with_pmo is not None:
        row.reports_with_pmo = body.reports_with_pmo
    if "report_cadence_days" in fields:
        row.report_cadence_days = body.report_cadence_days
    if "external_url" in fields:
        row.external_url = body.external_url
    if "tags" in fields and body.tags is not None:
        set_project_tags(db, row.id, body.tags)
    row.updated_at = utcnow()
    db.flush()
    return _payload(db, row)


def archive_project(db: Session, project_id: int) -> dict:
    row = _require_project(db, project_id)
    if row.status != "completed":
        raise AppError(422, "Only a completed project can be archived")
    if not row.archived:
        row.archived = True
        row.updated_at = utcnow()
        db.flush()
    return _payload(db, row)


def unarchive_project(db: Session, project_id: int) -> dict:
    row = _require_project(db, project_id)
    if row.archived:
        row.archived = False
        row.updated_at = utcnow()
        db.flush()
    return _payload(db, row)


def set_project_groups(db: Session, project_id: int, group_ids: list[int]) -> dict:
    project = _require_project(db, project_id)
    _replace_groups(db, project.id, group_ids)
    return _payload(db, project)


def set_project_all_section(db: Session, project_id: int, section_id: int | None) -> dict:
    project = _require_project(db, project_id)
    if section_id is not None and db.get(ProjectSection, section_id) is None:
        raise AppError(404, "Section not found")
    project.section_id = section_id
    db.flush()
    return _payload(db, project)


def set_project_section(db: Session, project_id: int, group_id: int, section_id: int | None) -> dict:
    project = _require_project(db, project_id)
    if db.get(ProjectGroup, group_id) is None:
        raise AppError(404, "View not found")
    member = db.get(ProjectGroupMember, (project_id, group_id))
    if member is None:
        raise AppError(404, "That project is not in this view")
    if section_id is not None:
        section = db.get(ProjectGroupSection, section_id)
        if section is None or section.group_id != group_id:
            raise AppError(404, "Section not found")
    member.section_id = section_id
    db.flush()
    return _payload(db, project)


def move_project_group(db: Session, project_id: int, from_group_id: int, to_group_id: int) -> dict:
    project = _require_project(db, project_id)
    if db.get(ProjectGroup, from_group_id) is None or db.get(ProjectGroup, to_group_id) is None:
        raise AppError(404, "View not found")
    if from_group_id == to_group_id:
        return _payload(db, project)
    source = db.get(ProjectGroupMember, (project_id, from_group_id))
    if source is None:
        raise AppError(404, "That project is not in this view")
    db.delete(source)
    if db.get(ProjectGroupMember, (project_id, to_group_id)) is None:
        db.add(ProjectGroupMember(project_id=project_id, group_id=to_group_id))
    db.flush()
    return _payload(db, project)


def delete_project(db: Session, project_id: int) -> None:
    row = _require_project(db, project_id)
    db.delete(row)
    db.flush()


def assign_resource(db: Session, project_id: int, body: AssignmentWrite) -> dict:
    project = _require_project(db, project_id)
    person = _require_resource(db, body.resource_id)
    if person.resigned:
        raise AppError(409, "That person has resigned")
    existing = db.get(ProjectResource, (project_id, body.resource_id))
    if existing is not None:
        raise AppError(409, "That person is already on this project")
    role = body.project_role.value if isinstance(body.project_role, ProjectRole) else body.project_role
    started = as_utc(body.started_at) if body.started_at is not None else utcnow()
    db.add(
        ProjectResource(
            project_id=project_id,
            resource_id=body.resource_id,
            project_role=role,
            utilization_percent=body.utilization_percent,
            onboarded=body.onboarded,
            started_at=started,
        )
    )
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)


def update_assignment(db: Session, project_id: int, resource_id: int, body: AssignmentPatch) -> dict:
    project = _require_project(db, project_id)
    link = db.get(ProjectResource, (project_id, resource_id))
    if link is None:
        raise AppError(404, "That person is not on this project")
    fields = body.model_fields_set
    if "project_role" in fields and body.project_role is not None:
        link.project_role = body.project_role.value
    if "utilization_percent" in fields and body.utilization_percent is not None:
        link.utilization_percent = body.utilization_percent
    if "onboarded" in fields and body.onboarded is not None:
        link.onboarded = body.onboarded
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)


def remove_assignment(db: Session, project_id: int, resource_id: int) -> dict:
    project = _require_project(db, project_id)
    link = db.get(ProjectResource, (project_id, resource_id))
    if link is None:
        raise AppError(404, "That person is not on this project")
    db.delete(link)
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)


def move_assignment(db: Session, project_id: int, resource_id: int, body: MoveAssignment) -> dict:
    has_project = body.to_project_id is not None
    has_unassigned = body.unassigned is True
    if has_project == has_unassigned:
        raise AppError(422, "Provide exactly one of to_project_id or unassigned")
    source = _require_project(db, project_id)
    person = _require_resource(db, resource_id)
    link = db.get(ProjectResource, (project_id, resource_id))
    if link is None:
        raise AppError(404, "That person is not on this project")
    ended = as_utc(body.ended_at) if body.ended_at is not None else utcnow()
    started = as_utc(body.started_at) if body.started_at is not None else as_utc(link.started_at)
    if ended < started:
        raise AppError(422, "End date cannot be before the contribution started")
    kept_role = link.project_role
    kept_utilization = link.utilization_percent
    kept_onboarded = link.onboarded
    destination = None
    if has_project:
        if person.resigned:
            raise AppError(409, "That person has resigned")
        if body.to_project_id == project_id:
            raise AppError(422, "Cannot move a person onto the same project")
        destination = _require_project(db, body.to_project_id)
        if db.get(ProjectResource, (destination.id, resource_id)) is not None:
            raise AppError(409, "That person is already on the destination project")
    contribution = ProjectContribution(
        project_id=project_id,
        resource_id=resource_id,
        started_at=started,
        ended_at=ended,
        utilization_percent=kept_utilization,
        project_role=kept_role,
        highlights=body.highlights,
    )
    db.add(contribution)
    db.delete(link)
    now = utcnow()
    if destination is not None:
        db.add(
            ProjectResource(
                project_id=destination.id,
                resource_id=person.id,
                project_role=kept_role,
                utilization_percent=kept_utilization,
                onboarded=kept_onboarded,
                started_at=ended,
            )
        )
        destination.updated_at = now
    source.updated_at = now
    db.flush()
    return _payload(db, source)


def _require_contribution(db: Session, project_id: int, contribution_id: int):
    project = _require_project(db, project_id)
    contribution = db.get(ProjectContribution, contribution_id)
    if contribution is None or contribution.project_id != project.id:
        raise AppError(404, "Contribution not found")
    return project, contribution


def patch_contribution(db: Session, project_id: int, contribution_id: int, body: ContributionPatch) -> dict:
    allowed = {"started_at", "ended_at", "utilization_percent", "project_role", "highlights"}
    present = allowed & body.model_fields_set
    valued = present - {"highlights"}
    if not present or any(getattr(body, name) is None for name in valued):
        raise AppError(422, "Provide started_at, ended_at, utilization_percent, project_role, or highlights")
    project, contribution = _require_contribution(db, project_id, contribution_id)
    started = as_utc(body.started_at) if "started_at" in present else as_utc(contribution.started_at)
    ended = as_utc(body.ended_at) if "ended_at" in present else as_utc(contribution.ended_at)
    if ended < started:
        raise AppError(422, "End date cannot be before the contribution started")
    if "started_at" in present:
        contribution.started_at = started
    if "ended_at" in present:
        contribution.ended_at = ended
    if "utilization_percent" in present:
        contribution.utilization_percent = body.utilization_percent
    if "project_role" in present and body.project_role is not None:
        contribution.project_role = body.project_role.value
    if "highlights" in present:
        contribution.highlights = body.highlights
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)


def delete_contribution(db: Session, project_id: int, contribution_id: int) -> dict:
    project, contribution = _require_contribution(db, project_id, contribution_id)
    db.delete(contribution)
    project.updated_at = utcnow()
    db.flush()
    return _payload(db, project)


def _report_dict(report: ProjectStatusReport) -> dict:
    return {
        "id": report.id,
        "project_id": report.project_id,
        "body": report.body,
        "flag": report.flag,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


def list_status_reports(db: Session, project_id: int, limit: int | None, offset: int) -> dict:
    _require_project(db, project_id)
    rows = list(
        db.scalars(
            select(ProjectStatusReport)
            .where(ProjectStatusReport.project_id == project_id)
            .order_by(ProjectStatusReport.created_at.desc(), ProjectStatusReport.id.desc())
        ).all()
    )
    page = rows[offset:] if limit is None else rows[offset:offset + limit]
    return {
        "items": [_report_dict(report) for report in page],
        "total": len(rows),
        "latest_report_at": rows[0].created_at if rows else None,
    }


def create_status_report(db: Session, project_id: int, body: StatusReportCreate) -> dict:
    project = _require_project(db, project_id)
    now = utcnow()
    stamp = as_utc(body.created_at) if body.created_at is not None else now
    report = ProjectStatusReport(
        project_id=project.id,
        body=body.body,
        flag=None if body.flag is None else body.flag.value,
        created_at=stamp,
        updated_at=stamp,
    )
    db.add(report)
    project.updated_at = now
    db.flush()
    return _report_dict(report)


def _require_report(db: Session, project_id: int, report_id: int):
    project = _require_project(db, project_id)
    report = db.get(ProjectStatusReport, report_id)
    if report is None or report.project_id != project.id:
        raise AppError(404, "Status report not found")
    return project, report


def patch_status_report(db: Session, project_id: int, report_id: int, body: StatusReportPatch) -> dict:
    project, report = _require_report(db, project_id, report_id)
    now = utcnow()
    report.body = body.body
    if "created_at" in body.model_fields_set and body.created_at is not None:
        report.created_at = as_utc(body.created_at)
    if "flag" in body.model_fields_set:
        report.flag = None if body.flag is None else body.flag.value
    report.updated_at = now
    project.updated_at = now
    db.flush()
    return _report_dict(report)


def delete_status_report(db: Session, project_id: int, report_id: int) -> None:
    project, report = _require_report(db, project_id, report_id)
    db.delete(report)
    project.updated_at = utcnow()
    db.flush()
