import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FaCheckCircle, FaClock, FaMotorcycle, FaPhoneAlt, FaStore } from "react-icons/fa";
import { getPublicDeliveryTracking } from "../https/deliveryApi";
import { DELIVERY_STATUS_LABELS } from "../utils/deliveryZones";
import DeliveryMap from "../components/shared/DeliveryMap";
import logo from "../assets/images/logo.png";

const STEPS = [
  { key: "pending_assignment", label: "Order Confirmed" },
  { key: "accepted", label: "Rider Assigned" },
  { key: "picked_up", label: "Picked Up" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

const getStepIndex = (status) => {
  if (["pending_assignment", "preparing", "ready_for_pickup"].includes(status)) return 0;
  if (["assigned", "accepted", "arrived_at_restaurant"].includes(status)) return 1;
  if (status === "picked_up") return 2;
  if (status === "out_for_delivery") return 3;
  if (status === "delivered") return 4;
  return 0;
};

const TrackDelivery = () => {
  const { secureToken } = useParams();

  useEffect(() => {
    document.title = "Sideways Grillz | Track Your Delivery";
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-tracking", secureToken],
    queryFn: () => getPublicDeliveryTracking(secureToken),
    enabled: Boolean(secureToken),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-[#f5f5f5] flex items-center justify-center p-6">
        Loading delivery status...
      </div>
    );
  }

  if (isError || !data?.found) {
    return (
      <div className="min-h-screen bg-[#1f1f1f] text-[#f5f5f5] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 text-center space-y-3">
          <img src={logo} alt="Sideways Grillz" className="h-12 w-12 mx-auto rounded-xl" />
          <h1 className="text-lg font-bold text-yellow-400">
            {data?.expired ? "Tracking Link Expired" : "Tracking Link Not Found"}
          </h1>
          <p className="text-xs text-[#ababab]">
            This delivery tracking link is invalid or has expired. Please contact the restaurant for assistance.
          </p>
        </div>
      </div>
    );
  }

  const activeStep = getStepIndex(data.status);

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-[#f5f5f5] py-6 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Branding Header */}
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Sideways Grillz" className="h-11 w-11 rounded-xl border border-[#333]" />
            <div>
              <h1 className="text-base font-bold text-yellow-400">
                {data.restaurant?.name || "Sideways Grillz"}
              </h1>
              <p className="text-xs text-[#ababab]">Order #{data.order_ref}</p>
            </div>
          </div>

          {data.restaurant?.phone && (
            <a
              href={`tel:${data.restaurant.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#262626] text-xs font-bold text-yellow-400"
            >
              <FaStore size={12} /> Contact
            </a>
          )}
        </div>

        {/* Status & ETA */}
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#888]">Current Status</p>
              <h2 className="text-xl font-bold text-emerald-400">
                {DELIVERY_STATUS_LABELS[data.status] || data.status}
              </h2>
            </div>
            {data.estimated_delivery_at && (
              <div className="text-right">
                <p className="text-[11px] text-[#888] flex items-center justify-end gap-1">
                  <FaClock /> Estimated Arrival
                </p>
                <p className="text-sm font-bold text-yellow-400">
                  {new Date(data.estimated_delivery_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Progress Stepper */}
          <div className="grid grid-cols-5 gap-1.5 pt-2">
            {STEPS.map((s, idx) => (
              <div key={s.key} className="text-center space-y-1">
                <div
                  className={`h-2 rounded-full ${
                    idx <= activeStep ? "bg-emerald-400" : "bg-[#2e2e2e]"
                  }`}
                />
                <p
                  className={`text-[10px] ${
                    idx <= activeStep ? "text-[#f5f5f5] font-semibold" : "text-[#777]"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div className="text-xs text-[#ababab] pt-2 border-t border-[#2a2a2a]">
            <p>
              <strong className="text-[#f5f5f5]">Delivering to:</strong> {data.delivery_address}
            </p>
            <p className="text-[10px] text-[#777] mt-1">
              Last updated: {new Date(data.updated_at).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Rider Info */}
        {data.rider_name && (
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-yellow-400/15 text-yellow-400">
                <FaMotorcycle size={18} />
              </div>
              <div>
                <p className="text-xs text-[#888]">Your Rider</p>
                <p className="text-sm font-bold text-[#f5f5f5]">{data.rider_name}</p>
                <p className="text-[11px] text-[#ababab] capitalize">{data.rider_vehicle}</p>
              </div>
            </div>
            {data.rider_phone && (
              <a
                href={`tel:${data.rider_phone}`}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold flex items-center gap-1.5"
              >
                <FaPhoneAlt size={11} /> Call Rider
              </a>
            )}
          </div>
        )}

        {/* Map */}
        <DeliveryMap
          restaurant={data.restaurant}
          destination={{ address: data.delivery_address }}
          riderLocation={data.location}
          heightClass="h-64"
        />

        {data.status === "delivered" && (
          <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-300">
            <FaCheckCircle size={18} />
            <span>Your order has been delivered. Thank you for ordering from Sideways Grillz!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackDelivery;

