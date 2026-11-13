import { supabase } from "../supabase/client";

const STORAGE_KEY = "sideways_grillz_settings";
export const SETTINGS_UPDATED_EVENT = "sideways-settings-updated";

export const DEFAULT_SETTINGS = {
  // Business & VAT
  businessName: "Sideways Grillz",
  businessTagline: "Restaurant & Grill",
  businessPhone: "",
  businessEmail: "",
  businessAddress: "",
  receiptFooter: "THANK YOU FOR DINING WITH US!",
  vatRate: 5.25,

  // SMS Configuration
  smsEnabled: false,
  smsProvider: "Arkesel",
  smsSenderId: "SidewaysPOS",
  smsApiKey: "",
  smsApiSecret: "",
  smsWebhookUrl: "",
  smsSendOnOrderPlaced: true,
  smsSendOnOrderReady: true,
  smsSendFollowUp: false,
  smsOrderPlacedTemplate:
    "Hi {name}, your order #{orderId} at {businessName} has been received. Total: GH₵ {total}.",
  smsOrderReadyTemplate:
    "Hi {name}, your order #{orderId} at {businessName} is READY!",
  smsFollowUpTemplate:
    "Thank you for choosing {businessName}, {name}! We appreciate your visit.",

  // Email SMTP Settings
  smtpEnabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpSecurity: "TLS",
  smtpUsername: "",
  smtpPassword: "",
  smtpFromName: "Sideways Grillz POS",
  smtpFromEmail: "",
  notifyAdminOnIncidents: true,
  notifyAdminOnShiftHandover: true,
  staffBroadcastEnabled: true,
};

export const getSettingsSync = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const getSettings = async () => {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("id", "default")
      .maybeSingle();

    if (!error && data?.settings) {
      const merged = { ...DEFAULT_SETTINGS, ...data.settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {
    // Fallback to localStorage if app_settings table does not exist yet
  }
  return getSettingsSync();
};

export const saveSettings = async (newSettings) => {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...newSettings,
    vatRate: Number(newSettings.vatRate ?? DEFAULT_SETTINGS.vatRate),
    smtpPort: Number(newSettings.smtpPort ?? DEFAULT_SETTINGS.smtpPort),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: merged }));

  try {
    await supabase.from("app_settings").upsert({
      id: "default",
      settings: merged,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Saved locally even if Supabase table isn't created yet
  }

  return merged;
};

export const dispatchOrderSmsIfEnabled = async ({
  eventType, // "placed" | "ready" | "followup"
  customerName,
  customerPhone,
  orderId,
  total,
}) => {
  const settings = getSettingsSync();
  if (!settings.smsEnabled || !customerPhone) return false;

  const shouldSend =
    (eventType === "placed" && settings.smsSendOnOrderPlaced) ||
    (eventType === "ready" && settings.smsSendOnOrderReady) ||
    (eventType === "followup" && settings.smsSendFollowUp);

  if (!shouldSend) return false;

  const template =
    eventType === "ready"
      ? settings.smsOrderReadyTemplate
      : eventType === "followup"
        ? settings.smsFollowUpTemplate
        : settings.smsOrderPlacedTemplate;

  const message = (template || "")
    .replaceAll("{name}", customerName || "Customer")
    .replaceAll("{orderId}", String(orderId || "").slice(-6))
    .replaceAll("{businessName}", settings.businessName || "Sideways Grillz")
    .replaceAll("{total}", Number(total || 0).toFixed(2));

  const targetUrl =
    settings.smsWebhookUrl?.trim() ||
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
      },
      body: JSON.stringify({
        provider: settings.smsProvider,
        senderId: settings.smsSenderId,
        apiKey: settings.smsApiKey,
        apiSecret: settings.smsApiSecret,
        to: customerPhone,
        message,
        eventType,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const sendTestSms = async ({ phone, customSettings }) => {
  const settings = customSettings || getSettingsSync();
  if (!phone) throw new Error("Please enter a test phone number.");
  if (!settings.smsApiKey) {
    throw new Error("Please enter your SMS API Key first.");
  }

  const targetUrl =
    settings.smsWebhookUrl?.trim() ||
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`;

  const res = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
    },
    body: JSON.stringify({
      provider: settings.smsProvider,
      senderId: settings.smsSenderId,
      apiKey: settings.smsApiKey,
      apiSecret: settings.smsApiSecret,
      to: phone,
      message: `Test SMS from ${settings.businessName || "Sideways Grillz"} POS. SMS notifications are working!`,
      eventType: "test",
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || `SMS failed (HTTP ${res.status}). Make sure send-sms Edge Function is deployed.`);
  }
  return payload;
};

export const dispatchEmailIfEnabled = async ({
  to,
  subject,
  text,
  html,
  eventType, // "incident" | "handover" | "staff"
}) => {
  const settings = getSettingsSync();
  if (!settings.smtpEnabled) return false;

  const recipient = to || settings.businessEmail;
  if (!recipient) return false;

  const shouldSend =
    (eventType === "incident" && settings.notifyAdminOnIncidents) ||
    (eventType === "handover" && settings.notifyAdminOnShiftHandover) ||
    (eventType === "staff" && settings.staffBroadcastEnabled) ||
    !eventType;

  if (!shouldSend) return false;

  const targetUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
      },
      body: JSON.stringify({
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecurity: settings.smtpSecurity,
        smtpUsername: settings.smtpUsername,
        smtpPassword: settings.smtpPassword,
        smtpFromName: settings.smtpFromName,
        smtpFromEmail: settings.smtpFromEmail,
        to: recipient,
        subject,
        text,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const sendTestEmail = async ({ to, subject, text, customSettings }) => {
  const settings = customSettings || getSettingsSync();
  if (!to) throw new Error("Please enter a recipient email address.");
  if (!settings.smtpHost || !settings.smtpUsername || !settings.smtpPassword) {
    throw new Error("Please fill in SMTP Host, Username, and Password first.");
  }

  const targetUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
  const res = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
    },
    body: JSON.stringify({
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecurity: settings.smtpSecurity,
      smtpUsername: settings.smtpUsername,
      smtpPassword: settings.smtpPassword,
      smtpFromName: settings.smtpFromName,
      smtpFromEmail: settings.smtpFromEmail,
      to,
      subject: subject || `Test Email — ${settings.businessName || "Sideways Grillz"} POS`,
      text:
        text ||
        `Hello! This is a test email from ${settings.businessName || "Sideways Grillz"} POS confirming your SMTP settings work.`,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || `Email failed (HTTP ${res.status}). Make sure send-email Edge Function is deployed.`);
  }
  return payload;
};

