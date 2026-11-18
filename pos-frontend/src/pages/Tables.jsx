import React, { useState, useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import TableCard from "../components/tables/TableCard";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTables, transferTableOrder } from "../https";
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setCustomer, updateTable } from "../redux/slices/customerSlice";
import { FaExchangeAlt, FaPlusCircle, FaTimes } from "react-icons/fa";

const Tables = () => {
  const [status, setStatus] = useState("all");
  const [selectedBookedTable, setSelectedBookedTable] = useState(null);
  const [targetTableId, setTargetTableId] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

    useEffect(() => {
      document.title = "POS | Tables"
    }, [])

  const { data: resData, isError } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      return await getTables();
    },
    placeholderData: keepPreviousData,
  });

  if(isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" })
  }

  const allTables = resData?.data?.data || [];
  const availableTables = allTables.filter((t) => t.status !== "Booked");
  const displayedTables =
    status === "booked" ? allTables.filter((t) => t.status === "Booked") : allTables;

  const transferMutation = useMutation({
    mutationFn: transferTableOrder,
    onSuccess: () => {
      enqueueSnackbar("Table transferred successfully!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedBookedTable(null);
      setTargetTableId("");
    },
    onError: (err) => {
      enqueueSnackbar(err?.response?.data?.message || "Failed to transfer table", {
        variant: "error",
      });
    },
  });

  const handleAddItemsToOpenOrder = () => {
    if (!selectedBookedTable?.currentOrder) return;
    const cust = selectedBookedTable.currentOrder.customerDetails || {};
    dispatch(
      setCustomer({
        name: cust.name || "Table Guest",
        phone: cust.phone || "",
        guests: cust.guests || 1,
        orderType: "Dine In",
        activeOrderId: selectedBookedTable.currentOrder._id || selectedBookedTable.currentOrder.id,
      })
    );
    dispatch(
      updateTable({
        table: {
          tableId: selectedBookedTable._id || selectedBookedTable.id,
          tableNo: selectedBookedTable.tableNo,
        },
      })
    );
    setSelectedBookedTable(null);
    navigate("/menu");
  };

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] lg:h-[calc(100vh-5rem)] lg:overflow-hidden pb-24 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 lg:px-10 py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-xl sm:text-2xl font-bold tracking-wider">
            Tables
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setStatus("all")}
            className={`text-[#ababab] text-sm sm:text-lg ${
              status === "all" && "bg-[#383838] text-white"
            } rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 font-semibold cursor-pointer`}
          >
            All
          </button>
          <button
            onClick={() => setStatus("booked")}
            className={`text-[#ababab] text-sm sm:text-lg ${
              status === "booked" && "bg-[#383838] text-white"
            } rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 font-semibold cursor-pointer`}
          >
            Booked
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 px-4 sm:px-8 lg:px-16 py-4 lg:h-[calc(100vh-13rem)] overflow-y-auto scrollbar-hide">
        {displayedTables.map((table) => {
          return (
            <TableCard
              key={table._id || table.id}
              id={table._id}
              name={table.tableNo}
              status={table.status}
              initials={table?.currentOrder?.customerDetails?.name}
              seats={table.seats}
              onSelectBooked={() => {
                setSelectedBookedTable(table);
                setTargetTableId("");
              }}
            />
          );
        })}
      </div>

      {selectedBookedTable && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2f2f2f] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#f5f5f5]">
                  Table {selectedBookedTable.tableNo} (Occupied)
                </h2>
                <p className="text-xs text-[#ababab]">
                  Guest: {selectedBookedTable.currentOrder?.customerDetails?.name || "Customer"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookedTable(null)}
                className="text-[#888] hover:text-white cursor-pointer"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {selectedBookedTable.currentOrder && (
              <button
                type="button"
                onClick={handleAddItemsToOpenOrder}
                className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <FaPlusCircle />
                <span>Add Items to Open Order</span>
              </button>
            )}

            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-[#f5f5f5] flex items-center gap-2">
                <FaExchangeAlt className="text-yellow-400" />
                Transfer Table
              </p>
              {availableTables.length === 0 ? (
                <p className="text-xs text-[#888]">No available tables to transfer to.</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={targetTableId}
                    onChange={(e) => setTargetTableId(e.target.value)}
                    className="flex-1 bg-[#1f1f1f] border border-[#333] rounded-lg px-3 py-2 text-xs text-[#f5f5f5]"
                  >
                    <option value="">-- Select Available Table --</option>
                    {availableTables.map((t) => (
                      <option key={t._id || t.id} value={t._id || t.id}>
                        Table {t.tableNo} ({t.seats} seats)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!targetTableId || transferMutation.isPending || !selectedBookedTable.currentOrder}
                    onClick={() =>
                      transferMutation.mutate({
                        orderId: selectedBookedTable.currentOrder._id || selectedBookedTable.currentOrder.id,
                        fromTableId: selectedBookedTable._id || selectedBookedTable.id,
                        toTableId: targetTableId,
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {transferMutation.isPending ? "Moving..." : "Move"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </section>
  );
};

export default Tables;
