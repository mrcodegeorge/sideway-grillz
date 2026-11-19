import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaDownload, FaFileInvoiceDollar, FaPrint, FaReceipt, FaSyncAlt } from "react-icons/fa";
import { getOrders, getShiftHandovers } from "../../https";
import { getExpenses } from "../../utils/expensesStorage";
import { getDeliveryTasks, getRiderSettlements } from "../../https/deliveryApi";
import { getSettingsSync } from "../../utils/settingsStorage";
import { logAuditEvent } from "../../utils/auditStorage";

const getLocalDateStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const matchesDate = (isoOrDateStr, targetDate) => {
  if (!isoOrDateStr) return false;
  if (String(isoOrDateStr).slice(0, 10) === targetDate) return true;
  const parsed = new Date(isoOrDateStr);
  if (Number.isNaN(parsed.getTime())) return false;
  return getLocalDateStr(parsed) === targetDate;
};

const ZReportAdmin = () => {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr());
  const settings = getSettingsSync();

  const { data: ordersRes, refetch: refetchOrders, isFetching } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: getExpenses,
  });

  const { data: handoversRes, refetch: refetchHandovers } = useQuery({
    queryKey: ["shift-handovers"],
    queryFn: getShiftHandovers,
  });

  const { data: deliveryTasks = [] } = useQuery({
    queryKey: ["delivery-tasks"],
    queryFn: () => getDeliveryTasks().catch(() => []),
  });

  const { data: riderSettlements = [] } = useQuery({
    queryKey: ["rider-settlements"],
    queryFn: () => getRiderSettlements().catch(() => []),
  });

  const report = useMemo(() => {
    const allOrders = ordersRes?.data?.data || [];
    const dayOrders = allOrders.filter((o) =>
      matchesDate(o.orderDate || o.createdAt, selectedDate)
    );
    const validOrders = dayOrders.filter((o) => o.orderStatus !== "Cancelled");
    const cancelledOrders = dayOrders.filter((o) => o.orderStatus === "Cancelled");

    const foodSubtotal = validOrders.reduce((s, o) => s + Number(o.bills?.total || 0), 0);
    const totalVat = validOrders.reduce((s, o) => s + Number(o.bills?.tax || 0), 0);
    const orderDeliveryFees = validOrders.reduce(
      (s, o) => s + Number(o.bills?.deliveryFee || 0),
      0
    );
    const taskDeliveryFees = deliveryTasks
      .filter((t) => matchesDate(t.created_at, selectedDate) && t.current_status !== "cancelled")
      .reduce((s, t) => s + Number(t.delivery_fee || 0), 0);
    const totalDeliveryFees = Math.max(orderDeliveryFees, taskDeliveryFees);

    const grossSales = validOrders.reduce(
      (s, o) => s + Number(o.bills?.totalWithTax ?? o.bills?.total ?? 0),
      0
    );

    const cashSales = validOrders
      .filter((o) => (o.paymentMethod || "Cash").toLowerCase() === "cash")
      .reduce((s, o) => s + Number(o.bills?.totalWithTax ?? o.bills?.total ?? 0), 0);

    const onlineSales = validOrders
      .filter((o) => (o.paymentMethod || "").toLowerCase() !== "cash")
      .reduce((s, o) => s + Number(o.bills?.totalWithTax ?? o.bills?.total ?? 0), 0);

    const orderTypes = { "Dine In": 0, Takeout: 0, Delivery: 0 };
    validOrders.forEach((o) => {
      const t = o.customerDetails?.orderType || "Dine In";
      orderTypes[t] = (orderTypes[t] || 0) + 1;
    });

    const dayExpenses = expenses.filter((e) => matchesDate(e.expenseDate, selectedDate));
    const totalExpenses = dayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const allHandovers = handoversRes?.data || [];
    const dayHandovers = allHandovers.filter((h) =>
      matchesDate(h.shift_date || h.created_at, selectedDate)
    );
    const totalHandedOverCash = dayHandovers.reduce(
      (s, h) => s + Number(h.cash_collected || 0),
      0
    );
    const approvedHandoverCash = dayHandovers
      .filter((h) => h.status === "Approved")
      .reduce((s, h) => s + Number(h.cash_collected || 0), 0);

    const daySettlements = riderSettlements.filter((rs) =>
      matchesDate(rs.shift_date || rs.created_at, selectedDate)
    );
    const totalRiderSettled = daySettlements.reduce(
      (s, rs) => s + Number(rs.verified_amount ?? rs.declared_amount ?? 0),
      0
    );

    const netCashflow = grossSales - totalExpenses;
    const expectedCashOnHand = cashSales - totalExpenses;

    return {
      totalOrders: dayOrders.length,
      validCount: validOrders.length,
      cancelledCount: cancelledOrders.length,
      foodSubtotal,
      totalVat,
      totalDeliveryFees,
      grossSales,
      cashSales,
      onlineSales,
      orderTypes,
      dayExpenses,
      totalExpenses,
      dayHandovers,
      totalHandedOverCash,
      approvedHandoverCash,
      daySettlements,
      totalRiderSettled,
      netCashflow,
      expectedCashOnHand,
    };
  }, [ordersRes, expenses, handoversRes, deliveryTasks, riderSettlements, selectedDate]);

  const handleRefresh = () => {
    refetchOrders();
    refetchExpenses();
    refetchHandovers();
  };

  const handlePrint = (thermal = false) => {
    const win = window.open("", "_blank", thermal ? "width=340,height=700" : "width=900,height=800");
    if (!win) {
      enqueueSnackbar("Popup blocked. Please allow popups to print.", { variant: "warning" });
      return;
    }

    const styles = thermal
      ? `body { font-family: monospace; width: 76mm; margin: 0 auto; font-size: 11px; color: #000; }
         h2, p { margin: 2px 0; text-align: center; }
         .line { border-top: 1px dashed #000; margin: 6px 0; }
         .row { display: flex; justify-content: space-between; margin: 2px 0; }
         .bold { font-weight: bold; }`
      : `body { font-family: Inter, Arial, sans-serif; max-width: 760px; margin: 24px auto; color: #111; font-size: 13px; }
         h1, h2 { margin: 0 0 6px; }
         .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; }
         .section { margin-bottom: 18px; }
         .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
         .bold { font-weight: 700; }
         .line { border-top: 2px solid #111; margin: 10px 0; }`;

    win.document.write(`
      <html>
        <head><title>Z-Report ${selectedDate}</title><style>${styles}</style></head>
        <body>
          <div class="header">
            <div>
              <h2>${settings.businessName || "Sideways Grillz"}</h2>
              <p>${settings.businessAddress || ""} ${settings.businessPhone ? "• " + settings.businessPhone : ""}</p>
            </div>
            <div>
              <p class="bold">END-OF-DAY Z-REPORT</p>
              <p>Date: ${selectedDate}</p>
              <p>Printed: ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <div class="line"></div>
          <div class="section">
            <div class="row"><span>Total Orders (Valid / Cancelled)</span><span>${report.validCount} / ${report.cancelledCount}</span></div>
            <div class="row"><span>Dine In / Takeout / Delivery</span><span>${report.orderTypes["Dine In"]} / ${report.orderTypes.Takeout} / ${report.orderTypes.Delivery}</span></div>
            <div class="row"><span>Food &amp; Item Subtotal</span><span>GH₵ ${report.foodSubtotal.toFixed(2)}</span></div>
            <div class="row"><span>Total VAT</span><span>GH₵ ${report.totalVat.toFixed(2)}</span></div>
            <div class="row"><span>Delivery Fees</span><span>GH₵ ${report.totalDeliveryFees.toFixed(2)}</span></div>
            <div class="row bold"><span>GROSS SALES</span><span>GH₵ ${report.grossSales.toFixed(2)}</span></div>
          </div>
          <div class="line"></div>
          <div class="section">
            <div class="row"><span>Cash Sales</span><span>GH₵ ${report.cashSales.toFixed(2)}</span></div>
            <div class="row"><span>Online / Paystack Sales</span><span>GH₵ ${report.onlineSales.toFixed(2)}</span></div>
            <div class="row"><span>Total Expenses (${report.dayExpenses.length})</span><span>- GH₵ ${report.totalExpenses.toFixed(2)}</span></div>
            <div class="row bold"><span>NET DAILY CASHFLOW</span><span>GH₵ ${report.netCashflow.toFixed(2)}</span></div>
          </div>
          <div class="line"></div>
          <div class="section">
            <div class="row"><span>Waiter Shift Handovers (${report.dayHandovers.length})</span><span>GH₵ ${report.totalHandedOverCash.toFixed(2)}</span></div>
            <div class="row"><span>Approved Handover Cash</span><span>GH₵ ${report.approvedHandoverCash.toFixed(2)}</span></div>
            <div class="row"><span>Rider Settlements (${report.daySettlements.length})</span><span>GH₵ ${report.totalRiderSettled.toFixed(2)}</span></div>
            <div class="row bold"><span>Expected Cash On Hand</span><span>GH₵ ${report.expectedCashOnHand.toFixed(2)}</span></div>
          </div>
          <script>window.onload = function(){ window.print(); }</script>
        </body>
      </html>
    `);
    win.document.close();

    logAuditEvent({
      action: "Z_REPORT_PRINTED",
      entityType: "Settings",
      entityId: selectedDate,
      details: `Printed ${thermal ? "80mm thermal" : "A4"} End-of-Day Z-Report for ${selectedDate} (Gross: GH₵ ${report.grossSales.toFixed(2)})`,
    });
  };

  const handleExportCsv = () => {
    const rows = [
      ["Sideways Grillz POS - End-of-Day Z-Report", selectedDate],
      ["Metric", "Value"],
      ["Valid Orders", report.validCount],
      ["Cancelled Orders", report.cancelledCount],
      ["Dine In Orders", report.orderTypes["Dine In"]],
      ["Takeout Orders", report.orderTypes.Takeout],
      ["Delivery Orders", report.orderTypes.Delivery],
      ["Food Subtotal (GHS)", report.foodSubtotal.toFixed(2)],
      ["VAT Collected (GHS)", report.totalVat.toFixed(2)],
      ["Delivery Fees (GHS)", report.totalDeliveryFees.toFixed(2)],
      ["Gross Sales (GHS)", report.grossSales.toFixed(2)],
      ["Cash Sales (GHS)", report.cashSales.toFixed(2)],
      ["Online / Paystack Sales (GHS)", report.onlineSales.toFixed(2)],
      ["Total Expenses (GHS)", report.totalExpenses.toFixed(2)],
      ["Net Daily Cashflow (GHS)", report.netCashflow.toFixed(2)],
      ["Waiter Shift Handovers Cash (GHS)", report.totalHandedOverCash.toFixed(2)],
      ["Approved Handover Cash (GHS)", report.approvedHandoverCash.toFixed(2)],
      ["Rider Settlements (GHS)", report.totalRiderSettled.toFixed(2)],
      ["Expected Cash On Hand (GHS)", report.expectedCashOnHand.toFixed(2)],
    ];

    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sideways-z-report-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logAuditEvent({
      action: "Z_REPORT_EXPORTED",
      entityType: "Settings",
      entityId: selectedDate,
      details: `Exported Z-Report CSV for ${selectedDate}`,
    });
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-4 py-4 space-y-5">
      {/* Header & Controls */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-yellow-400/15 text-yellow-400">
            <FaFileInvoiceDollar size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#f5f5f5]">End-of-Day Z-Report</h2>
            <p className="text-xs text-[#ababab]">
              Daily closeout summary: sales by payment method, delivery fees, expenses, handovers &amp; net cashflow
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#141414] border border-[#333] rounded-xl px-3 py-2 text-xs text-[#f5f5f5]"
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#262626] hover:bg-[#333] text-xs font-semibold text-[#f5f5f5] cursor-pointer"
          >
            <FaSyncAlt className={isFetching ? "animate-spin" : ""} size={12} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrint(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#262626] hover:bg-[#333] text-xs font-semibold text-yellow-400 border border-yellow-400/30 cursor-pointer"
          >
            <FaReceipt size={12} />
            <span>80mm Thermal</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrint(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#262626] hover:bg-[#333] text-xs font-semibold text-[#f5f5f5] cursor-pointer"
          >
            <FaPrint size={12} />
            <span>Print A4</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold cursor-pointer"
          >
            <FaDownload size={12} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Gross Sales</p>
          <p className="text-lg font-bold text-yellow-400 mt-1">GH₵ {report.grossSales.toFixed(2)}</p>
          <p className="text-[10px] text-[#777]">{report.validCount} valid order(s)</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Cash Sales</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">GH₵ {report.cashSales.toFixed(2)}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Online / Paystack</p>
          <p className="text-lg font-bold text-blue-400 mt-1">GH₵ {report.onlineSales.toFixed(2)}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Delivery Fees</p>
          <p className="text-lg font-bold text-cyan-400 mt-1">GH₵ {report.totalDeliveryFees.toFixed(2)}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Expenses</p>
          <p className="text-lg font-bold text-red-400 mt-1">GH₵ {report.totalExpenses.toFixed(2)}</p>
          <p className="text-[10px] text-[#777]">{report.dayExpenses.length} entry(s)</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-[11px] text-[#888]">Net Cashflow</p>
          <p className={`text-lg font-bold mt-1 ${report.netCashflow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            GH₵ {report.netCashflow.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Financial Breakdown */}
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-[#f5f5f5] border-b border-[#2a2a2a] pb-2">
            Sales &amp; Cash Reconciliation ({selectedDate})
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-[#ccc]">
              <span>Food &amp; Item Subtotal</span>
              <span className="font-semibold">GH₵ {report.foodSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#ccc]">
              <span>VAT Collected</span>
              <span className="font-semibold">GH₵ {report.totalVat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#ccc]">
              <span>Delivery Fees</span>
              <span className="font-semibold">GH₵ {report.totalDeliveryFees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#ccc]">
              <span>Orders (Dine In / Takeout / Delivery)</span>
              <span className="font-semibold">
                {report.orderTypes["Dine In"]} / {report.orderTypes.Takeout} / {report.orderTypes.Delivery}
              </span>
            </div>
            <div className="flex justify-between text-[#ccc] pt-2 border-t border-[#2a2a2a]">
              <span>Expected Cash On Hand (Cash Sales − Expenses)</span>
              <span className="font-bold text-yellow-400">
                GH₵ {report.expectedCashOnHand.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[#ccc]">
              <span>Waiter Shift Handovers (Approved / Total)</span>
              <span className="font-semibold text-emerald-400">
                GH₵ {report.approvedHandoverCash.toFixed(2)} / GH₵ {report.totalHandedOverCash.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[#ccc]">
              <span>Rider Settlements Recorded</span>
              <span className="font-semibold">GH₵ {report.totalRiderSettled.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shift Handovers & Expenses for the Day */}
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-4 text-xs">
          <div>
            <h3 className="text-sm font-bold text-[#f5f5f5] border-b border-[#2a2a2a] pb-2 mb-2">
              Waiter Shift Handovers ({report.dayHandovers.length})
            </h3>
            {report.dayHandovers.length === 0 ? (
              <p className="text-[#888]">No shift handovers recorded for {selectedDate}.</p>
            ) : (
              <div className="space-y-1.5">
                {report.dayHandovers.map((h) => (
                  <div key={h.id} className="flex justify-between items-center bg-[#141414] p-2.5 rounded-lg">
                    <div>
                      <span className="font-bold text-[#f5f5f5]">{h.waiter_name}</span>
                      <span className="text-[#888] ml-2">{h.total_orders} orders</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-yellow-400">
                        GH₵ {Number(h.cash_collected || 0).toFixed(2)}
                      </span>
                      <span className="ml-2 text-[10px] uppercase text-emerald-400">{h.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#f5f5f5] border-b border-[#2a2a2a] pb-2 mb-2">
              Daily Expenses ({report.dayExpenses.length})
            </h3>
            {report.dayExpenses.length === 0 ? (
              <p className="text-[#888]">No expenses recorded for {selectedDate}.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {report.dayExpenses.map((e) => (
                  <div key={e.id} className="flex justify-between items-center bg-[#141414] p-2.5 rounded-lg">
                    <span className="text-[#f5f5f5]">
                      {e.title} <span className="text-[#888]">({e.category})</span>
                    </span>
                    <span className="font-bold text-red-400">
                      - GH₵ {Number(e.amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZReportAdmin;

