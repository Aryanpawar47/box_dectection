"""
Admin and Inventory Management Routes — Products, QR Code Mappings, Box Crossing Logs, System Info.
"""

import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.mongo import (
    get_products,
    save_product,
    delete_product,
    get_box_records,
    get_sessions,
    is_mongo_connected,
    list_users,
    MONGO_URI,
    DB_NAME
)
from app.services.auth_service import require_roles

router = APIRouter(prefix="/admin", tags=["Admin & Inventory"])


class ProductCreateRequest(BaseModel):
    qr_code: str
    name: str
    category: str = "General"
    sku: str = ""
    weight_kg: Optional[float] = None
    target_stock: Optional[int] = 100


@router.get("/products")
async def list_product_catalog() -> List[Dict[str, Any]]:
    return await get_products()


@router.post("/products")
async def create_or_update_product(
    req: ProductCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles("admin", "operator"))
) -> Dict[str, Any]:
    qr = await save_product(req.dict())
    return {"status": "saved", "qr_code": qr}


@router.delete("/products/{qr_code}")
async def remove_product(
    qr_code: str,
    current_user: Dict[str, Any] = Depends(require_roles("admin"))
) -> Dict[str, Any]:
    success = await delete_product(qr_code)
    if not success:
        raise HTTPException(status_code=404, detail="Product QR code not found")
    return {"status": "deleted", "qr_code": qr_code}


@router.get("/box-records")
async def list_box_crossing_records(limit: int = 100) -> List[Dict[str, Any]]:
    return await get_box_records(limit=limit)


@router.get("/system-info")
async def get_system_info() -> Dict[str, Any]:
    users = await list_users()
    products = await get_products()
    boxes = await get_box_records(limit=1000)
    sessions = await get_sessions(limit=100)
    
    # Obfuscate sensitive credentials in MongoDB URI if any
    safe_uri = MONGO_URI
    if "@" in safe_uri:
        parts = safe_uri.split("@")
        safe_uri = "mongodb://***:***@" + parts[1]

    return {
        "mongodb_connected": is_mongo_connected(),
        "mongodb_uri": safe_uri,
        "mongodb_database": DB_NAME,
        "collections": {
            "boxes": len(boxes),
            "sessions": len(sessions),
            "products": len(products),
            "users": len(users)
        },
        "total_registered_users": len(users),
        "total_qr_products": len(products),
        "total_box_crossings": len(boxes),
        "architecture_version": "5-Layer Smart Inventory 2.0"
    }


@router.get("/export-data")
async def export_all_database_records() -> Dict[str, Any]:
    """Export all database collections in JSON format."""
    boxes = await get_box_records(limit=5000)
    sessions = await get_sessions(limit=500)
    products = await get_products()
    users = await list_users()
    return {
        "database": DB_NAME,
        "exported_at": os.getenv("CURRENT_TIME", ""),
        "collections": {
            "boxes": boxes,
            "sessions": sessions,
            "products": products,
            "users": users
        }
    }
