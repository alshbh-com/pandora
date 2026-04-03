
-- Diaries table (daily sheets)
CREATE TABLE public.diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  diary_number integer NOT NULL DEFAULT 0,
  diary_date date NOT NULL DEFAULT CURRENT_DATE,
  is_closed boolean NOT NULL DEFAULT false,
  lock_status_updates boolean NOT NULL DEFAULT false,
  prevent_new_orders boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE(office_id, diary_number)
);

-- Diary orders linking table
CREATE TABLE public.diary_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  diary_id uuid NOT NULL REFERENCES public.diaries(id) ON DELETE CASCADE,
  status_inside_diary text NOT NULL DEFAULT 'بدون حالة',
  partial_amount numeric DEFAULT 0,
  n_column text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, diary_id)
);

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'أخرى',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-increment diary_number per office
CREATE OR REPLACE FUNCTION public.generate_diary_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  SELECT COALESCE(MAX(diary_number), 0) + 1 INTO NEW.diary_number
  FROM public.diaries WHERE office_id = NEW.office_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_diary_number
BEFORE INSERT ON public.diaries
FOR EACH ROW EXECUTE FUNCTION public.generate_diary_number();

-- Cleanup old closed diaries (3 months)
CREATE OR REPLACE FUNCTION public.cleanup_old_diaries()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.diaries WHERE is_closed = true AND closed_at < now() - interval '3 months';
$$;

-- RLS for diaries
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read diaries" ON public.diaries FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert diaries" ON public.diaries FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update diaries" ON public.diaries FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete diaries" ON public.diaries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- RLS for diary_orders
ALTER TABLE public.diary_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read diary_orders" ON public.diary_orders FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert diary_orders" ON public.diary_orders FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update diary_orders" ON public.diary_orders FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete diary_orders" ON public.diary_orders FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- RLS for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read expenses" ON public.expenses FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
