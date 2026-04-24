"""
Seed a curated "Crafts & DIY" category featuring popular Japanese craft
supplies for the 12–24 female demographic: origami / washi paper, deco
clay + sweets-deco, washi tape & stickers, UV resin kits, aquabeads,
and brush pens / calligraphy. Each product stays ≤ ~800 yen.

Images use themed SVG data URIs as reliable fallbacks. Swap `image_url`
for real product photos later as you ingest real source data.

Run:
    python3 -m backend.seed_crafts
"""

from __future__ import annotations

import urllib.parse
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Category, Product

CATEGORY_SLUG = "crafts-and-diy"
CATEGORY_NAME = "Crafts & DIY"
CATEGORY_SUBTITLE = (
    "Origami, deco clay, washi tape, UV resin and brush pens — the best "
    "of Japanese craft aisles (Daiso, PADICO, mt, Pilot, Kuretake)."
)


def svg_data_url(title: str, emoji: str, bg: str, accent: str) -> str:
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


# Curated Japanese craft supplies popular with the 12–24 F demographic.
# brand/maker → actual Japanese craft brands (Daiso, PADICO, mt, Pilot, etc.)
# kind       → product type (for slug + search classifier)
# sub_slug   → canonical subcategory id used by the frontend classifier
#
# Pricing: list_price in JPY (≤ 800 yen). cogs_usd roughly 0.55 × yen/145.
CURATED = [
    # ---------------- ORIGAMI & WASHI PAPER ----------------
    {
        "brand": "Toyo",
        "name": "Sakura Washi Origami Paper 60 sheets",
        "kind": "Origami Paper",
        "sub": "origami",
        "flavor": "Pastel cherry-blossom patterns",
        "emoji": "🌸",
        "bg": "#ffd6ea",
        "accent": "#ff4fa3",
        "blurb": "Toyo washi origami pack with 15 sakura-inspired pastel patterns across 60 sheets. Perfect for tsuru cranes, bookmarks and deco journaling.",
        "price_yen": 580,
        "cogs": 1.85,
    },
    {
        "brand": "Showa Grimm",
        "name": "Chiyogami Traditional Patterns 72 sheets",
        "kind": "Origami Paper",
        "sub": "origami",
        "flavor": "12 classic kimono prints",
        "emoji": "🎴",
        "bg": "#ffe3a8",
        "accent": "#e09b33",
        "blurb": "Chiyogami pack with 12 traditional Edo-era kimono prints. Gold accents on deep reds, indigos and peach — gorgeous for cranes, ornaments and card-making.",
        "price_yen": 680,
        "cogs": 2.10,
    },
    {
        "brand": "Daiso",
        "name": "Pastel Dots Origami 150 sheets",
        "kind": "Origami Paper",
        "sub": "origami",
        "flavor": "10 candy colors",
        "emoji": "🎨",
        "bg": "#e8dcff",
        "accent": "#8f6bff",
        "blurb": "Daiso's budget pack of 150 single-colored sheets in 10 pastel shades. Ideal for tsuru-garlands, kawaii bookmark swaps and bulk folding sessions.",
        "price_yen": 110,
        "cogs": 0.55,
    },
    {
        "brand": "Toyo",
        "name": "Gold Foil Origami 30 sheets",
        "kind": "Origami Paper",
        "sub": "origami",
        "flavor": "Metallic gold + rose-gold",
        "emoji": "✨",
        "bg": "#fff3b8",
        "accent": "#d4a733",
        "blurb": "Mirror-finish gold and rose-gold foil origami for statement cranes, wedding garlands or kirigami charms. Shimmery, heavier weight, photographs beautifully.",
        "price_yen": 560,
        "cogs": 1.70,
    },
    {
        "brand": "Showa Grimm",
        "name": "Kawaii Animal Print Origami 40 sheets",
        "kind": "Origami Paper",
        "sub": "origami",
        "flavor": "Bunny, cat, bear & panda prints",
        "emoji": "🐰",
        "bg": "#ffd6df",
        "accent": "#ff6fa9",
        "blurb": "40 sheets with super-cute repeating animal prints — bunnies, neko, pandas, bears. Each folded crane looks like a tiny plushie.",
        "price_yen": 480,
        "cogs": 1.55,
    },

    # ---------------- DECO CLAY & SWEETS DECO ----------------
    {
        "brand": "PADICO",
        "name": "Hearty Soft Air-Dry Clay — White 50g",
        "kind": "Clay",
        "sub": "clay",
        "flavor": "Ultra-soft modeling clay",
        "emoji": "🍩",
        "bg": "#f5ece0",
        "accent": "#b9956b",
        "blurb": "PADICO's famous super-light air-dry clay. Molds like marshmallow, dries bouncy and paintable. The gold standard for sweets-deco, fake donuts and miniature food art.",
        "price_yen": 540,
        "cogs": 1.65,
    },
    {
        "brand": "Daiso",
        "name": "Pastel Polymer Clay 6-color Set",
        "kind": "Clay",
        "sub": "clay",
        "flavor": "Pink, mint, lemon, lilac, peach, cream",
        "emoji": "🧁",
        "bg": "#ffe3ee",
        "accent": "#ff8bb9",
        "blurb": "Daiso polymer clay in 6 soft pastel colors. Mix flavors like ice-cream for charms, earrings, miniature food and deco stickers. Bake in a regular oven to set.",
        "price_yen": 330,
        "cogs": 1.05,
    },
    {
        "brand": "PADICO",
        "name": "Whipped Cream Deco Paste — Strawberry Pink",
        "kind": "Deco Cream",
        "sub": "clay",
        "flavor": "Pipe-able acrylic 'cream'",
        "emoji": "🍰",
        "bg": "#ffc8dc",
        "accent": "#ff5ca0",
        "blurb": "Pipe-able acrylic 'whipped cream' in strawberry pink. Fit any tip, pipe swirls onto phone cases, mirrors, jewelry bases — the Japanese decoden essential.",
        "price_yen": 780,
        "cogs": 2.40,
    },
    {
        "brand": "Daiso",
        "name": "Silicone Mold — Mini Sweets Set",
        "kind": "Silicone Mold",
        "sub": "clay",
        "flavor": "Donuts, macarons, hearts, stars",
        "emoji": "🍭",
        "bg": "#fff0b8",
        "accent": "#ffb84d",
        "blurb": "Flexible silicone mold with 12 mini-sweet cavities — donuts, macarons, hearts, stars. Works with clay, resin, soap or chocolate. The single most useful piece in any deco kit.",
        "price_yen": 220,
        "cogs": 0.80,
    },

    # ---------------- WASHI TAPE & STICKERS ----------------
    {
        "brand": "mt",
        "name": "mt Washi Tape — Sakura Pink",
        "kind": "Washi Tape",
        "sub": "washi-tape",
        "flavor": "Single roll, 15mm × 7m",
        "emoji": "🎀",
        "bg": "#ffcfe4",
        "accent": "#ff4fa3",
        "blurb": "An original roll from Japan's most iconic masking-tape brand. Translucent sakura pink — perfect for journals, scrapbooks, planner spreads and wall deco.",
        "price_yen": 260,
        "cogs": 0.85,
    },
    {
        "brand": "mt",
        "name": "mt Washi Tape Pastel Dots 3-roll Set",
        "kind": "Washi Tape",
        "sub": "washi-tape",
        "flavor": "Peach, mint, lavender",
        "emoji": "🫧",
        "bg": "#e0f3ff",
        "accent": "#6aa8ff",
        "blurb": "A mini-set of 3 mt washi rolls in pastel polka dots. Coordinated colors for layered journal tape, envelope sealing and photo-wall deco.",
        "price_yen": 780,
        "cogs": 2.30,
    },
    {
        "brand": "Sanrio",
        "name": "Sanrio Deco Sticker Sheet Pack",
        "kind": "Stickers",
        "sub": "stickers",
        "flavor": "Hello Kitty + My Melody + Cinnamoroll",
        "emoji": "💗",
        "bg": "#ffd9ec",
        "accent": "#ff6fa9",
        "blurb": "3-sheet Sanrio deco sticker pack. Over 120 mini stickers featuring Hello Kitty, My Melody and Cinnamoroll. Planner-sized and waterproof.",
        "price_yen": 420,
        "cogs": 1.35,
    },
    {
        "brand": "Daiso",
        "name": "Kawaii Flake Sticker Variety Pack",
        "kind": "Stickers",
        "sub": "stickers",
        "flavor": "200+ mini stickers, mixed themes",
        "emoji": "🌈",
        "bg": "#ffe5f2",
        "accent": "#ff8bb9",
        "blurb": "Daiso's cult-favorite flake-sticker bag. 200+ mini die-cut stickers — stars, hearts, food, animals. The secret ingredient in every aesthetic journal.",
        "price_yen": 110,
        "cogs": 0.50,
    },
    {
        "brand": "BGM",
        "name": "BGM Journal Sticker — Press Flowers",
        "kind": "Stickers",
        "sub": "stickers",
        "flavor": "Vintage botanical deco",
        "emoji": "🌷",
        "bg": "#f3ddc7",
        "accent": "#c28b3e",
        "blurb": "BGM's vintage-botanical sticker sheet — pressed flowers, herbs and labels with a warm analog palette. For journalers who want that slow, paper-first aesthetic.",
        "price_yen": 380,
        "cogs": 1.20,
    },

    # ---------------- UV RESIN & CHARMS ----------------
    {
        "brand": "Daiso",
        "name": "Daiso UV Resin — Clear Soft 25g",
        "kind": "UV Resin",
        "sub": "resin",
        "flavor": "Low-viscosity, jewel-clear",
        "emoji": "💎",
        "bg": "#dceeff",
        "accent": "#5ea3ff",
        "blurb": "Daiso's bestseller UV-curable resin. 25g of crystal-clear soft resin — pour into molds, cure with a UV lamp in 2 mins, get glossy charms every time.",
        "price_yen": 110,
        "cogs": 0.55,
    },
    {
        "brand": "PADICO",
        "name": "Silicone Mold — Heart & Star Charms",
        "kind": "Silicone Mold",
        "sub": "resin",
        "flavor": "12 cavities, mixed shapes",
        "emoji": "⭐",
        "bg": "#fff2a8",
        "accent": "#ffbe33",
        "blurb": "PADICO silicone mold with hearts, stars and geometric shapes. Pop clean, mirror-smooth resin charms in 2–3 mm thickness — ideal for keychains and bag charms.",
        "price_yen": 480,
        "cogs": 1.45,
    },
    {
        "brand": "Daiso",
        "name": "Resin Mix-in Pack — Glitter & Dried Flowers",
        "kind": "Resin Inclusions",
        "sub": "resin",
        "flavor": "Holo glitter + 12 dried-flower types",
        "emoji": "🌺",
        "bg": "#ffd6ea",
        "accent": "#ff5ca0",
        "blurb": "A resin-artist's dream mix-in pack. Holographic glitter, miniature dried flowers, star sequins and pearls — drop into resin for gallery-worthy charms.",
        "price_yen": 320,
        "cogs": 1.00,
    },
    {
        "brand": "Daiso",
        "name": "Resin Keychain Findings Assortment",
        "kind": "Jewelry Findings",
        "sub": "resin",
        "flavor": "Rings, strings, bails & pins",
        "emoji": "🔗",
        "bg": "#e2e8ff",
        "accent": "#6b78ff",
        "blurb": "An assortment bag of jump-rings, eye-pins, keychain rings, phone-strap clips and bails. Turns any resin charm into a finished bag charm or keychain in seconds.",
        "price_yen": 220,
        "cogs": 0.75,
    },

    # ---------------- BEADS & AQUABEADS ----------------
    {
        "brand": "Aquabeads",
        "name": "Aquabeads Starter Set — Character Collection",
        "kind": "Aquabeads",
        "sub": "beads",
        "flavor": "8 colors + pegboard + spray",
        "emoji": "🫧",
        "bg": "#e0f3ff",
        "accent": "#5ea3ff",
        "blurb": "Epoch's Aquabeads starter — 800 fuse-in-water beads, pegboard, pattern sheets and spray bottle. Make kawaii character pixel-art sprites with zero iron needed.",
        "price_yen": 780,
        "cogs": 2.40,
    },
    {
        "brand": "Kiwa",
        "name": "Pastel Bracelet Bead Kit",
        "kind": "Beads",
        "sub": "beads",
        "flavor": "Pearls, hearts, stars, letters",
        "emoji": "📿",
        "bg": "#ffe3ee",
        "accent": "#ff8bb9",
        "blurb": "All-in-one kit for making 2–3 pastel beaded bracelets. Includes pearls, heart beads, star beads, letter-beads and elastic cord. 10-minute make, forever wear.",
        "price_yen": 520,
        "cogs": 1.55,
    },
    {
        "brand": "Daiso",
        "name": "Perler Beads — Pastel Rainbow 800pc",
        "kind": "Beads",
        "sub": "beads",
        "flavor": "10 pastel colors",
        "emoji": "🌈",
        "bg": "#fff0b8",
        "accent": "#ffb84d",
        "blurb": "800 iron-in perler beads in 10 pastel shades. Create pixel-art coasters, fridge magnets, mini keychains or Pokemon sprites with the included pegboard.",
        "price_yen": 330,
        "cogs": 1.00,
    },

    # ---------------- BRUSH PENS & CALLIGRAPHY ----------------
    {
        "brand": "Pilot",
        "name": "Pilot Fude Makase Brush Pen — Extra Fine",
        "kind": "Brush Pen",
        "sub": "brush-pens",
        "flavor": "Synthetic brush tip, archival black",
        "emoji": "🖌️",
        "bg": "#efe3d3",
        "accent": "#6a4a22",
        "blurb": "Pilot's refillable fude pen with a flexible extra-fine synthetic brush tip. Perfect for hand-lettering, sumi-e sketches and kawaii journaling strokes.",
        "price_yen": 220,
        "cogs": 0.70,
    },
    {
        "brand": "Kuretake",
        "name": "Kuretake ZIG Clean Color Real Brush — Pink",
        "kind": "Brush Pen",
        "sub": "brush-pens",
        "flavor": "Water-based dye ink, true brush tip",
        "emoji": "🌸",
        "bg": "#ffd9ea",
        "accent": "#ff4fa3",
        "blurb": "Kuretake's cult brush pen with a real bristle tip and water-based dye ink. Paint watercolor washes, letter calligraphy, or blend colors with water — no palette needed.",
        "price_yen": 380,
        "cogs": 1.15,
    },
    {
        "brand": "Tombow",
        "name": "Tombow Fudenosuke Dual-Tip Brush Pen",
        "kind": "Brush Pen",
        "sub": "brush-pens",
        "flavor": "Hard + soft tips, black",
        "emoji": "✒️",
        "bg": "#d6e2ff",
        "accent": "#5a78ff",
        "blurb": "Tombow's famous hand-lettering pen with two tips — soft for dramatic strokes, hard for neat captions. The #1 brush pen for modern calligraphy practice.",
        "price_yen": 280,
        "cogs": 0.90,
    },
    {
        "brand": "Akashiya",
        "name": "Akashiya Calligraphy Practice Set",
        "kind": "Calligraphy Set",
        "sub": "brush-pens",
        "flavor": "Brush + ink stone + practice paper",
        "emoji": "🖋️",
        "bg": "#f3e5d3",
        "accent": "#a6813f",
        "blurb": "A starter shodō (calligraphy) practice kit with a small bamboo brush, solid ink stick, ink stone and 10 sheets of hanshi paper. The traditional Japanese way to slow down.",
        "price_yen": 760,
        "cogs": 2.30,
    },
]


def upsert_category(db: Session) -> Category:
    cat = db.query(Category).filter(Category.slug == CATEGORY_SLUG).first()
    if not cat:
        cat = Category(
            slug=CATEGORY_SLUG,
            name=CATEGORY_NAME,
            subtitle=CATEGORY_SUBTITLE,
            sort_order=110,
            is_active=True,
        )
        db.add(cat)
    else:
        cat.name = CATEGORY_NAME
        cat.subtitle = CATEGORY_SUBTITLE
        cat.is_active = True
        cat.sort_order = 110
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
            name = entry["name"]
            kind = entry["kind"]
            title = name  # already includes brand + descriptor
            slug = (
                f"crafts-{brand}-{name}".lower()
                .replace(" ", "-")
                .replace("&", "and")
                .replace("'", "")
                .replace("—", "-")
                .replace("–", "-")
                .replace(",", "")
                .replace("(", "")
                .replace(")", "")
            )
            source_url = f"hellokiyo://curated/crafts/{slug}"
            tags = "|".join([brand, kind, entry["flavor"], "japanese-craft", entry["sub"]])
            image_url = svg_data_url(
                title=f"{brand} · {kind}",
                emoji=entry["emoji"],
                bg=entry["bg"],
                accent=entry["accent"],
            )
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
            p.source_collection = f"Crafts: {brand}"
            p.title = title
            p.slug = slug
            p.description = entry["blurb"]
            p.image_url = image_url
            p.tags = tags
            p.list_price = float(entry["price_yen"])
            p.currency = "JPY"
            p.cogs_usd = float(entry["cogs"])
            p.cogs_notes = f"japanese craft supply · {kind}"
            p.popularity_score = 75.0
            p.is_active = True
            inserted += 1
        db.commit()
    finally:
        db.close()
    print(f"Crafts & DIY seed complete: {inserted} curated items ready.")
    return inserted


if __name__ == "__main__":
    seed()
