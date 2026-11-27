import type {
  AccountType,
  CategoryType,
  CsvImportPayload,
  CsvImportPreview,
  CsvTableKey,
  CsvValidationError,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceRecurringTransaction,
  FinanceTransaction,
  RecurringFrequency,
  TransactionStatus,
  TransactionType,
} from "./types";
import {
  isValidUuid,
  VALID_ACCOUNT_TYPES,
  VALID_CATEGORY_TYPES,
  VALID_FREQUENCIES,
  VALID_TRANSACTION_STATUSES,
  VALID_TRANSACTION_TYPES,
} from "./validation";

export const CSV_FILENAMES: Record<CsvTableKey, string> = {
  accounts: "finance_accounts.csv",
  categories: "finance_categories.csv",
  transactions: "finance_transactions.csv",
  budgets: "finance_budgets.csv",
  recurring: "finance_recurring_transactions.csv",
};

export const CSV_HEADERS: Record<CsvTableKey, string[]> = {
  accounts: [
    "id",
    "user_id",
    "name",
    "type",
    "opening_balance",
    "color",
    "icon",
    "is_active",
    "created_at",
    "updated_at",
  ],
  categories: [
    "id",
    "user_id",
    "name",
    "type",
    "icon",
    "color",
    "parent_id",
    "created_at",
    "updated_at",
  ],
  transactions: [
    "id",
    "user_id",
    "account_id",
    "transfer_account_id",
    "category_id",
    "amount",
    "type",
    "status",
    "reference_no",
    "transaction_date",
    "title",
    "notes",
    "created_at",
    "updated_at",
  ],
  budgets: [
    "id",
    "user_id",
    "category_id",
    "limit_amount",
    "month",
    "year",
    "created_at",
    "updated_at",
  ],
  recurring: [
    "id",
    "user_id",
    "account_id",
    "category_id",
    "amount",
    "type",
    "title",
    "frequency",
    "start_date",
    "next_due_date",
    "last_processed_date",
    "is_active",
    "notes",
    "created_at",
    "updated_at",
  ],
};

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeCsv(
  headers: string[],
  rows: Record<string, unknown>[]
): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
  }
  return lines.join("\r\n");
}

export function exportFinanceCsvBundle(params: {
  currentUserId: string;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  recurring: FinanceRecurringTransaction[];
}): Record<CsvTableKey, string> {
  const { currentUserId } = params;
  // Filter strictly to current logged-in user
  const accounts = params.accounts.filter((a) => a.user_id === currentUserId);
  const categories = params.categories.filter(
    (c) => c.user_id === currentUserId
  );
  const transactions = params.transactions.filter(
    (t) => t.user_id === currentUserId
  );
  const budgets = params.budgets.filter((b) => b.user_id === currentUserId);
  const recurring = params.recurring.filter((r) => r.user_id === currentUserId);

  return {
    accounts: serializeCsv(
      CSV_HEADERS.accounts,
      accounts as unknown as Record<string, unknown>[]
    ),
    categories: serializeCsv(
      CSV_HEADERS.categories,
      categories as unknown as Record<string, unknown>[]
    ),
    transactions: serializeCsv(
      CSV_HEADERS.transactions,
      transactions as unknown as Record<string, unknown>[]
    ),
    budgets: serializeCsv(
      CSV_HEADERS.budgets,
      budgets as unknown as Record<string, unknown>[]
    ),
    recurring: serializeCsv(
      CSV_HEADERS.recurring,
      recurring as unknown as Record<string, unknown>[]
    ),
  };
}

/**
 * RFC 4180 CSV parser supporting UTF-8 BOM, quoted fields, escaped quotes, CRLF/LF.
 */
export function parseCsvText(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const clean = csvText.replace(/^\uFEFF/, "");
  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentCell);
        currentCell = "";
      } else if (ch === "\r" && next === "\n") {
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = "";
        i += 1;
      } else if (ch === "\n" || ch === "\r") {
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    matrix.push(currentRow);
  }

  const nonEmptyRows = matrix.filter(
    (r) => !(r.length === 1 && r[0].trim() === "")
  );
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmptyRows[0].map((h) => h.trim());
  const rows = nonEmptyRows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = cells[idx] ?? "";
    });
    return record;
  });

  return { headers, rows };
}

function parseBooleanStrict(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "t" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "f" || v === "no") return false;
  return null;
}

function parseNumberStrict(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isValidTimestamp(raw: string): boolean {
  if (!raw.trim()) return false;
  return !Number.isNaN(Date.parse(raw));
}

function isValidIsoDate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return false;
  const d = new Date(`${raw.trim()}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(raw.trim());
}

function hash32(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function deterministicUuid(table: CsvTableKey, rawId: string): string {
  const key = `${table}:${rawId}`;
  const b = new Uint8Array(16);
  const view = new DataView(b.buffer);
  view.setUint32(0, hash32(key, 0x811c9dc5));
  view.setUint32(4, hash32(key, 0x9e3779b9));
  view.setUint32(8, hash32(key, 0x85ebca6b));
  view.setUint32(12, hash32(key, 0xc2b2ae35));

  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Resolves an entity ID from CSV: keeps valid UUIDs intact and deterministically
 * maps legacy numeric/string IDs (e.g. "15", "1002") to stable UUIDs per table.
 */
function resolveEntityUuid(table: CsvTableKey, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isValidUuid(trimmed)) return trimmed;
  return deterministicUuid(table, trimmed);
}

export function prepareCsvImportPreview(params: {
  currentUserId: string;
  csvTexts: Partial<Record<CsvTableKey, string>>;
  existingAccounts: FinanceAccount[];
  existingCategories: FinanceCategory[];
  existingTransactions: FinanceTransaction[];
  existingBudgets: FinanceBudget[];
  existingRecurring: FinanceRecurringTransaction[];
}): CsvImportPreview {
  const { currentUserId, csvTexts } = params;
  const errors: CsvValidationError[] = [];

  const payload: CsvImportPayload = {
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurring: [],
  };

  const duplicateIds: Record<CsvTableKey, string[]> = {
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurring: [],
  };

  const existingAccountIds = new Set(params.existingAccounts.map((a) => a.id));
  const existingCategoryIds = new Set(
    params.existingCategories.map((c) => c.id)
  );
  const existingTxIds = new Set(params.existingTransactions.map((t) => t.id));
  const existingBudgetIds = new Set(params.existingBudgets.map((b) => b.id));
  const existingRecurringIds = new Set(
    params.existingRecurring.map((r) => r.id)
  );

  const validateHeaders = (table: CsvTableKey, headers: string[]): boolean => {
    const required = CSV_HEADERS[table];
    const missing = required.filter((col) => {
      if (table === "accounts" && col === "opening_balance") {
        return (
          !headers.includes("opening_balance") && !headers.includes("balance")
        );
      }
      return !headers.includes(col);
    });
    if (missing.length > 0) {
      errors.push({
        table,
        row: 1,
        field: "header",
        message: `Header CSV tidak lengkap. Kolom hilang: ${missing.join(", ")}`,
      });
      return false;
    }
    return true;
  };

  const nowIso = new Date().toISOString();
  const endingBalanceAccountIds = new Set<string>();

  // 1. Accounts
  if (csvTexts.accounts && csvTexts.accounts.trim()) {
    const parsed = parseCsvText(csvTexts.accounts);
    if (validateHeaders("accounts", parsed.headers)) {
      const hasOpeningCol = parsed.headers.includes("opening_balance");
      const balanceField = hasOpeningCol ? "opening_balance" : "balance";

      parsed.rows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const accId = resolveEntityUuid("accounts", r.id);
        if (!accId) {
          errors.push({
            table: "accounts",
            row: rowNum,
            field: "id",
            message: "ID akun wajib diisi.",
          });
          return;
        }
        if (!r.name.trim()) {
          errors.push({
            table: "accounts",
            row: rowNum,
            field: "name",
            message: "Nama akun wajib diisi.",
          });
        }
        if (!VALID_ACCOUNT_TYPES.includes(r.type.trim() as AccountType)) {
          errors.push({
            table: "accounts",
            row: rowNum,
            field: "type",
            message: `Tipe akun "${r.type}" tidak valid.`,
          });
        }
        const rawBal = hasOpeningCol ? r.opening_balance : r.balance;
        const opening = parseNumberStrict(rawBal);
        if (opening === null) {
          errors.push({
            table: "accounts",
            row: rowNum,
            field: balanceField,
            message: `${balanceField} harus berupa angka.`,
          });
        }
        const isActive =
          r.is_active.trim() === "" ? true : parseBooleanStrict(r.is_active);
        if (isActive === null) {
          errors.push({
            table: "accounts",
            row: rowNum,
            field: "is_active",
            message: "is_active harus true/false.",
          });
        }

        if (existingAccountIds.has(accId)) {
          duplicateIds.accounts.push(accId);
        }
        if (!hasOpeningCol) {
          endingBalanceAccountIds.add(accId);
        }

        payload.accounts.push({
          id: accId,
          user_id: currentUserId, // Always remap to logged-in user
          name: r.name.trim(),
          type: r.type.trim() as AccountType,
          opening_balance: opening ?? 0,
          color: r.color.trim() || "#3B82F6",
          icon: r.icon.trim() || "wallet",
          is_active: isActive ?? true,
          created_at: isValidTimestamp(r.created_at) ? r.created_at : nowIso,
          updated_at: isValidTimestamp(r.updated_at) ? r.updated_at : nowIso,
        });
      });
    }
  }

  // 2. Categories (ordered: parent categories first, then child categories)
  if (csvTexts.categories && csvTexts.categories.trim()) {
    const parsed = parseCsvText(csvTexts.categories);
    if (validateHeaders("categories", parsed.headers)) {
      const rawCats: FinanceCategory[] = [];
      parsed.rows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const catId = resolveEntityUuid("categories", r.id);
        if (!catId) {
          errors.push({
            table: "categories",
            row: rowNum,
            field: "id",
            message: "ID kategori wajib diisi.",
          });
          return;
        }
        if (!r.name.trim()) {
          errors.push({
            table: "categories",
            row: rowNum,
            field: "name",
            message: "Nama kategori wajib diisi.",
          });
        }
        if (!VALID_CATEGORY_TYPES.includes(r.type.trim() as CategoryType)) {
          errors.push({
            table: "categories",
            row: rowNum,
            field: "type",
            message: `Tipe kategori "${r.type}" tidak valid.`,
          });
        }
        const parentId = resolveEntityUuid("categories", r.parent_id);
        if (parentId && parentId === catId) {
          errors.push({
            table: "categories",
            row: rowNum,
            field: "parent_id",
            message: "Kategori tidak boleh merujuk ke dirinya sendiri.",
          });
        }

        if (existingCategoryIds.has(catId)) {
          duplicateIds.categories.push(catId);
        }

        rawCats.push({
          id: catId,
          user_id: currentUserId,
          name: r.name.trim(),
          type: r.type.trim() as CategoryType,
          icon: r.icon.trim() || null,
          color: r.color.trim() || null,
          parent_id: parentId,
          created_at: isValidTimestamp(r.created_at) ? r.created_at : nowIso,
          updated_at: isValidTimestamp(r.updated_at) ? r.updated_at : nowIso,
        });
      });

      // Two-pass ordering: parents (parent_id === null) first, then children
      const parents = rawCats.filter((c) => !c.parent_id);
      const children = rawCats.filter((c) => Boolean(c.parent_id));
      payload.categories = [...parents, ...children];

      // Validate parent-child relations (existence + same type)
      const combinedCatMap = new Map<string, FinanceCategory>();
      params.existingCategories.forEach((c) => combinedCatMap.set(c.id, c));
      payload.categories.forEach((c) => combinedCatMap.set(c.id, c));

      children.forEach((child) => {
        const parent = child.parent_id
          ? combinedCatMap.get(child.parent_id)
          : undefined;
        if (!parent) {
          errors.push({
            table: "categories",
            row: 0,
            field: "parent_id",
            message: `Kategori anak "${child.name}" merujuk ke parent_id ${child.parent_id} yang tidak ada.`,
          });
        } else if (parent.type !== child.type) {
          errors.push({
            table: "categories",
            row: 0,
            field: "parent_id",
            message: `Kategori anak "${child.name}" (${child.type}) harus bertipe sama dengan induk "${parent.name}" (${parent.type}).`,
          });
        }
      });
    }
  }

  // Build combined lookup sets for relation validation
  const allAccountIds = new Set<string>([
    ...existingAccountIds,
    ...payload.accounts.map((a) => a.id),
  ]);
  const allCategoriesMap = new Map<string, FinanceCategory>();
  params.existingCategories.forEach((c) => allCategoriesMap.set(c.id, c));
  payload.categories.forEach((c) => allCategoriesMap.set(c.id, c));

  // 3. Transactions
  if (csvTexts.transactions && csvTexts.transactions.trim()) {
    const parsed = parseCsvText(csvTexts.transactions);
    if (validateHeaders("transactions", parsed.headers)) {
      parsed.rows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const txId = resolveEntityUuid("transactions", r.id);
        if (!txId) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "id",
            message: "ID transaksi wajib diisi.",
          });
          return;
        }
        const accountId = resolveEntityUuid("accounts", r.account_id);
        if (!accountId || !allAccountIds.has(accountId)) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "account_id",
            message: `account_id ${r.account_id} tidak ditemukan di akun milik user.`,
          });
        }

        const txType = r.type.trim() as TransactionType;
        if (!VALID_TRANSACTION_TYPES.includes(txType)) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "type",
            message: `Tipe transaksi "${r.type}" tidak valid.`,
          });
        }

        const transferAccId = resolveEntityUuid(
          "accounts",
          r.transfer_account_id
        );
        if (txType === "transfer") {
          if (!transferAccId) {
            errors.push({
              table: "transactions",
              row: rowNum,
              field: "transfer_account_id",
              message: "Transfer wajib memiliki transfer_account_id valid.",
            });
          } else if (transferAccId === accountId) {
            errors.push({
              table: "transactions",
              row: rowNum,
              field: "transfer_account_id",
              message: "transfer_account_id harus berbeda dengan account_id.",
            });
          } else if (!allAccountIds.has(transferAccId)) {
            errors.push({
              table: "transactions",
              row: rowNum,
              field: "transfer_account_id",
              message: `transfer_account_id ${r.transfer_account_id} tidak ditemukan di akun milik user.`,
            });
          }
        } else if (transferAccId !== null) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "transfer_account_id",
            message:
              "transfer_account_id harus kosong jika tipe bukan transfer.",
          });
        }

        const catId = resolveEntityUuid("categories", r.category_id);
        if (catId && !allCategoriesMap.has(catId)) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "category_id",
            message: `category_id ${r.category_id} tidak ditemukan di kategori milik user.`,
          });
        }

        const amt = parseNumberStrict(r.amount);
        if (amt === null) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "amount",
            message: "amount harus berupa angka.",
          });
        } else if (txType !== "adjustment" && amt < 0) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "amount",
            message: "amount tidak boleh negatif kecuali adjustment.",
          });
        }

        const status = (r.status.trim() || "cleared") as TransactionStatus;
        if (!VALID_TRANSACTION_STATUSES.includes(status)) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "status",
            message: `status "${r.status}" tidak valid.`,
          });
        }

        if (!isValidTimestamp(r.transaction_date)) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "transaction_date",
            message: "Format transaction_date tidak valid.",
          });
        }

        if (!r.title.trim()) {
          errors.push({
            table: "transactions",
            row: rowNum,
            field: "title",
            message: "title transaksi wajib diisi.",
          });
        }

        if (existingTxIds.has(txId)) {
          duplicateIds.transactions.push(txId);
        }

        payload.transactions.push({
          id: txId,
          user_id: currentUserId,
          account_id: accountId ?? "",
          transfer_account_id: transferAccId,
          category_id: catId,
          amount: amt ?? 0,
          type: txType,
          status,
          reference_no: r.reference_no.trim() || null,
          transaction_date: r.transaction_date.trim(),
          title: r.title.trim(),
          notes: r.notes.trim() || null,
          created_at: isValidTimestamp(r.created_at) ? r.created_at : nowIso,
          updated_at: isValidTimestamp(r.updated_at) ? r.updated_at : nowIso,
        });
      });
    }
  }

  // If accounts CSV provided ending `balance` instead of `opening_balance`,
  // back-calculate opening_balance so running balance equals the CSV `balance`.
  if (endingBalanceAccountIds.size > 0) {
    const mergedTxMap = new Map<string, FinanceTransaction>();
    for (const tx of params.existingTransactions) {
      mergedTxMap.set(tx.id, tx);
    }
    for (const tx of payload.transactions) {
      mergedTxMap.set(tx.id, tx);
    }

    const netEffectByAcc = new Map<string, number>();
    for (const tx of mergedTxMap.values()) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") {
        netEffectByAcc.set(
          tx.account_id,
          (netEffectByAcc.get(tx.account_id) ?? 0) + amt
        );
      } else if (tx.type === "expense") {
        netEffectByAcc.set(
          tx.account_id,
          (netEffectByAcc.get(tx.account_id) ?? 0) - amt
        );
      } else if (tx.type === "transfer") {
        netEffectByAcc.set(
          tx.account_id,
          (netEffectByAcc.get(tx.account_id) ?? 0) - amt
        );
        if (tx.transfer_account_id) {
          netEffectByAcc.set(
            tx.transfer_account_id,
            (netEffectByAcc.get(tx.transfer_account_id) ?? 0) + amt
          );
        }
      } else if (tx.type === "adjustment") {
        netEffectByAcc.set(
          tx.account_id,
          (netEffectByAcc.get(tx.account_id) ?? 0) + amt
        );
      }
    }
    for (const acc of payload.accounts) {
      if (endingBalanceAccountIds.has(acc.id)) {
        const net = netEffectByAcc.get(acc.id) ?? 0;
        acc.opening_balance =
          Math.round((acc.opening_balance - net) * 100) / 100;
      }
    }
  }

  // 4. Budgets
  if (csvTexts.budgets && csvTexts.budgets.trim()) {
    const parsed = parseCsvText(csvTexts.budgets);
    if (validateHeaders("budgets", parsed.headers)) {
      parsed.rows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const budgetId = resolveEntityUuid("budgets", r.id);
        if (!budgetId) {
          errors.push({
            table: "budgets",
            row: rowNum,
            field: "id",
            message: "ID budget wajib diisi.",
          });
          return;
        }
        const catId = resolveEntityUuid("categories", r.category_id);
        const cat = catId ? allCategoriesMap.get(catId) : undefined;
        if (!catId || !cat) {
          errors.push({
            table: "budgets",
            row: rowNum,
            field: "category_id",
            message: `category_id ${r.category_id} tidak ditemukan di kategori milik user.`,
          });
        } else if (cat.type !== "expense") {
          errors.push({
            table: "budgets",
            row: rowNum,
            field: "category_id",
            message: `Budget hanya boleh untuk kategori expense, bukan "${cat.type}".`,
          });
        }

        const limitAmount = parseNumberStrict(r.limit_amount);
        if (limitAmount === null || limitAmount < 0) {
          errors.push({
            table: "budgets",
            row: rowNum,
            field: "limit_amount",
            message: "limit_amount harus angka >= 0.",
          });
        }
        const month = Number(r.month);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          errors.push({
            table: "budgets",
            row: rowNum,
            field: "month",
            message: "month harus integer 1..12.",
          });
        }
        const year = Number(r.year);
        if (!Number.isInteger(year) || year < 1) {
          errors.push({
            table: "budgets",
            row: rowNum,
            field: "year",
            message: "year harus integer >= 1.",
          });
        }

        if (existingBudgetIds.has(budgetId)) {
          duplicateIds.budgets.push(budgetId);
        }

        payload.budgets.push({
          id: budgetId,
          user_id: currentUserId,
          category_id: catId ?? "",
          limit_amount: limitAmount ?? 0,
          month,
          year,
          created_at: isValidTimestamp(r.created_at) ? r.created_at : nowIso,
          updated_at: isValidTimestamp(r.updated_at) ? r.updated_at : nowIso,
        });
      });
    }
  }

  // 5. Recurring Transactions
  if (csvTexts.recurring && csvTexts.recurring.trim()) {
    const parsed = parseCsvText(csvTexts.recurring);
    if (validateHeaders("recurring", parsed.headers)) {
      parsed.rows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const recId = resolveEntityUuid("recurring", r.id);
        if (!recId) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "id",
            message: "ID transaksi berulang wajib diisi.",
          });
          return;
        }
        const accountId = resolveEntityUuid("accounts", r.account_id);
        if (!accountId || !allAccountIds.has(accountId)) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "account_id",
            message: `account_id ${r.account_id} tidak ditemukan di akun milik user.`,
          });
        }
        const catId = resolveEntityUuid("categories", r.category_id);
        if (catId && !allCategoriesMap.has(catId)) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "category_id",
            message: `category_id ${r.category_id} tidak ditemukan di kategori milik user.`,
          });
        }
        const amt = parseNumberStrict(r.amount);
        if (amt === null || amt < 0) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "amount",
            message: "amount harus angka >= 0.",
          });
        }
        const recType = r.type.trim() as CategoryType;
        if (!VALID_CATEGORY_TYPES.includes(recType)) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "type",
            message: `type "${r.type}" harus income atau expense.`,
          });
        }
        if (!r.title.trim()) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "title",
            message: "title wajib diisi.",
          });
        }
        const freq = r.frequency.trim() as RecurringFrequency;
        if (!VALID_FREQUENCIES.includes(freq)) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "frequency",
            message: `frequency "${r.frequency}" tidak valid.`,
          });
        }
        if (!isValidIsoDate(r.start_date)) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "start_date",
            message: "start_date harus berformat YYYY-MM-DD.",
          });
        }
        if (!isValidIsoDate(r.next_due_date)) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "next_due_date",
            message: "next_due_date harus berformat YYYY-MM-DD.",
          });
        }
        if (
          r.last_processed_date.trim() &&
          !isValidIsoDate(r.last_processed_date)
        ) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "last_processed_date",
            message: "last_processed_date harus berformat YYYY-MM-DD.",
          });
        }
        const isActive =
          r.is_active.trim() === "" ? true : parseBooleanStrict(r.is_active);
        if (isActive === null) {
          errors.push({
            table: "recurring",
            row: rowNum,
            field: "is_active",
            message: "is_active harus true/false.",
          });
        }

        if (existingRecurringIds.has(recId)) {
          duplicateIds.recurring.push(recId);
        }

        payload.recurring.push({
          id: recId,
          user_id: currentUserId,
          account_id: accountId ?? "",
          category_id: catId,
          amount: amt ?? 0,
          type: recType,
          title: r.title.trim(),
          frequency: freq,
          start_date: r.start_date.trim(),
          next_due_date: r.next_due_date.trim(),
          last_processed_date: r.last_processed_date.trim() || null,
          is_active: isActive ?? true,
          notes: r.notes.trim() || null,
          created_at: isValidTimestamp(r.created_at) ? r.created_at : nowIso,
          updated_at: isValidTimestamp(r.updated_at) ? r.updated_at : nowIso,
        });
      });
    }
  }

  const counts: Record<CsvTableKey, number> = {
    accounts: payload.accounts.length,
    categories: payload.categories.length,
    transactions: payload.transactions.length,
    budgets: payload.budgets.length,
    recurring: payload.recurring.length,
  };

  const hasDuplicates = Object.values(duplicateIds).some(
    (list) => list.length > 0
  );

  return {
    payload,
    counts,
    duplicateIds,
    errors,
    hasFatalErrors: errors.length > 0,
    hasDuplicates,
  };
}
