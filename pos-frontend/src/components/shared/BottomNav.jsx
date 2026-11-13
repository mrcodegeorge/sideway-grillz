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
  FaCamera,
  FaSearch,
  FaKey,
  FaCompass,
} from "react-icons/fa";
import { FaMoneyBillWave } from "react-icons/fa6";
import { BiSolidDish } from "react-icons/bi";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Modal from "./Modal";
import { useDispatch, useSelector } from "react-redux";
import { setCustomer, updateTable } from "../../redux/slices/customerSlice";
import { removeUser } from "../../redux/slices/userSlice";
import { adminChangeUserPin, getOrders, logout } from "../../https";
import { extractCustomersFromOrders } from "../../utils/customersHelper";
import ShiftHandoverModal from "./ShiftHandoverModal";
import IncidentReportModal from "./IncidentReportModal";
import CashierTour, { TOUR_STORAGE_KEY } from "./CashierTour";
import { enqueueSnackbar } from "notistack";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const userData = useSelector((state) => state.user);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showSelfPinModal, setShowSelfPinModal] = useState(false);
  const [selfNewPin, setSelfNewPin] = useState("");
  const [selfConfirmPin, setSelfConfirmPin] = useState("");
  const [savingSelfPin, setSavingSelfPin] = useState(false);
  const [showTour, setShowTour] = useState(() => !localStorage.getItem(TOUR_STORAGE_KEY));
  const [guestCount, setGuestCount] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState("Dine In");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: ordersRes } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    enabled: isModalOpen,
  });

  const existingCustomers = React.useMemo(() => {
    const orders = ordersRes?.data?.data || [];
    return extractCustomersFromOrders(orders);
  }, [ordersRes]);

  const matchedCustomers = React.useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return existingCustomers
      .filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [existingCustomers, customerSearch]);

  const handleSelectExistingCustomer = (c) => {
    setName(c.name || "");
    setPhone(c.phone || "");
    if (c.deliveryAddress) {
      setDeliveryAddress(c.deliveryAddress);
    }
    setCustomerSearch("");
  };

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
    setCustomerSearch("");
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
        data-tour="nav-home"
        onClick={() => navigate("/")}
        className={`flex items-center justify-center font-bold ${isActive("/") ? "text-[#f5f5f5] bg-[#343434]" : "text-[#ababab]"
          } w-[300px] rounded-[20px]`}
      >
        <FaHome className="inline mr-2" size={20} /> <p>Home</p>
      </button>
      <button
        data-tour="nav-orders"
        onClick={() => navigate("/orders")}
        className={`flex items-center justify-center font-bold ${isActive("/orders") ? "text-[#f5f5f5] bg-[#343434]" : "text-[#ababab]"
          } w-[300px] rounded-[20px]`}
      >
        <FaList className="inline mr-2" size={18} /> <p>Orders</p>
      </button>
      <button
        data-tour="nav-tables"
        onClick={() => navigate("/tables")}
        className={`flex items-center justify-center font-bold ${isActive("/tables") ? "text-[#f5f5f5] bg-[#343434]" : "text-[#ababab]"
          } w-[300px] rounded-[20px]`}
      >
        <FaTable className="inline mr-2" size={18} /> <p>Tables</p>
      </button>
      <div className="relative flex justify-center w-[300px]" ref={moreRef} data-tour="nav-more">
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
                setShowIncidentModal(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#f5f5f5] hover:bg-[#2c2c2c] rounded-lg transition-colors text-left"
            >
              <FaCamera className="text-red-400" size={15} />
              <span>Report Issue / Snap Photo</span>
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

            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                setShowTour(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#f5f5f5] hover:bg-[#2c2c2c] rounded-lg transition-colors text-left"
            >
              <FaCompass className="text-yellow-400" size={15} />
              <span>Cashier Tour Guide</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                setSelfNewPin("");
                setSelfConfirmPin("");
                setShowSelfPinModal(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#f5f5f5] hover:bg-[#2c2c2c] rounded-lg transition-colors text-left"
            >
              <FaKey className="text-yellow-400" size={14} />
              <span>Change My PIN / Password</span>
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
        data-tour="create-order"
        disabled={isActive("/tables") || isActive("/menu")}
        onClick={openModal}
        className="absolute bottom-6 bg-[#F6B100] text-[#f5f5f5] rounded-full p-4 items-center"
      >
        <BiSolidDish size={40} />
      </button>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Create Order">
        <div className="mb-4 relative">
          <label className="block text-[#ababab] mb-1.5 text-xs font-medium">
            Search Existing Customer (Optional)
          </label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-[#1f1f1f] border border-[#333]">
            <FaSearch className="text-[#ababab] text-xs" />
            <input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              type="text"
              placeholder="Search by name or phone..."
              className="bg-transparent flex-1 text-sm text-white focus:outline-none"
            />
          </div>
          {matchedCustomers.length > 0 && (
            <div className="mt-1 bg-[#1a1a1a] border border-[#383838] rounded-lg max-h-40 overflow-y-auto shadow-xl">
              {matchedCustomers.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleSelectExistingCustomer(c)}
                  className="w-full text-left px-3 py-2 hover:bg-[#2c2c2c] border-b border-[#2a2a2a] last:border-b-0 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="text-[#ababab]">{c.phone || "No phone"}</p>
                  </div>
                  <span className="text-yellow-400 font-semibold">
                    {c.totalOrders} order{c.totalOrders === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
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

      <IncidentReportModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
      />

      <CashierTour
        isOpen={showTour}
        onClose={() => setShowTour(false)}
      />

      {showSelfPinModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (selfNewPin.trim().length < 4) {
                enqueueSnackbar("PIN / password must be at least 4 characters.", { variant: "warning" });
                return;
              }
              if (selfNewPin !== selfConfirmPin) {
                enqueueSnackbar("PINs do not match.", { variant: "warning" });
                return;
              }
              setSavingSelfPin(true);
              try {
                await adminChangeUserPin({
                  userId: userData?._id || userData?.id,
                  newPin: selfNewPin,
                  isSelf: true,
                });
                enqueueSnackbar("Your PIN / password has been updated!", { variant: "success" });
                setShowSelfPinModal(false);
              } catch (err) {
                enqueueSnackbar(err?.response?.data?.message || "Failed to update PIN.", { variant: "error" });
              } finally {
                setSavingSelfPin(false);
              }
            }}
            className="bg-[#262626] border border-[#383838] rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#333] pb-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FaKey className="text-yellow-400" /> Change My PIN / Password
              </h3>
              <button
                type="button"
                onClick={() => setShowSelfPinModal(false)}
                className="text-[#ababab] hover:text-white"
              >
                <FaTimes />
              </button>
            </div>
            <div>
              <label className="block text-xs text-[#ababab] mb-1">New PIN / Password (4+ chars)</label>
              <input
                type="password"
                value={selfNewPin}
                onChange={(e) => setSelfNewPin(e.target.value)}
                placeholder="Enter new PIN / password"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs text-[#ababab] mb-1">Confirm New PIN / Password</label>
              <input
                type="password"
                value={selfConfirmPin}
                onChange={(e) => setSelfConfirmPin(e.target.value)}
                placeholder="Confirm new PIN / password"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
            <button
              type="submit"
              disabled={savingSelfPin}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2.5 rounded-lg text-sm"
            >
              {savingSelfPin ? "Updating..." : "Save New PIN / Password"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default BottomNav;
