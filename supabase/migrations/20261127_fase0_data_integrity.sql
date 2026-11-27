-- Fase 0: Data Integrity, Server-Side Finance Aggregates, Anchored Recurring & Transactional Account Delete
-- All functions use SECURITY INVOKER + explicit auth.uid() checks so RLS remains strictly enforced.

-- 1. Server-side Account Balances (eliminates PostgREST 1000-row cap on balance calculation)
CREATE OR REPLACE FUNCTION public.get_finance_account_balances()
RETURNS TABLE (
  account_id uuid,
  opening_balance numeric(15,2),
  total_inflow numeric(15,2),
  total_outflow numeric(15,2),
  current_balance numeric(15,2),
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH tx_effects AS (
    -- Primary account effects
    SELECT
      t.account_id AS acc_id,
      CASE
        WHEN t.type = 'income' THEN t.amount
        WHEN t.type = 'adjustment' AND t.amount >= 0 THEN t.amount
        ELSE 0::numeric(15,2)
      END AS inflow,
      CASE
        WHEN t.type = 'expense' THEN t.amount
        WHEN t.type = 'transfer' THEN t.amount
        WHEN t.type = 'adjustment' AND t.amount < 0 THEN ABS(t.amount)
        ELSE 0::numeric(15,2)
      END AS outflow
    FROM public.finance_transactions t
    WHERE t.user_id = v_uid

    UNION ALL

    -- Incoming transfer effects on destination account
    SELECT
      t.transfer_account_id AS acc_id,
      t.amount AS inflow,
      0::numeric(15,2) AS outflow
    FROM public.finance_transactions t
    WHERE t.user_id = v_uid
      AND t.type = 'transfer'
      AND t.transfer_account_id IS NOT NULL
  ),
  agg AS (
    SELECT
      e.acc_id,
      COALESCE(SUM(e.inflow), 0)::numeric(15,2) AS sum_inflow,
      COALESCE(SUM(e.outflow), 0)::numeric(15,2) AS sum_outflow,
      COUNT(*)::bigint AS tx_count
    FROM tx_effects e
    GROUP BY e.acc_id
  )
  SELECT
    a.id AS account_id,
    a.opening_balance::numeric(15,2),
    COALESCE(agg.sum_inflow, 0)::numeric(15,2) AS total_inflow,
    COALESCE(agg.sum_outflow, 0)::numeric(15,2) AS total_outflow,
    (a.opening_balance + COALESCE(agg.sum_inflow, 0) - COALESCE(agg.sum_outflow, 0))::numeric(15,2) AS current_balance,
    COALESCE(agg.tx_count, 0)::bigint AS transaction_count
  FROM public.finance_accounts a
  LEFT JOIN agg ON agg.acc_id = a.id
  WHERE a.user_id = v_uid
  ORDER BY a.created_at ASC;
END;
$$;

-- 2. Server-side Period Summary (month/year in UTC matching stored transaction_date)
CREATE OR REPLACE FUNCTION public.get_finance_period_summary(
  p_month integer,
  p_year integer
)
RETURNS TABLE (
  total_income numeric(15,2),
  total_expense numeric(15,2),
  net_cashflow numeric(15,2),
  transfer_volume numeric(15,2),
  adjustment_net numeric(15,2),
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)::numeric(15,2) AS total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)::numeric(15,2) AS total_expense,
    (
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)
    )::numeric(15,2) AS net_cashflow,
    COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN t.amount ELSE 0 END), 0)::numeric(15,2) AS transfer_volume,
    COALESCE(SUM(CASE WHEN t.type = 'adjustment' THEN t.amount ELSE 0 END), 0)::numeric(15,2) AS adjustment_net,
    COUNT(*)::bigint AS transaction_count
  FROM public.finance_transactions t
  WHERE t.user_id = v_uid
    AND EXTRACT(YEAR FROM (t.transaction_date AT TIME ZONE 'UTC'))::int = p_year
    AND EXTRACT(MONTH FROM (t.transaction_date AT TIME ZONE 'UTC'))::int = p_month;
END;
$$;

-- 3. Server-side Monthly Report for a given year
CREATE OR REPLACE FUNCTION public.get_finance_monthly_report(
  p_year integer
)
RETURNS TABLE (
  month integer,
  income numeric(15,2),
  expense numeric(15,2),
  net numeric(15,2)
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(1, 12) AS m
  ),
  agg AS (
    SELECT
      EXTRACT(MONTH FROM (t.transaction_date AT TIME ZONE 'UTC'))::int AS m,
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)::numeric(15,2) AS sum_income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)::numeric(15,2) AS sum_expense
    FROM public.finance_transactions t
    WHERE t.user_id = v_uid
      AND EXTRACT(YEAR FROM (t.transaction_date AT TIME ZONE 'UTC'))::int = p_year
    GROUP BY 1
  )
  SELECT
    months.m AS month,
    COALESCE(agg.sum_income, 0)::numeric(15,2) AS income,
    COALESCE(agg.sum_expense, 0)::numeric(15,2) AS expense,
    (COALESCE(agg.sum_income, 0) - COALESCE(agg.sum_expense, 0))::numeric(15,2) AS net
  FROM months
  LEFT JOIN agg ON agg.m = months.m
  ORDER BY months.m ASC;
END;
$$;

-- 4. Server-side Category Report (income or expense, optional month/year)
CREATE OR REPLACE FUNCTION public.get_finance_category_report(
  p_type text,
  p_month integer DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  type text,
  total numeric(15,2),
  count bigint,
  color text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS category_id,
    COALESCE(c.name, 'Tanpa Kategori')::text AS category_name,
    p_type::text AS type,
    COALESCE(SUM(t.amount), 0)::numeric(15,2) AS total,
    COUNT(*)::bigint AS count,
    COALESCE(c.color, '#8b929b')::text AS color
  FROM public.finance_transactions t
  LEFT JOIN public.finance_categories c
    ON c.id = t.category_id AND c.user_id = v_uid
  WHERE t.user_id = v_uid
    AND t.type = p_type
    AND (
      p_month IS NULL OR p_year IS NULL OR (
        EXTRACT(YEAR FROM (t.transaction_date AT TIME ZONE 'UTC'))::int = p_year
        AND EXTRACT(MONTH FROM (t.transaction_date AT TIME ZONE 'UTC'))::int = p_month
      )
    )
  GROUP BY c.id, c.name, c.color
  ORDER BY total DESC;
END;
$$;

-- 5. Server-side Budget Spent per category for a given month/year
CREATE OR REPLACE FUNCTION public.get_finance_budget_spent(
  p_month integer,
  p_year integer
)
RETURNS TABLE (
  category_id uuid,
  spent_amount numeric(15,2)
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    t.category_id,
    COALESCE(SUM(t.amount), 0)::numeric(15,2) AS spent_amount
  FROM public.finance_transactions t
  WHERE t.user_id = v_uid
    AND t.type = 'expense'
    AND t.category_id IS NOT NULL
    AND EXTRACT(YEAR FROM (t.transaction_date AT TIME ZONE 'UTC'))::int = p_year
    AND EXTRACT(MONTH FROM (t.transaction_date AT TIME ZONE 'UTC'))::int = p_month
  GROUP BY t.category_id;
END;
$$;

-- 6. Fix Recurring Date Drift: anchor monthly/yearly day to EXTRACT(DAY FROM start_date)
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
  v_anchor_day int;
  v_target_month_start date;
  v_target_year int;
  v_target_month int;
  v_last_day int;
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

  v_anchor_day := EXTRACT(DAY FROM v_rec.start_date)::int;

  IF v_rec.frequency = 'daily' THEN
    v_next_date := (v_rec.next_due_date + interval '1 day')::date;
  ELSIF v_rec.frequency = 'weekly' THEN
    v_next_date := (v_rec.next_due_date + interval '7 days')::date;
  ELSIF v_rec.frequency = 'monthly' THEN
    v_target_month_start := (date_trunc('month', v_rec.next_due_date) + interval '1 month')::date;
    v_last_day := EXTRACT(DAY FROM (v_target_month_start + interval '1 month - 1 day')::date)::int;
    v_next_date := make_date(
      EXTRACT(YEAR FROM v_target_month_start)::int,
      EXTRACT(MONTH FROM v_target_month_start)::int,
      LEAST(v_anchor_day, v_last_day)
    );
  ELSE
    -- yearly
    v_target_year := EXTRACT(YEAR FROM v_rec.next_due_date)::int + 1;
    v_target_month := EXTRACT(MONTH FROM v_rec.next_due_date)::int;
    v_last_day := EXTRACT(DAY FROM (make_date(v_target_year, v_target_month, 1) + interval '1 month - 1 day')::date)::int;
    v_next_date := make_date(v_target_year, v_target_month, LEAST(v_anchor_day, v_last_day));
  END IF;

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

-- 7. Transactional Account Deletion RPC
CREATE OR REPLACE FUNCTION public.delete_finance_account(
  p_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.finance_recurring_transactions
  WHERE user_id = v_uid
    AND account_id = p_account_id;

  DELETE FROM public.finance_transactions
  WHERE user_id = v_uid
    AND (account_id = p_account_id OR transfer_account_id = p_account_id);

  DELETE FROM public.finance_accounts
  WHERE id = p_account_id
    AND user_id = v_uid
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RAISE EXCEPTION 'Akun tidak ditemukan atau akses ditolak';
  END IF;
END;
$$;
