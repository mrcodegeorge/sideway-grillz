import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaDownload, FaExclamationTriangle, FaPrint } from "react-icons/fa";
import { resolveDeliveryIncident } from "../../../https/deliveryApi";

const DeliveryReportsAdmin = ({
  tasks = [],
  riders = [],
  zones = [],
  collections = [],
  settlements = [],
  incidents = [],
}) => {
  const queryClient = useQueryClient();
  const [riderFilter, setRiderFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (riderFilter !== "all" && t.assigned_rider_id !== riderFilter) return false;
      if (zoneFilter !== "all" && t.zone_id !== zoneFilter) return false;
      if (statusFilter !== "all" && t.current_status !== statusFilter) return false;
      return true;
    });
  }, [tasks, riderFilter, zoneFilter, statusFilter]);

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const delivered = filteredTasks.filter((t) => t.current_status === "delivered");
    const failed = filteredTasks.filter((t) =>
      ["failed", "returning", "returned"].includes(t.current_status)
    );
    const totalFees = filteredTasks
      .filter((t) => t.current_status !== "cancelled")
      .reduce((s, t) => s + Number(t.delivery_fee || 0), 0);
    const waivedFees = filteredTasks.reduce(
      (s, t) => s + Math.max(0, Number(t.original_fee || 0) - Number(t.delivery_fee || 0)),
      0
    );
    const cashCollected = collections
      .filter((c) => c.collection_method === "Cash")
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const momoCollected = collections
      .filter((c) => c.collection_method === "MoMo")
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const avgMinutes =
      delivered.length > 0
        ? Math.round(
            delivered.reduce((s, t) => {
              const end = new Date(t.completed_at || t.updated_at).getTime();
              const start = new Date(t.created_at).getTime();
              return s + Math.max(1, (end - start) / 60000);
            }, 0) / delivered.length
          )
        : 0;

    return {
      total,
      deliveredCount: delivered.length,
      failedCount: failed.length,
      successRate: total ? ((delivered.length / total) * 100).toFixed(1) : "0.0",
      avgMinutes,
      totalFees,
      waivedFees,
      cashCollected,
      momoCollected,
      settlementDiscrepancies: settlements.filter((s) => Number(s.discrepancy_amount) !== 0).length,
    };
  }, [filteredTasks, collections, settlements]);

  const resolveMutation = useMutation({
    mutationFn: resolveDeliveryIncident,
    onSuccess: () => {
      enqueueSnackbar("Incident updated", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-incidents"] });
    },
  });

  const handleExportCsv = () => {
    const headers = [
      "Order Ref",
      "Created",
      "Customer",
      "Phone",
      "Address",
      "Zone",
      "Rider",
      "Status",
      "Delivery Fee (GHS)",
      "Order Total (GHS)",
      "Payment Method",
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filteredTasks.map((t) => [
      String(t.order_id).slice(0, 8).toUpperCase(),
      new Date(t.created_at).toLocaleString(),
      t.customer_name,
      t.customer_phone,
      t.delivery_address,
      t.delivery_zones?.name || "Manual/None",
      t.riders?.full_name || "Unassigned",
      t.current_status,
      Number(t.delivery_fee || 0).toFixed(2),
      Number(t.orders?.bills?.totalWithTax ?? 0).toFixed(2),
      t.orders?.payment_method || "Cash",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={riderFilter}
            onChange={(e) => setRiderFilter(e.target.value)}
            className="bg-[#141414] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5]"
          >
            <option value="all">All Riders</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-[#141414] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5]"
          >
            <option value="all">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#141414] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5]"
          >
            <option value="all">All Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#262626] text-xs text-[#f5f5f5] cursor-pointer"
          >
            <FaPrint size={12} /> Print
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-yellow-400 text-black text-xs font-bold cursor-pointer"
          >
            <FaDownload size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Operational & Financial Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Success Rate</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{metrics.successRate}%</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Avg Delivery Time</p>
          <p className="text-xl font-bold text-[#f5f5f5] mt-1">{metrics.avgMinutes} mins</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Delivery Fees Collected</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">
            GH₵ {metrics.totalFees.toFixed(2)}
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Rider Cash / MoMo</p>
          <p className="text-sm font-bold text-[#f5f5f5] mt-1">
            Cash: GH₵ {metrics.cashCollected.toFixed(2)}
            <br />
            MoMo: GH₵ {metrics.momoCollected.toFixed(2)}
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Discrepancies / Waived</p>
          <p className="text-sm font-bold text-amber-400 mt-1">
            {metrics.settlementDiscrepancies} discrepanc(ies)
            <br />
            Waived: GH₵ {metrics.waivedFees.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Delivery Incidents */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
          <FaExclamationTriangle className="text-red-400" />
          Delivery Incidents ({incidents.length})
        </h3>
        {incidents.length === 0 ? (
          <p className="text-xs text-[#888] py-4">No delivery incidents reported.</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-bold text-[#f5f5f5]">
                    {inc.incident_type} •{" "}
                    <span className="text-yellow-400">{inc.riders?.full_name || "Rider"}</span>
                  </p>
                  <p className="text-[#ababab]">{inc.description}</p>
                  <p className="text-[10px] text-[#777] mt-0.5">
                    Status: {inc.incident_status} • {new Date(inc.created_at).toLocaleString()}
                  </p>
                </div>
                {inc.incident_status !== "resolved" && (
                  <button
                    type="button"
                    onClick={() =>
                      resolveMutation.mutate({
                        incidentId: inc.id,
                        status: "resolved",
                        resolution: "Reviewed by admin",
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryReportsAdmin;

