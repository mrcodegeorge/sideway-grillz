import React, { useRef, useState } from "react";

const Invoice = ({
  orderInfo,
  setShowInvoice,
  initialCopyType = "cashier",
  isReprint = false,
}) => {
  const [copyType, setCopyType] = useState(initialCopyType);
  const [paperWidth, setPaperWidth] = useState("80mm");
  const cashierRef = useRef(null);
  const kitchenRef = useRef(null);

  if (!orderInfo) return null;

  const orderNum = orderInfo.orderDate
    ? Math.floor(new Date(orderInfo.orderDate).getTime())
    : orderInfo._id?.slice(0, 8) || "N/A";
  const orderShort = orderNum.toString().slice(-6);
  const orderType =
    orderInfo.customerDetails?.orderType ||
    (orderInfo.table ? "Dine In" : "Takeout");
  const tableLabel = orderInfo.table?.tableNo
    ? `TABLE ${orderInfo.table.tableNo}`
    : orderType === "Delivery"
      ? "DELIVERY"
      : "TAKEOUT";

  const formattedTime = orderInfo.orderDate
    ? new Date(orderInfo.orderDate).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "-";

  const openPrintWindow = (htmlBody, title) => {
    const WinPrint = window.open("", "", "width=420,height=700");
    if (!WinPrint) return;

    const printableWidth = paperWidth === "58mm" ? "48mm" : "72mm";

    WinPrint.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: ${paperWidth} auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: ${paperWidth};
              background: #fff;
              color: #000;
              font-family: 'Courier New', Courier, monospace;
              font-size: ${paperWidth === "58mm" ? "11px" : "12px"};
              line-height: 1.35;
              -webkit-print-color-adjust: exact;
            }
            .thermal-ticket {
              width: ${printableWidth};
              margin: 0 auto;
              padding: 3mm 1mm 10mm 1mm;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
            .center { text-align: center; }
            .bold { font-weight: 700; }
            .upper { text-transform: uppercase; }
            .title { font-size: ${paperWidth === "58mm" ? "15px" : "17px"}; font-weight: 700; letter-spacing: 0.5px; }
            .subtitle { font-size: 11px; font-weight: 700; margin-top: 2px; }
            .divider {
              border: 0;
              border-top: 1px dashed #000;
              margin: 6px 0;
            }
            .divider-solid {
              border: 0;
              border-top: 2px solid #000;
              margin: 6px 0;
            }
            .row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 6px;
              margin: 2px 0;
            }
            .row-left {
              flex: 1;
              word-break: break-word;
            }
            .row-right {
              white-space: nowrap;
              text-align: right;
            }
            .total-row {
              font-size: ${paperWidth === "58mm" ? "13px" : "15px"};
              font-weight: 700;
              margin-top: 4px;
            }
            .kot-box {
              border: 2px solid #000;
              padding: 4px 6px;
              margin: 6px 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: ${paperWidth === "58mm" ? "13px" : "15px"};
              font-weight: 700;
            }
            .kot-item {
              font-size: ${paperWidth === "58mm" ? "13px" : "14px"};
              font-weight: 700;
              padding: 3px 0;
              border-bottom: 1px dotted #000;
            }
            .small { font-size: 10px; }
            @media screen {
              body {
                margin: 12px auto;
                border: 1px dashed #ccc;
              }
              .page-break {
                border-bottom: 2px dashed #666;
                margin-bottom: 14px;
              }
            }
          </style>
        </head>
        <body>
          ${htmlBody}
        </body>
      </html>
    `);

    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => {
      WinPrint.print();
      WinPrint.close();
    }, 350);
  };

  const handlePrintCurrent = () => {
    const ref = copyType === "kitchen" ? kitchenRef : cashierRef;
    if (!ref.current) return;
    const title =
      copyType === "kitchen"
        ? `KOT #${orderShort}`
        : `Receipt #${orderShort}`;
    openPrintWindow(`<div class="thermal-ticket">${ref.current.innerHTML}</div>`, title);
  };

  const handlePrintBoth = () => {
    if (!cashierRef.current || !kitchenRef.current) return;
    const combined = `
      <div class="thermal-ticket page-break">${cashierRef.current.innerHTML}</div>
      <div class="thermal-ticket">${kitchenRef.current.innerHTML}</div>
    `;
    openPrintWindow(combined, `Order #${orderShort} - Cashier & Kitchen`);
  };

  const totalQty = (orderInfo.items || []).reduce(
    (sum, item) => sum + (item.quantity || 1),
    0
  );

  const renderCashierBody = () => (
    <div style={{ fontFamily: "'Courier New', Courier, monospace" }} className="text-black text-xs leading-snug">
      <div className="text-center">
        <div className="text-base font-bold tracking-wide uppercase">SIDEWAYS GRILLZ</div>
        <div className="text-[11px] font-bold uppercase mt-0.5">
          {isReprint ? "*** REPRINT: CASHIER COPY ***" : "CASHIER RECEIPT"}
        </div>
      </div>

      <hr className="border-t border-dashed border-black my-2" />

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>ORDER #:</span>
          <span className="font-bold">{orderShort}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE:</span>
          <span>{formattedTime}</span>
        </div>
        <div className="flex justify-between">
          <span>TYPE:</span>
          <span className="font-bold uppercase">
            {orderType}
            {orderInfo.table?.tableNo ? ` (TBL ${orderInfo.table.tableNo})` : ""}
          </span>
        </div>
        <div className="flex justify-between">
          <span>SERVER:</span>
          <span>{orderInfo.waiterName || "Staff"}</span>
        </div>
        <div className="flex justify-between">
          <span>CUST:</span>
          <span>{orderInfo.customerDetails?.name || "Walk-in"}</span>
        </div>
        {orderInfo.customerDetails?.phone && (
          <div className="flex justify-between">
            <span>TEL:</span>
            <span>{orderInfo.customerDetails.phone}</span>
          </div>
        )}
        {orderType === "Delivery" && orderInfo.customerDetails?.deliveryAddress && (
          <div className="pt-0.5">
            <span className="font-bold">DELIVERY ADDR: </span>
            <span>{orderInfo.customerDetails.deliveryAddress}</span>
          </div>
        )}
      </div>

      <hr className="border-t border-dashed border-black my-2" />

      <div className="flex justify-between font-bold text-[11px] mb-1">
        <span>QTY ITEM</span>
        <span>AMT (GHS)</span>
      </div>
      <div className="space-y-1 text-[11px]">
        {(orderInfo.items || []).map((item, index) => (
          <div key={index} className="flex justify-between items-start gap-2">
            <span className="flex-1">
              {item.quantity}x {item.name}
            </span>
            <span className="whitespace-nowrap">
              {Number(item.price || 0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <hr className="border-t border-dashed border-black my-2" />

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>SUBTOTAL</span>
          <span>GH₵ {Number(orderInfo.bills?.total || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>TAX (5.25%)</span>
          <span>GH₵ {Number(orderInfo.bills?.tax || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-dashed border-black mt-1">
          <span>TOTAL</span>
          <span>GH₵ {Number(orderInfo.bills?.totalWithTax || 0).toFixed(2)}</span>
        </div>
      </div>

      <hr className="border-t border-dashed border-black my-2" />

      <div className="text-[11px] space-y-0.5">
        <div className="flex justify-between">
          <span>PAID VIA:</span>
          <span className="font-bold uppercase">{orderInfo.paymentMethod || "Cash"}</span>
        </div>
        {orderInfo.paymentData?.paystack_reference && (
          <div className="break-all">
            <span>REF: {orderInfo.paymentData.paystack_reference}</span>
          </div>
        )}
      </div>

      <hr className="border-t border-dashed border-black my-2" />
      <div className="text-center text-[11px] font-bold">
        THANK YOU FOR DINING WITH US!
      </div>
    </div>
  );

  const renderKitchenBody = () => (
    <div style={{ fontFamily: "'Courier New', Courier, monospace" }} className="text-black text-xs leading-snug">
      <div className="text-center">
        <div className="text-base font-bold tracking-wide uppercase">SIDEWAYS GRILLZ</div>
        <div className="text-xs font-bold uppercase mt-0.5">
          {isReprint ? "*** REPRINT: KITCHEN KOT ***" : "*** KITCHEN TICKET ***"}
        </div>
      </div>

      <div className="border-2 border-black px-2 py-1.5 my-2 flex justify-between items-center font-bold text-sm">
        <span>#{orderShort}</span>
        <span>{tableLabel}</span>
      </div>

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>TIME:</span>
          <span>{formattedTime}</span>
        </div>
        <div className="flex justify-between">
          <span>SERVER:</span>
          <span className="font-bold">{orderInfo.waiterName || "Staff"}</span>
        </div>
        <div className="flex justify-between">
          <span>CUST:</span>
          <span>{orderInfo.customerDetails?.name || "Walk-in"}</span>
        </div>
        {orderType === "Delivery" && orderInfo.customerDetails?.deliveryAddress && (
          <div className="pt-0.5">
            <span className="font-bold">ADDR: </span>
            <span>{orderInfo.customerDetails.deliveryAddress}</span>
          </div>
        )}
      </div>

      <hr className="border-t-2 border-black my-2" />

      <div className="text-[11px] font-bold uppercase mb-1">
        PREP ITEMS ({totalQty})
      </div>
      <div className="space-y-1.5">
        {(orderInfo.items || []).map((item, index) => (
          <div
            key={index}
            className="text-sm font-bold border-b border-dotted border-black pb-1"
          >
            [ ] {item.quantity}x {item.name}
          </div>
        ))}
      </div>

      <hr className="border-t-2 border-black my-2" />
      <div className="text-center text-[11px] font-bold uppercase">
        *** KITCHEN COPY ***
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex justify-center items-center p-4">
      <div className="bg-[#1f1f1f] border border-[#383838] p-4 rounded-xl shadow-2xl w-[420px] max-h-[90vh] flex flex-col">
        {/* Copy Type Switcher + Roll Width */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="grid grid-cols-2 gap-1 bg-[#141414] p-1 rounded-lg flex-1">
            <button
              type="button"
              onClick={() => setCopyType("cashier")}
              className={`py-1.5 text-xs font-bold rounded-md transition-colors ${copyType === "cashier"
                  ? "bg-[#f6b100] text-[#1f1f1f]"
                  : "text-[#ababab] hover:text-white"
                }`}
            >
              Cashier Copy
            </button>
            <button
              type="button"
              onClick={() => setCopyType("kitchen")}
              className={`py-1.5 text-xs font-bold rounded-md transition-colors ${copyType === "kitchen"
                  ? "bg-[#f6b100] text-[#1f1f1f]"
                  : "text-[#ababab] hover:text-white"
                }`}
            >
              Kitchen KOT
            </button>
          </div>

          {/* Thermal Paper Width Toggle */}
          <div className="flex bg-[#141414] p-1 rounded-lg">
            {["80mm", "58mm"].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setPaperWidth(w)}
                className={`px-2 py-1.5 text-[11px] font-bold rounded-md transition-colors ${paperWidth === w
                    ? "bg-[#383838] text-white"
                    : "text-[#888] hover:text-white"
                  }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Thermal Paper Preview */}
        <div className="overflow-y-auto flex-1 bg-[#2a2a2a] p-3 rounded-lg flex justify-center">
          <div
            className={`bg-white p-3 shadow-md transition-all ${paperWidth === "58mm" ? "w-[220px]" : "w-[300px]"
              }`}
          >
            {copyType === "cashier" ? renderCashierBody() : renderKitchenBody()}
          </div>
        </div>

        {/* Hidden DOM nodes for Print Both */}
        <div className="hidden">
          <div ref={cashierRef}>{renderCashierBody()}</div>
          <div ref={kitchenRef}>{renderKitchenBody()}</div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-[#333]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintCurrent}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              Print {copyType === "kitchen" ? "Kitchen" : "Cashier"} ({paperWidth})
            </button>
            <button
              type="button"
              onClick={handlePrintBoth}
              className="bg-[#f6b100] hover:bg-yellow-500 text-[#1f1f1f] text-xs font-bold px-3 py-2 rounded-lg transition-colors"
            >
              Print Both
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowInvoice(false)}
            className="text-red-400 hover:bg-red-950/40 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
