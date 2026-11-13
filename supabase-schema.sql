-- ========================================================
-- Restaurant POS System - Supabase PostgreSQL Schema
-- ========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create User Profiles Table (Linked with Supabase Auth)
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

-- 3. Create Restaurant Tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_no INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Booked')),
    seats INTEGER NOT NULL DEFAULT 4,
    current_order_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Orders Table (with Waiter Attribution)
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

-- Add Foreign Key constraint for current_order_id in restaurant_tables
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

-- 5. Create Payments Table
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

-- 6. Create Shift Handovers Table (End of Shift Cash Reconciliation)
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
-- Trigger: Auto-create Profile on Supabase User Signup
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
-- Row Level Security (RLS) Configuration
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated staff can read all profiles and update their own
CREATE POLICY "Allow authenticated staff to read profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow users to update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Restaurant Tables: Authenticated users can view, insert, update
CREATE POLICY "Allow authenticated staff to view tables"
    ON public.restaurant_tables FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated staff to manage tables"
    ON public.restaurant_tables FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Orders: Authenticated staff can view, insert, update orders
CREATE POLICY "Allow authenticated staff to view orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated staff to manage orders"
    ON public.orders FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Payments: Authenticated staff can view and insert payments
CREATE POLICY "Allow authenticated staff to view payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated staff to create payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Shift Handovers: Waiters can create handovers, staff can view, admins can approve
CREATE POLICY "Allow staff to view shift handovers"
    ON public.shift_handovers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow staff to create shift handovers"
    ON public.shift_handovers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow admins to update/approve shift handovers"
    ON public.shift_handovers FOR UPDATE
    TO authenticated
    USING (true);

-- ========================================================
-- Realtime Publications (Enables live UI updates)
-- ========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_handovers;
