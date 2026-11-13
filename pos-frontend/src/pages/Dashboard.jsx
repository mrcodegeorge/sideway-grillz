import React, { useState, useEffect } from "react";
import { FaTable, FaList } from "react-icons/fa";
import { BiSolidDish } from "react-icons/bi";
import Metrics from "../components/dashboard/Metrics";
import RecentOrders from "../components/dashboard/RecentOrders";
import Modal from "../components/dashboard/Modal";
import ShiftHandoversAdmin from "../components/dashboard/ShiftHandoversAdmin";
import Accounting from "../components/dashboard/Accounting";

const buttons = [
  { label: "Add Table", icon: <FaTable />, action: "table" },
  { label: "Add Category", icon: <FaList />, action: "category" },
  { label: "Add Dishes", icon: <BiSolidDish />, action: "dishes" },
];

const tabs = ["Metrics", "Orders", "Accounting", "Shift Handovers"];

const Dashboard = () => {
  useEffect(() => {
    document.title = "Sideways Grillz | Admin Dashboard";
  }, []);

  const [modalType, setModalType] = useState(null);
  const [activeTab, setActiveTab] = useState("Metrics");

  const handleOpenModal = (action) => {
    setModalType(action);
  };

  return (
    <div className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)]">
      <div className="container mx-auto flex items-center justify-between py-8 px-6 md:px-4">
        <div className="flex items-center gap-3">
          {buttons.map(({ label, icon, action }) => {
            return (
              <button
                key={label}
                onClick={() => handleOpenModal(action)}
                className="bg-[#1a1a1a] hover:bg-[#262626] border border-[#2e2e2e] px-6 py-2.5 rounded-xl text-[#f5f5f5] font-semibold text-sm flex items-center gap-2 transition-colors"
              >
                {label} {icon}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isActive
                  ? "bg-yellow-400 text-gray-900 shadow-md shadow-yellow-500/20"
                  : "bg-[#1a1a1a] text-[#ababab] hover:text-white border border-[#2e2e2e]"
                  }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "Metrics" && <Metrics />}
      {activeTab === "Orders" && <RecentOrders />}
      {activeTab === "Accounting" && <Accounting />}
      {activeTab === "Shift Handovers" && <ShiftHandoversAdmin />}

      {modalType && (
        <Modal modalType={modalType} onClose={() => setModalType(null)} />
      )}
    </div>
  );
};

export default Dashboard;
