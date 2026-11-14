import { supabase } from "../supabase/client";

const STORAGE_KEY = "sideways_grillz_audit_trails";
const MAX_LOCAL_LOGS = 400;

const readLocalLogs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeLocalLogs = (logs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOCAL_LOGS)));
  } catch {
    // ignore quota errors
  }
};

export const logAuditEvent = async ({
  action,
  entityType,
  entityId = "",
  details = "",
  metadata = {},
  actorId,
  actorName,
  actorRole,
}) => {
  try {
    let resolvedId = actorId;
    let resolvedName = actorName;
    let resolvedRole = actorRole;

    if (!resolvedName || !resolvedRole || !resolvedId) {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (user) {
          resolvedId = resolvedId || user.id;
          resolvedName =
            resolvedName ||
            user.user_metadata?.name ||
            user.user_metadata?.username ||
            user.email ||
            "Staff";
          resolvedRole = resolvedRole || user.user_metadata?.role || "Waiter";
        }
      } catch {
        // ignore session lookup failure
      }
    }

    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      actorId: resolvedId || "",
      actorName: resolvedName || "System",
      actorRole: resolvedRole || "Staff",
      action: action || "ACTION",
      entityType: entityType || "System",
      entityId: String(entityId || ""),
      details: details || "",
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    };

    const existing = readLocalLogs();
    writeLocalLogs([entry, ...existing]);

    // Persist to Supabase audit_trails table when available
    await supabase.from("audit_trails").insert({
      actor_id: entry.actorId,
      actor_name: entry.actorName,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      details: entry.details,
      metadata: entry.metadata,
      created_at: entry.createdAt,
    });
  } catch {
    // Audit logging must never disrupt POS operations
  }
};

export const getAuditTrails = async () => {
  const localLogs = readLocalLogs();
  try {
    const { data, error } = await supabase
      .from("audit_trails")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (!error && Array.isArray(data)) {
      const remoteLogs = data.map((row) => ({
        id: row.id,
        actorId: row.actor_id || "",
        actorName: row.actor_name || "Staff",
        actorRole: row.actor_role || "Staff",
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id || "",
        details: row.details || "",
        metadata: row.metadata || {},
        createdAt: row.created_at,
      }));
      return remoteLogs.length > 0 ? remoteLogs : localLogs;
    }
  } catch {
    // fallback to local logs
  }
  return localLogs;
};

