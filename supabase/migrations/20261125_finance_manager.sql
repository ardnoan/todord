-- Finance Manager Personal Module Migration
-- Follows Supabase Auth ownership + strict RLS (user_id = auth.uid())

-- 1. Core Tables
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

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_finance_accounts_owner
  ON public.finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_categories_owner
  ON public.finance_categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_owner_date
  ON public.finance_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account
  ON public.finance_transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_period
  ON public.finance_budgets(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_due
  ON public.finance_recurring_transactions(user_id, next_due_date)
  WHERE is_active = true;

-- 3. Row Level Security (RLS)
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

-- 4. Triggers for updated_at and domain integrity
CREATE OR REPLACE FUNCTION public.finance_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_accounts_updated_at ON public.finance_accounts;
CREATE TRIGGER trg_finance_accounts_updated_at
  BEFORE UPDATE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at();

DROP TRIGGER IF EXISTS trg_finance_categories_updated_at ON public.finance_categories;
CREATE TRIGGER trg_finance_categories_updated_at
  BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at();

DROP TRIGGER IF EXISTS trg_finance_transactions_updated_at ON public.finance_transactions;
CREATE TRIGGER trg_finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at();

DROP TRIGGER IF EXISTS trg_finance_budgets_updated_at ON public.finance_budgets;
CREATE TRIGGER trg_finance_budgets_updated_at
  BEFORE UPDATE ON public.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at();

DROP TRIGGER IF EXISTS trg_finance_recurring_updated_at ON public.finance_recurring_transactions;
CREATE TRIGGER trg_finance_recurring_updated_at
  BEFORE UPDATE ON public.finance_recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at();

-- Ensure child category shares the exact same type and owner as parent category
CREATE OR REPLACE FUNCTION public.finance_validate_category_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_type varchar(20);
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Category cannot be its own parent';
    END IF;
    SELECT type INTO v_parent_type
    FROM public.finance_categories
    WHERE id = NEW.parent_id AND user_id = NEW.user_id;
    IF v_parent_type IS NULL THEN
      RAISE EXCEPTION 'Parent category not found for this user';
    END IF;
    IF v_parent_type <> NEW.type THEN
      RAISE EXCEPTION 'Child category must have the same type as parent category';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_categories_parent_check ON public.finance_categories;
CREATE TRIGGER trg_finance_categories_parent_check
  BEFORE INSERT OR UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_category_parent();

-- Ensure budgets only reference expense categories
CREATE OR REPLACE FUNCTION public.finance_validate_budget_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cat_type varchar(20);
BEGIN
  SELECT type INTO v_cat_type
  FROM public.finance_categories
  WHERE id = NEW.category_id AND user_id = NEW.user_id;
  IF v_cat_type IS NULL THEN
    RAISE EXCEPTION 'Budget category not found for this user';
  END IF;
  IF v_cat_type <> 'expense' THEN
    RAISE EXCEPTION 'Budgets can only be assigned to expense categories';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_budgets_category_check ON public.finance_budgets;
CREATE TRIGGER trg_finance_budgets_category_check
  BEFORE INSERT OR UPDATE ON public.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION public.finance_validate_budget_category();

-- 5. Idempotent Recurring Execution RPC (SECURITY INVOKER so auth.uid() & RLS apply)
CREATE OR REPLACE FUNCTION public.execute_finance_recurring(
  p_recurring_id uuid,
  p_execution_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec public.finance_recurring_transactions%ROWTYPE;
  v_tx_id uuid;
  v_next_date date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_rec
  FROM public.finance_recurring_transactions
  WHERE id = p_recurring_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurring transaction not found';
  END IF;

  IF NOT v_rec.is_active THEN
    RETURN jsonb_build_object('executed', false, 'reason', 'inactive');
  END IF;

  IF v_rec.next_due_date > p_execution_date THEN
    RETURN jsonb_build_object('executed', false, 'reason', 'not_due', 'next_due_date', v_rec.next_due_date);
  END IF;

  IF v_rec.last_processed_date IS NOT NULL AND v_rec.last_processed_date >= v_rec.next_due_date THEN
    RETURN jsonb_build_object('executed', false, 'reason', 'already_processed', 'next_due_date', v_rec.next_due_date);
  END IF;

  INSERT INTO public.finance_transactions (
    user_id, account_id, category_id, amount, type, status, transaction_date, title, notes
  ) VALUES (
    v_uid,
    v_rec.account_id,
    v_rec.category_id,
    v_rec.amount,
    v_rec.type,
    'cleared',
    (v_rec.next_due_date::timestamp AT TIME ZONE 'UTC'),
    v_rec.title,
    v_rec.notes
  )
  RETURNING id INTO v_tx_id;

  v_next_date := CASE v_rec.frequency
    WHEN 'daily' THEN (v_rec.next_due_date + interval '1 day')::date
    WHEN 'weekly' THEN (v_rec.next_due_date + interval '7 days')::date
    WHEN 'monthly' THEN (v_rec.next_due_date + interval '1 month')::date
    WHEN 'yearly' THEN (v_rec.next_due_date + interval '1 year')::date
  END;

  UPDATE public.finance_recurring_transactions
  SET last_processed_date = v_rec.next_due_date,
      next_due_date = v_next_date
  WHERE id = v_rec.id AND user_id = v_uid;

  RETURN jsonb_build_object(
    'executed', true,
    'transaction_id', v_tx_id,
    'processed_date', v_rec.next_due_date,
    'next_due_date', v_next_date
  );
END;
$$;

-- 6. Transactional CSV Import RPC (all-or-nothing, remaps user_id to auth.uid())
CREATE OR REPLACE FUNCTION public.import_finance_data(
  p_payload jsonb,
  p_upsert boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_accounts_count int := 0;
  v_categories_count int := 0;
  v_transactions_count int := 0;
  v_budgets_count int := 0;
  v_recurring_count int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1) Accounts
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'accounts', '[]'::jsonb))
  LOOP
    IF p_upsert THEN
      INSERT INTO public.finance_accounts (id, user_id, name, type, opening_balance, color, icon, is_active)
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        v_item->>'name',
        v_item->>'type',
        (v_item->>'opening_balance')::numeric(15,2),
        COALESCE(NULLIF(v_item->>'color', ''), '#3B82F6'),
        COALESCE(NULLIF(v_item->>'icon', ''), 'wallet'),
        COALESCE((v_item->>'is_active')::boolean, true)
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        opening_balance = EXCLUDED.opening_balance,
        color = EXCLUDED.color,
        icon = EXCLUDED.icon,
        is_active = EXCLUDED.is_active
      WHERE public.finance_accounts.user_id = v_uid;
    ELSE
      INSERT INTO public.finance_accounts (id, user_id, name, type, opening_balance, color, icon, is_active)
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        v_item->>'name',
        v_item->>'type',
        (v_item->>'opening_balance')::numeric(15,2),
        COALESCE(NULLIF(v_item->>'color', ''), '#3B82F6'),
        COALESCE(NULLIF(v_item->>'icon', ''), 'wallet'),
        COALESCE((v_item->>'is_active')::boolean, true)
      );
    END IF;
    v_accounts_count := v_accounts_count + 1;
  END LOOP;

  -- 2a) Categories (parents first: parent_id IS NULL)
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'categories', '[]'::jsonb))
  LOOP
    IF NULLIF(v_item->>'parent_id', '') IS NULL THEN
      IF p_upsert THEN
        INSERT INTO public.finance_categories (id, user_id, name, type, icon, color, parent_id)
        VALUES (
          (v_item->>'id')::uuid,
          v_uid,
          v_item->>'name',
          v_item->>'type',
          NULLIF(v_item->>'icon', ''),
          NULLIF(v_item->>'color', ''),
          NULL
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          icon = EXCLUDED.icon,
          color = EXCLUDED.color,
          parent_id = NULL
        WHERE public.finance_categories.user_id = v_uid;
      ELSE
        INSERT INTO public.finance_categories (id, user_id, name, type, icon, color, parent_id)
        VALUES (
          (v_item->>'id')::uuid,
          v_uid,
          v_item->>'name',
          v_item->>'type',
          NULLIF(v_item->>'icon', ''),
          NULLIF(v_item->>'color', ''),
          NULL
        );
      END IF;
      v_categories_count := v_categories_count + 1;
    END IF;
  END LOOP;

  -- 2b) Categories (children second: parent_id IS NOT NULL)
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'categories', '[]'::jsonb))
  LOOP
    IF NULLIF(v_item->>'parent_id', '') IS NOT NULL THEN
      IF p_upsert THEN
        INSERT INTO public.finance_categories (id, user_id, name, type, icon, color, parent_id)
        VALUES (
          (v_item->>'id')::uuid,
          v_uid,
          v_item->>'name',
          v_item->>'type',
          NULLIF(v_item->>'icon', ''),
          NULLIF(v_item->>'color', ''),
          (v_item->>'parent_id')::uuid
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          icon = EXCLUDED.icon,
          color = EXCLUDED.color,
          parent_id = EXCLUDED.parent_id
        WHERE public.finance_categories.user_id = v_uid;
      ELSE
        INSERT INTO public.finance_categories (id, user_id, name, type, icon, color, parent_id)
        VALUES (
          (v_item->>'id')::uuid,
          v_uid,
          v_item->>'name',
          v_item->>'type',
          NULLIF(v_item->>'icon', ''),
          NULLIF(v_item->>'color', ''),
          (v_item->>'parent_id')::uuid
        );
      END IF;
      v_categories_count := v_categories_count + 1;
    END IF;
  END LOOP;

  -- 3) Transactions
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'transactions', '[]'::jsonb))
  LOOP
    IF p_upsert THEN
      INSERT INTO public.finance_transactions (
        id, user_id, account_id, transfer_account_id, category_id, amount, type, status, reference_no, transaction_date, title, notes
      )
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        (v_item->>'account_id')::uuid,
        NULLIF(v_item->>'transfer_account_id', '')::uuid,
        NULLIF(v_item->>'category_id', '')::uuid,
        (v_item->>'amount')::numeric(15,2),
        v_item->>'type',
        COALESCE(NULLIF(v_item->>'status', ''), 'cleared'),
        NULLIF(v_item->>'reference_no', ''),
        COALESCE(NULLIF(v_item->>'transaction_date', '')::timestamptz, now()),
        v_item->>'title',
        NULLIF(v_item->>'notes', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        transfer_account_id = EXCLUDED.transfer_account_id,
        category_id = EXCLUDED.category_id,
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        reference_no = EXCLUDED.reference_no,
        transaction_date = EXCLUDED.transaction_date,
        title = EXCLUDED.title,
        notes = EXCLUDED.notes
      WHERE public.finance_transactions.user_id = v_uid;
    ELSE
      INSERT INTO public.finance_transactions (
        id, user_id, account_id, transfer_account_id, category_id, amount, type, status, reference_no, transaction_date, title, notes
      )
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        (v_item->>'account_id')::uuid,
        NULLIF(v_item->>'transfer_account_id', '')::uuid,
        NULLIF(v_item->>'category_id', '')::uuid,
        (v_item->>'amount')::numeric(15,2),
        v_item->>'type',
        COALESCE(NULLIF(v_item->>'status', ''), 'cleared'),
        NULLIF(v_item->>'reference_no', ''),
        COALESCE(NULLIF(v_item->>'transaction_date', '')::timestamptz, now()),
        v_item->>'title',
        NULLIF(v_item->>'notes', '')
      );
    END IF;
    v_transactions_count := v_transactions_count + 1;
  END LOOP;

  -- 4) Budgets
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'budgets', '[]'::jsonb))
  LOOP
    IF p_upsert THEN
      INSERT INTO public.finance_budgets (id, user_id, category_id, limit_amount, month, year)
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        (v_item->>'category_id')::uuid,
        (v_item->>'limit_amount')::numeric(15,2),
        (v_item->>'month')::integer,
        (v_item->>'year')::integer
      )
      ON CONFLICT (id) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        limit_amount = EXCLUDED.limit_amount,
        month = EXCLUDED.month,
        year = EXCLUDED.year
      WHERE public.finance_budgets.user_id = v_uid;
    ELSE
      INSERT INTO public.finance_budgets (id, user_id, category_id, limit_amount, month, year)
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        (v_item->>'category_id')::uuid,
        (v_item->>'limit_amount')::numeric(15,2),
        (v_item->>'month')::integer,
        (v_item->>'year')::integer
      );
    END IF;
    v_budgets_count := v_budgets_count + 1;
  END LOOP;

  -- 5) Recurring Transactions
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'recurring', '[]'::jsonb))
  LOOP
    IF p_upsert THEN
      INSERT INTO public.finance_recurring_transactions (
        id, user_id, account_id, category_id, amount, type, title, frequency, start_date, next_due_date, last_processed_date, is_active, notes
      )
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        (v_item->>'account_id')::uuid,
        NULLIF(v_item->>'category_id', '')::uuid,
        (v_item->>'amount')::numeric(15,2),
        v_item->>'type',
        v_item->>'title',
        v_item->>'frequency',
        (v_item->>'start_date')::date,
        (v_item->>'next_due_date')::date,
        NULLIF(v_item->>'last_processed_date', '')::date,
        COALESCE((v_item->>'is_active')::boolean, true),
        NULLIF(v_item->>'notes', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        category_id = EXCLUDED.category_id,
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        frequency = EXCLUDED.frequency,
        start_date = EXCLUDED.start_date,
        next_due_date = EXCLUDED.next_due_date,
        last_processed_date = EXCLUDED.last_processed_date,
        is_active = EXCLUDED.is_active,
        notes = EXCLUDED.notes
      WHERE public.finance_recurring_transactions.user_id = v_uid;
    ELSE
      INSERT INTO public.finance_recurring_transactions (
        id, user_id, account_id, category_id, amount, type, title, frequency, start_date, next_due_date, last_processed_date, is_active, notes
      )
      VALUES (
        (v_item->>'id')::uuid,
        v_uid,
        (v_item->>'account_id')::uuid,
        NULLIF(v_item->>'category_id', '')::uuid,
        (v_item->>'amount')::numeric(15,2),
        v_item->>'type',
        v_item->>'title',
        v_item->>'frequency',
        (v_item->>'start_date')::date,
        (v_item->>'next_due_date')::date,
        NULLIF(v_item->>'last_processed_date', '')::date,
        COALESCE((v_item->>'is_active')::boolean, true),
        NULLIF(v_item->>'notes', '')
      );
    END IF;
    v_recurring_count := v_recurring_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'accounts', v_accounts_count,
    'categories', v_categories_count,
    'transactions', v_transactions_count,
    'budgets', v_budgets_count,
    'recurring', v_recurring_count
  );
END;
$$;
