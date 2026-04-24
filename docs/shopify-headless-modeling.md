## Shopify headless modeling spike (fixed-price box + hidden contents)

### Goal
Support a checkout where the customer purchases exactly one **box tier** (`Box_50/99/169/249`) and the selected items become a **contents manifest** used for fulfillment and post-order analytics — without exposing per-item pricing.

### Shopify modeling (recommended)
- **Products in Shopify**
  - `Box_50`, `Box_99`, `Box_169`, `Box_249` as standard products/variants.
  - Optionally keep a “catalog mirror” (products for internal ops only) but **do not add them as priced line items**.

- **Checkout cart lines**
  - Add a single cart line: `Box_X`.
  - Attach the manifest via:
    - `cart.attributes` (Storefront API) and/or
    - `lineItem.properties` (line attributes / custom attributes) on the box line.

### Contents manifest (JSON)
Store on the order and also copy into your Ops layer for reliability.

Example `boxContentsManifest`:

```json
{
  "schemaVersion": 1,
  "boxTierId": "box_99",
  "targetProfitMargin": 0.45,
  "economics": {
    "allowableCostUsd": 54.45,
    "estimatedCostUsd": 41.2,
    "remainingUsd": 13.25
  },
  "items": [
    {
      "productId": "snack_gummy_1",
      "title": "JP Fruit Gummies (Assorted)",
      "category": "Snacks",
      "quantity": 1,
      "costBasisUsd": 1.15,
      "source": {
        "url": "https://example.jp/product/123",
        "capturedAt": "2026-04-24T00:00:00Z"
      }
    }
  ]
}
```

### Where to store it on Shopify
Options (in descending preference):
- **Order metafield** `hellokiyo.box_manifest` (best long-term, queryable from Admin/API).
- **Order note attributes** (easy; less structured; size limits apply).
- **Line item properties** on the box SKU (often convenient for fulfillment apps).

### Webhooks (joining storefront analytics with orders)
Listen for:
- `orders/create`
- `orders/paid`
- `orders/fulfilled`
- `refunds/create`

Webhook handler should:
- Persist the manifest and the order ID into the Ops datastore
- Snapshot order totals + shipping selections for margin audits

### MVP constraints
This repo currently runs as a static MVP without Shopify API calls.
When we add the headless Shopify integration, the first real “prototype” is:
- Create cart (Storefront API)
- Add `Box_X` variant
- Attach manifest to cart attributes
- Redirect to checkout URL

