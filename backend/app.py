import os
from math import ceil
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import Base, engine, get_db
from backend.models import Category, Product
from backend.schemas import CategoryOut, ProductAdmin, ProductPageAdmin, ProductPagePublic, ProductPublic
from backend.seed_from_scrape import run_seed

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"
TEMPLATES_DIR = WEB_DIR / "templates"
STATIC_DIR = WEB_DIR / "static"

ADMIN_TOKEN = os.getenv("HELLOKIYO_ADMIN_TOKEN", "demo-admin-token")

app = FastAPI(title="HelloKiyo Local Demo Backend", version="0.1.0")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


def require_admin(token: Optional[str]):
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized admin token.")


@app.get("/", response_class=HTMLResponse)
def home(request: Request, db: Session = Depends(get_db)):
    categories = (
        db.query(Category)
        .filter(Category.is_active == True)
        .order_by(Category.sort_order.asc(), Category.name.asc())
        .all()
    )
    counts = dict(
        db.query(Category.slug, func.count(Product.id))
        .join(Product, Product.category_id == Category.id)
        .filter(Product.is_active == True)
        .group_by(Category.slug)
        .all()
    )
    view_categories = [
        {
            "slug": c.slug,
            "name": c.name,
            "subtitle": c.subtitle,
            "product_count": int(counts.get(c.slug, 0)),
        }
        for c in categories
    ]
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "categories": view_categories},
    )


@app.get("/category/{category_slug}", response_class=HTMLResponse)
def category_page(request: Request, category_slug: str, page: int = 1, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.slug == category_slug, Category.is_active == True).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return templates.TemplateResponse(
        "category.html",
        {
            "request": request,
            "category": {"slug": category.slug, "name": category.name, "subtitle": category.subtitle},
            "initial_page": max(1, page),
        },
    )


@app.post("/api/admin/seed")
def admin_seed(
    x_admin_token: Optional[str] = Header(default=None),
    per_category_limit: int = 24,
):
    require_admin(x_admin_token)
    run_seed(per_category_limit=per_category_limit)
    return {"ok": True, "seeded_limit_per_category": per_category_limit}


@app.get("/api/categories", response_model=list[CategoryOut])
def api_categories(db: Session = Depends(get_db)):
    categories = (
        db.query(Category)
        .filter(Category.is_active == True)
        .order_by(Category.sort_order.asc(), Category.name.asc())
        .all()
    )
    counts = dict(
        db.query(Category.slug, func.count(Product.id))
        .join(Product, Product.category_id == Category.id)
        .filter(Product.is_active == True)
        .group_by(Category.slug)
        .all()
    )
    return [
        CategoryOut(
            slug=c.slug,
            name=c.name,
            subtitle=c.subtitle,
            product_count=int(counts.get(c.slug, 0)),
        )
        for c in categories
    ]


@app.get("/api/categories/{category_slug}/products", response_model=ProductPagePublic)
def api_category_products(
    category_slug: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=40),
    db: Session = Depends(get_db),
):
    category = db.query(Category).filter(Category.slug == category_slug, Category.is_active == True).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    q = db.query(Product).filter(
        Product.category_id == category.id,
        Product.is_active == True,
    )
    total = q.count()
    rows = (
        q.order_by(Product.popularity_score.desc(), Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ProductPagePublic(
        category_slug=category.slug,
        category_name=category.name,
        page=page,
        page_size=page_size,
        total=total,
        products=[ProductPublic.model_validate(r) for r in rows],
    )


@app.get("/api/admin/products", response_model=ProductPageAdmin)
def api_admin_products(
    x_admin_token: Optional[str] = Header(default=None),
    category_slug: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    require_admin(x_admin_token)
    q = db.query(Product).filter(Product.is_active == True)
    if category_slug:
        category = db.query(Category).filter(Category.slug == category_slug).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        q = q.filter(Product.category_id == category.id)

    total = q.count()
    rows = q.order_by(Product.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ProductPageAdmin(
        page=page,
        page_size=page_size,
        total=total,
        products=[ProductAdmin.model_validate(r) for r in rows],
    )


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    cat_count = db.query(Category).count()
    product_count = db.query(Product).count()
    return {"ok": True, "categories": cat_count, "products": product_count}


def _page_count(total: int, page_size: int) -> int:
    return int(max(1, ceil(total / page_size)))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)

