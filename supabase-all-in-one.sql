-- ========================================================
-- Sideways Grillz POS - COMPLETE DATABASE SETUP & SEED
-- Paste and run this ENTIRE file in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/osiuqvyqiekojqhpwgzt/sql/new
-- ========================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================
-- 1. CREATE CORE TABLES
-- ========================================================

-- User Profiles Table (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'waiter' CHECK (role IN ('admin', 'cashier', 'waiter', 'Admin', 'Cashier', 'Waiter')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurant Tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_no INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Booked')),
    seats INTEGER NOT NULL DEFAULT 4,
    current_order_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders Table (with Waiter Attribution)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waiter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    waiter_name TEXT,
    customer_details JSONB NOT NULL DEFAULT '{"name": "", "phone": "", "guests": 1}'::jsonb,
    order_status TEXT NOT NULL DEFAULT 'InProgress' CHECK (order_status IN ('InProgress', 'Ready', 'Completed', 'Cancelled')),
    order_date TIMESTAMPTZ DEFAULT NOW(),
    bills JSONB NOT NULL DEFAULT '{"total": 0, "tax": 0, "totalWithTax": 0}'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    payment_method TEXT DEFAULT 'Cash',
    payment_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign Key constraint for current_order_id in restaurant_tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_current_order'
    ) THEN
        ALTER TABLE public.restaurant_tables
        ADD CONSTRAINT fk_current_order
        FOREIGN KEY (current_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Payments Table (Paystack audit)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    waiter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'GHS',
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL,
    paystack_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift Handovers Table (End of Shift Cash Reconciliation)
CREATE TABLE IF NOT EXISTS public.shift_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waiter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    waiter_name TEXT NOT NULL,
    shift_date DATE DEFAULT CURRENT_DATE NOT NULL,
    shift_start TIMESTAMPTZ DEFAULT NOW(),
    shift_end TIMESTAMPTZ DEFAULT NOW(),
    total_orders INTEGER NOT NULL DEFAULT 0,
    cash_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    online_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_collected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'Handed_Over' CHECK (status IN ('Handed_Over', 'Approved', 'Discrepancy')),
    notes TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 2. TRIGGER: AUTO-CREATE PROFILE ON USER SIGNUP
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, name, email, phone, role)
    VALUES (
        NEW.id,
        LOWER(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))),
        COALESCE(NEW.raw_user_meta_data->>'name', 'Staff Member'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'waiter'))
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow staff to read profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Allow staff to view tables" ON public.restaurant_tables;
    DROP POLICY IF EXISTS "Allow staff to manage tables" ON public.restaurant_tables;
    DROP POLICY IF EXISTS "Allow staff to view orders" ON public.orders;
    DROP POLICY IF EXISTS "Allow staff to manage orders" ON public.orders;
    DROP POLICY IF EXISTS "Allow staff to view payments" ON public.payments;
    DROP POLICY IF EXISTS "Allow staff to create payments" ON public.payments;
    DROP POLICY IF EXISTS "Allow staff to view shift handovers" ON public.shift_handovers;
    DROP POLICY IF EXISTS "Allow waiters to create shift handovers" ON public.shift_handovers;
    DROP POLICY IF EXISTS "Allow admins to update shift handovers" ON public.shift_handovers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow staff to read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Allow staff to view tables" ON public.restaurant_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage tables" ON public.restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow staff to view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to manage orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow staff to view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow staff to create payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow staff to view shift handovers" ON public.shift_handovers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow waiters to create shift handovers" ON public.shift_handovers FOR INSERT TO authenticated WITH CHECK (auth.uid() = waiter_id);
CREATE POLICY "Allow admins to update shift handovers" ON public.shift_handovers FOR UPDATE TO authenticated USING (true);

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_handovers;

-- ========================================================
-- 4. SEED DATA (TABLES, STAFF LOGINS, ORDERS, HANDOVERS)
-- ========================================================

-- A. Seed 10 Restaurant Tables
INSERT INTO public.restaurant_tables (table_no, status, seats)
VALUES
    (1, 'Available', 2),
    (2, 'Available', 2),
    (3, 'Booked', 4),
    (4, 'Available', 4),
    (5, 'Available', 4),
    (6, 'Booked', 6),
    (7, 'Available', 6),
    (8, 'Available', 8),
    (9, 'Available', 4),
    (10, 'Available', 2)
ON CONFLICT (table_no) DO UPDATE SET
    seats = EXCLUDED.seats;

-- B. Seed Staff Accounts & Profiles
DO $$
DECLARE
    admin_id UUID := 'a0000000-0000-0000-0000-000000000001';
    waiter1_id UUID := 'a0000000-0000-0000-0000-000000000002';
    waiter2_id UUID := 'a0000000-0000-0000-0000-000000000003';
    cashier1_id UUID := 'a0000000-0000-0000-0000-000000000004';
    encrypted_pw TEXT;
    table3_id UUID;
    table6_id UUID;
    sample_order1 UUID := 'b0000000-0000-0000-0000-000000000001';
    sample_order2 UUID := 'b0000000-0000-0000-0000-000000000002';
BEGIN
    -- Password for all seed users is '1234' (stored hash matches '1234_sideways')
    encrypted_pw := crypt('1234_sideways', gen_salt('bf'));

    -- 1. Admin (General Manager)
    DELETE FROM auth.users WHERE email = 'admin@sidewaysgrillz.com' OR id = admin_id;
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'admin@sidewaysgrillz.com', encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"admin","name":"General Manager","phone":"0240000001","role":"admin"}'::jsonb,
        now(), now()
    );

    INSERT INTO public.profiles (id, username, name, email, phone, role)
    VALUES (admin_id, 'admin', 'General Manager', 'admin@sidewaysgrillz.com', '0240000001', 'admin')
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, name = EXCLUDED.name, role = EXCLUDED.role;

    -- 2. Waiter 1 (Alex Waiter)
    DELETE FROM auth.users WHERE email = 'waiter1@sidewaysgrillz.com' OR id = waiter1_id;
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        waiter1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'waiter1@sidewaysgrillz.com', encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"waiter1","name":"Alex Waiter","phone":"0240000002","role":"waiter"}'::jsonb,
        now(), now()
    );

    INSERT INTO public.profiles (id, username, name, email, phone, role)
    VALUES (waiter1_id, 'waiter1', 'Alex Waiter', 'waiter1@sidewaysgrillz.com', '0240000002', 'waiter')
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, name = EXCLUDED.name, role = EXCLUDED.role;

    -- 3. Waiter 2 (Sarah Waiter)
    DELETE FROM auth.users WHERE email = 'waiter2@sidewaysgrillz.com' OR id = waiter2_id;
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        waiter2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'waiter2@sidewaysgrillz.com', encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"waiter2","name":"Sarah Waiter","phone":"0240000003","role":"waiter"}'::jsonb,
        now(), now()
    );

    INSERT INTO public.profiles (id, username, name, email, phone, role)
    VALUES (waiter2_id, 'waiter2', 'Sarah Waiter', 'waiter2@sidewaysgrillz.com', '0240000003', 'waiter')
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, name = EXCLUDED.name, role = EXCLUDED.role;

    -- 4. Cashier 1 (Emma Cashier)
    DELETE FROM auth.users WHERE email = 'cashier1@sidewaysgrillz.com' OR id = cashier1_id;
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        cashier1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'cashier1@sidewaysgrillz.com', encrypted_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"username":"cashier1","name":"Emma Cashier","phone":"0240000004","role":"cashier"}'::jsonb,
        now(), now()
    );

    INSERT INTO public.profiles (id, username, name, email, phone, role)
    VALUES (cashier1_id, 'cashier1', 'Emma Cashier', 'cashier1@sidewaysgrillz.com', '0240000004', 'cashier')
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, name = EXCLUDED.name, role = EXCLUDED.role;

    -- C. Seed Sample Orders
    SELECT id INTO table3_id FROM public.restaurant_tables WHERE table_no = 3 LIMIT 1;
    SELECT id INTO table6_id FROM public.restaurant_tables WHERE table_no = 6 LIMIT 1;

    -- Sample Order 1 (Cash collected by Alex Waiter on Table 3)
    DELETE FROM public.orders WHERE id = sample_order1;
    INSERT INTO public.orders (
        id, waiter_id, waiter_name, table_id, order_status, order_date, payment_method,
        customer_details, bills, items
    ) VALUES (
        sample_order1, waiter1_id, 'Alex Waiter', table3_id, 'Ready', now() - INTERVAL '2 hours', 'Cash',
        '{"name":"Michael Osei","phone":"0244111222","guests":4}'::jsonb,
        '{"total":160,"tax":16,"totalWithTax":176}'::jsonb,
        '[{"name":"Butter Chicken","price":50,"quantity":2},{"name":"Paneer Tikka","price":30,"quantity":2}]'::jsonb
    );

    -- Sample Order 2 (Online Paystack collected by Alex Waiter on Table 6)
    DELETE FROM public.orders WHERE id = sample_order2;
    INSERT INTO public.orders (
        id, waiter_id, waiter_name, table_id, order_status, order_date, payment_method,
        customer_details, bills, items
    ) VALUES (
        sample_order2, waiter1_id, 'Alex Waiter', table6_id, 'InProgress', now() - INTERVAL '45 minutes', 'Online',
        '{"name":"Nana Mensah","phone":"0555333444","guests":5}'::jsonb,
        '{"total":220,"tax":22,"totalWithTax":242}'::jsonb,
        '[{"name":"Hyderabadi Biryani","price":60,"quantity":3},{"name":"Gulab Jamun","price":20,"quantity":2}]'::jsonb
    );

    -- Link tables to active orders
    UPDATE public.restaurant_tables SET current_order_id = sample_order1, status = 'Booked' WHERE id = table3_id;
    UPDATE public.restaurant_tables SET current_order_id = sample_order2, status = 'Booked' WHERE id = table6_id;

    -- D. Seed Sample Shift Handover
    DELETE FROM public.shift_handovers WHERE waiter_id = waiter1_id AND shift_date = CURRENT_DATE;
    INSERT INTO public.shift_handovers (
        waiter_id, waiter_name, shift_date, shift_start, shift_end,
        total_orders, cash_collected, online_collected, total_collected,
        status, notes
    ) VALUES (
        waiter1_id, 'Alex Waiter', CURRENT_DATE, now() - INTERVAL '6 hours', now(),
        2, 176.00, 242.00, 418.00,
        'Handed_Over', 'Morning shift handover. GH¢ 176 cash enclosed.'
    );

END $$;

-- Summary Check
SELECT 'Tables' AS entity, count(*) AS count FROM public.restaurant_tables
UNION ALL
SELECT 'Profiles', count(*) FROM public.profiles
UNION ALL
SELECT 'Orders', count(*) FROM public.orders
UNION ALL
SELECT 'Shift Handovers', count(*) FROM public.shift_handovers;

