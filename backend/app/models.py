from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
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

    resource: Mapped[Resource] = relationship(back_populates="company_links")
    company: Mapped[Company] = relationship(back_populates="resource_links")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="assessment")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    assignments: Mapped[list["ProjectResource"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectResource(Base):
    __tablename__ = "project_resources"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    resource_id: Mapped[int] = mapped_column(
        ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    project_role: Mapped[str] = mapped_column(String(64), nullable=False, default="member")

    project: Mapped[Project] = relationship(back_populates="assignments")
    resource: Mapped[Resource] = relationship(back_populates="assignments")


Index("uq_departments_name_ci", func.lower(Department.name), unique=True)
Index("uq_designations_name_ci", func.lower(Designation.name), unique=True)
Index("uq_companies_name_ci", func.lower(Company.name), unique=True)
Index("uq_resources_email_ci", func.lower(Resource.email), unique=True)
