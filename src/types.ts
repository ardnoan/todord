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

export type ActionModalType = "today" | "active" | "completed" | "category" | null;

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
