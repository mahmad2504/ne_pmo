import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { getTheme, setTheme } from '../theme.js';

export default function ThemeToggle({ className }) {
  const [theme, setThemeState] = useState(getTheme);
  const dark = theme === 'dark';

  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener('ne-pm-theme', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('ne-pm-theme', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setThemeState(setTheme(dark ? 'light' : 'dark'))}
    >
      {dark ? <Sun /> : <Moon />}
      {dark ? 'Light theme' : 'Dark theme'}
    </Button>
  );
}
