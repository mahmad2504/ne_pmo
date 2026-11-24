export const THEME_KEY = 'ne-pm-theme';

const THEME_COLOR = {
  light: '#f6f7f9',
  dark: '#1b1e26',
};

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', next === 'dark');
  document.documentElement.style.colorScheme = next;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[next]);
  return next;
}

export function setTheme(theme) {
  const next = applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Private browsing can block storage; the class still applies for this visit.
  }
  window.dispatchEvent(new Event('ne-pm-theme'));
  return next;
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
