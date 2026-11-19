import React, { useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import {
  FaCheckCircle,
  FaCloud,
  FaDatabase,
  FaDownload,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import {
  checkPrimarySupabaseHealth,
  exportFullDatabaseBackup,
  getBackupCloudConfig,
  getBackupDbStats,
  saveBackupCloudConfig,
  setManualFailoverMode,
  syncFailoverWritesToPrimary,
} from "../../utils/backupDb";
import { getOrders, getTables } from "../../https";

const BackupDbAdmin = () => {
  const [stats, setStats] = useState(null);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudUrl, setCloudUrl] = useState(() => getBackupCloudConfig().url);
  const [cloudKey, setCloudKey] = useState(() => getBackupCloudConfig().anonKey);

  const loadStats = async () => {
    const s = await getBackupDbStats();
    setStats(s);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleCheckHealth = async () => {
    setChecking(true);
    try {
      const state = await checkPrimarySupabaseHealth();
      await loadStats();
      enqueueSnackbar(
        state.primaryHealthy
          ? `Primary Supabase is healthy (${state.lastLatencyMs}ms)`
          : `Primary Supabase unresponsive: ${state.lastError || "Failover active"}`,
        { variant: state.primaryHealthy ? "success" : "warning" }
      );
    } finally {
      setChecking(false);
    }
  };

  const handleRunSnapshot = async () => {
    setSyncing(true);
    try {
      await Promise.all([getTables(), getOrders()]);
      await loadStats();
      enqueueSnackbar("Fresh snapshot saved to IndexedDB Backup Database!", {
        variant: "success",
      });
    } catch {
      enqueueSnackbar("Snapshot completed from available sources.", { variant: "info" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncToPrimary = async () => {
    setSyncing(true);
    try {
      const res = await syncFailoverWritesToPrimary();
      await loadStats();
      enqueueSnackbar(
        res.synced > 0
          ? `Replayed ${res.synced} failover write(s) to Primary Supabase!`
          : "No pending failover writes to replay.",
        { variant: res.failed > 0 ? "warning" : "success" }
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveCloudBackup = (e) => {
    e.preventDefault();
    saveBackupCloudConfig({ url: cloudUrl, anonKey: cloudKey });
    loadStats();
    enqueueSnackbar("Secondary Cloud Backup Supabase config saved!", { variant: "success" });
  };

  const primaryHealthy = stats?.failover?.primaryHealthy ?? true;
  const manualFailover = stats?.failover?.manualFailover ?? false;

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-4 py-4 space-y-5">
      {/* Status Header */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-xl ${primaryHealthy
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-amber-500/20 text-amber-400"
              }`}
          >
            <FaDatabase size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#f5f5f5]">
              Backup Database &amp; Automatic Failover
            </h2>
            <p className="text-xs text-[#ababab]">
              Automatically switches to IndexedDB + optional Secondary Supabase if Primary Supabase goes down or times out
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheckHealth}
            disabled={checking}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#262626] hover:bg-[#333] text-xs font-semibold text-[#f5f5f5] cursor-pointer"
          >
            <FaSyncAlt className={checking ? "animate-spin" : ""} size={12} />
            <span>{checking ? "Checking..." : "Check Primary Health"}</span>
          </button>
          <button
            type="button"
            onClick={exportFullDatabaseBackup}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold cursor-pointer"
          >
            <FaDownload size={12} />
            <span>Download Full JSON Backup</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Primary Supabase</p>
          <p
            className={`text-base font-bold mt-1 flex items-center gap-1.5 ${primaryHealthy ? "text-emerald-400" : "text-amber-400"
              }`}
          >
            {primaryHealthy ? <FaCheckCircle /> : <FaExclamationTriangle />}
            {primaryHealthy ? "Online & Healthy" : "Failover Active"}
          </p>
          {stats?.failover?.lastLatencyMs != null && (
            <p className="text-[10px] text-[#777] mt-0.5">
              Latency: {stats.failover.lastLatencyMs}ms
            </p>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">IndexedDB Backup Snapshot</p>
          <p className="text-base font-bold text-[#f5f5f5] mt-1">
            {stats?.cachedOrdersCount ?? 0} Orders • {stats?.cachedTablesCount ?? 0} Tables
          </p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Pending Failover Writes</p>
          <p className="text-base font-bold text-yellow-400 mt-1">
            {stats?.pendingWritesCount ?? 0} queued
          </p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Secondary Cloud Mirror</p>
          <p className="text-base font-bold text-[#f5f5f5] mt-1">
            {stats?.secondaryCloudConfigured ? "Configured" : "Local IndexedDB Only"}
          </p>
        </div>
      </div>

      {/* Actions & Secondary Cloud Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-[#f5f5f5]">Failover &amp; Snapshot Controls</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRunSnapshot}
              disabled={syncing}
              className="px-4 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333] text-[#f5f5f5] font-semibold cursor-pointer"
            >
              Take Local Snapshot Now
            </button>
            <button
              type="button"
              onClick={handleSyncToPrimary}
              disabled={syncing}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              Replay Pending Writes to Primary
            </button>
          </div>

          <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[#f5f5f5]">Simulate Primary Outage (Test Mode)</p>
              <p className="text-[11px] text-[#888]">
                Force the POS onto the Backup DB to test failover resilience.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setManualFailoverMode(!manualFailover);
                loadStats();
              }}
              className={`px-3.5 py-2 rounded-xl font-bold cursor-pointer ${manualFailover
                  ? "bg-amber-500 text-black"
                  : "bg-[#262626] text-[#ccc] border border-[#333]"
                }`}
            >
              {manualFailover ? "Disable Test Failover" : "Enable Test Failover"}
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSaveCloudBackup}
          className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3 text-xs"
        >
          <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
            <FaCloud className="text-yellow-400" />
            Optional Secondary Backup Supabase
          </h3>
          <p className="text-[11px] text-[#888]">
            Point to a second Supabase project (or set <code>VITE_BACKUP_SUPABASE_URL</code> &amp;{" "}
            <code>VITE_BACKUP_SUPABASE_ANON_KEY</code>) for cloud-to-cloud failover.
          </p>
          <input
            type="url"
            placeholder="https://backup-project.supabase.co"
            value={cloudUrl}
            onChange={(e) => setCloudUrl(e.target.value)}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
          <input
            type="password"
            placeholder="Backup Supabase Anon Key"
            value={cloudKey}
            onChange={(e) => setCloudKey(e.target.value)}
            className="w-full rounded-lg p-2.5 bg-[#141414] border border-[#333] text-[#f5f5f5]"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold cursor-pointer"
          >
            Save Secondary Backup Config
          </button>
        </form>
      </div>
    </div>
  );
};

export default BackupDbAdmin;

