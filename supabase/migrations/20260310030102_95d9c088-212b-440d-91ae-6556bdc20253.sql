
-- Table for persisting office settlement data
CREATE TABLE public.office_daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  closing_date date NOT NULL DEFAULT CURRENT_DATE,
  data_json jsonb NOT NULL DEFAULT '{}',
  pickup_rate numeric NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  prevent_add boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_daily_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/Admin can manage closings" ON public.office_daily_closings
  FOR ALL TO authenticated
  USING (is_owner_or_admin(auth.uid()))
  WITH CHECK (is_owner_or_admin(auth.uid()));

-- Add orange sheet extra fields to diaries
ALTER TABLE public.diaries 
  ADD COLUMN IF NOT EXISTS orange_extra_due numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orange_extra_due_reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_postponed_due boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS manual_arrived_total numeric DEFAULT NULL;
