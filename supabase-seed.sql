-- ========================================================
-- Sideways Grillz - Supabase Database Seed Script
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/osiuqvyqiekojqhpwgzt/sql/new
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. SEED RESTAURANT TABLES
-- ========================================================
INSERT INTO public.restaurant_tables (table_no, status, seats)
VALUES
    ('Table 1', 'Available', 2),
    ('Table 2', 'Available', 2),
    ('Table 3', 'Booked', 4),
    ('Table 4', 'Available', 4),
    ('Table 5', 'Available', 4),
    ('Table 6', 'Booked', 6),
    ('Table 7', 'Available', 6),
    ('Table 8', 'Available', 8),
    ('Table 9', 'Available', 4),
    ('Table 10', 'Available', 2)
ON CONFLICT (table_no) DO UPDATE SET
    seats = EXCLUDED.seats;


-- 2. SEED STAFF USERS & PROFILES
-- ========================================================
-- Helper function to seed auth user safely with pre-confirmed email
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
    -- Password for all seed users is '1234' (internal hash matches '1234_sideways' and '1234')
    encrypted_pw := crypt('1234_sideways', gen_salt('bf'));

    -- A. Insert or update Admin User
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

    -- B. Insert or update Waiter 1 (Alex Waiter)
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

    -- C. Insert or update Waiter 2 (Sarah Waiter)
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

    -- D. Insert or update Cashier 1 (Emma Cashier)
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

    -- 3. SEED SAMPLE ORDERS FOR WAITERS
    -- ========================================================
    SELECT id INTO table3_id FROM public.restaurant_tables WHERE table_no = 'Table 3' LIMIT 1;
    SELECT id INTO table6_id FROM public.restaurant_tables WHERE table_no = 'Table 6' LIMIT 1;

    -- Sample Order 1 (Cash collected by Alex Waiter)
    DELETE FROM public.orders WHERE id = sample_order1;
    INSERT INTO public.orders (
        id, waiter_id, waiter_name, table_id, order_status, order_date, payment_method,
        customer_details,
        bills,
        items
    ) VALUES (
        sample_order1, waiter1_id, 'Alex Waiter', table3_id, 'Ready', now() - INTERVAL '2 hours', 'Cash',
        '{"name":"Michael Osei","phone":"0244111222","guests":4}'::jsonb,
        '{"total":160,"tax":16,"totalWithTax":176}'::jsonb,
        '[{"name":"Butter Chicken","price":50,"quantity":2},{"name":"Paneer Tikka","price":30,"quantity":2}]'::jsonb
    );

    -- Sample Order 2 (Online Paystack collected by Alex Waiter)
    DELETE FROM public.orders WHERE id = sample_order2;
    INSERT INTO public.orders (
        id, waiter_id, waiter_name, table_id, order_status, order_date, payment_method,
        customer_details,
        bills,
        items
    ) VALUES (
        sample_order2, waiter1_id, 'Alex Waiter', table6_id, 'In Progress', now() - INTERVAL '45 minutes', 'Online',
        '{"name":"Nana Mensah","phone":"0555333444","guests":5}'::jsonb,
        '{"total":220,"tax":22,"totalWithTax":242}'::jsonb,
        '[{"name":"Hyderabadi Biryani","price":60,"quantity":3},{"name":"Gulab Jamun","price":20,"quantity":2}]'::jsonb
    );

    -- Update tables current_order_id
    UPDATE public.restaurant_tables SET current_order_id = sample_order1, status = 'Booked' WHERE id = table3_id;
    UPDATE public.restaurant_tables SET current_order_id = sample_order2, status = 'Booked' WHERE id = table6_id;

    -- 4. SEED SAMPLE SHIFT HANDOVER (FOR ADMIN REVIEW)
    -- ========================================================
    DELETE FROM public.shift_handovers WHERE waiter_id = waiter1_id AND shift_date = CURRENT_DATE;
    INSERT INTO public.shift_handovers (
        waiter_id, waiter_name, shift_date, shift_start, shift_end,
        total_orders, cash_collected, online_collected, total_collected,
        status, notes
    ) VALUES (
        waiter1_id, 'Alex Waiter', CURRENT_DATE, now() - INTERVAL '6 hours', now(),
        2, 176.00, 242.00, 418.00,
        'Handed_Over', 'Morning shift handover. GH¢ 176 physical cash enclosed in register envelope.'
    );

END $$;

-- 5. VERIFY SEED
-- ========================================================
SELECT 'Users Seeded:' AS category, count(*) FROM public.profiles
UNION ALL
SELECT 'Tables Seeded:', count(*) FROM public.restaurant_tables
UNION ALL
SELECT 'Orders Seeded:', count(*) FROM public.orders
UNION ALL
SELECT 'Shift Handovers Seeded:', count(*) FROM public.shift_handovers;

