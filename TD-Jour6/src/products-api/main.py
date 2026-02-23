import os
import uuid
import time
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

# Configuration
PORT = int(os.environ.get("PORT", 8082))
START_TIME = time.time()

# In-memory storage
products: List[dict] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def find_product_by_id(product_id: str) -> Optional[dict]:
    return next((p for p in products if p["id"] == product_id), None)


# Pydantic models
class ProductCreate(BaseModel):
    name: str
    description: str
    price: float = Field(gt=0)
    category: str
    stock: int = Field(ge=0)
    image_url: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    category: Optional[str] = None
    stock: Optional[int] = Field(default=None, ge=0)
    image_url: Optional[str] = None


# FastAPI app
app = FastAPI(title="CloudShop Products API", version="1.0.0")


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "error": "Validation error",
            "code": "VALIDATION_ERROR",
            "details": exc.errors(),
        },
    )


# Seed data on startup
@app.on_event("startup")
def seed_data():
    sample_products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Laptop Pro 15",
            "description": "High-performance laptop with 16GB RAM and 512GB SSD",
            "price": 1299.99,
            "category": "electronics",
            "stock": 50,
            "image_url": None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Wireless Headphones",
            "description": "Noise-cancelling Bluetooth headphones with 30h battery",
            "price": 199.99,
            "category": "electronics",
            "stock": 120,
            "image_url": None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Running Shoes",
            "description": "Lightweight running shoes with responsive cushioning",
            "price": 89.99,
            "category": "sports",
            "stock": 200,
            "image_url": None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Coffee Maker Deluxe",
            "description": "Programmable coffee maker with built-in grinder",
            "price": 149.99,
            "category": "home",
            "stock": 75,
            "image_url": None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    ]
    products.extend(sample_products)


# Health endpoints (dual routes: /health for Docker HEALTHCHECK, /products/health for API Gateway)
@app.get("/health")
@app.get("/products/health")
def health():
    return {
        "status": "healthy",
        "service": "products-api",
        "timestamp": now_iso(),
        "uptime": time.time() - START_TIME,
    }


@app.get("/products/health/live")
def health_live():
    return {"status": "alive"}


@app.get("/products/health/ready")
def health_ready():
    return {"status": "ready"}


# CRUD endpoints
@app.get("/products/")
def list_products(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price"),
):
    result = products

    if category:
        result = [p for p in result if p["category"] == category]

    if search:
        search_lower = search.lower()
        result = [
            p
            for p in result
            if search_lower in p["name"].lower()
            or search_lower in p["description"].lower()
        ]

    if min_price is not None:
        result = [p for p in result if p["price"] >= min_price]

    if max_price is not None:
        result = [p for p in result if p["price"] <= max_price]

    return {"products": result, "total": len(result)}


@app.get("/products/{product_id}")
def get_product(product_id: str):
    product = find_product_by_id(product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "code": "PRODUCT_NOT_FOUND"},
        )
    return {"product": product}


@app.post("/products/", status_code=201)
def create_product(product_data: ProductCreate):
    product = {
        "id": str(uuid.uuid4()),
        "name": product_data.name,
        "description": product_data.description,
        "price": product_data.price,
        "category": product_data.category,
        "stock": product_data.stock,
        "image_url": product_data.image_url,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    products.append(product)
    return {"message": "Product created successfully", "product": product}


@app.put("/products/{product_id}")
def update_product(product_id: str, product_data: ProductUpdate):
    product = find_product_by_id(product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "code": "PRODUCT_NOT_FOUND"},
        )

    update_fields = product_data.model_dump(exclude_unset=True)
    for key, value in update_fields.items():
        product[key] = value
    product["updated_at"] = now_iso()

    return {"message": "Product updated successfully", "product": product}


@app.delete("/products/{product_id}")
def delete_product(product_id: str):
    product = find_product_by_id(product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "code": "PRODUCT_NOT_FOUND"},
        )

    products.remove(product)
    return {"message": "Product deleted successfully"}
