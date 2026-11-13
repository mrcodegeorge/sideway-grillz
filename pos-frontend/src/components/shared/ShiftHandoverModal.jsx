import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  getWaiterShiftSummary,
  submitShiftHandover,
} from "../../https";
import { enqueueSnackbar } from "notistack";
import { FaMoneyBillWave, FaCreditCard, FaReceipt, FaXmark, FaCheck } from "react-icons/fa6";
import { dispatchEmailIfEnabled } from "../../utils/settingsStorage";

const ShiftHandoverModal = ({ isOpen, onClose }) => {
  const userData = useSelector((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [notes, setNotes] = useState("");
  const [submittedHandover, setSubmittedHandover] = useState(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await getWaiterShiftSummary(userData._id || userData.id);
      setSummary(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar("Failed to fetch shift summary.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSubmittedHandover(null);
      setNotes("");
      fetchSummary();
    }
  }, [isOpen, userData]);

  const handleSubmitHandover = async () => {
    if (!summary) return;
    if (summary.totalOrders === 0) {
      enqueueSnackbar("No orders recorded during this shift.", { variant: "info" });
    }

    try {
      setSubmitting(true);
      const res = await submitShiftHandover({
        waiterId: userData._id || userData.id,
        waiterName: userData.name || userData.username || "Staff Member",
        cashCollected: summary.cashCollected,
        onlineCollected: summary.onlineCollected,
        totalCollected: summary.totalCollected,
        totalOrders: summary.totalOrders,
        shiftStart: summary.shiftStart,
        notes,
      });

      setSubmittedHandover(res.data.data);
      dispatchEmailIfEnabled({
        eventType: "handover",
        subject: `Shift Handover Submitted — ${userData.name || userData.username}`,
        text: `Staff: ${userData.name || userData.username}\nOrders: ${summary.totalOrders}\nCash Collected: GH₵ ${Number(summary.cashCollected || 0).toFixed(2)}\nOnline Collected: GH₵ ${Number(summary.onlineCollected || 0).toFixed(2)}\nTotal Collected: GH₵ ${Number(summary.totalCollected || 0).toFixed(2)}\nNotes: ${notes || "None"}`,
      });
      enqueueSnackbar("Shift cash handover submitted successfully!", {
        variant: "success",
      });
    } catch (error) {
      console.error(error);
      enqueueSnackbar(
        error?.response?.data?.message || "Failed to submit cash handover.",
        { variant: "error" }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-[#f5f5f5]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-xl font-bold text-yellow-400">
              End of Shift — Cash Handover
            </h2>
            <p className="text-xs text-[#ababab] mt-0.5">
              Waiter: <span className="text-white font-medium">{userData.name || userData.username}</span> |{" "}
              {new Date().toLocaleDateString("en-GB", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#242424] text-[#ababab] hover:text-white hover:bg-[#333]"
          >
            <FaXmark size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1">
          {loading ? (
            <div className="py-12 text-center text-[#ababab]">
              Calculating shift totals and orders...
            </div>
          ) : submittedHandover ? (
            /* Success confirmation & Printable Slip */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto border border-green-500/40">
                <FaCheck size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Handover Recorded!</h3>
                <p className="text-sm text-[#ababab] mt-1">
                  Please hand over the exact cash amount to your shift manager or cashier.
                </p>
              </div>

              {/* Handover Slip Summary */}
              <div className="bg-[#141414] border border-[#333] rounded-xl p-5 text-left space-y-3 font-mono text-sm">
                <div className="text-center font-bold text-yellow-400 text-base pb-2 border-b border-[#2a2a2a]">
                  SIDEWAYS GRILLZ — SHIFT CASH SLIP
                </div>
                <div className="flex justify-between text-xs text-[#888]">
                  <span>Slip ID:</span>
                  <span>{submittedHandover.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#ababab]">Waiter:</span>
                  <span className="font-bold text-white">{submittedHandover.waiter_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#ababab]">Orders Handled:</span>
                  <span className="text-white">{submittedHandover.total_orders}</span>
                </div>
                <div className="flex justify-between py-2 border-y border-[#2a2a2a] text-base">
                  <span className="text-yellow-400 font-bold">CASH TO HAND OVER:</span>
                  <span className="text-yellow-400 font-bold">
                    GH₵ {Number(submittedHandover.cash_collected).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#888]">
                  <span>Online / Paystack:</span>
                  <span>GH₵ {Number(submittedHandover.online_collected).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#888]">
                  <span>Total Sales:</span>
                  <span>GH₵ {Number(submittedHandover.total_collected).toFixed(2)}</span>
                </div>
                {submittedHandover.notes && (
                  <div className="pt-2 text-xs text-[#aaa]">
                    Note: {submittedHandover.notes}
                  </div>
                )}
                <div className="pt-6 grid grid-cols-2 gap-4 text-center text-xs text-[#666]">
                  <div className="border-t border-[#333] pt-2">Waiter Signature</div>
                  <div className="border-t border-[#333] pt-2">Manager Signature</div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={handlePrintSlip}
                  className="px-5 py-2.5 bg-[#2b2b2b] hover:bg-[#383838] text-white rounded-lg text-sm font-semibold"
                >
                  Print Handover Slip
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-lg text-sm font-bold"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4">
                {/* Cash To Hand Over */}
                <div className="bg-[#141414] p-4 rounded-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-500/10">
                  <div className="flex items-center gap-2 text-yellow-400 mb-1">
                    <FaMoneyBillWave size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Cash to Hand Over
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-yellow-400">
                    GH₵ {(summary?.cashCollected || 0).toFixed(2)}
                  </h3>
                  <p className="text-[11px] text-[#888] mt-1">Must be physically surrendered</p>
                </div>

                {/* Online Payments */}
                <div className="bg-[#141414] p-4 rounded-xl border border-[#2b2b2b]">
                  <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <FaCreditCard size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Online (Paystack)
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    GH₵ {(summary?.onlineCollected || 0).toFixed(2)}
                  </h3>
                  <p className="text-[11px] text-[#888] mt-1">Directly received in gateway</p>
                </div>

                {/* Total Orders */}
                <div className="bg-[#141414] p-4 rounded-xl border border-[#2b2b2b]">
                  <div className="flex items-center gap-2 text-green-400 mb-1">
                    <FaReceipt size={16} />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Total Orders
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    {summary?.totalOrders || 0}
                  </h3>
                  <p className="text-[11px] text-[#888] mt-1">
                    Sales: GH₵ {(summary?.totalCollected || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Orders List Table */}
              <div>
                <h4 className="text-xs font-bold text-[#888] uppercase tracking-wider mb-2">
                  Orders Handled During This Shift ({summary?.orders?.length || 0})
                </h4>
                <div className="bg-[#141414] rounded-xl border border-[#2b2b2b] max-h-48 overflow-y-auto">
                  {summary?.orders?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#666]">
                      No orders taken yet during this shift.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1e1e1e] text-[#888] border-b border-[#2b2b2b]">
                        <tr>
                          <th className="p-3 font-semibold">Time</th>
                          <th className="p-3 font-semibold">Customer</th>
                          <th className="p-3 font-semibold">Payment</th>
                          <th className="p-3 font-semibold">Status</th>
                          <th className="p-3 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222]">
                        {summary?.orders?.map((order) => (
                          <tr key={order.id} className="hover:bg-[#1b1b1b]">
                            <td className="p-3 text-[#aaa]">
                              {new Date(order.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="p-3 font-medium text-white">
                              {order.customer_details?.name || "Walk-in"}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  order.payment_method === "Cash"
                                    ? "bg-yellow-950/60 text-yellow-400 border border-yellow-800/40"
                                    : "bg-blue-950/60 text-blue-400 border border-blue-800/40"
                                }`}
                              >
                                {order.payment_method || "Cash"}
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  order.order_status === "Completed"
                                    ? "bg-green-950/50 text-green-400"
                                    : "bg-orange-950/50 text-orange-400"
                                }`}
                              >
                                {order.order_status}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-white">
                              GH₵{" "}
                              {Number(
                                order.bills?.totalWithTax || order.bills?.total || 0
                              ).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Handover Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#ababab] mb-1.5">
                  Handover Notes / Cash Breakdown (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Handed cash to shift manager Sarah; 5x 50 notes, 2x 20 notes..."
                  className="w-full bg-[#141414] border border-[#2b2b2b] rounded-xl p-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-yellow-400"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2 border-t border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#242424] text-[#ababab] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || summary?.totalOrders === 0}
                  onClick={handleSubmitHandover}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold bg-yellow-400 hover:bg-yellow-300 text-gray-900 shadow-lg shadow-yellow-500/20 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Hand Over Cash & Close Shift"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftHandoverModal;

