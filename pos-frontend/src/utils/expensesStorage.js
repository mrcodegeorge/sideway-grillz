import { supabase } from "../supabase/client";

const STORAGE_KEY = "sideways_grillz_expenses";

const readLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeLocal = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const getExpenses = async () => {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category || "Other",
        amount: Number(e.amount || 0),
        expenseDate: e.expense_date,
        notes: e.notes || "",
        recordedBy: e.recorded_by || "Admin",
      }));
    }
  } catch {
    // Fallback to localStorage if Supabase table does not exist yet
  }
  return readLocal();
};

export const addExpense = async ({
  title,
  category,
  amount,
  expenseDate,
  notes,
  recordedBy,
}) => {
  const numericAmount = Number(amount);
  const dateStr = expenseDate || new Date().toISOString().slice(0, 10);

  try {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        title: title.trim(),
        category: category || "Other",
        amount: numericAmount,
        expense_date: dateStr,
        notes: notes?.trim() || "",
        recorded_by: recordedBy || "Admin",
      })
      .select()
      .single();

    if (!error && data) {
      return {
        id: data.id,
        title: data.title,
        category: data.category,
        amount: Number(data.amount),
        expenseDate: data.expense_date,
        notes: data.notes || "",
        recordedBy: data.recorded_by || "Admin",
      };
    }
  } catch {
    // Fallback to localStorage
  }

  const localItem = {
    id: `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title: title.trim(),
    category: category || "Other",
    amount: numericAmount,
    expenseDate: dateStr,
    notes: notes?.trim() || "",
    recordedBy: recordedBy || "Admin",
  };
  const existing = readLocal();
  writeLocal([localItem, ...existing]);
  return localItem;
};

export const deleteExpense = async (id) => {
  if (!String(id).startsWith("exp_")) {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (!error) return true;
    } catch {
      // Fallback below
    }
  }

  const existing = readLocal();
  writeLocal(existing.filter((item) => item.id !== id));
  return true;
};

