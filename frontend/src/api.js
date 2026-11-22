import { authHeader } from './keycloak.js';

function messageFrom(payload) {
  const detail = payload?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.msg === 'string') {
          return item.msg.replace(/^Value error,\s*/i, '');
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  return '';
}

async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(await authHeader()),
    ...options.headers,
  };
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    throw new Error(messageFrom(payload) || `Request failed (${response.status})`);
  }
  return payload;
}

export const listDepartments = () => api('/api/departments');
export const createDepartment = (body) => api('/api/departments', { method: 'POST', body: JSON.stringify(body) });
export const updateDepartment = (id, body) => api(`/api/departments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteDepartment = (id) => api(`/api/departments/${id}`, { method: 'DELETE' });

export const listCompanies = () => api('/api/companies');
export const createCompany = (body) => api('/api/companies', { method: 'POST', body: JSON.stringify(body) });
export const updateCompany = (id, body) => api(`/api/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteCompany = (id) => api(`/api/companies/${id}`, { method: 'DELETE' });

export const listDesignations = () => api('/api/designations');
export const createDesignation = (body) => api('/api/designations', { method: 'POST', body: JSON.stringify(body) });
export const updateDesignation = (id, body) => api(`/api/designations/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteDesignation = (id) => api(`/api/designations/${id}`, { method: 'DELETE' });

export const listResources = (params = {}) => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.department_id) query.set('department_id', String(params.department_id));
  if (params.location) query.set('location', params.location);
  if (params.company_id) query.set('company_id', String(params.company_id));
  const suffix = query.toString();
  return api(`/api/resources${suffix ? `?${suffix}` : ''}`);
};
export const createResource = (body) => api('/api/resources', { method: 'POST', body: JSON.stringify(body) });
export const updateResource = (id, body) => api(`/api/resources/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteResource = (id) => api(`/api/resources/${id}`, { method: 'DELETE' });

export const listProjects = (q, params = {}) => {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (params.groupId) query.set('group_id', String(params.groupId));
  if (params.ungrouped) query.set('ungrouped', 'true');
  if (params.archived) query.set('archived', 'true');
  if (params.tagId) query.set('tag_id', String(params.tagId));
  const suffix = query.toString();
  return api(`/api/projects${suffix ? `?${suffix}` : ''}`);
};
export const getProject = (id) => api(`/api/projects/${id}`);
export const createProject = (body) => api('/api/projects', { method: 'POST', body: JSON.stringify(body) });
export const updateProject = (id, body) => api(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const archiveProject = (id) => api(`/api/projects/${id}/archive`, { method: 'POST' });
export const unarchiveProject = (id) => api(`/api/projects/${id}/unarchive`, { method: 'POST' });
export const deleteProject = (id) => api(`/api/projects/${id}`, { method: 'DELETE' });
export const setProjectGroups = (id, groupIds) => api(`/api/projects/${id}/groups`, { method: 'PUT', body: JSON.stringify({ group_ids: groupIds }) });
export const moveProjectGroup = (id, body) => api(`/api/projects/${id}/groups/move`, { method: 'POST', body: JSON.stringify(body) });

export const listProjectGroups = () => api('/api/project-groups');
export const createProjectGroup = (body) => api('/api/project-groups', { method: 'POST', body: JSON.stringify(body) });
export const updateProjectGroup = (id, body) => api(`/api/project-groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteProjectGroup = (id) => api(`/api/project-groups/${id}`, { method: 'DELETE' });
export const assignResource = (projectId, body) => api(`/api/projects/${projectId}/resources`, { method: 'POST', body: JSON.stringify(body) });
export const updateAssignment = (projectId, resourceId, body) => api(`/api/projects/${projectId}/resources/${resourceId}`, { method: 'PATCH', body: JSON.stringify(body) });
export const removeAssignment = (projectId, resourceId) => api(`/api/projects/${projectId}/resources/${resourceId}`, { method: 'DELETE' });
export const moveAssignment = (projectId, resourceId, body) => api(`/api/projects/${projectId}/resources/${resourceId}/move`, { method: 'POST', body: JSON.stringify(body) });
export const updateContribution = (projectId, contributionId, body) => api(`/api/projects/${projectId}/contributions/${contributionId}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteContribution = (projectId, contributionId) => api(`/api/projects/${projectId}/contributions/${contributionId}`, { method: 'DELETE' });
export const listStatusReports = (projectId, { limit, offset } = {}) => {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));
  if (offset) query.set('offset', String(offset));
  const suffix = query.toString();
  return api(`/api/projects/${projectId}/status-reports${suffix ? `?${suffix}` : ''}`);
};
export const createStatusReport = (projectId, body) => api(`/api/projects/${projectId}/status-reports`, { method: 'POST', body: JSON.stringify(body) });
export const updateStatusReport = (projectId, reportId, body) => api(`/api/projects/${projectId}/status-reports/${reportId}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteStatusReport = (projectId, reportId) => api(`/api/projects/${projectId}/status-reports/${reportId}`, { method: 'DELETE' });

export const listTags = () => api('/api/tags');
export const createTag = (body) => api('/api/tags', { method: 'POST', body: JSON.stringify(body) });
export const updateTag = (id, body) => api(`/api/tags/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteTag = (id) => api(`/api/tags/${id}`, { method: 'DELETE' });

export const listProjectRoles = () => api('/api/project-roles');
export const listLocations = () => api('/api/locations');
export const listLifecycle = () => api('/api/lifecycle');
