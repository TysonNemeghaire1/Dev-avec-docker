import os
import time
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

# Configuration
PORT = int(os.environ.get("PORT", 8082))
DATABASE_URL = os.environ.get("DATABASE_URL", "")
START_TIME = time.time()


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            price DOUBLE PRECISION NOT NULL CHECK (price > 0),
            category VARCHAR(100) NOT NULL,
            stock INTEGER DEFAULT 0 CHECK (stock >= 0),
            image_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.close()
    conn.close()
    print("Database tables initialized")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def row_to_product(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "description": row["description"],
        "price": row["price"],
        "category": row["category"],
        "stock": row["stock"],
        "image_url": row["image_url"],
        "created_at": row["created_at"].isoformat().replace("+00:00", "Z"),
        "updated_at": row["updated_at"].isoformat().replace("+00:00", "Z"),
    }


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
def startup():
    init_db()
    seed_data()


def seed_data():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM products")
    count = cur.fetchone()[0]
    if count == 0:
        sample_products = [
            ("Laptop Pro 15", "High-performance laptop with 16GB RAM and 512GB SSD", 1299.99, "electronics", 50, None),
            ("Wireless Headphones", "Noise-cancelling Bluetooth headphones with 30h battery", 199.99, "electronics", 120, None),
            ("Running Shoes", "Lightweight running shoes with responsive cushioning", 89.99, "sports", 200, None),
            ("Coffee Maker Deluxe", "Programmable coffee maker with built-in grinder", 149.99, "home", 75, None),
        ]
        for p in sample_products:
            cur.execute(
                "INSERT INTO products (name, description, price, category, stock, image_url) VALUES (%s, %s, %s, %s, %s, %s)",
                p,
            )
        print("Seed data inserted")
    cur.close()
    conn.close()


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
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return {"status": "ready"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "not ready", "error": str(e)})


# CRUD endpoints
@app.get("/products/")
def list_products(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price"),
):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    clauses = []
    params = []

    if category:
        clauses.append("category = %s")
        params.append(category)

    if search:
        clauses.append("(LOWER(name) LIKE %s OR LOWER(description) LIKE %s)")
        params.append(f"%{search.lower()}%")
        params.append(f"%{search.lower()}%")

    if min_price is not None:
        clauses.append("price >= %s")
        params.append(min_price)

    if max_price is not None:
        clauses.append("price <= %s")
        params.append(max_price)

    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    cur.execute(f"SELECT * FROM products{where} ORDER BY created_at", params)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = [row_to_product(r) for r in rows]
    return {"products": result, "total": len(result)}


@app.get("/products/{product_id}")
def get_product(product_id: str):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "code": "PRODUCT_NOT_FOUND"},
        )
    return {"product": row_to_product(row)}


@app.post("/products/", status_code=201)
def create_product(product_data: ProductCreate):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """INSERT INTO products (name, description, price, category, stock, image_url)
           VALUES (%s, %s, %s, %s, %s, %s)
           RETURNING *""",
        (product_data.name, product_data.description, product_data.price,
         product_data.category, product_data.stock, product_data.image_url),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return {"message": "Product created successfully", "product": row_to_product(row)}


@app.put("/products/{product_id}")
def update_product(product_id: str, product_data: ProductUpdate):
    update_fields = product_data.model_dump(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail={"error": "No fields to update", "code": "VALIDATION_ERROR"})

    set_clauses = []
    params = []
    for key, value in update_fields.items():
        set_clauses.append(f"{key} = %s")
        params.append(value)

    set_clauses.append("updated_at = NOW()")
    params.append(product_id)

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"UPDATE products SET {', '.join(set_clauses)} WHERE id = %s RETURNING *",
        params,
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "code": "PRODUCT_NOT_FOUND"},
        )
    return {"message": "Product updated successfully", "product": row_to_product(row)}


@app.delete("/products/{product_id}")
def delete_product(product_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE id = %s RETURNING id", (product_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": "Product not found", "code": "PRODUCT_NOT_FOUND"},
        )
    return {"message": "Product deleted successfully"}
