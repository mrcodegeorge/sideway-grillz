const OFFLINE_ORDERS_KEY = "sideways_grillz_offline_orders";
const CACHED_TABLES_KEY = "sideways_grillz_cached_tables";
const CACHED_ORDERS_KEY = "sideways_grillz_cached_orders";
export const OFFLINE_QUEUE_EVENT = "sideways-offline-queue-updated";

export const getOfflineOrders = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveOfflineOrder = (orderPayload) => {
  const offlineOrder = {
    ...orderPayload,
    _id: `offline_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    orderDate: orderPayload.orderDate || new Date().toISOString(),
    isOffline: true,
    queuedAt: new Date().toISOString(),
  };
  const existing = getOfflineOrders();
  localStorage.setItem(
    OFFLINE_ORDERS_KEY,
    JSON.stringify([offlineOrder, ...existing])
  );
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  return offlineOrder;
};

export const removeOfflineOrder = (offlineId) => {
  const existing = getOfflineOrders();
  const next = existing.filter((o) => o._id !== offlineId);
  localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
};

export const setCachedTables = (tables) => {
  try {
    localStorage.setItem(CACHED_TABLES_KEY, JSON.stringify(tables || []));
  } catch {
    // Ignore storage quota errors
  }
};

export const getCachedTables = () => {
  try {
    const raw = localStorage.getItem(CACHED_TABLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const setCachedOrders = (orders) => {
  try {
    localStorage.setItem(CACHED_ORDERS_KEY, JSON.stringify(orders || []));
  } catch {
    // Ignore storage quota errors
  }
};

export const getCachedOrders = () => {
  try {
    const raw = localStorage.getItem(CACHED_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

