import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
}>({ preference: 'system', setPreference: () => {} });
export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem('jobee.theme');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}
export function applyTheme(preference: ThemePreference) {
  const dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem('jobee.theme', preference);
    } catch {
      /* Storage may be unavailable. */
    }
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => applyTheme(preference);
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, [preference]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === 'jobee.theme') setPreference(readThemePreference());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
export function AppearanceSettings() {
  const { preference, setPreference } = useTheme();
  return (
    <section className="card">
      <h2 className="card-title">Appearance</h2>
      <p className="page-subtitle">Choose what feels comfortable. System follows your device.</p>
      <label className="form-label" htmlFor="jobee-appearance">
        Color theme
      </label>
      <select
        id="jobee-appearance"
        className="form-input"
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </section>
  );
}
