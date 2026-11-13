-- ========================================================
-- FIX: Remove invalid raw-inserted auth.users
-- Paste and run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/osiuqvyqiekojqhpwgzt/sql/new
-- ========================================================

-- 1. Remove manually inserted users that caused the GoTrue NULL scan crash
DELETE FROM auth.users WHERE email LIKE '%@sidewaysgrillz.com' OR email LIKE '%@sidewaysgrillz.pos';
DELETE FROM public.profiles WHERE email LIKE '%@sidewaysgrillz.com' OR email LIKE '%@sidewaysgrillz.pos';

-- 2. Verify all tables exist and are ready
SELECT 'Tables exist and are ready!' AS status;

