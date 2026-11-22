function reportDay(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function calendarDaysBetween(earlierDay, laterDay) {
  const earlier = Date.parse(`${earlierDay}T00:00:00Z`);
  const later = Date.parse(`${laterDay}T00:00:00Z`);
  return Math.round((later - earlier) / 86400000);
}

export function reportToneClass(project) {
  if (project?.report_cadence_days == null) return '';
  const reportDate = reportDay(project.latest_report_at);
  if (!reportDate) return 'report-tone report-tone--delay';
  const today = localToday();
  if (reportDate === today) return 'report-tone report-tone--today';
  if (calendarDaysBetween(reportDate, today) > project.report_cadence_days) {
    return 'report-tone report-tone--delay';
  }
  return 'report-tone report-tone--current';
}
