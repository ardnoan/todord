import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { Json, LayoutMode, ThemeId, ThemePreferences } from "../types";

const LEGACY_STORAGE_KEY = "ruang_theme_preferences_v1";

function getUserCacheKey(userId: string) {
  return `ruang_theme_preferences_v2_${userId}`;
}

const defaultPreferences: ThemePreferences = {
  theme: "sage",
  layout: "list",
  showMotto: true,
};

export function useThemePreferences(userId?: string) {
  const [preferences, setPreferences] = useState<ThemePreferences>(() => {
    try {
      const key = userId ? getUserCacheKey(userId) : LEGACY_STORAGE_KEY;
      const stored =
        localStorage.getItem(key) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch {
      // ignore JSON parse error
    }
    return defaultPreferences;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", preferences.theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const color = preferences.theme === "dark" ? "#161b22" : "#f7f8fa";
      metaTheme.setAttribute("content", color);
    }
    if (userId) {
      try {
        localStorage.setItem(
          getUserCacheKey(userId),
          JSON.stringify(preferences)
        );
      } catch {
        // ignore write error
      }
    }
  }, [preferences, userId]);

  // Load & migrate per-user preferences from Supabase
  useEffect(() => {
    if (!userId || !supabase) return;
    const client = supabase;
    let cancelled = false;

    async function syncFromCloud() {
      if (!userId) return;
      const { data, error } = await client
        .from("user_preferences")
        .select("theme_preferences")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || cancelled) return;

      const cloudPrefs =
        data?.theme_preferences &&
        typeof data.theme_preferences === "object" &&
        !Array.isArray(data.theme_preferences)
          ? (data.theme_preferences as Partial<ThemePreferences>)
          : null;

      if (cloudPrefs && Object.keys(cloudPrefs).length > 0) {
        setPreferences({ ...defaultPreferences, ...cloudPrefs });
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } else {
        // Migrate legacy localStorage preference once
        try {
          const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacyRaw) {
            const parsed = {
              ...defaultPreferences,
              ...(JSON.parse(legacyRaw) as Partial<ThemePreferences>),
            };
            setPreferences(parsed);
            await client.from("user_preferences").upsert({
              user_id: userId,
              theme_preferences: parsed as unknown as Json,
            });
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        } catch {
          // ignore
        }
      }
    }

    syncFromCloud();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persistToCloud = useCallback(
    (next: ThemePreferences) => {
      if (!userId || !supabase) return;
      supabase
        .from("user_preferences")
        .upsert({
          user_id: userId,
          theme_preferences: next as unknown as Json,
        })
        .then(({ error }) => {
          if (error) {
            console.error("user_preferences upsert error:", error.message);
          }
        });
    },
    [userId]
  );

  const setTheme = useCallback(
    (theme: ThemeId) => {
      setPreferences((prev) => {
        const next = { ...prev, theme };
        persistToCloud(next);
        return next;
      });
    },
    [persistToCloud]
  );

  const setLayout = useCallback(
    (layout: LayoutMode) => {
      setPreferences((prev) => {
        const next = { ...prev, layout };
        persistToCloud(next);
        return next;
      });
    },
    [persistToCloud]
  );

  const toggleMotto = useCallback(() => {
    setPreferences((prev) => {
      const next = { ...prev, showMotto: !prev.showMotto };
      persistToCloud(next);
      return next;
    });
  }, [persistToCloud]);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    persistToCloud(defaultPreferences);
  }, [persistToCloud]);

  return {
    preferences,
    setTheme,
    setLayout,
    toggleMotto,
    resetPreferences,
  };
}
