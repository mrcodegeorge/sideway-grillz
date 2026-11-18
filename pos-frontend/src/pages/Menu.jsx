import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { FaUtensils } from "react-icons/fa";
import MenuContainer from "../components/menu/MenuContainer";
import CustomerInfo from "../components/menu/CustomerInfo";
import CartInfo from "../components/menu/CartInfo";
import Bill from "../components/menu/Bill";
import { useSelector } from "react-redux";

const Menu = () => {

  useEffect(() => {
    document.title = "POS | Menu"
  }, [])

  const customerData = useSelector((state) => state.customer);

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] lg:h-[calc(100vh-5rem)] lg:overflow-hidden flex flex-col lg:flex-row gap-3 pb-24 lg:pb-0">
      {/* Left Div */}
      <div className="flex-[3] min-w-0 lg:overflow-y-auto scrollbar-hide">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 lg:px-10 py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <BackButton />
            <h1 className="text-[#f5f5f5] text-xl sm:text-2xl font-bold tracking-wider">
              Menu
            </h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-create-order-modal"))}
              className="px-3 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold cursor-pointer transition-colors"
            >
              + New Client / Order
            </button>
            <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer">
              <FaUtensils className="text-[#f5f5f5] text-2xl sm:text-4xl" />
              <div className="flex flex-col items-start">
                <h1 className="text-sm sm:text-md text-[#f5f5f5] font-semibold tracking-wide">
                  {customerData.customerName || "Walk-in / Select Client"}
                </h1>
                <p className="text-xs text-[#ababab] font-medium">
                  {customerData.orderType === "Dine In"
                    ? `Table : ${customerData.table?.tableNo || "N/A"}`
                    : customerData.orderType || "POS"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <MenuContainer />
      </div>
      {/* Right Div */}
      <div className="w-full lg:w-auto lg:flex-[1] bg-[#1a1a1a] mt-2 lg:mt-4 lg:mr-3 lg:h-[calc(100vh-7rem)] rounded-lg pt-2 overflow-y-auto">
        {/* Customer Info */}
        <CustomerInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Cart Items */}
        <CartInfo />
        <hr className="border-[#2a2a2a] border-t-2" />
        {/* Bills */}
        <Bill />
      </div>

      <BottomNav />
    </section>
  );
};

export default Menu;
