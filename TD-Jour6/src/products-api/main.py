import os
import time
from datetime import datetime, timezone

from fastapi import FastAPI

# Configuration
PORT = int(os.environ.get("PORT", 8082))
START_TIME = time.time()

# FastAPI app
app = FastAPI(title="CloudShop Products API", version="1.0.0")


# Health endpoints (dual routes: /health for Docker HEALTHCHECK, /products/health for API Gateway)
@app.get("/health")
@app.get("/products/health")
def health():
    return {
        "status": "healthy",
        "service": "products-api",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "uptime": time.time() - START_TIME,
    }


@app.get("/products/health/live")
def health_live():
    return {"status": "alive"}


@app.get("/products/health/ready")
def health_ready():
    return {"status": "ready"}
