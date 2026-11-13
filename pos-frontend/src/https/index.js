import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import {
  getOfflineOrders,
  saveOfflineOrder,
  setCachedTables,
  getCachedTables,
  setCachedOrders,
  getCachedOrders,
} from "../utils/offlineQueue";
import {
  getLocalAgentTables,
  getLocalAgentOrders,
  saveOrderToLocalAgent,
} from "../utils/localSyncAgent";

const isNetworkError = (err) => {
  if (!navigator.onLine) return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("fetch")
  );
};

const DEACTIVATED_STORAGE_KEY = "sideways_grillz_deactivated_users";

const getLocalDeactivatedMap = () => {
  try {
    const raw = localStorage.getItem(DEACTIVATED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setLocalDeactivated = (userId, isDeactivated) => {
  const map = getLocalDeactivatedMap();
  if (isDeactivated) {
    map[userId] = true;
  } else {
    delete map[userId];
  }
  localStorage.setItem(DEACTIVATED_STORAGE_KEY, JSON.stringify(map));
};

// Helper to convert employee username into valid Supabase Auth email format
const getEmployeeAuthEmail = (usernameOrEmail) => {
  const trimmed = (usernameOrEmail || "").trim().toLowerCase();
  if (trimmed.includes("@")) {
    return trimmed;
  }
  return `${trimmed}@sidewaysgrillz.com`;
};

// ==========================================
// Authentication Endpoints (Username & PIN)
// ==========================================

export const login = async ({ username, email, pin, password }) => {
  const loginIdentifier = username || email;
  const loginSecret = pin || password;

  if (!loginIdentifier || !loginSecret) {
    throw {
      response: {
        data: { message: "Please enter your username and PIN/password!" },
      },
    };
  }

  const authEmail = getEmployeeAuthEmail(loginIdentifier);
  const cleanPin = String(loginSecret);

  let { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: authEmail,
      password: cleanPin,
    });

  // If failed and PIN was < 6 digits, fallback to padded PIN variant
  if (authError && cleanPin.length < 6) {
    const fallback = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: `${cleanPin}_sideways`,
    });
    if (!fallback.error) {
      authData = fallback.data;
      authError = null;
    }
  }

  if (authError) {
    throw {
      response: {
        data: {
          message:
            authError.message === "Invalid login credentials"
              ? "Invalid username or PIN!"
              : authError.message,
        },
      },
    };
  }

  // Fetch employee profile from public.profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .maybeSingle();

  const localDeactivated = getLocalDeactivatedMap();
  if (profile?.is_active === false || localDeactivated[authData.user.id]) {
    await supabase.auth.signOut();
    throw {
      response: {
        data: {
          message: "This account has been deactivated by an administrator.",
        },
      },
    };
  }

  const user = {
    _id: authData.user.id,
    id: authData.user.id,
    username:
      profile?.username ||
      authData.user.user_metadata?.username ||
      loginIdentifier.toLowerCase().replace("@sidewaysgrillz.com", ""),
    name: profile?.name || authData.user.user_metadata?.name || "Staff Member",
    email: authData.user.email,
    phone: profile?.phone || authData.user.user_metadata?.phone || "",
    role: (profile?.role || authData.user.user_metadata?.role || "waiter").toLowerCase(),
  };

  return {
    data: {
      success: true,
      message: "Logged in successfully!",
      data: user,
    },
  };
};

export const register = async ({
  username,
  pin,
  password,
  name,
  phone,
  role,
}) => {
  if (!username) {
    throw { response: { data: { message: "Please provide a username!" } } };
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const cleanPin = String(pin || password);

  if (!cleanPin || cleanPin.length < 4) {
    throw {
      response: {
        data: { message: "PIN / password must be at least 4 digits/characters!" },
      },
    };
  }

  const authEmail = `${cleanUsername}@sidewaysgrillz.com`;
  const normalizedRole = role ? role.toLowerCase() : "waiter";
  const passwordForAuth = cleanPin.length < 6 ? `${cleanPin}_sideways` : cleanPin;

  const { data: authData, error } = await supabase.auth.signUp({
    email: authEmail,
    password: passwordForAuth,
    options: {
      data: {
        username: cleanUsername,
        name: name || cleanUsername,
        phone: phone || "",
        role: normalizedRole,
      },
    },
  });

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  // Ensure profile is recorded in public.profiles
  if (authData.user) {
    await supabase.from("profiles").upsert({
      id: authData.user.id,
      username: cleanUsername,
      name: name || cleanUsername,
      email: authEmail,
      phone: phone || "",
      role: normalizedRole,
    });
  }

  return {
    data: {
      success: true,
      message: `Account created for ${cleanUsername}!`,
      data: authData.user,
    },
  };
};

export const getUserData = async () => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    throw { response: { data: { message: "No active session found" } } };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const localDeactivated = getLocalDeactivatedMap();
  if (profile?.is_active === false || localDeactivated[session.user.id]) {
    await supabase.auth.signOut();
    throw {
      response: {
        data: { message: "This account has been deactivated." },
      },
    };
  }

  const user = {
    _id: session.user.id,
    id: session.user.id,
    username:
      profile?.username ||
      session.user.user_metadata?.username ||
      session.user.email.replace("@sidewaysgrillz.com", ""),
    name: profile?.name || session.user.user_metadata?.name || "Staff Member",
    email: session.user.email,
    phone: profile?.phone || session.user.user_metadata?.phone || "",
    role: (profile?.role || session.user.user_metadata?.role || "waiter").toLowerCase(),
  };

  return {
    data: {
      success: true,
      data: user,
    },
  };
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw { response: { data: { message: error.message } } };
  }
  return {
    data: {
      success: true,
      message: "Logged out successfully!",
    },
  };
};

// ==========================================
// Table Endpoints (Supabase DB)
// ==========================================

export const addTable = async ({ tableNo, seats }) => {
  const { data: existing } = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("table_no", Number(tableNo))
    .maybeSingle();

  if (existing) {
    throw { response: { data: { message: "Table already exists!" } } };
  }

  const { data, error } = await supabase
    .from("restaurant_tables")
    .insert({
      table_no: Number(tableNo),
      seats: Number(seats) || 4,
      status: "Available",
    })
    .select()
    .single();

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  return {
    data: {
      success: true,
      message: "Table added!",
      data: {
        _id: data.id,
        id: data.id,
        tableNo: data.table_no,
        seats: data.seats,
        status: data.status,
      },
    },
  };
};

const fallbackTables = async () => {
  try {
    const agentRes = await getLocalAgentTables();
    if (agentRes?.data?.length) return { data: { success: true, data: agentRes.data } };
  } catch {
    // Local sync agent not running; use browser cache
  }
  return { data: { success: true, data: getCachedTables() } };
};

export const getTables = async () => {
  if (!navigator.onLine) {
    return fallbackTables();
  }

  try {
    const { data: tables, error } = await supabase
      .from("restaurant_tables")
      .select(`
        id,
        table_no,
        seats,
        status,
        current_order_id,
        orders:current_order_id (
          id,
          customer_details
        )
      `)
      .order("table_no", { ascending: true });

    if (error) {
      if (isNetworkError(error)) {
        return fallbackTables();
      }
      throw { response: { data: { message: error.message } } };
    }

    const formattedTables = (tables || []).map((t) => ({
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
    }));

    setCachedTables(formattedTables);

    return {
      data: {
        success: true,
        data: formattedTables,
      },
    };
  } catch (err) {
    if (isNetworkError(err)) {
      return fallbackTables();
    }
    throw err;
  }
};

export const updateTable = async ({ tableId, ...tableData }) => {
  const updatePayload = {};
  if (tableData.status !== undefined) updatePayload.status = tableData.status;
  if (tableData.orderId !== undefined) updatePayload.current_order_id = tableData.orderId;

  const { data, error } = await supabase
    .from("restaurant_tables")
    .update(updatePayload)
    .eq("id", tableId)
    .select()
    .single();

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  return {
    data: {
      success: true,
      message: "Table updated!",
      data: {
        _id: data.id,
        id: data.id,
        tableNo: data.table_no,
        seats: data.seats,
        status: data.status,
      },
    },
  };
};

// ==========================================
// Order Endpoints (with Waiter Attribution)
// ==========================================

const queueOrderOffline = async (orderData) => {
  try {
    const agentRes = await saveOrderToLocalAgent(orderData);
    if (agentRes?.success) {
      return { data: agentRes };
    }
  } catch {
    // Local sync agent not running; fall back to browser offline queue
  }
  const savedOffline = saveOfflineOrder(orderData);
  return {
    data: {
      success: true,
      offline: true,
      message: "Offline: Order queued and will sync when internet returns.",
      data: savedOffline,
    },
  };
};

export const addOrder = async (orderData) => {
  if (!navigator.onLine) {
    return queueOrderOffline(orderData);
  }

  try {
    // Get active session user to guarantee waiter attribution
    let waiterId = orderData.waiterId;
    let waiterName = orderData.waiterName;

    if (!waiterId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        waiterId = session.user.id;
        waiterName = session.user.user_metadata?.name || session.user.user_metadata?.username;
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        waiter_id: waiterId || null,
        waiter_name: waiterName || "Staff",
        customer_details: orderData.customerDetails,
        order_status: orderData.orderStatus || "InProgress",
        bills: orderData.bills,
        items: orderData.items,
        table_id: orderData.table || null,
        payment_method: orderData.paymentMethod || "Cash",
        payment_data: orderData.paymentData || {},
        order_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (isNetworkError(error)) {
        return queueOrderOffline(orderData);
      }
      throw { response: { data: { message: error.message } } };
    }

    // Automatically mark table as Booked
    if (orderData.table) {
      await supabase
        .from("restaurant_tables")
        .update({
          status: "Booked",
          current_order_id: data.id,
        })
        .eq("id", orderData.table);
    }

    return {
      data: {
        success: true,
        message: "Order created!",
        data: {
          _id: data.id,
          id: data.id,
          waiterId: data.waiter_id,
          waiterName: data.waiter_name,
          customerDetails: data.customer_details,
          orderStatus: data.order_status,
          orderDate: data.order_date,
          bills: data.bills,
          items: data.items,
          table: data.table_id,
          paymentMethod: data.payment_method,
          paymentData: data.payment_data,
        },
      },
    };
  } catch (err) {
    if (isNetworkError(err)) {
      return queueOrderOffline(orderData);
    }
    throw err;
  }
};

const fallbackOrders = async (pendingOffline) => {
  try {
    const agentRes = await getLocalAgentOrders();
    if (agentRes?.data) {
      return {
        data: {
          success: true,
          data: [...pendingOffline, ...agentRes.data],
        },
      };
    }
  } catch {
    // Local sync agent not running; use browser cache
  }
  return {
    data: {
      success: true,
      data: [...pendingOffline, ...getCachedOrders()],
    },
  };
};

export const getOrders = async () => {
  const pendingOffline = getOfflineOrders();

  if (!navigator.onLine) {
    return fallbackOrders(pendingOffline);
  }

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,
        waiter_id,
        waiter_name,
        customer_details,
        order_status,
        order_date,
        bills,
        items,
        payment_method,
        payment_data,
        restaurant_tables:table_id (
          id,
          table_no,
          seats,
          status
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      if (isNetworkError(error)) {
        return fallbackOrders(pendingOffline);
      }
      throw { response: { data: { message: error.message } } };
    }

    const formattedOrders = (orders || []).map((o) => ({
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
    }));

    setCachedOrders(formattedOrders);

    return {
      data: {
        success: true,
        data: [...pendingOffline, ...formattedOrders],
      },
    };
  } catch (err) {
    if (isNetworkError(err)) {
      return fallbackOrders(pendingOffline);
    }
    throw err;
  }
};

export const updateOrderStatus = async ({ orderId, orderStatus }) => {
  const { data, error } = await supabase
    .from("orders")
    .update({ order_status: orderStatus })
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  // Release table if completed or cancelled
  if (orderStatus === "Completed" || orderStatus === "Cancelled") {
    if (data.table_id) {
      await supabase
        .from("restaurant_tables")
        .update({
          status: "Available",
          current_order_id: null,
        })
        .eq("id", data.table_id);
    }
  }

  return {
    data: {
      success: true,
      message: "Order updated",
      data: {
        _id: data.id,
        id: data.id,
        orderStatus: data.order_status,
      },
    },
  };
};

// ==========================================
// Payment Endpoints (Paystack)
// ==========================================

export const recordPaystackPayment = async ({
  orderId,
  amount,
  currency,
  reference,
  status,
  waiterId,
}) => {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      order_id: orderId,
      waiter_id: waiterId || null,
      amount: Number(amount),
      currency: currency || import.meta.env.VITE_PAYSTACK_CURRENCY || "GHS",
      payment_method: "Paystack",
      status: status || "success",
      paystack_reference: reference,
    })
    .select()
    .single();

  if (error) {
    console.error("Error logging Paystack payment:", error);
  }

  return { data };
};

// ==========================================
// Waiter Shift Summary & Cash Handover
// ==========================================

export const getWaiterShiftSummary = async (waiterId) => {
  if (!waiterId) {
    const { data: { session } } = await supabase.auth.getSession();
    waiterId = session?.user?.id;
  }

  if (!waiterId) return null;

  // Find the most recent handover time for this waiter
  const { data: lastHandover } = await supabase
    .from("shift_handovers")
    .select("created_at")
    .eq("waiter_id", waiterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase
    .from("orders")
    .select("*")
    .eq("waiter_id", waiterId);

  if (lastHandover?.created_at) {
    query = query.gt("created_at", lastHandover.created_at);
  } else {
    // Default to start of today (UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte("created_at", today.toISOString());
  }

  const { data: orders, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading shift summary:", error);
    throw error;
  }

  let cashCollected = 0;
  let onlineCollected = 0;
  let totalOrders = (orders || []).length;

  (orders || []).forEach((o) => {
    const billTotal = Number(o.bills?.totalWithTax || o.bills?.total || 0);
    if ((o.payment_method || "").toLowerCase() === "cash") {
      cashCollected += billTotal;
    } else {
      onlineCollected += billTotal;
    }
  });

  return {
    waiterId,
    totalOrders,
    cashCollected,
    onlineCollected,
    totalCollected: cashCollected + onlineCollected,
    orders: orders || [],
    shiftStart: lastHandover?.created_at || new Date().toISOString(),
  };
};

export const submitShiftHandover = async ({
  waiterId,
  waiterName,
  cashCollected,
  onlineCollected,
  totalCollected,
  totalOrders,
  shiftStart,
  notes,
}) => {
  const { data, error } = await supabase
    .from("shift_handovers")
    .insert({
      waiter_id: waiterId,
      waiter_name: waiterName,
      shift_start: shiftStart || new Date().toISOString(),
      shift_end: new Date().toISOString(),
      total_orders: totalOrders || 0,
      cash_collected: Number(cashCollected) || 0,
      online_collected: Number(onlineCollected) || 0,
      total_collected: Number(totalCollected) || 0,
      notes: notes || "",
      status: "Handed_Over",
    })
    .select()
    .single();

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  return {
    data: {
      success: true,
      message: "Shift cash handover submitted successfully!",
      data,
    },
  };
};

export const getShiftHandovers = async () => {
  const { data, error } = await supabase
    .from("shift_handovers")
    .select(`
      *,
      approver:approved_by (
        id,
        name,
        role
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  return { data };
};

export const approveShiftHandover = async (handoverId) => {
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase
    .from("shift_handovers")
    .update({
      status: "Approved",
      approved_by: session?.user?.id || null,
    })
    .eq("id", handoverId)
    .select()
    .single();

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  return { data };
};

// ==========================================
// Admin User Management Endpoints
// ==========================================

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  const localDeactivated = getLocalDeactivatedMap();

  return (data || []).map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    phone: u.phone || "",
    role: (u.role || "waiter").toLowerCase(),
    isActive:
      u.is_active !== undefined
        ? u.is_active && !localDeactivated[u.id]
        : !localDeactivated[u.id],
    createdAt: u.created_at,
  }));
};

export const adminCreateUser = async ({ name, username, phone, role, pin }) => {
  if (!username || !username.trim()) {
    throw { response: { data: { message: "Please provide a username!" } } };
  }

  const cleanUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const cleanPin = String(pin || "").trim();

  if (cleanPin.length < 4) {
    throw {
      response: { data: { message: "PIN must be at least 4 characters!" } },
    };
  }

  const authEmail = `${cleanUsername}@sidewaysgrillz.com`;
  const normalizedRole = (role || "waiter").toLowerCase();
  const passwordForAuth =
    cleanPin.length < 6 ? `${cleanPin}_sideways` : cleanPin;

  // Use a separate non-persisting client so the Admin's session stays intact
  const tempClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const { data: authData, error } = await tempClient.auth.signUp({
    email: authEmail,
    password: passwordForAuth,
    options: {
      data: {
        username: cleanUsername,
        name: name?.trim() || cleanUsername,
        phone: phone?.trim() || "",
        role: normalizedRole,
      },
    },
  });

  if (error) {
    throw { response: { data: { message: error.message } } };
  }

  if (authData.user) {
    await supabase.from("profiles").upsert({
      id: authData.user.id,
      username: cleanUsername,
      name: name?.trim() || cleanUsername,
      email: authEmail,
      phone: phone?.trim() || "",
      role: normalizedRole,
    });
  }

  return authData.user;
};

export const adminUpdateUserRole = async ({ userId, role }) => {
  const normalizedRole = (role || "waiter").toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: normalizedRole })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw { response: { data: { message: error.message } } };
  }
  return data;
};

export const adminToggleUserActive = async ({ userId, isActive }) => {
  setLocalDeactivated(userId, !isActive);

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  // If is_active column hasn't been added yet, localDeactivated still enforces it on login
  if (error && !String(error.message).includes("is_active")) {
    throw { response: { data: { message: error.message } } };
  }

  return { id: userId, isActive };
};

export const adminChangeUserPin = async ({ userId, newPin, isSelf }) => {
  const cleanPin = String(newPin || "").trim();
  if (cleanPin.length < 4) {
    throw {
      response: { data: { message: "PIN must be at least 4 characters!" } },
    };
  }

  const effectivePassword =
    cleanPin.length < 6 ? `${cleanPin}_sideways` : cleanPin;

  if (isSelf) {
    const { error } = await supabase.auth.updateUser({
      password: effectivePassword,
    });
    if (error) {
      throw { response: { data: { message: error.message } } };
    }
    return true;
  }

  const { data, error } = await supabase.rpc("admin_update_user_pin", {
    target_user_id: userId,
    new_pin: cleanPin,
  });

  if (error) {
    if (
      String(error.message).includes("admin_update_user_pin") ||
      String(error.code) === "PGRST202"
    ) {
      throw {
        response: {
          data: {
            message:
              "Run supabase-user-management.sql in Supabase SQL Editor first to enable remote PIN resets.",
          },
        },
      };
    }
    throw { response: { data: { message: error.message } } };
  }

  return data;
};
