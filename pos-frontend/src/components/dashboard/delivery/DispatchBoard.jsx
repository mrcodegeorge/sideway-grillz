import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaMotorcycle, FaPhoneAlt, FaSearch, FaTimes, FaUserPlus, FaWhatsapp } from "react-icons/fa";
import {
  assignDeliveryRider,
  generateDeliveryOtp,
  getDeliveryTaskLogs,
  transitionDeliveryStatus,
} from "../../../https/deliveryApi";
import {
  buildWhatsAppUrl,
  DELIVERY_STATUS_LABELS,
  DISPATCH_COLUMNS,
} from "../../../utils/deliveryZones";
import DeliveryMap from "../../shared/DeliveryMap";

const formatElapsed = (iso) => {
  if (!iso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

const DispatchBoard = ({ tasks = [], riders = [], zones = [], settings }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [riderFilter, setRiderFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const { data: taskLogs = [] } = useQuery({
    queryKey: ["delivery-logs", selectedTask?.id],
    queryFn: () => getDeliveryTaskLogs(selectedTask.id),
    enabled: Boolean(selectedTask?.id),
  });

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (riderFilter !== "all" && t.assigned_rider_id !== riderFilter) return false;
      if (zoneFilter !== "all" && t.zone_id !== zoneFilter) return false;
      if (paymentFilter !== "all" && (t.orders?.payment_method || "") !== paymentFilter) return false;
      if (!q) return true;
      const orderRef = String(t.order_id || "").toLowerCase();
      return (
        orderRef.includes(q) ||
        (t.customer_name || "").toLowerCase().includes(q) ||
        (t.customer_phone || "").toLowerCase().includes(q) ||
        (t.delivery_address || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, riderFilter, zoneFilter, paymentFilter]);

  const assignMutation = useMutation({
    mutationFn: assignDeliveryRider,
    onSuccess: () => {
      enqueueSnackbar("Rider assigned successfully!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-riders"] });
      setSelectedTask(null);
    },
    onError: (err) => {
      enqueueSnackbar(err?.message || "Assignment failed", { variant: "error" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: transitionDeliveryStatus,
    onSuccess: () => {
      enqueueSnackbar("Delivery status updated!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-riders"] });
      setSelectedTask(null);
      setCancelReason("");
    },
    onError: (err) => {
      enqueueSnackbar(err?.message || "Status update failed", { variant: "error" });
    },
  });

  const otpMutation = useMutation({
    mutationFn: generateDeliveryOtp,
    onSuccess: (res) => {
      enqueueSnackbar(`OTP generated (${res.otp}) and queued for customer SMS.`, {
        variant: "success",
      });
    },
    onError: (err) => {
      enqueueSnackbar(err?.message || "Failed to generate OTP", { variant: "error" });
    },
  });

  const activeRiders = riders.filter((r) => r.account_status === "active");

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-3">
        <div className="flex items-center gap-2 bg-[#141414] border border-[#2e2e2e] rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <FaSearch className="text-[#888]" size={12} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, phone, or address..."
            className="bg-transparent outline-none text-xs text-[#f5f5f5] w-full"
          />
        </div>

        <select
          value={riderFilter}
          onChange={(e) => setRiderFilter(e.target.value)}
          className="bg-[#141414] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-[#f5f5f5]"
        >
          <option value="all">All Riders</option>
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name} ({r.availability_status})
            </option>
          ))}
        </select>

        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="bg-[#141414] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-[#f5f5f5]"
        >
          <option value="all">All Zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="bg-[#141414] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-[#f5f5f5]"
        >
          <option value="all">All Payments</option>
          <option value="Cash">Cash</option>
          <option value="Paystack">Paystack</option>
        </select>
      </div>

      {/* 7-Column Dispatch Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DISPATCH_COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) =>
            col.statuses.includes(t.current_status)
          );
          return (
            <div
              key={col.key}
              className="min-w-[270px] w-[270px] shrink-0 bg-[#141414] border border-[#2a2a2a] rounded-xl flex flex-col max-h-[65vh]"
            >
              <div className="px-3.5 py-2.5 border-b border-[#2a2a2a] flex items-center justify-between">
                <span className="text-xs font-bold text-[#f5f5f5]">{col.label}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#262626] text-[11px] font-bold text-yellow-400">
                  {colTasks.length}
                </span>
              </div>

              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {colTasks.length === 0 ? (
                  <p className="text-[11px] text-[#666] text-center py-6">No deliveries</p>
                ) : (
                  colTasks.map((task) => {
                    const orderTotal = Number(
                      task.orders?.bills?.totalWithTax ?? task.orders?.bills?.total ?? 0
                    );
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          setSelectedTask(task);
                          setSelectedRiderId(task.assigned_rider_id || "");
                        }}
                        className="w-full text-left bg-[#1a1a1a] hover:bg-[#232323] border border-[#2e2e2e] rounded-xl p-3 space-y-1.5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-yellow-400">
                            #{String(task.order_id).slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-[#888]">
                            {formatElapsed(task.created_at)}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-[#f5f5f5] truncate">
                          {task.customer_name || "Customer"} • {task.customer_phone}
                        </p>
                        <p className="text-[11px] text-[#ababab] line-clamp-2">
                          {task.delivery_address}
                        </p>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#262626]">
                          <span className="text-emerald-400 font-bold">
                            GH₵ {orderTotal.toFixed(2)}
                          </span>
                          <span className="text-[#888]">
                            {task.orders?.payment_method || "Cash"} • Fee: GH₵{" "}
                            {Number(task.delivery_fee || 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="px-2 py-0.5 rounded bg-[#262626] text-[#ccc]">
                            {DELIVERY_STATUS_LABELS[task.current_status] || task.current_status}
                          </span>
                          <span className="text-yellow-400 font-medium truncate max-w-[110px]">
                            {task.riders?.full_name || "Unassigned"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Delivery Detail & Assignment Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2f2f2f] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#f5f5f5]">
                  Delivery #{String(selectedTask.order_id).slice(0, 8).toUpperCase()}
                </h3>
                <p className="text-xs text-[#888]">
                  Status: {DELIVERY_STATUS_LABELS[selectedTask.current_status]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-[#888] hover:text-white p-1 cursor-pointer"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Customer & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
              <div className="space-y-1">
                <p className="text-[#888]">Customer</p>
                <p className="font-bold text-[#f5f5f5]">{selectedTask.customer_name}</p>
                <p className="text-[#ccc]">{selectedTask.customer_phone}</p>
                <p className="text-[#ababab]">{selectedTask.delivery_address}</p>
                {selectedTask.delivery_instructions && (
                  <p className="text-amber-400 italic">
                    Note: {selectedTask.delivery_instructions}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {selectedTask.customer_phone && (
                    <a
                      href={`tel:${selectedTask.customer_phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] text-[#f5f5f5]"
                    >
                      <FaPhoneAlt size={11} /> Call Customer
                    </a>
                  )}
                  {buildWhatsAppUrl(selectedTask.customer_phone) && (
                    <a
                      href={buildWhatsAppUrl(selectedTask.customer_phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400"
                    >
                      <FaWhatsapp size={12} /> WhatsApp
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    otpMutation.mutate({
                      deliveryId: selectedTask.id,
                      customerPhone: selectedTask.customer_phone,
                      customerName: selectedTask.customer_name,
                    })
                  }
                  disabled={otpMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-yellow-400/15 border border-yellow-400/40 text-yellow-400 font-semibold cursor-pointer"
                >
                  {otpMutation.isPending ? "Generating..." : "Send / Resend Delivery OTP"}
                </button>
              </div>
            </div>

            {/* Assign / Reassign Rider */}
            {!["delivered", "cancelled", "returned"].includes(selectedTask.current_status) && (
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
                <label className="block text-xs font-bold text-[#f5f5f5]">
                  <FaMotorcycle className="inline mr-1.5 text-yellow-400" />
                  {selectedTask.assigned_rider_id ? "Reassign Rider" : "Assign Rider"}
                </label>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedRiderId}
                    onChange={(e) => setSelectedRiderId(e.target.value)}
                    className="flex-1 bg-[#1f1f1f] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#f5f5f5]"
                  >
                    <option value="">-- Select Rider --</option>
                    {activeRiders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name} ({r.vehicle_type} • {r.availability_status})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedRiderId || assignMutation.isPending}
                    onClick={() =>
                      assignMutation.mutate({
                        deliveryId: selectedTask.id,
                        riderId: selectedRiderId,
                        isReassignment: Boolean(selectedTask.assigned_rider_id),
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <FaUserPlus className="inline mr-1" />
                    {selectedTask.assigned_rider_id ? "Reassign" : "Assign"}
                  </button>
                </div>
              </div>
            )}

            {/* Map Preview */}
            <DeliveryMap
              restaurant={{
                lat: settings?.restaurant_lat,
                lng: settings?.restaurant_lng,
                address: settings?.restaurant_address,
              }}
              destination={{
                lat: selectedTask.delivery_lat,
                lng: selectedTask.delivery_lng,
                address: selectedTask.delivery_address,
              }}
            />

            {/* Status / Failed Resolution Controls */}
            {!["delivered", "cancelled", "returned"].includes(selectedTask.current_status) && (
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-[#f5f5f5]">Dispatcher Actions</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.current_status === "failed" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          transitionMutation.mutate({
                            deliveryId: selectedTask.id,
                            newStatus: "pending_assignment",
                            reason: "Dispatcher scheduled retry",
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold cursor-pointer"
                      >
                        Retry Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          transitionMutation.mutate({
                            deliveryId: selectedTask.id,
                            newStatus: "returned",
                            reason: "Order returned to restaurant",
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        Mark Returned
                      </button>
                    </>
                  )}

                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason to cancel..."
                    className="flex-1 min-w-[160px] bg-[#1f1f1f] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5]"
                  />
                  <button
                    type="button"
                    disabled={!cancelReason.trim() || transitionMutation.isPending}
                    onClick={() =>
                      transitionMutation.mutate({
                        deliveryId: selectedTask.id,
                        newStatus: "cancelled",
                        reason: cancelReason.trim(),
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Cancel Delivery
                  </button>
                </div>
              </div>
            )}

            {/* Immutable Status Log */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#f5f5f5]">Delivery Status History</p>
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto text-xs">
                {taskLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-2 text-[#ababab]">
                    <span>
                      <strong className="text-[#f5f5f5]">
                        {DELIVERY_STATUS_LABELS[log.new_status] || log.new_status}
                      </strong>{" "}
                      ({log.actor_role}) {log.reason ? `• ${log.reason}` : ""}
                    </span>
                    <span className="text-[10px] text-[#777] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchBoard;

