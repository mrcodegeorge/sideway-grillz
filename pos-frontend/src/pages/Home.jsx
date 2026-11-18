import React, { useEffect, useMemo } from "react";
import BottomNav from "../components/shared/BottomNav";
import Greetings from "../components/home/Greetings";
import { BsCashCoin } from "react-icons/bs";
import { FaHourglassHalf } from "react-icons/fa";
import MiniCard from "../components/home/MiniCard";
import RecentOrders from "../components/home/RecentOrders";
import PopularDishes from "../components/home/PopularDishes";
import { useQuery } from "@tanstack/react-query";
import { getOrders } from "../https";

const Home = () => {

  useEffect(() => {
    document.title = "POS | Home"
  }, [])

  const { data: resData } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  const { totalEarnings, inProgressCount } = useMemo(() => {
    const orders = resData?.data?.data || [];
    const total = orders.reduce(
      (sum, o) => sum + Number(o.bills?.totalWithTax ?? o.bills?.total ?? 0),
      0
    );
    const inProgress = orders.filter((o) => o.orderStatus === "InProgress").length;
    return {
      totalEarnings: total.toFixed(2),
      inProgressCount: inProgress,
    };
  }, [resData]);

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] lg:h-[calc(100vh-5rem)] lg:overflow-hidden flex flex-col lg:flex-row gap-3 pb-24 lg:pb-0">
      {/* Left Div */}
      <div className="flex-[3] min-w-0">
        <Greetings />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full gap-3 px-4 sm:px-8 mt-6 sm:mt-8">
          <MiniCard title="Total Earnings" icon={<BsCashCoin />} number={totalEarnings} footerNum={1.6} />
          <MiniCard title="In Progress" icon={<FaHourglassHalf />} number={inProgressCount} footerNum={3.6} />
        </div>
        <RecentOrders />
      </div>
      {/* Right Div */}
      <div className="flex-[2] min-w-0">
        <PopularDishes />
      </div>
      <BottomNav />
    </section>
  );
};

export default Home;
