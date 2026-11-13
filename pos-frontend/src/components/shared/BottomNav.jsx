import React, { useState, useRef, useEffect } from "react";
import {
  FaHome,
  FaList,
  FaTable,
  FaEllipsisH,
  FaTachometerAlt,
  FaSignOutAlt,
  FaUserCheck,
  FaTimes,
} from "react-icons/fa";
import { FaMoneyBillWave } from "react-icons/fa6";
import { BiSolidDish } from "react-icons/bi";
import { useNavigate, useLocation } from "react-router-dom";
import Modal from "./Modal";
import { useDispatch, useSelector } from "react-redux";
import { setCustomer, updateTable } from "../../redux/slices/customerSlice";
import { removeUser } from "../../redux/slices/userSlice";
import { logout } from "../../https";
import ShiftHandoverModal from "./ShiftHandoverModal";
import { enqueueSnackbar } from "notistack";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const userData = useSelector((state) => state.user);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState("Dine In");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const moreRef = useRef(null);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    };
    if (isMoreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMoreOpen]);

  const increment = () => {
    if (guestCount >= 6) return;
    setGuestCount((prev) => prev + 1);
  };
  const decrement = () => {
    if (guestCount <= 0) return;
    setGuestCount((prev) => prev - 1);
  };

  const isActive = (path) => location.pathname === path;

  const handleCreateOrder = () => {
    if (!name.trim()) {
      enqueueSnackbar("Please enter customer name!", { variant: "warning" });
      return;
    }
    if (orderType === "Delivery" && !deliveryAddress.trim()) {
      enqueueSnackbar("Please enter a delivery address!", { variant: "warning" });
      return;
    }

    dispatch(
      setCustomer({
        name: name.trim(),
        phone,
        guests: orderType === "Dine In" ? guestCount : 0,
        orderType,
        deliveryAddress: orderType === "Delivery" ? deliveryAddress.trim() : "",
      })
    );

    if (orderType === "Dine In") {
      closeModal();
      navigate("/tables");
    } else {
      dispatch(updateTable({ table: null }));
      closeModal();
      navigate("/menu");
    }

    setName("");
    setPhone("");
    setGuestCount(0);
    setDeliveryAddress("");
    setOrderType("Dine In");
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    } finally {
      dispatch(removeUser());
      navigate("/auth");
    }
  };

  const isAdmin = (userData.role || "").toLowerCase() === "admin";

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#262626] p-2 h-16 flex justify-around">
      <button
        onClick={() => navigate("/")}
        className={`flex items-center justify-center font-bold ${isActive("/") ? "text-[#f5f5f5] bg-[#343434]" : "text-[#ababab]"
          } w-[300px] rounded-[20px]`}
      >
        <FaHome className="inline mr-2" size={20} /> <p>Home</p>
      </button>
      <button
        onClick={() => navigate("/orders")}
        className={`flex items-center justify-center font-bold ${isActive("/orders") ? "text-[#f5f5f5] bg-[#343434]" : "text-[#ababab]"
          } w-[300px] rounded-[20px]`}
      >
        <FaList className="inline mr-2" size={18} /> <p>Orders</p>
      </button>
      <button
        onClick={() => navigate("/tables")}
        className={`flex items-center justify-center font-bold ${isActive("/tables") ? "text-[#f5f5f5] bg-[#343434]" : "text-[#ababab]"
          } w-[300px] rounded-[20px]`}
      >
        <FaTable className="inline mr-2" size={18} /> <p>Tables</p>
      </button>
      <div className="relative flex justify-center w-[300px]" ref={moreRef}>
        <button
          type="button"
          onClick={() => setIsMoreOpen((prev) => !prev)}
          className={`flex items-center justify-center font-bold w-full rounded-[20px] transition-colors cursor-pointer ${isMoreOpen || isActive("/dashboard")
              ? "text-[#f5f5f5] bg-[#343434]"
              : "text-[#ababab] hover:text-white"
            }`}
        >
          <FaEllipsisH className="inline mr-2" size={18} /> <p>More</p>
        </button>

        {isMoreOpen && (
          <div className="absolute bottom-16 right-0 w-64 bg-[#1f1f1f] border border-[#383838] rounded-xl shadow-2xl p-2 z-50">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#333] mb-1">
              <div className="flex items-center gap-2">
                <FaUserCheck className="text-yellow-400" size={14} />
                <div>
                  <p className="text-xs font-bold text-white leading-tight">
                    {userData.name || userData.username || "Staff"}
                  </p>
                  <p className="text-[10px] text-yellow-400/80 uppercase font-semibold">
                    {userData.role || "Waiter"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="text-[#888] hover:text-white p-1"
              >
                <FaTimes size={12} />
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  navigate("/dashboard");
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#f5f5f5] hover:bg-[#2c2c2c] rounded-lg transition-colors text-left"
              >
                <FaTachometerAlt className="text-yellow-400" size={15} />
                <span>Admin Dashboard</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                setShowShiftModal(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#f5f5f5] hover:bg-[#2c2c2c] rounded-lg transition-colors text-left"
            >
              <FaMoneyBillWave className="text-green-400" size={15} />
              <span>Shift Handover & Cash</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                navigate("/tables");
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#f5f5f5] hover:bg-[#2c2c2c] rounded-lg transition-colors text-left"
            >
              <FaTable className="text-[#ababab]" size={15} />
              <span>Tables & Seating</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                navigate("/orders");
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#f5f5f5] hover:bg-[#2c2c2c] rounded-lg transition-colors text-left"
            >
              <FaList className="text-[#ababab]" size={15} />
              <span>Orders Queue</span>
            </button>

            <div className="border-t border-[#333] mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/40 rounded-lg transition-colors text-left font-semibold"
              >
                <FaSignOutAlt size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        disabled={isActive("/tables") || isActive("/menu")}
        onClick={openModal}
        className="absolute bottom-6 bg-[#F6B100] text-[#f5f5f5] rounded-full p-4 items-center"
      >
        <BiSolidDish size={40} />
      </button>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Create Order">
        <div>
          <label className="block text-[#ababab] mb-2 text-sm font-medium">Order Type</label>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {["Dine In", "Takeout", "Delivery"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${orderType === type
                    ? "bg-[#F6B100] text-[#1f1f1f]"
                    : "bg-[#1f1f1f] text-[#ababab] hover:text-white border border-[#333]"
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[#ababab] mb-2 text-sm font-medium">Customer Name</label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Enter customer name" className="bg-transparent flex-1 text-white focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">Customer Phone</label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="0241234567" className="bg-transparent flex-1 text-white focus:outline-none" />
          </div>
        </div>
        {orderType === "Dine In" && (
          <div>
            <label className="block mb-2 mt-3 text-sm font-medium text-[#ababab]">Guest</label>
            <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-3 rounded-lg">
              <button type="button" onClick={decrement} className="text-yellow-500 text-2xl">&minus;</button>
              <span className="text-white">{guestCount} Person</span>
              <button type="button" onClick={increment} className="text-yellow-500 text-2xl">&#43;</button>
            </div>
          </div>
        )}
        {orderType === "Delivery" && (
          <div>
            <label className="block mb-2 mt-3 text-sm font-medium text-[#ababab]">Delivery Address</label>
            <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                type="text"
                placeholder="e.g. East Legon, Near Anc Mall"
                className="bg-transparent flex-1 text-white focus:outline-none"
              />
            </div>
          </div>
        )}
        <button type="button" onClick={handleCreateOrder} className="w-full bg-[#F6B100] text-[#1f1f1f] font-bold rounded-lg py-3 mt-8 hover:bg-yellow-500 transition-colors">
          {orderType === "Dine In" ? "Select Table" : `Continue to Menu (${orderType})`}
        </button>
      </Modal>

      <ShiftHandoverModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
      />
    </div>
  );
};

export default BottomNav;
