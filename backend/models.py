from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    subtitle = Column(String(300), default="")
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    source_site = Column(String(120), nullable=False)
    source_url = Column(String(1000), unique=True, nullable=False, index=True)
    source_collection = Column(String(200), default="")

    title = Column(String(400), nullable=False)
    slug = Column(String(400), index=True, nullable=False)
    description = Column(Text, default="")
    image_url = Column(String(1000), default="")
    tags = Column(String(500), default="")

    list_price = Column(Float, default=0.0)  # supplier/source listed price
    currency = Column(String(12), default="USD")
    cogs_usd = Column(Float, default=0.0)  # hidden from public API
    cogs_notes = Column(String(500), default="")

    popularity_score = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)

    category = relationship("Category", back_populates="products")

