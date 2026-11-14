import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import { useSelector } from "react-redux";

const Orders = () => {
  const [status, setStatus] = useState("all");
  const userData = useSelector((state) => state.user);
  const isAdmin = (userData.role || "").toLowerCase() === "admin";

  useEffect(() => {
    document.title = "POS | Orders";
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" });
  }

  const allOrders = resData?.data?.data || [];

  const filteredOrders = useMemo(() => {
    if (status === "all") return allOrders;
    const statusMap = {
      progress: "InProgress",
      ready: "Ready",
      completed: "Completed",
    };
    return allOrders.filter((o) => o.orderStatus === statusMap[status]);
  }, [allOrders, status]);

  const totalSales = useMemo(() => {
    return allOrders
      .reduce((sum, o) => sum + Number(o.bills?.totalWithTax ?? o.bills?.total ?? 0), 0)
      .toFixed(2);
  }, [allOrders]);

  return (
    <section className="bg-[#1f1f1f]  h-[calc(100vh-5rem)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-10 py-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
              {isAdmin ? "Orders" : "My Orders & Sales History"}
            </h1>
            <p className="text-xs text-[#ababab] mt-0.5">
              {isAdmin ? "All restaurant orders" : `${userData.name || "Your"} personal sales:`}{" "}
              <span className="text-yellow-400 font-semibold">
                {allOrders.length} order(s) • GH₵ {totalSales}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-around gap-4">
          <button onClick={() => setStatus("all")} className={`text-[#ababab] text-lg ${status === "all" && "bg-[#383838] text-white"} rounded-lg px-5 py-2 font-semibold cursor-pointer`}>
            All
          </button>
          <button onClick={() => setStatus("progress")} className={`text-[#ababab] text-lg ${status === "progress" && "bg-[#383838] text-white"} rounded-lg px-5 py-2 font-semibold cursor-pointer`}>
            In Progress
          </button>
          <button onClick={() => setStatus("ready")} className={`text-[#ababab] text-lg ${status === "ready" && "bg-[#383838] text-white"} rounded-lg px-5 py-2 font-semibold cursor-pointer`}>
            Ready
          </button>
          <button onClick={() => setStatus("completed")} className={`text-[#ababab] text-lg ${status === "completed" && "bg-[#383838] text-white"} rounded-lg px-5 py-2 font-semibold cursor-pointer`}>
            Completed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-16 py-4 overflow-y-scroll h-[calc(100vh-13rem)] scrollbar-hide">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            return <OrderCard key={order._id} order={order} />;
          })
        ) : (
          <p className="col-span-3 text-gray-500">No orders available</p>
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default Orders;
