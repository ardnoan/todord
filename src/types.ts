import type {
  AccountType,
  CategoryType,
  RecurringFrequency,
  TransactionStatus,
  TransactionType,
} from "./lib/finance/types";

export type Priority = "low" | "medium" | "high";

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type NoteColor = "yellow" | "sage" | "blue" | "peach" | "lavender";

export type StickyNote = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  pinned?: boolean;
  createdAt: number;
};

export type ActionModalType = "today" | "active" | "completed" | "category" | "date" | null;

export type Task = {
  id: string;
  title: string;
  notes: string;
  dueDate: string;
  category: string;
  priority: Priority;
  completed: boolean;
  subtasks: Subtask[];
  createdAt: number;
  color?: NoteColor;
  pinned?: boolean;
};

export type TaskDraft = Omit<Task, "id" | "createdAt">;

export type View = "dashboard" | "today" | "upcoming" | "inbox" | "completed";

export type ThemeId = "sage" | "dark" | "warm" | "ocean" | "lavender";

export type LayoutMode = "list" | "grid" | "compact";

export type ThemePreferences = {
  theme: ThemeId;
  layout: LayoutMode;
  showStats: boolean;
  showWeekStrip: boolean;
  showMotto: boolean;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          notes: string;
          due_date: string | null;
          category: string;
          priority: Priority;
          completed: boolean;
          subtasks: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          notes?: string;
          due_date?: string | null;
          category?: string;
          priority?: Priority;
          completed?: boolean;
          subtasks?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          notes?: string;
          due_date?: string | null;
          category?: string;
          priority?: Priority;
          completed?: boolean;
          subtasks?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      finance_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: AccountType;
          opening_balance: number;
          color: string;
          icon: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          type: AccountType;
          opening_balance?: number;
          color?: string;
          icon?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: AccountType;
          opening_balance?: number;
          color?: string;
          icon?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: CategoryType;
          icon: string | null;
          color: string | null;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          type: CategoryType;
          icon?: string | null;
          color?: string | null;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: CategoryType;
          icon?: string | null;
          color?: string | null;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_transactions: {
        Row: {
          id: string;
          user_id: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          transfer_account_id?: string | null;
          category_id?: string | null;
          amount: number;
          type: TransactionType;
          status?: TransactionStatus;
          reference_no?: string | null;
          transaction_date?: string;
          title: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          transfer_account_id?: string | null;
          category_id?: string | null;
          amount?: number;
          type?: TransactionType;
          status?: TransactionStatus;
          reference_no?: string | null;
          transaction_date?: string;
          title?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          limit_amount: number;
          month: number;
          year: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          category_id: string;
          limit_amount: number;
          month: number;
          year: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          limit_amount?: number;
          month?: number;
          year?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_recurring_transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string | null;
          amount: number;
          type: CategoryType;
          title: string;
          frequency: RecurringFrequency;
          start_date: string;
          next_due_date: string;
          last_processed_date: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          category_id?: string | null;
          amount: number;
          type: CategoryType;
          title: string;
          frequency: RecurringFrequency;
          start_date?: string;
          next_due_date: string;
          last_processed_date?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          category_id?: string | null;
          amount?: number;
          type?: CategoryType;
          title?: string;
          frequency?: RecurringFrequency;
          start_date?: string;
          next_due_date?: string;
          last_processed_date?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      execute_finance_recurring: {
        Args: {
          p_recurring_id: string;
          p_execution_date?: string;
        };
        Returns: Json;
      };
      import_finance_data: {
        Args: {
          p_payload: Json;
          p_upsert?: boolean;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
