#!/usr/bin/env python3
"""
MVP stub: demonstrates the ingestion shape without external dependencies.

Real scraping requires careful domain-specific parsing and legal/ToS review.
This script intentionally does NOT target any specific third-party website.
"""

import hashlib
import json
from datetime import datetime, timezone


def stable_id(domain: str, product_url: str) -> str:
    h = hashlib.sha256(f"{domain}|{product_url}".encode("utf-8")).hexdigest()[:16]
    return f"src_{domain.replace('.', '_')}_{h}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> None:
    # Replace with extracted results from your domain parser.
    extracted = [
        {
            "domain": "example.jp",
            "productUrl": "https://example.jp/products/123",
            "title": "Example JP Candy",
            "category": "Snacks",
            "images": ["https://example.jp/images/123.jpg"],
        }
    ]

    items = []
    for x in extracted:
        item = {
            "id": stable_id(x["domain"], x["productUrl"]),
            "title": x["title"],
            "category": x["category"],
            "vibe": [],
            "images": x.get("images", []),
            "source": {
                "domain": x["domain"],
                "productUrl": x["productUrl"],
                "capturedAt": now_iso(),
                "rawTitle": x["title"],
            },
            "compliance": {
                "robotsAllowed": None,
                "tosUrl": None,
                "tosRisk": "unknown",
            },
            "costBasis": {
                "supplierUnitCostUsd": 0.0,
                "expectedJapanToUSShippingAllocationUsd": 0.0,
                "handlingAllowanceUsd": 0.0,
            },
            "status": {"isActive": False, "needsReview": True},
        }
        items.append(item)

    print(json.dumps(items, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

