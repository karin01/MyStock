# -*- coding: utf-8 -*-
"""
간단한 로그인/회원가입 모듈
- 사용자 정보는 로컬 JSON 파일에 저장
- 비밀번호는 PBKDF2-SHA256으로 해싱 (추가 패키지 불필요)
"""

import hashlib
import json
import secrets
from pathlib import Path

# 사용자 정보 저장 파일
_USERS_FILE = Path(__file__).parent / "users.json"


def _hash_password(password: str) -> str:
    """비밀번호를 salt + PBKDF2-SHA256으로 해싱"""
    salt = secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + ":" + hashed.hex()


def _verify_password(stored: str, provided: str) -> bool:
    """저장된 해시와 입력 비밀번호 비교"""
    try:
        salt_hex, stored_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        provided_hashed = hashlib.pbkdf2_hmac(
            "sha256", provided.encode("utf-8"), salt, 100_000
        )
        return provided_hashed.hex() == stored_hex
    except (ValueError, AttributeError):
        return False


def _load_users() -> dict:
    """users.json에서 사용자 목록 로드"""
    try:
        if _USERS_FILE.exists():
            with open(_USERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def _save_users(users: dict) -> None:
    """사용자 목록 저장"""
    with open(_USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def register(username: str, password: str) -> tuple[bool, str]:
    """
    회원가입. 성공 시 (True, ""), 실패 시 (False, 에러메시지)
    """
    username = str(username).strip().lower()
    if not username or len(username) < 2:
        return False, "아이디는 2자 이상이어야 합니다."
    if not password or len(password) < 4:
        return False, "비밀번호는 4자 이상이어야 합니다."

    users = _load_users()
    if username in users:
        return False, "이미 존재하는 아이디입니다."

    users[username] = _hash_password(password)
    _save_users(users)
    return True, ""


def login(username: str, password: str) -> tuple[bool, str]:
    """
    로그인 검증. 성공 시 (True, ""), 실패 시 (False, 에러메시지)
    """
    username = str(username).strip().lower()
    if not username or not password:
        return False, "아이디와 비밀번호를 입력해 주세요."

    users = _load_users()
    if username not in users:
        return False, "아이디 또는 비밀번호가 올바르지 않습니다."

    if not _verify_password(users[username], password):
        return False, "아이디 또는 비밀번호가 올바르지 않습니다."

    return True, ""
