import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addTable } from "../../https";
import { enqueueSnackbar } from "notistack";
import { getMenus, addCategory, addDish } from "../../utils/menuStorage";

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

const MODAL_TITLES = {
  table: "Add Table",
  category: "Add Category",
  dishes: "Add Dish",
};

const Modal = ({ modalType = "table", onClose, setIsTableModalOpen }) => {
  const queryClient = useQueryClient();
  const categories = getMenus();

  const [tableData, setTableData] = useState({ tableNo: "", seats: "" });
  const [categoryData, setCategoryData] = useState({
    name: "",
    icon: "🍖",
    bgColor: "#b73e3e",
  });
  const [dishData, setDishData] = useState({
    categoryId: categories[0]?.id || "",
    name: "",
    price: "",
    categoryType: "Non-Veg",
  });

  const handleCloseModal = () => {
    if (onClose) onClose();
    if (setIsTableModalOpen) setIsTableModalOpen(false);
  };

  const tableMutation = useMutation({
    mutationFn: (reqData) => addTable(reqData),
    onSuccess: (res) => {
      queryClient.invalidateQueries(["tables"]);
      handleCloseModal();
      enqueueSnackbar(res.data?.message || "Table added!", { variant: "success" });
    },
    onError: (error) => {
      const msg = error?.response?.data?.message || "Failed to add table.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalType === "table") {
      tableMutation.mutate(tableData);
      return;
    }

    if (modalType === "category") {
      if (!categoryData.name.trim()) {
        enqueueSnackbar("Please enter a category name.", { variant: "warning" });
        return;
      }
      addCategory(categoryData);
      enqueueSnackbar(`Category "${categoryData.name}" added!`, {
        variant: "success",
      });
      handleCloseModal();
      return;
    }

    if (modalType === "dishes") {
      if (!dishData.categoryId || !dishData.name.trim() || !dishData.price) {
        enqueueSnackbar("Please fill in all dish fields.", { variant: "warning" });
        return;
      }
      addDish(dishData);
      enqueueSnackbar(`Dish "${dishData.name}" added!`, { variant: "success" });
      handleCloseModal();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="bg-[#262626] border border-[#383838] p-6 rounded-xl shadow-2xl w-full max-w-md"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#f5f5f5] text-xl font-bold">
            {MODAL_TITLES[modalType] || "Add Item"}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="text-[#ababab] hover:text-red-500 p-1 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {modalType === "table" && (
            <>
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Table Number
                </label>
                <div className="flex items-center rounded-lg p-3.5 bg-[#1f1f1f] border border-[#333]">
                  <input
                    type="number"
                    name="tableNo"
                    placeholder="e.g. 11"
                    value={tableData.tableNo}
                    onChange={(e) =>
                      setTableData((prev) => ({ ...prev, tableNo: e.target.value }))
                    }
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Number of Seats
                </label>
                <div className="flex items-center rounded-lg p-3.5 bg-[#1f1f1f] border border-[#333]">
                  <input
                    type="number"
                    name="seats"
                    placeholder="e.g. 4"
                    value={tableData.seats}
                    onChange={(e) =>
                      setTableData((prev) => ({ ...prev, seats: e.target.value }))
                    }
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {modalType === "category" && (
            <>
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Category Name
                </label>
                <div className="flex items-center rounded-lg p-3.5 bg-[#1f1f1f] border border-[#333]">
                  <input
                    type="text"
                    placeholder="e.g. Grilled Platters"
                    value={categoryData.name}
                    onChange={(e) =>
                      setCategoryData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() =>
                        setCategoryData((prev) => ({ ...prev, icon: emoji }))
                      }
                      className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center border transition-all ${categoryData.icon === emoji
                          ? "bg-yellow-400/20 border-yellow-400 scale-105"
                          : "bg-[#1f1f1f] border-[#333] hover:border-[#555]"
                        }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Card Color
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        setCategoryData((prev) => ({ ...prev, bgColor: color }))
                      }
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${categoryData.bgColor === color
                          ? "border-yellow-400 scale-110"
                          : "border-transparent"
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {modalType === "dishes" && (
            <>
              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Category
                </label>
                <select
                  value={dishData.categoryId}
                  onChange={(e) =>
                    setDishData((prev) => ({ ...prev, categoryId: e.target.value }))
                  }
                  className="w-full rounded-lg p-3.5 bg-[#1f1f1f] border border-[#333] text-white focus:outline-none"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#ababab] mb-2 text-sm font-medium">
                  Dish Name
                </label>
                <div className="flex items-center rounded-lg p-3.5 bg-[#1f1f1f] border border-[#333]">
                  <input
                    type="text"
                    placeholder="e.g. Charcoal Pork Ribs"
                    value={dishData.name}
                    onChange={(e) =>
                      setDishData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#ababab] mb-2 text-sm font-medium">
                    Price (GH₵)
                  </label>
                  <div className="flex items-center rounded-lg p-3.5 bg-[#1f1f1f] border border-[#333]">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 85"
                      value={dishData.price}
                      onChange={(e) =>
                        setDishData((prev) => ({ ...prev, price: e.target.value }))
                      }
                      className="bg-transparent flex-1 text-white focus:outline-none w-full"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#ababab] mb-2 text-sm font-medium">
                    Dietary Type
                  </label>
                  <select
                    value={dishData.categoryType}
                    onChange={(e) =>
                      setDishData((prev) => ({
                        ...prev,
                        categoryType: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg p-3.5 bg-[#1f1f1f] border border-[#333] text-white focus:outline-none"
                  >
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Veg">Veg</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={modalType === "table" && tableMutation.isPending}
            className="w-full rounded-lg mt-6 py-3 text-base bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold transition-colors cursor-pointer"
          >
            {modalType === "table" && tableMutation.isPending
              ? "Saving..."
              : MODAL_TITLES[modalType] || "Save"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Modal;
