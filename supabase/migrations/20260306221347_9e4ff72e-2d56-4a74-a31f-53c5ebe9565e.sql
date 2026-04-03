
-- Add missing columns to diary_orders
ALTER TABLE public.diary_orders ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.diary_orders ADD COLUMN IF NOT EXISTS locked_status boolean DEFAULT false;
ALTER TABLE public.diary_orders ADD COLUMN IF NOT EXISTS copied_from_diary_id uuid REFERENCES public.diaries(id) ON DELETE SET NULL;
ALTER TABLE public.diary_orders ADD COLUMN IF NOT EXISTS copied_from_diary_order_id uuid REFERENCES public.diary_orders(id) ON DELETE SET NULL;

-- Add is_archived to diaries
ALTER TABLE public.diaries ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Add office_id to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;

-- Cash flow entries table
CREATE TABLE public.cash_flow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'inside',
  amount numeric NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text DEFAULT '',
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read cash_flow" ON public.cash_flow_entries FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert cash_flow" ON public.cash_flow_entries FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update cash_flow" ON public.cash_flow_entries FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete cash_flow" ON public.cash_flow_entries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- Auto-create diary and link orders when an order is inserted
CREATE OR REPLACE FUNCTION public.auto_create_diary_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_diary_id uuid;
  v_order_date date;
BEGIN
  IF NEW.office_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_order_date := (NEW.created_at AT TIME ZONE 'UTC')::date;

  -- Find existing open, non-archived diary for this office and date
  SELECT id INTO v_diary_id
  FROM public.diaries
  WHERE office_id = NEW.office_id
    AND diary_date = v_order_date
    AND is_closed = false
    AND is_archived = false
    AND prevent_new_orders = false
  LIMIT 1;

  -- If no diary exists, create one
  IF v_diary_id IS NULL THEN
    INSERT INTO public.diaries (office_id, diary_date)
    VALUES (NEW.office_id, v_order_date)
    RETURNING id INTO v_diary_id;
  END IF;

  -- Link order to diary
  IF v_diary_id IS NOT NULL THEN
    INSERT INTO public.diary_orders (order_id, diary_id)
    VALUES (NEW.id, v_diary_id)
    ON CONFLICT (order_id, diary_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_diary_on_order_insert
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.auto_create_diary_for_order();

-- Auto-archive and cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_diaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Archive closed diaries older than 3 months
  UPDATE public.diaries
  SET is_archived = true
  WHERE is_closed = true
    AND is_archived = false
    AND closed_at < now() - interval '3 months';

  -- Delete archived diaries older than 6 months
  DELETE FROM public.diaries
  WHERE is_archived = true
    AND closed_at < now() - interval '6 months';
END;
$$;
