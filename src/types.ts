export type Priority = "low" | "medium" | "high";

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

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
};

export type TaskDraft = Omit<Task, "id" | "createdAt">;

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
