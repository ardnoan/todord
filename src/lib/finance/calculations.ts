import type {
  AccountBalanceSummary,
  AccountReportRow,
  BudgetProgress,
  CategoryReportRow,
  CategoryType,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceTransaction,
  MonthlyReportRow,
  PeriodSummary,
} from "./types";

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

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatRupiah(
  amount: number,
  locale = "id-ID",
  currency = "IDR"
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function getTransactionYearMonth(dateStr: string): {
  year: number;
  month: number;
} {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return { year: 0, month: 0 };
  }
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
  };
}

/**
 * Running balance = opening_balance + sum of all stored transaction effects.
 * - income: +amount on account_id
 * - expense: -amount on account_id
 * - transfer: -amount on account_id, +amount on transfer_account_id
 * - adjustment: +amount on account_id (supports positive or negative amount)
 */
export function calculateAccountBalance(
  account: FinanceAccount,
  transactions: FinanceTransaction[]
): number {
  let balance = Number(account.opening_balance) || 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === "income" && tx.account_id === account.id) {
      balance += amt;
    } else if (tx.type === "expense" && tx.account_id === account.id) {
      balance -= amt;
    } else if (tx.type === "transfer") {
      if (tx.account_id === account.id) balance -= amt;
      if (tx.transfer_account_id === account.id) balance += amt;
    } else if (tx.type === "adjustment" && tx.account_id === account.id) {
      balance += amt;
    }
  }

  return roundMoney(balance);
}

export function calculateAllAccountBalances(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[]
): AccountBalanceSummary[] {
  return accounts.map((account) => {
    const openingBalance = roundMoney(Number(account.opening_balance) || 0);
    let totalInflow = 0;
    let totalOutflow = 0;
    let transactionCount = 0;

    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income" && tx.account_id === account.id) {
        totalInflow += amt;
        transactionCount += 1;
      } else if (tx.type === "expense" && tx.account_id === account.id) {
        totalOutflow += amt;
        transactionCount += 1;
      } else if (tx.type === "transfer") {
        if (tx.account_id === account.id) {
          totalOutflow += amt;
          transactionCount += 1;
        }
        if (tx.transfer_account_id === account.id) {
          totalInflow += amt;
          transactionCount += 1;
        }
      } else if (tx.type === "adjustment" && tx.account_id === account.id) {
        if (amt >= 0) totalInflow += amt;
        else totalOutflow += Math.abs(amt);
        transactionCount += 1;
      }
    }

    const currentBalance = roundMoney(openingBalance + totalInflow - totalOutflow);

    return {
      account,
      openingBalance,
      currentBalance,
      totalInflow: roundMoney(totalInflow),
      totalOutflow: roundMoney(totalOutflow),
      transactionCount,
    };
  });
}

export function calculateTotalNetBalance(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[],
  includeInactive = false
): number {
  const summaries = calculateAllAccountBalances(accounts, transactions);
  const total = summaries
    .filter((s) => includeInactive || s.account.is_active)
    .reduce((acc, s) => acc + s.currentBalance, 0);
  return roundMoney(total);
}

export function calculatePeriodSummary(
  transactions: FinanceTransaction[],
  month: number,
  year: number
): PeriodSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let transferVolume = 0;
  let adjustmentNet = 0;
  let transactionCount = 0;

  for (const tx of transactions) {
    const ym = getTransactionYearMonth(tx.transaction_date);
    if (ym.year !== year || ym.month !== month) continue;

    const amt = Number(tx.amount) || 0;
    transactionCount += 1;

    if (tx.type === "income") totalIncome += amt;
    else if (tx.type === "expense") totalExpense += amt;
    else if (tx.type === "transfer") transferVolume += amt;
    else if (tx.type === "adjustment") adjustmentNet += amt;
  }

  return {
    month,
    year,
    totalIncome: roundMoney(totalIncome),
    totalExpense: roundMoney(totalExpense),
    netCashflow: roundMoney(totalIncome - totalExpense),
    transferVolume: roundMoney(transferVolume),
    adjustmentNet: roundMoney(adjustmentNet),
    transactionCount,
  };
}

export function calculateBudgetProgress(
  budgets: FinanceBudget[],
  categories: FinanceCategory[],
  transactions: FinanceTransaction[],
  month: number,
  year: number,
  warningThresholdPercent = 80
): BudgetProgress[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return budgets
    .filter((b) => b.month === month && b.year === year)
    .map((budget) => {
      const category = categoryMap.get(budget.category_id);
      const limitAmount = roundMoney(Number(budget.limit_amount) || 0);

      let spent = 0;
      for (const tx of transactions) {
        if (tx.type !== "expense") continue;
        if (tx.category_id !== budget.category_id) continue;
        const ym = getTransactionYearMonth(tx.transaction_date);
        if (ym.year === year && ym.month === month) {
          spent += Number(tx.amount) || 0;
        }
      }

      const spentAmount = roundMoney(spent);
      const remainingAmount = roundMoney(limitAmount - spentAmount);
      const percentage =
        limitAmount > 0
          ? Math.round((spentAmount / limitAmount) * 1000) / 10
          : spentAmount > 0
          ? 100
          : 0;

      return {
        budget,
        category,
        limitAmount,
        spentAmount,
        remainingAmount,
        percentage,
        isOverBudget: spentAmount > limitAmount,
        isWarning:
          spentAmount <= limitAmount && percentage >= warningThresholdPercent,
      };
    });
}

export function calculateMonthlyReport(
  transactions: FinanceTransaction[],
  year: number
): MonthlyReportRow[] {
  const rows: MonthlyReportRow[] = MONTH_LABELS_ID.map((label, idx) => ({
    month: idx + 1,
    label,
    income: 0,
    expense: 0,
    net: 0,
  }));

  for (const tx of transactions) {
    const ym = getTransactionYearMonth(tx.transaction_date);
    if (ym.year !== year || ym.month < 1 || ym.month > 12) continue;
    const row = rows[ym.month - 1];
    const amt = Number(tx.amount) || 0;
    if (tx.type === "income") row.income += amt;
    else if (tx.type === "expense") row.expense += amt;
  }

  return rows.map((r) => ({
    ...r,
    income: roundMoney(r.income),
    expense: roundMoney(r.expense),
    net: roundMoney(r.income - r.expense),
  }));
}

export function calculateCategoryReport(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  filterType: CategoryType,
  month?: number,
  year?: number
): CategoryReportRow[] {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<
    string,
    { categoryId: string | null; name: string; total: number; count: number; color: string }
  >();

  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== filterType) continue;
    if (month !== undefined && year !== undefined) {
      const ym = getTransactionYearMonth(tx.transaction_date);
      if (ym.year !== year || ym.month !== month) continue;
    }

    const amt = Number(tx.amount) || 0;
    grandTotal += amt;

    const cat = tx.category_id ? categoryMap.get(tx.category_id) : undefined;
    const key = cat?.id ?? "__uncategorized__";
    const existing = buckets.get(key) ?? {
      categoryId: cat?.id ?? null,
      name: cat?.name ?? "Tanpa Kategori",
      total: 0,
      count: 0,
      color: cat?.color ?? "#8b929b",
    };
    existing.total += amt;
    existing.count += 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.values())
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.name,
      type: filterType,
      total: roundMoney(item.total),
      count: item.count,
      sharePercent:
        grandTotal > 0 ? Math.round((item.total / grandTotal) * 1000) / 10 : 0,
      color: item.color,
    }))
    .sort((a, b) => b.total - a.total);
}

export function calculateAccountReport(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[]
): AccountReportRow[] {
  return calculateAllAccountBalances(accounts, transactions).map((s) => ({
    accountId: s.account.id,
    accountName: s.account.name,
    accountType: s.account.type,
    isActive: s.account.is_active,
    openingBalance: s.openingBalance,
    inflow: s.totalInflow,
    outflow: s.totalOutflow,
    netChange: roundMoney(s.totalInflow - s.totalOutflow),
    currentBalance: s.currentBalance,
  }));
}
