import { describe, expect, it } from "vitest";
import {
  calculateAccountBalance,
  calculateAllAccountBalances,
  calculateBudgetProgress,
  calculateMonthlyReport,
  calculatePeriodSummary,
  calculateTotalNetBalance,
} from "../calculations";
import {
  exportFinanceCsvBundle,
  prepareCsvImportPreview,
} from "../csv";
import { advanceNextDueDate, executeRecurringLocally } from "../recurring";
import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringTransaction,
  FinanceTransaction,
} from "../types";
import {
  validateBudgetInput,
  validateCategoryHierarchy,
  validateTransactionInput,
} from "../validation";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ACC_CASH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ACC_BANK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const ACC_INACTIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const ACC_USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const CAT_INC = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const CAT_EXP_PARENT = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const CAT_EXP_CHILD = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";

const NOW = "2026-11-25T00:00:00.000Z";

function makeAccount(
  id: string,
  userId: string,
  openingBalance: number,
  isActive = true
): FinanceAccount {
  return {
    id,
    user_id: userId,
    name: `Acc ${id.slice(-1)}`,
    type: "bank",
    opening_balance: openingBalance,
    color: "#397a60",
    icon: "bank",
    is_active: isActive,
    created_at: NOW,
    updated_at: NOW,
  };
}

describe("Finance balance, transfer & adjustment calculations", () => {
  it("computes running balance from opening_balance + income, expense, transfer, and positive/negative adjustment", () => {
    const cash = makeAccount(ACC_CASH, USER_A, 100_000);
    const bank = makeAccount(ACC_BANK, USER_A, 500_000);
    const inactive = makeAccount(ACC_INACTIVE, USER_A, 50_000, false);

    const txs: FinanceTransaction[] = [
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        user_id: USER_A,
        account_id: ACC_BANK,
        transfer_account_id: null,
        category_id: CAT_INC,
        amount: 1_000_000,
        type: "income",
        status: "cleared",
        reference_no: null,
        transaction_date: "2026-11-05T00:00:00.000Z",
        title: "Gaji",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
        user_id: USER_A,
        account_id: ACC_BANK,
        transfer_account_id: ACC_CASH,
        category_id: null,
        amount: 250_000,
        type: "transfer",
        status: "cleared",
        reference_no: null,
        transaction_date: "2026-11-06T00:00:00.000Z",
        title: "Tarik Tunai",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
        user_id: USER_A,
        account_id: ACC_CASH,
        transfer_account_id: null,
        category_id: CAT_EXP_CHILD,
        amount: 45_000,
        type: "expense",
        status: "pending",
        reference_no: null,
        transaction_date: "2026-11-07T00:00:00.000Z",
        title: "Makan",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
        user_id: USER_A,
        account_id: ACC_CASH,
        transfer_account_id: null,
        category_id: null,
        amount: -5_000,
        type: "adjustment",
        status: "reconciled",
        reference_no: null,
        transaction_date: "2026-11-08T00:00:00.000Z",
        title: "Selisih kas",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd5",
        user_id: USER_A,
        account_id: ACC_BANK,
        transfer_account_id: null,
        category_id: null,
        amount: 20_000,
        type: "adjustment",
        status: "cleared",
        reference_no: null,
        transaction_date: "2026-11-09T00:00:00.000Z",
        title: "Koreksi positif",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    // Bank: 500,000 + 1,000,000 - 250,000 + 20,000 = 1,270,000
    expect(calculateAccountBalance(bank, txs)).toBe(1_270_000);
    // Cash: 100,000 + 250,000 - 45,000 - 5,000 = 300,000
    expect(calculateAccountBalance(cash, txs)).toBe(300_000);
    // Inactive account retains its opening_balance + history
    expect(calculateAccountBalance(inactive, txs)).toBe(50_000);
    // Total net balance excludes inactive accounts by default
    expect(calculateTotalNetBalance([cash, bank, inactive], txs)).toBe(1_570_000);

    const period = calculatePeriodSummary(txs, 11, 2026);
    expect(period.totalIncome).toBe(1_000_000);
    expect(period.totalExpense).toBe(45_000);
    expect(period.netCashflow).toBe(955_000);
    expect(period.transferVolume).toBe(250_000);

    const monthly = calculateMonthlyReport(txs, 2026);
    expect(monthly[10].income).toBe(1_000_000);
    expect(monthly[10].expense).toBe(45_000);
  });

  it("calculates budget spent_amount from expense transactions in the same period", () => {
    const categories: FinanceCategory[] = [
      {
        id: CAT_EXP_PARENT,
        user_id: USER_A,
        name: "Makanan",
        type: "expense",
        icon: null,
        color: "#ef4444",
        parent_id: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ];
    const budgets: FinanceBudget[] = [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
        user_id: USER_A,
        category_id: CAT_EXP_PARENT,
        limit_amount: 100_000,
        month: 11,
        year: 2026,
        created_at: NOW,
        updated_at: NOW,
      },
    ];
    const txs: FinanceTransaction[] = [
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        user_id: USER_A,
        account_id: ACC_CASH,
        transfer_account_id: null,
        category_id: CAT_EXP_PARENT,
        amount: 85_000,
        type: "expense",
        status: "cleared",
        reference_no: null,
        transaction_date: "2026-11-10T00:00:00.000Z",
        title: "Belanja",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
        user_id: USER_A,
        account_id: ACC_CASH,
        transfer_account_id: null,
        category_id: CAT_EXP_PARENT,
        amount: 50_000,
        type: "expense",
        status: "cleared",
        reference_no: null,
        transaction_date: "2026-10-10T00:00:00.000Z", // different month
        title: "Bulan lalu",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    const progress = calculateBudgetProgress(
      budgets,
      categories,
      txs,
      11,
      2026,
      80
    );
    expect(progress).toHaveLength(1);
    expect(progress[0].spentAmount).toBe(85_000);
    expect(progress[0].remainingAmount).toBe(15_000);
    expect(progress[0].isWarning).toBe(true);
    expect(progress[0].isOverBudget).toBe(false);
  });
});

describe("User isolation & domain validation", () => {
  it("rejects cross-user account/category references and mismatched category types", () => {
    const accounts = [
      makeAccount(ACC_CASH, USER_A, 0),
      makeAccount(ACC_USER_B, USER_B, 0),
    ];
    const categories: FinanceCategory[] = [
      {
        id: CAT_INC,
        user_id: USER_A,
        name: "Gaji",
        type: "income",
        icon: null,
        color: null,
        parent_id: null,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: CAT_EXP_PARENT,
        user_id: USER_A,
        name: "Makan",
        type: "expense",
        icon: null,
        color: null,
        parent_id: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    // Cross-user account rejected
    expect(
      validateTransactionInput({
        user_id: USER_A,
        account_id: ACC_USER_B,
        transfer_account_id: null,
        category_id: null,
        amount: 10_000,
        type: "expense",
        status: "cleared",
        title: "Test",
        accounts,
        categories,
      })
    ).not.toBeNull();

    // Child category with different type than parent rejected
    expect(
      validateCategoryHierarchy({
        user_id: USER_A,
        type: "expense",
        parent_id: CAT_INC,
        categories,
      })
    ).not.toBeNull();

    // Budget on income category rejected
    expect(
      validateBudgetInput({
        user_id: USER_A,
        category_id: CAT_INC,
        limit_amount: 500_000,
        month: 11,
        year: 2026,
        categories,
      })
    ).not.toBeNull();
  });
});

describe("Idempotent recurring execution", () => {
  it("creates a single transaction, advances next_due_date, and prevents duplicate execution", () => {
    const rule: FinanceRecurringTransaction = {
      id: "ffffffff-ffff-4fff-8fff-fffffffffff1",
      user_id: USER_A,
      account_id: ACC_BANK,
      category_id: CAT_EXP_PARENT,
      amount: 150_000,
      type: "expense",
      title: "Internet Bulanan",
      frequency: "monthly",
      start_date: "2026-01-31",
      next_due_date: "2026-01-31",
      last_processed_date: null,
      is_active: true,
      notes: null,
      created_at: NOW,
      updated_at: NOW,
    };

    const first = executeRecurringLocally(rule, "2026-01-31");
    expect(first.executed).toBe(true);
    expect(first.createdTransaction).not.toBeNull();
    expect(first.updatedRecurring.last_processed_date).toBe("2026-01-31");
    // Month-end clamping: Jan 31 -> Feb 28 (2026 is not leap year)
    expect(first.updatedRecurring.next_due_date).toBe("2026-02-28");

    // Re-running on same date must NOT duplicate
    const second = executeRecurringLocally(
      first.updatedRecurring,
      "2026-01-31"
    );
    expect(second.executed).toBe(false);
    expect(second.createdTransaction).toBeNull();
    expect(second.reason).toBe("not_due");

    // Yearly date advance
    expect(advanceNextDueDate("2024-02-29", "yearly")).toBe("2025-02-28");
  });
});

describe("CSV export & transactional import round-trip", () => {
  it("exports only current user rows, remaps user_id on import, orders parent categories first, and preserves balances", () => {
    const accounts: FinanceAccount[] = [
      makeAccount(ACC_CASH, USER_A, 100_000),
      makeAccount(ACC_BANK, USER_A, 400_000),
      makeAccount(ACC_USER_B, USER_B, 999_999), // must be excluded on export
    ];
    const categories: FinanceCategory[] = [
      // Deliberately put child before parent in source array to verify 2-pass ordering
      {
        id: CAT_EXP_CHILD,
        user_id: USER_A,
        name: "Kopi",
        type: "expense",
        icon: null,
        color: null,
        parent_id: CAT_EXP_PARENT,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: CAT_EXP_PARENT,
        user_id: USER_A,
        name: "Minuman",
        type: "expense",
        icon: null,
        color: null,
        parent_id: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ];
    const transactions: FinanceTransaction[] = [
      {
        id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        user_id: USER_A,
        account_id: ACC_BANK,
        transfer_account_id: ACC_CASH,
        category_id: null,
        amount: 50_000,
        type: "transfer",
        status: "cleared",
        reference_no: "TRF-01",
        transaction_date: "2026-11-15T00:00:00.000Z",
        title: "Topup Kas",
        notes: "Catatan, dengan koma",
        created_at: NOW,
        updated_at: NOW,
      },
    ];
    const budgets: FinanceBudget[] = [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
        user_id: USER_A,
        category_id: CAT_EXP_CHILD,
        limit_amount: 200_000,
        month: 11,
        year: 2026,
        created_at: NOW,
        updated_at: NOW,
      },
    ];
    const recurring: FinanceRecurringTransaction[] = [
      {
        id: "ffffffff-ffff-4fff-8fff-fffffffffff1",
        user_id: USER_A,
        account_id: ACC_CASH,
        category_id: CAT_EXP_CHILD,
        amount: 25_000,
        type: "expense",
        title: "Langganan",
        frequency: "weekly",
        start_date: "2026-11-01",
        next_due_date: "2026-11-08",
        last_processed_date: "2026-11-01",
        is_active: true,
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      },
    ];

    const bundle = exportFinanceCsvBundle({
      currentUserId: USER_A,
      accounts,
      categories,
      transactions,
      budgets,
      recurring,
    });

    // User B's account must NOT appear in exported CSV
    expect(bundle.accounts).not.toContain(ACC_USER_B);

    // Import into USER_B's workspace: all user_id values must remap to USER_B
    const preview = prepareCsvImportPreview({
      currentUserId: USER_B,
      csvTexts: bundle,
      existingAccounts: [],
      existingCategories: [],
      existingTransactions: [],
      existingBudgets: [],
      existingRecurring: [],
    });

    expect(preview.hasFatalErrors).toBe(false);
    expect(preview.counts.accounts).toBe(2);
    expect(preview.counts.categories).toBe(2);
    expect(preview.counts.transactions).toBe(1);
    expect(preview.counts.budgets).toBe(1);
    expect(preview.counts.recurring).toBe(1);

    // Remapped to USER_B
    expect(preview.payload.accounts.every((a) => a.user_id === USER_B)).toBe(
      true
    );
    expect(
      preview.payload.transactions[0].notes
    ).toBe("Catatan, dengan koma");

    // Two-pass category order: parent_id === null comes first
    expect(preview.payload.categories[0].parent_id).toBeNull();
    expect(preview.payload.categories[1].parent_id).toBe(CAT_EXP_PARENT);

    // Recalculate balances after import
    const balances = calculateAllAccountBalances(
      preview.payload.accounts,
      preview.payload.transactions
    );
    const importedCash = balances.find((b) => b.account.id === ACC_CASH);
    const importedBank = balances.find((b) => b.account.id === ACC_BANK);
    expect(importedCash?.currentBalance).toBe(150_000);
    expect(importedBank?.currentBalance).toBe(350_000);
  });

  it("blocks import on fatal validation errors and flags duplicate IDs", () => {
    const existingAcc = makeAccount(ACC_CASH, USER_A, 100_000);
    const badTxCsv = [
      "id,user_id,account_id,transfer_account_id,category_id,amount,type,status,reference_no,transaction_date,title,notes,created_at,updated_at",
      `dddddddd-dddd-4ddd-8ddd-ddddddddddd1,${USER_A},${ACC_CASH},,,-500,expense,cleared,,2026-11-15T00:00:00.000Z,Negatif Expense,,${NOW},${NOW}`,
    ].join("\n");

    const preview = prepareCsvImportPreview({
      currentUserId: USER_A,
      csvTexts: {
        accounts: [
          "id,user_id,name,type,opening_balance,color,icon,is_active,created_at,updated_at",
          `${ACC_CASH},${USER_A},Cash,cash,100000,#397a60,wallet,true,${NOW},${NOW}`,
        ].join("\n"),
        transactions: badTxCsv,
      },
      existingAccounts: [existingAcc],
      existingCategories: [],
      existingTransactions: [],
      existingBudgets: [],
      existingRecurring: [],
    });

    expect(preview.hasFatalErrors).toBe(true);
    expect(preview.hasDuplicates).toBe(true);
    expect(preview.duplicateIds.accounts).toContain(ACC_CASH);
    expect(preview.errors.some((e) => e.field === "amount")).toBe(true);
  });

  it("imports legacy CSVs with numeric IDs, ending balance column, and header-only tables", () => {
    const legacyAccounts = [
      "id,user_id,name,type,balance,color,icon,is_active,created_at,updated_at",
      "8,8,BRI BRIMO,bank,3191820.00,#06529d,bi-bank,true,2026-08-09T07:18:24Z,2026-10-02T00:49:52Z",
      "27,8,Cash ,cash,371500.00,#3B82F6,bi-credit-card,true,2026-11-07T10:52:34Z,2026-11-07T10:52:34Z",
    ].join("\n");

    const legacyCategories = [
      "id,user_id,name,type,icon,color,parent_id,created_at,updated_at",
      "18,,Makanan & Minuman,expense,bi-cup-hot,#EF4444,,2026-08-09T03:56:05Z,2026-08-09T03:56:05Z",
      "34,,Belanja Groceries,expense,bi-cart3,#DC2626,18,2026-08-09T03:56:05Z,2026-08-09T03:56:05Z",
    ].join("\n");

    const legacyTransactions = [
      "id,user_id,account_id,transfer_account_id,category_id,amount,type,transaction_date,title,notes,status,reference_no,created_at,updated_at",
      "1225,8,27,,18,19000.00,expense,2026-11-07T12:00:00Z,Makan malam,,cleared,,2026-11-07T10:51:53Z,2026-11-07T10:53:34Z",
      "1226,8,8,27,,500000.00,transfer,2026-11-07T12:00:00Z,Ambil cash,,cleared,,2026-11-07T10:53:07Z,2026-11-07T10:53:07Z",
      "1227,8,27,,34,49500.00,expense,2026-11-07T12:00:00Z,Laundry ,,cleared,,2026-11-07T10:59:04Z,2026-11-07T10:59:04Z",
      "1236,8,27,,18,30000.00,expense,2026-11-14T12:00:00Z,nasi padang,,cleared,,2026-11-14T13:58:26Z,2026-11-14T13:58:26Z",
      "1238,8,27,,34,30000.00,expense,2026-11-15T12:00:00Z,\"beli telur, bawang, cabe\",,cleared,,2026-11-15T11:01:56Z,2026-11-15T11:01:56Z",
    ].join("\n");

    const emptyBudgets =
      "id,user_id,category_id,limit_amount,month,year,created_at,updated_at";
    const emptyRecurring =
      "id,user_id,account_id,category_id,amount,type,title,frequency,start_date,next_due_date,last_processed_date,is_active,notes,created_at,updated_at";

    const preview = prepareCsvImportPreview({
      currentUserId: USER_A,
      csvTexts: {
        accounts: legacyAccounts,
        categories: legacyCategories,
        transactions: legacyTransactions,
        budgets: emptyBudgets,
        recurring: emptyRecurring,
      },
      existingAccounts: [],
      existingCategories: [],
      existingTransactions: [],
      existingBudgets: [],
      existingRecurring: [],
    });

    expect(preview.hasFatalErrors).toBe(false);
    expect(preview.errors).toEqual([]);
    expect(preview.counts.accounts).toBe(2);
    expect(preview.counts.categories).toBe(2);
    expect(preview.counts.transactions).toBe(5);
    expect(preview.counts.budgets).toBe(0);
    expect(preview.counts.recurring).toBe(0);

    // Balances computed from back-calculated opening_balance + transactions must match CSV `balance`
    const balances = calculateAllAccountBalances(
      preview.payload.accounts,
      preview.payload.transactions
    );
    const cash = balances.find((b) => b.account.name === "Cash");
    const bri = balances.find((b) => b.account.name === "BRI BRIMO");
    expect(cash?.account.opening_balance).toBe(0);
    expect(cash?.currentBalance).toBe(371500);
    expect(bri?.currentBalance).toBe(3191820);

    // Re-importing accounts CSV alone when transactions already exist in DB
    // must still back-calculate opening_balance against existingTransactions
    const reimportAccountsOnly = prepareCsvImportPreview({
      currentUserId: USER_A,
      csvTexts: {
        accounts: legacyAccounts,
      },
      existingAccounts: preview.payload.accounts,
      existingCategories: preview.payload.categories,
      existingTransactions: preview.payload.transactions,
      existingBudgets: [],
      existingRecurring: [],
    });
    expect(reimportAccountsOnly.hasDuplicates).toBe(true);
    expect(reimportAccountsOnly.duplicateIds.accounts).toHaveLength(2);
    const reimportBalances = calculateAllAccountBalances(
      reimportAccountsOnly.payload.accounts,
      preview.payload.transactions
    );
    expect(
      reimportBalances.find((b) => b.account.name === "Cash")?.currentBalance
    ).toBe(371500);
    expect(
      reimportBalances.find((b) => b.account.name === "BRI BRIMO")?.currentBalance
    ).toBe(3191820);
  });
});
