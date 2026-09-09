import { useState, useEffect } from 'react';

// Theme switcher — dark (brand default) / light (refined white).
// Choice persists in localStorage and applies pre-paint via the inline
// script in index.html, so this component only flips the attribute.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.dataset.theme || 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('ab_theme', theme); } catch {}
  }, [theme]);

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      title={isLight ? 'الوضع الليلي' : 'الوضع النهاري'}
      aria-label={isLight ? 'تفعيل الوضع الليلي' : 'تفعيل الوضع النهاري'}
    >
      {isLight ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      )}
    </button>
  );
}
