import React, { useEffect, useState } from "react";
import { getShiftHandovers, approveShiftHandover } from "../../https";
import { enqueueSnackbar } from "notistack";
import { FaMoneyBillWave, FaCheck, FaClock, FaUserCheck } from "react-icons/fa6";

const ShiftHandoversAdmin = () => {
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHandovers = async () => {
    try {
      setLoading(true);
      const res = await getShiftHandovers();
      setHandovers(res.data || []);
    } catch (error) {
      console.error(error);
      enqueueSnackbar("Failed to load shift handovers.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandovers();
  }, []);

  const handleApprove = async (id) => {
    try {
      await approveShiftHandover(id);
      enqueueSnackbar("Cash handover approved and signed off!", {
        variant: "success",
      });
      fetchHandovers();
    } catch (error) {
      console.error(error);
      enqueueSnackbar("Failed to approve handover.", { variant: "error" });
    }
  };

  const totalCashPending = handovers
    .filter((h) => h.status === "Handed_Over")
    .reduce((acc, h) => acc + Number(h.cash_collected || 0), 0);

  const totalCashApproved = handovers
    .filter((h) => h.status === "Approved")
    .reduce((acc, h) => acc + Number(h.cash_collected || 0), 0);

  return (
    <div className="container mx-auto px-6 md:px-4 pb-12">
      {/* Top Reconciliation Summary */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bg-[#1a1a1a] border-2 border-yellow-400/60 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center gap-2 text-yellow-400 mb-1">
            <FaClock />
            <span className="text-xs font-bold uppercase tracking-wider">
              Pending Cash Collection
            </span>
          </div>
          <h2 className="text-3xl font-black text-yellow-400">
            GH₵ {totalCashPending.toFixed(2)}
          </h2>
          <p className="text-xs text-[#888] mt-1">Awaiting manager count & approval</p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2e2e2e] p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-green-400 mb-1">
            <FaCheck />
            <span className="text-xs font-bold uppercase tracking-wider">
              Total Approved Cash
            </span>
          </div>
          <h2 className="text-3xl font-bold text-white">
            GH₵ {totalCashApproved.toFixed(2)}
          </h2>
          <p className="text-xs text-[#888] mt-1">Safely handed over to register</p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2e2e2e] p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <FaUserCheck />
            <span className="text-xs font-bold uppercase tracking-wider">
              Recorded Handovers
            </span>
          </div>
          <h2 className="text-3xl font-bold text-white">{handovers.length}</h2>
          <p className="text-xs text-[#888] mt-1">Waiter shift records</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-[#2e2e2e] flex justify-between items-center">
          <h3 className="font-bold text-white text-base">
            Waiter Shift Handovers & Cash Surrenders
          </h3>
          <button
            onClick={fetchHandovers}
            className="text-xs font-semibold px-3 py-1.5 bg-[#252525] hover:bg-[#333] text-yellow-400 rounded-lg transition-colors"
          >
            Refresh Handovers
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#888]">Loading shift records...</div>
        ) : handovers.length === 0 ? (
          <div className="py-12 text-center text-[#666]">
            No waiter shift handovers submitted yet.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#141414] text-[#888] border-b border-[#2e2e2e] text-xs font-semibold">
              <tr>
                <th className="p-4">Time & Date</th>
                <th className="p-4">Waiter Name</th>
                <th className="p-4">Orders</th>
                <th className="p-4 text-right">Cash Handed Over</th>
                <th className="p-4 text-right">Online / Paystack</th>
                <th className="p-4 text-right">Total Sales</th>
                <th className="p-4">Notes</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {handovers.map((item) => (
                <tr key={item.id} className="hover:bg-[#202020]">
                  <td className="p-4 text-xs text-[#aaa]">
                    {new Date(item.created_at).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-4 font-bold text-white">{item.waiter_name}</td>
                  <td className="p-4 text-center text-[#bbb]">{item.total_orders}</td>
                  <td className="p-4 text-right font-black text-yellow-400">
                    GH₵ {Number(item.cash_collected).toFixed(2)}
                  </td>
                  <td className="p-4 text-right text-[#aaa]">
                    GH₵ {Number(item.online_collected).toFixed(2)}
                  </td>
                  <td className="p-4 text-right font-semibold text-white">
                    GH₵ {Number(item.total_collected).toFixed(2)}
                  </td>
                  <td className="p-4 text-xs text-[#888] max-w-[180px] truncate">
                    {item.notes || "—"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        item.status === "Approved"
                          ? "bg-green-950/60 text-green-400 border border-green-800/40"
                          : "bg-yellow-950/60 text-yellow-400 border border-yellow-800/40"
                      }`}
                    >
                      {item.status === "Approved" ? "✓ Approved" : "Pending Signoff"}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {item.status !== "Approved" ? (
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-lg text-xs font-bold transition-all shadow"
                      >
                        Accept & Sign Off
                      </button>
                    ) : (
                      <span className="text-xs text-[#666]">Reconciled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ShiftHandoversAdmin;

