import { createDesignation, deleteDesignation, listDesignations, updateDesignation } from '../api.js';
import CatalogPage from './CatalogPage.jsx';

export default function JobTitlesPage({ canEdit }) {
  return (
    <CatalogPage
      title="Job titles"
      subtitle="A job title is optional. Deleting one clears it on the people who had it."
      noun="job title"
      inDialog
      searchable
      canEdit={canEdit}
      load={listDesignations}
      create={createDesignation}
      update={updateDesignation}
      remove={deleteDesignation}
    />
  );
}
