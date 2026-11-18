-- ============================================================================
-- SIDEWAY GRILLZ POS - ADVANCED DELIVERY MANAGEMENT MODULE
-- Stage 2: Supabase PostgreSQL Schema, Indexes, RPCs, Triggers & RLS
-- Timezone: Africa/Accra | Currency: GHS (GH₵)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Extend public.profiles role constraint to support 'rider' & 'dispatcher'
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (LOWER(role) IN ('admin', 'cashier', 'waiter', 'rider', 'dispatcher'));

-- ----------------------------------------------------------------------------
-- 2. Delivery Settings (Single-row configuration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  assignment_policy TEXT NOT NULL DEFAULT 'rider_accept'
    CHECK (assignment_policy IN ('auto_accept', 'rider_accept', 'dispatcher_controlled')),
  multi_order_enabled BOOLEAN NOT NULL DEFAULT false,
  require_otp_pod BOOLEAN NOT NULL DEFAULT true,
  require_photo_pod BOOLEAN NOT NULL DEFAULT false,
  otp_expiry_minutes INTEGER NOT NULL DEFAULT 30,
  location_update_interval_sec INTEGER NOT NULL DEFAULT 20,
  restaurant_name TEXT NOT NULL DEFAULT 'Sideways Grillz',
  restaurant_phone TEXT DEFAULT '',
  restaurant_address TEXT DEFAULT 'Accra, Ghana',
  restaurant_lat DOUBLE PRECISION DEFAULT 5.6037,
  restaurant_lng DOUBLE PRECISION DEFAULT -0.1870,
  map_provider TEXT NOT NULL DEFAULT 'openstreetmap'
    CHECK (map_provider IN ('openstreetmap', 'google_maps')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.delivery_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Riders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  rider_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  profile_photo TEXT,
  emergency_contact TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'motorcycle'
    CHECK (vehicle_type IN ('motorcycle', 'car', 'bicycle', 'other')),
  vehicle_registration TEXT,
  availability_status TEXT NOT NULL DEFAULT 'offline'
    CHECK (availability_status IN ('available', 'busy', 'offline', 'suspended')),
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'on_leave', 'terminated')),
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'inactive', 'suspended')),
  last_location_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_user_id ON public.riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_availability ON public.riders(availability_status, account_status);

-- ----------------------------------------------------------------------------
-- 4. Delivery Zones
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (fee >= 0),
  minimum_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (minimum_order_amount >= 0),
  estimated_delivery_minutes INTEGER NOT NULL DEFAULT 35 CHECK (estimated_delivery_minutes > 0),
  coverage_type TEXT NOT NULL DEFAULT 'neighborhoods'
    CHECK (coverage_type IN ('neighborhoods', 'radius', 'polygon')),
  coverage_data JSONB NOT NULL DEFAULT '{"neighborhoods": []}'::jsonb,
  free_delivery_threshold NUMERIC(10, 2) CHECK (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0),
  priority INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON public.delivery_zones(is_active, priority);

-- ----------------------------------------------------------------------------
-- 5. Delivery Tasks (1-to-1 with Delivery Orders in public.orders)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  delivery_address TEXT NOT NULL,
  delivery_instructions TEXT DEFAULT '',
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
  original_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (original_fee >= 0),
  fee_override_reason TEXT,
  fee_overridden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fee_overridden_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  current_status TEXT NOT NULL DEFAULT 'pending_assignment'
    CHECK (current_status IN (
      'pending_assignment',
      'assigned',
      'accepted',
      'preparing',
      'ready_for_pickup',
      'arrived_at_restaurant',
      'picked_up',
      'out_for_delivery',
      'delivered',
      'failed',
      'returning',
      'returned',
      'cancelled'
    )),
  assigned_rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  tracking_token_hash TEXT UNIQUE,
  tracking_token_expires_at TIMESTAMPTZ,
  failed_reason TEXT,
  failed_notes TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_delivery_tasks_status ON public.delivery_tasks(current_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_rider ON public.delivery_tasks(assigned_rider_id, current_status);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_order ON public.delivery_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_token ON public.delivery_tasks(tracking_token_hash);

-- ----------------------------------------------------------------------------
-- 6. Delivery Assignments (History & Active Assignment)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.delivery_tasks(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignment_status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (assignment_status IN ('assigned', 'accepted', 'rejected', 'reassigned', 'completed', 'cancelled')),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_delivery ON public.delivery_assignments(delivery_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_rider ON public.delivery_assignments(rider_id, assignment_status);

-- ----------------------------------------------------------------------------
-- 7. Rider Locations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rider_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES public.delivery_tasks(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_locations_rider_time ON public.rider_locations(rider_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_locations_delivery_time ON public.rider_locations(delivery_id, recorded_at DESC);

-- ----------------------------------------------------------------------------
-- 8. Immutable Delivery Status Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.delivery_tasks(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'system',
  reason TEXT,
  operation_id TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_logs_delivery ON public.delivery_status_logs(delivery_id, created_at ASC);

-- ----------------------------------------------------------------------------
-- 9. Delivery Proofs (Hashed OTP + Optional Photo Evidence)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID UNIQUE NOT NULL REFERENCES public.delivery_tasks(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  proof_type TEXT NOT NULL DEFAULT 'otp' CHECK (proof_type IN ('otp', 'photo', 'otp_and_photo')),
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  photo_storage_path TEXT,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_proofs_delivery ON public.delivery_proofs(delivery_id);

-- ----------------------------------------------------------------------------
-- 10. Delivery Collections (Cash / MoMo / Prepaid Reconciliation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.delivery_tasks(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  order_amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount_paid_online NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
  collection_method TEXT NOT NULL DEFAULT 'Cash'
    CHECK (collection_method IN ('Cash', 'MoMo', 'Paystack', 'Card', 'Other')),
  payment_reference TEXT,
  collection_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (collection_status IN ('pending', 'collected', 'verified', 'disputed')),
  operation_id TEXT UNIQUE,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_collections_rider ON public.delivery_collections(rider_id, collection_status);
CREATE INDEX IF NOT EXISTS idx_delivery_collections_delivery ON public.delivery_collections(delivery_id);

-- ----------------------------------------------------------------------------
-- 11. Rider Settlements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rider_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  settlement_reference TEXT UNIQUE NOT NULL,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  declared_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  verified_amount NUMERIC(10, 2),
  discrepancy_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'Cash'
    CHECK (payment_method IN ('Cash', 'MoMo', 'Mixed', 'Bank Transfer')),
  settlement_status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (settlement_status IN ('draft', 'submitted', 'under_review', 'partially_reconciled', 'reconciled', 'disputed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_settlements_rider ON public.rider_settlements(rider_id, shift_date DESC);

-- ----------------------------------------------------------------------------
-- 12. Delivery Incidents & Returned Item Records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.delivery_tasks(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_path TEXT,
  returned_items JSONB DEFAULT '[]'::jsonb,
  incident_status TEXT NOT NULL DEFAULT 'open'
    CHECK (incident_status IN ('open', 'investigating', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_delivery_incidents_status ON public.delivery_incidents(incident_status, created_at DESC);

-- ----------------------------------------------------------------------------
-- 13. Delivery Notification Queue & Attempt Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.delivery_tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'whatsapp')),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_notifications_delivery ON public.delivery_notifications(delivery_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 14. Private Storage Bucket for Delivery Evidence Photos
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-evidence', 'delivery-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated staff can upload delivery evidence" ON storage.objects;
CREATE POLICY "Authenticated staff can upload delivery evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-evidence');

DROP POLICY IF EXISTS "Authorized staff can view delivery evidence" ON storage.objects;
CREATE POLICY "Authorized staff can view delivery evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-evidence');

-- ----------------------------------------------------------------------------
-- 15. Helper Function for Role Check
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), ''));
$$;

-- ----------------------------------------------------------------------------
-- 16. Atomic Rider Assignment RPC (Prevents Simultaneous Duplicate Assignment)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_delivery_rider(
  p_delivery_id UUID,
  p_rider_id UUID,
  p_is_reassignment BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.current_user_role();
  v_task public.delivery_tasks%ROWTYPE;
  v_rider public.riders%ROWTYPE;
  v_settings public.delivery_settings%ROWTYPE;
  v_active_count INTEGER;
  v_next_status TEXT;
BEGIN
  IF v_role NOT IN ('admin', 'dispatcher') THEN
    RAISE EXCEPTION 'Only administrators or dispatchers can assign riders.';
  END IF;

  SELECT * INTO v_task FROM public.delivery_tasks WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery task not found.';
  END IF;

  IF v_task.current_status IN ('delivered', 'cancelled', 'returned') THEN
    RAISE EXCEPTION 'Cannot assign a completed or cancelled delivery.';
  END IF;

  IF NOT p_is_reassignment AND v_task.assigned_rider_id IS NOT NULL AND v_task.current_status IN ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'out_for_delivery') THEN
    RAISE EXCEPTION 'Delivery is already assigned to another rider. Use reassign instead.';
  END IF;

  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id FOR UPDATE;
  IF NOT FOUND OR v_rider.account_status <> 'active' THEN
    RAISE EXCEPTION 'Selected rider is inactive or unavailable.';
  END IF;

  SELECT * INTO v_settings FROM public.delivery_settings WHERE id = 1;

  IF NOT COALESCE(v_settings.multi_order_enabled, false) THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.delivery_tasks
    WHERE assigned_rider_id = p_rider_id
      AND id <> p_delivery_id
      AND current_status IN ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'out_for_delivery');

    IF v_active_count > 0 THEN
      RAISE EXCEPTION 'Rider already has an active delivery and multi-order delivery is disabled.';
    END IF;
  END IF;

  -- Close previous open assignment if reassigning
  UPDATE public.delivery_assignments
  SET assignment_status = 'reassigned', ended_at = NOW()
  WHERE delivery_id = p_delivery_id AND assignment_status IN ('assigned', 'accepted');

  v_next_status := CASE
    WHEN v_settings.assignment_policy IN ('auto_accept', 'dispatcher_controlled') THEN 'accepted'
    ELSE 'assigned'
  END;

  INSERT INTO public.delivery_assignments (delivery_id, rider_id, assigned_by, assignment_status, accepted_at)
  VALUES (
    p_delivery_id,
    p_rider_id,
    auth.uid(),
    CASE WHEN v_next_status = 'accepted' THEN 'accepted' ELSE 'assigned' END,
    CASE WHEN v_next_status = 'accepted' THEN NOW() ELSE NULL END
  );

  UPDATE public.delivery_tasks
  SET assigned_rider_id = p_rider_id,
      current_status = v_next_status,
      updated_at = NOW()
  WHERE id = p_delivery_id;

  UPDATE public.riders
  SET availability_status = 'busy', updated_at = NOW()
  WHERE id = p_rider_id;

  INSERT INTO public.delivery_status_logs (delivery_id, previous_status, new_status, actor_id, actor_role, reason)
  VALUES (p_delivery_id, v_task.current_status, v_next_status, auth.uid(), v_role,
          CASE WHEN p_is_reassignment THEN 'Dispatcher reassigned rider' ELSE 'Dispatcher assigned rider' END);

  RETURN jsonb_build_object('success', true, 'delivery_id', p_delivery_id, 'status', v_next_status, 'rider_id', p_rider_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_delivery_rider(UUID, UUID, BOOLEAN) TO authenticated;

-- ----------------------------------------------------------------------------
-- 17. Validated Delivery Status Transition RPC (Idempotent + Immutable Log)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_delivery_status(
  p_delivery_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_operation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := public.current_user_role();
  v_task public.delivery_tasks%ROWTYPE;
  v_rider_id UUID;
  v_existing_log UUID;
  v_remaining_active INTEGER;
BEGIN
  IF p_operation_id IS NOT NULL THEN
    SELECT id INTO v_existing_log FROM public.delivery_status_logs WHERE operation_id = p_operation_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', p_new_status);
    END IF;
  END IF;

  SELECT * INTO v_task FROM public.delivery_tasks WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery task not found.';
  END IF;

  IF v_role = 'rider' THEN
    SELECT id INTO v_rider_id FROM public.riders WHERE user_id = auth.uid();
    IF v_rider_id IS NULL OR v_task.assigned_rider_id <> v_rider_id THEN
      RAISE EXCEPTION 'Riders can only update their own assigned deliveries.';
    END IF;
  ELSIF v_role NOT IN ('admin', 'dispatcher', 'cashier', 'waiter') THEN
    RAISE EXCEPTION 'Unauthorized role for delivery transition.';
  END IF;

  -- Enforce valid state transitions
  IF v_task.current_status IN ('delivered', 'cancelled', 'returned') THEN
    RAISE EXCEPTION 'Cannot transition from terminal status %.', v_task.current_status;
  END IF;

  IF p_new_status = 'delivered' AND v_task.current_status NOT IN ('picked_up', 'out_for_delivery') THEN
    RAISE EXCEPTION 'Delivery cannot be marked delivered before pickup.';
  END IF;

  -- Handle rider rejection: clear rider and return to pending_assignment
  IF p_new_status = 'rejected' THEN
    IF COALESCE(TRIM(p_reason), '') = '' THEN
      RAISE EXCEPTION 'Rejection reason is required.';
    END IF;
    UPDATE public.delivery_assignments
    SET assignment_status = 'rejected', rejected_at = NOW(), rejection_reason = p_reason, ended_at = NOW()
    WHERE delivery_id = p_delivery_id AND rider_id = v_task.assigned_rider_id AND assignment_status IN ('assigned', 'accepted');

    UPDATE public.delivery_tasks
    SET assigned_rider_id = NULL, current_status = 'pending_assignment', updated_at = NOW()
    WHERE id = p_delivery_id;

    UPDATE public.riders SET availability_status = 'available', updated_at = NOW() WHERE id = v_task.assigned_rider_id;

    INSERT INTO public.delivery_status_logs (delivery_id, previous_status, new_status, actor_id, actor_role, reason, operation_id)
    VALUES (p_delivery_id, v_task.current_status, 'pending_assignment', auth.uid(), v_role, 'Rider rejected: ' || p_reason, p_operation_id);

    RETURN jsonb_build_object('success', true, 'status', 'pending_assignment');
  END IF;

  UPDATE public.delivery_tasks
  SET current_status = p_new_status,
      failed_reason = CASE WHEN p_new_status = 'failed' THEN COALESCE(p_reason, failed_reason) ELSE failed_reason END,
      cancelled_reason = CASE WHEN p_new_status = 'cancelled' THEN COALESCE(p_reason, cancelled_reason) ELSE cancelled_reason END,
      completed_at = CASE WHEN p_new_status IN ('delivered', 'returned', 'cancelled') THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE id = p_delivery_id;

  IF p_new_status = 'accepted' THEN
    UPDATE public.delivery_assignments
    SET assignment_status = 'accepted', accepted_at = NOW()
    WHERE delivery_id = p_delivery_id AND rider_id = v_task.assigned_rider_id AND assignment_status = 'assigned';
  ELSIF p_new_status IN ('delivered', 'returned', 'cancelled') AND v_task.assigned_rider_id IS NOT NULL THEN
    UPDATE public.delivery_assignments
    SET assignment_status = CASE WHEN p_new_status = 'delivered' THEN 'completed' ELSE 'cancelled' END,
        ended_at = NOW()
    WHERE delivery_id = p_delivery_id AND rider_id = v_task.assigned_rider_id AND assignment_status IN ('assigned', 'accepted');

    SELECT COUNT(*) INTO v_remaining_active
    FROM public.delivery_tasks
    WHERE assigned_rider_id = v_task.assigned_rider_id
      AND id <> p_delivery_id
      AND current_status IN ('assigned', 'accepted', 'arrived_at_restaurant', 'picked_up', 'out_for_delivery');

    IF v_remaining_active = 0 THEN
      UPDATE public.riders SET availability_status = 'available', updated_at = NOW() WHERE id = v_task.assigned_rider_id;
    END IF;
  END IF;

  -- Sync parent order status in public.orders
  IF p_new_status IN ('ready_for_pickup', 'arrived_at_restaurant') THEN
    UPDATE public.orders SET order_status = 'Ready', updated_at = NOW() WHERE id = v_task.order_id;
  ELSIF p_new_status = 'delivered' THEN
    UPDATE public.orders SET order_status = 'Completed', updated_at = NOW() WHERE id = v_task.order_id;
  ELSIF p_new_status = 'cancelled' THEN
    UPDATE public.orders SET order_status = 'Cancelled', updated_at = NOW() WHERE id = v_task.order_id;
  END IF;

  INSERT INTO public.delivery_status_logs (delivery_id, previous_status, new_status, actor_id, actor_role, reason, operation_id)
  VALUES (p_delivery_id, v_task.current_status, p_new_status, auth.uid(), v_role, p_reason, p_operation_id);

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_delivery_status(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 18. Cryptographic OTP Generation & Verification RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_delivery_otp(p_delivery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT := public.current_user_role();
  v_raw_code TEXT;
  v_hash TEXT;
  v_exp_mins INTEGER;
  v_proof public.delivery_proofs%ROWTYPE;
BEGIN
  IF v_role NOT IN ('admin', 'dispatcher', 'rider', 'cashier', 'waiter') THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT * INTO v_proof FROM public.delivery_proofs WHERE delivery_id = p_delivery_id;
  IF FOUND AND v_proof.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Delivery has already been verified.';
  END IF;
  IF FOUND AND v_proof.last_sent_at IS NOT NULL AND v_proof.last_sent_at > NOW() - INTERVAL '30 seconds' THEN
    RAISE EXCEPTION 'Please wait 30 seconds before resending OTP.';
  END IF;

  SELECT COALESCE(otp_expiry_minutes, 30) INTO v_exp_mins FROM public.delivery_settings WHERE id = 1;

  -- Generate 6-digit cryptographically random OTP
  v_raw_code := LPAD((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000 + 100000)::text, 6, '0');
  v_hash := encode(digest(v_raw_code || ':' || p_delivery_id::text, 'sha256'), 'hex');

  INSERT INTO public.delivery_proofs (delivery_id, proof_type, otp_hash, otp_expires_at, verification_attempts, resend_count, last_sent_at)
  VALUES (p_delivery_id, 'otp', v_hash, NOW() + (v_exp_mins || ' minutes')::interval, 0, 1, NOW())
  ON CONFLICT (delivery_id) DO UPDATE
    SET otp_hash = EXCLUDED.otp_hash,
        otp_expires_at = EXCLUDED.otp_expires_at,
        verification_attempts = 0,
        resend_count = public.delivery_proofs.resend_count + 1,
        last_sent_at = NOW();

  RETURN jsonb_build_object('success', true, 'otp', v_raw_code, 'expires_in_minutes', v_exp_mins);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_delivery_otp(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_delivery_otp(
  p_delivery_id UUID,
  p_otp TEXT,
  p_photo_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_proof public.delivery_proofs%ROWTYPE;
  v_input_hash TEXT;
BEGIN
  SELECT * INTO v_proof FROM public.delivery_proofs WHERE delivery_id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_proof.otp_hash IS NULL THEN
    RAISE EXCEPTION 'No OTP generated for this delivery.';
  END IF;

  IF v_proof.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'OTP has already been used.';
  END IF;

  IF v_proof.otp_expires_at < NOW() THEN
    RAISE EXCEPTION 'OTP has expired. Request a new code.';
  END IF;

  IF v_proof.verification_attempts >= 5 THEN
    RAISE EXCEPTION 'Maximum OTP verification attempts exceeded.';
  END IF;

  v_input_hash := encode(digest(TRIM(p_otp) || ':' || p_delivery_id::text, 'sha256'), 'hex');

  IF v_input_hash <> v_proof.otp_hash THEN
    UPDATE public.delivery_proofs
    SET verification_attempts = verification_attempts + 1
    WHERE id = v_proof.id;
    RAISE EXCEPTION 'Invalid OTP code.';
  END IF;

  UPDATE public.delivery_proofs
  SET verified_at = NOW(),
      verified_by = auth.uid(),
      photo_storage_path = COALESCE(p_photo_path, photo_storage_path)
  WHERE id = v_proof.id;

  PERFORM public.transition_delivery_status(p_delivery_id, 'delivered', 'Verified via Customer OTP', NULL);

  RETURN jsonb_build_object('success', true, 'verified_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_delivery_otp(UUID, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 19. Public Customer Tracking RPC (No Login Required, Strictly Scoped)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_delivery_tracking(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash TEXT;
  v_task RECORD;
  v_loc RECORD;
  v_settings RECORD;
BEGIN
  IF COALESCE(TRIM(p_token), '') = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_token_hash := encode(digest(TRIM(p_token), 'sha256'), 'hex');

  SELECT dt.id, dt.order_id, dt.delivery_address, dt.current_status, dt.estimated_delivery_at,
         dt.updated_at, dt.tracking_token_expires_at, dt.assigned_rider_id,
         r.full_name AS rider_name, r.phone AS rider_phone, r.vehicle_type AS rider_vehicle
  INTO v_task
  FROM public.delivery_tasks dt
  LEFT JOIN public.riders r ON r.id = dt.assigned_rider_id
  WHERE dt.tracking_token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_task.tracking_token_expires_at IS NOT NULL AND v_task.tracking_token_expires_at < NOW() THEN
    RETURN jsonb_build_object('found', false, 'expired', true);
  END IF;

  SELECT restaurant_name, restaurant_phone, restaurant_address, restaurant_lat, restaurant_lng
  INTO v_settings
  FROM public.delivery_settings WHERE id = 1;

  IF v_task.assigned_rider_id IS NOT NULL AND v_task.current_status IN ('picked_up', 'out_for_delivery', 'arrived_at_restaurant') THEN
    SELECT latitude, longitude, accuracy, recorded_at
    INTO v_loc
    FROM public.rider_locations
    WHERE rider_id = v_task.assigned_rider_id
    ORDER BY recorded_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'order_ref', UPPER(LEFT(v_task.order_id::text, 8)),
    'status', v_task.current_status,
    'delivery_address', v_task.delivery_address,
    'estimated_delivery_at', v_task.estimated_delivery_at,
    'updated_at', v_task.updated_at,
    'rider_name', v_task.rider_name,
    'rider_phone', v_task.rider_phone,
    'rider_vehicle', v_task.rider_vehicle,
    'restaurant', jsonb_build_object(
      'name', COALESCE(v_settings.restaurant_name, 'Sideways Grillz'),
      'phone', COALESCE(v_settings.restaurant_phone, ''),
      'address', COALESCE(v_settings.restaurant_address, 'Accra, Ghana'),
      'lat', v_settings.restaurant_lat,
      'lng', v_settings.restaurant_lng
    ),
    'location', CASE
      WHEN v_loc.latitude IS NOT NULL THEN jsonb_build_object(
        'latitude', v_loc.latitude,
        'longitude', v_loc.longitude,
        'accuracy', v_loc.accuracy,
        'recorded_at', v_loc.recorded_at,
        'is_live', (v_loc.recorded_at > NOW() - INTERVAL '2 minutes')
      )
      ELSE NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_delivery_tracking(TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 20. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notifications ENABLE ROW LEVEL SECURITY;

-- Settings & Zones: Authenticated staff can read; Admin can modify
CREATE POLICY "Staff read delivery_settings" ON public.delivery_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin update delivery_settings" ON public.delivery_settings FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Staff read delivery_zones" ON public.delivery_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage delivery_zones" ON public.delivery_zones FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

-- Riders: Admin/Dispatcher read all; Rider reads/updates own availability
CREATE POLICY "Staff read riders" ON public.riders FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'dispatcher', 'cashier', 'waiter') OR user_id = auth.uid());
CREATE POLICY "Admin manage riders" ON public.riders FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "Rider update own availability" ON public.riders FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Delivery Tasks: Staff read; Riders only see assigned tasks; Admin/Dispatcher/Cashier/Waiter can create
CREATE POLICY "Scoped read delivery_tasks" ON public.delivery_tasks FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'dispatcher', 'cashier', 'waiter')
    OR assigned_rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Staff insert delivery_tasks" ON public.delivery_tasks FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'dispatcher', 'cashier', 'waiter'));
CREATE POLICY "Admin dispatcher update delivery_tasks" ON public.delivery_tasks FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'dispatcher'));

-- Assignments & Status Logs
CREATE POLICY "Scoped read delivery_assignments" ON public.delivery_assignments FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'dispatcher')
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Scoped read delivery_status_logs" ON public.delivery_status_logs FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'dispatcher', 'cashier', 'waiter')
    OR delivery_id IN (SELECT id FROM public.delivery_tasks WHERE assigned_rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid()))
  );

-- Rider Locations: Rider inserts own; Admin/Dispatcher reads
CREATE POLICY "Rider insert own location" ON public.rider_locations FOR INSERT TO authenticated
  WITH CHECK (rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid()));
CREATE POLICY "Staff read rider_locations" ON public.rider_locations FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'dispatcher')
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );

-- Proofs (Never expose otp_hash publicly; only authenticated staff/assigned rider)
CREATE POLICY "Staff read delivery_proofs" ON public.delivery_proofs FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'dispatcher')
    OR delivery_id IN (SELECT id FROM public.delivery_tasks WHERE assigned_rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid()))
  );

-- Collections & Settlements
CREATE POLICY "Scoped read delivery_collections" ON public.delivery_collections FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'dispatcher', 'cashier')
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Rider or staff insert collections" ON public.delivery_collections FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin', 'dispatcher', 'cashier')
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Admin update collections" ON public.delivery_collections FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'cashier'));

CREATE POLICY "Scoped read rider_settlements" ON public.rider_settlements FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'cashier')
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Rider submit own settlement" ON public.rider_settlements FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Admin review settlements" ON public.rider_settlements FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin');

-- Incidents & Notifications
CREATE POLICY "Scoped read delivery_incidents" ON public.delivery_incidents FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'dispatcher')
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Rider or staff insert incidents" ON public.delivery_incidents FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('admin', 'dispatcher')
    OR rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
  );
CREATE POLICY "Admin dispatcher update incidents" ON public.delivery_incidents FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'dispatcher'));

CREATE POLICY "Staff manage delivery_notifications" ON public.delivery_notifications FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'dispatcher', 'cashier', 'waiter', 'rider'))
  WITH CHECK (public.current_user_role() IN ('admin', 'dispatcher', 'cashier', 'waiter', 'rider'));

