
-- =============================================
-- FULL DATABASE SCHEMA FOR THE PILITO SHIPPING SYSTEM
-- =============================================

-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'courier', 'office');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  login_code TEXT DEFAULT '',
  office_id UUID,
  salary NUMERIC DEFAULT 0,
  address TEXT DEFAULT '',
  coverage_areas TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (true);

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_all" ON public.user_roles FOR ALL TO service_role USING (true);

-- 4. User permissions table
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  section TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'edit',
  UNIQUE (user_id, section)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_permissions_select" ON public.user_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_permissions_all" ON public.user_permissions FOR ALL TO authenticated USING (true);

-- 5. Offices table
CREATE TABLE public.offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  can_add_orders BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offices_all" ON public.offices FOR ALL TO authenticated USING (true);

-- Add FK from profiles to offices
ALTER TABLE public.profiles ADD CONSTRAINT profiles_office_fk FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;

-- 6. Order statuses table
CREATE TABLE public.order_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_statuses_all" ON public.order_statuses FOR ALL TO authenticated USING (true);

-- 7. Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_all" ON public.products FOR ALL TO authenticated USING (true);

-- 8. Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agreement_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_all" ON public.companies FOR ALL TO authenticated USING (true);

-- 9. Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE,
  barcode TEXT,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  customer_code TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INT DEFAULT 1,
  price NUMERIC DEFAULT 0,
  delivery_price NUMERIC DEFAULT 0,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.order_statuses(id) ON DELETE SET NULL,
  courier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  color TEXT DEFAULT '',
  size TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  priority TEXT DEFAULT 'normal',
  is_closed BOOLEAN DEFAULT false,
  is_settled BOOLEAN DEFAULT false,
  partial_amount NUMERIC DEFAULT 0,
  shipping_paid NUMERIC DEFAULT 0,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_all" ON public.orders FOR ALL TO authenticated USING (true);

-- 10. Order notes table
CREATE TABLE public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_notes_all" ON public.order_notes FOR ALL TO authenticated USING (true);

-- 11. Delivery prices table
CREATE TABLE public.delivery_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  governorate TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  pickup_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_prices_all" ON public.delivery_prices FOR ALL TO authenticated USING (true);

-- 12. Diaries table
CREATE TABLE public.diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  diary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_closed BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  lock_status_updates BOOLEAN DEFAULT false,
  cash_arrived_entries JSONB DEFAULT '[]'::jsonb,
  balance NUMERIC DEFAULT 0,
  previous_due NUMERIC DEFAULT 0,
  show_postponed_due BOOLEAN DEFAULT true,
  manual_arrived_total NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diaries_all" ON public.diaries FOR ALL TO authenticated USING (true);

-- 13. Diary orders table
CREATE TABLE public.diary_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id UUID REFERENCES public.diaries(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  status_inside_diary TEXT DEFAULT 'بدون حالة',
  partial_amount NUMERIC DEFAULT 0,
  n_column TEXT DEFAULT '',
  manual_return_status TEXT DEFAULT '',
  manual_shipping NUMERIC DEFAULT 0,
  manual_collected NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.diary_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_orders_all" ON public.diary_orders FOR ALL TO authenticated USING (true);

-- 14. Courier collections table
CREATE TABLE public.courier_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_collections_all" ON public.courier_collections FOR ALL TO authenticated USING (true);

-- 15. Courier bonuses table
CREATE TABLE public.courier_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC DEFAULT 0,
  reason TEXT DEFAULT '',
  type TEXT DEFAULT 'special',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_bonuses_all" ON public.courier_bonuses FOR ALL TO authenticated USING (true);

-- 16. Advances table
CREATE TABLE public.advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC DEFAULT 0,
  reason TEXT DEFAULT '',
  type TEXT DEFAULT 'advance',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advances_all" ON public.advances FOR ALL TO authenticated USING (true);

-- 17. Company payments table
CREATE TABLE public.company_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_payments_all" ON public.company_payments FOR ALL TO authenticated USING (true);

-- 18. Office payments table
CREATE TABLE public.office_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC DEFAULT 0,
  type TEXT DEFAULT 'advance',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.office_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office_payments_all" ON public.office_payments FOR ALL TO authenticated USING (true);

-- 19. Office daily closings table
CREATE TABLE public.office_daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  data_json JSONB DEFAULT '[]'::jsonb,
  pickup_rate NUMERIC DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  prevent_add BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, closing_date)
);
ALTER TABLE public.office_daily_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office_daily_closings_all" ON public.office_daily_closings FOR ALL TO authenticated USING (true);

-- 20. Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_name TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'أخرى',
  notes TEXT DEFAULT '',
  expense_date DATE DEFAULT CURRENT_DATE,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_all" ON public.expenses FOR ALL TO authenticated USING (true);

-- 21. Cash flow entries table
CREATE TABLE public.cash_flow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT DEFAULT 'inside',
  amount NUMERIC DEFAULT 0,
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  entry_date DATE DEFAULT CURRENT_DATE,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_flow_entries_all" ON public.cash_flow_entries FOR ALL TO authenticated USING (true);

-- 22. App settings table
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_all" ON public.app_settings FOR ALL TO authenticated USING (true);

-- 23. Activity logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_all" ON public.activity_logs FOR ALL TO authenticated USING (true);

-- 24. Courier locations table
CREATE TABLE public.courier_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_locations_all" ON public.courier_locations FOR ALL TO authenticated USING (true);

-- 25. Messages table (internal chat)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated 
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated 
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated 
  USING (receiver_id = auth.uid());

-- 26. log_activity RPC function
CREATE OR REPLACE FUNCTION public.log_activity(_action TEXT, _details JSONB DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (auth.uid(), _action, _details);
END;
$$;

-- 27. Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 28. Barcode sequence
CREATE SEQUENCE IF NOT EXISTS public.order_barcode_seq START WITH 1000;

CREATE OR REPLACE FUNCTION public.generate_order_barcode()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := nextval('public.order_barcode_seq')::TEXT;
  END IF;
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := 'TP-' || NEW.barcode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_barcode
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_barcode();

-- 29. Auto-delete activity logs older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.activity_logs WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- 30. Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
