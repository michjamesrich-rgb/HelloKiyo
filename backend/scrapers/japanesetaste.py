import re
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


@dataclass
class SourceCategory:
    slug: str
    name: str
    subtitle: str
    collection_urls: List[str]
    include_keywords: Optional[List[str]] = None
    exclude_keywords: Optional[List[str]] = None


USD_TO_JPY_RATE = 158.0  # Unified project-wide FX (see canvas fx-margin-review)
MAX_DEMO_PRICE_YEN = 800.0


def _collections(*urls: str) -> List[str]:
    return list(urls)


SOURCE_CATEGORIES: List[SourceCategory] = [
    SourceCategory(
        slug="japanese-candy-party",
        name="Japanese Candy Party",
        subtitle="Gummies, hard candy, and sweet snacks all under the 800-yen concept.",
        collection_urls=_collections(
            "https://japanesetaste.com/collections/japanese-hard-candy",
            "https://japanesetaste.com/collections/japanese-chewy-gummy-candy",
            "https://japanesetaste.com/collections/japanese-snacks",
        ),
    ),
    SourceCategory(
        slug="travel-size-beauty",
        name="Travel-Size Beauty",
        subtitle="Mini and lightweight beauty essentials that fit a quick self-care routine.",
        collection_urls=_collections(
            "https://japanesetaste.com/collections/sheet-masks",
            "https://japanesetaste.com/collections/feminine-care-products",
            "https://japanesetaste.com/collections/lips-makeup",
            "https://japanesetaste.com/collections/skin-care-cleansers",
        ),
    ),
    SourceCategory(
        slug="cup-ramen-flavors",
        name="Cup Ramen Flavors",
        subtitle="Classic and unique instant ramen flavor picks for fast meals.",
        collection_urls=_collections(
            "https://japanesetaste.com/collections/japanese-noodles",
            "https://japanesetaste.com/collections/udon-noodles",
            "https://japanesetaste.com/collections/soba-noodles",
            "https://japanesetaste.com/collections/japanese-soups-stocks-broths",
        ),
        include_keywords=["ramen", "yakisoba", "soba", "udon", "noodle"],
        exclude_keywords=[
            "sauce",
            "oil",
            "chopstick",
            "spatula",
            "press",
            "nori",
            "seasoning",
            "rayu",
            "latte",
            "coffee",
            "tea",
            "miso soup",
            "soup stock",
            "broth",
            "custard",
            "potato",
            "strainer",
            "pot",
            "frying pan",
            "turner",
        ],
    ),
    SourceCategory(
        slug="kawaii-stationery",
        name="Kawaii Stationery",
        subtitle="Cute notebooks and supplies that stay lightweight for bundle boxes.",
        collection_urls=_collections(
            "https://japanesetaste.com/collections/japanese-notebooks-stationery-paper",
            "https://japanesetaste.com/collections/office-supplies-japanese-stationery",
        ),
    ),
    SourceCategory(
        slug="snack-market",
        name="Snack Market",
        subtitle="More crunchy and savory snack options to boost variety.",
        collection_urls=_collections(
            "https://japanesetaste.com/collections/japanese-snacks",
        ),
    ),
]

CUP_RAMEN_FLAVOR_FALLBACKS: List[Dict[str, str]] = [
    {"title": "Nissin Cup Noodles Original Flavor", "description": "Classic soy-based instant cup ramen with springy noodles."},
    {"title": "Nissin Cup Noodles Seafood Flavor", "description": "Savory seafood broth with shrimp-inspired flavor notes."},
    {"title": "Nissin Cup Noodles Curry Flavor", "description": "Japanese curry-style cup ramen with rich, aromatic spices."},
    {"title": "Nissin Cup Noodles Chili Tomato Flavor", "description": "Tangy tomato broth with chili heat and noodle texture."},
    {"title": "Nissin Cup Noodles Cheese Curry Flavor", "description": "Creamy curry ramen profile with a cheesy finish."},
    {"title": "Nissin Cup Noodles Miso Flavor", "description": "Mellow miso ramen base with umami-forward flavor."},
    {"title": "Nissin Cup Noodles Spicy Miso Flavor", "description": "Miso broth with extra chili kick for spicy ramen fans."},
    {"title": "Nissin Cup Noodles Tonkotsu Flavor", "description": "Pork-bone style creamy broth profile in a cup ramen format."},
    {"title": "Nissin Cup Noodles Shoyu Garlic Flavor", "description": "Soy sauce ramen style with roasted garlic aroma."},
    {"title": "Nissin Donbei Kitsune Udon Cup", "description": "Sweet-savory udon cup style inspired by classic kitsune flavor."},
    {"title": "Nissin Donbei Tempura Soba Cup", "description": "Buckwheat soba cup noodle style with tempura-inspired seasoning."},
    {"title": "Nissin Yakisoba U.F.O. Sauce Flavor", "description": "Thick yakisoba noodles with bold Japanese sauce profile."},
    {"title": "Nissin Yakisoba U.F.O. Spicy Sauce Flavor", "description": "Spicier yakisoba cup noodle profile with umami sauce notes."},
    {"title": "Sapporo Ichiban Cup Star Shoyu Flavor", "description": "Shoyu ramen style with light aromatic broth."},
    {"title": "Sapporo Ichiban Cup Star Miso Flavor", "description": "Miso-forward ramen cup for rich savory flavor."},
    {"title": "Sapporo Ichiban Cup Star Shio Flavor", "description": "Salt-based shio ramen taste with clean broth finish."},
    {"title": "Acecook Super Cup Rich Tonkotsu Flavor", "description": "Hearty tonkotsu-style cup ramen with fuller noodle bite."},
    {"title": "Acecook Super Cup Spicy Miso Flavor", "description": "Spicy miso cup ramen with deep chili and umami notes."},
    {"title": "Maruchan Seimen Cup Shoyu Flavor", "description": "Straight-style noodles with balanced shoyu broth flavor."},
    {"title": "Maruchan Seimen Cup Seafood Flavor", "description": "Seafood-inspired cup ramen with smooth noodle texture."},
]


def scrape_all_categories(per_category_limit: int = 24, sleep_s: float = 0.15) -> List[Dict]:
    out: List[Dict] = []
    for cat in SOURCE_CATEGORIES:
        items = scrape_collection(cat, per_category_limit=per_category_limit, sleep_s=sleep_s)
        out.extend(items)
    return out


def scrape_collection(cat: SourceCategory, per_category_limit: int = 24, sleep_s: float = 0.15) -> List[Dict]:
    target_per_source = max(per_category_limit, 20)
    if cat.include_keywords:
        target_per_source = max(target_per_source, per_category_limit * 10)
    all_urls: List[str] = []
    seen = set()
    for collection_url in cat.collection_urls:
        collection_html = _get_html(collection_url)
        product_urls = _extract_product_urls(collection_html, collection_url)
        if cat.include_keywords:
            keyed = [u for u in product_urls if any(kw.lower() in u.lower() for kw in cat.include_keywords)]
            if keyed:
                product_urls = keyed + [u for u in product_urls if u not in set(keyed)]
        for url in product_urls[:target_per_source]:
            if url in seen:
                continue
            seen.add(url)
            all_urls.append(url)
    product_urls = all_urls[: max(per_category_limit * 3, 36)]

    items_under_cap: List[Dict] = []
    fallback_items: List[Dict] = []
    for idx, url in enumerate(product_urls):
        try:
            item = scrape_product(url)
            if not _matches_category_keywords(item, cat):
                continue
            item["category_slug"] = cat.slug
            item["category_name"] = cat.name
            item["category_subtitle"] = cat.subtitle
            item["source_collection"] = ",".join(cat.collection_urls)
            item["popularity_score"] = float(max(0, per_category_limit - idx))
            if item.get("source_price_yen", MAX_DEMO_PRICE_YEN + 1) <= MAX_DEMO_PRICE_YEN:
                items_under_cap.append(item)
            else:
                fallback_items.append(item)
        except Exception:
            continue
        time.sleep(sleep_s)

    if len(items_under_cap) >= per_category_limit:
        final_items = items_under_cap[:per_category_limit]
        return _backfill_with_cup_ramen_fallbacks(cat, final_items, per_category_limit)

    # If strict-cap supply is shallow, backfill cheapest remaining items
    # while keeping the demo-facing value capped at 800 JPY.
    fallback_items.sort(key=lambda x: x.get("source_price_yen", 10_000))
    needed = per_category_limit - len(items_under_cap)
    final_items = items_under_cap + fallback_items[:needed]
    return _backfill_with_cup_ramen_fallbacks(cat, final_items, per_category_limit)


def _backfill_with_cup_ramen_fallbacks(cat: SourceCategory, items: List[Dict], per_category_limit: int) -> List[Dict]:
    if cat.slug != "cup-ramen-flavors" or len(items) >= per_category_limit:
        return items[:per_category_limit]

    existing_urls = {i.get("source_url") for i in items}
    next_rank = max(1, per_category_limit - len(items))
    for idx, entry in enumerate(CUP_RAMEN_FLAVOR_FALLBACKS):
        source_url = f"https://www.nissin.com/jp/products/items/cup-ramen-demo-{idx+1}"
        if source_url in existing_urls:
            continue
        items.append(
            {
                "source_site": "nissin.com (curated demo)",
                "source_url": source_url,
                "title": entry["title"],
                "slug": _slugify(entry["title"]),
                "description": entry["description"],
                "image_url": "",
                "list_price": 800.0,
                "currency": "JPY",
                "source_price_yen": 800.0,
                "cogs_usd": round(800.0 / USD_TO_JPY_RATE, 2),
                "cogs_notes": "Curated demo cup ramen flavor variant normalized to 800 JPY.",
                "tags": "ramen,noodle,cup,flavor",
                "category_slug": cat.slug,
                "category_name": cat.name,
                "category_subtitle": cat.subtitle,
                "source_collection": ",".join(cat.collection_urls),
                "popularity_score": float(max(0, next_rank - idx)),
            }
        )
        if len(items) >= per_category_limit:
            break

    return items[:per_category_limit]


def _matches_category_keywords(item: Dict, cat: SourceCategory) -> bool:
    text = f"{item.get('title', '')} {item.get('description', '')}".lower()
    if cat.include_keywords:
        if not any(kw.lower() in text for kw in cat.include_keywords):
            return False
    if cat.exclude_keywords:
        if any(kw.lower() in text for kw in cat.exclude_keywords):
            return False
    return True


def scrape_product(product_url: str) -> Dict:
    html = _get_html(product_url)
    soup = BeautifulSoup(html, "lxml")

    title = _meta(soup, 'meta[property="og:title"]') or _text(soup, "h1") or "Untitled"
    desc = _meta(soup, 'meta[name="description"]') or ""
    image = (
        _meta(soup, 'meta[property="og:image"]')
        or _meta(soup, 'meta[name="twitter:image"]')
        or ""
    )
    price = _meta(soup, 'meta[property="product:price:amount"]') or "0"
    currency = _meta(soup, 'meta[property="product:price:currency"]') or "USD"

    price_num = _to_float(price)
    source_price_usd = price_num if currency.upper() == "USD" else price_num / USD_TO_JPY_RATE
    source_price_yen = price_num * USD_TO_JPY_RATE if currency.upper() == "USD" else price_num
    normalized_price_yen = min(MAX_DEMO_PRICE_YEN, round(source_price_yen, 0))
    # Keep demo products aligned to low-cost concept while preserving source reference.
    cogs = round(min(source_price_usd, MAX_DEMO_PRICE_YEN / USD_TO_JPY_RATE), 2)
    cogs_notes = (
        f"Source listed {currency.upper()} {round(price_num, 2)}; "
        f"normalized to <= {int(MAX_DEMO_PRICE_YEN)} JPY demo cap."
    )

    return {
        "source_site": "japanesetaste.com",
        "source_url": product_url,
        "title": _clean_title(title),
        "slug": _slugify(_clean_title(title)),
        "description": desc.strip(),
        "image_url": _normalize_image(image),
        "list_price": float(normalized_price_yen),
        "currency": "JPY",
        "source_price_yen": round(source_price_yen, 0),
        "cogs_usd": cogs,
        "cogs_notes": cogs_notes,
        "tags": _derive_tags(title, desc),
    }


def _derive_tags(title: str, desc: str) -> str:
    bag: List[str] = []
    txt = f"{title} {desc}".lower()
    for kw in [
        "kawaii",
        "snack",
        "candy",
        "beauty",
        "skin",
        "hair",
        "makeup",
        "nail",
        "gift",
        "stationery",
        "ramen",
        "noodle",
        "cup",
    ]:
        if kw in txt:
            bag.append(kw)
    return ",".join(sorted(set(bag)))


def _extract_product_urls(collection_html: str, base_url: str) -> List[str]:
    if "<urlset" in collection_html and "<loc>" in collection_html:
        urls: List[str] = []
        seen = set()
        for raw in re.findall(r"<loc>(.*?)</loc>", collection_html):
            full = raw.replace("&amp;", "&").strip()
            if "/products/" not in full:
                continue
            if full not in seen:
                seen.add(full)
                urls.append(full)
        return urls

    soup = BeautifulSoup(collection_html, "lxml")
    urls: List[str] = []
    seen = set()
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if "/products/" not in href:
            continue
        full = urljoin(base_url, href).split("?")[0]
        if full not in seen:
            seen.add(full)
            urls.append(full)
    return urls


def _get_html(url: str) -> str:
    res = requests.get(url, timeout=25, headers={"User-Agent": UA})
    res.raise_for_status()
    return res.text


def _meta(soup: BeautifulSoup, selector: str) -> Optional[str]:
    tag = soup.select_one(selector)
    return tag.get("content") if tag else None


def _text(soup: BeautifulSoup, selector: str) -> Optional[str]:
    tag = soup.select_one(selector)
    return tag.get_text(" ", strip=True) if tag else None


def _clean_title(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()


def _normalize_image(url: str) -> str:
    if not url:
        return ""
    return url.replace("http://", "https://")


def _to_float(v: str) -> float:
    try:
        return float(re.sub(r"[^0-9.]", "", v))
    except Exception:
        return 0.0


def _slugify(s: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return slug[:180] if slug else "product"

