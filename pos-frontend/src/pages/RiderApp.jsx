import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { enqueueSnackbar } from "notistack";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaHistory,
  FaHome,
  FaLocationArrow,
  FaMoneyBillWave,
  FaMotorcycle,
  FaPhoneAlt,
  FaSyncAlt,
  FaUser,
  FaWhatsapp,
  FaWifi,
} from "react-icons/fa";
import {
  generateDeliveryOtp,
  getDeliveryCollections,
  getDeliverySettings,
  getDeliveryTasks,
  getMyRiderProfile,
  getOfflineDeliveryActions,
  getRiderSettlements,
  recordDeliveryCollection,
  recordRiderLocation,
  reportDeliveryIncident,
  submitRiderSettlement,
  syncOfflineDeliveryActions,
  transitionDeliveryStatus,
  updateRiderAvailability,
  uploadDeliveryEvidencePhoto,
  verifyDeliveryOtp,
} from "../https/deliveryApi";
import {
  buildWhatsAppUrl,
  DELIVERY_STATUS_LABELS,
  FAILURE_REASONS,
} from "../utils/deliveryZones";
import DeliveryMap from "../components/shared/DeliveryMap";

const RIDER_TABS = [
  { id: "home", label: "Home", icon: <FaHome size={18} /> },
  { id: "deliveries", label: "Deliveries", icon: <FaMotorcycle size={18} /> },
  { id: "history", label: "History", icon: <FaHistory size={18} /> },
  { id: "settlements", label: "Settle", icon: <FaMoneyBillWave size={18} /> },
  { id: "profile", label: "Profile", icon: <FaUser size={18} /> },
];

const RiderApp = () => {
  const queryClient = useQueryClient();
  const userData = useSelector((state) => state.user);
  const userId = userData._id || userData.id;

  const [tab, setTab] = useState("home");
  const [selectedTask, setSelectedTask] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [failReason, setFailReason] = useState(FAILURE_REASONS[0]);
  const [failNotes, setFailNotes] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [podFile, setPodFile] = useState(null);
  const [collectionMethod, setCollectionMethod] = useState("Cash");
  const [collectionRef, setCollectionRef] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("Off");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineOps, setOfflineOps] = useState(() => getOfflineDeliveryActions());

  useEffect(() => {
    document.title = "Sideways Grillz | Rider App";
    const onOnline = async () => {
      setIsOnline(true);
      const res = await syncOfflineDeliveryActions();
      if (res.synced > 0) {
        enqueueSnackbar(`Synced ${res.synced} queued delivery action(s)!`, { variant: "success" });
        queryClient.invalidateQueries({ queryKey: ["rider-tasks"] });
      }
      if (res.conflicts > 0) {
        enqueueSnackbar(`${res.conflicts} offline action(s) flagged for review.`, { variant: "warning" });
      }
      setOfflineOps(getOfflineDeliveryActions());
    };
    const onOffline = () => setIsOnline(false);
    const onQueueUpdate = () => setOfflineOps(getOfflineDeliveryActions());

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("delivery-offline-queue-updated", onQueueUpdate);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("delivery-offline-queue-updated", onQueueUpdate);
    };
  }, [queryClient]);

  const { data: riderProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ["my-rider-profile", userId],
    queryFn: () => getMyRiderProfile(userId),
    enabled: Boolean(userId),
  });

  const { data: settings } = useQuery({
    queryKey: ["delivery-settings"],
    queryFn: getDeliverySettings,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["rider-tasks", riderProfile?.id],
    queryFn: () => getDeliveryTasks({ riderId: riderProfile.id }),
    enabled: Boolean(riderProfile?.id),
    refetchInterval: 20000,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["rider-collections", riderProfile?.id],
    queryFn: () => getDeliveryCollections({ riderId: riderProfile.id }),
    enabled: Boolean(riderProfile?.id),
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ["my-rider-settlements", riderProfile?.id],
    queryFn: () => getRiderSettlements({ riderId: riderProfile.id }),
    enabled: Boolean(riderProfile?.id),
  });

  const activeTasks = useMemo(
    () =>
      tasks.filter((t) =>
        [
          "assigned",
          "accepted",
          "arrived_at_restaurant",
          "picked_up",
          "out_for_delivery",
        ].includes(t.current_status)
      ),
    [tasks]
  );

  const completedToday = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.current_status === "delivered" &&
          new Date(t.completed_at || t.updated_at).toDateString() === new Date().toDateString()
      ),
    [tasks]
  );

  const outstandingCash = useMemo(
    () =>
      collections
        .filter((c) => c.collection_method === "Cash" && c.collection_status === "collected")
        .reduce((sum, c) => sum + Number(c.amount || 0), 0),
    [collections]
  );

  // Foreground GPS Sharing while rider app is active & GPS toggle is enabled
  useEffect(() => {
    if (!gpsEnabled || !riderProfile?.id) {
      setGpsStatus("Off");
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus("GPS Unsupported");
      return;
    }

    const activeDeliveryId = activeTasks[0]?.id || null;
    const intervalMs = Math.max(10, Number(settings?.location_update_interval_sec || 20)) * 1000;

    const pushLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsStatus("Live");
          recordRiderLocation({
            riderId: riderProfile.id,
            deliveryId: activeDeliveryId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }).catch(() => {});
        },
        () => {
          setGpsStatus("Permission Denied / Unavailable");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    pushLocation();
    const timer = setInterval(pushLocation, intervalMs);
    return () => clearInterval(timer);
  }, [gpsEnabled, riderProfile?.id, activeTasks, settings?.location_update_interval_sec]);

  const availabilityMutation = useMutation({
    mutationFn: (status) => updateRiderAvailability(riderProfile.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-rider-profile", userId] });
      enqueueSnackbar("Availability updated", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err?.message || "Update failed", { variant: "error" }),
  });

  const transitionMutation = useMutation({
    mutationFn: transitionDeliveryStatus,
    onSuccess: (res) => {
      if (res?.offline) {
        enqueueSnackbar("Offline: Action queued and will sync automatically.", { variant: "info" });
      } else {
        enqueueSnackbar("Delivery updated!", { variant: "success" });
      }
      queryClient.invalidateQueries({ queryKey: ["rider-tasks"] });
      setRejectReason("");
      setFailNotes("");
      setSelectedTask(null);
    },
    onError: (err) => enqueueSnackbar(err?.message || "Action failed", { variant: "error" }),
  });

  const otpRequestMutation = useMutation({
    mutationFn: generateDeliveryOtp,
    onSuccess: () => enqueueSnackbar("OTP sent to customer!", { variant: "success" }),
    onError: (err) => enqueueSnackbar(err?.message || "Failed to send OTP", { variant: "error" }),
  });

  const verifyPodMutation = useMutation({
    mutationFn: async ({ deliveryId, otp, file }) => {
      let photoPath = null;
      if (file) {
        photoPath = await uploadDeliveryEvidencePhoto({ deliveryId, file });
      }
      return verifyDeliveryOtp({ deliveryId, otp, photoPath });
    },
    onSuccess: () => {
      enqueueSnackbar("Delivery verified and completed!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["rider-tasks"] });
      setOtpInput("");
      setPodFile(null);
      setSelectedTask(null);
    },
    onError: (err) => enqueueSnackbar(err?.message || "OTP verification failed", { variant: "error" }),
  });

  const collectionMutation = useMutation({
    mutationFn: recordDeliveryCollection,
    onSuccess: () => {
      enqueueSnackbar("Collection recorded!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["rider-collections"] });
      setCollectionRef("");
    },
    onError: (err) => enqueueSnackbar(err?.message || "Collection failed", { variant: "error" }),
  });

  const settlementMutation = useMutation({
    mutationFn: submitRiderSettlement,
    onSuccess: () => {
      enqueueSnackbar("Shift settlement submitted for manager review!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["my-rider-settlements"] });
      setDeclaredAmount("");
      setSettlementNotes("");
    },
    onError: (err) => enqueueSnackbar(err?.message || "Submission failed", { variant: "error" }),
  });

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-[#f5f5f5] flex items-center justify-center p-6">
        Loading rider profile...
      </div>
    );
  }

  if (!riderProfile) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-[#f5f5f5] flex items-center justify-center p-6">
        <div className="max-w-md bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 text-center space-y-2">
          <FaMotorcycle className="mx-auto text-yellow-400" size={32} />
          <h1 className="text-lg font-bold">Rider Profile Not Found</h1>
          <p className="text-xs text-[#ababab]">
            Your account is not yet linked to an active delivery rider profile. Ask your Administrator to create your rider profile in Admin → Delivery → Riders.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#1f1f1f] text-[#f5f5f5] pb-24">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Offline & Sync Bar */}
        {(!isOnline || offlineOps.length > 0) && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-amber-300 font-semibold">
              <FaWifi />
              {!isOnline
                ? `Offline Mode • ${offlineOps.length} queued action(s)`
                : `${offlineOps.length} queued action(s) pending`}
            </span>
            {isOnline && (
              <button
                type="button"
                onClick={() => syncOfflineDeliveryActions()}
                className="px-2.5 py-1 rounded bg-amber-400 text-black font-bold cursor-pointer"
              >
                <FaSyncAlt className="inline mr-1" /> Sync
              </button>
            )}
          </div>
        )}

        {/* HOME TAB */}
        {tab === "home" && (
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[#888]">Welcome back,</p>
                  <h1 className="text-xl font-bold text-yellow-400">{riderProfile.full_name}</h1>
                  <p className="text-[11px] text-[#ababab]">{riderProfile.rider_code}</p>
                </div>
                <button
                  type="button"
                  disabled={activeTasks.length > 0 || availabilityMutation.isPending}
                  onClick={() =>
                    availabilityMutation.mutate(
                      riderProfile.availability_status === "available" ? "offline" : "available"
                    )
                  }
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                    riderProfile.availability_status === "available"
                      ? "bg-emerald-500 text-black"
                      : riderProfile.availability_status === "busy"
                      ? "bg-amber-500 text-black"
                      : "bg-[#262626] text-[#ccc] border border-[#333]"
                  }`}
                >
                  {riderProfile.availability_status.toUpperCase()}
                </button>
              </div>

              <div className="flex items-center justify-between bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 text-xs">
                <span className="flex items-center gap-2">
                  <FaLocationArrow className={gpsStatus === "Live" ? "text-emerald-400" : "text-[#888]"} />
                  GPS Sharing: <strong>{gpsStatus}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setGpsEnabled((p) => !p)}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    gpsEnabled ? "bg-emerald-600 text-white" : "bg-[#262626] text-[#ccc]"
                  }`}
                >
                  {gpsEnabled ? "Turn Off" : "Enable GPS"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4">
                <p className="text-xs text-[#888]">Active Deliveries</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{activeTasks.length}</p>
              </div>
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4">
                <p className="text-xs text-[#888]">Completed Today</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{completedToday.length}</p>
              </div>
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 col-span-2">
                <p className="text-xs text-[#888]">Outstanding Cash Settlement</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">
                  GH₵ {outstandingCash.toFixed(2)}
                </p>
              </div>
            </div>

            {activeTasks[0] && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTask(activeTasks[0]);
                  setTab("deliveries");
                }}
                className="w-full py-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm cursor-pointer shadow-lg"
              >
                Open Current Delivery (#{String(activeTasks[0].order_id).slice(0, 8).toUpperCase()})
              </button>
            )}
          </div>
        )}

        {/* DELIVERIES TAB */}
        {tab === "deliveries" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold">My Active Deliveries ({activeTasks.length})</h2>
            {activeTasks.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-8 text-center text-xs text-[#888]">
                No active deliveries assigned right now.
              </div>
            ) : (
              activeTasks.map((task) => {
                const orderTotal = Number(
                  task.orders?.bills?.totalWithTax ?? task.orders?.bills?.total ?? 0
                );
                const isCash = (task.orders?.payment_method || "Cash") === "Cash";
                const waUrl = buildWhatsAppUrl(task.customer_phone);

                return (
                  <div
                    key={task.id}
                    className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-yellow-400">
                        #{String(task.order_id).slice(0, 8).toUpperCase()}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#262626] text-xs font-semibold">
                        {DELIVERY_STATUS_LABELS[task.current_status]}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="font-bold text-sm">{task.customer_name}</p>
                      <p className="text-[#ccc]">{task.delivery_address}</p>
                      {task.delivery_instructions && (
                        <p className="text-amber-400">Note: {task.delivery_instructions}</p>
                      )}
                      <p className="text-emerald-400 font-bold pt-1">
                        {isCash ? `Collect Cash: GH₵ ${orderTotal.toFixed(2)}` : "Paid Online (Paystack)"} • Fee: GH₵ {Number(task.delivery_fee || 0).toFixed(2)}
                      </p>
                    </div>

                    {/* Contact Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      {task.customer_phone && (
                        <a
                          href={`tel:${task.customer_phone}`}
                          className="py-3 rounded-xl bg-[#262626] text-center text-xs font-bold flex items-center justify-center gap-2"
                        >
                          <FaPhoneAlt /> Call Customer
                        </a>
                      )}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="py-3 rounded-xl bg-emerald-600/20 text-emerald-400 text-center text-xs font-bold flex items-center justify-center gap-2"
                        >
                          <FaWhatsapp size={15} /> WhatsApp
                        </a>
                      )}
                    </div>

                    <DeliveryMap
                      heightClass="h-40"
                      restaurant={{
                        lat: settings?.restaurant_lat,
                        lng: settings?.restaurant_lng,
                        address: settings?.restaurant_address,
                      }}
                      destination={{
                        lat: task.delivery_lat,
                        lng: task.delivery_lng,
                        address: task.delivery_address,
                      }}
                    />

                    {/* Workflow Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
                      {task.current_status === "assigned" && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() =>
                              transitionMutation.mutate({
                                deliveryId: task.id,
                                newStatus: "accepted",
                                actorId: userId,
                              })
                            }
                            className="w-full py-3.5 rounded-xl bg-emerald-500 text-black font-bold text-sm cursor-pointer"
                          >
                            Accept Assignment
                          </button>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason to reject..."
                              className="flex-1 bg-[#141414] border border-[#333] rounded-xl px-3 py-2 text-xs"
                            />
                            <button
                              type="button"
                              disabled={!rejectReason.trim()}
                              onClick={() =>
                                transitionMutation.mutate({
                                  deliveryId: task.id,
                                  newStatus: "rejected",
                                  reason: rejectReason.trim(),
                                  actorId: userId,
                                })
                              }
                              className="px-4 py-2 rounded-xl bg-red-600/80 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}

                      {["accepted", "ready_for_pickup"].includes(task.current_status) && (
                        <button
                          type="button"
                          onClick={() =>
                            transitionMutation.mutate({
                              deliveryId: task.id,
                              newStatus: "arrived_at_restaurant",
                              actorId: userId,
                            })
                          }
                          className="w-full py-3.5 rounded-xl bg-yellow-400 text-black font-bold text-sm cursor-pointer"
                        >
                          Confirm Arrival at Restaurant
                        </button>
                      )}

                      {task.current_status === "arrived_at_restaurant" && (
                        <button
                          type="button"
                          onClick={() =>
                            transitionMutation.mutate({
                              deliveryId: task.id,
                              newStatus: "picked_up",
                              actorId: userId,
                              customerPhone: task.customer_phone,
                              customerName: task.customer_name,
                            })
                          }
                          className="w-full py-3.5 rounded-xl bg-yellow-400 text-black font-bold text-sm cursor-pointer"
                        >
                          Confirm Order Pickup
                        </button>
                      )}

                      {task.current_status === "picked_up" && (
                        <button
                          type="button"
                          onClick={() =>
                            transitionMutation.mutate({
                              deliveryId: task.id,
                              newStatus: "out_for_delivery",
                              actorId: userId,
                              customerPhone: task.customer_phone,
                              customerName: task.customer_name,
                            })
                          }
                          className="w-full py-3.5 rounded-xl bg-blue-500 text-white font-bold text-sm cursor-pointer"
                        >
                          Start Delivery (Out for Delivery)
                        </button>
                      )}

                      {task.current_status === "out_for_delivery" && (
                        <div className="space-y-3 bg-[#141414] border border-[#2a2a2a] rounded-xl p-3">
                          {isCash && (
                            <div className="space-y-2 border-b border-[#2a2a2a] pb-3">
                              <p className="text-xs font-bold text-yellow-400">
                                1. Record Payment Collection (GH₵ {orderTotal.toFixed(2)})
                              </p>
                              <div className="flex gap-2">
                                <select
                                  value={collectionMethod}
                                  onChange={(e) => setCollectionMethod(e.target.value)}
                                  className="bg-[#1f1f1f] border border-[#333] rounded-lg px-2 py-2 text-xs"
                                >
                                  <option value="Cash">Cash</option>
                                  <option value="MoMo">MoMo</option>
                                </select>
                                <input
                                  type="text"
                                  value={collectionRef}
                                  onChange={(e) => setCollectionRef(e.target.value)}
                                  placeholder="MoMo Ref (if MoMo)"
                                  className="flex-1 bg-[#1f1f1f] border border-[#333] rounded-lg px-2 py-2 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    collectionMutation.mutate({
                                      delivery_id: task.id,
                                      rider_id: riderProfile.id,
                                      order_amount_due: orderTotal,
                                      delivery_fee: task.delivery_fee || 0,
                                      amount: orderTotal,
                                      collection_method: collectionMethod,
                                      payment_reference: collectionRef || null,
                                      collection_status: "collected",
                                    })
                                  }
                                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                                >
                                  Record
                                </button>
                              </div>
                            </div>
                          )}

                          <p className="text-xs font-bold text-emerald-400">
                            Confirm Delivery (Customer OTP)
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              otpRequestMutation.mutate({
                                deliveryId: task.id,
                                customerPhone: task.customer_phone,
                                customerName: task.customer_name,
                              })
                            }
                            className="w-full py-2 rounded-lg bg-[#262626] text-xs font-semibold cursor-pointer"
                          >
                            Send / Resend OTP to Customer
                          </button>

                          <input
                            type="text"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            placeholder="Enter 6-digit Customer OTP"
                            className="w-full bg-[#1f1f1f] border border-[#333] rounded-xl px-3 py-2.5 text-sm text-center tracking-widest font-bold"
                          />

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => setPodFile(e.target.files?.[0] || null)}
                            className="w-full text-[11px] text-[#ababab]"
                          />

                          <button
                            type="button"
                            disabled={!otpInput.trim() || verifyPodMutation.isPending || !isOnline}
                            onClick={() =>
                              verifyPodMutation.mutate({
                                deliveryId: task.id,
                                otp: otpInput.trim(),
                                file: podFile,
                              })
                            }
                            className="w-full py-3.5 rounded-xl bg-emerald-500 text-black font-bold text-sm cursor-pointer disabled:opacity-50"
                          >
                            <FaCheckCircle className="inline mr-1.5" />
                            {verifyPodMutation.isPending
                              ? "Verifying..."
                              : "Verify OTP & Complete Delivery"}
                          </button>

                          {/* Failed Delivery Report */}
                          <div className="pt-2 border-t border-[#2a2a2a] space-y-2">
                            <p className="text-[11px] font-bold text-red-400">
                              <FaExclamationTriangle className="inline mr-1" />
                              Unable to Deliver?
                            </p>
                            <select
                              value={failReason}
                              onChange={(e) => setFailReason(e.target.value)}
                              className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg px-2 py-2 text-xs"
                            >
                              {FAILURE_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={failNotes}
                              onChange={(e) => setFailNotes(e.target.value)}
                              placeholder="Failure notes..."
                              className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg px-2 py-2 text-xs"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await reportDeliveryIncident({
                                  delivery_id: task.id,
                                  rider_id: riderProfile.id,
                                  incident_type: failReason,
                                  description: failNotes || failReason,
                                });
                                transitionMutation.mutate({
                                  deliveryId: task.id,
                                  newStatus: "failed",
                                  reason: `${failReason}${failNotes ? `: ${failNotes}` : ""}`,
                                  actorId: userId,
                                  customerPhone: task.customer_phone,
                                  customerName: task.customer_name,
                                });
                              }}
                              className="w-full py-2.5 rounded-xl bg-red-600/80 text-white text-xs font-bold cursor-pointer"
                            >
                              Report Failed Delivery
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="space-y-3">
            <h2 className="text-base font-bold">Delivery History ({tasks.length})</h2>
            {tasks.map((t) => (
              <div
                key={t.id}
                className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-yellow-400">
                    #{String(t.order_id).slice(0, 8).toUpperCase()} • {t.customer_name}
                  </p>
                  <p className="text-[#ababab]">{t.delivery_address}</p>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#262626] font-semibold">
                  {DELIVERY_STATUS_LABELS[t.current_status]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* SETTLEMENTS TAB */}
        {tab === "settlements" && (
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3">
              <h2 className="text-base font-bold">End-of-Shift Cash Settlement</h2>
              <p className="text-xs text-[#ababab]">
                Expected Outstanding Cash:{" "}
                <strong className="text-yellow-400">GH₵ {outstandingCash.toFixed(2)}</strong>
              </p>
              <input
                type="number"
                step="0.01"
                placeholder="Declared Cash Amount (GH₵)"
                value={declaredAmount}
                onChange={(e) => setDeclaredAmount(e.target.value)}
                className="w-full rounded-xl p-3 bg-[#141414] border border-[#333] text-sm"
              />
              <textarea
                rows={2}
                placeholder="Notes (required if declared differs from expected)"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                className="w-full rounded-xl p-3 bg-[#141414] border border-[#333] text-xs"
              />
              <button
                type="button"
                disabled={!declaredAmount || settlementMutation.isPending}
                onClick={() =>
                  settlementMutation.mutate({
                    riderId: riderProfile.id,
                    expectedAmount: outstandingCash,
                    declaredAmount: Number(declaredAmount),
                    notes: settlementNotes,
                  })
                }
                className="w-full py-3 rounded-xl bg-yellow-400 text-black font-bold text-sm cursor-pointer disabled:opacity-50"
              >
                {settlementMutation.isPending ? "Submitting..." : "Submit Shift Settlement"}
              </button>
            </div>

            <div className="space-y-2">
              {settlements.map((s) => (
                <div
                  key={s.id}
                  className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-3 text-xs flex justify-between"
                >
                  <div>
                    <p className="font-bold text-yellow-400">{s.settlement_reference}</p>
                    <p className="text-[#888]">{s.shift_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">GH₵ {Number(s.declared_amount).toFixed(2)}</p>
                    <p className="text-[10px] uppercase text-[#ababab]">{s.settlement_status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === "profile" && (
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-2 text-xs">
            <h2 className="text-base font-bold text-yellow-400">{riderProfile.full_name}</h2>
            <p>Rider ID: {riderProfile.rider_code}</p>
            <p>Phone: {riderProfile.phone}</p>
            <p className="capitalize">
              Vehicle: {riderProfile.vehicle_type} {riderProfile.vehicle_registration || ""}
            </p>
            <p className="capitalize">Account Status: {riderProfile.account_status}</p>
          </div>
        )}
      </div>

      {/* Mobile-First Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#262626] border-t border-[#333] h-16 flex items-center justify-around px-2 z-40">
        {RIDER_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
              tab === item.id ? "text-yellow-400 bg-[#343434]" : "text-[#ababab]"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RiderApp;

