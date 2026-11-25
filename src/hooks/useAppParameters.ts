import { useCallback, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
  const userRole = user.user_metadata?.role;
  if (appRole === "admin" || userRole === "admin") return true;

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

function loadParameters(): AppParameterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_PARAMETERS;
    const parsed = JSON.parse(raw) as Partial<AppParameterSettings>;
    return {
      ...DEFAULT_APP_PARAMETERS,
      ...parsed,
      taskCategories:
        Array.isArray(parsed.taskCategories) && parsed.taskCategories.length > 0
          ? parsed.taskCategories
          : DEFAULT_APP_PARAMETERS.taskCategories,
      defaultFinanceExpenseCategories:
        Array.isArray(parsed.defaultFinanceExpenseCategories)
          ? parsed.defaultFinanceExpenseCategories
          : DEFAULT_APP_PARAMETERS.defaultFinanceExpenseCategories,
      defaultFinanceIncomeCategories:
        Array.isArray(parsed.defaultFinanceIncomeCategories)
          ? parsed.defaultFinanceIncomeCategories
          : DEFAULT_APP_PARAMETERS.defaultFinanceIncomeCategories,
    };
  } catch {
    return DEFAULT_APP_PARAMETERS;
  }
}

export function useAppParameters() {
  const [parameters, setParameters] = useState<AppParameterSettings>(() =>
    loadParameters()
  );

  const updateParameters = useCallback(
    (patch: Partial<AppParameterSettings>) => {
      setParameters((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota error
        }
        return next;
      });
    },
    []
  );

  const resetParameters = useCallback(() => {
    setParameters(DEFAULT_APP_PARAMETERS);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(DEFAULT_APP_PARAMETERS)
      );
    } catch {
      // ignore storage quota error
    }
  }, []);

  return {
    parameters,
    updateParameters,
    resetParameters,
  };
}
