import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaDownload, FaHistory, FaSearch, FaSyncAlt } from "react-icons/fa";
import { getAuditTrails } from "../../utils/auditStorage";

const ENTITY_FILTERS = ["All", "Auth", "Order", "Table", "User", "Settings", "Incident"];

const getActionBadgeClass = (action = "") => {
  const upper = action.toUpperCase();
  if (upper.includes("DELETE") || upper.includes("DEACTIVATE") || upper.includes("LOGOUT")) {
    return "bg-red-500/15 text-red-400 border-red-500/30";
  }
  if (upper.includes("CREATE") || upper.includes("ADD") || upper.includes("LOGIN")) {
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  }
  if (upper.includes("UPDATE") || upper.includes("RESET") || upper.includes("STATUS")) {
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  }
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
};

const AuditTrailsAdmin = () => {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("All");

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-trails"],
    queryFn: getAuditTrails,
  });

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (entityFilter !== "All" && (log.entityType || "").toLowerCase() !== entityFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return (
        (log.actorName || "").toLowerCase().includes(q) ||
        (log.actorRole || "").toLowerCase().includes(q) ||
        (log.action || "").toLowerCase().includes(q) ||
        (log.entityType || "").toLowerCase().includes(q) ||
        (log.details || "").toLowerCase().includes(q)
      );
    });
  }, [logs, search, entityFilter]);

  const handleExportCsv = () => {
    const headers = ["Timestamp", "Staff", "Role", "Action", "Category", "Entity ID", "Details"];
    const escapeCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filteredLogs.map((l) => [
      l.createdAt ? new Date(l.createdAt).toLocaleString() : "",
      l.actorName,
      l.actorRole,
      l.action,
      l.entityType,
      l.entityId,
      l.details,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sideways-audit-trails-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-6 md:px-4 py-4 space-y-5">
      {/* Header & Controls */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-yellow-400/15 text-yellow-400">
            <FaHistory size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#f5f5f5]">Admin Audit Trails</h2>
            <p className="text-xs text-[#ababab]">
              Track staff logins, orders, table changes, user management, and system updates ({filteredLogs.length} entries)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#262626] hover:bg-[#323232] border border-[#333] text-xs font-semibold text-[#f5f5f5] cursor-pointer"
          >
            <FaSyncAlt className={isFetching ? "animate-spin" : ""} size={12} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <FaDownload size={12} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 w-full sm:w-80">
          <FaSearch className="text-[#888]" size={13} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff, action, or details..."
            className="bg-transparent outline-none text-xs text-[#f5f5f5] w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ENTITY_FILTERS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setEntityFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                entityFilter === cat
                  ? "bg-yellow-400 text-black font-bold"
                  : "bg-[#1a1a1a] text-[#ababab] border border-[#2e2e2e] hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-[11px] uppercase tracking-wider text-[#888]">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252525] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#888]">
                    Loading audit trails...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#888]">
                    No audit trail records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#232323]/60 transition-colors">
                    <td className="py-3 px-4 text-[#ababab] whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#f5f5f5]">{log.actorName}</p>
                      <p className="text-[10px] uppercase tracking-wider text-yellow-400/80">
                        {log.actorRole}
                      </p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#ccc]">{log.entityType}</td>
                    <td className="py-3 px-4 text-[#ababab] max-w-md break-words">
                      {log.details || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditTrailsAdmin;

