-- Audit Trails Table for Sideways Grillz POS
CREATE TABLE IF NOT EXISTS public.audit_trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text NOT NULL DEFAULT 'Staff',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated insert audit_trails" ON public.audit_trails;
CREATE POLICY "Allow authenticated insert audit_trails"
  ON public.audit_trails
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select audit_trails" ON public.audit_trails;
CREATE POLICY "Allow authenticated select audit_trails"
  ON public.audit_trails
  FOR SELECT
  TO authenticated
  USING (true);

