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
  RecurringFrequency,
  TransactionStatus,
  TransactionType,
} from "../lib/finance/types";
import { executeRecurringLocally } from "../lib/finance/recurring";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase belum dikonfigurasi.");
  }
  return supabase;
}

export async function fetchFinanceBundle(userId: string) {
  const client = requireSupabase();
  const [accRes, catRes, txRes, budRes, recRes] = await Promise.all([
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
      .from("finance_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),
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
  if (txRes.error) throw txRes.error;
  if (budRes.error) throw budRes.error;
  if (recRes.error) throw recRes.error;

  return {
    accounts: (accRes.data ?? []).map((a) => ({
      ...a,
      opening_balance: Number(a.opening_balance),
    })) as FinanceAccount[],
    categories: (catRes.data ?? []) as FinanceCategory[],
    transactions: (txRes.data ?? []).map((t) => ({
      ...t,
      amount: Number(t.amount),
    })) as FinanceTransaction[],
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
  userId: string,
  accountId: string
): Promise<void> {
  const client = requireSupabase();
  const { error: recErr } = await client
    .from("finance_recurring_transactions")
    .delete()
    .eq("user_id", userId)
    .eq("account_id", accountId);
  if (recErr) throw recErr;

  const { error: txErr } = await client
    .from("finance_transactions")
    .delete()
    .eq("user_id", userId)
    .or(`account_id.eq.${accountId},transfer_account_id.eq.${accountId}`);
  if (txErr) throw txErr;

  const { error: accErr } = await client
    .from("finance_accounts")
    .delete()
    .eq("id", accountId)
    .eq("user_id", userId);
  if (accErr) throw accErr;
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
    transfer_account_id: input.type === "transfer" ? input.transfer_account_id : null,
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
    return { ...data, limit_amount: Number(data.limit_amount) } as FinanceBudget;
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
    return { ...data, amount: Number(data.amount) } as FinanceRecurringTransaction;
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
  return { ...data, amount: Number(data.amount) } as FinanceRecurringTransaction;
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
  userId: string,
  rule: FinanceRecurringTransaction,
  executionDate: string
): Promise<{ executed: boolean; reason?: string }> {
  const client = requireSupabase();
  // Prefer atomic DB RPC
  const { data, error } = await client.rpc("execute_finance_recurring", {
    p_recurring_id: rule.id,
    p_execution_date: executionDate,
  });

  if (!error && data && typeof data === "object" && !Array.isArray(data)) {
    const res = data as { executed?: boolean; reason?: string };
    return { executed: Boolean(res.executed), reason: res.reason };
  }

  // Fallback to idempotent guarded client sequence if RPC is not deployed yet
  const local = executeRecurringLocally(rule, executionDate);
  if (!local.executed || !local.createdTransaction) {
    return { executed: false, reason: local.reason };
  }

  // Conditional update first with optimistic lock on last_processed_date/next_due_date
  const { data: updatedRows, error: updErr } = await client
    .from("finance_recurring_transactions")
    .update({
      last_processed_date: local.updatedRecurring.last_processed_date,
      next_due_date: local.updatedRecurring.next_due_date,
    })
    .eq("id", rule.id)
    .eq("user_id", userId)
    .eq("next_due_date", rule.next_due_date)
    .select("id");

  if (updErr) throw updErr;
  if (!updatedRows || updatedRows.length === 0) {
    return { executed: false, reason: "already_processed" };
  }

  const { error: txErr } = await client.from("finance_transactions").insert({
    user_id: userId,
    account_id: local.createdTransaction.account_id,
    category_id: local.createdTransaction.category_id,
    amount: local.createdTransaction.amount,
    type: local.createdTransaction.type,
    status: local.createdTransaction.status,
    transaction_date: local.createdTransaction.transaction_date,
    title: local.createdTransaction.title,
    notes: local.createdTransaction.notes,
  });
  if (txErr) throw txErr;

  return { executed: true };
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
