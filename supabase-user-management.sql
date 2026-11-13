-- Run this in your Supabase SQL Editor to enable full Admin User Management
-- (Deactivate/Activate accounts, Admin role updates, and Remote PIN resets)

-- 1. Add is_active column to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Allow admins to update any profile (role, is_active, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND LOWER(p.role) = 'admin'
        )
      )
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Secure RPC function for Admin to change any user's PIN
CREATE OR REPLACE FUNCTION public.admin_update_user_pin(
  target_user_id UUID,
  new_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_is_admin BOOLEAN;
  effective_password TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND LOWER(role) = 'admin'
  ) INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Only admins can reset staff PINs.';
  END IF;

  IF LENGTH(TRIM(new_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters.';
  END IF;

  IF LENGTH(TRIM(new_pin)) < 6 THEN
    effective_password := TRIM(new_pin) || '_sideways';
  ELSE
    effective_password := TRIM(new_pin);
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(effective_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_pin(UUID, TEXT) TO authenticated;

