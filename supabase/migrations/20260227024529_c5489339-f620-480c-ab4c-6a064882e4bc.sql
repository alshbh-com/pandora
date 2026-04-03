
-- Add address to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address text DEFAULT '';

-- Add salary to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary numeric NOT NULL DEFAULT 0;

-- Create office_payments table for advance payments to offices
CREATE TABLE IF NOT EXISTS public.office_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'advance',
  notes text DEFAULT '',
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read office_payments" ON public.office_payments FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert office_payments" ON public.office_payments FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update office_payments" ON public.office_payments FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete office_payments" ON public.office_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
