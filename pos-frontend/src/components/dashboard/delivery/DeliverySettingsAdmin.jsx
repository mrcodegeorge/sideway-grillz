import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaCog } from "react-icons/fa";
import { updateDeliverySettings } from "../../../https/deliveryApi";

const DeliverySettingsAdmin = ({ settings }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(settings || {});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateDeliverySettings,
    onSuccess: () => {
      enqueueSnackbar("Delivery settings saved!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-settings"] });
    },
    onError: (err) => enqueueSnackbar(err?.message || "Save failed", { variant: "error" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      assignment_policy: form.assignment_policy,
      multi_order_enabled: Boolean(form.multi_order_enabled),
      require_otp_pod: Boolean(form.require_otp_pod),
      require_photo_pod: Boolean(form.require_photo_pod),
      otp_expiry_minutes: Number(form.otp_expiry_minutes || 30),
      location_update_interval_sec: Number(form.location_update_interval_sec || 20),
      restaurant_name: form.restaurant_name || "Sideways Grillz",
      restaurant_phone: form.restaurant_phone || "",
      restaurant_address: form.restaurant_address || "",
      restaurant_lat: Number(form.restaurant_lat || 5.6037),
      restaurant_lng: Number(form.restaurant_lng || -0.187),
      map_provider: form.map_provider || "openstreetmap",
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 max-w-2xl space-y-4 text-xs"
    >
      <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
        <FaCog className="text-yellow-400" />
        Delivery Workflow &amp; Map Settings
      </h3>

      <div>
        <label className="block text-[#888] mb-1">Assignment Acceptance Policy</label>
        <select
          value={form.assignment_policy || "rider_accept"}
          onChange={(e) => setForm({ ...form, assignment_policy: e.target.value })}
          className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
        >
          <option value="rider_accept">Rider must accept assignment</option>
          <option value="auto_accept">Automatic assignment acceptance</option>
          <option value="dispatcher_controlled">Dispatcher-controlled (no acceptance needed)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-[#ccc] bg-[#141414] p-3 rounded-lg border border-[#2a2a2a]">
          <input
            type="checkbox"
            checked={Boolean(form.require_otp_pod)}
            onChange={(e) => setForm({ ...form, require_otp_pod: e.target.checked })}
          />
          Require Customer OTP Proof of Delivery
        </label>
        <label className="flex items-center gap-2 text-[#ccc] bg-[#141414] p-3 rounded-lg border border-[#2a2a2a]">
          <input
            type="checkbox"
            checked={Boolean(form.multi_order_enabled)}
            onChange={(e) => setForm({ ...form, multi_order_enabled: e.target.checked })}
          />
          Allow Multi-Order Rider Batching
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[#888] mb-1">OTP Expiry (minutes)</label>
          <input
            type="number"
            min="5"
            value={form.otp_expiry_minutes ?? 30}
            onChange={(e) => setForm({ ...form, otp_expiry_minutes: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
        </div>
        <div>
          <label className="block text-[#888] mb-1">GPS Update Interval (seconds)</label>
          <input
            type="number"
            min="5"
            value={form.location_update_interval_sec ?? 20}
            onChange={(e) => setForm({ ...form, location_update_interval_sec: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[#888] mb-1">Restaurant Contact Phone</label>
          <input
            type="text"
            value={form.restaurant_phone || ""}
            onChange={(e) => setForm({ ...form, restaurant_phone: e.target.value })}
            placeholder="024..."
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
        </div>
        <div>
          <label className="block text-[#888] mb-1">Restaurant Address</label>
          <input
            type="text"
            value={form.restaurant_address || ""}
            onChange={(e) => setForm({ ...form, restaurant_address: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[#888] mb-1">Restaurant Latitude</label>
          <input
            type="number"
            step="any"
            value={form.restaurant_lat ?? 5.6037}
            onChange={(e) => setForm({ ...form, restaurant_lat: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
        </div>
        <div>
          <label className="block text-[#888] mb-1">Restaurant Longitude</label>
          <input
            type="number"
            step="any"
            value={form.restaurant_lng ?? -0.187}
            onChange={(e) => setForm({ ...form, restaurant_lng: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="px-6 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold cursor-pointer"
      >
        {mutation.isPending ? "Saving..." : "Save Delivery Settings"}
      </button>
    </form>
  );
};

export default DeliverySettingsAdmin;

