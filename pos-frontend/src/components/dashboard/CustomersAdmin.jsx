import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaAddressBook, FaDownload, FaSearch } from "react-icons/fa";
import { getOrders } from "../../https/index";
import {
  extractCustomersFromOrders,
  exportCustomersToCsv,
} from "../../utils/customersHelper";
import { formatDateAndTime } from "../../utils";

const CustomersAdmin = () => {
  const [search, setSearch] = useState("");

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  const allCustomers = useMemo(() => {
    const orders = ordersRes?.data?.data || [];
    return extractCustomersFromOrders(orders);
  }, [ordersRes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.deliveryAddress || "").toLowerCase().includes(q)
    );
  }, [allCustomers, search]);

  const handleExport = () => {
    if (filtered.length === 0) {
      enqueueSnackbar("No customer records to export.", { variant: "warning" });
      return;
    }
    exportCustomersToCsv(filtered);
    enqueueSnackbar(`Exported ${filtered.length} customers to CSV!`, {
      variant: "success",
    });
  };

  return (
    <div className="container mx-auto px-6 md:px-4 pb-24 space-y-5">
      {/* Header & Search / Export Bar */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-xl font-bold flex items-center gap-2">
            <FaAddressBook className="text-yellow-400" />
            Customer Directory ({filtered.length})
          </h2>
          <p className="text-xs text-[#ababab] mt-0.5">
            Automatically built from POS orders
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2">
            <FaSearch className="text-[#ababab] text-xs" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, address..."
              className="bg-transparent text-sm text-white focus:outline-none w-56"
            />
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <FaDownload size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-4">
        {isLoading ? (
          <p className="text-sm text-[#ababab] p-4">Loading customers...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#ababab] p-4">No customers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#f5f5f5]">
              <thead className="bg-[#1a1a1a] text-[#ababab] text-xs uppercase">
                <tr>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Delivery Address</th>
                  <th className="p-3 text-center">Orders</th>
                  <th className="p-3 text-right">Total Spent</th>
                  <th className="p-3">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.key}
                    className="border-b border-[#333] hover:bg-[#2f2f2f]"
                  >
                    <td className="p-3 font-semibold text-white">{c.name}</td>
                    <td className="p-3 text-[#ababab]">{c.phone || "-"}</td>
                    <td className="p-3 text-[#ababab] max-w-xs truncate">
                      {c.deliveryAddress || "-"}
                    </td>
                    <td className="p-3 text-center font-semibold">
                      {c.totalOrders}
                    </td>
                    <td className="p-3 text-right font-bold text-green-400">
                      GH₵ {Number(c.totalSpent || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-xs text-[#ababab]">
                      {c.lastOrderDate
                        ? formatDateAndTime(c.lastOrderDate)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomersAdmin;

