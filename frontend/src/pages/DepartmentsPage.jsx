import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from '../api.js';
import CatalogPage from './CatalogPage.jsx';

export default function DepartmentsPage({ canEdit }) {
  return (
    <CatalogPage
      title="Departments"
      subtitle="Every person belongs to one department."
      noun="department"
      inDialog
      canEdit={canEdit}
      load={listDepartments}
      create={createDepartment}
      update={updateDepartment}
      remove={deleteDepartment}
    />
  );
}
