import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  FaStore,
  FaPercent,
  FaSms,
  FaEnvelope,
  FaSave,
  FaUndo,
} from "react-icons/fa";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  sendTestSms,
  sendTestEmail,
} from "../../utils/settingsStorage";

const SMS_PROVIDERS = ["Arkesel", "Hubtel", "mNotify", "Twilio", "Custom Webhook"];
const SMTP_SECURITY = ["TLS", "SSL", "None"];

const SettingsAdmin = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [testPhone, setTestPhone] = useState("");
  const [testingSms, setTestingSms] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);

  const handleTestSms = async () => {
    setTestingSms(true);
    try {
      await sendTestSms({ phone: testPhone, customSettings: form });
      enqueueSnackbar(`Test SMS sent to ${testPhone}!`, { variant: "success" });
    } catch (err) {
      enqueueSnackbar(err?.message || "Failed to send test SMS.", { variant: "error" });
    } finally {
      setTestingSms(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      await sendTestEmail({ to: testEmail || form.businessEmail, customSettings: form });
      enqueueSnackbar(`Test email sent to ${testEmail || form.businessEmail}!`, { variant: "success" });
    } catch (err) {
      enqueueSnackbar(err?.message || "Failed to send test email.", { variant: "error" });
    } finally {
      setTestingEmail(false);
    }
  };

  const { data: loadedSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (loadedSettings) {
      setForm(loadedSettings);
    }
  }, [loadedSettings]);

  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(["app-settings"], saved);
      enqueueSnackbar("Settings saved successfully!", { variant: "success" });
    },
    onError: () => {
      enqueueSnackbar("Failed to save settings.", { variant: "error" });
    },
  });

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number(form.vatRate) < 0 || Number(form.vatRate) > 100) {
      enqueueSnackbar("VAT percentage must be between 0 and 100.", {
        variant: "warning",
      });
      return;
    }
    saveMutation.mutate(form);
  };

  const handleReset = () => {
    setForm(DEFAULT_SETTINGS);
    saveMutation.mutate(DEFAULT_SETTINGS);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="container mx-auto px-6 md:px-4 pb-24 space-y-6"
    >
      {/* Top Action Bar */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-xl font-bold">
            POS Configuration & Settings
          </h2>
          <p className="text-xs text-[#ababab] mt-0.5">
            Manage VAT %, business profile, SMS order notifications, and email SMTP
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#333] text-[#ababab] hover:text-white border border-[#383838] px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <FaUndo size={12} />
            <span>Reset Defaults</span>
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            <FaSave size={13} />
            <span>{saveMutation.isPending ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Business Details & VAT */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-5 space-y-4">
        <h3 className="text-white font-bold text-lg flex items-center gap-2 border-b border-[#333] pb-3">
          <FaStore className="text-yellow-400" /> Business Details & VAT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => updateField("businessName", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              value={form.businessTagline}
              onChange={(e) => updateField("businessTagline", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1 flex items-center gap-1">
              <FaPercent className="text-yellow-400 text-[10px]" /> VAT / Tax Percentage (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.vatRate}
              onChange={(e) => updateField("vatRate", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-yellow-400 font-bold focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Business Phone
            </label>
            <input
              type="tel"
              value={form.businessPhone}
              onChange={(e) => updateField("businessPhone", e.target.value)}
              placeholder="e.g. 024 000 0000"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Business Email
            </label>
            <input
              type="email"
              value={form.businessEmail}
              onChange={(e) => updateField("businessEmail", e.target.value)}
              placeholder="info@sidewaysgrillz.com"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Business Address
            </label>
            <input
              type="text"
              value={form.businessAddress}
              onChange={(e) => updateField("businessAddress", e.target.value)}
              placeholder="Accra, Ghana"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#ababab] mb-1">
            Thermal Receipt Footer Message
          </label>
          <input
            type="text"
            value={form.receiptFooter}
            onChange={(e) => updateField("receiptFooter", e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
      </div>

      {/* Section 2: SMS Configuration */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#333] pb-3">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <FaSms className="text-green-400" /> SMS Configuration (Order Status & Follow-Ups)
          </h3>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-white font-semibold">
            <input
              type="checkbox"
              checked={form.smsEnabled}
              onChange={(e) => updateField("smsEnabled", e.target.checked)}
              className="w-4 h-4 accent-yellow-400"
            />
            Enable SMS Notifications
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              SMS Provider
            </label>
            <select
              value={form.smsProvider}
              onChange={(e) => updateField("smsProvider", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {SMS_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Sender ID
            </label>
            <input
              type="text"
              maxLength={11}
              value={form.smsSenderId}
              onChange={(e) => updateField("smsSenderId", e.target.value)}
              placeholder="SidewaysPOS"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              API Key
            </label>
            <input
              type="password"
              value={form.smsApiKey}
              onChange={(e) => updateField("smsApiKey", e.target.value)}
              placeholder="Provider API Key"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              API Secret / Token (Optional)
            </label>
            <input
              type="password"
              value={form.smsApiSecret}
              onChange={(e) => updateField("smsApiSecret", e.target.value)}
              placeholder="Provider Secret"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-[#ababab] mb-1">
              SMS Relay / Edge Function Webhook URL
            </label>
            <input
              type="url"
              value={form.smsWebhookUrl}
              onChange={(e) => updateField("smsWebhookUrl", e.target.value)}
              placeholder="https://your-project.supabase.co/functions/v1/send-sms"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
              <input
                type="checkbox"
                checked={form.smsSendOnOrderPlaced}
                onChange={(e) =>
                  updateField("smsSendOnOrderPlaced", e.target.checked)
                }
                className="accent-yellow-400"
              />
              SMS on Order Placed
            </label>
            <textarea
              rows={2}
              value={form.smsOrderPlacedTemplate}
              onChange={(e) =>
                updateField("smsOrderPlacedTemplate", e.target.value)
              }
              className="w-full bg-[#262626] border border-[#333] rounded p-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
              <input
                type="checkbox"
                checked={form.smsSendOnOrderReady}
                onChange={(e) =>
                  updateField("smsSendOnOrderReady", e.target.checked)
                }
                className="accent-yellow-400"
              />
              SMS on Order Ready
            </label>
            <textarea
              rows={2}
              value={form.smsOrderReadyTemplate}
              onChange={(e) =>
                updateField("smsOrderReadyTemplate", e.target.value)
              }
              className="w-full bg-[#262626] border border-[#333] rounded p-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
              <input
                type="checkbox"
                checked={form.smsSendFollowUp}
                onChange={(e) =>
                  updateField("smsSendFollowUp", e.target.checked)
                }
                className="accent-yellow-400"
              />
              Customer Follow-Up SMS
            </label>
            <textarea
              rows={2}
              value={form.smsFollowUpTemplate}
              onChange={(e) =>
                updateField("smsFollowUpTemplate", e.target.value)
              }
              className="w-full bg-[#262626] border border-[#333] rounded p-2 text-xs text-white focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-[#ababab]">
          Available template variables: <code>{"{name}"}</code>,{" "}
          <code>{"{orderId}"}</code>, <code>{"{businessName}"}</code>,{" "}
          <code>{"{total}"}</code>. Leave Webhook URL blank to use the built-in Supabase Edge Function (<code>send-sms</code>).
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#333]">
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Test phone (e.g. 0241234567)"
            className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 w-56"
          />
          <button
            type="button"
            disabled={testingSms}
            onClick={handleTestSms}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            {testingSms ? "Sending..." : "Send Test SMS"}
          </button>
        </div>
      </div>

      {/* Section 3: Email SMTP Settings */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#333] pb-3">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <FaEnvelope className="text-blue-400" /> Email SMTP Settings (Notifications & Staff Communication)
          </h3>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-white font-semibold">
            <input
              type="checkbox"
              checked={form.smtpEnabled}
              onChange={(e) => updateField("smtpEnabled", e.target.checked)}
              className="w-4 h-4 accent-yellow-400"
            />
            Enable SMTP Email
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              SMTP Host
            </label>
            <input
              type="text"
              value={form.smtpHost}
              onChange={(e) => updateField("smtpHost", e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              SMTP Port
            </label>
            <input
              type="number"
              value={form.smtpPort}
              onChange={(e) => updateField("smtpPort", e.target.value)}
              placeholder="587"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Encryption / Security
            </label>
            <select
              value={form.smtpSecurity}
              onChange={(e) => updateField("smtpSecurity", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {SMTP_SECURITY.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              SMTP Username
            </label>
            <input
              type="text"
              value={form.smtpUsername}
              onChange={(e) => updateField("smtpUsername", e.target.value)}
              placeholder="notifications@sidewaysgrillz.com"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              SMTP Password / App Password
            </label>
            <input
              type="password"
              value={form.smtpPassword}
              onChange={(e) => updateField("smtpPassword", e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              From Name
            </label>
            <input
              type="text"
              value={form.smtpFromName}
              onChange={(e) => updateField("smtpFromName", e.target.value)}
              placeholder="Sideways Grillz POS"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              From Email Address
            </label>
            <input
              type="email"
              value={form.smtpFromEmail}
              onChange={(e) => updateField("smtpFromEmail", e.target.value)}
              placeholder="noreply@sidewaysgrillz.com"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifyAdminOnIncidents}
              onChange={(e) =>
                updateField("notifyAdminOnIncidents", e.target.checked)
              }
              className="accent-yellow-400"
            />
            Email Admin on Incident Reports
          </label>
          <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
            <input
              type="checkbox"
              checked={form.notifyAdminOnShiftHandover}
              onChange={(e) =>
                updateField("notifyAdminOnShiftHandover", e.target.checked)
              }
              className="accent-yellow-400"
            />
            Email Admin on Shift Handovers
          </label>
          <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
            <input
              type="checkbox"
              checked={form.staffBroadcastEnabled}
              onChange={(e) =>
                updateField("staffBroadcastEnabled", e.target.checked)
              }
              className="accent-yellow-400"
            />
            Allow Staff Email Communication
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#333]">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Test recipient email (or uses Business Email)"
            className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 w-72"
          />
          <button
            type="button"
            disabled={testingEmail}
            onClick={handleTestEmail}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            {testingEmail ? "Sending..." : "Send Test Email"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SettingsAdmin;

