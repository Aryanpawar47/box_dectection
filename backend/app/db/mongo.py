"""
Database Layer — MongoDB asynchronous client with graceful local document fallback.
Supports MongoDB server/Atlas and local JSON persistence when MongoDB is unavailable.
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

# Load .env file so MONGODB_URI, etc. are available before reading them
try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).parent.parent.parent / ".env"
    if _env_file.exists():
        load_dotenv(dotenv_path=_env_file, override=True)
        print(f"[DB] Loaded .env from {_env_file}")
    else:
        load_dotenv(override=True)
except ImportError:
    pass  # python-dotenv not installed — fall back to system env vars

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "smart_inventory")

_mongo_client = None
_mongo_db = None
_mongo_connected = False
_local_db_path = Path(__file__).parent.parent.parent / "data" / "mongo_fallback.json"

_fallback_store: Dict[str, List[Dict[str, Any]]] = {
    "sessions": [],
    "boxes": [],
    "users": [],
    "products": [],
    "config": []
}


def _ensure_local_store():
    _local_db_path.parent.mkdir(parents=True, exist_ok=True)
    if _local_db_path.exists():
        try:
            loaded = json.loads(_local_db_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                for k in ["sessions", "boxes", "users", "products", "config"]:
                    if k in loaded and loaded[k]:
                        _fallback_store[k] = loaded[k]
        except Exception:
            pass


def _save_local_store():
    try:
        _local_db_path.parent.mkdir(parents=True, exist_ok=True)
        _local_db_path.write_text(json.dumps(_fallback_store, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        print(f"[DB] Failed to save local fallback DB: {e}")


async def init_db():
    global _mongo_client, _mongo_db, _mongo_connected
    _ensure_local_store()

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=8000)
        await client.admin.command("ping")
        _mongo_client = client
        _mongo_db = client[DB_NAME]
        _mongo_connected = True
        print(f"[DB] Connected to MongoDB at {MONGO_URI} (Database: {DB_NAME})")
    except Exception as e:
        _mongo_connected = False
        print(f"[DB] MongoDB offline or unreachable ({e}). Using embedded local document store.")

    await _seed_defaults()


async def _seed_defaults():
    products = await get_products()
    if not products:
        sample_products = [
            {"qr_code": "BOX-ELEC-001", "name": "Premium Smartphone", "category": "Electronics", "sku": "EL-883", "weight_kg": 0.45},
            {"qr_code": "BOX-AUTO-002", "name": "Brake Rotor Kit", "category": "Automotive", "sku": "AU-441", "weight_kg": 4.20},
            {"qr_code": "BOX-FOOD-003", "name": "Organic Coffee Beans (5kg)", "category": "Food & Beverage", "sku": "FB-109", "weight_kg": 5.10},
            {"qr_code": "BOX-PHAR-004", "name": "Medical Test Kits", "category": "Pharmaceuticals", "sku": "PH-772", "weight_kg": 1.15},
            {"qr_code": "BOX-GEN-005", "name": "Standard Industrial Box", "category": "General Goods", "sku": "GEN-001", "weight_kg": 2.00},
        ]
        for p in sample_products:
            await save_product(p)


def is_mongo_connected() -> bool:
    return _mongo_connected


async def save_session(session_data: Dict[str, Any]) -> str:
    session_id = session_data.get("session_id", str(uuid.uuid4()))
    session_data["session_id"] = session_id
    if "updated_at" not in session_data:
        session_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if _mongo_connected and _mongo_db is not None:
        try:
            await _mongo_db.sessions.update_one(
                {"session_id": session_id},
                {"$set": session_data},
                upsert=True
            )
            return session_id
        except Exception as e:
            print(f"[DB] MongoDB save_session error: {e}")

    existing_idx = next((i for i, s in enumerate(_fallback_store["sessions"]) if s.get("session_id") == session_id), -1)
    if existing_idx >= 0:
        _fallback_store["sessions"][existing_idx].update(session_data)
    else:
        _fallback_store["sessions"].insert(0, session_data)
    _save_local_store()
    return session_id


async def get_sessions(limit: int = 50) -> List[Dict[str, Any]]:
    if _mongo_connected and _mongo_db is not None:
        try:
            cursor = _mongo_db.sessions.find({}, {"_id": 0}).sort("started_at", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            print(f"[DB] MongoDB get_sessions error: {e}")

    _ensure_local_store()
    return _fallback_store["sessions"][:limit]


async def get_session_by_id(session_id: str) -> Optional[Dict[str, Any]]:
    if _mongo_connected and _mongo_db is not None:
        try:
            doc = await _mongo_db.sessions.find_one({"session_id": session_id}, {"_id": 0})
            if doc:
                return doc
        except Exception:
            pass

    _ensure_local_store()
    return next((s for s in _fallback_store["sessions"] if s.get("session_id") == session_id), None)


async def record_box_crossing(box_data: Dict[str, Any]) -> str:
    box_id = box_data.get("box_id", str(uuid.uuid4()))
    box_data["box_id"] = box_id
    if "timestamp" not in box_data:
        box_data["timestamp"] = datetime.now(timezone.utc).isoformat()

    if _mongo_connected and _mongo_db is not None:
        try:
            await _mongo_db.boxes.insert_one(box_data)
            return box_id
        except Exception as e:
            print(f"[DB] MongoDB record_box_crossing error: {e}")

    _ensure_local_store()
    _fallback_store["boxes"].insert(0, box_data)
    _fallback_store["boxes"] = _fallback_store["boxes"][:1000]
    _save_local_store()
    return box_id


async def get_box_records(session_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    query = {"session_id": session_id} if session_id else {}
    if _mongo_connected and _mongo_db is not None:
        try:
            cursor = _mongo_db.boxes.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            print(f"[DB] MongoDB get_box_records error: {e}")

    _ensure_local_store()
    records = _fallback_store["boxes"]
    if session_id:
        records = [b for b in records if b.get("session_id") == session_id]
    return records[:limit]


async def save_product(product: Dict[str, Any]) -> str:
    qr_code = product.get("qr_code")
    if not qr_code:
        qr_code = f"QR-{uuid.uuid4().hex[:8].upper()}"
        product["qr_code"] = qr_code
    product["updated_at"] = datetime.now(timezone.utc).isoformat()

    if _mongo_connected and _mongo_db is not None:
        try:
            await _mongo_db.products.update_one(
                {"qr_code": qr_code},
                {"$set": product},
                upsert=True
            )
            return qr_code
        except Exception as e:
            print(f"[DB] MongoDB save_product error: {e}")

    _ensure_local_store()
    idx = next((i for i, p in enumerate(_fallback_store["products"]) if p.get("qr_code") == qr_code), -1)
    if idx >= 0:
        _fallback_store["products"][idx].update(product)
    else:
        _fallback_store["products"].append(product)
    _save_local_store()
    return qr_code


async def get_products() -> List[Dict[str, Any]]:
    if _mongo_connected and _mongo_db is not None:
        try:
            cursor = _mongo_db.products.find({}, {"_id": 0})
            return await cursor.to_list(length=200)
        except Exception as e:
            print(f"[DB] MongoDB get_products error: {e}")

    _ensure_local_store()
    return _fallback_store["products"]


async def get_product_by_qr(qr_code: str) -> Optional[Dict[str, Any]]:
    if _mongo_connected and _mongo_db is not None:
        try:
            doc = await _mongo_db.products.find_one({"qr_code": qr_code}, {"_id": 0})
            if doc:
                return doc
        except Exception:
            pass

    return next((p for p in _fallback_store["products"] if p.get("qr_code") == qr_code), None)


async def delete_product(qr_code: str) -> bool:
    if _mongo_connected and _mongo_db is not None:
        try:
            res = await _mongo_db.products.delete_one({"qr_code": qr_code})
            return res.deleted_count > 0
        except Exception:
            pass

    initial_len = len(_fallback_store["products"])
    _fallback_store["products"] = [p for p in _fallback_store["products"] if p.get("qr_code") != qr_code]
    if len(_fallback_store["products"]) < initial_len:
        _save_local_store()
        return True
    return False


async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    if _mongo_connected and _mongo_db is not None:
        try:
            doc = await _mongo_db.users.find_one({"username": username}, {"_id": 0})
            if doc:
                return doc
        except Exception:
            pass

    _ensure_local_store()
    return next((u for u in _fallback_store["users"] if u.get("username") == username), None)


async def save_user(user_data: Dict[str, Any]) -> None:
    username = user_data["username"]
    user_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if _mongo_connected and _mongo_db is not None:
        try:
            await _mongo_db.users.update_one(
                {"username": username},
                {"$set": user_data},
                upsert=True
            )
            return
        except Exception as e:
            print(f"[DB] MongoDB save_user error: {e}")

    idx = next((i for i, u in enumerate(_fallback_store["users"]) if u.get("username") == username), -1)
    if idx >= 0:
        _fallback_store["users"][idx].update(user_data)
    else:
        _fallback_store["users"].append(user_data)
    _save_local_store()


async def list_users() -> List[Dict[str, Any]]:
    if _mongo_connected and _mongo_db is not None:
        try:
            cursor = _mongo_db.users.find({}, {"_id": 0, "hashed_password": 0})
            return await cursor.to_list(length=100)
        except Exception:
            pass

    return [{k: v for k, v in u.items() if k != "hashed_password"} for u in _fallback_store["users"]]
