import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    orderId: "",
    activeOrderId: null,
    customerName: "",
    customerPhone: "",
    guests: 0,
    orderType: "Dine In",
    deliveryAddress: "",
    deliveryInstructions: "",
    deliveryZoneId: null,
    deliveryZoneName: "",
    deliveryFee: 0,
    originalDeliveryFee: 0,
    feeOverrideReason: "",
    estimatedDeliveryMinutes: 35,
    table: null
}


const customerSlice = createSlice({
    name: "customer",
    initialState,
    reducers: {
        setCustomer: (state, action) => {
            const {
              name,
              phone,
              guests,
              orderType,
              deliveryAddress,
              deliveryInstructions,
              deliveryZoneId,
              deliveryZoneName,
              deliveryFee,
              originalDeliveryFee,
              feeOverrideReason,
              estimatedDeliveryMinutes,
              activeOrderId,
            } = action.payload;
            state.orderId = `${Date.now()}`;
            state.activeOrderId = activeOrderId || null;
            state.customerName = name;
            state.customerPhone = phone;
            state.guests = guests || 0;
            state.orderType = orderType || "Dine In";
            state.deliveryAddress = deliveryAddress || "";
            state.deliveryInstructions = deliveryInstructions || "";
            state.deliveryZoneId = deliveryZoneId || null;
            state.deliveryZoneName = deliveryZoneName || "";
            state.deliveryFee = Number(deliveryFee || 0);
            state.originalDeliveryFee = Number(originalDeliveryFee ?? deliveryFee ?? 0);
            state.feeOverrideReason = feeOverrideReason || "";
            state.estimatedDeliveryMinutes = Number(estimatedDeliveryMinutes || 35);
        },

        removeCustomer: (state) => {
            state.activeOrderId = null;
            state.customerName = "";
            state.customerPhone = "";
            state.guests = 0;
            state.orderType = "Dine In";
            state.deliveryAddress = "";
            state.deliveryInstructions = "";
            state.deliveryZoneId = null;
            state.deliveryZoneName = "";
            state.deliveryFee = 0;
            state.originalDeliveryFee = 0;
            state.feeOverrideReason = "";
            state.estimatedDeliveryMinutes = 35;
            state.table = null;
        },

        updateTable: (state, action) => {
            state.table = action.payload.table;
        }

    }
})


export const { setCustomer, removeCustomer, updateTable } = customerSlice.actions;
export default customerSlice.reducer;