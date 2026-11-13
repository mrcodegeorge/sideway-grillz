-- Optional: Run this in Supabase SQL Editor to sync POS Settings across devices
-- (Settings also automatically persist in localStorage if this table is not created yet)

CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated upsert app_settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (true);

