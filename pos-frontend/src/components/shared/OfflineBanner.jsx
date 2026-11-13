import React, { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaWifi, FaSync } from "react-icons/fa";
import {
  getOfflineOrders,
  removeOfflineOrder,
  OFFLINE_QUEUE_EVENT,
} from "../../utils/offlineQueue";
import { addOrder } from "../../https/index";

const OfflineBanner = () => {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(() => getOfflineOrders().length);
  const [syncing, setSyncing] = useState(false);

  const refreshQueueCount = useCallback(() => {
    setPendingCount(getOfflineOrders().length);
  }, []);

  const syncOfflineOrders = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    const queue = getOfflineOrders();
    if (queue.length === 0) return;

    setSyncing(true);
    let syncedCount = 0;

    // Sync oldest first
    for (const item of [...queue].reverse()) {
      try {
        const { _id, isOffline, queuedAt, ...orderPayload } = item;
        await addOrder(orderPayload);
        removeOfflineOrder(_id);
        syncedCount += 1;
      } catch {
        // Stop on network error and retry later
        break;
      }
    }

    setSyncing(false);
    refreshQueueCount();

    if (syncedCount > 0) {
      enqueueSnackbar(
        `Synced ${syncedCount} offline order${syncedCount === 1 ? "" : "s"} to server!`,
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    }
  }, [syncing, refreshQueueCount, queryClient]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineOrders();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshQueueCount);

    // Attempt initial sync if online on app load
    if (navigator.onLine && getOfflineOrders().length > 0) {
      syncOfflineOrders();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshQueueCount);
    };
  }, [syncOfflineOrders, refreshQueueCount]);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-3 ${!isOnline
          ? "bg-red-900/90 text-red-100 border-b border-red-700"
          : "bg-yellow-500/95 text-gray-900 border-b border-yellow-600"
        }`}
    >
      <FaWifi size={12} />
      {!isOnline ? (
        <span>
          Offline Mode — Orders are saved on this device
          {pendingCount > 0 ? ` (${pendingCount} queued)` : ""} and will auto-sync when online.
        </span>
      ) : (
        <>
          <span>
            {pendingCount} offline order{pendingCount === 1 ? "" : "s"} waiting to sync.
          </span>
          <button
            type="button"
            disabled={syncing}
            onClick={syncOfflineOrders}
            className="bg-gray-900 text-yellow-400 px-2.5 py-0.5 rounded font-bold flex items-center gap-1"
          >
            <FaSync className={syncing ? "animate-spin" : ""} size={10} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </>
      )}
    </div>
  );
};

export default OfflineBanner;

