## HelloKiyo wireframes (MVP)

### Screen_1_BoxTierSelection
- **Header**: Logo + tagline, box tier chips: `$50 Kiyo's Mini / $99 Cutie Classic / $169 Sparkle Spree / $249 Ultimate Kawaii`
- **Primary action**: pick a box tier (resets current selection)
- **Microcopy**: reinforces “shopping spree” vibe, no per-item pricing

### Screen_2_BoxBuilderAndGauge
- **Left rail (Your Box)**:
  - Speedometer-style gauge (0–100%) representing \(\sum itemCostBasis / boxAllowableCost\)
  - “Items” count
  - “Remaining” budget (internal, shown as remaining capacity in USD for now)
  - List of selected items with `category` pill + `Impact: Low/Medium/High`
  - Reset button
  - Checkout CTA (placeholder for Shopify headless)

### Screen_3_CatalogBrowse
- **Right panel (Shop the Drop)**:
  - Category filter chips: `All, Snacks, Beauty, Kawaii, Nails, Accessories`
  - Product cards:
    - Category badge
    - Title
    - Impact pill (proxy for hidden per-item cost)
    - “Add to box” button (disabled if at limit or no box selected)

### Interactions
- **Add-to-box**:
  - Add triggers a tiny “spark” animation at click location
  - Gauge animates smoothly to new fill value
- **Limit reached**:
  - “Add” becomes disabled and shows “At limit”
  - Toast explains the user should try a lower-impact pick

