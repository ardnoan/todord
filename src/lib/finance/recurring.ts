import type {
  FinanceRecurringTransaction,
  FinanceTransaction,
  RecurringFrequency,
} from "./types";

function parseIsoDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

function formatIsoDateParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}

export function advanceNextDueDate(
  currentDueDate: string,
  frequency: RecurringFrequency,
  anchorDay?: number
): string {
  const { year, month, day } = parseIsoDateParts(currentDueDate);
  const effectiveDay = anchorDay ?? day;

  if (frequency === "daily") {
    const dt = new Date(Date.UTC(year, month - 1, day + 1));
    return dt.toISOString().slice(0, 10);
  }
  if (frequency === "weekly") {
    const dt = new Date(Date.UTC(year, month - 1, day + 7));
    return dt.toISOString().slice(0, 10);
  }
  if (frequency === "monthly") {
    const targetMonthZeroBased = month; // next month (since month is 1-based)
    const targetYear = year + Math.floor(targetMonthZeroBased / 12);
    const normalizedMonth = (targetMonthZeroBased % 12) + 1;
    const daysInTargetMonth = new Date(
      Date.UTC(targetYear, normalizedMonth, 0)
    ).getUTCDate();
    const clampedDay = Math.min(effectiveDay, daysInTargetMonth);
    return formatIsoDateParts(targetYear, normalizedMonth, clampedDay);
  }

  // yearly
  const targetYear = year + 1;
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, month, 0)
  ).getUTCDate();
  const clampedDay = Math.min(effectiveDay, daysInTargetMonth);
  return formatIsoDateParts(targetYear, month, clampedDay);
}

export interface LocalRecurringExecutionResult {
  executed: boolean;
  reason?: "inactive" | "not_due" | "already_processed";
  updatedRecurring: FinanceRecurringTransaction;
  createdTransaction: FinanceTransaction | null;
}

/**
 * Pure idempotent execution for a recurring transaction.
 * Re-running on the same executionDate after next_due_date has been processed
 * will NOT create a duplicate transaction.
 */
export function executeRecurringLocally(
  recurring: FinanceRecurringTransaction,
  executionDate: string,
  generateId: () => string = () => crypto.randomUUID(),
  nowIso: string = new Date().toISOString()
): LocalRecurringExecutionResult {
  if (!recurring.is_active) {
    return {
      executed: false,
      reason: "inactive",
      updatedRecurring: recurring,
      createdTransaction: null,
    };
  }

  if (recurring.next_due_date > executionDate) {
    return {
      executed: false,
      reason: "not_due",
      updatedRecurring: recurring,
      createdTransaction: null,
    };
  }

  if (
    recurring.last_processed_date &&
    recurring.last_processed_date >= recurring.next_due_date
  ) {
    return {
      executed: false,
      reason: "already_processed",
      updatedRecurring: recurring,
      createdTransaction: null,
    };
  }

  const processedDate = recurring.next_due_date;
  const anchorDay = recurring.start_date
    ? parseIsoDateParts(recurring.start_date).day
    : undefined;
  const nextDueDate = advanceNextDueDate(
    processedDate,
    recurring.frequency,
    anchorDay
  );

  const createdTransaction: FinanceTransaction = {
    id: generateId(),
    user_id: recurring.user_id,
    account_id: recurring.account_id,
    transfer_account_id: null,
    category_id: recurring.category_id,
    amount: recurring.amount,
    type: recurring.type,
    status: "cleared",
    reference_no: null,
    transaction_date: `${processedDate}T00:00:00.000Z`,
    title: recurring.title,
    notes: recurring.notes,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const updatedRecurring: FinanceRecurringTransaction = {
    ...recurring,
    last_processed_date: processedDate,
    next_due_date: nextDueDate,
    updated_at: nowIso,
  };

  return {
    executed: true,
    updatedRecurring,
    createdTransaction,
  };
}
