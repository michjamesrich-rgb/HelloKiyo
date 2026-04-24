from sqlalchemy.orm import Session

from backend.database import Base, SessionLocal, engine
from backend.models import Category, Product
from backend.scrapers.japanesetaste import SOURCE_CATEGORIES, scrape_all_categories


def upsert_category(db: Session, slug: str, name: str, subtitle: str, sort_order: int) -> Category:
    cat = db.query(Category).filter(Category.slug == slug).first()
    if not cat:
        cat = Category(slug=slug, name=name, subtitle=subtitle, sort_order=sort_order, is_active=True)
        db.add(cat)
    else:
        cat.name = name
        cat.subtitle = subtitle
        cat.sort_order = sort_order
        cat.is_active = True
    db.flush()
    return cat


def upsert_product(db: Session, payload: dict, category_id: int):
    p = db.query(Product).filter(Product.source_url == payload["source_url"]).first()
    if not p:
        p = Product(source_url=payload["source_url"], source_site=payload["source_site"], category_id=category_id, slug=payload["slug"], title=payload["title"])
        db.add(p)

    p.category_id = category_id
    p.source_site = payload["source_site"]
    p.source_collection = payload.get("source_collection", "")
    p.title = payload["title"]
    p.slug = payload["slug"]
    p.description = payload.get("description", "")
    p.image_url = payload.get("image_url", "")
    p.tags = payload.get("tags", "")
    p.list_price = float(payload.get("list_price", 0.0))
    p.currency = payload.get("currency", "USD")
    p.cogs_usd = float(payload.get("cogs_usd", 0.0))
    p.cogs_notes = payload.get("cogs_notes", "")
    p.popularity_score = float(payload.get("popularity_score", 0.0))
    p.is_active = True


def run_seed(per_category_limit: int = 24):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Full refresh for demo curation updates (price caps/category shifts).
        db.query(Product).delete()
        db.query(Category).delete()
        db.flush()

        cat_map = {}
        for idx, cat in enumerate(SOURCE_CATEGORIES):
            c = upsert_category(db, cat.slug, cat.name, cat.subtitle, idx)
            cat_map[cat.slug] = c.id

        scraped = scrape_all_categories(per_category_limit=per_category_limit)
        seen_source_urls = set()
        for item in scraped:
            cid = cat_map.get(item["category_slug"])
            if not cid:
                continue
            src = item.get("source_url", "")
            if not src or src in seen_source_urls:
                continue
            upsert_product(db, item, cid)
            seen_source_urls.add(src)

        db.commit()
        print(f"Seed complete: {len(scraped)} scraped items processed.")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed(per_category_limit=24)

