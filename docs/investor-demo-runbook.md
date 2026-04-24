# HelloKiyo investor demo runbook (local)

## 1) Install dependencies

```bash
python3 -m pip install -r requirements.txt
```

## 2) Seed the database from Japanese product sources

```bash
python3 -m backend.seed_from_scrape
```

This currently scrapes category collections from `japanesetaste.com` and stores:
- category, product name, image, description
- source URL + source listed price
- hidden `cogs_usd` (admin/private only)

## 3) Run the local backend + site

```bash
python3 -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

Open:
- Home/category hub: `http://127.0.0.1:8000/`
- Example category page: `http://127.0.0.1:8000/category/snacks-candy`

## 4) Admin/private endpoints (COGS visible only here)

- Health: `GET /api/health`
- Categories: `GET /api/categories`
- Public category products: `GET /api/categories/{slug}/products?page=1&page_size=20`
- Admin products with COGS:
  - `GET /api/admin/products`
  - Include header: `x-admin-token: demo-admin-token`

You can change token with env var:

```bash
export HELLOKIYO_ADMIN_TOKEN="your-token"
```

## 5) Investor talking points

- Fully local backend + DB
- Scraped Japanese product catalog with source links
- Public storefront does not expose COGS
- Responsive category subpages with 20 products/page
- Clear upgrade path to production auth, richer sources, and fulfillment integrations

