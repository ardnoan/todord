import { supabase } from "../supabase";
import type { Json } from "../types";
import type {
  AccountType,
  CategoryType,
  CsvImportPayload,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringTransaction,
  FinanceTransaction,
  MonthlyReportRow,
  PeriodSummary,
  RecurringFrequency,
  TransactionStatus,
  TransactionType,
} from "../lib/finance/types";

const MONTH_LABELS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase belum dikonfigurasi.");
  }
  return supabase;
}

function formatRpcError(err: { code?: string; message?: string }): Error {
  const msg = err.message ?? "Kesalahan RPC Supabase.";
  if (
    err.code === "PGRST202" ||
    err.code === "42883" ||
    msg.includes("Could not find the function") ||
    msg.includes("does not exist")
  ) {
    return new Error(
      "Fungsi database belum tersedia. Jalankan file migrasi SQL terbaru (20261127_fase0_data_integrity.sql) di Supabase SQL Editor."
    );
  }
  return new Error(msg);
}

export interface FinanceAccountBalanceRow {
  account_id: string;
  opening_balance: number;
  total_inflow: number;
  total_outflow: number;
  current_balance: number;
  transaction_count: number;
}

export interface FinanceCategoryReportRpcRow {
  category_id: string | null;
  category_name: string;
  type: CategoryType;
  total: number;
  count: number;
  color: string;
}

export interface FinanceAggregates {
  accountBalances: FinanceAccountBalanceRow[];
  periodSummary: PeriodSummary;
  monthlyReport: MonthlyReportRow[];
  expenseCategoryReport: FinanceCategoryReportRpcRow[];
  incomeCategoryReport: FinanceCategoryReportRpcRow[];
  budgetSpentMap: Record<string, number>;
}

export async function fetchFinanceBundle(userId: string) {
  const client = requireSupabase();
  const [accRes, catRes, budRes, recRes] = await Promise.all([
    client
      .from("finance_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    client
      .from("finance_categories")
      .select("*")
      .eq("user_id", userId)
      .order("type", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("finance_budgets")
      .select("*")
      .eq("user_id", userId)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    client
      .from("finance_recurring_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("next_due_date", { ascending: true }),
  ]);

  if (accRes.error) throw accRes.error;
  if (catRes.error) throw catRes.error;
  if (budRes.error) throw budRes.error;
  if (recRes.error) throw recRes.error;

  return {
    accounts: (accRes.data ?? []).map((a) => ({
      ...a,
      opening_balance: Number(a.opening_balance),
    })) as FinanceAccount[],
    categories: (catRes.data ?? []) as FinanceCategory[],
    budgets: (budRes.data ?? []).map((b) => ({
      ...b,
      limit_amount: Number(b.limit_amount),
    })) as FinanceBudget[],
    recurring: (recRes.data ?? []).map((r) => ({
      ...r,
      amount: Number(r.amount),
    })) as FinanceRecurringTransaction[],
  };
}

export async function fetchFinanceTransactionsPage(
  userId: string,
  options: {
    month: number;
    year: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ rows: FinanceTransaction[]; hasMore: boolean }> {
  const client = requireSupabase();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const startUtc = new Date(
    Date.UTC(options.year, options.month - 1, 1, 0, 0, 0)
  ).toISOString();
  const endUtc = new Date(
    Date.UTC(options.year, options.month, 1, 0, 0, 0)
  ).toISOString();

  // Fetch limit + 1 rows to determine if there is a next page
  const { data, error } = await client
    .from("finance_transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", startUtc)
    .lt("transaction_date", endUtc)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) throw error;
  const all = (data ?? []).map((t) => ({
    ...t,
    amount: Number(t.amount),
  })) as FinanceTransaction[];

  const hasMore = all.length > limit;
  return {
    rows: hasMore ? all.slice(0, limit) : all,
    hasMore,
  };
}

export async function fetchAllFinanceTransactions(
  userId: string
): Promise<FinanceTransaction[]> {
  const client = requireSupabase();
  const pageSize = 500;
  const result: FinanceTransaction[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("finance_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const rows = (data ?? []).map((t) => ({
      ...t,
      amount: Number(t.amount),
    })) as FinanceTransaction[];
    result.push(...rows);

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return result;
}

export async function fetchFinanceAggregates(
  month: number,
  year: number
): Promise<FinanceAggregates> {
  const client = requireSupabase();
  const [balRes, periodRes, monthlyRes, expCatRes, incCatRes, budSpentRes] =
    await Promise.all([
      client.rpc("get_finance_account_balances"),
      client.rpc("get_finance_period_summary", {
        p_month: month,
        p_year: year,
      }),
      client.rpc("get_finance_monthly_report", { p_year: year }),
      client.rpc("get_finance_category_report", {
        p_type: "expense",
        p_month: month,
        p_year: year,
      }),
      client.rpc("get_finance_category_report", {
        p_type: "income",
        p_month: month,
        p_year: year,
      }),
      client.rpc("get_finance_budget_spent", {
        p_month: month,
        p_year: year,
      }),
    ]);

  if (balRes.error) throw formatRpcError(balRes.error);
  if (periodRes.error) throw formatRpcError(periodRes.error);
  if (monthlyRes.error) throw formatRpcError(monthlyRes.error);
  if (expCatRes.error) throw formatRpcError(expCatRes.error);
  if (incCatRes.error) throw formatRpcError(incCatRes.error);
  if (budSpentRes.error) throw formatRpcError(budSpentRes.error);

  const accountBalances: FinanceAccountBalanceRow[] = (
    (balRes.data ?? []) as Array<Record<string, unknown>>
  ).map((r) => ({
    account_id: String(r.account_id),
    opening_balance: Number(r.opening_balance ?? 0),
    total_inflow: Number(r.total_inflow ?? 0),
    total_outflow: Number(r.total_outflow ?? 0),
    current_balance: Number(r.current_balance ?? 0),
    transaction_count: Number(r.transaction_count ?? 0),
  }));

  const pRow = ((periodRes.data ?? []) as Array<Record<string, unknown>>)[0];
  const periodSummary: PeriodSummary = {
    month,
    year,
    totalIncome: Number(pRow?.total_income ?? 0),
    totalExpense: Number(pRow?.total_expense ?? 0),
    netCashflow: Number(pRow?.net_cashflow ?? 0),
    transferVolume: Number(pRow?.transfer_volume ?? 0),
    adjustmentNet: Number(pRow?.adjustment_net ?? 0),
    transactionCount: Number(pRow?.transaction_count ?? 0),
  };

  const monthlyReport: MonthlyReportRow[] = (
    (monthlyRes.data ?? []) as Array<Record<string, unknown>>
  ).map((r) => {
    const m = Number(r.month ?? 1);
    return {
      month: m,
      label: MONTH_LABELS_ID[m - 1] ?? String(m),
      income: Number(r.income ?? 0),
      expense: Number(r.expense ?? 0),
      net: Number(r.net ?? 0),
    };
  });

  const mapCat = (
    rows: Array<Record<string, unknown>>,
    type: CategoryType
  ): FinanceCategoryReportRpcRow[] =>
    rows.map((r) => ({
      category_id: r.category_id ? String(r.category_id) : null,
      category_name: String(r.category_name ?? "Tanpa Kategori"),
      type,
      total: Number(r.total ?? 0),
      count: Number(r.count ?? 0),
      color: String(r.color ?? "#8b929b"),
    }));

  const budgetSpentMap: Record<string, number> = {};
  for (const r of (budSpentRes.data ?? []) as Array<Record<string, unknown>>) {
    if (r.category_id) {
      budgetSpentMap[String(r.category_id)] = Number(r.spent_amount ?? 0);
    }
  }

  return {
    accountBalances,
    periodSummary,
    monthlyReport,
    expenseCategoryReport: mapCat(
      (expCatRes.data ?? []) as Array<Record<string, unknown>>,
      "expense"
    ),
    incomeCategoryReport: mapCat(
      (incCatRes.data ?? []) as Array<Record<string, unknown>>,
      "income"
    ),
    budgetSpentMap,
  };
}

export async function upsertFinanceAccount(
  userId: string,
  input: {
    id?: string;
    name: string;
    type: AccountType;
    opening_balance: number;
    color: string;
    icon: string;
    is_active: boolean;
  }
): Promise<FinanceAccount> {
  const client = requireSupabase();
  if (input.id) {
    const { data, error } = await client
      .from("finance_accounts")
      .update({
        name: input.name,
        type: input.type,
        opening_balance: input.opening_balance,
        color: input.color,
        icon: input.icon,
        is_active: input.is_active,
      })
      .eq("id", input.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return { ...data, opening_balance: Number(data.opening_balance) };
  }

  const { data, error } = await client
    .from("finance_accounts")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      opening_balance: input.opening_balance,
      color: input.color,
      icon: input.icon,
      is_active: input.is_active,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, opening_balance: Number(data.opening_balance) };
}

export async function deactivateOrDeleteAccount(
  userId: string,
  accountId: string,
  hasTransactions: boolean
): Promise<{ mode: "deactivated" | "deleted" }> {
  const client = requireSupabase();
  if (hasTransactions) {
    const { error } = await client
      .from("finance_accounts")
      .update({ is_active: false })
      .eq("id", accountId)
      .eq("user_id", userId);
    if (error) throw error;
    return { mode: "deactivated" };
  }

  const { error } = await client
    .from("finance_accounts")
    .delete()
    .eq("id", accountId)
    .eq("user_id", userId);
  if (error) throw error;
  return { mode: "deleted" };
}

export async function setAccountActiveStatus(
  userId: string,
  accountId: string,
  isActive: boolean
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("finance_accounts")
    .update({ is_active: isActive })
    .eq("id", accountId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteAccountPermanently(
  _userId: string,
  accountId: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc("delete_finance_account", {
    p_account_id: accountId,
  });
  if (error) throw formatRpcError(error);
}

export async function upsertFinanceCategory(
  userId: string,
  input: {
    id?: string;
    name: string;
    type: CategoryType;
    icon: string | null;
    color: string | null;
    parent_id: string | null;
  }
): Promise<FinanceCategory> {
  const client = requireSupabase();
  if (input.id) {
    const { data, error } = await client
      .from("finance_categories")
      .update({
        name: input.name,
        type: input.type,
        icon: input.icon,
        color: input.color,
        parent_id: input.parent_id,
      })
      .eq("id", input.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return data as FinanceCategory;
  }

  const { data, error } = await client
    .from("finance_categories")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      icon: input.icon,
      color: input.color,
      parent_id: input.parent_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as FinanceCategory;
}

export async function deleteFinanceCategory(
  userId: string,
  categoryId: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("finance_categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function upsertFinanceTransaction(
  userId: string,
  input: {
    id?: string;
    account_id: string;
    transfer_account_id: string | null;
    category_id: string | null;
    amount: number;
    type: TransactionType;
    status: TransactionStatus;
    reference_no: string | null;
    transaction_date: string;
    title: string;
    notes: string | null;
  }
): Promise<FinanceTransaction> {
  const client = requireSupabase();
  const payload = {
    account_id: input.account_id,
    transfer_account_id:
      input.type === "transfer" ? input.transfer_account_id : null,
    category_id: input.category_id,
    amount: input.amount,
    type: input.type,
    status: input.status,
    reference_no: input.reference_no,
    transaction_date: input.transaction_date,
    title: input.title,
    notes: input.notes,
  };

  if (input.id) {
    const { data, error } = await client
      .from("finance_transactions")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return { ...data, amount: Number(data.amount) } as FinanceTransaction;
  }

  const { data, error } = await client
    .from("finance_transactions")
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return { ...data, amount: Number(data.amount) } as FinanceTransaction;
}

export async function deleteFinanceTransaction(
  userId: string,
  transactionId: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("finance_transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function upsertFinanceBudget(
  userId: string,
  input: {
    id?: string;
    category_id: string;
    limit_amount: number;
    month: number;
    year: number;
  }
): Promise<FinanceBudget> {
  const client = requireSupabase();
  if (input.id) {
    const { data, error } = await client
      .from("finance_budgets")
      .update({
        category_id: input.category_id,
        limit_amount: input.limit_amount,
        month: input.month,
        year: input.year,
      })
      .eq("id", input.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      limit_amount: Number(data.limit_amount),
    } as FinanceBudget;
  }

  const { data, error } = await client
    .from("finance_budgets")
    .insert({
      user_id: userId,
      category_id: input.category_id,
      limit_amount: input.limit_amount,
      month: input.month,
      year: input.year,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, limit_amount: Number(data.limit_amount) } as FinanceBudget;
}

export async function deleteFinanceBudget(
  userId: string,
  budgetId: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("finance_budgets")
    .delete()
    .eq("id", budgetId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function upsertFinanceRecurring(
  userId: string,
  input: {
    id?: string;
    account_id: string;
    category_id: string | null;
    amount: number;
    type: CategoryType;
    title: string;
    frequency: RecurringFrequency;
    start_date: string;
    next_due_date: string;
    is_active: boolean;
    notes: string | null;
  }
): Promise<FinanceRecurringTransaction> {
  const client = requireSupabase();
  if (input.id) {
    const { data, error } = await client
      .from("finance_recurring_transactions")
      .update({
        account_id: input.account_id,
        category_id: input.category_id,
        amount: input.amount,
        type: input.type,
        title: input.title,
        frequency: input.frequency,
        start_date: input.start_date,
        next_due_date: input.next_due_date,
        is_active: input.is_active,
        notes: input.notes,
      })
      .eq("id", input.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      amount: Number(data.amount),
    } as FinanceRecurringTransaction;
  }

  const { data, error } = await client
    .from("finance_recurring_transactions")
    .insert({
      user_id: userId,
      account_id: input.account_id,
      category_id: input.category_id,
      amount: input.amount,
      type: input.type,
      title: input.title,
      frequency: input.frequency,
      start_date: input.start_date,
      next_due_date: input.next_due_date,
      is_active: input.is_active,
      notes: input.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    amount: Number(data.amount),
  } as FinanceRecurringTransaction;
}

export async function deleteFinanceRecurring(
  userId: string,
  recurringId: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from("finance_recurring_transactions")
    .delete()
    .eq("id", recurringId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function executeRecurringRule(
  _userId: string,
  rule: FinanceRecurringTransaction,
  executionDate: string
): Promise<{ executed: boolean; reason?: string; next_due_date?: string }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("execute_finance_recurring", {
    p_recurring_id: rule.id,
    p_execution_date: executionDate,
  });

  if (error) {
    throw formatRpcError(error);
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const res = data as {
      executed?: boolean;
      reason?: string;
      next_due_date?: string;
    };
    return {
      executed: Boolean(res.executed),
      reason: res.reason,
      next_due_date: res.next_due_date,
    };
  }

  throw new Error(
    "Respons RPC execute_finance_recurring tidak valid. Pastikan migrasi SQL terbaru sudah dijalankan."
  );
}

export async function commitCsvImport(
  payload: CsvImportPayload,
  allowUpsert: boolean
): Promise<Json> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("import_finance_data", {
    p_payload: payload as unknown as Json,
    p_upsert: allowUpsert,
  });
  if (error) throw error;
  return data;
}
