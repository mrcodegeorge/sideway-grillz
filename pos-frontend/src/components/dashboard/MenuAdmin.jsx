import React, { useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { FaEdit, FaImage, FaTimes, FaTrash, FaUtensils } from "react-icons/fa";
import {
  deleteCategory,
  deleteDish,
  getMenus,
  updateCategory,
  updateDish,
} from "../../utils/menuStorage";

const CATEGORY_ICONS = ["🍖", "🍔", "🍗", "🥗", "🍹", "🍰", "🍲", "🍕", "🔥", "🍽️"];
const CATEGORY_COLORS = [
  "#b73e3e",
  "#5b45b0",
  "#7f167f",
  "#735f32",
  "#1d2569",
  "#285430",
  "#1f6e8c",
  "#8c3333",
];

const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const maxDim = 480;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

const MenuAdmin = () => {
  const [menus, setMenus] = useState(() => getMenus());
  const [selectedCatId, setSelectedCatId] = useState(() => getMenus()[0]?.id || null);
  const [editingCat, setEditingCat] = useState(null);
  const [editingDish, setEditingDish] = useState(null);

  useEffect(() => {
    const sync = () => {
      const latest = getMenus();
      setMenus(latest);
      setSelectedCatId((prev) =>
        latest.some((c) => c.id === prev) ? prev : latest[0]?.id || null
      );
    };
    window.addEventListener("menus-updated", sync);
    return () => window.removeEventListener("menus-updated", sync);
  }, []);

  const selectedCategory = menus.find((c) => Number(c.id) === Number(selectedCatId)) || menus[0];

  const handleSaveCategory = (e) => {
    e.preventDefault();
    if (!editingCat?.name?.trim()) {
      enqueueSnackbar("Category name is required", { variant: "warning" });
      return;
    }
    updateCategory(editingCat);
    enqueueSnackbar("Category updated!", { variant: "success" });
    setEditingCat(null);
  };

  const handleDeleteCategory = (cat) => {
    if (!window.confirm(`Delete category "${cat.name}" and all its dishes?`)) return;
    deleteCategory(cat.id);
    enqueueSnackbar(`Deleted category "${cat.name}"`, { variant: "info" });
  };

  const handleSaveDish = (e) => {
    e.preventDefault();
    if (!editingDish?.name?.trim() || editingDish.price === "") {
      enqueueSnackbar("Dish name and price are required", { variant: "warning" });
      return;
    }
    updateDish(editingDish);
    enqueueSnackbar("Dish updated!", { variant: "success" });
    setEditingDish(null);
  };

  const handleDeleteDish = (catId, dish) => {
    if (!window.confirm(`Delete dish "${dish.name}"?`)) return;
    deleteDish({ categoryId: catId, dishId: dish.id });
    enqueueSnackbar(`Deleted "${dish.name}"`, { variant: "info" });
  };

  const handleDishImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setEditingDish((prev) => ({ ...prev, image: compressed }));
    } catch {
      enqueueSnackbar("Could not process image", { variant: "error" });
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-4 py-4 space-y-6">
      {/* Categories Section */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#f5f5f5] flex items-center gap-2">
              <FaUtensils className="text-yellow-400" />
              Menu Categories ({menus.length})
            </h2>
            <p className="text-xs text-[#ababab]">
              Click a category to manage its dishes, or edit/delete categories
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {menus.map((cat) => {
            const isSelected = Number(cat.id) === Number(selectedCategory?.id);
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`rounded-xl p-4 cursor-pointer border-2 transition-all ${
                  isSelected ? "border-yellow-400 scale-[1.01]" : "border-transparent"
                }`}
                style={{ backgroundColor: cat.bgColor || "#262626" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {cat.icon} {cat.name}
                    </h3>
                    <p className="text-xs text-white/75 mt-1">
                      {cat.items?.length || 0} dish(es)
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCat({
                          id: cat.id,
                          name: cat.name,
                          icon: cat.icon,
                          bgColor: cat.bgColor,
                        })
                      }
                      className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white cursor-pointer"
                      title="Edit Category"
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1.5 rounded-lg bg-black/30 hover:bg-red-600 text-white cursor-pointer"
                      title="Delete Category"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dishes Section */}
      {selectedCategory && (
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-bold text-[#f5f5f5]">
            Dishes in {selectedCategory.icon} {selectedCategory.name} (
            {selectedCategory.items?.length || 0})
          </h3>

          {!selectedCategory.items?.length ? (
            <p className="text-xs text-[#888] py-6 text-center">
              No dishes in this category yet. Use &quot;Add Dishes&quot; above to add one.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {selectedCategory.items.map((dish) => (
                <div
                  key={dish.id}
                  className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    {dish.image && (
                      <img
                        src={dish.image}
                        alt={dish.name}
                        className="w-full h-28 object-cover rounded-lg mb-2.5"
                      />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-[#f5f5f5]">{dish.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#262626] text-[#ccc]">
                        {dish.category || "Non-Veg"}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-yellow-400 mt-1">
                      GH₵ {Number(dish.price || 0).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#262626]">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingDish({
                          categoryId: selectedCategory.id,
                          newCategoryId: selectedCategory.id,
                          dishId: dish.id,
                          name: dish.name,
                          price: String(dish.price),
                          categoryType: dish.category || "Non-Veg",
                          image: dish.image || "",
                        })
                      }
                      className="flex-1 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333] text-xs font-semibold text-[#f5f5f5] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FaEdit size={11} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDish(selectedCategory.id, dish)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 text-xs cursor-pointer"
                      title="Delete Dish"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCat && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCategory}
            className="bg-[#1a1a1a] border border-[#2f2f2f] rounded-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#f5f5f5]">Edit Category</h3>
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                className="text-[#888] hover:text-white cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <input
              type="text"
              value={editingCat.name}
              onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
              className="w-full rounded-lg p-3 bg-[#141414] border border-[#333] text-sm text-[#f5f5f5]"
              required
            />

            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setEditingCat({ ...editingCat, icon: emoji })}
                  className={`w-9 h-9 rounded-lg border text-base cursor-pointer ${
                    editingCat.icon === emoji
                      ? "bg-yellow-400/20 border-yellow-400"
                      : "bg-[#141414] border-[#333]"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setEditingCat({ ...editingCat, bgColor: color })}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                    editingCat.bgColor === color ? "border-yellow-400 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-yellow-400 text-black font-bold text-sm cursor-pointer"
            >
              Save Category
            </button>
          </form>
        </div>
      )}

      {/* Edit Dish Modal */}
      {editingDish && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDish}
            className="bg-[#1a1a1a] border border-[#2f2f2f] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#f5f5f5]">Edit Dish</h3>
              <button
                type="button"
                onClick={() => setEditingDish(null)}
                className="text-[#888] hover:text-white cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <select
              value={editingDish.newCategoryId}
              onChange={(e) =>
                setEditingDish({ ...editingDish, newCategoryId: e.target.value })
              }
              className="w-full rounded-lg p-3 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            >
              {menus.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Dish Name"
              value={editingDish.name}
              onChange={(e) => setEditingDish({ ...editingDish, name: e.target.value })}
              className="w-full rounded-lg p-3 bg-[#141414] border border-[#333] text-sm text-[#f5f5f5]"
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Price (GH₵)"
                value={editingDish.price}
                onChange={(e) => setEditingDish({ ...editingDish, price: e.target.value })}
                className="w-full rounded-lg p-3 bg-[#141414] border border-[#333] text-sm text-[#f5f5f5]"
                required
              />
              <select
                value={editingDish.categoryType}
                onChange={(e) =>
                  setEditingDish({ ...editingDish, categoryType: e.target.value })
                }
                className="w-full rounded-lg p-3 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
              >
                <option value="Non-Veg">Non-Veg</option>
                <option value="Veg">Veg</option>
              </select>
            </div>

            {editingDish.image ? (
              <div className="relative rounded-xl overflow-hidden border border-[#333]">
                <img
                  src={editingDish.image}
                  alt="Dish"
                  className="w-full h-36 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setEditingDish({ ...editingDish, image: "" })}
                  className="absolute top-2 right-2 bg-black/75 text-white px-2.5 py-1 rounded-lg text-xs cursor-pointer"
                >
                  Remove Photo
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-xl p-4 bg-[#141414] border border-dashed border-[#444] cursor-pointer text-xs text-[#ccc]">
                <FaImage className="text-yellow-400" />
                <span>Upload Dish Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDishImageUpload}
                  className="hidden"
                />
              </label>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-yellow-400 text-black font-bold text-sm cursor-pointer"
            >
              Save Dish Changes
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MenuAdmin;

