import { menus as defaultMenus } from "../constants";
import { supabase } from "../supabase/client";

const STORAGE_KEY = "sideways_grillz_menus";

export const getMenus = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to parse saved menus:", err);
  }
  return defaultMenus;
};

const saveMenus = (updatedMenus) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMenus));
  window.dispatchEvent(new Event("menus-updated"));
};

export const syncMenusFromCloud = async () => {
  if (!navigator.onLine) return { synced: false, menus: getMenus() };
  try {
    const [{ data: cats, error: catErr }, { data: items, error: itemErr }] = await Promise.all([
      supabase.from("menu_categories").select("*").order("sort_order", { ascending: true }).order("id", { ascending: true }),
      supabase.from("menu_items").select("*").order("id", { ascending: true }),
    ]);

    if (catErr || itemErr) {
      return { synced: false, error: catErr?.message || itemErr?.message, menus: getMenus() };
    }

    if (!cats || cats.length === 0) {
      return { synced: true, empty: true, menus: getMenus() };
    }

    const nested = cats.map((c) => ({
      id: Number(c.id),
      name: c.name,
      icon: c.icon || "🍽️",
      bgColor: c.bg_color || "#5b45b0",
      image: c.image || "",
      items: (items || [])
        .filter((i) => Number(i.category_id) === Number(c.id))
        .map((i) => ({
          id: Number(i.id),
          name: i.name,
          price: Number(i.price),
          category: i.category_type || "Non-Veg",
          image: i.image || "",
          isAvailable: i.is_available !== false,
        })),
    }));

    saveMenus(nested);
    return { synced: true, menus: nested };
  } catch (err) {
    return { synced: false, error: err?.message, menus: getMenus() };
  }
};

export const pushAllMenusToCloud = async (menusToPush = getMenus()) => {
  const catRows = menusToPush.map((c, idx) => ({
    id: Number(c.id),
    name: c.name,
    icon: c.icon || "🍽️",
    bg_color: c.bgColor || "#5b45b0",
    image: c.image || "",
    sort_order: idx,
    updated_at: new Date().toISOString(),
  }));

  const itemRows = menusToPush.flatMap((c) =>
    (c.items || []).map((item) => ({
      id: Number(item.id),
      category_id: Number(c.id),
      name: item.name,
      price: Number(item.price || 0),
      category_type: item.category || "Non-Veg",
      image: item.image || "",
      is_available: item.isAvailable !== false,
      updated_at: new Date().toISOString(),
    }))
  );

  if (catRows.length > 0) {
    const { error: catErr } = await supabase
      .from("menu_categories")
      .upsert(catRows, { onConflict: "id" });
    if (catErr) throw catErr;
  }

  if (itemRows.length > 0) {
    const { error: itemErr } = await supabase
      .from("menu_items")
      .upsert(itemRows, { onConflict: "id" });
    if (itemErr) throw itemErr;
  }

  return true;
};

export const subscribeToMenuChanges = () => {
  const channel = supabase
    .channel("cloud-menu-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "menu_categories" },
      () => syncMenusFromCloud()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "menu_items" },
      () => syncMenusFromCloud()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const addCategory = ({ name, icon, bgColor, image }) => {
  const current = getMenus();
  const newCategory = {
    id: Date.now(),
    name: name.trim(),
    icon: icon || "🍽️",
    bgColor: bgColor || "#5b45b0",
    image: image || "",
    items: [],
  };
  const updated = [...current, newCategory];
  saveMenus(updated);

  supabase
    .from("menu_categories")
    .upsert({
      id: newCategory.id,
      name: newCategory.name,
      icon: newCategory.icon,
      bg_color: newCategory.bgColor,
      image: newCategory.image,
      sort_order: updated.length - 1,
    })
    .then(() => {})
    .catch(() => {});

  return newCategory;
};

export const addDish = ({ categoryId, name, price, categoryType, image }) => {
  const current = getMenus();
  const targetId = Number(categoryId);
  const newDish = {
    id: Date.now(),
    name: name.trim(),
    price: Number(price),
    category: categoryType || "Non-Veg",
    image: image || "",
  };

  const updated = current.map((cat) => {
    if (Number(cat.id) === targetId) {
      return {
        ...cat,
        items: [...(cat.items || []), newDish],
      };
    }
    return cat;
  });

  saveMenus(updated);

  supabase
    .from("menu_items")
    .upsert({
      id: newDish.id,
      category_id: targetId,
      name: newDish.name,
      price: newDish.price,
      category_type: newDish.category,
      image: newDish.image,
    })
    .then(() => {})
    .catch(() => {});

  return newDish;
};

export const updateCategory = ({ id, name, icon, bgColor }) => {
  const current = getMenus();
  const targetId = Number(id);
  const updated = current.map((cat) =>
    Number(cat.id) === targetId
      ? {
          ...cat,
          name: name.trim(),
          icon: icon || cat.icon,
          bgColor: bgColor || cat.bgColor,
        }
      : cat
  );
  saveMenus(updated);
  const result = updated.find((c) => Number(c.id) === targetId);

  if (result) {
    supabase
      .from("menu_categories")
      .upsert({
        id: targetId,
        name: result.name,
        icon: result.icon,
        bg_color: result.bgColor,
        image: result.image || "",
        updated_at: new Date().toISOString(),
      })
      .then(() => {})
      .catch(() => {});
  }

  return result;
};

export const deleteCategory = (id) => {
  const current = getMenus();
  const targetId = Number(id);
  const updated = current.filter((cat) => Number(cat.id) !== targetId);
  saveMenus(updated);

  supabase
    .from("menu_categories")
    .delete()
    .eq("id", targetId)
    .then(() => {})
    .catch(() => {});

  return true;
};

export const updateDish = ({
  categoryId,
  newCategoryId,
  dishId,
  name,
  price,
  categoryType,
  image,
}) => {
  const current = getMenus();
  const oldCatId = Number(categoryId);
  const targetCatId = Number(newCategoryId || categoryId);
  const targetDishId = Number(dishId);

  let updatedDish = null;
  let updated = current.map((cat) => {
    if (Number(cat.id) === oldCatId) {
      const existing = (cat.items || []).find((d) => Number(d.id) === targetDishId);
      if (existing) {
        updatedDish = {
          ...existing,
          name: name.trim(),
          price: Number(price),
          category: categoryType || existing.category || "Non-Veg",
          image: image !== undefined ? image : existing.image || "",
        };
      }
      if (oldCatId !== targetCatId) {
        return {
          ...cat,
          items: (cat.items || []).filter((d) => Number(d.id) !== targetDishId),
        };
      }
      return {
        ...cat,
        items: (cat.items || []).map((d) =>
          Number(d.id) === targetDishId ? updatedDish : d
        ),
      };
    }
    return cat;
  });

  if (oldCatId !== targetCatId && updatedDish) {
    updated = updated.map((cat) =>
      Number(cat.id) === targetCatId
        ? { ...cat, items: [...(cat.items || []), updatedDish] }
        : cat
    );
  }

  saveMenus(updated);

  if (updatedDish) {
    supabase
      .from("menu_items")
      .upsert({
        id: targetDishId,
        category_id: targetCatId,
        name: updatedDish.name,
        price: updatedDish.price,
        category_type: updatedDish.category,
        image: updatedDish.image || "",
        updated_at: new Date().toISOString(),
      })
      .then(() => {})
      .catch(() => {});
  }

  return updatedDish;
};

export const deleteDish = ({ categoryId, dishId }) => {
  const current = getMenus();
  const targetCatId = Number(categoryId);
  const targetDishId = Number(dishId);
  const updated = current.map((cat) =>
    Number(cat.id) === targetCatId
      ? {
          ...cat,
          items: (cat.items || []).filter((d) => Number(d.id) !== targetDishId),
        }
      : cat
  );
  saveMenus(updated);

  supabase
    .from("menu_items")
    .delete()
    .eq("id", targetDishId)
    .then(() => {})
    .catch(() => {});

  return true;
};
