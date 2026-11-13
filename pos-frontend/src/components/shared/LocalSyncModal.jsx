import React, { useEffect, useState } from "react";
import { FaTimes, FaDownload, FaSyncAlt, FaDesktop, FaAndroid, FaDatabase, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";
import { useQueryClient } from "@tanstack/react-query";
import {
  getLocalAgentStatus,
  triggerLocalAgentSync,
  generateLocalSyncScript,
  generateWindowsBatLauncher,
  downloadTextFile,
} from "../../utils/localSyncAgent";
import { getOfflineOrders } from "../../utils/offlineQueue";

const LocalSyncModal = ({ isOpen, onClose, deferredPrompt, onInstallPwa }) => {
  const queryClient = useQueryClient();
  const [agentStatus, setAgentStatus] = useState({ running: false });
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState("pc");
  const [browserPendingCount, setBrowserPendingCount] = useState(0);

  const refreshStatus = async () => {
    setChecking(true);
    try {
      const status = await getLocalAgentStatus();
      setAgentStatus(status);
      setBrowserPendingCount(getOfflineOrders().length);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();
    const timer = setInterval(refreshStatus, 5000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadScript = () => {
    const script = generateLocalSyncScript();
    downloadTextFile("sideways-local-sync.mjs", script);
    enqueueSnackbar("Downloaded sideways-local-sync.mjs!", { variant: "success" });
  };

  const handleDownloadBat = () => {
    downloadTextFile("start-sideways-sync.bat", generateWindowsBatLauncher());
    enqueueSnackbar("Downloaded start-sideways-sync.bat! Keep it in the same folder as sideways-local-sync.mjs.", {
      variant: "info",
    });
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await triggerLocalAgentSync();
      if (res?.ok) {
        enqueueSnackbar(
          res.syncedCount > 0
            ? `Local Agent synced ${res.syncedCount} order(s) to cloud!`
            : "Local database is up to date!",
          { variant: "success" }
        );
        queryClient.invalidateQueries(["orders"]);
        queryClient.invalidateQueries(["tables"]);
      } else {
        enqueueSnackbar(res?.error || "Currently offline. Will retry automatically.", {
          variant: "warning",
        });
      }
      await refreshStatus();
    } catch {
      enqueueSnackbar("Could not reach Local Sync Agent on 127.0.0.1:4123.", {
        variant: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#2f2f2f] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] sticky top-0 bg-[#1a1a1a] z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-400/15 text-yellow-400">
              <FaDatabase size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#f5f5f5]">
                Background Local DB &amp; Synchronizer
              </h2>
              <p className="text-xs text-[#888]">
                Run a lightweight background sync service on PC or Android for rock-solid offline mode
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#888] hover:text-white p-1.5 rounded-lg hover:bg-[#2a2a2a] cursor-pointer"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Card */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {agentStatus.running ? (
                  <FaCheckCircle className="text-emerald-400" size={16} />
                ) : (
                  <FaExclamationCircle className="text-amber-400" size={16} />
                )}
                <span className="text-sm font-semibold text-[#f5f5f5]">
                  Local Sync Agent (127.0.0.1:4123):{" "}
                  <span className={agentStatus.running ? "text-emerald-400" : "text-amber-400"}>
                    {agentStatus.running ? "Running" : "Not Detected"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshStatus}
                  disabled={checking}
                  className="text-xs px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[#303030] text-[#ccc] cursor-pointer"
                >
                  {checking ? "Checking..." : "Refresh"}
                </button>
                {agentStatus.running && (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold cursor-pointer disabled:opacity-60"
                  >
                    <FaSyncAlt className={syncing ? "animate-spin" : ""} size={11} />
                    <span>{syncing ? "Syncing..." : "Sync Now"}</span>
                  </button>
                )}
              </div>
            </div>

            {agentStatus.running ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-[#1d1d1d] rounded-lg p-2.5 border border-[#2a2a2a]">
                  <p className="text-[11px] text-[#888]">Cloud Link</p>
                  <p className={`text-xs font-bold mt-0.5 ${agentStatus.online ? "text-emerald-400" : "text-amber-400"}`}>
                    {agentStatus.online ? "Online" : "Offline"}
                  </p>
                </div>
                <div className="bg-[#1d1d1d] rounded-lg p-2.5 border border-[#2a2a2a]">
                  <p className="text-[11px] text-[#888]">Pending Orders</p>
                  <p className="text-xs font-bold text-[#f5f5f5] mt-0.5">
                    {agentStatus.pendingCount ?? 0}
                  </p>
                </div>
                <div className="bg-[#1d1d1d] rounded-lg p-2.5 border border-[#2a2a2a]">
                  <p className="text-[11px] text-[#888]">Cached Tables</p>
                  <p className="text-xs font-bold text-[#f5f5f5] mt-0.5">
                    {agentStatus.cachedTablesCount ?? 0}
                  </p>
                </div>
                <div className="bg-[#1d1d1d] rounded-lg p-2.5 border border-[#2a2a2a]">
                  <p className="text-[11px] text-[#888]">Cached Orders</p>
                  <p className="text-xs font-bold text-[#f5f5f5] mt-0.5">
                    {agentStatus.cachedOrdersCount ?? 0}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#999]">
                Browser built-in offline cache is still active ({browserPendingCount} queued in browser).
                Download and run the script below for disk-backed background sync even when the browser closes.
              </p>
            )}
          </div>

          {/* Download Buttons */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-[#f5f5f5]">
              1. Download Background Script
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownloadScript}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
              >
                <FaDownload size={13} />
                <span>Download sideways-local-sync.mjs</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBat}
                className="flex items-center gap-2 bg-[#252525] hover:bg-[#323232] border border-[#3a3a3a] text-[#f5f5f5] font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
              >
                <FaDesktop size={13} />
                <span>Download Windows Launcher (.bat)</span>
              </button>

              {deferredPrompt && (
                <button
                  type="button"
                  onClick={onInstallPwa}
                  className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
                >
                  <FaAndroid size={14} />
                  <span>Install PWA App</span>
                </button>
              )}
            </div>
          </div>

          {/* Setup Guide Tabs */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-[#2a2a2a] pb-2">
              <button
                type="button"
                onClick={() => setTab("pc")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${tab === "pc" ? "bg-yellow-400 text-black" : "bg-[#242424] text-[#aaa]"
                  }`}
              >
                <FaDesktop size={12} />
                <span>PC (Windows / Mac / Linux)</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("android")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${tab === "android" ? "bg-yellow-400 text-black" : "bg-[#242424] text-[#aaa]"
                  }`}
              >
                <FaAndroid size={13} />
                <span>Android Phone (Termux)</span>
              </button>
            </div>

            {tab === "pc" ? (
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-xs text-[#ccc] space-y-2">
                <p className="font-semibold text-[#f5f5f5]">How to run on PC:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-[#aaa]">
                  <li>Install Node.js 18+ (one-time) from <span className="text-yellow-400">nodejs.org</span>.</li>
                  <li>Place <code className="text-yellow-300">sideways-local-sync.mjs</code> and <code className="text-yellow-300">start-sideways-sync.bat</code> in the same folder.</li>
                  <li>On Windows, double-click <code className="text-yellow-300">start-sideways-sync.bat</code> (or run <code className="text-yellow-300">node sideways-local-sync.mjs</code> on Mac/Linux).</li>
                  <li>Leave it running in the background — the POS automatically detects <code className="text-yellow-300">127.0.0.1:4123</code> and saves/syncs orders to disk!</li>
                </ol>
              </div>
            ) : (
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-xs text-[#ccc] space-y-2">
                <p className="font-semibold text-[#f5f5f5]">How to run on Android Phone:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-[#aaa]">
                  <li>Install <span className="text-yellow-400 font-semibold">Termux</span> (from F-Droid or GitHub Releases).</li>
                  <li>Open Termux and grant storage access + install Node.js:</li>
                </ol>
                <pre className="bg-black/60 border border-[#2a2a2a] rounded-lg p-2.5 text-[11px] text-emerald-300 overflow-x-auto">
                  {`termux-setup-storage
pkg update -y && pkg install nodejs -y
termux-wake-lock
node ~/storage/downloads/sideways-local-sync.mjs`}
                </pre>
                <p className="text-[11px] text-[#888]">
                  Tip: Swipe down the Termux notification and tap &quot;Acquire wakelock&quot; so Android keeps syncing in the background while waiters use the POS in Chrome.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalSyncModal;

