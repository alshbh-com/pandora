
-- Company payments table
CREATE TABLE public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read company_payments" ON public.company_payments FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert company_payments" ON public.company_payments FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update company_payments" ON public.company_payments FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete company_payments" ON public.company_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
