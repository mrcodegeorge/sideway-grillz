import React from "react";
import { FaMotorcycle, FaCheckCircle, FaTimesCircle, FaClock, FaMoneyBillWave } from "react-icons/fa";

const DeliveryOverview = ({ tasks = [], riders = [], collections = [], dateFilter, setDateFilter, onRefresh, isFetching }) => {
  const filteredTasks = tasks.filter((t) => {
    if (!dateFilter || dateFilter === "all") return true;
    const created = new Date(t.created_at);
    const now = new Date();
    if (dateFilter === "today") {
      return created.toDateString() === now.toDateString();
    }
    if (dateFilter === "week") {
      return now - created <= 7 * 24 * 60 * 60 * 1000;
    }
    return true;
  });

  const countBy = (statuses) =>
    filteredTasks.filter((t) => statuses.includes(t.current_status)).length;

  const totalFees = filteredTasks
    .filter((t) => t.current_status !== "cancelled")
    .reduce((sum, t) => sum + Number(t.delivery_fee || 0), 0);

  const outstandingCash = collections
    .filter((c) => c.collection_method === "Cash" && c.collection_status === "collected")
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const availableRiders = riders.filter(
    (r) => r.account_status === "active" && r.availability_status === "available"
  ).length;
  const busyRiders = riders.filter(
    (r) => r.account_status === "active" && r.availability_status === "busy"
  ).length;

  const cards = [
    { label: "Total Deliveries", value: filteredTasks.length, color: "text-yellow-400" },
    { label: "Awaiting Assignment", value: countBy(["pending_assignment", "preparing"]), color: "text-amber-400" },
    { label: "Assigned", value: countBy(["assigned", "accepted"]), color: "text-blue-400" },
    { label: "Awaiting Pickup", value: countBy(["ready_for_pickup", "arrived_at_restaurant"]), color: "text-purple-400" },
    { label: "Out for Delivery", value: countBy(["picked_up", "out_for_delivery"]), color: "text-cyan-400" },
    { label: "Successfully Delivered", value: countBy(["delivered"]), color: "text-emerald-400" },
    { label: "Failed / Returned", value: countBy(["failed", "returning", "returned"]), color: "text-red-400" },
    { label: "Available Riders", value: availableRiders, color: "text-emerald-400" },
    { label: "Busy Riders", value: busyRiders, color: "text-amber-400" },
    { label: "Total Delivery Fees", value: `GH₵ ${totalFees.toFixed(2)}`, color: "text-yellow-400" },
    { label: "Cash With Riders", value: `GH₵ ${outstandingCash.toFixed(2)}`, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "Last 7 Days" },
            { id: "all", label: "All Time" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDateFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                dateFilter === opt.id
                  ? "bg-yellow-400 text-black font-bold"
                  : "bg-[#1a1a1a] text-[#ababab] border border-[#2e2e2e]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="px-3.5 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333] text-xs font-semibold text-[#f5f5f5] border border-[#333] cursor-pointer"
        >
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4 flex flex-col justify-between"
          >
            <p className="text-[11px] text-[#888] font-medium">{c.label}</p>
            <p className={`text-xl font-bold mt-2 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeliveryOverview;

