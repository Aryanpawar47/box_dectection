"""
Authentication endpoints: Login, Register, Profile, Demo credentials info.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db.mongo import list_users, save_user, get_user_by_username
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    require_roles,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "operator"  # admin, operator, viewer
    full_name: str = ""


@router.post("/login")
async def login(req: LoginRequest) -> Dict[str, Any]:
    user = await authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token({"sub": user["username"], "role": user.get("role", "viewer")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user.get("role", "viewer"),
            "full_name": user.get("full_name", user["username"]),
        },
    }


@router.post("/register")
async def register(req: RegisterRequest, current_user: Dict[str, Any] = Depends(require_roles("admin"))) -> Dict[str, Any]:
    existing = await get_user_by_username(req.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    if req.role not in ["admin", "operator", "viewer"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'operator', or 'viewer'")

    from datetime import datetime, timezone
    new_user = {
        "username": req.username,
        "hashed_password": get_password_hash(req.password),
        "role": req.role,
        "full_name": req.full_name or req.username,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["username"]
    }
    await save_user(new_user)
    return {"status": "created", "username": req.username, "role": req.role}


@router.get("/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return {
        "username": current_user["username"],
        "role": current_user.get("role", "viewer"),
        "full_name": current_user.get("full_name", current_user["username"]),
        "created_at": current_user.get("created_at")
    }


@router.get("/users")
async def get_all_users(current_user: Dict[str, Any] = Depends(require_roles("admin"))) -> List[Dict[str, Any]]:
    return await list_users()


@router.get("/demo-accounts")
async def get_demo_accounts() -> List[Dict[str, str]]:
    return [
        {"username": "admin", "password": "admin123", "role": "admin", "description": "Full access to settings, users & catalog"},
        {"username": "operator", "password": "operator123", "role": "operator", "description": "Start/stop conveyor, calibrate & trigger counts"},
        {"username": "viewer", "password": "viewer123", "role": "viewer", "description": "Read-only live feed & reports viewing"},
    ]
