from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    resources: Mapped[list["Resource"]] = relationship(back_populates="department")


class Designation(Base):
    __tablename__ = "designations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    resources: Mapped[list["Resource"]] = relationship(back_populates="designation")


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(Text)

    resource_links: Mapped[list["ResourceCompany"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    location: Mapped[str | None] = mapped_column(String(8))
    designation_id: Mapped[int | None] = mapped_column(
        ForeignKey("designations.id", ondelete="SET NULL"), index=True
    )
    resigned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    department: Mapped[Department] = relationship(back_populates="resources")
    designation: Mapped[Designation | None] = relationship(back_populates="resources")
    company_links: Mapped[list["ResourceCompany"]] = relationship(
        back_populates="resource", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["ProjectResource"]] = relationship(
        back_populates="resource", cascade="all, delete-orphan"
    )


class ResourceCompany(Base):
    __tablename__ = "resource_companies"

    resource_id: Mapped[int] = mapped_column(
        ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True
    )
    email: Mapped[str | None] = mapped_column(String(255))

    resource: Mapped[Resource] = relationship(back_populates="company_links")
    company: Mapped[Company] = relationship(back_populates="resource_links")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="assessment")
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reports_with_pmo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    report_cadence_days: Mapped[int | None] = mapped_column(Integer)
    external_url: Mapped[str | None] = mapped_column(String(2048))
    section_id: Mapped[int | None] = mapped_column(
        ForeignKey("project_sections.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    assignments: Mapped[list["ProjectResource"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    group_links: Mapped[list["ProjectGroupMember"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    contributions: Mapped[list["ProjectContribution"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    status_reports: Mapped[list["ProjectStatusReport"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    tag_links: Mapped[list["ProjectTag"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    section: Mapped["ProjectSection | None"] = relationship(back_populates="projects")


class ProjectSection(Base):
    __tablename__ = "project_sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(nullable=False, default=0)

    projects: Mapped[list[Project]] = relationship(back_populates="section")


class ProjectGroup(Base):
    __tablename__ = "project_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(nullable=False, default=0)

    memberships: Mapped[list["ProjectGroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )
    sections: Mapped[list["ProjectGroupSection"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class ProjectGroupSection(Base):
    __tablename__ = "project_group_sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("project_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(nullable=False, default=0)

    group: Mapped[ProjectGroup] = relationship(back_populates="sections")
    memberships: Mapped[list["ProjectGroupMember"]] = relationship(back_populates="section")


class ProjectGroupMember(Base):
    __tablename__ = "project_group_members"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[int] = mapped_column(
        ForeignKey("project_groups.id", ondelete="CASCADE"), primary_key=True
    )
    section_id: Mapped[int | None] = mapped_column(
        ForeignKey("project_group_sections.id", ondelete="SET NULL"), index=True
    )

    project: Mapped[Project] = relationship(back_populates="group_links")
    group: Mapped[ProjectGroup] = relationship(back_populates="memberships")
    section: Mapped[ProjectGroupSection | None] = relationship(back_populates="memberships")


class ProjectResource(Base):
    __tablename__ = "project_resources"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    resource_id: Mapped[int] = mapped_column(
        ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    project_role: Mapped[str] = mapped_column(String(64), nullable=False, default="member")
    utilization_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    project: Mapped[Project] = relationship(back_populates="assignments")
    resource: Mapped[Resource] = relationship(back_populates="assignments")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    project_links: Mapped[list["ProjectTag"]] = relationship(
        back_populates="tag", cascade="all, delete-orphan"
    )


class ProjectTag(Base):
    __tablename__ = "project_tags"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    project: Mapped[Project] = relationship(back_populates="tag_links")
    tag: Mapped[Tag] = relationship(back_populates="project_links")


class ProjectContribution(Base):
    __tablename__ = "project_contributions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[int] = mapped_column(
        ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    utilization_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    project_role: Mapped[str] = mapped_column(String(64), nullable=False)
    highlights: Mapped[str | None] = mapped_column(Text)

    project: Mapped[Project] = relationship(back_populates="contributions")
    resource: Mapped[Resource] = relationship()


class ProjectStatusReport(Base):
    __tablename__ = "project_status_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    flag: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    project: Mapped[Project] = relationship(back_populates="status_reports")


Index("uq_departments_name_ci", func.lower(Department.name), unique=True)
Index("uq_designations_name_ci", func.lower(Designation.name), unique=True)
Index("uq_companies_name_ci", func.lower(Company.name), unique=True)
Index("uq_resources_email_ci", func.lower(Resource.email), unique=True)
Index("uq_project_groups_name_ci", func.lower(ProjectGroup.name), unique=True)
Index(
    "uq_project_group_sections_name_ci",
    ProjectGroupSection.group_id,
    func.lower(ProjectGroupSection.name),
    unique=True,
)
Index("uq_project_sections_name_ci", func.lower(ProjectSection.name), unique=True)
Index("uq_tags_name_ci", func.lower(Tag.name), unique=True)
