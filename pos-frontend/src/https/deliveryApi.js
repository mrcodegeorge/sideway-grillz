import { supabase } from "../supabase/client";
import { adminCreateUser } from "./index";
import { generateSecureToken, sha256Hex } from "../utils/deliveryZones";
import { getSettingsSync } from "../utils/settingsStorage";
import { logAuditEvent } from "../utils/auditStorage";

const OFFLINE_DELIVERY_ACTIONS_KEY = "sideways_offline_delivery_actions";
const RIDER_TASKS_CACHE_KEY = "sideways_cached_rider_tasks";

// ============================================================================
// Offline Queue for Rider Actions (Idempotent, Never Bypasses OTP/Financials)
// ============================================================================
export const getOfflineDeliveryActions = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_DELIVERY_ACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const queueOfflineDeliveryAction = ({ deliveryId, actorId, actionType, newStatus, reason }) => {
  const existing = getOfflineDeliveryActions();
  const op = {
    operationId: `delop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deliveryId,
    actorId: actorId || null,
    actionType,
    newStatus,
    reason: reason || null,
    clientTimestamp: new Date().toISOString(),
    syncStatus: "pending",
    conflictError: null,
  };
  localStorage.setItem(OFFLINE_DELIVERY_ACTIONS_KEY, JSON.stringify([...existing, op]));
  window.dispatchEvent(new Event("delivery-offline-queue-updated"));
  return op;
};

export const setCachedRiderTasks = (tasks) => {
  try {
    localStorage.setItem(RIDER_TASKS_CACHE_KEY, JSON.stringify(tasks || []));
  } catch {
    // ignore quota errors
  }
};

export const getCachedRiderTasks = () => {
  try {
    const raw = localStorage.getItem(RIDER_TASKS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const syncOfflineDeliveryActions = async () => {
  const queue = getOfflineDeliveryActions();
  if (!queue.length || !navigator.onLine) return { synced: 0, conflicts: 0 };

  let synced = 0;
  let conflicts = 0;
  const remaining = [];

  for (const op of queue) {
    if (op.syncStatus === "conflict") {
      remaining.push(op);
      continue;
    }
    try {
      const { error } = await supabase.rpc("transition_delivery_status", {
        p_delivery_id: op.deliveryId,
        p_new_status: op.newStatus,
        p_reason: op.reason,
        p_operation_id: op.operationId,
      });
      if (error) throw error;
      synced++;
    } catch (err) {
      conflicts++;
      remaining.push({
        ...op,
        syncStatus: "conflict",
        conflictError: err?.message || "Sync conflict",
      });
    }
  }

  localStorage.setItem(OFFLINE_DELIVERY_ACTIONS_KEY, JSON.stringify(remaining));
  window.dispatchEvent(new Event("delivery-offline-queue-updated"));
  return { synced, conflicts };
};

// ============================================================================
// Delivery Settings
// ============================================================================
export const getDeliverySettings = async () => {
  const { data, error } = await supabase
    .from("delivery_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (
    data || {
      id: 1,
      assignment_policy: "rider_accept",
      multi_order_enabled: false,
      require_otp_pod: true,
      require_photo_pod: false,
      otp_expiry_minutes: 30,
      location_update_interval_sec: 20,
      restaurant_name: "Sideways Grillz",
      restaurant_phone: "",
      restaurant_address: "Accra, Ghana",
      restaurant_lat: 5.6037,
      restaurant_lng: -0.187,
      map_provider: "openstreetmap",
    }
  );
};

export const updateDeliverySettings = async (updates) => {
  const { data, error } = await supabase
    .from("delivery_settings")
    .upsert({ id: 1, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  logAuditEvent({
    action: "DELIVERY_SETTINGS_UPDATED",
    entityType: "Settings",
    entityId: "delivery_settings",
    details: "Updated delivery module configuration",
  });
  return data;
};

// ============================================================================
// Delivery Zones
// ============================================================================
export const getDeliveryZones = async () => {
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const saveDeliveryZone = async (zone) => {
  const payload = {
    name: zone.name.trim(),
    description: zone.description || "",
    fee: Number(zone.fee || 0),
    minimum_order_amount: Number(zone.minimum_order_amount || 0),
    estimated_delivery_minutes: Number(zone.estimated_delivery_minutes || 35),
    coverage_type: zone.coverage_type || "neighborhoods",
    coverage_data: zone.coverage_data || { neighborhoods: [] },
    free_delivery_threshold:
      zone.free_delivery_threshold !== "" && zone.free_delivery_threshold != null
        ? Number(zone.free_delivery_threshold)
        : null,
    priority: Number(zone.priority || 10),
    is_active: zone.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const query = zone.id
    ? supabase.from("delivery_zones").update(payload).eq("id", zone.id).select().single()
    : supabase.from("delivery_zones").insert(payload).select().single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const deleteDeliveryZone = async (id) => {
  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) throw error;
  return true;
};

// ============================================================================
// Riders Management
// ============================================================================
export const getRiders = async () => {
  const { data, error } = await supabase
    .from("riders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getMyRiderProfile = async (userId) => {
  const { data, error } = await supabase
    .from("riders")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createRiderAccount = async ({
  full_name,
  username,
  phone,
  email,
  pin,
  vehicle_type,
  vehicle_registration,
  emergency_contact,
  profile_photo,
}) => {
  const created = await adminCreateUser({
    name: full_name,
    username,
    phone,
    role: "rider",
    pin,
  });

  const userId = created?.data?.data?.id || created?.data?.data?._id;
  const riderCode = `RDR-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("riders")
    .insert({
      user_id: userId,
      rider_code: riderCode,
      full_name: full_name.trim(),
      phone: phone.trim(),
      email: email || null,
      profile_photo: profile_photo || null,
      emergency_contact: emergency_contact || null,
      vehicle_type: vehicle_type || "motorcycle",
      vehicle_registration: vehicle_registration || null,
      availability_status: "offline",
      employment_status: "active",
      account_status: "active",
    })
    .select()
    .single();

  if (error) throw error;

  logAuditEvent({
    action: "RIDER_CREATED",
    entityType: "User",
    entityId: data.id,
    details: `Created rider account ${data.full_name} (${data.rider_code})`,
  });

  return data;
};

export const updateRiderProfile = async (riderId, updates) => {
  const { data, error } = await supabase
    .from("riders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", riderId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateRiderAvailability = async (riderId, availabilityStatus) => {
  const { data, error } = await supabase
    .from("riders")
    .update({ availability_status: availabilityStatus, updated_at: new Date().toISOString() })
    .eq("id", riderId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ============================================================================
// Notifications (Queue + Edge Function Dispatch, Never Fails Order)
// ============================================================================
export const queueDeliveryNotification = async ({
  deliveryId,
  eventType,
  recipient,
  message,
  channel = "sms",
  idempotencyKey = null,
}) => {
  if (!recipient || !message) return;
  try {
    const key = idempotencyKey || `${deliveryId || "gen"}_${eventType}_${channel}_${Date.now()}`;
    const { data: notif, error } = await supabase
      .from("delivery_notifications")
      .insert({
        delivery_id: deliveryId || null,
        event_type: eventType,
        channel,
        recipient,
        message,
        idempotency_key: key,
        status: "pending",
      })
      .select()
      .single();

    if (error) return;

    const settings = getSettingsSync();
    if (channel === "sms" && settings.smsEnabled && settings.smsApiKey) {
      const { error: fnErr } = await supabase.functions.invoke("send-sms", {
        body: {
          provider: settings.smsProvider,
          senderId: settings.smsSenderId,
          apiKey: settings.smsApiKey,
          apiSecret: settings.smsApiSecret,
          to: recipient,
          message,
        },
      });
      await supabase
        .from("delivery_notifications")
        .update({
          status: fnErr ? "failed" : "sent",
          attempts: 1,
          last_error: fnErr ? fnErr.message : null,
          sent_at: fnErr ? null : new Date().toISOString(),
        })
        .eq("id", notif.id);
    } else {
      await supabase
        .from("delivery_notifications")
        .update({ status: "skipped", last_error: "SMS provider not enabled in Settings" })
        .eq("id", notif.id);
    }
  } catch {
    // Notification failure must never roll back a delivery operation
  }
};

// ============================================================================
// Delivery Tasks, Assignments & Transitions
// ============================================================================
export const createDeliveryTaskForOrder = async ({
  orderId,
  zoneId = null,
  customerName,
  customerPhone,
  deliveryAddress,
  deliveryInstructions = "",
  deliveryFee = 0,
  originalFee = 0,
  feeOverrideReason = null,
  estimatedMinutes = 35,
}) => {
  const rawToken = generateSecureToken();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const estimatedAt = new Date(Date.now() + Number(estimatedMinutes || 35) * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("delivery_tasks")
    .insert({
      order_id: orderId,
      zone_id: zoneId || null,
      customer_name: customerName || "",
      customer_phone: customerPhone || "",
      delivery_address: deliveryAddress || "Accra",
      delivery_instructions: deliveryInstructions || "",
      delivery_fee: Number(deliveryFee || 0),
      original_fee: Number(originalFee || deliveryFee || 0),
      fee_override_reason: feeOverrideReason || null,
      estimated_delivery_at: estimatedAt,
      current_status: "pending_assignment",
      tracking_token_hash: tokenHash,
      tracking_token_expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("delivery_status_logs").insert({
    delivery_id: data.id,
    previous_status: null,
    new_status: "pending_assignment",
    actor_role: "cashier",
    reason: "Delivery order created",
  });

  const trackingUrl = `${window.location.origin}/track/${rawToken}`;
  queueDeliveryNotification({
    deliveryId: data.id,
    eventType: "delivery_confirmed",
    recipient: customerPhone,
    message: `Hi ${customerName || "Customer"}, your Sideways Grillz delivery order #${String(orderId).slice(0, 8).toUpperCase()} is confirmed! Track here: ${trackingUrl}`,
    idempotencyKey: `confirmed_${data.id}`,
  });

  return { task: data, trackingToken: rawToken, trackingUrl };
};

export const getDeliveryTasks = async ({ riderId = null } = {}) => {
  if (!navigator.onLine && riderId) {
    return getCachedRiderTasks();
  }

  let query = supabase
    .from("delivery_tasks")
    .select(`
      *,
      orders:order_id (
        id,
        order_status,
        order_date,
        bills,
        items,
        payment_method,
        payment_data,
        waiter_name
      ),
      riders:assigned_rider_id (
        id,
        full_name,
        phone,
        vehicle_type,
        rider_code,
        availability_status
      ),
      delivery_zones:zone_id (
        id,
        name,
        estimated_delivery_minutes
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (riderId) {
    query = query.eq("assigned_rider_id", riderId);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (riderId && data) {
    setCachedRiderTasks(data);
  }
  return data || [];
};

export const getDeliveryTaskLogs = async (deliveryId) => {
  const { data, error } = await supabase
    .from("delivery_status_logs")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const assignDeliveryRider = async ({ deliveryId, riderId, isReassignment = false }) => {
  const { data, error } = await supabase.rpc("assign_delivery_rider", {
    p_delivery_id: deliveryId,
    p_rider_id: riderId,
    p_is_reassignment: isReassignment,
  });
  if (error) throw error;
  logAuditEvent({
    action: isReassignment ? "DELIVERY_REASSIGNED" : "DELIVERY_ASSIGNED",
    entityType: "Order",
    entityId: deliveryId,
    details: `${isReassignment ? "Reassigned" : "Assigned"} delivery ${String(deliveryId).slice(0, 8)} to rider ${riderId}`,
  });
  return data;
};

export const transitionDeliveryStatus = async ({
  deliveryId,
  newStatus,
  reason = null,
  actorId = null,
  customerPhone = null,
  customerName = null,
}) => {
  if (!navigator.onLine) {
    const offlineAllowed = ["accepted", "arrived_at_restaurant", "picked_up", "out_for_delivery"];
    if (!offlineAllowed.includes(newStatus)) {
      throw new Error("Internet connection is required for this delivery action.");
    }
    return {
      offline: true,
      queued: queueOfflineDeliveryAction({
        deliveryId,
        actorId,
        actionType: "status_transition",
        newStatus,
        reason,
      }),
    };
  }

  const opId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabase.rpc("transition_delivery_status", {
    p_delivery_id: deliveryId,
    p_new_status: newStatus,
    p_reason: reason,
    p_operation_id: opId,
  });
  if (error) throw error;

  if (customerPhone && ["picked_up", "out_for_delivery", "delivered", "failed"].includes(newStatus)) {
    const msgMap = {
      picked_up: `Hi ${customerName || "there"}, your Sideways Grillz rider has picked up your order!`,
      out_for_delivery: `Hi ${customerName || "there"}, your Sideways Grillz order is out for delivery!`,
      delivered: `Your Sideways Grillz order has been delivered. Enjoy your meal!`,
      failed: `We attempted to deliver your Sideways Grillz order (${reason || "Delivery issue"}). Please contact us.`,
    };
    queueDeliveryNotification({
      deliveryId,
      eventType: `delivery_${newStatus}`,
      recipient: customerPhone,
      message: msgMap[newStatus],
      idempotencyKey: `${deliveryId}_${newStatus}`,
    });
  }

  return data;
};

// ============================================================================
// Proof of Delivery (OTP & Private Photo Evidence)
// ============================================================================
export const generateDeliveryOtp = async ({ deliveryId, customerPhone, customerName }) => {
  const { data, error } = await supabase.rpc("generate_delivery_otp", {
    p_delivery_id: deliveryId,
  });
  if (error) throw error;

  if (customerPhone && data?.otp) {
    await queueDeliveryNotification({
      deliveryId,
      eventType: "delivery_otp",
      recipient: customerPhone,
      message: `Hi ${customerName || "Customer"}, your Sideways Grillz delivery confirmation code is ${data.otp}. Share this code with your rider.`,
    });
  }
  return data;
};

export const verifyDeliveryOtp = async ({ deliveryId, otp, photoPath = null }) => {
  const { data, error } = await supabase.rpc("verify_delivery_otp", {
    p_delivery_id: deliveryId,
    p_otp: otp,
    p_photo_path: photoPath,
  });
  if (error) throw error;
  return data;
};

export const uploadDeliveryEvidencePhoto = async ({ deliveryId, file }) => {
  if (!file) throw new Error("No file selected");
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPG, PNG, or WebP images are allowed.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Photo size must be under 5MB.");
  }
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${deliveryId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from("delivery-evidence")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;
  return path;
};

// ============================================================================
// Rider GPS Location
// ============================================================================
export const recordRiderLocation = async ({ riderId, deliveryId = null, latitude, longitude, accuracy }) => {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return;
  }
  await supabase.from("rider_locations").insert({
    rider_id: riderId,
    delivery_id: deliveryId,
    latitude,
    longitude,
    accuracy: accuracy || null,
  });
  await supabase
    .from("riders")
    .update({ last_location_at: new Date().toISOString() })
    .eq("id", riderId);
};

// ============================================================================
// Collections, Settlements & Incidents
// ============================================================================
export const getDeliveryCollections = async ({ riderId = null } = {}) => {
  let query = supabase
    .from("delivery_collections")
    .select("*, riders:rider_id(full_name, rider_code)")
    .order("created_at", { ascending: false });
  if (riderId) query = query.eq("rider_id", riderId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const recordDeliveryCollection = async (payload) => {
  const { data, error } = await supabase
    .from("delivery_collections")
    .insert({
      ...payload,
      operation_id: payload.operation_id || `col_${payload.delivery_id}_${Date.now()}`,
      collected_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const verifyDeliveryCollection = async (collectionId, status = "verified") => {
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("delivery_collections")
    .update({
      collection_status: status,
      verified_by: auth?.session?.user?.id || null,
      verified_at: new Date().toISOString(),
    })
    .eq("id", collectionId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getRiderSettlements = async ({ riderId = null } = {}) => {
  let query = supabase
    .from("rider_settlements")
    .select("*, riders:rider_id(full_name, rider_code)")
    .order("created_at", { ascending: false });
  if (riderId) query = query.eq("rider_id", riderId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const submitRiderSettlement = async ({
  riderId,
  expectedAmount,
  declaredAmount,
  paymentMethod = "Cash",
  notes = "",
}) => {
  const discrepancy = Number(declaredAmount) - Number(expectedAmount);
  if (Math.abs(discrepancy) > 0.01 && !String(notes || "").trim()) {
    throw new Error("Please explain the discrepancy in the notes field.");
  }

  const ref = `STL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const { data, error } = await supabase
    .from("rider_settlements")
    .insert({
      rider_id: riderId,
      settlement_reference: ref,
      expected_amount: Number(expectedAmount),
      declared_amount: Number(declaredAmount),
      discrepancy_amount: discrepancy,
      payment_method: paymentMethod,
      settlement_status: Math.abs(discrepancy) > 0.01 ? "under_review" : "submitted",
      notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const reviewRiderSettlement = async ({
  settlementId,
  verifiedAmount,
  status,
  notes = "",
}) => {
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("rider_settlements")
    .update({
      verified_amount: Number(verifiedAmount),
      settlement_status: status,
      reviewed_by: auth?.session?.user?.id || null,
      reviewed_at: new Date().toISOString(),
      notes,
    })
    .eq("id", settlementId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getDeliveryIncidents = async () => {
  const { data, error } = await supabase
    .from("delivery_incidents")
    .select("*, riders:rider_id(full_name, rider_code)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

export const reportDeliveryIncident = async (payload) => {
  const { data, error } = await supabase
    .from("delivery_incidents")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const resolveDeliveryIncident = async ({ incidentId, status, resolution }) => {
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("delivery_incidents")
    .update({
      incident_status: status,
      resolution,
      reviewed_by: auth?.session?.user?.id || null,
      resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
    })
    .eq("id", incidentId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ============================================================================
// Public Customer Tracking RPC
// ============================================================================
export const getPublicDeliveryTracking = async (token) => {
  const { data, error } = await supabase.rpc("get_public_delivery_tracking", {
    p_token: token,
  });
  if (error) throw error;
  return data;
};

