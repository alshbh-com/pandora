
-- ============================================
-- COMPLETE DATABASE SCHEMA FOR SHIPPING SYSTEM
-- ============================================

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  login_code TEXT DEFAULT '',
  office_id UUID,
  salary NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Service role can manage profiles" ON public.profiles FOR ALL USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. USER ROLES
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'courier', 'office');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Authenticated can read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 3. USER PERMISSIONS
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  section TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section, permission)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read permissions" ON public.user_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage permissions" ON public.user_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 4. OFFICES
CREATE TABLE public.offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  owner_phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read offices" ON public.offices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage offices" ON public.offices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- Add FK for profiles.office_id
ALTER TABLE public.profiles ADD CONSTRAINT profiles_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;

-- 5. ORDER STATUSES
CREATE TABLE public.order_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read statuses" ON public.order_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage statuses" ON public.order_statuses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- Insert default statuses
INSERT INTO public.order_statuses (name, color, sort_order) VALUES
  ('جديد', '#3b82f6', 0),
  ('قيد التوصيل', '#f59e0b', 1),
  ('تم التسليم', '#22c55e', 2),
  ('تسليم جزئي', '#06b6d4', 3),
  ('مؤجل', '#8b5cf6', 4),
  ('رفض ودفع شحن', '#ef4444', 5),
  ('رفض ولم يدفع شحن', '#dc2626', 6),
  ('استلم ودفع نص الشحن', '#f97316', 7),
  ('تهرب', '#991b1b', 8),
  ('ملغي', '#6b7280', 9),
  ('لم يرد', '#a855f7', 10),
  ('لايرد', '#7c3aed', 11),
  ('الشحن على الراسل', '#0ea5e9', 12);

-- 6. PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 7. COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agreement_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 8. ORDERS (main table)
CREATE SEQUENCE public.orders_barcode_seq START WITH 1;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT UNIQUE DEFAULT lpad(nextval('public.orders_barcode_seq')::text, 6, '0'),
  tracking_id TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_code TEXT DEFAULT '',
  product_name TEXT DEFAULT 'بدون منتج',
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  delivery_price NUMERIC NOT NULL DEFAULT 0,
  color TEXT DEFAULT '',
  size TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  priority TEXT DEFAULT 'normal',
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  courier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.order_statuses(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  is_courier_closed BOOLEAN NOT NULL DEFAULT false,
  is_settled BOOLEAN NOT NULL DEFAULT false,
  shipping_paid NUMERIC DEFAULT 0,
  partial_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- 9. DELIVERY PRICES
CREATE TABLE public.delivery_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  governorate TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  pickup_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read delivery_prices" ON public.delivery_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage delivery_prices" ON public.delivery_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 10. DIARIES (daily sheets)
CREATE TABLE public.diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  diary_number SERIAL,
  diary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  lock_status_updates BOOLEAN NOT NULL DEFAULT false,
  prevent_new_orders BOOLEAN NOT NULL DEFAULT false,
  -- Financial summary fields
  cash_arrived_entries JSONB DEFAULT '[]',
  balance NUMERIC DEFAULT 0,
  previous_due NUMERIC DEFAULT 0,
  show_postponed_due BOOLEAN DEFAULT true,
  manual_arrived_total NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read diaries" ON public.diaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage diaries" ON public.diaries FOR ALL TO authenticated USING (true);

-- 11. DIARY ORDERS (orders inside a diary)
CREATE TABLE public.diary_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id UUID REFERENCES public.diaries(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  status_inside_diary TEXT DEFAULT 'بدون حالة',
  n_column TEXT DEFAULT '',
  partial_amount NUMERIC DEFAULT 0,
  manual_return_status TEXT DEFAULT '',
  manual_shipping NUMERIC DEFAULT 0,
  manual_return_amount NUMERIC DEFAULT 0,
  manual_commission NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.diary_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read diary_orders" ON public.diary_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage diary_orders" ON public.diary_orders FOR ALL TO authenticated USING (true);

-- 12. ORDER NOTES
CREATE TABLE public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read order_notes" ON public.order_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert order_notes" ON public.order_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can delete order_notes" ON public.order_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- 13. COURIER COLLECTIONS
CREATE TABLE public.courier_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  collected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read courier_collections" ON public.courier_collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage courier_collections" ON public.courier_collections FOR ALL TO authenticated USING (true);

-- 14. COURIER BONUSES
CREATE TABLE public.courier_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read courier_bonuses" ON public.courier_bonuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage courier_bonuses" ON public.courier_bonuses FOR ALL TO authenticated USING (true);

-- 15. COURIER LOCATIONS (GPS tracking)
CREATE TABLE public.courier_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read courier_locations" ON public.courier_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Couriers can upsert own location" ON public.courier_locations FOR ALL TO authenticated USING (true);

-- 16. OFFICE PAYMENTS
CREATE TABLE public.office_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'advance',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.office_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read office_payments" ON public.office_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage office_payments" ON public.office_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 17. COMPANY PAYMENTS
CREATE TABLE public.company_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read company_payments" ON public.company_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage company_payments" ON public.company_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 18. ADVANCES (salary advances/deductions)
CREATE TABLE public.advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'advance',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read advances" ON public.advances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage advances" ON public.advances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 19. EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'أخرى',
  notes TEXT DEFAULT '',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 20. CASH FLOW ENTRIES
CREATE TABLE public.cash_flow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'inside',
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read cash_flow_entries" ON public.cash_flow_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners/admins can manage cash_flow_entries" ON public.cash_flow_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- 21. OFFICE DAILY CLOSINGS
CREATE TABLE public.office_daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  data_json JSONB DEFAULT '[]',
  pickup_rate NUMERIC DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  prevent_add BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (office_id, closing_date)
);
ALTER TABLE public.office_daily_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read office_daily_closings" ON public.office_daily_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage office_daily_closings" ON public.office_daily_closings FOR ALL TO authenticated USING (true);

-- 22. MESSAGES (internal chat)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own received messages" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- 23. ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read activity_logs" ON public.activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activity_logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- log_activity RPC function
CREATE OR REPLACE FUNCTION public.log_activity(_action TEXT, _details JSONB DEFAULT '{}')
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (auth.uid(), _action, _details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-delete logs older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.activity_logs WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 24. APP SETTINGS
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
