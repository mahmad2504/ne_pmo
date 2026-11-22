export function companyInitial(name) {
  const letter = (name || '').trim().slice(0, 1);
  return letter ? letter.toUpperCase() : '?';
}

export function CompanyMark({ name, icon, decorative = false }) {
  if (icon) {
    return <img className="company-icon" src={icon} alt={decorative ? '' : name} />;
  }
  return (
    <span
      className="company-icon company-icon--fallback"
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (name || 'Company')}
    >
      {companyInitial(name)}
    </span>
  );
}

export default function CompanyLabel({ name, icon, iconOnly = false }) {
  if (iconOnly) {
    return (
      <span className="company-label company-label--icon" title={name}>
        <CompanyMark name={name} icon={icon} />
      </span>
    );
  }

  return (
    <span className="company-label">
      <CompanyMark name={name} icon={icon} decorative />
      {name}
    </span>
  );
}
