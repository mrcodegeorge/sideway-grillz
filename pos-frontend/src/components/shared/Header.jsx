import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaUserCircle, FaBell, FaSignOutAlt, FaTachometerAlt, FaDatabase, FaCheckDouble, FaExclamationTriangle, FaUtensils, FaWifi } from "react-icons/fa";
import logo from "../../assets/images/logo.png";
import { useDispatch, useSelector } from "react-redux";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getOrders, logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave } from "react-icons/fa6";
import ShiftHandoverModal from "./ShiftHandoverModal";
import LocalSyncModal from "./LocalSyncModal";
import { getLocalAgentStatus } from "../../utils/localSyncAgent";
import { getOfflineOrders } from "../../utils/offlineQueue";
import { getIncidents } from "../../utils/incidentsStorage";

const Header = () => {
  const userData = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showLocalSyncModal, setShowLocalSyncModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const bellWrapperRef = useRef(null);

  const isAdmin = (userData.role || "").toLowerCase() === "admin";

  const { data: ordersRes } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    refetchInterval: 30000,
  });

  const { data: incidentsList = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: getIncidents,
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const notifications = useMemo(() => {
    const items = [];
    const offlineOrders = getOfflineOrders();
    if (offlineOrders.length > 0) {
      items.push({
        id: `offline-${offlineOrders.length}`,
        type: "offline",
        title: `${offlineOrders.length} offline order(s) pending sync`,
        subtitle: "Tap to open Local Sync & upload",
        action: () => {
          setShowNotifications(false);
          setShowLocalSyncModal(true);
        },
      });
    }

    const orders = ordersRes?.data?.data || [];
    orders
      .filter((o) => o.orderStatus === "Ready" || o.orderStatus === "InProgress")
      .slice(0, 6)
      .forEach((o) => {
        const orderId = o._id || o.id;
        const customer = o.customerDetails?.name || "Walk-in";
        const tableLabel = o.table?.tableNo ? `Table ${o.table.tableNo}` : (o.customerDetails?.orderType || "Order");
        items.push({
          id: `order-${orderId}-${o.orderStatus}`,
          type: o.orderStatus === "Ready" ? "ready" : "progress",
          title: o.orderStatus === "Ready" ? `Ready: ${customer}` : `In Progress: ${customer}`,
          subtitle: `${tableLabel} • ${o.items?.length || 0} item(s)`,
          action: () => {
            setShowNotifications(false);
            navigate("/orders");
          },
        });
      });

    if (isAdmin && Array.isArray(incidentsList)) {
      incidentsList
        .filter((inc) => (inc.status || "Open") === "Open")
        .slice(0, 4)
        .forEach((inc) => {
          items.push({
            id: `incident-${inc.id}`,
            type: "incident",
            title: `Open Incident (${inc.severity || "Medium"})`,
            subtitle: `${inc.category || "Report"} • ${inc.reportedBy || "Staff"}`,
            action: () => {
              setShowNotifications(false);
              navigate("/dashboard");
            },
          });
        });
    }

    return items.filter((item) => !dismissedIds.includes(item.id));
  }, [ordersRes, incidentsList, isAdmin, dismissedIds, navigate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellWrapperRef.current && !bellWrapperRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const checkAgent = async () => {
      const status = await getLocalAgentStatus();
      setAgentRunning(Boolean(status?.running));
    };
    checkAgent();
    const interval = setInterval(checkAgent, 15000);

    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      dispatch(removeUser());
      navigate("/auth");
    },
    onError: (error) => {
      console.error(error);
      dispatch(removeUser());
      navigate("/auth");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      <header className="flex justify-between items-center py-4 px-8 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        {/* LOGO */}
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <img
            src={logo}
            className="h-10 w-10 object-contain rounded-lg border border-[#333] bg-black/40 p-0.5"
            alt="Sideways Grillz logo"
          />
          <div>
            <h1 className="text-xl font-bold text-yellow-400 tracking-wide leading-none">
              Sideways Grillz
            </h1>
            <p className="text-[10px] text-[#888] font-medium tracking-wider uppercase mt-0.5">
              POS Terminal
            </p>
          </div>
        </div>

        {/* SEARCH */}
        <div className="flex items-center gap-4 bg-[#1f1f1f] border border-[#2e2e2e] rounded-xl px-5 py-2 w-[450px]">
          <FaSearch className="text-[#888]" />
          <input
            type="text"
            placeholder="Search dishes, tables, or orders..."
            className="bg-transparent outline-none text-[#f5f5f5] w-full text-sm placeholder-[#666]"
          />
        </div>

        {/* LOGGED USER CONTROLS */}
        <div className="flex items-center gap-4">
          {/* Local DB & Sync Agent Button */}
          <button
            type="button"
            onClick={() => setShowLocalSyncModal(true)}
            className="flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] text-[#f5f5f5] px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Offline Mode & Local Background Sync Agent"
          >
            <span
              className={`h-2 w-2 rounded-full ${agentRunning ? "bg-emerald-400" : "bg-amber-400"
                }`}
            />
            <FaDatabase size={13} className="text-yellow-400" />
            <span className="hidden sm:inline">Local Sync</span>
          </button>

          {/* Shift Cash Handover Button */}
          <button
            type="button"
            onClick={() => setShowShiftModal(true)}
            className="flex items-center gap-2 bg-[#222] hover:bg-[#2c2c2c] border border-yellow-400/40 text-yellow-400 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-yellow-500/10 cursor-pointer"
            title="Calculate and surrender shift cash"
          >
            <FaMoneyBillWave size={15} />
            <span>Shift Handover</span>
          </button>

          {/* Admin Dashboard Quick Link */}
          {isAdmin && (
            <div
              onClick={() => navigate("/dashboard")}
              className="bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] rounded-xl p-2.5 cursor-pointer text-yellow-400 transition-colors"
              title="Admin Dashboard"
            >
              <FaTachometerAlt className="text-xl" />
            </div>
          )}

          <div className="relative" ref={bellWrapperRef}>
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className="relative bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] rounded-xl p-2.5 cursor-pointer text-[#ababab] hover:text-yellow-400 transition-colors"
              title="Notifications"
            >
              <FaBell className="text-xl" />
              {notifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[#1a1a1a] border border-[#2f2f2f] rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#f5f5f5]">
                    Notifications ({notifications.length})
                  </span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDismissedIds((prev) => [...prev, ...notifications.map((n) => n.id)])}
                      className="flex items-center gap-1 text-[11px] text-yellow-400 hover:text-yellow-300 cursor-pointer"
                    >
                      <FaCheckDouble size={11} />
                      <span>Clear all</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#252525]">
                  {notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center text-xs text-[#777]">
                      No active notifications right now.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.action}
                        className="w-full text-left px-4 py-3 hover:bg-[#232323] transition-colors flex items-start gap-3 cursor-pointer"
                      >
                        <div className="mt-0.5">
                          {item.type === "offline" ? (
                            <FaWifi className="text-amber-400" size={14} />
                          ) : item.type === "incident" ? (
                            <FaExclamationTriangle className="text-red-400" size={14} />
                          ) : (
                            <FaUtensils
                              className={item.type === "ready" ? "text-emerald-400" : "text-yellow-400"}
                              size={14}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#f5f5f5] truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-[#888] truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-2 border-l border-[#333]">
            <FaUserCircle className="text-yellow-400 text-3xl" />
            <div className="flex flex-col items-start leading-tight">
              <h2 className="text-sm text-[#f5f5f5] font-bold tracking-wide">
                {userData.name || userData.username || "Staff"}
              </h2>
              <span className="text-[11px] text-yellow-400/80 font-semibold uppercase tracking-wider">
                {userData.role || "Waiter"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[#888] hover:text-red-400 ml-2 transition-colors cursor-pointer p-1"
              title="Sign Out"
            >
              <FaSignOutAlt size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Waiter Cash Handover Modal */}
      <ShiftHandoverModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
      />

      {/* Local Background DB & Sync Agent Modal */}
      <LocalSyncModal
        isOpen={showLocalSyncModal}
        onClose={() => setShowLocalSyncModal(false)}
        deferredPrompt={deferredPrompt}
        onInstallPwa={handleInstallPwa}
      />
    </>
  );
};

export default Header;
