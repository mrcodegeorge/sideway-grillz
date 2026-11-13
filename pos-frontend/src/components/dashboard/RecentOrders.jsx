import React, { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaReceipt, FaUtensils } from "react-icons/fa";
import { getOrders, updateOrderStatus } from "../../https/index";
import { formatDateAndTime } from "../../utils";
import Invoice from "../invoice/Invoice";
import { dispatchOrderSmsIfEnabled } from "../../utils/settingsStorage";

const RecentOrders = () => {
  const queryClient = useQueryClient();
  const [reprintOrder, setReprintOrder] = useState(null);
  const [reprintCopyType, setReprintCopyType] = useState("cashier");

  const handleOpenReprint = (order, copyType) => {
    setReprintOrder(order);
    setReprintCopyType(copyType);
  };
  const handleStatusChange = ({ order, orderId, orderStatus }) => {
    orderStatusUpdateMutation.mutate(
      { orderId, orderStatus },
      {
        onSuccess: () => {
          if (orderStatus === "Ready" && order) {
            dispatchOrderSmsIfEnabled({
              eventType: "ready",
              customerName: order.customerDetails?.name,
              customerPhone: order.customerDetails?.phone,
              orderId,
              total: order.bills?.totalWithTax,
            });
          }
        },
      }
    );
  };

  const orderStatusUpdateMutation = useMutation({
    mutationFn: ({ orderId, orderStatus }) => updateOrderStatus({ orderId, orderStatus }),
    onSuccess: (data) => {
      enqueueSnackbar("Order status updated successfully!", { variant: "success" });
      queryClient.invalidateQueries(["orders"]); // Refresh order list
    },
    onError: () => {
      enqueueSnackbar("Failed to update order status!", { variant: "error" });
    }
  })

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

  const orders = resData?.data?.data || [];

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <h2 className="text-[#f5f5f5] text-xl font-semibold mb-4">
        Recent Orders
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Order ID</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date & Time</th>
              <th className="p-3">Items</th>
              <th className="p-3">Table No</th>
              <th className="p-3">Total</th>
              <th className="p-3 text-center">Payment Method</th>
              <th className="p-3 text-center">Reprint</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[#ababab]">
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[#ababab]">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order, index) => (
                <tr
                  key={order._id || index}
                  className="border-b border-gray-600 hover:bg-[#333]"
                >
                  <td className="p-4">
                    #{order.orderDate ? Math.floor(new Date(order.orderDate).getTime()) : order._id?.slice(0, 8)}
                  </td>
                  <td className="p-4">{order.customerDetails?.name || "Walk-in"}</td>
                  <td className="p-4">
                    <select
                      className={`bg-[#1a1a1a] text-[#f5f5f5] border border-gray-500 p-2 rounded-lg focus:outline-none ${order.orderStatus === "Ready" || order.orderStatus === "Completed"
                        ? "text-green-500"
                        : order.orderStatus === "Cancelled"
                          ? "text-red-500"
                          : "text-yellow-500"
                        }`}
                      value={order.orderStatus || "InProgress"}
                      onChange={(e) => handleStatusChange({ order, orderId: order._id, orderStatus: e.target.value })}
                    >
                      <option className="text-yellow-500" value="InProgress">
                        In Progress
                      </option>
                      <option className="text-green-500" value="Ready">
                        Ready
                      </option>
                      <option className="text-green-500" value="Completed">
                        Completed
                      </option>
                      <option className="text-red-500" value="Cancelled">
                        Cancelled
                      </option>
                    </select>
                  </td>
                  <td className="p-4">{order.orderDate ? formatDateAndTime(order.orderDate) : "-"}</td>
                  <td className="p-4">{order.items?.length || 0} Items</td>
                  <td className="p-4">
                    {order.table?.tableNo
                      ? `Table - ${order.table.tableNo}`
                      : order.customerDetails?.orderType === "Delivery"
                        ? `Delivery (${order.customerDetails?.deliveryAddress || "No address"})`
                        : "Takeout"}
                  </td>
                  <td className="p-4">GH₵ {order.bills?.totalWithTax ?? 0}</td>
                  <td className="p-4 text-center">
                    {order.paymentMethod || "Cash"}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReprint(order, "cashier")}
                        title="Reprint Cashier Receipt"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-blue-600/20 text-blue-400 border border-blue-700/40 text-xs font-semibold transition-colors"
                      >
                        <FaReceipt size={12} />
                        <span>Cashier</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReprint(order, "kitchen")}
                        title="Reprint Kitchen Ticket"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-yellow-600/20 text-yellow-400 border border-yellow-700/40 text-xs font-semibold transition-colors"
                      >
                        <FaUtensils size={12} />
                        <span>Kitchen</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {reprintOrder && (
        <Invoice
          key={`${reprintOrder._id || reprintOrder.id}-${reprintCopyType}`}
          orderInfo={reprintOrder}
          setShowInvoice={(val) => {
            if (!val) setReprintOrder(null);
          }}
          initialCopyType={reprintCopyType}
          isReprint={true}
        />
      )}
    </div>
  );
};

export default RecentOrders;
