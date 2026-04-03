
-- Add login_code column to profiles to store visible password
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_code text DEFAULT '';

-- Create user_permissions table
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  permission text NOT NULL DEFAULT 'hidden' CHECK (permission IN ('view', 'edit', 'hidden')),
  UNIQUE(user_id, section)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Owner/Admin can read permissions
CREATE POLICY "Owner/Admin can read permissions"
  ON public.user_permissions FOR SELECT
  TO authenticated
  USING (is_owner_or_admin(auth.uid()) OR user_id = auth.uid());

-- Owner can manage permissions
CREATE POLICY "Owner can insert permissions"
  ON public.user_permissions FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can update permissions"
  ON public.user_permissions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can delete permissions"
  ON public.user_permissions FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'owner'));
