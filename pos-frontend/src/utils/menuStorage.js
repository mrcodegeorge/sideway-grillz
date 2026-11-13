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

export const addCategory = ({ name, icon, bgColor }) => {
  const current = getMenus();
  const newCategory = {
    id: Date.now(),
    name: name.trim(),
    icon: icon || "🍽️",
    bgColor: bgColor || "#5b45b0",
    items: [],
  };
  const updated = [...current, newCategory];
  saveMenus(updated);
  return newCategory;
};

export const addDish = ({ categoryId, name, price, categoryType }) => {
  const current = getMenus();
  const targetId = Number(categoryId);
  const newDish = {
    id: Date.now(),
    name: name.trim(),
    price: Number(price),
    category: categoryType || "Non-Veg",
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

