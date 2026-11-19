import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

const DB_NAME = "SidewaysGrillzBackupDB";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const WRITE_QUEUE_STORE = "pending_writes";
const BACKUP_CONFIG_KEY = "sideways_backup_db_config";

export const DB_FAILOVER_EVENT = "sideways-db-failover-changed";

let failoverState = {
  primaryHealthy: true,
  manualFailover: false,
  lastCheckedAt: null,
  lastLatencyMs: null,
  lastError: null,
};

export const getFailoverState = () => ({ ...failoverState });

const notifyFailoverChange = () => {
  window.dispatchEvent(new CustomEvent(DB_FAILOVER_EVENT, { detail: getFailoverState() }));
};

export const setManualFailoverMode = (enabled) => {
  failoverState = {
    ...failoverState,
    manualFailover: Boolean(enabled),
    primaryHealthy: enabled ? false : failoverState.primaryHealthy,
  };
  notifyFailoverChange();
};

export const markPrimaryUnhealthy = (reason = "Primary Supabase unresponsive") => {
  if (failoverState.primaryHealthy) {
    failoverState = {
      ...failoverState,
      primaryHealthy: false,
      lastCheckedAt: new Date().toISOString(),
      lastError: reason,
    };
    notifyFailoverChange();
  }
};

export const markPrimaryHealthy = (latencyMs = null) => {
  if (!failoverState.primaryHealthy || failoverState.lastError) {
    failoverState = {
      ...failoverState,
      primaryHealthy: !failoverState.manualFailover,
      lastCheckedAt: new Date().toISOString(),
      lastLatencyMs: latencyMs,
      lastError: null,
    };
    notifyFailoverChange();
  }
};

// ============================================================================
// Secondary Cloud Backup Supabase (Optional Env or Admin Config)
// ============================================================================
export const getBackupCloudConfig = () => {
  try {
    const raw = localStorage.getItem(BACKUP_CONFIG_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return {
      url: saved.url || import.meta.env.VITE_BACKUP_SUPABASE_URL || "",
      anonKey: saved.anonKey || import.meta.env.VITE_BACKUP_SUPABASE_ANON_KEY || "",
    };
  } catch {
    return {
      url: import.meta.env.VITE_BACKUP_SUPABASE_URL || "",
      anonKey: import.meta.env.VITE_BACKUP_SUPABASE_ANON_KEY || "",
    };
  }
};

export const saveBackupCloudConfig = ({ url, anonKey }) => {
  localStorage.setItem(
    BACKUP_CONFIG_KEY,
    JSON.stringify({ url: (url || "").trim(), anonKey: (anonKey || "").trim() })
  );
  cachedBackupClient = null;
};

let cachedBackupClient = null;
export const getBackupSupabaseClient = () => {
  const { url, anonKey } = getBackupCloudConfig();
  if (!url || !anonKey) return null;
  if (!cachedBackupClient) {
    cachedBackupClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedBackupClient;
};

// ============================================================================
// IndexedDB Persistent Backup Database (Zero-Setup Local Failover)
// ============================================================================
const openBackupDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(WRITE_QUEUE_STORE)) {
        db.createObjectStore(WRITE_QUEUE_STORE, { keyPath: "opId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const saveBackupSnapshot = async (key, data) => {
  try {
    const db = await openBackupDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
      tx.objectStore(SNAPSHOT_STORE).put({
        key,
        data,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal
  }
};

export const getBackupSnapshot = async (key, fallback = []) => {
  try {
    const db = await openBackupDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(SNAPSHOT_STORE, "readonly");
      const req = tx.objectStore(SNAPSHOT_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.data ?? fallback);
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
};

export const enqueueFailoverWrite = async ({ table, action = "insert", payload }) => {
  const record = {
    opId: `failover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    table,
    action,
    payload,
    createdAt: new Date().toISOString(),
  };

  // Also mirror to Secondary Cloud Backup Supabase if configured
  try {
    const backupClient = getBackupSupabaseClient();
    if (backupClient && action === "insert") {
      await backupClient.from(table).insert(payload);
    }
  } catch {
    // secondary cloud mirror optional
  }

  try {
    const db = await openBackupDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(WRITE_QUEUE_STORE, "readwrite");
      tx.objectStore(WRITE_QUEUE_STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal
  }

  notifyFailoverChange();
  return record;
};

export const getFailoverWrites = async () => {
  try {
    const db = await openBackupDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(WRITE_QUEUE_STORE, "readonly");
      const req = tx.objectStore(WRITE_QUEUE_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

const deleteFailoverWrite = async (opId) => {
  const db = await openBackupDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(WRITE_QUEUE_STORE, "readwrite");
    tx.objectStore(WRITE_QUEUE_STORE).delete(opId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

// ============================================================================
// Primary Supabase Health Check & Auto-Recovery Sync
// ============================================================================
export const checkPrimarySupabaseHealth = async (timeoutMs = 4500) => {
  if (failoverState.manualFailover) {
    return getFailoverState();
  }
  if (!navigator.onLine) {
    markPrimaryUnhealthy("Device offline");
    return getFailoverState();
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { error } = await supabase
      .from("restaurant_tables")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timer);

    if (error && /fetch|timeout|502|503|504|network/i.test(error.message || "")) {
      throw new Error(error.message);
    }

    const latency = Date.now() - start;
    failoverState = {
      ...failoverState,
      primaryHealthy: true,
      lastCheckedAt: new Date().toISOString(),
      lastLatencyMs: latency,
      lastError: null,
    };
    notifyFailoverChange();
  } catch (err) {
    failoverState = {
      ...failoverState,
      primaryHealthy: false,
      lastCheckedAt: new Date().toISOString(),
      lastLatencyMs: Date.now() - start,
      lastError: err?.name === "AbortError" ? "Primary Supabase timed out" : err?.message || "Unreachable",
    };
    notifyFailoverChange();
  }

  return getFailoverState();
};

export const syncFailoverWritesToPrimary = async () => {
  if (failoverState.manualFailover || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  const pending = await getFailoverWrites();
  if (!pending.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      if (item.action === "insert") {
        const { error } = await supabase.from(item.table).insert(item.payload);
        if (error) throw error;
      }
      await deleteFailoverWrite(item.opId);
      synced++;
    } catch {
      failed++;
    }
  }
  notifyFailoverChange();
  return { synced, failed };
};

export const getBackupDbStats = async () => {
  const [orders, tables, pending] = await Promise.all([
    getBackupSnapshot("orders", []),
    getBackupSnapshot("tables", []),
    getFailoverWrites(),
  ]);
  const cloudCfg = getBackupCloudConfig();
  return {
    cachedOrdersCount: Array.isArray(orders) ? orders.length : 0,
    cachedTablesCount: Array.isArray(tables) ? tables.length : 0,
    pendingWritesCount: pending.length,
    secondaryCloudConfigured: Boolean(cloudCfg.url && cloudCfg.anonKey),
    failover: getFailoverState(),
  };
};

export const exportFullDatabaseBackup = async () => {
  const [orders, tables, pending] = await Promise.all([
    getBackupSnapshot("orders", []),
    getBackupSnapshot("tables", []),
    getFailoverWrites(),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    source: "Sideways Grillz POS Backup DB",
    tables,
    orders,
    pendingFailoverWrites: pending,
    menus: JSON.parse(localStorage.getItem("sideways_grillz_menus") || "[]"),
    expenses: JSON.parse(localStorage.getItem("sideways_grillz_expenses") || "[]"),
    settings: JSON.parse(localStorage.getItem("sideways_grillz_settings") || "{}"),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sideways-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

