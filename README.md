# HelloKiyo (MVP)

Static MVP scaffold for **hellokiyo.com** focusing on the core mechanic:

- Users choose a fixed-price **box tier** ($50 Kiyo's Mini / $99 Cutie Classic / $169 Sparkle Spree / $249 Ultimate Kawaii)
- Users add items until a **profit/margin-driven capacity limit** is reached
- Item prices are **hidden**; users see a **capacity gauge**

## Run locally

This repo intentionally avoids external package managers in its initial MVP form.

Use any static file server. Examples:

- Python:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Key files

- `index.html`: UI shell
- `styles.css`: brand-ish styling (white/grey + pink/teal/royal accents)
- `src/economics.js`: box economics + gauge math
- `src/app.js`: box builder UI behavior
- `data/products.json`: starter catalog (placeholder data)

