## Catalog ingestion (bootstrap via scraping)

### What we store per item
Use `ops/catalog-item.schema.json` as the normalized shape.

Non-negotiables for auditability:
- `source.productUrl`
- `source.domain`
- `source.capturedAt`
- compliance flags (`robotsAllowed`, `tosUrl`, `tosRisk`)
- cost basis fields used by the gauge (`supplierUnitCostUsd`, `expectedJapanToUSShippingAllocationUsd`, `handlingAllowanceUsd`)

### Pipeline stages
1. **Discover**: take a list of seed URLs (category pages / searches) per domain.
2. **Extract**: fetch HTML, parse product cards → product URLs, titles, thumbnail URLs.
3. **Normalize**: map into `HelloKiyoCatalogItem` records; compute stable `id`.
4. **Compliance snapshot**:
   - fetch and cache `robots.txt`
   - store ToS URL if known for the domain
   - set `tosRisk` initially to `unknown` unless reviewed
5. **Review queue** (human in the loop):
   - approve category + vibe tags
   - set cost basis defaults (or import from receipts later)
   - toggle `isActive`
6. **Publish**: export a storefront-friendly dataset (like `data/products.json`) with only the fields needed by the UI.

### Notes
- For MVP, this repo includes placeholder product data in `data/products.json`.
- When scraping is implemented for real, we’ll cache images to a controlled bucket/CDN to avoid hotlinking and improve performance.

