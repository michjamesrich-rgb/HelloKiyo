// ---------------------------------------------------------------------------
// HelloKiyo box-tier economics.
//
// See canvases/fx-margin-review.canvas.tsx for the analysis that drives the
// numbers in this file. In short: we target a *net* profit margin after
// reserving payment processing and any fixed per-box costs we absorb (gift
// wrap / packaging). Customer shipping is *not* included in the box price
// and is calculated separately at checkout based on tier + destination.
//
//   product_budget = ticket × (1 − netMargin − PAYMENT_PCT) − FIXED_PACKAGING_USD
//
// Per-item cost is computed in src/app.js from the real retail yen price,
// with wholesale applying only to the curated $50 tier.
// ---------------------------------------------------------------------------

// Net margin target after every variable + fixed cost. Consistent across tiers.
export const NET_MARGIN_TARGET = 0.38;

// Card processing fee (Shopify Payments / Stripe avg ~2.9% + $0.30/txn).
// Expressed as % of ticket for per-box math.
export const PAYMENT_PCT = 0.03;

// Fixed per-box packaging the company absorbs no matter how big the box is.
// (Customer shipping is charged separately at checkout.)
export const FIXED_PACKAGING_USD = 2.0;

export const BOX_TIERS = [
  { id: "box_50", priceUsd: 50, targetProfitMargin: NET_MARGIN_TARGET },
  { id: "box_99", priceUsd: 99, targetProfitMargin: NET_MARGIN_TARGET },
  { id: "box_169", priceUsd: 169, targetProfitMargin: NET_MARGIN_TARGET },
  { id: "box_249", priceUsd: 249, targetProfitMargin: NET_MARGIN_TARGET },
];

export function boxAllowableCostUsd(boxTier) {
  const grossFactor = 1 - boxTier.targetProfitMargin - PAYMENT_PCT;
  const productBudget = boxTier.priceUsd * grossFactor - FIXED_PACKAGING_USD;
  return round2(Math.max(0, productBudget));
}

export function itemCostBasisUsd(item) {
  const supplierUnitCostUsd = num(item.supplierUnitCostUsd);
  const shippingAllocationUsd = num(item.expectedJapanToUSShippingAllocationUsd);
  const handlingAllowanceUsd = num(item.handlingAllowanceUsd);
  return round2(supplierUnitCostUsd + shippingAllocationUsd + handlingAllowanceUsd);
}

export function manifestCostUsd(items) {
  return round2(items.reduce((sum, it) => sum + itemCostBasisUsd(it), 0));
}

export function gaugeFill01({ boxTier, items }) {
  const allowable = Math.max(0.01, boxAllowableCostUsd(boxTier));
  const cost = manifestCostUsd(items);
  return clamp01(cost / allowable);
}

export function remainingBudgetUsd({ boxTier, items }) {
  return round2(boxAllowableCostUsd(boxTier) - manifestCostUsd(items));
}

export function canAddItem({ boxTier, items, candidateItem }) {
  const newItems = items.concat([candidateItem]);
  return manifestCostUsd(newItems) <= boxAllowableCostUsd(boxTier);
}

export function impactBand(item) {
  // User-facing "impact" proxy since prices are hidden.
  // Tunable bands (kept simple for MVP).
  const cost = itemCostBasisUsd(item);
  if (cost < 1.5) return "Low";
  if (cost < 3.5) return "Medium";
  return "High";
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
