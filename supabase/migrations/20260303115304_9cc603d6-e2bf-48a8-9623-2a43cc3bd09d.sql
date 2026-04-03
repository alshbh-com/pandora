
-- Add is_fixed column to order_statuses
ALTER TABLE public.order_statuses ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false;

-- Delete all existing statuses (clean slate for fixed ones)
DELETE FROM public.order_statuses;

-- Insert the 10 fixed statuses
INSERT INTO public.order_statuses (name, color, sort_order, is_fixed) VALUES
  ('بدون حالة', '#6b7280', 0, true),
  ('قيد التوصيل', '#3b82f6', 1, true),
  ('تم التسليم', '#22c55e', 2, true),
  ('تسليم جزئي', '#14b8a6', 3, true),
  ('مؤجل', '#f59e0b', 4, true),
  ('رفض ولم يدفع شحن', '#ef4444', 5, true),
  ('رفض ودفع شحن', '#f97316', 6, true),
  ('استلم ودفع نص الشحن', '#8b5cf6', 7, true),
  ('تهرب', '#dc2626', 8, true),
  ('ملغي', '#9ca3af', 9, true),
  ('لم يرد', '#64748b', 10, true);

-- Create function to auto-delete old activity logs (older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.activity_logs WHERE created_at < now() - interval '7 days';
$$;

-- Create a function to log activity  
CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _details jsonb DEFAULT '{}'::jsonb,
  _user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cleanup old logs first
  DELETE FROM public.activity_logs WHERE created_at < now() - interval '7 days';
  -- Insert new log
  INSERT INTO public.activity_logs (action, details, user_id)
  VALUES (_action, _details, COALESCE(_user_id, auth.uid()));
END;
$$;

-- Allow authenticated users to call log_activity
GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;

-- Add RLS policy for authenticated to insert logs (if not exists already, the existing one covers it)
