from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
import psutil
from typing import List, Dict, Any

# Configuration de l'application
app = FastAPI(
    title="FastAPI Distroless Demo",
    description="API optimisée avec image distroless pour Docker Master 2",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Middleware de sécurité
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifier les domaines autorisés
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # En production, spécifier les hôtes autorisés
)

# Modèles de données
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    uptime: float
    memory: Dict[str, Any]
    version: str

class Product(BaseModel):
    id: int
    name: str
    price: float
    category: str

class User(BaseModel):
    id: int
    name: str
    email: str
    role: str

# Routes de l'API
@app.get("/health", response_model=HealthResponse)
def health_check():
    """Endpoint de santé de l'application"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime": psutil.boot_time(),
        "memory": {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent
        },
        "version": "1.0.0"
    }

@app.get("/api/products", response_model=List[Product])
def get_products():
    """Récupérer la liste des produits"""
    products = [
        {"id": 1, "name": "Laptop", "price": 999.99, "category": "Electronics"},
        {"id": 2, "name": "Mouse", "price": 29.99, "category": "Accessories"},
        {"id": 3, "name": "Keyboard", "price": 79.99, "category": "Accessories"},
        {"id": 4, "name": "Monitor", "price": 299.99, "category": "Electronics"},
        {"id": 5, "name": "Webcam", "price": 89.99, "category": "Accessories"}
    ]
    return products

@app.get("/api/users", response_model=List[User])
def get_users():
    """Récupérer la liste des utilisateurs"""
    users = [
        {"id": 1, "name": "Alice", "email": "alice@example.com", "role": "admin"},
        {"id": 2, "name": "Bob", "email": "bob@example.com", "role": "user"},
        {"id": 3, "name": "Charlie", "email": "charlie@example.com", "role": "user"},
        {"id": 4, "name": "Diana", "email": "diana@example.com", "role": "moderator"}
    ]
    return users

@app.get("/api/products/{product_id}")
def get_product(product_id: int):
    """Récupérer un produit par son ID"""
    products = [
        {"id": 1, "name": "Laptop", "price": 999.99, "category": "Electronics"},
        {"id": 2, "name": "Mouse", "price": 29.99, "category": "Accessories"},
        {"id": 3, "name": "Keyboard", "price": 79.99, "category": "Accessories"}
    ]
    
    for product in products:
        if product["id"] == product_id:
            return product
    
    raise HTTPException(status_code=404, detail="Product not found")

@app.get("/metrics")
def get_metrics():
    """Métriques système de l'application"""
    return {
        "timestamp": datetime.now().isoformat(),
        "uptime": psutil.boot_time(),
        "memory": {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent,
            "used": psutil.virtual_memory().used
        },
        "cpu": {
            "percent": psutil.cpu_percent(interval=1),
            "count": psutil.cpu_count()
        },
        "disk": {
            "total": psutil.disk_usage('/').total,
            "used": psutil.disk_usage('/').used,
            "free": psutil.disk_usage('/').free,
            "percent": psutil.disk_usage('/').percent
        },
        "platform": {
            "system": os.uname().sysname,
            "release": os.uname().release,
            "machine": os.uname().machine
        }
    }

@app.get("/")
def root():
    """Page d'accueil de l'API"""
    return {
        "message": "FastAPI Distroless Demo - Master 2 Full Stack",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "products": "/api/products",
        "users": "/api/users",
        "metrics": "/metrics"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info"
    )
