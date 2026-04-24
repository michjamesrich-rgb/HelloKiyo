from typing import List

from pydantic import BaseModel


class CategoryOut(BaseModel):
    slug: str
    name: str
    subtitle: str
    product_count: int

    class Config:
        from_attributes = True


class ProductPublic(BaseModel):
    id: int
    title: str
    slug: str
    description: str
    image_url: str
    source_site: str
    source_url: str
    list_price: float
    currency: str

    class Config:
        from_attributes = True


class ProductAdmin(ProductPublic):
    cogs_usd: float
    cogs_notes: str


class ProductPagePublic(BaseModel):
    category_slug: str
    category_name: str
    page: int
    page_size: int
    total: int
    products: List[ProductPublic]


class ProductPageAdmin(BaseModel):
    page: int
    page_size: int
    total: int
    products: List[ProductAdmin]

