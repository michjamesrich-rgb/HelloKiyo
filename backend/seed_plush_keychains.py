"""
Seed a curated "Plush & Keychains" category featuring popular Japanese
characters: Sanrio, Chiikawa, Pokemon, Studio Ghibli, Miffy, Rilakkuma.

Images use themed SVG data URIs as reliable fallbacks. These can be
swapped for real product images later by updating `image_url` in the DB.

Run:
    python3 -m backend.seed_plush_keychains
"""

from __future__ import annotations

import urllib.parse
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Category, Product

CATEGORY_SLUG = "plush-and-keychains"
CATEGORY_NAME = "Plush & Keychains"
CATEGORY_SUBTITLE = (
    "Sanrio, Chiikawa, Pokemon and Ghibli mini plush and character keychains."
)


def svg_data_url(title: str, emoji: str, bg: str, accent: str) -> str:
    """Build a cute themed SVG placeholder."""
    safe_title = (
        title.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("'", "&apos;")
    )
    svg = f"""<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 260'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='{bg}' stop-opacity='0.95'/>
      <stop offset='100%' stop-color='{accent}' stop-opacity='0.95'/>
    </linearGradient>
    <radialGradient id='gloss' cx='35%' cy='30%' r='60%'>
      <stop offset='0' stop-color='#fff' stop-opacity='0.55'/>
      <stop offset='1' stop-color='#fff' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='420' height='260' fill='url(#g)'/>
  <circle cx='110' cy='70' r='28' fill='#fff' opacity='0.35'/>
  <circle cx='340' cy='200' r='42' fill='#fff' opacity='0.25'/>
  <rect width='420' height='260' fill='url(#gloss)'/>
  <text x='210' y='150' text-anchor='middle' font-size='88' dominant-baseline='middle'>{emoji}</text>
  <text x='210' y='220' text-anchor='middle' font-family='Arial,sans-serif' font-size='15' font-weight='700' fill='#fff' opacity='0.95'>{safe_title}</text>
</svg>"""
    return "data:image/svg+xml;charset=UTF-8," + urllib.parse.quote(svg)


# Curated character lineup. Each entry:
#   brand = character universe, kind = plush | keychain | charm
CURATED = [
    # ---------- SANRIO ----------
    {
        "brand": "Sanrio",
        "character": "Hello Kitty",
        "kind": "Mini Plush Keychain",
        "flavor": "Classic red bow",
        "emoji": "🎀",
        "bg": "#ff9ac2",
        "accent": "#ff4fa3",
        "blurb": "Tiny Hello Kitty plush keychain with the iconic red bow. Bag, keys, or pencil-case — the main character stays with you.",
    },
    {
        "brand": "Sanrio",
        "character": "My Melody",
        "kind": "Mini Plush Keychain",
        "flavor": "Pink hood",
        "emoji": "🍓",
        "bg": "#ffc6dc",
        "accent": "#ff6fa9",
        "blurb": "My Melody mini plush in her signature pink hood. Soft, collectible, painfully cute.",
    },
    {
        "brand": "Sanrio",
        "character": "Cinnamoroll",
        "kind": "Mini Plush Keychain",
        "flavor": "Cloud blue",
        "emoji": "☁️",
        "bg": "#c9e6ff",
        "accent": "#6aa8ff",
        "blurb": "Cinnamoroll plush charm with fluffy ears and a cloud-soft blue palette. Every bag deserves one.",
    },
    {
        "brand": "Sanrio",
        "character": "Kuromi",
        "kind": "Mini Plush Keychain",
        "flavor": "Pastel punk",
        "emoji": "💀",
        "bg": "#d5c5ff",
        "accent": "#7b5cff",
        "blurb": "Kuromi plush charm with her signature jester hood. Soft-girl energy meets pastel punk.",
    },
    {
        "brand": "Sanrio",
        "character": "Pompompurin",
        "kind": "Mini Plush Keychain",
        "flavor": "Custard gold",
        "emoji": "🧈",
        "bg": "#ffe6a6",
        "accent": "#ffb84d",
        "blurb": "Pompompurin mini plush with his iconic brown beret. Warm, soft, and 100% good vibes.",
    },
    {
        "brand": "Sanrio",
        "character": "Pochacco",
        "kind": "Acrylic Charm",
        "flavor": "Cloud white",
        "emoji": "🐶",
        "bg": "#e8f5ff",
        "accent": "#6ab0ff",
        "blurb": "Glossy acrylic charm of Pochacco the cloud-soft pup. Pairs with everything in your bag.",
    },
    {
        "brand": "Sanrio",
        "character": "Pekkle",
        "kind": "Mini Plush Keychain",
        "flavor": "Sunny yellow",
        "emoji": "🐥",
        "bg": "#fff1a8",
        "accent": "#ffcc33",
        "blurb": "Pekkle the cheerful duck in mini plush form. A pocket-sized sunshine boost.",
    },
    # ---------- CHIIKAWA ----------
    {
        "brand": "Chiikawa",
        "character": "Chiikawa",
        "kind": "Mini Plush Keychain",
        "flavor": "Cream",
        "emoji": "🥺",
        "bg": "#fff5dc",
        "accent": "#ffb74d",
        "blurb": "Chiikawa mini plush that captures every soft-cheeked, teary-eyed moment. Peak soft vibes.",
    },
    {
        "brand": "Chiikawa",
        "character": "Hachiware",
        "kind": "Mini Plush Keychain",
        "flavor": "Blue stripe",
        "emoji": "🐱",
        "bg": "#d8eaff",
        "accent": "#5b8def",
        "blurb": "Hachiware the two-tone cat in mini plush form. Best friend energy, always.",
    },
    {
        "brand": "Chiikawa",
        "character": "Usagi",
        "kind": "Mini Plush Keychain",
        "flavor": "Wild energy",
        "emoji": "🐰",
        "bg": "#fff6d0",
        "accent": "#ffb74d",
        "blurb": "Usagi the chaotic bunny mini plush. Cute outside, absolute chaos inside.",
    },
    {
        "brand": "Chiikawa",
        "character": "Momonga",
        "kind": "Acrylic Charm",
        "flavor": "Berry pink",
        "emoji": "🌸",
        "bg": "#ffdbe9",
        "accent": "#ff6fa9",
        "blurb": "Glossy acrylic charm of the diva Momonga. Iconic attitude, portable size.",
    },
    # ---------- POKEMON ----------
    {
        "brand": "Pokemon",
        "character": "Pikachu",
        "kind": "Mini Plush Keychain",
        "flavor": "Electric yellow",
        "emoji": "⚡",
        "bg": "#ffeb8a",
        "accent": "#ffbf33",
        "blurb": "Pikachu mini plush keychain. Tiny sparks, huge nostalgia, classic for a reason.",
    },
    {
        "brand": "Pokemon",
        "character": "Eevee",
        "kind": "Mini Plush Keychain",
        "flavor": "Warm caramel",
        "emoji": "🦊",
        "bg": "#ffe3c2",
        "accent": "#d48a4c",
        "blurb": "Eevee mini plush in classic warm caramel. Soft, fluffy, and instantly collectible.",
    },
    {
        "brand": "Pokemon",
        "character": "Jigglypuff",
        "kind": "Mini Plush Keychain",
        "flavor": "Bubblegum pink",
        "emoji": "🎤",
        "bg": "#ffcce0",
        "accent": "#ff75a9",
        "blurb": "Jigglypuff mini plush that's soft, squishy, and secretly in charge.",
    },
    {
        "brand": "Pokemon",
        "character": "Snorlax",
        "kind": "Mini Plush Keychain",
        "flavor": "Sleep mode",
        "emoji": "💤",
        "bg": "#cde0ff",
        "accent": "#6484e3",
        "blurb": "Snorlax mini plush — peak nap energy on your bag. Mood, not a pokémon.",
    },
    {
        "brand": "Pokemon",
        "character": "Psyduck",
        "kind": "Acrylic Charm",
        "flavor": "Sunny yellow",
        "emoji": "🦆",
        "bg": "#fff1a8",
        "accent": "#f2b631",
        "blurb": "Psyduck acrylic charm — cute, confused, completely on-brand for your vibe.",
    },
    # ---------- GHIBLI ----------
    {
        "brand": "Studio Ghibli",
        "character": "Totoro",
        "kind": "Mini Plush Keychain",
        "flavor": "Forest grey",
        "emoji": "🌿",
        "bg": "#d5e8d4",
        "accent": "#6a8f61",
        "blurb": "Totoro mini plush from My Neighbor Totoro. Forest-soft, cozy, iconic.",
    },
    {
        "brand": "Studio Ghibli",
        "character": "Jiji",
        "kind": "Mini Plush Keychain",
        "flavor": "Midnight black",
        "emoji": "🐈‍⬛",
        "bg": "#cfd6e6",
        "accent": "#3a3f55",
        "blurb": "Jiji the witchy cat from Kiki's Delivery Service. Mini plush with major attitude.",
    },
    {
        "brand": "Studio Ghibli",
        "character": "Kodama",
        "kind": "Acrylic Charm",
        "flavor": "Spirit white",
        "emoji": "🌱",
        "bg": "#e8f5ea",
        "accent": "#86b391",
        "blurb": "Kodama forest-spirit acrylic charm from Princess Mononoke. Ghostly, glossy, cute.",
    },
    {
        "brand": "Studio Ghibli",
        "character": "Soot Sprite",
        "kind": "Mini Plush Keychain",
        "flavor": "Star-dusted",
        "emoji": "✨",
        "bg": "#e2d9ff",
        "accent": "#6c4bd0",
        "blurb": "Soot sprite mini plush with candy-star accent. Tiny, mysterious, absolutely adorable.",
    },
    # ---------- MIFFY & RILAKKUMA ----------
    {
        "brand": "Miffy",
        "character": "Miffy",
        "kind": "Mini Plush Keychain",
        "flavor": "Classic white",
        "emoji": "🐰",
        "bg": "#fff3f3",
        "accent": "#ff9bb5",
        "blurb": "Miffy mini plush — the Dutch bunny icon in minimalist Japanese kawaii style.",
    },
    {
        "brand": "Rilakkuma",
        "character": "Rilakkuma",
        "kind": "Mini Plush Keychain",
        "flavor": "Honey brown",
        "emoji": "🍯",
        "bg": "#f3d9b1",
        "accent": "#b58050",
        "blurb": "Rilakkuma mini plush — the relaxed bear energy your bag has been missing.",
    },
    {
        "brand": "Rilakkuma",
        "character": "Korilakkuma",
        "kind": "Mini Plush Keychain",
        "flavor": "Milky white",
        "emoji": "🥛",
        "bg": "#fff1f1",
        "accent": "#ffb0c4",
        "blurb": "Korilakkuma mini plush — the shy, milky-white little sister bear. Softest thing in your box.",
    },
    {
        "brand": "Rilakkuma",
        "character": "Kiiroitori",
        "kind": "Acrylic Charm",
        "flavor": "Sunshine yellow",
        "emoji": "🐤",
        "bg": "#fff2a3",
        "accent": "#f2b631",
        "blurb": "Kiiroitori acrylic charm — the tiny yellow chick who runs the group. Iconic.",
    },
    # ---------- MORE KAWAII ----------
    {
        "brand": "Sumikko Gurashi",
        "character": "Shirokuma",
        "kind": "Mini Plush Keychain",
        "flavor": "Cozy corner",
        "emoji": "🧸",
        "bg": "#e8e5f5",
        "accent": "#9285c8",
        "blurb": "Shirokuma mini plush from Sumikko Gurashi — the shy polar bear who lives in corners.",
    },
    {
        "brand": "Sumikko Gurashi",
        "character": "Neko",
        "kind": "Mini Plush Keychain",
        "flavor": "Shy peach",
        "emoji": "🍑",
        "bg": "#ffdecd",
        "accent": "#ff9a6b",
        "blurb": "Neko from Sumikko Gurashi — the shy cat in plush keychain form. Snuggly, bashful, beloved.",
    },
]


def upsert_category(db: Session) -> Category:
    cat = db.query(Category).filter(Category.slug == CATEGORY_SLUG).first()
    if not cat:
        cat = Category(
            slug=CATEGORY_SLUG,
            name=CATEGORY_NAME,
            subtitle=CATEGORY_SUBTITLE,
            sort_order=100,
            is_active=True,
        )
        db.add(cat)
    else:
        cat.name = CATEGORY_NAME
        cat.subtitle = CATEGORY_SUBTITLE
        cat.is_active = True
        cat.sort_order = 100
    db.flush()
    return cat


def seed() -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    inserted = 0
    try:
        cat = upsert_category(db)
        for entry in CURATED:
            brand = entry["brand"]
            character = entry["character"]
            kind = entry["kind"]
            flavor = entry["flavor"]
            title = f"{brand} {character} {kind}"
            slug = (
                f"plush-{brand}-{character}-{kind}".lower()
                .replace(" ", "-")
                .replace("&", "and")
                .replace("'", "")
            )
            source_url = f"hellokiyo://curated/plush/{slug}"
            description = entry["blurb"]
            image_url = svg_data_url(
                title=f"{character} · {kind}",
                emoji=entry["emoji"],
                bg=entry["bg"],
                accent=entry["accent"],
            )
            tags = f"{brand}|{kind}|{flavor}|kawaii|collectible"
            p = db.query(Product).filter(Product.source_url == source_url).first()
            if not p:
                p = Product(
                    source_url=source_url,
                    source_site="hellokiyo_curated",
                    category_id=cat.id,
                    slug=slug,
                    title=title,
                )
                db.add(p)
            p.category_id = cat.id
            p.source_site = "hellokiyo_curated"
            p.source_collection = f"Character: {brand}"
            p.title = title
            p.slug = slug
            p.description = description
            p.image_url = image_url
            p.tags = tags
            p.list_price = 620.0  # ~$4 USD — typical mini plush price range
            p.currency = "JPY"
            p.cogs_usd = 1.85
            p.cogs_notes = "character-licensed mini plush / charm"
            p.popularity_score = 80.0
            p.is_active = True
            inserted += 1
        db.commit()
    finally:
        db.close()
    print(f"Plush & Keychains seed complete: {inserted} curated items ready.")
    return inserted


if __name__ == "__main__":
    seed()
