
-- Order notes table for owner and courier notes
CREATE TABLE public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read order notes"
  ON public.order_notes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner/Admin can insert notes"
  ON public.order_notes FOR INSERT TO authenticated
  WITH CHECK (is_owner_or_admin(auth.uid()));

CREATE POLICY "Courier can insert notes on assigned orders"
  ON public.order_notes FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'courier') AND
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND courier_id = auth.uid())
  );

CREATE POLICY "Owner can delete notes"
  ON public.order_notes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'));

-- Auto-generate barcode sequence
CREATE SEQUENCE IF NOT EXISTS public.barcode_seq START WITH 1000;
