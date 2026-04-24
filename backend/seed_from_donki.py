from collections import Counter

from backend.database import Base, SessionLocal, engine
from backend.models import Category, Product
from backend.scrapers.donki import scrape_donki_products
from backend.scrapers.japanesetaste import SOURCE_CATEGORIES
from backend.seed_from_scrape import upsert_category, upsert_product


def run_donki_seed(
    max_products: int = 1200,
    page_size: int = 30,
    reset_donki_only: bool = True,
    max_price_yen: float = 800.0,
):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        cat_map = {}
        for idx, cat in enumerate(SOURCE_CATEGORIES):
            c = upsert_category(db, cat.slug, cat.name, cat.subtitle, idx)
            cat_map[cat.slug] = c.id

        if reset_donki_only:
            db.query(Product).filter(Product.source_site == "mpglobal.donki.com").delete()
            db.flush()

        scraped, stats = scrape_donki_products(
            max_products=max_products,
            page_size=page_size,
            max_price_yen=max_price_yen if max_price_yen > 0 else None,
        )
        inserted = 0
        per_category = Counter()
        for item in scraped:
            cid = cat_map.get(item["category_slug"])
            if not cid:
                continue
            upsert_product(db, item, cid)
            inserted += 1
            per_category[item["category_slug"]] += 1

        db.commit()
        print(
            "Donki seed complete:",
            {
                "inserted": inserted,
                "classes_scanned": stats.get("classes", 0),
                "raw_rows_scanned": stats.get("raw_rows", 0),
                "matched_rows": stats.get("matched", 0),
                "per_category": dict(per_category),
            },
        )
    finally:
        db.close()


if __name__ == "__main__":
    run_donki_seed(max_products=1500, page_size=30, reset_donki_only=True, max_price_yen=800.0)

