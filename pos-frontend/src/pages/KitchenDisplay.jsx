import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  FaBell,
  FaBellSlash,
  FaCheck,
  FaCheckDouble,
  FaClock,
  FaFire,
  FaMotorcycle,
  FaShoppingBag,
  FaSyncAlt,
  FaUtensils,
} from "react-icons/fa";
import { supabase } from "../supabase/client";
import { getKitchenOrders, updateOrderStatus } from "../https";
import { dispatchOrderSmsIfEnabled } from "../utils/settingsStorage";

const playKitchenChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Audio playback may be blocked until user interaction
  }
};

const getElapsedMinutes = (iso, nowMs) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
};

const formatTimer = (iso, nowMs) => {
  if (!iso) return "00:00";
  const secs = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const KitchenDisplay = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const seenOrderIdsRef = useRef(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    document.title = "Sideways Grillz | Kitchen Display (KDS)";
    const tick = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: getKitchenOrders,
    refetchInterval: 15000,
  });

  // Detect brand-new incoming InProgress orders and chime
  useEffect(() => {
    const currentIds = new Set(orders.map((o) => o.id));
    if (initializedRef.current) {
      const hasNewInProgress = orders.some(
        (o) => o.orderStatus === "InProgress" && !seenOrderIdsRef.current.has(o.id)
      );
      if (hasNewInProgress && soundEnabled) {
        playKitchenChime();
        enqueueSnackbar("New kitchen ticket received!", { variant: "info" });
      }
    } else if (orders.length > 0) {
      initializedRef.current = true;
    }
    seenOrderIdsRef.current = currentIds;
  }, [orders, soundEnabled]);

  // Live Supabase Realtime subscription on public.orders
  useEffect(() => {
    const channel = supabase
      .channel("kitchen-display-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: async ({ order, nextStatus }) => {
      await updateOrderStatus({ orderId: order.id, orderStatus: nextStatus });

      if (nextStatus === "Ready") {
        // Notify customer if SMS on order ready is enabled
        dispatchOrderSmsIfEnabled({
          eventType: "ready",
          customerName: order.customerDetails?.name,
          customerPhone: order.customerDetails?.phone,
          orderId: order.id,
          total: order.bills?.totalWithTax,
        });

        // If Delivery order, sync linked delivery task to ready_for_pickup
        if ((order.customerDetails?.orderType || "") === "Delivery") {
          await supabase
            .from("delivery_tasks")
            .update({ current_status: "ready_for_pickup", updated_at: new Date().toISOString() })
            .eq("order_id", order.id)
            .in("current_status", ["pending_assignment", "assigned", "accepted", "preparing"]);
        }
      }
      return nextStatus;
    },
    onSuccess: (nextStatus) => {
      enqueueSnackbar(
        nextStatus === "Ready" ? "Ticket marked READY!" : "Ticket bumped / completed!",
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message || "Failed to update ticket", {
        variant: "error",
      });
    },
  });

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.orderStatus !== statusFilter) return false;
      const orderType = o.customerDetails?.orderType || "Dine In";
      if (typeFilter !== "all" && orderType !== typeFilter) return false;
      return true;
    });
  }, [orders, statusFilter, typeFilter]);

  const inProgressCount = orders.filter((o) => o.orderStatus === "InProgress").length;
  const readyCount = orders.filter((o) => o.orderStatus === "Ready").length;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#1f1f1f] text-[#f5f5f5] p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top KDS Bar */}
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-500/20 text-orange-400">
              <FaFire size={20} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#f5f5f5]">
                Kitchen Display System (KDS)
              </h1>
              <p className="text-xs text-[#ababab]">
                Live tickets:{" "}
                <span className="text-amber-400 font-bold">{inProgressCount} Preparing</span> •{" "}
                <span className="text-emerald-400 font-bold">{readyCount} Ready</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playKitchenChime();
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer border ${soundEnabled
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-[#262626] border-[#333] text-[#888]"
                }`}
            >
              {soundEnabled ? <FaBell size={13} /> : <FaBellSlash size={13} />}
              <span>{soundEnabled ? "Sound On" : "Muted"}</span>
            </button>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#262626] hover:bg-[#333] border border-[#333] text-xs font-semibold cursor-pointer"
            >
              <FaSyncAlt className={isFetching ? "animate-spin" : ""} size={12} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: `All Active (${orders.length})` },
              { id: "InProgress", label: `Preparing (${inProgressCount})` },
              { id: "Ready", label: `Ready (${readyCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${statusFilter === tab.id
                    ? "bg-yellow-400 text-black"
                    : "bg-[#1a1a1a] text-[#ababab] border border-[#2e2e2e]"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["all", "Dine In", "Takeout", "Delivery"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${typeFilter === type
                    ? "bg-[#383838] text-white"
                    : "bg-[#1a1a1a] text-[#888] border border-[#2e2e2e]"
                  }`}
              >
                {type === "all" ? "All Types" : type}
              </button>
            ))}
          </div>
        </div>

        {/* Tickets Grid */}
        {isLoading ? (
          <div className="py-16 text-center text-sm text-[#888]">Loading kitchen tickets...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl py-16 text-center space-y-2">
            <FaCheckDouble className="mx-auto text-emerald-400" size={28} />
            <p className="text-base font-bold text-[#f5f5f5]">All Caught Up!</p>
            <p className="text-xs text-[#888]">No pending kitchen tickets right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => {
              const orderType = order.customerDetails?.orderType || "Dine In";
              const mins = getElapsedMinutes(order.orderDate, nowMs);
              const isReady = order.orderStatus === "Ready";
              const timerClass = isReady
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : mins >= 20
                  ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"
                  : mins >= 10
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/40";

              return (
                <div
                  key={order.id}
                  className={`bg-[#1a1a1a] rounded-2xl border-2 flex flex-col justify-between overflow-hidden shadow-lg ${isReady
                      ? "border-emerald-500/60"
                      : mins >= 20
                        ? "border-red-500/70"
                        : "border-[#2e2e2e]"
                    }`}
                >
                  <div>
                    {/* Ticket Header */}
                    <div className="p-4 border-b border-[#2a2a2a] flex items-start justify-between gap-2 bg-[#141414]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-yellow-400">
                            #{String(order.id).slice(0, 8).toUpperCase()}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#262626] text-[10px] font-bold uppercase text-[#f5f5f5]">
                            {orderType === "Delivery" ? (
                              <FaMotorcycle size={10} className="text-cyan-400" />
                            ) : orderType === "Takeout" ? (
                              <FaShoppingBag size={10} className="text-amber-400" />
                            ) : (
                              <FaUtensils size={10} className="text-emerald-400" />
                            )}
                            {orderType === "Dine In" && order.table?.tableNo
                              ? `Table ${order.table.tableNo}`
                              : orderType}
                          </span>
                        </div>
                        <p className="text-xs text-[#ccc] mt-1 font-medium">
                          {order.customerDetails?.name || "Walk-in"} •{" "}
                          <span className="text-[#888]">{order.waiterName || "Staff"}</span>
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${timerClass}`}
                      >
                        <FaClock size={11} />
                        {formatTimer(order.orderDate, nowMs)}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="p-4 space-y-2.5">
                      {(order.items || []).map((item, idx) => (
                        <div
                          key={`${order.id}-item-${idx}`}
                          className="flex items-start justify-between gap-2 text-sm border-b border-[#242424] pb-2 last:border-b-0 last:pb-0"
                        >
                          <span className="font-bold text-yellow-400 shrink-0">
                            {item.quantity}x
                          </span>
                          <span className="flex-1 font-semibold text-[#f5f5f5]">
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 1-Tap Action Button */}
                  <div className="p-3 border-t border-[#2a2a2a] bg-[#141414]">
                    {!isReady ? (
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ order, nextStatus: "Ready" })}
                        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <FaCheck />
                        <span>Mark Ready</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ order, nextStatus: "Completed" })}
                        className="w-full py-3 rounded-xl bg-[#262626] hover:bg-[#333] text-emerald-400 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <FaCheckDouble />
                        <span>Served / Bump Ticket</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenDisplay;

