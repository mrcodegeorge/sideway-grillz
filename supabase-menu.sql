-- ============================================================================
-- SIDEWAY GRILLZ POS - CLOUD MENU SYNC SCHEMA
-- Tables: public.menu_categories, public.menu_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🍽️',
  bg_color TEXT NOT NULL DEFAULT '#5b45b0',
  image TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id BIGINT PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  category_type TEXT NOT NULL DEFAULT 'Non-Veg',
  image TEXT DEFAULT '',
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON public.menu_categories(sort_order, id);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read menu_categories" ON public.menu_categories;
CREATE POLICY "Staff read menu_categories"
  ON public.menu_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage menu_categories" ON public.menu_categories;
CREATE POLICY "Admin manage menu_categories"
  ON public.menu_categories FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND LOWER(p.role) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND LOWER(p.role) = 'admin'
    )
  );

DROP POLICY IF EXISTS "Staff read menu_items" ON public.menu_items;
CREATE POLICY "Staff read menu_items"
  ON public.menu_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage menu_items" ON public.menu_items;
CREATE POLICY "Admin manage menu_items"
  ON public.menu_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND LOWER(p.role) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND LOWER(p.role) = 'admin'
    )
  );

