import html
import re
import time
from typing import Dict, List, Optional, Tuple

import requests

API_BASE = "https://mpglobal.donki.com/EcWebManagement"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Public web app values used by Donki's own frontend requests.
AUTH_FORM = {
    "mchGroupId": "10000",
    "mchCode": "00651",
    "shopId": "EC001",
    "countryCode": "cn",
    "languageCode": "zh-cn",
}

MAX_DEMO_PRICE_YEN = 800.0
USD_TO_JPY_RATE = 158.0  # Unified project-wide FX (see canvas fx-margin-review)

TARGET_CATEGORY_NAMES = {
    "japanese-candy-party": "Japanese Candy Party",
    "travel-size-beauty": "Travel-Size Beauty",
    "cup-ramen-flavors": "Cup Ramen Flavors",
    "kawaii-stationery": "Kawaii Stationery",
    "snack-market": "Snack Market",
}

CLASSIFY_NAME_KEYWORDS = {
    "cup-ramen-flavors": ["方便面", "拉面", "乌冬", "荞麦", "炒面", "面条", "杯面", "泡面"],
    "travel-size-beauty": ["面膜", "唇", "洗发", "护发", "护肤", "美妆", "彩妆", "口红", "润唇"],
    "japanese-candy-party": ["糖", "软糖", "硬糖", "巧克力", "果冻"],
    "kawaii-stationery": ["文具", "笔记本", "贴纸", "手账", "便签", "笔"],
    "snack-market": ["零食", "饼干", "坚果", "点心", "食品", "米果", "仙贝"],
}

KEYWORDS = {
    "cup-ramen-flavors": [
        "拉面",
        "杯面",
        "泡面",
        "方便面",
        "乌冬",
        "荞麦",
        "炒面",
        "ramen",
        "udon",
        "soba",
        "yakisoba",
        "noodle",
    ],
    "travel-size-beauty": [
        "面膜",
        "护肤",
        "美妆",
        "化妆",
        "润唇",
        "唇膏",
        "口红",
        "洗面",
        "洁面",
        "乳液",
        "防晒",
        "护发",
        "洗发",
        "指甲",
        "beauty",
        "makeup",
        "lip",
        "mask",
        "skincare",
        "hair",
        "travel",
    ],
    "japanese-candy-party": [
        "糖",
        "软糖",
        "硬糖",
        "巧克力",
        "果冻",
        "口香糖",
        "candy",
        "gummy",
        "choco",
        "chocolate",
    ],
    "kawaii-stationery": [
        "文具",
        "笔",
        "笔记本",
        "便签",
        "贴纸",
        "胶带",
        "手账",
        "notebook",
        "stationery",
        "pen",
        "sticker",
        "tape",
    ],
    "snack-market": [
        "零食",
        "饼干",
        "薯片",
        "米果",
        "仙贝",
        "海苔",
        "坚果",
        "snack",
        "chips",
        "cracker",
    ],
}


def scrape_donki_products(
    max_products: int = 1200,
    page_size: int = 30,
    sleep_s: float = 0.05,
    max_price_yen: Optional[float] = None,
) -> Tuple[List[Dict], Dict[str, int]]:
    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    class_list = _get_class_list(session)
    classify_slug_map = _build_classify_slug_map(class_list)
    children_map = _build_children_map(class_list)
    target_class_ids = _pick_target_class_ids(classify_slug_map, children_map)
    seen_goods_ids = set()
    out: List[Dict] = []
    stats = {
        "classes": len(class_list),
        "mapped_classes": len(classify_slug_map),
        "target_classes": len(target_class_ids),
        "raw_rows": 0,
        "matched": 0,
    }

    for classify_id in target_class_ids:
        forced_slug = classify_slug_map[classify_id]

        page = 1
        total_pages: Optional[int] = None
        while True:
            rows, total_count = _get_category_rows(session, class_list, classify_id, page, page_size)
            if total_pages is None:
                total_pages = max(1, (total_count + page_size - 1) // page_size)

            if not rows:
                break

            for row in rows:
                stats["raw_rows"] += 1
                gid = str(row.get("goodsId", "")).strip()
                if not gid or gid in seen_goods_ids:
                    continue
                seen_goods_ids.add(gid)

                payload = _transform_row(row, forced_slug=forced_slug, max_price_yen=max_price_yen)
                if not payload:
                    continue

                out.append(payload)
                stats["matched"] += 1
                if len(out) >= max_products:
                    return out, stats

            page += 1
            if total_pages and page > total_pages:
                break
            time.sleep(sleep_s)

        time.sleep(sleep_s)

    return out, stats


def _get_class_list(session: requests.Session) -> List[Dict]:
    res = session.post(
        f"{API_BASE}/category/all/list",
        data=AUTH_FORM,
        timeout=30,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    res.raise_for_status()
    data = res.json()
    if data.get("result_code") != "SUCCESS":
        return []
    return data.get("data", {}).get("classList", []) or []


def _build_classify_slug_map(class_list: List[Dict]) -> Dict[str, str]:
    slug_map: Dict[str, str] = {}
    # first pass on name
    for cls in class_list:
        cid = str(cls.get("classifyId", "")).strip()
        name = str(cls.get("classifyName", "")).strip().lower()
        if not cid:
            continue
        for slug, keywords in CLASSIFY_NAME_KEYWORDS.items():
            if any(kw.lower() in name for kw in keywords):
                slug_map[cid] = slug
                break

    # second pass on parent linkage
    parent_by_id = {str(c.get("classifyId", "")): str(c.get("parentId", "")) for c in class_list}
    changed = True
    while changed:
        changed = False
        for cid, parent in parent_by_id.items():
            if cid in slug_map:
                continue
            parent_slug = slug_map.get(parent)
            if parent_slug:
                slug_map[cid] = parent_slug
                changed = True
    return slug_map


def _build_children_map(class_list: List[Dict]) -> Dict[str, List[str]]:
    children: Dict[str, List[str]] = {}
    for cls in class_list:
        cid = str(cls.get("classifyId", "")).strip()
        parent = str(cls.get("parentId", "")).strip()
        if not cid:
            continue
        children.setdefault(cid, [])
        if parent:
            children.setdefault(parent, []).append(cid)
    return children


def _pick_target_class_ids(classify_slug_map: Dict[str, str], children_map: Dict[str, List[str]]) -> List[str]:
    target: List[str] = []
    for cid in classify_slug_map:
        mapped_children = [child for child in children_map.get(cid, []) if child in classify_slug_map]
        if not mapped_children:
            target.append(cid)
    return target


def _get_category_rows(
    session: requests.Session,
    class_list: List[Dict],
    classify_id: str,
    page_index: int,
    page_size: int,
) -> Tuple[List[Dict], int]:
    body = dict(AUTH_FORM)
    body.update(_build_category_payload(class_list, classify_id))
    body.update({"pageIndex": str(page_index), "pageSize": str(page_size), "countFlag": "true"})
    res = session.post(
        f"{API_BASE}/category/detail/list",
        data=body,
        timeout=30,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    res.raise_for_status()
    data = res.json()
    if data.get("result_code") != "SUCCESS":
        return [], 0
    payload = data.get("data", {}) or {}
    rows = payload.get("data", []) or []
    total_count = int(payload.get("count", 0) or 0)
    return rows, total_count


def _build_category_payload(class_list: List[Dict], classify_id: str) -> Dict[str, str]:
    by_id = {str(cls.get("classifyId", "")).strip(): cls for cls in class_list}
    path: List[str] = []
    cur = classify_id
    guard = 0
    while cur and cur in by_id and guard < 10:
        path.append(cur)
        parent = str(by_id[cur].get("parentId", "")).strip()
        cur = parent
        guard += 1
    path = list(reversed(path))
    if not path:
        return {}

    payload: Dict[str, str] = {"gp": f"10000-{path[0]}"}
    if len(path) >= 2:
        payload["mediumClassification"] = f"10000-{path[1]}"
    if len(path) >= 3:
        payload["smallClassification"] = f"10000-{path[-1]}"
    return payload


def _transform_row(
    row: Dict,
    forced_slug: Optional[str] = None,
    max_price_yen: Optional[float] = None,
) -> Optional[Dict]:
    title = _clean(str(row.get("goodsName", "")).strip())
    if not title:
        return None

    category_slug = forced_slug or _map_category_slug(row)
    if not category_slug:
        return None

    price = float(row.get("goodsSalesPrice") or row.get("goodsOrgPrice") or 0.0)
    if price <= 0:
        return None
    if max_price_yen is not None and price > max_price_yen:
        return None

    goods_id = str(row.get("goodsId", "")).strip()
    if not goods_id:
        return None

    description = _clean(_strip_html(str(row.get("goodsText", "")).strip()))
    image_url = _pick_image(row.get("imageNetAddress"), row.get("internationalImageNetAddress"))
    popularity = float(row.get("goodsSalesCount") or 0.0)

    return {
        "source_site": "mpglobal.donki.com",
        "source_url": f"https://mpglobal.donki.com/ec-web/desktop/goods-detail?goodsId={goods_id}",
        "title": title,
        "slug": _slugify(title),
        "description": description,
        "image_url": image_url,
        "list_price": round(price, 2),
        "currency": "JPY",
        "cogs_usd": round(price / USD_TO_JPY_RATE, 2),
        "cogs_notes": "COGS proxy uses Donki listed sales price normalized for demo.",
        "tags": _derive_tags(row),
        "source_collection": str(row.get("gp", "") or ""),
        "category_slug": category_slug,
        "category_name": TARGET_CATEGORY_NAMES[category_slug],
        "category_subtitle": "",
        "popularity_score": popularity,
    }


def _map_category_slug(row: Dict) -> Optional[str]:
    text = " ".join(
        [
            str(row.get("category", "")),
            str(row.get("goodsName", "")),
            str(row.get("goodsKeyDisplay", "")),
            str(row.get("goodsKeyNonDisplay", "")),
            str(row.get("goodsText", "")),
        ]
    ).lower()

    for slug in ["cup-ramen-flavors", "travel-size-beauty", "japanese-candy-party", "kawaii-stationery", "snack-market"]:
        if any(kw.lower() in text for kw in KEYWORDS[slug]):
            return slug
    return None


def _pick_image(*values) -> str:
    for value in values:
        if isinstance(value, list) and value:
            first = str(value[0]).strip()
            if first:
                return first
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _strip_html(value: str) -> str:
    value = re.sub(r"<br\\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(value)


def _clean(value: str) -> str:
    return re.sub(r"\\s+", " ", value).strip()


def _derive_tags(row: Dict) -> str:
    txt = " ".join(
        [
            str(row.get("category", "")),
            str(row.get("goodsName", "")),
            str(row.get("goodsText", "")),
        ]
    ).lower()
    bag: List[str] = []
    for kw in ["candy", "snack", "beauty", "lip", "mask", "hair", "ramen", "noodle", "kawaii", "stationery"]:
        if kw in txt:
            bag.append(kw)
    return ",".join(sorted(set(bag)))


def _slugify(s: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return slug[:180] if slug else "product"

