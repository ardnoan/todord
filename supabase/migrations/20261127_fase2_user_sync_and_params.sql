-- Fase 2: Per-user Sticky Notes, User Preferences, and Global App Parameters

-- 1. Sticky Notes (per-user, RLS owner-only, Realtime enabled)
CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Catatan Baru',
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'sage', 'blue', 'peach', 'lavender')),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_owner
  ON public.sticky_notes(user_id, created_at DESC);

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own sticky_notes" ON public.sticky_notes;
CREATE POLICY "Users can access their own sticky_notes"
  ON public.sticky_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sticky_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sticky_notes;
  END IF;
END
$$;

-- 2. User Preferences (per-user theme & task_order, RLS owner-only)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  task_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own user_preferences" ON public.user_preferences;
CREATE POLICY "Users can access their own user_preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Global App Parameters (singleton row id = 1)
-- Authenticated users can read; only admin (app_metadata.role = 'admin') can write.
CREATE TABLE IF NOT EXISTS public.app_parameters (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read app_parameters" ON public.app_parameters;
CREATE POLICY "Authenticated users can read app_parameters"
  ON public.app_parameters FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write app_parameters" ON public.app_parameters;
CREATE POLICY "Admins can write app_parameters"
  ON public.app_parameters FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
