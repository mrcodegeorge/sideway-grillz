import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaMapMarkedAlt, FaPlus, FaTrash } from "react-icons/fa";
import { deleteDeliveryZone, saveDeliveryZone } from "../../../https/deliveryApi";

const EMPTY_ZONE = {
  id: null,
  name: "",
  description: "",
  fee: "15",
  minimum_order_amount: "0",
  estimated_delivery_minutes: "35",
  free_delivery_threshold: "",
  priority: "10",
  coverage_type: "neighborhoods",
  neighborhoodsText: "",
  centerLat: "5.6037",
  centerLng: "-0.1870",
  radiusKm: "5",
  is_active: true,
};

const DeliveryZonesAdmin = ({ zones = [] }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_ZONE);

  const saveMutation = useMutation({
    mutationFn: saveDeliveryZone,
    onSuccess: () => {
      enqueueSnackbar("Delivery zone saved!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      setForm(EMPTY_ZONE);
    },
    onError: (err) => enqueueSnackbar(err?.message || "Failed to save zone", { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeliveryZone,
    onSuccess: () => {
      enqueueSnackbar("Zone deleted", { variant: "info" });
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
    },
    onError: (err) => enqueueSnackbar(err?.message || "Delete failed", { variant: "error" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      enqueueSnackbar("Zone name is required", { variant: "warning" });
      return;
    }

    const coverage_data =
      form.coverage_type === "neighborhoods"
        ? {
            neighborhoods: form.neighborhoodsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : {
            centerLat: Number(form.centerLat),
            centerLng: Number(form.centerLng),
            radiusKm: Number(form.radiusKm),
          };

    saveMutation.mutate({
      id: form.id,
      name: form.name,
      description: form.description,
      fee: Number(form.fee || 0),
      minimum_order_amount: Number(form.minimum_order_amount || 0),
      estimated_delivery_minutes: Number(form.estimated_delivery_minutes || 35),
      free_delivery_threshold: form.free_delivery_threshold,
      priority: Number(form.priority || 10),
      coverage_type: form.coverage_type,
      coverage_data,
      is_active: form.is_active,
    });
  };

  const handleEdit = (z) => {
    setForm({
      id: z.id,
      name: z.name || "",
      description: z.description || "",
      fee: String(z.fee ?? 0),
      minimum_order_amount: String(z.minimum_order_amount ?? 0),
      estimated_delivery_minutes: String(z.estimated_delivery_minutes ?? 35),
      free_delivery_threshold: z.free_delivery_threshold != null ? String(z.free_delivery_threshold) : "",
      priority: String(z.priority ?? 10),
      coverage_type: z.coverage_type || "neighborhoods",
      neighborhoodsText: (z.coverage_data?.neighborhoods || []).join(", "),
      centerLat: String(z.coverage_data?.centerLat ?? "5.6037"),
      centerLng: String(z.coverage_data?.centerLng ?? "-0.1870"),
      radiusKm: String(z.coverage_data?.radiusKm ?? "5"),
      is_active: z.is_active !== false,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3 h-fit"
      >
        <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
          <FaPlus className="text-yellow-400" />
          {form.id ? "Edit Delivery Zone" : "Create Delivery Zone"}
        </h3>
        <input
          type="text"
          placeholder="Zone Name (e.g. Zone A - East Legon) *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
          required
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#888]">Fee (GH₵)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#888]">Min Order (GH₵)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.minimum_order_amount}
              onChange={(e) => setForm({ ...form, minimum_order_amount: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-[#888]">ETA (mins)</label>
            <input
              type="number"
              min="5"
              value={form.estimated_delivery_minutes}
              onChange={(e) => setForm({ ...form, estimated_delivery_minutes: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#888]">Free Over (GH₵)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Optional"
              value={form.free_delivery_threshold}
              onChange={(e) => setForm({ ...form, free_delivery_threshold: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#888]">Priority</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-[#888]">Coverage Method</label>
          <select
            value={form.coverage_type}
            onChange={(e) => setForm({ ...form, coverage_type: e.target.value })}
            className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
          >
            <option value="neighborhoods">Neighborhoods / Communities</option>
            <option value="radius">Radius (km)</option>
          </select>
        </div>

        {form.coverage_type === "neighborhoods" ? (
          <textarea
            rows={3}
            placeholder="Comma-separated neighborhoods (e.g. East Legon, Airport Residential, Osu)"
            value={form.neighborhoodsText}
            onChange={(e) => setForm({ ...form, neighborhoodsText: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
          />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              step="any"
              placeholder="Lat"
              value={form.centerLat}
              onChange={(e) => setForm({ ...form, centerLat: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
            <input
              type="number"
              step="any"
              placeholder="Lng"
              value={form.centerLng}
              onChange={(e) => setForm({ ...form, centerLng: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
            <input
              type="number"
              step="0.5"
              placeholder="Radius km"
              value={form.radiusKm}
              onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
              className="w-full rounded-lg p-2 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-xs text-[#ccc]">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Zone Active
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold cursor-pointer"
          >
            {saveMutation.isPending ? "Saving..." : form.id ? "Update Zone" : "Save Zone"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(EMPTY_ZONE)}
              className="px-3 py-2.5 rounded-xl bg-[#262626] text-xs text-[#ccc] cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
          <FaMapMarkedAlt className="text-yellow-400" />
          Configured Delivery Zones ({zones.length})
        </h3>
        <div className="space-y-2.5">
          {zones.length === 0 ? (
            <p className="text-xs text-[#888] py-8 text-center">
              No delivery zones configured yet. Create your first zone on the left.
            </p>
          ) : (
            zones.map((z) => (
              <div
                key={z.id}
                className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#f5f5f5]">{z.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        z.is_active
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {z.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-[#ababab]">
                    Fee: <strong className="text-yellow-400">GH₵ {Number(z.fee).toFixed(2)}</strong> •
                    Min: GH₵ {Number(z.minimum_order_amount || 0).toFixed(2)} • ETA: ~
                    {z.estimated_delivery_minutes}m
                  </p>
                  {z.coverage_type === "neighborhoods" && (
                    <p className="text-[11px] text-[#888]">
                      Areas: {(z.coverage_data?.neighborhoods || []).join(", ") || "None"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(z)}
                    className="px-3 py-1.5 rounded-lg bg-[#262626] text-xs text-[#f5f5f5] cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(z.id)}
                    className="p-2 rounded-lg bg-red-500/15 text-red-400 cursor-pointer"
                    title="Delete Zone"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryZonesAdmin;

