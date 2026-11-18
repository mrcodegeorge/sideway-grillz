import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaMotorcycle, FaUserPlus } from "react-icons/fa";
import { createRiderAccount, updateRiderProfile } from "../../../https/deliveryApi";

const RidersAdmin = ({ riders = [], tasks = [] }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    phone: "",
    email: "",
    pin: "",
    vehicle_type: "motorcycle",
    vehicle_registration: "",
    emergency_contact: "",
  });

  const createMutation = useMutation({
    mutationFn: createRiderAccount,
    onSuccess: () => {
      enqueueSnackbar("Rider account created!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-riders"] });
      setForm({
        full_name: "",
        username: "",
        phone: "",
        email: "",
        pin: "",
        vehicle_type: "motorcycle",
        vehicle_registration: "",
        emergency_contact: "",
      });
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message || err?.message || "Failed to create rider", {
        variant: "error",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, updates }) => updateRiderProfile(id, updates),
    onSuccess: () => {
      enqueueSnackbar("Rider updated!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-riders"] });
    },
    onError: (err) => enqueueSnackbar(err?.message || "Update failed", { variant: "error" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.full_name || !form.username || !form.phone || !form.pin) {
      enqueueSnackbar("Please fill in name, username, phone, and PIN.", { variant: "warning" });
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Create Rider Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3 h-fit"
      >
        <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
          <FaUserPlus className="text-yellow-400" />
          Add Delivery Rider
        </h3>
        <input
          type="text"
          placeholder="Full Name *"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Username *"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            required
          />
          <input
            type="password"
            placeholder="PIN (4+ digits) *"
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="tel"
            placeholder="Phone (024...) *"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
            required
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.vehicle_type}
            onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
          >
            <option value="motorcycle">Motorcycle</option>
            <option value="car">Car</option>
            <option value="bicycle">Bicycle</option>
            <option value="other">Other</option>
          </select>
          <input
            type="text"
            placeholder="Plate No. (optional)"
            value={form.vehicle_registration}
            onChange={(e) => setForm({ ...form, vehicle_registration: e.target.value })}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
          />
        </div>
        <input
          type="text"
          placeholder="Emergency Contact (optional)"
          value={form.emergency_contact}
          onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
          className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-xs text-[#f5f5f5]"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold cursor-pointer"
        >
          {createMutation.isPending ? "Creating..." : "Create Rider Account"}
        </button>
      </form>

      {/* Rider Availability Board */}
      <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
          <FaMotorcycle className="text-yellow-400" />
          Rider Availability & Accounts ({riders.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-[#888] text-[11px] uppercase">
                <th className="py-2.5 px-3">Rider</th>
                <th className="py-2.5 px-3">Vehicle</th>
                <th className="py-2.5 px-3">Availability</th>
                <th className="py-2.5 px-3">Active / Today</th>
                <th className="py-2.5 px-3">Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252525]">
              {riders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#888]">
                    No riders created yet.
                  </td>
                </tr>
              ) : (
                riders.map((r) => {
                  const activeCount = tasks.filter(
                    (t) =>
                      t.assigned_rider_id === r.id &&
                      ["assigned", "accepted", "arrived_at_restaurant", "picked_up", "out_for_delivery"].includes(
                        t.current_status
                      )
                  ).length;
                  const completedToday = tasks.filter(
                    (t) =>
                      t.assigned_rider_id === r.id &&
                      t.current_status === "delivered" &&
                      new Date(t.completed_at || t.updated_at).toDateString() ===
                        new Date().toDateString()
                  ).length;

                  return (
                    <tr key={r.id}>
                      <td className="py-3 px-3">
                        <p className="font-bold text-[#f5f5f5]">
                          {r.full_name}{" "}
                          <span className="text-[10px] text-yellow-400">({r.rider_code})</span>
                        </p>
                        <p className="text-[11px] text-[#888]">{r.phone}</p>
                      </td>
                      <td className="py-3 px-3 text-[#ccc] capitalize">
                        {r.vehicle_type}
                        {r.vehicle_registration ? ` • ${r.vehicle_registration}` : ""}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.availability_status === "available"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : r.availability_status === "busy"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {r.availability_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#ccc]">
                        {activeCount} active • {completedToday} today
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={r.account_status}
                          onChange={(e) =>
                            statusMutation.mutate({
                              id: r.id,
                              updates: {
                                account_status: e.target.value,
                                availability_status:
                                  e.target.value === "active" ? r.availability_status : "suspended",
                              },
                            })
                          }
                          className="bg-[#141414] border border-[#333] rounded-lg px-2 py-1 text-[11px] text-[#f5f5f5]"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RidersAdmin;

