import { createCompany, deleteCompany, listCompanies, updateCompany } from '../api.js';
import CatalogPage from './CatalogPage.jsx';

export default function CompaniesPage({ canEdit }) {
  return (
    <CatalogPage
      title="Companies"
      subtitle="Companies we work with. A person can be onboarded with several. Deleting a company removes it from those people."
      noun="company"
      plural="companies"
      emptyLabel="No companies yet."
      withIcon
      inDialog
      searchable
      canEdit={canEdit}
      load={listCompanies}
      create={createCompany}
      update={updateCompany}
      remove={deleteCompany}
    />
  );
}
