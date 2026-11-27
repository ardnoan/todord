import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type { Json } from "../types";
import type { AppParameterSettings } from "../lib/finance/types";

const STORAGE_KEY = "ruang.app.parameters.v1";

export const DEFAULT_APP_PARAMETERS: AppParameterSettings = {
  currencyLocale: "id-ID",
  currencyCode: "IDR",
  budgetWarningThresholdPercent: 80,
  defaultTransactionStatus: "cleared",
  defaultAccountColor: "#397a60",
  defaultAccountIcon: "wallet",
  taskCategories: ["Personal", "Work", "Study"],
  defaultFinanceExpenseCategories: [
    "Makan & Minum",
    "Transportasi",
    "Tagihan & Utilitas",
    "Belanja",
    "Kesehatan",
    "Hiburan",
  ],
  defaultFinanceIncomeCategories: ["Gaji", "Bonus", "Freelance", "Investasi"],
  enableFinanceModule: true,
};

/**
 * Determines whether the authenticated Supabase user has admin privileges
 * for managing application parameter values.
 * Uses Supabase Auth metadata or VITE_ADMIN_EMAILS without creating a custom users table.
 */
export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const appRole = user.app_metadata?.role;
  if (appRole === "admin") return true;

  const envAdmins = import.meta.env.VITE_ADMIN_EMAILS as string | undefined;
  if (envAdmins && user.email) {
    const list = envAdmins
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (list.includes(user.email.toLowerCase())) return true;
  }

  return false;
}

function mergeParameters(
  parsed: Partial<AppParameterSettings>
): AppParameterSettings {
  return {
    ...DEFAULT_APP_PARAMETERS,
    ...parsed,
    taskCategories:
      Array.isArray(parsed.taskCategories) && parsed.taskCategories.length > 0
        ? parsed.taskCategories
        : DEFAULT_APP_PARAMETERS.taskCategories,
    defaultFinanceExpenseCategories: Array.isArray(
      parsed.defaultFinanceExpenseCategories
    )
      ? parsed.defaultFinanceExpenseCategories
      : DEFAULT_APP_PARAMETERS.defaultFinanceExpenseCategories,
    defaultFinanceIncomeCategories: Array.isArray(
      parsed.defaultFinanceIncomeCategories
    )
      ? parsed.defaultFinanceIncomeCategories
      : DEFAULT_APP_PARAMETERS.defaultFinanceIncomeCategories,
  };
}

function loadParameters(): AppParameterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_PARAMETERS;
    return mergeParameters(JSON.parse(raw) as Partial<AppParameterSettings>);
  } catch {
    return DEFAULT_APP_PARAMETERS;
  }
}

export function useAppParameters(user?: User | null) {
  const [parameters, setParameters] = useState<AppParameterSettings>(() =>
    loadParameters()
  );

  // Sync global parameters from Supabase app_parameters table when authenticated
  useEffect(() => {
    if (!user || !supabase) return;
    let cancelled = false;
    supabase
      .from("app_parameters")
      .select("settings")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || cancelled || !data?.settings) return;
        const merged = mergeParameters(
          data.settings as Partial<AppParameterSettings>
        );
        setParameters(merged);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const persistGlobal = useCallback(
    (next: AppParameterSettings) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota error
      }
      if (supabase && user && isAdminUser(user)) {
        supabase
          .from("app_parameters")
          .upsert({
            id: 1,
            settings: next as unknown as Json,
            updated_by: user.id,
          })
          .then(({ error }) => {
            if (error) {
              console.error("app_parameters upsert error:", error.message);
            }
          });
      }
    },
    [user]
  );

  const updateParameters = useCallback(
    (patch: Partial<AppParameterSettings>) => {
      setParameters((prev) => {
        const next = { ...prev, ...patch };
        persistGlobal(next);
        return next;
      });
    },
    [persistGlobal]
  );

  const resetParameters = useCallback(() => {
    setParameters(DEFAULT_APP_PARAMETERS);
    persistGlobal(DEFAULT_APP_PARAMETERS);
  }, [persistGlobal]);

  return {
    parameters,
    updateParameters,
    resetParameters,
  };
}
