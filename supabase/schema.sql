create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  notes text not null default '',
  due_date date,
  category text not null default 'Personal',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  subtasks jsonb not null default '[]'::jsonb check (jsonb_typeof(subtasks) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_created_at_idx
  on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;

drop policy if exists "Users can access their own tasks" on public.tasks;
create policy "Users can access their own tasks"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end
$$;

-- ============================================================================
-- Finance Manager Personal Module (mirrors supabase/migrations/20261125_finance_manager.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('cash','bank','credit_card','e_wallet')),
  opening_balance numeric(15,2) NOT NULL DEFAULT 0,
  color varchar(20) DEFAULT '#3B82F6',
  icon varchar(50) DEFAULT 'wallet',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('income','expense')),
  icon varchar(50),
  color varchar(20),
  parent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, id),
  FOREIGN KEY (user_id, parent_id) REFERENCES public.finance_categories(user_id, id)
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  transfer_account_id uuid,
  category_id uuid,
  amount numeric(15,2) NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('income','expense','transfer','adjustment')),
  status varchar(20) NOT NULL DEFAULT 'cleared'
    CHECK (status IN ('pending','cleared','reconciled')),
  reference_no varchar(100),
  transaction_date timestamptz NOT NULL DEFAULT now(),
  title varchar(255) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (type = 'adjustment' OR amount >= 0),
  CHECK ((type = 'transfer' AND transfer_account_id IS NOT NULL AND transfer_account_id <> account_id)
      OR (type <> 'transfer' AND transfer_account_id IS NULL)),
  FOREIGN KEY (user_id, account_id) REFERENCES public.finance_accounts(user_id, id),
  FOREIGN KEY (user_id, transfer_account_id) REFERENCES public.finance_accounts(user_id, id),
  FOREIGN KEY (user_id, category_id) REFERENCES public.finance_categories(user_id, id)
);

CREATE TABLE IF NOT EXISTS public.finance_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  limit_amount numeric(15,2) NOT NULL CHECK (limit_amount >= 0),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month, year),
  FOREIGN KEY (user_id, category_id) REFERENCES public.finance_categories(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.finance_recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  category_id uuid,
  amount numeric(15,2) NOT NULL CHECK (amount >= 0),
  type varchar(20) NOT NULL CHECK (type IN ('income','expense')),
  title varchar(255) NOT NULL,
  frequency varchar(20) NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_due_date date NOT NULL,
  last_processed_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, account_id) REFERENCES public.finance_accounts(user_id, id),
  FOREIGN KEY (user_id, category_id) REFERENCES public.finance_categories(user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_finance_accounts_owner ON public.finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_categories_owner ON public.finance_categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_owner_date ON public.finance_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON public.finance_transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_period ON public.finance_budgets(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_due ON public.finance_recurring_transactions(user_id, next_due_date)
  WHERE is_active = true;

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own finance_accounts" ON public.finance_accounts;
CREATE POLICY "Users can access their own finance_accounts"
  ON public.finance_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own finance_categories" ON public.finance_categories;
CREATE POLICY "Users can access their own finance_categories"
  ON public.finance_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own finance_transactions" ON public.finance_transactions;
CREATE POLICY "Users can access their own finance_transactions"
  ON public.finance_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own finance_budgets" ON public.finance_budgets;
CREATE POLICY "Users can access their own finance_budgets"
  ON public.finance_budgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own finance_recurring_transactions" ON public.finance_recurring_transactions;
CREATE POLICY "Users can access their own finance_recurring_transactions"
  ON public.finance_recurring_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
