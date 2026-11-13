import { supabase } from "../supabase/client";

const STORAGE_KEY = "sideways_grillz_incidents";

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

export const getIncidents = async () => {
  try {
    const { data, error } = await supabase
      .from("incident_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((item) => ({
        id: item.id,
        category: item.category,
        severity: item.severity || "Medium",
        orderRef: item.order_ref || "",
        description: item.description,
        photoData: item.photo_data || "",
        reportedBy: item.reported_by || "Staff",
        status: item.status || "Open",
        adminNotes: item.admin_notes || "",
        createdAt: item.created_at,
      }));
    }
  } catch {
    // Fallback to localStorage if table does not exist yet
  }
  return readLocal();
};

export const addIncident = async ({
  category,
  severity,
  orderRef,
  description,
  photoData,
  reportedBy,
}) => {
  const createdAt = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("incident_reports")
      .insert({
        category,
        severity: severity || "Medium",
        order_ref: orderRef?.trim() || "",
        description: description.trim(),
        photo_data: photoData || "",
        reported_by: reportedBy || "Staff",
        status: "Open",
        admin_notes: "",
      })
      .select()
      .single();

    if (!error && data) {
      return {
        id: data.id,
        category: data.category,
        severity: data.severity,
        orderRef: data.order_ref || "",
        description: data.description,
        photoData: data.photo_data || "",
        reportedBy: data.reported_by,
        status: data.status,
        adminNotes: data.admin_notes || "",
        createdAt: data.created_at,
      };
    }
  } catch {
    // Fallback to localStorage
  }

  const localItem = {
    id: `inc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    category,
    severity: severity || "Medium",
    orderRef: orderRef?.trim() || "",
    description: description.trim(),
    photoData: photoData || "",
    reportedBy: reportedBy || "Staff",
    status: "Open",
    adminNotes: "",
    createdAt,
  };

  const existing = readLocal();
  writeLocal([localItem, ...existing]);
  return localItem;
};

export const updateIncidentStatus = async ({ id, status, adminNotes }) => {
  if (!String(id).startsWith("inc_")) {
    try {
      const payload = {};
      if (status !== undefined) payload.status = status;
      if (adminNotes !== undefined) payload.admin_notes = adminNotes;

      const { data, error } = await supabase
        .from("incident_reports")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback below
    }
  }

  const existing = readLocal();
  const updated = existing.map((item) =>
    item.id === id
      ? {
        ...item,
        status: status !== undefined ? status : item.status,
        adminNotes: adminNotes !== undefined ? adminNotes : item.adminNotes,
      }
      : item
  );
  writeLocal(updated);
  return updated.find((item) => item.id === id);
};

export const deleteIncident = async (id) => {
  if (!String(id).startsWith("inc_")) {
    try {
      const { error } = await supabase
        .from("incident_reports")
        .delete()
        .eq("id", id);
      if (!error) return true;
    } catch {
      // Fallback below
    }
  }

  const existing = readLocal();
  writeLocal(existing.filter((item) => item.id !== id));
  return true;
};

