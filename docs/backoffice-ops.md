## Back-office / Ops (MVP starter kit)

This repo is a **storefront prototype**. Until Shopify + a real Ops UI is built, use this lightweight flow:

### 1) Orders (Shopify source of truth)
- Box tier SKUs: `Box_50`, `Box_99`, `Box_169`, `Box_249`
- Each order must include a **contents manifest** (see `ops/box-contents-manifest.schema.json`).

### 2) Contents manifest handoff (temporary)
For MVP demos, the “manifest” can be exported manually:
- open browser devtools → Application → Local Storage
- key: `hellokiyo_events_v1` (events)
- the selected items are visible in the UI list

When Shopify is wired:
- store the manifest on the order (metafield or note attributes)
- also copy it into your Ops datastore for fulfillment

### 3) Fulfillment states (spreadsheet-friendly)
Use these columns for a sheet:
- `orderId`
- `customerName`
- `boxTier`
- `status` (`needsReview | sourcingInProgress | packed | shipped | delivered`)
- `exception` (`outOfStockSubstitutionNeeded | customerContactNeeded | cancelled | refundPending | none`)
- `manifestJson`
- `estimatedCostUsd`
- `actualCostUsd`
- `notes`

### 4) Landed-cost accounting (minimum viable)
Track per order:
- **COGS**: supplier receipts (sum item costs)
- **Japan→US freight**: invoice total
- **Packaging**: materials cost
- **Payment fees**: Shopify/payment processor fees

Then compute:
- `grossProfit = revenue - (cogs + freight + packaging + fees)`
- `grossMargin = grossProfit / revenue`

### 5) Analytics joins (how it will work once Shopify is live)
- Storefront event stream (PostHog/GA4): `box_selected`, `item_added`, `ai_pick_clicked`, `bonus_claimed`, etc.
- Shopify webhooks: `orders/create`, `orders/paid`, `orders/fulfilled`
- Join key: `orderId` + (optional) `clientSessionId` stored on the cart/order attributes.

