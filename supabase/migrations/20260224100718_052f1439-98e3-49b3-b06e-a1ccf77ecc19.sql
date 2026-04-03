
-- Create advances/loans table for employees
CREATE TABLE public.advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  type text NOT NULL DEFAULT 'advance' CHECK (type IN ('advance', 'deduction', 'bonus')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read advances" ON public.advances FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert advances" ON public.advances FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update advances" ON public.advances FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete advances" ON public.advances FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Courier can read own advances" ON public.advances FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Create courier_bonuses table for special bonuses
CREATE TABLE public.courier_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can read bonuses" ON public.courier_bonuses FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert bonuses" ON public.courier_bonuses FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update bonuses" ON public.courier_bonuses FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete bonuses" ON public.courier_bonuses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- Create a numeric-only barcode sequence
CREATE SEQUENCE IF NOT EXISTS public.barcode_numeric_seq START WITH 1 INCREMENT BY 1;

-- Insert default statuses if not exist
INSERT INTO public.order_statuses (name, color, sort_order)
SELECT name, color, sort_order FROM (VALUES
  ('جديد', '#6b7280', 0),
  ('قيد التوصيل', '#3b82f6', 1),
  ('تم التسليم', '#10b981', 2),
  ('مرتجع', '#ef4444', 3),
  ('مرتجع بشحن', '#f97316', 4),
  ('مرتجع دون شحن', '#dc2626', 5),
  ('مؤجل', '#eab308', 6),
  ('رفض', '#991b1b', 7),
  ('رفض واخد شحن', '#7c2d12', 8)
) AS t(name, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.order_statuses WHERE order_statuses.name = t.name);
