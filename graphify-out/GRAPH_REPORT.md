# Graph Report - ne-pm-tool - Copy (2)  (2026-11-23)

## Corpus Check
- Corpus is ~26,232 words - fits in a single context window. You may not need a graph.

## Summary
- 802 nodes · 2223 edges · 35 communities (29 shown, 6 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 173 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Project Domain Models
- Stack and Runtime Docs
- Backend Test Fixtures
- App Navigation Shell
- Keycloak Setup Scripts
- Directory API Client
- Project Workspace UI
- Auth and App Lifecycle
- API Schema Models
- Tag Catalog API
- Projects List UI
- Status Report Editor
- Company Catalog API
- Project Write API
- Designation Catalog API
- Project Group API
- Department Catalog API
- Database Bootstrap
- Catalog Admin UI
- Field Normalization
- Resource Assignment UI
- Report HTML Sanitizer
- Project View Editor
- Project Roles and Lifecycle
- Resource CRUD API
- Shared Catalog Lookups
- Resource Write Schema
- Resource Patch Schema
- Project Users Dialog
- Name Cleaning Validators
- Archive Page
- API Error Handlers
- Report Tone Helpers
- Example Package Manifest

## God Nodes (most connected - your core abstractions)
1. `AppError` - 54 edges
2. `ProjectPage()` - 53 edges
3. `api()` - 50 edges
4. `APIModel` - 36 edges
5. `ProjectsPage()` - 33 edges
6. `App()` - 27 edges
7. `Resource` - 24 edges
8. `_payload()` - 22 edges
9. `ResourcesPage()` - 22 edges
10. `create_department()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `NE PM Tool HTML Shell` --conceptually_related_to--> `NE PM Tool`  [INFERRED]
  frontend/index.html → README.md
- `FastAPI` --conceptually_related_to--> `API Docs`  [INFERRED]
  backend/requirements.txt → README.md
- `Pytest` --conceptually_related_to--> `pytest`  [INFERRED]
  README.md → backend/requirements-dev.txt
- `In-Memory Test Database` --semantically_similar_to--> `Postgres Service`  [INFERRED] [semantically similar]
  README.md → docker-compose.yml
- `Backend Requirements` --conceptually_related_to--> `Backend Service`  [INFERRED]
  backend/requirements.txt → docker-compose.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Local Runtime Stack** — docker_compose_stack, docker_compose_postgres, docker_compose_keycloak, docker_compose_backend, docker_compose_frontend, docker_compose_nginx [EXTRACTED 1.00]
- **Authorization Model** — readme_user_role, readme_admin_role, readme_project_role, readme_lead, readme_member, readme_assignment [EXTRACTED 1.00]
- **Keycloak Token Validation** — docker_compose_backend, docker_compose_logic_silicon_realm, docker_compose_keycloak_issuer, docker_compose_keycloak_jwks_url, docker_compose_keycloak_audience, docker_compose_keycloak_authorized_party [EXTRACTED 1.00]

## Communities (35 total, 6 thin omitted)

### Community 0 - "Project Domain Models"
Cohesion: 0.10
Nodes (69): as_utc(), iso(), utcnow(), AppError, Base, Project, ProjectContribution, ProjectGroupMember (+61 more)

### Community 1 - "Stack and Runtime Docs"
Cohesion: 0.06
Nodes (59): httpx, Backend Dev Requirements, pytest, FastAPI, Backend Requirements, psycopg, Pydantic, PyJWT (+51 more)

### Community 2 - "Backend Test Fixtures"
Cohesion: 0.10
Nodes (31): _app_roles(), get_current_user(), _setting(), client(), create_company(), create_department(), create_designation(), create_person() (+23 more)

### Community 3 - "App Navigation Shell"
Cohesion: 0.10
Nodes (33): createTag(), deleteTag(), updateTag(), App(), allowLeave(), go(), navigate(), onPop() (+25 more)

### Community 4 - "Keycloak Setup Scripts"
Cohesion: 0.07
Nodes (33): dependencies, keycloak-js, react, react-dom, devDependencies, vite, @vitejs/plugin-react, name (+25 more)

### Community 5 - "Directory API Client"
Cohesion: 0.13
Nodes (31): api(), createCompany(), createDepartment(), createDesignation(), createResource(), deleteCompany(), deleteDepartment(), deleteDesignation() (+23 more)

### Community 6 - "Project Workspace UI"
Cohesion: 0.11
Nodes (34): assignResource(), createStatusReport(), deleteContribution(), deleteProject(), deleteStatusReport(), listStatusReports(), moveAssignment(), removeAssignment() (+26 more)

### Community 7 - "Auth and App Lifecycle"
Cohesion: 0.13
Nodes (12): require_admin(), require_reader(), health(), lifespan(), patch_department(), patch_designation(), patch_group(), CatalogOut (+4 more)

### Community 8 - "API Schema Models"
Cohesion: 0.10
Nodes (30): APIModel, AssignmentCompany, AssignmentPatch, CompanyRef, ContributionOut, ContributionPatch, DepartmentCreate, DepartmentRef (+22 more)

### Community 9 - "Tag Catalog API"
Cohesion: 0.11
Nodes (16): Tag, create_tag(), delete_tag(), list_tags(), patch_tag(), _clean_symbol(), _clean_title(), TagCreate (+8 more)

### Community 10 - "Projects List UI"
Cohesion: 0.10
Nodes (26): archiveProject(), createProject(), createProjectGroup(), getProject(), listLifecycle(), listTags(), onArchive(), emptyForm (+18 more)

### Community 11 - "Status Report Editor"
Cohesion: 0.13
Nodes (25): FLAG_LABELS, FLAGS, formatLastReportOn(), formatReportDate(), localToday(), ProjectReports(), closeDraft(), removeReport() (+17 more)

### Community 12 - "Company Catalog API"
Cohesion: 0.16
Nodes (16): Company, create_company(), delete_company(), list_companies(), patch_company(), _clean_icon(), CompanyCreate, CompanyPatch (+8 more)

### Community 13 - "Project Write API"
Cohesion: 0.18
Nodes (17): archive_project(), assign_resource(), create_project(), create_status_report(), delete_contribution(), delete_project(), delete_status_report(), get_project() (+9 more)

### Community 14 - "Designation Catalog API"
Cohesion: 0.22
Nodes (12): Designation, create_designation(), delete_designation(), list_designations(), _count(), create_designation(), delete_designation(), list_designations() (+4 more)

### Community 15 - "Project Group API"
Cohesion: 0.22
Nodes (12): ProjectGroup, create_group(), delete_group(), list_groups(), _count(), create_group(), delete_group(), list_groups() (+4 more)

### Community 16 - "Department Catalog API"
Cohesion: 0.24
Nodes (12): Department, create_department(), delete_department(), list_departments(), _count(), create_department(), delete_department(), list_departments() (+4 more)

### Community 17 - "Database Bootstrap"
Cohesion: 0.24
Nodes (12): _column_names(), database_url(), _enable_sqlite_fk(), _ensure_company_icon(), ensure_postgres_database(), _ensure_project_workspace(), _ensure_resource_resigned(), get_db() (+4 more)

### Community 18 - "Catalog Admin UI"
Cohesion: 0.21
Nodes (12): companyInitial(), CompanyLabel(), CompanyMark(), CatalogPage(), cancel(), onDelete(), onDialogClose(), onIcon() (+4 more)

### Community 19 - "Field Normalization"
Cohesion: 0.20
Nodes (3): blank_to_none(), _clean_id_list(), _clean_report_flag()

### Community 20 - "Resource Assignment UI"
Cohesion: 0.15
Nodes (6): AssignResourceForm(), personMeta(), RemoveResourceDialog(), todayUtc(), utcDay(), react

### Community 22 - "Project View Editor"
Cohesion: 0.29
Nodes (10): deleteProjectGroup(), listProjectGroups(), setProjectGroups(), updateProjectGroup(), EditViewPage(), onDelete(), onSave(), memberIds() (+2 more)

### Community 23 - "Project Roles and Lifecycle"
Cohesion: 0.29
Nodes (6): Lifecycle, ProjectRole, ReportFlag, _clean_tag_list(), ProjectPatch, ProjectWrite

### Community 24 - "Resource CRUD API"
Cohesion: 0.20
Nodes (5): create_resource(), delete_resource(), get_resource(), list_resources(), patch_resource()

### Community 25 - "Shared Catalog Lookups"
Cohesion: 0.32
Nodes (4): normalize_tags(), lifecycle(), locations(), project_roles()

### Community 28 - "Project Users Dialog"
Cohesion: 0.36
Nodes (6): updateAssignment(), onUtilization(), ProjectUsersDialog(), saveUtilization(), userCountLabel(), UsersButton()

### Community 30 - "Archive Page"
Cohesion: 0.67
Nodes (5): listProjects(), unarchiveProject(), ArchivePage(), refresh(), restore()

### Community 32 - "Report Tone Helpers"
Cohesion: 0.70
Nodes (4): calendarDaysBetween(), localToday(), reportDay(), reportToneClass()

### Community 33 - "Example Package Manifest"
Cohesion: 0.40
Nodes (4): name, private, scripts, setup

## Ambiguous Edges - Review These
- `Postgres Service` → `Backend DATABASE_URL`  [AMBIGUOUS]
  docker-compose.yml · relation: shares_data_with
- `Keycloak Service` → `Backend DATABASE_URL`  [AMBIGUOUS]
  docker-compose.yml · relation: shares_data_with

## Knowledge Gaps
- **12 isolated node(s):** `People Directory`, `Lead`, `Member`, `Node.js`, `Alice` (+7 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Resource Assignment UI` to `App Navigation Shell`, `Keycloak Setup Scripts`, `Directory API Client`, `Project Workspace UI`, `Projects List UI`, `Status Report Editor`, `Catalog Admin UI`, `Project View Editor`, `Project Users Dialog`, `Archive Page`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `People Directory`, `Lead`, `Member` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Domain Models` be split into smaller, more focused modules?**
  _Cohesion score 0.09969135802469135 - nodes in this community are weakly interconnected._
- **Why does `AppError` connect `Project Domain Models` to `Backend Test Fixtures`, `Auth and App Lifecycle`, `Tag Catalog API`, `Company Catalog API`, `Designation Catalog API`, `Project Group API`, `Department Catalog API`, `API Error Handlers`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Stack and Runtime Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.05819209039548023 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Postgres Service` and `Backend DATABASE_URL`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Keycloak Service` and `Backend DATABASE_URL`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._