"""
Translate Japanese / Chinese product titles + descriptions in the DB to English.

Strategy (in order of preference):
1. DeepL API (requires DEEPL_API_KEY env var) - best quality for JA
2. Google Translate via deep-translator (free, no key) - good fallback

Features:
- Idempotent: caches translations on disk (data/translation_cache.json)
  keyed by sha256(source_text). Re-runs skip rows already in English.
- Only rewrites rows whose title or description contain >= 12% non-ASCII
  characters, i.e. mostly CJK sources.
- Rewrites the row's title/description in place. Source URL is preserved.

Run:
    python3 -m backend.translate_products
Optional env:
    DEEPL_API_KEY=...      # use DeepL (higher quality for JA)
    TRANSLATE_PROVIDER=google|deepl
    TRANSLATE_LIMIT=500    # cap number of rows translated per run
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Product

CACHE_PATH = Path("data/translation_cache.json")
SLEEP_BETWEEN = 0.15  # seconds between translation calls
BATCH_COMMIT_EVERY = 20


def _load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text())
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _ascii_ratio(s: str) -> float:
    if not s:
        return 1.0
    return sum(1 for c in s if ord(c) < 128) / len(s)


def _needs_translation(s: str) -> bool:
    if not s or not s.strip():
        return False
    return _ascii_ratio(s) < 0.88


class Translator:
    def __init__(self) -> None:
        provider = os.environ.get("TRANSLATE_PROVIDER", "").lower()
        self.deepl_key = os.environ.get("DEEPL_API_KEY", "").strip()

        if provider == "deepl" or (not provider and self.deepl_key):
            self.provider = "deepl"
        elif provider == "google" or not provider:
            self.provider = "google"
        else:
            self.provider = provider

        if self.provider == "deepl" and not self.deepl_key:
            print("[translate] DeepL requested but no DEEPL_API_KEY found. Falling back to Google.")
            self.provider = "google"

        if self.provider == "google":
            from deep_translator import GoogleTranslator  # lazy import

            self._gt = GoogleTranslator(source="auto", target="en")
        else:
            from deep_translator import DeeplTranslator  # lazy import

            self._gt = DeeplTranslator(
                api_key=self.deepl_key, source="auto", target="en", use_free_api=True
            )
        print(f"[translate] provider={self.provider}")

    def translate(self, text: str) -> Optional[str]:
        if not text or not text.strip():
            return text
        chunk = text.strip()
        # DeepL and Google both handle up to a few thousand chars,
        # but trim to 1200 to be safe + cheap.
        if len(chunk) > 1200:
            chunk = chunk[:1200]
        try:
            out = self._gt.translate(chunk)
            if out and isinstance(out, str):
                return out.strip()
        except Exception as e:
            print(f"[translate] error ({self.provider}): {e}", file=sys.stderr)
            # fall back to google once if DeepL fails mid-run
            if self.provider != "google":
                try:
                    from deep_translator import GoogleTranslator

                    fallback = GoogleTranslator(source="auto", target="en").translate(chunk)
                    if fallback:
                        return fallback.strip()
                except Exception as e2:
                    print(f"[translate] google fallback error: {e2}", file=sys.stderr)
        return None


def translate_all(limit: Optional[int] = None) -> int:
    cache = _load_cache()
    tr = Translator()

    total_updated = 0
    session: Session = SessionLocal()
    try:
        q = session.query(Product).order_by(Product.id.asc())
        products = q.all()
        considered = 0
        for p in products:
            if limit is not None and total_updated >= limit:
                break

            before_title = p.title or ""
            before_desc = p.description or ""

            new_title = before_title
            new_desc = before_desc

            touched = False
            if _needs_translation(before_title):
                key = _hash(before_title)
                cached = cache.get(key)
                if cached:
                    new_title = cached
                else:
                    translated = tr.translate(before_title)
                    if translated and translated != before_title:
                        cache[key] = translated
                        new_title = translated
                        time.sleep(SLEEP_BETWEEN)
                if new_title != before_title:
                    touched = True

            if _needs_translation(before_desc):
                key = _hash(before_desc)
                cached = cache.get(key)
                if cached:
                    new_desc = cached
                else:
                    translated = tr.translate(before_desc)
                    if translated and translated != before_desc:
                        cache[key] = translated
                        new_desc = translated
                        time.sleep(SLEEP_BETWEEN)
                if new_desc != before_desc:
                    touched = True

            if touched:
                p.title = new_title
                p.description = new_desc
                total_updated += 1
                if total_updated % BATCH_COMMIT_EVERY == 0:
                    session.commit()
                    _save_cache(cache)
                    print(f"[translate] committed {total_updated} rows so far")
            considered += 1
            if considered % 40 == 0:
                print(f"[translate] considered {considered}/{len(products)} rows")

        session.commit()
        _save_cache(cache)
    finally:
        session.close()

    print(f"[translate] done. updated {total_updated} rows")
    return total_updated


if __name__ == "__main__":
    raw_limit = os.environ.get("TRANSLATE_LIMIT")
    lim = int(raw_limit) if raw_limit else None
    translate_all(limit=lim)
