import type {
  AccountType,
  CategoryType,
  FinanceAccount,
  FinanceCategory,
  RecurringFrequency,
  TransactionStatus,
  TransactionType,
} from "./types";

export const VALID_ACCOUNT_TYPES: AccountType[] = [
  "cash",
  "bank",
  "credit_card",
  "e_wallet",
];
export const VALID_CATEGORY_TYPES: CategoryType[] = ["income", "expense"];
export const VALID_TRANSACTION_TYPES: TransactionType[] = [
  "income",
  "expense",
  "transfer",
  "adjustment",
];
export const VALID_TRANSACTION_STATUSES: TransactionStatus[] = [
  "pending",
  "cleared",
  "reconciled",
];
export const VALID_FREQUENCIES: RecurringFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function validateCategoryHierarchy(input: {
  id?: string;
  user_id: string;
  type: CategoryType;
  parent_id: string | null;
  categories: FinanceCategory[];
}): string | null {
  if (!input.parent_id) return null;
  if (input.id && input.parent_id === input.id) {
    return "Kategori tidak boleh menjadi induk dari dirinya sendiri.";
  }

  const parent = input.categories.find(
    (c) => c.id === input.parent_id && c.user_id === input.user_id
  );
  if (!parent) {
    return "Kategori induk tidak ditemukan atau bukan milik pengguna ini.";
  }
  if (parent.type !== input.type) {
    return "Kategori anak harus memiliki tipe yang sama dengan kategori induk.";
  }

  // Prevent cycles
  if (input.id) {
    let cursor: FinanceCategory | undefined = parent;
    const visited = new Set<string>([input.id]);
    while (cursor) {
      if (visited.has(cursor.id)) {
        return "Hierarki kategori membentuk siklus yang tidak valid.";
      }
      visited.add(cursor.id);
      cursor = cursor.parent_id
        ? input.categories.find((c) => c.id === cursor!.parent_id)
        : undefined;
    }
  }

  return null;
}

export function validateTransactionInput(input: {
  user_id: string;
  account_id: string;
  transfer_account_id: string | null;
  category_id: string | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  title: string;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
}): string | null {
  if (!input.title.trim()) {
    return "Judul transaksi wajib diisi.";
  }
  if (!Number.isFinite(input.amount)) {
    return "Nominal transaksi tidak valid.";
  }
  if (input.type !== "adjustment" && input.amount < 0) {
    return "Nominal transaksi selain adjustment tidak boleh negatif.";
  }
  if (!VALID_TRANSACTION_STATUSES.includes(input.status)) {
    return "Status transaksi tidak valid.";
  }

  const sourceAcc = input.accounts.find(
    (a) => a.id === input.account_id && a.user_id === input.user_id
  );
  if (!sourceAcc) {
    return "Akun sumber tidak ditemukan atau bukan milik pengguna ini.";
  }

  if (input.type === "transfer") {
    if (!input.transfer_account_id) {
      return "Transaksi transfer wajib memilih akun tujuan.";
    }
    if (input.transfer_account_id === input.account_id) {
      return "Akun tujuan transfer harus berbeda dari akun asal.";
    }
    const targetAcc = input.accounts.find(
      (a) => a.id === input.transfer_account_id && a.user_id === input.user_id
    );
    if (!targetAcc) {
      return "Akun tujuan transfer tidak ditemukan atau bukan milik pengguna ini.";
    }
  } else if (input.transfer_account_id !== null) {
    return "Akun tujuan hanya boleh diisi untuk transaksi transfer.";
  }

  if (input.category_id) {
    const cat = input.categories.find(
      (c) => c.id === input.category_id && c.user_id === input.user_id
    );
    if (!cat) {
      return "Kategori tidak ditemukan atau bukan milik pengguna ini.";
    }
    if (
      (input.type === "income" || input.type === "expense") &&
      cat.type !== input.type
    ) {
      return `Kategori "${cat.name}" bertipe ${cat.type}, tidak cocok dengan transaksi ${input.type}.`;
    }
  }

  return null;
}

export function validateBudgetInput(input: {
  user_id: string;
  category_id: string;
  limit_amount: number;
  month: number;
  year: number;
  categories: FinanceCategory[];
}): string | null {
  if (!Number.isFinite(input.limit_amount) || input.limit_amount < 0) {
    return "Batas anggaran harus bernilai >= 0.";
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return "Bulan anggaran harus antara 1 sampai 12.";
  }
  if (!Number.isInteger(input.year) || input.year < 1) {
    return "Tahun anggaran tidak valid.";
  }
  const cat = input.categories.find(
    (c) => c.id === input.category_id && c.user_id === input.user_id
  );
  if (!cat) {
    return "Kategori anggaran tidak ditemukan atau bukan milik pengguna ini.";
  }
  if (cat.type !== "expense") {
    return "Anggaran hanya dapat dibuat untuk kategori pengeluaran (expense).";
  }
  return null;
}
