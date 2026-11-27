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

export type ActionModalType =
  "today" | "overdue" | "active" | "completed" | "category" | "date" | null;

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
      sticky_notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          color: NoteColor;
          pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          color?: NoteColor;
          pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          color?: NoteColor;
          pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          theme_preferences: Json;
          task_order: Json;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          theme_preferences?: Json;
          task_order?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          theme_preferences?: Json;
          task_order?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_parameters: {
        Row: {
          id: number;
          settings: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          settings: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          settings?: Json;
          updated_by?: string | null;
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
      delete_finance_account: {
        Args: {
          p_account_id: string;
        };
        Returns: undefined;
      };
      get_finance_account_balances: {
        Args: Record<string, never>;
        Returns: Array<{
          account_id: string;
          opening_balance: number;
          total_inflow: number;
          total_outflow: number;
          current_balance: number;
          transaction_count: number;
        }>;
      };
      get_finance_period_summary: {
        Args: {
          p_month: number;
          p_year: number;
        };
        Returns: Array<{
          total_income: number;
          total_expense: number;
          net_cashflow: number;
          transfer_volume: number;
          adjustment_net: number;
          transaction_count: number;
        }>;
      };
      get_finance_monthly_report: {
        Args: {
          p_year: number;
        };
        Returns: Array<{
          month: number;
          income: number;
          expense: number;
          net: number;
        }>;
      };
      get_finance_category_report: {
        Args: {
          p_type: string;
          p_month?: number;
          p_year?: number;
        };
        Returns: Array<{
          category_id: string | null;
          category_name: string;
          type: string;
          total: number;
          count: number;
          color: string;
        }>;
      };
      get_finance_budget_spent: {
        Args: {
          p_month: number;
          p_year: number;
        };
        Returns: Array<{
          category_id: string;
          spent_amount: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
