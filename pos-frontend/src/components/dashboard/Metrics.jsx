import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrders, getTables } from "../../https";
import { getExpenses } from "../../utils/expensesStorage";
import { getMenus } from "../../utils/menuStorage";

const PERIOD_OPTIONS = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "Last 7 Days", days: 7 },
  { id: "30d", label: "Last 30 Days", days: 30 },
  { id: "all", label: "All Time", days: null },
];

const isInPeriod = (dateStr, days) => {
  if (!days) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (days === 1) {
    return d.toDateString() === now.toDateString();
  }
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d >= cutoff;
};

const Metrics = () => {
  const [period, setPeriod] = useState("7d");
  const activePeriod = PERIOD_OPTIONS.find((p) => p.id === period) || PERIOD_OPTIONS[1];

  const { data: ordersRes, refetch: refetchOrders, isFetching: fetchingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: getExpenses,
  });

  const { data: tablesRes } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
  });

  const menus = getMenus();

  const stats = useMemo(() => {
    const allOrders = ordersRes?.data?.data || [];
    const tables = tablesRes?.data?.data || [];

    const periodOrders = allOrders.filter((o) =>
      isInPeriod(o.orderDate || o.createdAt, activePeriod.days)
    );
    const validOrders = periodOrders.filter((o) => o.orderStatus !== "Cancelled");
    const revenue = validOrders.reduce(
      (sum, o) => sum + Number(o.bills?.totalWithTax ?? o.bills?.total ?? 0),
      0
    );

    const periodExpenses = expenses.filter((e) =>
      isInPeriod(e.expenseDate, activePeriod.days)
    );
    const totalExpenses = periodExpenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    );
    const netBalance = revenue - totalExpenses;

    const completedCount = validOrders.filter((o) => o.orderStatus === "Completed").length;
    const activeOrdersCount = allOrders.filter((o) =>
      ["InProgress", "Ready"].includes(o.orderStatus)
    ).length;

    const totalCategories = menus.length;
    const totalDishes = menus.reduce((sum, c) => sum + (c.items?.length || 0), 0);
    const bookedTables = tables.filter((t) => t.status === "Booked").length;

    return {
      performanceCards: [
        {
          title: "Revenue",
          value: `GH₵ ${revenue.toFixed(2)}`,
          sub: `${validOrders.length} valid order(s)`,
          color: "#5b45b0",
        },
        {
          title: "Total Orders",
          value: String(periodOrders.length),
          sub: `${completedCount} completed`,
          color: "#285430",
        },
        {
          title: "Expenses",
          value: `GH₵ ${totalExpenses.toFixed(2)}`,
          sub: `${periodExpenses.length} expense entry(s)`,
          color: "#7f167f",
        },
        {
          title: "Net Balance",
          value: `GH₵ ${netBalance.toFixed(2)}`,
          sub: netBalance >= 0 ? "Positive cashflow" : "Expenses exceed sales",
          color: netBalance >= 0 ? "#1f6e8c" : "#8c3333",
        },
      ],
      itemCards: [
        {
          title: "Total Categories",
          value: String(totalCategories),
          sub: "Active menu groups",
          color: "#5b45b0",
        },
        {
          title: "Total Dishes",
          value: String(totalDishes),
          sub: "Items on menu",
          color: "#285430",
        },
        {
          title: "Active Orders",
          value: String(activeOrdersCount),
          sub: "In Progress / Ready",
          color: "#735f32",
        },
        {
          title: "Total Tables",
          value: `${bookedTables} / ${tables.length}`,
          sub: "Booked / Total",
          color: "#1d2569",
        },
      ],
    };
  }, [ordersRes, expenses, tablesRes, menus, activePeriod]);

  const handleRefresh = () => {
    refetchOrders();
    refetchExpenses();
  };

  return (
    <div className="container mx-auto py-2 px-4 sm:px-6 md:px-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Overall Performance
          </h2>
          <p className="text-sm text-[#ababab]">
            Live revenue, orders, expenses, and cashflow from Supabase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                period === opt.id
                  ? "bg-yellow-400 text-black font-bold"
                  : "bg-[#1a1a1a] text-[#ababab] border border-[#2e2e2e] hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={fetchingOrders}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#262626] text-[#f5f5f5] border border-[#333] cursor-pointer"
          >
            {fetchingOrders ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.performanceCards.map((metric) => (
          <div
            key={metric.title}
            className="shadow-sm rounded-lg p-4"
            style={{ backgroundColor: metric.color }}
          >
            <div className="flex justify-between items-center">
              <p className="font-medium text-xs text-[#f5f5f5]">{metric.title}</p>
              <p className="font-medium text-[11px] text-white/80">{activePeriod.label}</p>
            </div>
            <p className="mt-2 font-semibold text-2xl text-[#f5f5f5]">{metric.value}</p>
            <p className="mt-1 text-[11px] text-white/75">{metric.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col justify-between mt-12">
        <div>
          <h2 className="font-semibold text-[#f5f5f5] text-xl">
            Item &amp; Operations Details
          </h2>
          <p className="text-sm text-[#ababab]">
            Live overview of menu categories, active dishes, open orders, and tables.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.itemCards.map((item) => (
            <div
              key={item.title}
              className="shadow-sm rounded-lg p-4"
              style={{ backgroundColor: item.color }}
            >
              <p className="font-medium text-xs text-[#f5f5f5]">{item.title}</p>
              <p className="mt-2 font-semibold text-2xl text-[#f5f5f5]">{item.value}</p>
              <p className="mt-1 text-[11px] text-white/75">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Metrics;
