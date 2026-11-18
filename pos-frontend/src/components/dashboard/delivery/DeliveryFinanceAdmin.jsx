import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaCheckCircle, FaMoneyBillWave } from "react-icons/fa";
import {
  reviewRiderSettlement,
  verifyDeliveryCollection,
} from "../../../https/deliveryApi";

const DeliveryFinanceAdmin = ({ collections = [], settlements = [] }) => {
  const queryClient = useQueryClient();
  const [reviewAmounts, setReviewAmounts] = useState({});

  const verifyCollectionMutation = useMutation({
    mutationFn: ({ id, status }) => verifyDeliveryCollection(id, status),
    onSuccess: () => {
      enqueueSnackbar("Collection status updated", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-collections"] });
    },
    onError: (err) => enqueueSnackbar(err?.message || "Update failed", { variant: "error" }),
  });

  const reviewSettlementMutation = useMutation({
    mutationFn: reviewRiderSettlement,
    onSuccess: () => {
      enqueueSnackbar("Settlement reviewed!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["rider-settlements"] });
    },
    onError: (err) => enqueueSnackbar(err?.message || "Review failed", { variant: "error" }),
  });

  return (
    <div className="space-y-6">
      {/* Rider Settlements */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
          <FaMoneyBillWave className="text-yellow-400" />
          Rider Shift Settlements ({settlements.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-[#888] text-[11px] uppercase">
                <th className="py-2.5 px-3">Ref / Date</th>
                <th className="py-2.5 px-3">Rider</th>
                <th className="py-2.5 px-3">Expected</th>
                <th className="py-2.5 px-3">Declared</th>
                <th className="py-2.5 px-3">Discrepancy</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Verify &amp; Approve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252525]">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#888]">
                    No settlements submitted yet.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-3">
                      <p className="font-bold text-yellow-400">{s.settlement_reference}</p>
                      <p className="text-[11px] text-[#888]">{s.shift_date}</p>
                    </td>
                    <td className="py-3 px-3 text-[#f5f5f5]">
                      {s.riders?.full_name || "Rider"}
                    </td>
                    <td className="py-3 px-3 text-[#ccc]">
                      GH₵ {Number(s.expected_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-[#f5f5f5] font-semibold">
                      GH₵ {Number(s.declared_amount || 0).toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-3 font-bold ${
                        Number(s.discrepancy_amount) === 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      GH₵ {Number(s.discrepancy_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-[#262626] text-[11px] text-[#ccc] uppercase">
                        {s.settlement_status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {s.settlement_status !== "reconciled" ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={String(s.declared_amount)}
                            value={reviewAmounts[s.id] ?? s.declared_amount}
                            onChange={(e) =>
                              setReviewAmounts({ ...reviewAmounts, [s.id]: e.target.value })
                            }
                            className="w-20 bg-[#141414] border border-[#333] rounded px-2 py-1 text-xs text-[#f5f5f5]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              reviewSettlementMutation.mutate({
                                settlementId: s.id,
                                verifiedAmount: reviewAmounts[s.id] ?? s.declared_amount,
                                status: "reconciled",
                                notes: s.notes || "Manager verified receipt",
                              })
                            }
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              reviewSettlementMutation.mutate({
                                settlementId: s.id,
                                verifiedAmount: reviewAmounts[s.id] ?? s.declared_amount,
                                status: "disputed",
                                notes: s.notes || "Flagged discrepancy",
                              })
                            }
                            className="px-2.5 py-1 rounded bg-red-600/80 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Dispute
                          </button>
                        </div>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <FaCheckCircle /> Verified GH₵ {Number(s.verified_amount || 0).toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Collections */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#f5f5f5]">
          Rider Collection Records ({collections.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2a2a2a] text-[#888] text-[11px] uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Rider</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252525]">
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#888]">
                    No collection records yet.
                  </td>
                </tr>
              ) : (
                collections.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-3 text-[#ababab]">
                      {new Date(c.collected_at || c.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-[#f5f5f5]">{c.riders?.full_name || "Rider"}</td>
                    <td className="py-2.5 px-3 text-[#ccc]">{c.collection_method}</td>
                    <td className="py-2.5 px-3 font-bold text-yellow-400">
                      GH₵ {Number(c.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-[#888]">{c.payment_reference || "-"}</td>
                    <td className="py-2.5 px-3 uppercase text-[11px]">{c.collection_status}</td>
                    <td className="py-2.5 px-3">
                      {c.collection_status === "collected" && (
                        <button
                          type="button"
                          onClick={() =>
                            verifyCollectionMutation.mutate({ id: c.id, status: "verified" })
                          }
                          className="px-2.5 py-1 rounded bg-emerald-600/80 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeliveryFinanceAdmin;

