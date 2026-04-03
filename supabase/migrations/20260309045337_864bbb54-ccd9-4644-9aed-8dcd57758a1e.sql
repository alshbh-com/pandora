
-- 1. Courier live locations table
CREATE TABLE public.courier_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude numeric NOT NULL DEFAULT 0,
  longitude numeric NOT NULL DEFAULT 0,
  accuracy numeric DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(courier_id)
);

ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Courier can upsert own location" ON public.courier_locations
  FOR ALL TO authenticated
  USING (courier_id = auth.uid())
  WITH CHECK (courier_id = auth.uid());

CREATE POLICY "Owner/Admin can read all locations" ON public.courier_locations
  FOR SELECT TO authenticated
  USING (is_owner_or_admin(auth.uid()));

-- 2. Internal messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Receiver can update (mark read)" ON public.messages
  FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid());

CREATE POLICY "Owner/Admin can read all messages" ON public.messages
  FOR SELECT TO authenticated
  USING (is_owner_or_admin(auth.uid()));

-- 3. Add priority column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
