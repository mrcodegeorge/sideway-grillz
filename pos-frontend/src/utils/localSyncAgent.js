const LOCAL_AGENT_URL = "http://127.0.0.1:4123";
const REQUEST_TIMEOUT_MS = 1800;

const fetchWithTimeout = async (url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

export const getLocalAgentStatus = async () => {
  try {
    const res = await fetchWithTimeout(`${LOCAL_AGENT_URL}/health`, { method: "GET" }, 1200);
    if (!res.ok) return { running: false };
    const data = await res.json();
    return { running: true, ...data };
  } catch {
    return { running: false };
  }
};

export const getLocalAgentTables = async () => {
  const res = await fetchWithTimeout(`${LOCAL_AGENT_URL}/tables`, { method: "GET" });
  if (!res.ok) throw new Error("Local agent tables unavailable");
  return res.json();
};

export const getLocalAgentOrders = async () => {
  const res = await fetchWithTimeout(`${LOCAL_AGENT_URL}/orders`, { method: "GET" });
  if (!res.ok) throw new Error("Local agent orders unavailable");
  return res.json();
};

export const saveOrderToLocalAgent = async (orderPayload) => {
  const res = await fetchWithTimeout(
    `${LOCAL_AGENT_URL}/orders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    },
    3000
  );
  if (!res.ok) throw new Error("Failed to save order to local agent");
  return res.json();
};

export const triggerLocalAgentSync = async () => {
  const res = await fetchWithTimeout(
    `${LOCAL_AGENT_URL}/sync`,
    { method: "POST" },
    8000
  );
  if (!res.ok) throw new Error("Local agent sync failed");
  return res.json();
};

export const generateLocalSyncScript = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  return `#!/usr/bin/env node
/**
 * Sideways Grillz POS - Background Local Database & Synchronizer
 * Works on Windows, macOS, Linux, and Android (via Termux).
 * Zero external dependencies (requires Node.js 18+).
 *
 * Run:
 *   node sideways-local-sync.mjs
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = Number(process.env.SIDEWAYS_SYNC_PORT || 4123);
const SUPABASE_URL = process.env.SUPABASE_URL || ${JSON.stringify(supabaseUrl)};
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ${JSON.stringify(supabaseAnonKey)};
const SYNC_INTERVAL_MS = Number(process.env.SIDEWAYS_SYNC_INTERVAL_MS || 15000);

const DB_DIR = path.join(os.homedir(), ".sideways-pos");
const DB_FILE = path.join(DB_DIR, "sideways-local-db.json");

const ensureDbFile = () => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      tables: [],
      orders: [],
      pendingOrders: [],
      lastSyncAt: null,
      lastError: null,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
};

const readDb = () => {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      tables: Array.isArray(parsed.tables) ? parsed.tables : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      pendingOrders: Array.isArray(parsed.pendingOrders) ? parsed.pendingOrders : [],
      lastSyncAt: parsed.lastSyncAt || null,
      lastError: parsed.lastError || null,
    };
  } catch {
    return { tables: [], orders: [], pendingOrders: [], lastSyncAt: null, lastError: null };
  }
};

const writeDb = (db) => {
  ensureDbFile();
  const tmpFile = DB_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmpFile, DB_FILE);
};

let isOnline = false;
let isSyncing = false;

const supabaseHeaders = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: \`Bearer \${SUPABASE_ANON_KEY}\`,
  "Content-Type": "application/json",
});

const supabaseFetch = async (endpoint, options = {}) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  const url = \`\${SUPABASE_URL.replace(/\\/$/, "")}/rest/v1/\${endpoint}\`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...supabaseHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(\`Supabase HTTP \${res.status}: \${text}\`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const formatTable = (t) => ({
  _id: t.id,
  id: t.id,
  tableNo: t.table_no,
  seats: t.seats,
  status: t.status,
  currentOrder: t.orders
    ? {
        _id: t.orders.id,
        id: t.orders.id,
        customerDetails: t.orders.customer_details,
      }
    : null,
});

const formatOrder = (o) => ({
  _id: o.id,
  id: o.id,
  waiterId: o.waiter_id,
  waiterName: o.waiter_name,
  customerDetails: o.customer_details,
  orderStatus: o.order_status,
  orderDate: o.order_date,
  bills: o.bills,
  items: o.items,
  paymentMethod: o.payment_method,
  paymentData: o.payment_data,
  table: o.restaurant_tables
    ? {
        _id: o.restaurant_tables.id,
        id: o.restaurant_tables.id,
        tableNo: o.restaurant_tables.table_no,
        seats: o.restaurant_tables.seats,
        status: o.restaurant_tables.status,
      }
    : null,
});

const runSync = async () => {
  if (isSyncing) return { skipped: true };
  isSyncing = true;
  const db = readDb();
  let syncedCount = 0;

  try {
    // 1. Push pending offline orders to Supabase
    const remaining = [];
    for (const item of db.pendingOrders) {
      const payload = item.payload || {};
      try {
        const inserted = await supabaseFetch("orders?select=*", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            waiter_id: payload.waiterId || null,
            waiter_name: payload.waiterName || "Staff",
            customer_details: payload.customerDetails,
            order_status: payload.orderStatus || "InProgress",
            bills: payload.bills,
            items: payload.items,
            table_id: payload.table || null,
            payment_method: payload.paymentMethod || "Cash",
            payment_data: payload.paymentData || {},
            order_date: item.orderDate || new Date().toISOString(),
          }),
        });

        const created = Array.isArray(inserted) ? inserted[0] : inserted;
        if (payload.table && created?.id) {
          await supabaseFetch(\`restaurant_tables?id=eq.\${encodeURIComponent(payload.table)}\`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "Booked",
              current_order_id: created.id,
            }),
          });
        }
        syncedCount++;
      } catch (err) {
        remaining.push(item);
        throw err;
      }
    }
    db.pendingOrders = remaining;

    // 2. Pull latest tables from Supabase
    const tablesRaw = await supabaseFetch(
      "restaurant_tables?select=id,table_no,seats,status,current_order_id,orders:current_order_id(id,customer_details)&order=table_no.asc"
    );
    if (Array.isArray(tablesRaw)) {
      db.tables = tablesRaw.map(formatTable);
    }

    // 3. Pull latest orders from Supabase
    const ordersRaw = await supabaseFetch(
      "orders?select=id,waiter_id,waiter_name,customer_details,order_status,order_date,bills,items,payment_method,payment_data,restaurant_tables:table_id(id,table_no,seats,status)&order=created_at.desc&limit=100"
    );
    if (Array.isArray(ordersRaw)) {
      db.orders = ordersRaw.map(formatOrder);
    }

    db.lastSyncAt = new Date().toISOString();
    db.lastError = null;
    isOnline = true;
    writeDb(db);

    if (syncedCount > 0) {
      console.log(\`[\${new Date().toLocaleTimeString()}] Synced \${syncedCount} offline order(s) to Supabase.\`);
    }
    return { ok: true, syncedCount, lastSyncAt: db.lastSyncAt };
  } catch (err) {
    isOnline = false;
    db.lastError = err?.message || "Offline / Sync failed";
    writeDb(db);
    return { ok: false, error: db.lastError };
  } finally {
    isSyncing = false;
  }
};

const sendJson = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
  });
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  const url = (req.url || "/").split("?")[0];

  if (req.method === "GET" && url === "/health") {
    const db = readDb();
    return sendJson(res, 200, {
      ok: true,
      online: isOnline,
      isSyncing,
      pendingCount: db.pendingOrders.length,
      cachedTablesCount: db.tables.length,
      cachedOrdersCount: db.orders.length,
      lastSyncAt: db.lastSyncAt,
      lastError: db.lastError,
      dbPath: DB_FILE,
    });
  }

  if (req.method === "GET" && url === "/tables") {
    const db = readDb();
    return sendJson(res, 200, { success: true, data: db.tables });
  }

  if (req.method === "GET" && url === "/orders") {
    const db = readDb();
    return sendJson(res, 200, {
      success: true,
      data: [...db.pendingOrders, ...db.orders],
    });
  }

  if (req.method === "POST" && url === "/orders") {
    try {
      const payload = await readBody(req);
      const db = readDb();
      const offlineId = \`local_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}\`;
      const record = {
        _id: offlineId,
        id: offlineId,
        isOfflinePending: true,
        waiterId: payload.waiterId || null,
        waiterName: payload.waiterName || "Staff",
        customerDetails: payload.customerDetails,
        orderStatus: payload.orderStatus || "InProgress",
        orderDate: new Date().toISOString(),
        bills: payload.bills,
        items: payload.items,
        table: payload.table ? { _id: payload.table, id: payload.table } : null,
        paymentMethod: payload.paymentMethod || "Cash",
        paymentData: payload.paymentData || {},
        payload,
      };

      db.pendingOrders.unshift(record);
      if (payload.table) {
        db.tables = db.tables.map((t) =>
          t.id === payload.table || t._id === payload.table
            ? { ...t, status: "Booked" }
            : t
        );
      }
      writeDb(db);
      console.log(\`[\${new Date().toLocaleTimeString()}] Saved order \${offlineId} to local DB.\`);

      // Try syncing immediately in background
      runSync().catch(() => {});

      return sendJson(res, 200, {
        success: true,
        offline: true,
        message: "Saved to local background database! Will sync automatically.",
        data: record,
      });
    } catch (err) {
      return sendJson(res, 400, { success: false, message: err.message });
    }
  }

  if (req.method === "POST" && url === "/sync") {
    const result = await runSync();
    return sendJson(res, 200, result);
  }

  return sendJson(res, 404, { error: "Not found" });
});

ensureDbFile();
server.listen(PORT, "127.0.0.1", () => {
  console.log("==================================================");
  console.log(" Sideways Grillz POS - Local DB & Sync Agent");
  console.log(\` Listening on: http://127.0.0.1:\${PORT}\`);
  console.log(\` Local DB:     \${DB_FILE}\`);
  console.log(\` Sync every:   \${SYNC_INTERVAL_MS / 1000}s\`);
  console.log("==================================================");
  runSync();
  setInterval(runSync, SYNC_INTERVAL_MS);
});
`;
};

export const downloadTextFile = (filename, content) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateWindowsBatLauncher = () => `@echo off
title Sideways Grillz Local Sync Agent
echo Starting Sideways Grillz Local Database ^& Synchronizer...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed! Please install Node.js LTS from https://nodejs.org
  pause
  exit /b 1
)
node "%~dp0sideways-local-sync.mjs"
pause
`;

