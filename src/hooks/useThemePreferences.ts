import { useEffect, useState } from "react";
import type { LayoutMode, ThemeId, ThemePreferences } from "../types";

const STORAGE_KEY = "ruang_theme_preferences_v1";

const defaultPreferences: ThemePreferences = {
  theme: "sage",
  layout: "list",
  showStats: true,
  showWeekStrip: true,
  showMotto: true,
};

export function useThemePreferences() {
  const [preferences, setPreferences] = useState<ThemePreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch {
      // ignore JSON parse error
    }
    return defaultPreferences;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // ignore write error
    }
    // Update data-theme on root html tag
    document.documentElement.setAttribute("data-theme", preferences.theme);
  }, [preferences]);

  const setTheme = (theme: ThemeId) => {
    setPreferences((prev) => ({ ...prev, theme }));
  };

  const setLayout = (layout: LayoutMode) => {
    setPreferences((prev) => ({ ...prev, layout }));
  };

  const toggleStats = () => {
    setPreferences((prev) => ({ ...prev, showStats: !prev.showStats }));
  };

  const toggleWeekStrip = () => {
    setPreferences((prev) => ({ ...prev, showWeekStrip: !prev.showWeekStrip }));
  };

  const toggleMotto = () => {
    setPreferences((prev) => ({ ...prev, showMotto: !prev.showMotto }));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  return {
    preferences,
    setTheme,
    setLayout,
    toggleStats,
    toggleWeekStrip,
    toggleMotto,
    resetPreferences,
  };
}
