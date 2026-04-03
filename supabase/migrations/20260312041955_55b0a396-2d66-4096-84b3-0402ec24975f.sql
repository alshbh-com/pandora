
-- ALL TABLES

CREATE TABLE public.offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  specialty text DEFAULT '',
  owner_name text DEFAULT '',
  owner_phone text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  can_add_orders boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  login_code text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  salary numeric NOT NULL DEFAULT 0,
  coverage_areas text DEFAULT '',
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  agreement_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  is_fixed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL DEFAULT '',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text DEFAULT '',
  tracking_id text DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  customer_phone text DEFAULT '',
  customer_code text DEFAULT '',
  product_name text DEFAULT 'بدون منتج',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  delivery_price numeric NOT NULL DEFAULT 0,
  partial_amount numeric DEFAULT 0,
  shipping_paid numeric DEFAULT 0,
  color text DEFAULT '',
  size text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  priority text NOT NULL DEFAULT 'normal',
  status_id uuid REFERENCES public.order_statuses(id) ON DELETE SET NULL,
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  courier_id uuid,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  is_closed boolean NOT NULL DEFAULT false,
  is_settled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  type text NOT NULL DEFAULT 'advance' CHECK (type IN ('advance', 'deduction', 'bonus')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.courier_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.delivery_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  governorate text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  pickup_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.office_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'advance',
  notes text DEFAULT '',
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  permission text NOT NULL DEFAULT 'hidden' CHECK (permission IN ('view', 'edit', 'hidden')),
  UNIQUE(user_id, section)
);

CREATE TABLE public.diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  diary_number integer NOT NULL DEFAULT 0,
  diary_date date NOT NULL DEFAULT CURRENT_DATE,
  is_closed boolean NOT NULL DEFAULT false,
  is_archived boolean DEFAULT false,
  lock_status_updates boolean NOT NULL DEFAULT false,
  prevent_new_orders boolean NOT NULL DEFAULT false,
  cash_arrived_entries jsonb DEFAULT '[]'::jsonb,
  balance numeric DEFAULT 0,
  previous_due numeric DEFAULT 0,
  orange_extra_due numeric DEFAULT 0,
  orange_extra_due_reason text DEFAULT '',
  show_postponed_due boolean DEFAULT true,
  manual_arrived_total numeric DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE(office_id, diary_number)
);

CREATE TABLE public.diary_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  diary_id uuid NOT NULL REFERENCES public.diaries(id) ON DELETE CASCADE,
  status_inside_diary text NOT NULL DEFAULT 'بدون حالة',
  partial_amount numeric DEFAULT 0,
  n_column text DEFAULT '',
  notes text DEFAULT '',
  locked_status boolean DEFAULT false,
  copied_from_diary_id uuid REFERENCES public.diaries(id) ON DELETE SET NULL,
  copied_from_diary_order_id uuid,
  manual_pickup numeric DEFAULT 0,
  manual_arrived numeric DEFAULT 0,
  manual_shipping_diff numeric DEFAULT 0,
  manual_delivery_commission numeric DEFAULT 0,
  manual_reject_no_ship numeric DEFAULT 0,
  manual_return_penalty numeric DEFAULT 0,
  manual_return_status text DEFAULT '',
  manual_total_amount numeric DEFAULT NULL,
  manual_shipping_amount numeric DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, diary_id)
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'أخرى',
  notes text DEFAULT '',
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cash_flow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'inside',
  amount numeric NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text DEFAULT '',
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.courier_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude numeric NOT NULL DEFAULT 0,
  longitude numeric NOT NULL DEFAULT 0,
  accuracy numeric DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(courier_id)
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.courier_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  collected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.office_daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  closing_date date NOT NULL DEFAULT CURRENT_DATE,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  pickup_rate numeric NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  prevent_add boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.barcode_numeric_seq START WITH 1 INCREMENT BY 1;

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner', 'admin'))
$$;

CREATE OR REPLACE FUNCTION public.nextval_barcode()
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT nextval('public.barcode_numeric_seq');
$$;

CREATE OR REPLACE FUNCTION public.generate_barcode()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := nextval('public.barcode_numeric_seq')::TEXT;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_barcode_on_insert BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_barcode();

CREATE OR REPLACE FUNCTION public.generate_diary_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  SELECT COALESCE(MAX(diary_number), 0) + 1 INTO NEW.diary_number FROM public.diaries WHERE office_id = NEW.office_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_diary_number BEFORE INSERT ON public.diaries FOR EACH ROW EXECUTE FUNCTION public.generate_diary_number();

CREATE OR REPLACE FUNCTION public.auto_create_diary_for_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_diary_id uuid; v_order_date date;
BEGIN
  IF NEW.office_id IS NULL THEN RETURN NEW; END IF;
  v_order_date := (NEW.created_at AT TIME ZONE 'UTC')::date;
  SELECT id INTO v_diary_id FROM public.diaries WHERE office_id = NEW.office_id AND diary_date = v_order_date AND is_closed = false AND is_archived = false AND prevent_new_orders = false LIMIT 1;
  IF v_diary_id IS NULL THEN
    INSERT INTO public.diaries (office_id, diary_date) VALUES (NEW.office_id, v_order_date) RETURNING id INTO v_diary_id;
  END IF;
  IF v_diary_id IS NOT NULL THEN
    INSERT INTO public.diary_orders (order_id, diary_id) VALUES (NEW.id, v_diary_id) ON CONFLICT (order_id, diary_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER auto_diary_on_order_insert AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_create_diary_for_order();

CREATE OR REPLACE FUNCTION public.log_activity(_action text, _details jsonb DEFAULT '{}'::jsonb, _user_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.activity_logs WHERE created_at < now() - interval '7 days';
  INSERT INTO public.activity_logs (action, details, user_id) VALUES (_action, _details, COALESCE(_user_id, auth.uid()));
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  DELETE FROM public.activity_logs WHERE created_at < now() - interval '7 days';
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_diaries()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.diaries SET is_archived = true WHERE is_closed = true AND is_archived = false AND closed_at < now() - interval '3 months';
  DELETE FROM public.diaries WHERE is_archived = true AND closed_at < now() - interval '6 months';
END;
$$;

-- ENABLE RLS
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_daily_closings ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "Authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Owner/Admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Authenticated can read offices" ON public.offices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert offices" ON public.offices FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update offices" ON public.offices FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete offices" ON public.offices FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated can read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update companies" ON public.companies FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete companies" ON public.companies FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated can read statuses" ON public.order_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert statuses" ON public.order_statuses FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update statuses" ON public.order_statuses FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete statuses" ON public.order_statuses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update products" ON public.products FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete products" ON public.products FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated can read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner/Admin can read logs" ON public.activity_logs FOR SELECT USING (public.is_owner_or_admin(auth.uid()));
CREATE POLICY "Authenticated can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owner/Admin can read orders" ON public.orders FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Courier can read assigned orders" ON public.orders FOR SELECT TO authenticated USING (courier_id = auth.uid());
CREATE POLICY "Office user can read own office orders" ON public.orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'office'::app_role) AND office_id = (SELECT office_id FROM public.profiles WHERE id = auth.uid()) AND is_closed = false);
CREATE POLICY "Owner/Admin can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Office user can insert orders for own office" ON public.orders FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'office'::app_role) AND office_id = (SELECT profiles.office_id FROM profiles WHERE profiles.id = auth.uid()) AND EXISTS (SELECT 1 FROM offices WHERE offices.id = office_id AND offices.can_add_orders = true));
CREATE POLICY "Owner/Admin can update orders" ON public.orders FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Courier can update assigned orders" ON public.orders FOR UPDATE TO authenticated USING (courier_id = auth.uid());
CREATE POLICY "Owner can delete orders" ON public.orders FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated can read order notes" ON public.order_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert notes" ON public.order_notes FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Courier can insert notes on assigned orders" ON public.order_notes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'courier') AND EXISTS (SELECT 1 FROM orders WHERE id = order_id AND courier_id = auth.uid()));
CREATE POLICY "Owner can delete notes" ON public.order_notes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner/Admin can read advances" ON public.advances FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert advances" ON public.advances FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update advances" ON public.advances FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete advances" ON public.advances FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Courier can read own advances" ON public.advances FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner/Admin can read bonuses" ON public.courier_bonuses FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert bonuses" ON public.courier_bonuses FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update bonuses" ON public.courier_bonuses FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete bonuses" ON public.courier_bonuses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated can read delivery_prices" ON public.delivery_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner/Admin can insert delivery_prices" ON public.delivery_prices FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update delivery_prices" ON public.delivery_prices FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete delivery_prices" ON public.delivery_prices FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner/Admin can read office_payments" ON public.office_payments FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Office user can read own office payments" ON public.office_payments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'office'::app_role) AND office_id = (SELECT office_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Owner/Admin can insert office_payments" ON public.office_payments FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update office_payments" ON public.office_payments FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete office_payments" ON public.office_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner/Admin can read permissions" ON public.user_permissions FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Owner can insert permissions" ON public.user_permissions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner can update permissions" ON public.user_permissions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner can delete permissions" ON public.user_permissions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner/Admin can read diaries" ON public.diaries FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert diaries" ON public.diaries FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update diaries" ON public.diaries FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete diaries" ON public.diaries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner/Admin can read diary_orders" ON public.diary_orders FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert diary_orders" ON public.diary_orders FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update diary_orders" ON public.diary_orders FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete diary_orders" ON public.diary_orders FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner/Admin can read expenses" ON public.expenses FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner/Admin can read cash_flow" ON public.cash_flow_entries FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can insert cash_flow" ON public.cash_flow_entries FOR INSERT TO authenticated WITH CHECK (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner/Admin can update cash_flow" ON public.cash_flow_entries FOR UPDATE TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Owner can delete cash_flow" ON public.cash_flow_entries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Courier can upsert own location" ON public.courier_locations FOR ALL TO authenticated USING (courier_id = auth.uid()) WITH CHECK (courier_id = auth.uid());
CREATE POLICY "Owner/Admin can read all locations" ON public.courier_locations FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Receiver can update messages" ON public.messages FOR UPDATE TO authenticated USING (receiver_id = auth.uid());
CREATE POLICY "Owner/Admin can read all messages" ON public.messages FOR SELECT TO authenticated USING (is_owner_or_admin(auth.uid()));
CREATE POLICY "Authenticated can read collections" ON public.courier_collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert collections" ON public.courier_collections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update collections" ON public.courier_collections FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete collections" ON public.courier_collections FOR DELETE TO authenticated USING (true);
CREATE POLICY "Owner/Admin can manage closings" ON public.office_daily_closings FOR ALL TO authenticated USING (is_owner_or_admin(auth.uid())) WITH CHECK (is_owner_or_admin(auth.uid()));

-- DEFAULT DATA
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
