import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice } from "../../redux/slices/cartSlice";
import {
  addOrder,
  recordPaystackPayment,
  updateTable,
} from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { removeCustomer } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

const Bill = () => {
  const dispatch = useDispatch();

  const userData = useSelector((state) => state.user);
  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const total = useSelector(getTotalPrice);
  const taxRate = 5.25;
  const tax = (total * taxRate) / 100;
  const totalPriceWithTax = total + tax;

  const [paymentMethod, setPaymentMethod] = useState();
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();

  const handlePlaceOrder = async () => {
    if (!cartData || cartData.length === 0) {
      enqueueSnackbar("Cart is empty! Add items first.", {
        variant: "warning",
      });
      return;
    }

    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", {
        variant: "warning",
      });
      return;
    }

    if (paymentMethod === "Online") {
      try {
        const res = await loadScript("https://js.paystack.co/v1/inline.js");

        if (!res) {
          enqueueSnackbar("Paystack SDK failed to load. Are you online?", {
            variant: "warning",
          });
          return;
        }

        const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        if (!paystackPublicKey) {
          enqueueSnackbar(
            "Paystack Public Key missing! Set VITE_PAYSTACK_PUBLIC_KEY in pos-frontend/.env",
            { variant: "error" }
          );
          return;
        }

        const currency = import.meta.env.VITE_PAYSTACK_CURRENCY || "GHS";
        // Paystack amount in lowest currency unit (e.g., pesewas/kobo/cents: amount * 100)
        const amountInSubunits = Math.round(totalPriceWithTax * 100);
        const customerEmail =
          customerData.customerEmail ||
          `${customerData.customerPhone || "customer"}@pos.restaurant`;

        const handler = window.PaystackPop.setup({
          key: paystackPublicKey,
          email: customerEmail,
          amount: amountInSubunits,
          currency: currency,
          ref: `POS_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
          metadata: {
            custom_fields: [
              {
                display_name: "Customer Name",
                variable_name: "customer_name",
                value: customerData.customerName || "Walk-in Customer",
              },
              {
                display_name: "Customer Phone",
                variable_name: "customer_phone",
                value: customerData.customerPhone || "",
              },
            ],
          },
          callback: function (response) {
            enqueueSnackbar("Paystack payment successful!", {
              variant: "success",
            });

            // Prepare order with Paystack verification metadata & waiter attribution
            const orderData = {
              waiterId: userData._id || userData.id,
              waiterName: userData.name || userData.username || "Staff",
              customerDetails: {
                name: customerData.customerName,
                phone: customerData.customerPhone,
                guests: customerData.guests,
                orderType: customerData.orderType || "Dine In",
                deliveryAddress: customerData.deliveryAddress || "",
              },
              orderStatus: "InProgress",
              bills: {
                total: total,
                tax: tax,
                totalWithTax: totalPriceWithTax,
              },
              items: cartData,
              table: customerData.table?.tableId || null,
              paymentMethod: "Paystack",
              paymentData: {
                paystack_reference: response.reference,
                paystack_status: response.status || "success",
                paystack_transaction: response.transaction,
              },
            };

            // Record payment & place order
            orderMutation.mutate(orderData);
          },
          onClose: function () {
            enqueueSnackbar("Payment window closed.", { variant: "info" });
          },
        });

        handler.openIframe();
      } catch (error) {
        console.error(error);
        enqueueSnackbar("Payment initialization failed!", {
          variant: "error",
        });
      }
    } else {
      // Cash payment
      const orderData = {
        waiterId: userData._id || userData.id,
        waiterName: userData.name || userData.username || "Staff",
        customerDetails: {
          name: customerData.customerName,
          phone: customerData.customerPhone,
          guests: customerData.guests,
          orderType: customerData.orderType || "Dine In",
          deliveryAddress: customerData.deliveryAddress || "",
        },
        orderStatus: "InProgress",
        bills: {
          total: total,
          tax: tax,
          totalWithTax: totalPriceWithTax,
        },
        items: cartData,
        table: customerData.table?.tableId || null,
        paymentMethod: paymentMethod,
      };
      orderMutation.mutate(orderData);
    }
  };

  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    onSuccess: async (resData) => {
      const { data } = resData.data;

      // If online/Paystack payment, log transaction in Supabase payments table
      if (data.paymentMethod === "Paystack" && data.paymentData?.paystack_reference) {
        await recordPaystackPayment({
          orderId: data._id || data.id,
          waiterId: userData._id || userData.id,
          amount: totalPriceWithTax,
          currency: import.meta.env.VITE_PAYSTACK_CURRENCY || "GHS",
          reference: data.paymentData.paystack_reference,
          status: data.paymentData.paystack_status || "success",
        });
      }

      setOrderInfo(data);

      // Update Table status to Booked if a table was assigned (Dine In)
      if (data.table) {
        const tableData = {
          status: "Booked",
          orderId: data._id || data.id,
          tableId: data.table,
        };

        setTimeout(() => {
          tableUpdateMutation.mutate(tableData);
        }, 1000);
      } else {
        // Takeout or Delivery: clear customer & cart immediately
        dispatch(removeCustomer());
        dispatch(removeAllItems());
      }

      enqueueSnackbar("Order Placed Successfully!", {
        variant: "success",
      });
      setShowInvoice(true);
    },
    onError: (error) => {
      console.error(error);
      enqueueSnackbar("Failed to place order.", { variant: "error" });
    },
  });

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData) => updateTable(reqData),
    onSuccess: () => {
      dispatch(removeCustomer());
      dispatch(removeAllItems());
    },
    onError: (error) => {
      console.error(error);
    },
  });

  return (
    <>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Items({cartData.length})
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          GH₵ {total.toFixed(2)}
        </h1>
      </div>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">Tax(5.25%)</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">GH₵ {tax.toFixed(2)}</h1>
      </div>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Total With Tax
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          GH₵ {totalPriceWithTax.toFixed(2)}
        </h1>
      </div>
      <div className="flex items-center gap-3 px-5 mt-4">
        <button
          onClick={() => setPaymentMethod("Cash")}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${paymentMethod === "Cash" ? "bg-[#383737] text-white" : ""
            }`}
        >
          Cash
        </button>
        <button
          onClick={() => setPaymentMethod("Online")}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg text-[#ababab] font-semibold ${paymentMethod === "Online" ? "bg-[#383737] text-white" : ""
            }`}
        >
          Online (Paystack)
        </button>
      </div>

      <div className="flex items-center gap-3 px-5 mt-4">
        <button className="bg-[#025cca] px-4 py-3 w-full rounded-lg text-[#f5f5f5] font-semibold text-lg">
          Print Receipt
        </button>
        <button
          onClick={handlePlaceOrder}
          className="bg-[#f6b100] px-4 py-3 w-full rounded-lg text-[#1f1f1f] font-semibold text-lg"
        >
          Place Order
        </button>
      </div>

      {showInvoice && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}
    </>
  );
};

export default Bill;
