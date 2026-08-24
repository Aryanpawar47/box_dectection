"""
Authentication and Role-Based Access Control Service.
Uses direct bcrypt hashing and JWT token creation/verification.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.db.mongo import get_user_by_username, save_user

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "smart-inventory-cv-secret-key-2026-xyz-998811")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8")[:72], salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def seed_default_users():
    """Seed initial system users if they do not exist or update credentials."""
    defaults = [
        {"username": "admin", "password": "admin123", "role": "admin", "full_name": "System Administrator"},
        {"username": "operator", "password": "operator123", "role": "operator", "full_name": "Line Operator"},
        {"username": "viewer", "password": "viewer123", "role": "viewer", "full_name": "Dashboard Viewer"},
    ]
    for u in defaults:
        existing = await get_user_by_username(u["username"])
        if not existing or not verify_password(u["password"], existing.get("hashed_password", "")):
            await save_user({
                "username": u["username"],
                "hashed_password": get_password_hash(u["password"]),
                "role": u["role"],
                "full_name": u["full_name"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            print(f"[Auth] Seeded/Refreshed user account: {u['username']} (role: {u['role']})")


async def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = await get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await get_user_by_username(username)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_roles(*allowed_roles: str):
    """Dependency factory ensuring current user has one of the allowed roles."""
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role", "viewer")
        if "admin" in allowed_roles and user_role == "admin":
            return current_user
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
