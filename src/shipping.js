// Shipping is NOT included in the box price.
//
// We present only two customer-facing options (Standard, Expedited) and
// estimate shipping at checkout based on (1) chosen box tier (proxy for
// package weight/size) and (2) destination region. We keep the estimator
// deliberately simple for the demo: it's a range table, and we charge the
// midpoint by default while still surfacing the range for transparency.

export const DESTINATIONS = [
  { id: "us", label: "United States" },
  { id: "canada", label: "Canada" },
  { id: "uk_eu", label: "UK / EU" },
  { id: "au_nz", label: "Australia / NZ" },
  { id: "asia", label: "Asia" },
  { id: "other", label: "Other" },
];

export const SHIPPING_OPTIONS = [
  { id: "standard", label: "Standard", speedLabel: "6–12 business days" },
  { id: "expedited", label: "Expedited", speedLabel: "3–6 business days" },
];

// Estimated customer-facing shipping ranges (USD) by tier and destination.
// Directional numbers for the demo; swap with real carrier quoting later.
const RANGE = {
  box_50: {
    us: { standard: [9.99, 14.99], expedited: [18.99, 24.99] },
    canada: { standard: [11.99, 16.99], expedited: [20.99, 27.99] },
    uk_eu: { standard: [13.99, 18.99], expedited: [24.99, 32.99] },
    au_nz: { standard: [14.99, 20.99], expedited: [26.99, 35.99] },
    asia: { standard: [8.99, 12.99], expedited: [16.99, 22.99] },
    other: { standard: [15.99, 22.99], expedited: [28.99, 39.99] },
  },
  box_99: {
    us: { standard: [12.99, 18.99], expedited: [22.99, 31.99] },
    canada: { standard: [14.99, 21.99], expedited: [24.99, 35.99] },
    uk_eu: { standard: [16.99, 24.99], expedited: [29.99, 41.99] },
    au_nz: { standard: [18.99, 27.99], expedited: [32.99, 45.99] },
    asia: { standard: [11.99, 16.99], expedited: [20.99, 28.99] },
    other: { standard: [19.99, 29.99], expedited: [35.99, 49.99] },
  },
  box_169: {
    us: { standard: [15.99, 23.99], expedited: [28.99, 39.99] },
    canada: { standard: [17.99, 26.99], expedited: [31.99, 44.99] },
    uk_eu: { standard: [19.99, 29.99], expedited: [36.99, 52.99] },
    au_nz: { standard: [21.99, 33.99], expedited: [39.99, 58.99] },
    asia: { standard: [13.99, 19.99], expedited: [25.99, 35.99] },
    other: { standard: [24.99, 36.99], expedited: [44.99, 64.99] },
  },
  box_249: {
    us: { standard: [18.99, 28.99], expedited: [34.99, 49.99] },
    canada: { standard: [20.99, 31.99], expedited: [37.99, 54.99] },
    uk_eu: { standard: [22.99, 35.99], expedited: [44.99, 64.99] },
    au_nz: { standard: [24.99, 38.99], expedited: [49.99, 71.99] },
    asia: { standard: [15.99, 23.99], expedited: [29.99, 41.99] },
    other: { standard: [28.99, 42.99], expedited: [54.99, 79.99] },
  },
};

export function getDefaultShippingOption() {
  return SHIPPING_OPTIONS[0];
}

export function getDefaultDestination() {
  return DESTINATIONS[0];
}

export function shippingRangeUsd({ boxTierId, destinationId, optionId }) {
  const tier = RANGE[boxTierId] || RANGE.box_99;
  const zone = tier[destinationId] || tier.us;
  const range = zone[optionId] || zone.standard;
  return { min: range[0], max: range[1] };
}

export function shippingQuoteUsd(args) {
  const r = shippingRangeUsd(args);
  return round2((r.min + r.max) / 2);
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

