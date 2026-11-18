import { menus as defaultMenus } from "../constants";

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
  return updated.find((c) => Number(c.id) === targetId);
};

export const deleteCategory = (id) => {
  const current = getMenus();
  const targetId = Number(id);
  const updated = current.filter((cat) => Number(cat.id) !== targetId);
  saveMenus(updated);
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
  return true;
};

