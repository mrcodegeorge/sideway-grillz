import React, { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaTimes,
  FaCompass,
  FaCheckCircle,
  FaHandPointer,
} from "react-icons/fa";

export const TOUR_STORAGE_KEY = "sideways_grillz_tour_done";

const TOUR_STEPS = [
  {
    target: null,
    requireClick: false,
    title: "Welcome to Sideways Grillz POS",
    description:
      "Let's take a hands-on tour! As we go, you'll click the highlighted buttons directly to see each part of the POS in action.",
    tip: "Click 'Start Tour' below, or skip anytime.",
  },
  {
    target: '[data-tour="nav-home"]',
    requireClick: true,
    title: "1. Go to Home Overview",
    description:
      "Click the highlighted Home button in the bottom bar to view live earnings, active orders, and popular dishes.",
    tip: "Try clicking the glowing Home button now!",
  },
  {
    target: '[data-tour="nav-orders"]',
    requireClick: true,
    title: "2. Open Orders Queue",
    description:
      "Click the highlighted Orders button to track Dine-In, Takeout, and Delivery orders in real time.",
    tip: "Click the glowing Orders button to jump there.",
  },
  {
    target: '[data-tour="nav-tables"]',
    requireClick: true,
    title: "3. Check Tables & Seating",
    description:
      "Click the highlighted Tables button to see Available vs Booked tables for Dine-In guests.",
    tip: "Click the glowing Tables button now.",
  },
  {
    target: '[data-tour="nav-more"]',
    requireClick: true,
    title: "4. Open the More Menu",
    description:
      "Click More to open quick actions: Shift Handover & Cash, Snap Photo / Report Issue, Change PIN, and Sign Out.",
    tip: "Click the glowing More button to peek inside.",
  },
  {
    target: '[data-tour="create-order"]',
    requireClick: true,
    title: "5. Start a New Order",
    description:
      "Tap the yellow Dish button to open Create Order! You can search existing customers, choose Dine In, Takeout, or Delivery, and head straight to the Menu.",
    tip: "Click the yellow Dish button (or Next) to open the Create Order modal.",
  },
  {
    target: null,
    requireClick: false,
    title: "6. Menu, Paystack & Thermal Receipts",
    description:
      "Inside the Menu, tap dishes to add them to the cart, choose Cash or Online (Paystack), and click Place Order to print 80mm / 58mm Thermal Cashier & Kitchen tickets.",
    tip: "You're all set! Replay anytime from More → Cashier Tour Guide.",
  },
];

const CashierTour = ({ isOpen, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);

  const currentStep = TOUR_STEPS[stepIndex];

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setSpotlightRect(null);
      return;
    }

    const updateSpotlight = () => {
      if (!currentStep?.target) {
        setSpotlightRect(null);
        return;
      }
      const el = document.querySelector(currentStep.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSpotlightRect({
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
        });
      } else {
        setSpotlightRect(null);
      }
    };

    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);

    // Attach click listener to the target element so clicking it advances the tour!
    let targetEl = null;
    const handleTargetClick = () => {
      setTimeout(() => {
        setStepIndex((prev) =>
          prev < TOUR_STEPS.length - 1 ? prev + 1 : prev
        );
      }, 150);
    };

    if (currentStep?.target && currentStep.requireClick) {
      targetEl = document.querySelector(currentStep.target);
      if (targetEl) {
        targetEl.addEventListener("click", handleTargetClick, { capture: true });
      }
    }

    return () => {
      window.removeEventListener("resize", updateSpotlight);
      if (targetEl) {
        targetEl.removeEventListener("click", handleTargetClick, {
          capture: true,
        });
      }
    };
  }, [isOpen, stepIndex, currentStep]);

  const handleFinish = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    onClose();
  };

  if (!isOpen) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Non-blocking Spotlight Cutout (target area stays clickable!) */}
      {spotlightRect ? (
        <>
          <div
            className="fixed left-0 right-0 top-0 bg-black/65 pointer-events-none"
            style={{ height: Math.max(0, spotlightRect.top) }}
          />
          <div
            className="fixed left-0 right-0 bottom-0 bg-black/65 pointer-events-none"
            style={{ top: spotlightRect.top + spotlightRect.height }}
          />
          <div
            className="fixed left-0 bg-black/65 pointer-events-none"
            style={{
              top: spotlightRect.top,
              height: spotlightRect.height,
              width: Math.max(0, spotlightRect.left),
            }}
          />
          <div
            className="fixed right-0 bg-black/65 pointer-events-none"
            style={{
              top: spotlightRect.top,
              height: spotlightRect.height,
              left: spotlightRect.left + spotlightRect.width,
            }}
          />

          {/* Pulsing highlight ring */}
          <div
            className="fixed rounded-2xl border-2 border-yellow-400 animate-pulse pointer-events-none transition-all duration-300"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
              boxShadow: "0 0 20px rgba(250, 204, 21, 0.55)",
            }}
          >
            {currentStep.requireClick && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-yellow-400 text-gray-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                <FaHandPointer size={10} /> Click here
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70 pointer-events-auto" />
      )}

      {/* Floating Tour Card (positioned above bottom bar when spotlighting) */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md pointer-events-auto transition-all duration-300 ${
          spotlightRect ? "bottom-28" : "top-1/2 -translate-y-1/2"
        }`}
      >
        <div className="bg-[#222] border border-yellow-400/60 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#333] pb-2.5">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs uppercase tracking-wider">
              <FaCompass />
              <span>
                Interactive Tour · Step {stepIndex + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="text-[#ababab] hover:text-white p-1"
              title="Close Tour"
            >
              <FaTimes />
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">
              {currentStep.title}
            </h3>
            <p className="text-sm text-[#d4d4d4] leading-relaxed">
              {currentStep.description}
            </p>
            {currentStep.tip && (
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-yellow-400/90">
                <strong>Tip:</strong> {currentStep.tip}
              </div>
            )}
          </div>

          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex
                    ? "w-6 bg-yellow-400"
                    : "w-2 bg-[#444] hover:bg-[#666]"
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#333]">
            <button
              type="button"
              onClick={handleFinish}
              className="text-xs text-[#ababab] hover:text-white font-semibold"
            >
              Skip Tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i - 1)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#333] text-white text-xs font-semibold border border-[#383838]"
                >
                  <FaArrowLeft size={10} /> Back
                </button>
              )}

              {isLast ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold"
                >
                  <FaCheckCircle size={12} /> Finish Tour
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold"
                >
                  {isFirst ? "Start Tour" : "Next"} <FaArrowRight size={10} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashierTour;
