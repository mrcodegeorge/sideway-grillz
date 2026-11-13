-- Optional: Run this in Supabase SQL Editor to store Incident Reports & Snapped Photos in Supabase
-- (The POS also automatically falls back to localStorage if this table is not created yet)

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Medium',
  order_ref TEXT DEFAULT '',
  description TEXT NOT NULL,
  photo_data TEXT DEFAULT '',
  reported_by TEXT NOT NULL DEFAULT 'Staff',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Under Review', 'Resolved')),
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read incident_reports"
  ON public.incident_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert incident_reports"
  ON public.incident_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update incident_reports"
  ON public.incident_reports FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated delete incident_reports"
  ON public.incident_reports FOR DELETE
  TO authenticated
  USING (true);

