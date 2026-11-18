import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsAppUrl,
  calculateDeliveryQuote,
  DELIVERY_STATUS_LABELS,
  DISPATCH_COLUMNS,
  generateSecureToken,
  haversineKm,
  isPointInPolygon,
  matchDeliveryZone,
  normalizeGhanaPhone,
  sha256Hex,
} from "../src/utils/deliveryZones.js";

test("matchDeliveryZone matches neighborhood case-insensitively by priority", () => {
  const zones = [
    {
      id: "z2",
      name: "Greater Accra",
      priority: 20,
      fee: 30,
      coverage_type: "neighborhoods",
      coverage_data: { neighborhoods: ["Accra", "Osu"] },
      is_active: true,
    },
    {
      id: "z1",
      name: "East Legon Express",
      priority: 5,
      fee: 15,
      coverage_type: "neighborhoods",
      coverage_data: { neighborhoods: ["East Legon", "Adjiringanor"] },
      is_active: true,
    },
  ];

  const res = matchDeliveryZone({ address: "14 Boundary Rd, east legon, Accra", zones });
  assert.equal(res.matched, true);
  assert.equal(res.zone.id, "z1");
});

test("matchDeliveryZone returns unmatched for out-of-coverage address", () => {
  const zones = [
    {
      id: "z1",
      name: "East Legon",
      priority: 1,
      fee: 15,
      coverage_type: "neighborhoods",
      coverage_data: { neighborhoods: ["East Legon"] },
      is_active: true,
    },
  ];

  const res = matchDeliveryZone({ address: "Kumasi Central Market", zones });
  assert.equal(res.matched, false);
  assert.equal(res.zone, null);
});

test("matchDeliveryZone supports radius and polygon coverage", () => {
  const radiusZones = [
    {
      id: "zr",
      name: "5km Radius",
      priority: 1,
      fee: 12,
      coverage_type: "radius",
      coverage_data: { centerLat: 5.6037, centerLng: -0.187, radiusKm: 5 },
      is_active: true,
    },
  ];
  assert.equal(matchDeliveryZone({ lat: 5.61, lng: -0.19, zones: radiusZones }).matched, true);
  assert.equal(matchDeliveryZone({ lat: 6.69, lng: -1.62, zones: radiusZones }).matched, false);

  const poly = [
    { lat: 5.55, lng: -0.25 },
    { lat: 5.65, lng: -0.25 },
    { lat: 5.65, lng: -0.15 },
    { lat: 5.55, lng: -0.15 },
  ];
  assert.equal(isPointInPolygon(5.6, -0.2, poly), true);
  assert.equal(isPointInPolygon(5.7, -0.2, poly), false);
  assert.ok(haversineKm(5.6037, -0.187, 5.6037, -0.187) < 0.001);
});

test("calculateDeliveryQuote applies fee, minimum order, and free delivery threshold", () => {
  const zone = {
    fee: 20,
    minimum_order_amount: 50,
    free_delivery_threshold: 200,
    estimated_delivery_minutes: 30,
  };

  const underMin = calculateDeliveryQuote({ zone, orderSubtotal: 40 });
  assert.equal(underMin.meetsMinimum, false);
  assert.equal(underMin.fee, 20);
  assert.equal(underMin.waived, false);

  const freeDelivery = calculateDeliveryQuote({ zone, orderSubtotal: 250 });
  assert.equal(freeDelivery.meetsMinimum, true);
  assert.equal(freeDelivery.fee, 0);
  assert.equal(freeDelivery.waived, true);
});

test("normalizeGhanaPhone & buildWhatsAppUrl format valid Ghana numbers", () => {
  assert.equal(normalizeGhanaPhone("0241234567"), "233241234567");
  assert.equal(normalizeGhanaPhone("+233 50 987 6543"), "233509876543");
  assert.equal(buildWhatsAppUrl("0241234567"), "https://wa.me/233241234567");
  assert.equal(buildWhatsAppUrl("123"), null);
});

test("generateSecureToken & sha256Hex produce unpredictable 48-char tokens and 64-char hashes", async () => {
  const t1 = generateSecureToken();
  const t2 = generateSecureToken();
  assert.equal(t1.length, 48);
  assert.notEqual(t1, t2);
  const h1 = await sha256Hex(t1);
  assert.equal(h1.length, 64);
  assert.equal(h1, await sha256Hex(t1));
});

test("DISPATCH_COLUMNS covers all 13 delivery statuses", () => {
  const covered = new Set(DISPATCH_COLUMNS.flatMap((c) => c.statuses));
  for (const status of Object.keys(DELIVERY_STATUS_LABELS)) {
    assert.ok(covered.has(status), `Status ${status} missing from DISPATCH_COLUMNS`);
  }
});

