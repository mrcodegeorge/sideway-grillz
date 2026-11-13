import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { enqueueSnackbar } from "notistack";
import {
  FaMoneyBillWave,
  FaReceipt,
  FaChartLine,
  FaUserTie,
  FaPlus,
  FaTrash,
  FaCalendarAlt,
} from "react-icons/fa";
import { getOrders } from "../../https/index";
import {
  getExpenses,
  addExpense,
  deleteExpense,
} from "../../utils/expensesStorage";

const EXPENSE_CATEGORIES = [
  "Ingredients & Food",
  "Beverages",
  "Utilities",
  "Rent",
  "Staff & Wages",
  "Maintenance",
  "Delivery & Fuel",
  "Other",
];

const toDateKey = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const Accounting = () => {
  const queryClient = useQueryClient();
  const userData = useSelector((state) => state.user);

  const todayStr = toDateKey(new Date());
  const currentMonthStr = todayStr.slice(0, 7);

  const [period, setPeriod] = useState("daily"); // "daily" | "weekly" | "monthly" | "all"
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Expense form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Ingredients & Food");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [notes, setNotes] = useState("");

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: getExpenses,
  });

  const addExpenseMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: () => {
      enqueueSnackbar("Expense recorded!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setTitle("");
      setAmount("");
      setNotes("");
    },
    onError: () => {
      enqueueSnackbar("Failed to record expense.", { variant: "error" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      enqueueSnackbar("Expense deleted.", { variant: "info" });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const allOrders = ordersRes?.data?.data || [];

  // Date range predicate for the active period
  const isInSelectedPeriod = (dateValue) => {
    const key = toDateKey(dateValue);
    if (!key) return false;
    if (period === "all") return true;
    if (period === "daily") return key === selectedDate;
    if (period === "monthly") return key.slice(0, 7) === selectedMonth;
    if (period === "weekly") {
      // 7-day window ending on selectedDate (inclusive)
      const end = new Date(`${selectedDate}T23:59:59`);
      const start = new Date(`${selectedDate}T00:00:00`);
      start.setDate(start.getDate() - 6);
      const target = new Date(`${key}T12:00:00`);
      return target >= start && target <= end;
    }
    return true;
  };

  // Exclude cancelled orders from sales metrics
  const filteredOrders = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.orderStatus !== "Cancelled" &&
          isInSelectedPeriod(o.orderDate)
      ),
    [allOrders, period, selectedDate, selectedMonth]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => isInSelectedPeriod(e.expenseDate)),
    [expenses, period, selectedDate, selectedMonth]
  );

  // Totals
  const summary = useMemo(() => {
    let totalSales = 0;
    let cashSales = 0;
    let onlineSales = 0;
    let dineInCount = 0;
    let takeoutCount = 0;
    let deliveryCount = 0;

    filteredOrders.forEach((o) => {
      const amt = Number(o.bills?.totalWithTax || 0);
      totalSales += amt;
      if ((o.paymentMethod || "Cash").toLowerCase() === "cash") {
        cashSales += amt;
      } else {
        onlineSales += amt;
      }
      const oType =
        o.customerDetails?.orderType || (o.table ? "Dine In" : "Takeout");
      if (oType === "Delivery") deliveryCount += 1;
      else if (oType === "Takeout") takeoutCount += 1;
      else dineInCount += 1;
    });

    const totalExpenses = filteredExpenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    );
    const netProfit = totalSales - totalExpenses;

    return {
      totalSales,
      cashSales,
      onlineSales,
      totalExpenses,
      netProfit,
      orderCount: filteredOrders.length,
      expenseCount: filteredExpenses.length,
      dineInCount,
      takeoutCount,
      deliveryCount,
    };
  }, [filteredOrders, filteredExpenses]);

  // Day-by-day breakdown for Weekly / Monthly views
  const periodBreakdown = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      const k = toDateKey(o.orderDate);
      if (!k) return;
      if (!map[k]) map[k] = { date: k, orders: 0, sales: 0, expenses: 0 };
      map[k].orders += 1;
      map[k].sales += Number(o.bills?.totalWithTax || 0);
    });
    filteredExpenses.forEach((e) => {
      const k = toDateKey(e.expenseDate);
      if (!k) return;
      if (!map[k]) map[k] = { date: k, orders: 0, sales: 0, expenses: 0 };
      map[k].expenses += Number(e.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredOrders, filteredExpenses]);

  // Individual Waiter Sales
  const waiterStats = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      const name = o.waiterName || "Staff";
      if (!map[name]) {
        map[name] = {
          name,
          orders: 0,
          cash: 0,
          online: 0,
          total: 0,
        };
      }
      const amt = Number(o.bills?.totalWithTax || 0);
      map[name].orders += 1;
      map[name].total += amt;
      if ((o.paymentMethod || "Cash").toLowerCase() === "cash") {
        map[name].cash += amt;
      } else {
        map[name].online += amt;
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredOrders]);

  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      enqueueSnackbar("Please enter an expense description.", { variant: "warning" });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      enqueueSnackbar("Please enter a valid amount in GH₵.", { variant: "warning" });
      return;
    }
    addExpenseMutation.mutate({
      title,
      category,
      amount,
      expenseDate,
      notes,
      recordedBy: userData?.name || userData?.username || "Admin",
    });
  };

  return (
    <div className="container mx-auto px-6 md:px-4 pb-24 space-y-6">
      {/* Period Controls */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "daily", label: "Daily Sales" },
            { id: "weekly", label: "Weekly (7 Days)" },
            { id: "monthly", label: "Monthly Sales" },
            { id: "all", label: "All Time" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                period === p.id
                  ? "bg-yellow-400 text-gray-900"
                  : "bg-[#1a1a1a] text-[#ababab] hover:text-white border border-[#333]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {(period === "daily" || period === "weekly") && (
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-1.5">
              <FaCalendarAlt className="text-yellow-400 text-xs" />
              <span className="text-xs text-[#ababab]">
                {period === "weekly" ? "Ending:" : "Date:"}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white text-sm focus:outline-none"
              />
            </div>
          )}
          {period === "monthly" && (
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-1.5">
              <FaCalendarAlt className="text-yellow-400 text-xs" />
              <span className="text-xs text-[#ababab]">Month:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white text-sm focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#262626] border border-[#333] rounded-xl p-5">
          <div className="flex items-center justify-between text-[#ababab] text-sm">
            <span>Gross Sales</span>
            <FaMoneyBillWave className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">
            GH₵ {summary.totalSales.toFixed(2)}
          </p>
          <p className="text-xs text-[#ababab] mt-1">
            {summary.orderCount} orders ({summary.dineInCount} Dine In ·{" "}
            {summary.takeoutCount} Takeout · {summary.deliveryCount} Delivery)
          </p>
        </div>

        <div className="bg-[#262626] border border-[#333] rounded-xl p-5">
          <div className="flex items-center justify-between text-[#ababab] text-sm">
            <span>Total Expenses</span>
            <FaReceipt className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400 mt-2">
            GH₵ {summary.totalExpenses.toFixed(2)}
          </p>
          <p className="text-xs text-[#ababab] mt-1">
            {summary.expenseCount} recorded expense{summary.expenseCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="bg-[#262626] border border-[#333] rounded-xl p-5">
          <div className="flex items-center justify-between text-[#ababab] text-sm">
            <span>Net Profit</span>
            <FaChartLine className="text-yellow-400" />
          </div>
          <p
            className={`text-2xl font-bold mt-2 ${
              summary.netProfit >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            GH₵ {summary.netProfit.toFixed(2)}
          </p>
          <p className="text-xs text-[#ababab] mt-1">Gross Sales minus Expenses</p>
        </div>

        <div className="bg-[#262626] border border-[#333] rounded-xl p-5">
          <div className="flex items-center justify-between text-[#ababab] text-sm">
            <span>Payment Breakdown</span>
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[#ababab]">Cash:</span>
              <span className="font-bold text-yellow-400">
                GH₵ {summary.cashSales.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#ababab]">Online (Paystack):</span>
              <span className="font-bold text-blue-400">
                GH₵ {summary.onlineSales.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Waiter Performance + Period Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Individual Waiter Sales */}
        <div className="bg-[#262626] border border-[#333] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <FaUserTie className="text-yellow-400" /> Waiter Sales Performance
            </h3>
            <span className="text-xs text-[#ababab]">
              {waiterStats.length} active staff
            </span>
          </div>

          {ordersLoading ? (
            <p className="text-sm text-[#ababab]">Loading waiter sales...</p>
          ) : waiterStats.length === 0 ? (
            <p className="text-sm text-[#ababab]">
              No sales recorded for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#f5f5f5]">
                <thead className="bg-[#1a1a1a] text-[#ababab] text-xs uppercase">
                  <tr>
                    <th className="p-3">Waiter</th>
                    <th className="p-3 text-center">Orders</th>
                    <th className="p-3 text-right">Cash</th>
                    <th className="p-3 text-right">Online</th>
                    <th className="p-3 text-right">Total Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {waiterStats.map((w) => {
                    const share =
                      summary.totalSales > 0
                        ? Math.round((w.total / summary.totalSales) * 100)
                        : 0;
                    return (
                      <tr
                        key={w.name}
                        className="border-b border-[#333] hover:bg-[#2f2f2f]"
                      >
                        <td className="p-3">
                          <div className="font-semibold text-white">{w.name}</div>
                          <div className="w-24 h-1.5 bg-[#1a1a1a] rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-yellow-400"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center">{w.orders}</td>
                        <td className="p-3 text-right text-yellow-400">
                          GH₵ {w.cash.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-blue-400">
                          GH₵ {w.online.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-green-400">
                          GH₵ {w.total.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daily Breakdown Table (especially useful in Weekly / Monthly / All Time) */}
        <div className="bg-[#262626] border border-[#333] rounded-xl p-5">
          <h3 className="text-white font-bold text-lg mb-4">
            Daily Breakdown ({period.toUpperCase()})
          </h3>
          {periodBreakdown.length === 0 ? (
            <p className="text-sm text-[#ababab]">
              No transactions or expenses in this period.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm text-[#f5f5f5]">
                <thead className="bg-[#1a1a1a] text-[#ababab] text-xs uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-center">Orders</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-right">Expenses</th>
                    <th className="p-3 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {periodBreakdown.map((row) => {
                    const net = row.sales - row.expenses;
                    return (
                      <tr
                        key={row.date}
                        className="border-b border-[#333] hover:bg-[#2f2f2f]"
                      >
                        <td className="p-3 font-medium">{row.date}</td>
                        <td className="p-3 text-center">{row.orders}</td>
                        <td className="p-3 text-right text-green-400">
                          GH₵ {row.sales.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-red-400">
                          GH₵ {row.expenses.toFixed(2)}
                        </td>
                        <td
                          className={`p-3 text-right font-bold ${
                            net >= 0 ? "text-white" : "text-red-400"
                          }`}
                        >
                          GH₵ {net.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Expenses Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Expense Form */}
        <form
          onSubmit={handleAddExpense}
          className="bg-[#262626] border border-[#333] rounded-xl p-5 space-y-3"
        >
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <FaPlus className="text-yellow-400 text-sm" /> Record Expense
          </h3>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Description
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fresh Chicken & Spices"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#ababab] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#ababab] mb-1">
                Amount (GH₵)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">Date</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Supplier or receipt ref..."
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={addExpenseMutation.isPending}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2.5 rounded-lg text-sm transition-colors"
          >
            {addExpenseMutation.isPending ? "Saving..." : "Add Expense"}
          </button>
        </form>

        {/* Expenses List */}
        <div className="lg:col-span-2 bg-[#262626] border border-[#333] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">
              Expenses Ledger ({filteredExpenses.length})
            </h3>
            <span className="text-sm font-bold text-red-400">
              Total: GH₵ {summary.totalExpenses.toFixed(2)}
            </span>
          </div>

          {expensesLoading ? (
            <p className="text-sm text-[#ababab]">Loading expenses...</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="text-sm text-[#ababab]">
              No expenses recorded for this period.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-sm text-[#f5f5f5]">
                <thead className="bg-[#1a1a1a] text-[#ababab] text-xs uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b border-[#333] hover:bg-[#2f2f2f]"
                    >
                      <td className="p-3 text-xs text-[#ababab]">
                        {exp.expenseDate}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-white">
                          {exp.title}
                        </div>
                        {exp.notes && (
                          <div className="text-xs text-[#ababab]">
                            {exp.notes}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="bg-[#1a1a1a] border border-[#383838] px-2 py-0.5 rounded text-xs text-yellow-400">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-red-400">
                        GH₵ {Number(exp.amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => deleteExpenseMutation.mutate(exp.id)}
                          className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-950/30"
                          title="Delete expense"
                        >
                          <FaTrash size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Accounting;

