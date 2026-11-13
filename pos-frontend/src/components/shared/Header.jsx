import React, { useState } from "react";
import { FaSearch, FaUserCircle, FaBell, FaSignOutAlt, FaTachometerAlt } from "react-icons/fa";
import logo from "../../assets/images/logo.png";
import { useDispatch, useSelector } from "react-redux";
import { useMutation } from "@tanstack/react-query";
import { logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave } from "react-icons/fa6";
import ShiftHandoverModal from "./ShiftHandoverModal";

const Header = () => {
  const userData = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showShiftModal, setShowShiftModal] = useState(false);

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

  const isAdmin = (userData.role || "").toLowerCase() === "admin";

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

          <div className="bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] rounded-xl p-2.5 cursor-pointer text-[#ababab] transition-colors">
            <FaBell className="text-xl" />
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
    </>
  );
};

export default Header;
