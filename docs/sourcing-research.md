# Japanese product sourcing research (for demo scraping)

## Priority source used in current demo

- **Site:** `japanesetaste.com`
- **Why chosen:** scrape-friendly category collections, clear product pages, visible product title/image/description/price.
- **What we pull now:**
  - product name
  - main image URL
  - short description
  - source URL
  - source listed price (used as `list_price`)
  - hidden backend COGS proxy (`cogs_usd`)

## Categories currently loaded

Each category has 20+ products available in DB and category pages support `20/page` pagination.

1. `snacks-candy`
2. `j-beauty-skincare`
3. `makeup-trends`
4. `hair-care`
5. `nail-care`
6. `stationery-notebooks`
7. `office-kawaii`
8. `gift-picks`

## Additional categories recommended for target demographic (12-24 female audience)

- **Kawaii character goods** (keychains, pouches, charms)
- **Phone accessories** (charms, cases, cute desk accessories)
- **Seasonal drops** (spring sakura, summer matsuri, holiday themes)
- **Limited collab bundles** (creator-themed picks)
- **Mini self-care kits** (face masks + lip care + beauty accessories)

## Candidate additional source sites for next ingestion phase

These are useful to investigate next to increase uniqueness and supplier options:

- `kokorojapanstore.com` (snacks/beauty category pages with many product links)
- `dokodemo.world` (broad Japanese commerce catalog; evaluate structure and anti-bot behavior)
- `yesstyle.com` (strong beauty assortment; likely more anti-bot controls)

## Important legal/compliance note

For investor demo, scraping pipeline demonstrates technical capability.
Before production, move to one or more of:

- official supplier feeds/APIs
- explicit partner permission
- affiliate/commercial agreements

This lowers legal risk and improves long-term reliability.

