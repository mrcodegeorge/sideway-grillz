import React from "react";
import { FaCheckDouble, FaLongArrowAltRight } from "react-icons/fa";
import { FaCircle, FaUserCheck } from "react-icons/fa6";
import { formatDateAndTime, getAvatarName } from "../../utils/index";

const OrderCard = ({ order }) => {
  const currency = import.meta.env.VITE_PAYSTACK_CURRENCY || "GHS";
  const currencySymbol = currency === "GHS" ? "GH₵" : currency === "NGN" ? "₦" : "$";

  return (
    <div className="w-[500px] bg-[#262626] border border-[#333] p-5 rounded-xl mb-4 shadow-lg">
      <div className="flex items-center gap-5">
        <button className="bg-yellow-400 text-gray-900 p-3 text-xl font-bold rounded-xl shadow-md">
          {getAvatarName(order.customerDetails?.name || "Customer")}
        </button>
        <div className="flex items-center justify-between w-[100%]">
          <div className="flex flex-col items-start gap-1">
            <h1 className="text-[#f5f5f5] text-lg font-bold tracking-wide">
              {order.customerDetails?.name || "Walk-in Guest"}
            </h1>
            <p className="text-[#ababab] text-xs">
              #{Math.floor(new Date(order.orderDate).getTime()).toString().slice(-6)} / Dine in
            </p>
            <p className="text-[#ababab] text-xs">
              Table <FaLongArrowAltRight className="text-[#ababab] mx-1 inline" />{" "}
              <span className="font-bold text-white">
                {order.table?.tableNo ? `Table ${order.table.tableNo}` : "Takeaway"}
              </span>
            </p>

            {/* Waiter Attribution Badge */}
            <div className="flex items-center gap-1.5 mt-1 bg-[#1a1a1a] px-2 py-0.5 rounded-md border border-[#383838]">
              <FaUserCheck className="text-yellow-400 text-xs" />
              <span className="text-[11px] text-yellow-400/90 font-medium">
                Server: <strong className="text-white">{order.waiterName || "Staff"}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {order.orderStatus === "Ready" ? (
              <>
                <p className="text-green-400 bg-green-950/60 border border-green-800/40 px-2.5 py-1 rounded-lg text-xs font-semibold">
                  <FaCheckDouble className="inline mr-1" /> Ready
                </p>
                <p className="text-[#ababab] text-xs">
                  <FaCircle className="inline mr-1.5 text-green-500 text-[8px]" /> Ready to serve
                </p>
              </>
            ) : order.orderStatus === "Completed" ? (
              <>
                <p className="text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2.5 py-1 rounded-lg text-xs font-semibold">
                  <FaCheckDouble className="inline mr-1" /> Completed
                </p>
                <p className="text-[#ababab] text-xs">
                  <FaCircle className="inline mr-1.5 text-blue-500 text-[8px]" /> Paid & Cleared
                </p>
              </>
            ) : (
              <>
                <p className="text-yellow-400 bg-yellow-950/60 border border-yellow-800/40 px-2.5 py-1 rounded-lg text-xs font-semibold">
                  <FaCircle className="inline mr-1 text-[8px]" /> {order.orderStatus}
                </p>
                <p className="text-[#ababab] text-xs">
                  <FaCircle className="inline mr-1.5 text-yellow-500 text-[8px]" /> Preparing
                </p>
              </>
            )}

            {/* Payment Method Badge */}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                order.paymentMethod === "Cash"
                  ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30"
                  : "bg-blue-900/30 text-blue-400 border border-blue-700/30"
              }`}
            >
              {order.paymentMethod || "Cash"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 text-[#ababab] text-xs">
        <p>{formatDateAndTime(order.orderDate)}</p>
        <p>{order.items?.length || 0} Items</p>
      </div>

      <hr className="w-full mt-3 border-t border-[#3a3a3a]" />

      <div className="flex items-center justify-between mt-3">
        <h2 className="text-[#ababab] text-sm font-medium">Total Bill</h2>
        <p className="text-yellow-400 text-lg font-bold">
          {currencySymbol} {Number(order.bills?.totalWithTax || 0).toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default OrderCard;
