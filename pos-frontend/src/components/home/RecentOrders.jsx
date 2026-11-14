import React, { useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import OrderList from "./OrderList";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https/index";
import { useNavigate } from "react-router-dom";

const RecentOrders = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: resData, isLoading, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" });
  }

  const orders = useMemo(() => {
    const list = resData?.data?.data || [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const name = (o.customerDetails?.name || "").toLowerCase();
      const phone = (o.customerDetails?.phone || "").toLowerCase();
      const id = String(o._id || o.id || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [resData, searchTerm]);

  return (
    <div className="px-8 mt-6">
      <div className="bg-[#1a1a1a] w-full h-[450px] rounded-lg">
        <div className="flex justify-between items-center px-6 py-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            Recent Orders
          </h1>
          <button
            type="button"
            onClick={() => navigate("/orders")}
            className="text-[#025cca] hover:underline text-sm font-semibold cursor-pointer"
          >
            View all
          </button>
        </div>

        <div className="flex items-center gap-4 bg-[#1f1f1f] rounded-[15px] px-6 py-4 mx-6">
          <FaSearch className="text-[#f5f5f5]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search recent orders"
            className="bg-[#1f1f1f] outline-none text-[#f5f5f5] w-full"
          />
        </div>

        {/* Order list */}
        <div className="mt-4 px-6 overflow-y-scroll h-[300px] scrollbar-hide">
          {isLoading ? (
            <p className="text-gray-400">Loading recent orders...</p>
          ) : orders.length > 0 ? (
            orders.map((order) => {
              return <OrderList key={order._id} order={order} />;
            })
          ) : (
            <p className="col-span-3 text-gray-500">No orders available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentOrders;
