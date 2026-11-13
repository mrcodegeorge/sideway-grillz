import React from "react";
import { orders } from "../../constants";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders, updateOrderStatus } from "../../https/index";
import { formatDateAndTime } from "../../utils";

const RecentOrders = () => {
  const queryClient = useQueryClient();
  const handleStatusChange = ({ orderId, orderStatus }) => {
    console.log(orderId)
    orderStatusUpdateMutation.mutate({ orderId, orderStatus });
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
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[#ababab]">
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[#ababab]">
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
                      onChange={(e) => handleStatusChange({ orderId: order._id, orderStatus: e.target.value })}
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
                    {order.table?.tableNo ? `Table - ${order.table.tableNo}` : "Takeaway / N/A"}
                  </td>
                  <td className="p-4">GH₵ {order.bills?.totalWithTax ?? 0}</td>
                  <td className="p-4">
                    {order.paymentMethod || "Cash"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
