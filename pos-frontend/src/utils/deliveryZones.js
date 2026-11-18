// ============================================================================
// Delivery Zone Matching, Fee Calculation & Token Helpers (Ghana / GHS)
// ============================================================================

export const DELIVERY_STATUS_LABELS = {
  pending_assignment: "Awaiting Assignment",
  assigned: "Assigned",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for Pickup",
  arrived_at_restaurant: "Arrived at Restaurant",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  failed: "Failed",
  returning: "Returning",
  returned: "Returned",
  cancelled: "Cancelled",
};

export const DISPATCH_COLUMNS = [
  { key: "awaiting", label: "Awaiting Assignment", statuses: ["pending_assignment", "preparing"] },
  { key: "assigned", label: "Assigned", statuses: ["assigned", "accepted"] },
  { key: "ready", label: "Ready for Pickup", statuses: ["ready_for_pickup", "arrived_at_restaurant"] },
  { key: "picked_up", label: "Picked Up", statuses: ["picked_up"] },
  { key: "out_for_delivery", label: "Out for Delivery", statuses: ["out_for_delivery"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "failed", label: "Failed / Returned", statuses: ["failed", "returning", "returned", "cancelled"] },
];

export const FAILURE_REASONS = [
  "Customer unreachable",
  "Incorrect address",
  "Customer unavailable",
  "Customer refused order",
  "Payment issue",
  "Vehicle breakdown",
  "Other",
];

export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isPointInPolygon = (lat, lng, polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;
    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const matchDeliveryZone = ({ address = "", lat = null, lng = null, zones = [] }) => {
  const cleanAddr = String(address || "").trim().toLowerCase();
  const activeZones = (zones || [])
    .filter((z) => z.is_active !== false)
    .sort((a, b) => Number(a.priority ?? 10) - Number(b.priority ?? 10));

  for (const zone of activeZones) {
    const type = zone.coverage_type || "neighborhoods";
    const data = zone.coverage_data || {};

    if (type === "neighborhoods") {
      const neighborhoods = Array.isArray(data.neighborhoods)
        ? data.neighborhoods
        : String(data.neighborhoods || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      if (cleanAddr && neighborhoods.some((n) => cleanAddr.includes(String(n).toLowerCase()))) {
        return { matched: true, zone };
      }
    } else if (type === "radius" && lat != null && lng != null) {
      const centerLat = Number(data.centerLat);
      const centerLng = Number(data.centerLng);
      const radiusKm = Number(data.radiusKm || 0);
      if (
        !Number.isNaN(centerLat) &&
        !Number.isNaN(centerLng) &&
        radiusKm > 0 &&
        haversineKm(Number(lat), Number(lng), centerLat, centerLng) <= radiusKm
      ) {
        return { matched: true, zone };
      }
    } else if (type === "polygon" && lat != null && lng != null) {
      if (isPointInPolygon(Number(lat), Number(lng), data.polygon)) {
        return { matched: true, zone };
      }
    }
  }

  return { matched: false, zone: null };
};

export const calculateDeliveryQuote = ({ zone, orderSubtotal = 0 }) => {
  if (!zone) {
    return {
      inCoverage: false,
      fee: 0,
      waived: false,
      meetsMinimum: true,
      minimumOrderAmount: 0,
      estimatedMinutes: 45,
    };
  }

  const baseFee = Number(zone.fee || 0);
  const threshold =
    zone.free_delivery_threshold != null && zone.free_delivery_threshold !== ""
      ? Number(zone.free_delivery_threshold)
      : null;
  const minOrder = Number(zone.minimum_order_amount || 0);
  const waived = threshold !== null && Number(orderSubtotal) >= threshold;

  return {
    inCoverage: true,
    fee: waived ? 0 : baseFee,
    originalFee: baseFee,
    waived,
    meetsMinimum: Number(orderSubtotal) >= minOrder,
    minimumOrderAmount: minOrder,
    estimatedMinutes: Number(zone.estimated_delivery_minutes || 35),
  };
};

export const normalizeGhanaPhone = (phone = "") => {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  return digits;
};

export const buildWhatsAppUrl = (phone, message = "") => {
  const normalized = normalizeGhanaPhone(phone);
  if (!normalized || normalized.length < 9) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalized}${text}`;
};

export const generateSecureToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const sha256Hex = async (text) => {
  const data = new TextEncoder().encode(String(text));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
};

