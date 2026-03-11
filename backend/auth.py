# -*- coding: utf-8 -*-
"""
로그인/회원가입 모듈
- Firebase 설정 시: Firestore에 사용자 저장 (auth_firebase 사용)
- Firebase 미설정 시: 로컬 users.json 사용
- 비밀번호: PBKDF2-SHA256 해싱
"""

# Firebase 사용 가능하면 Firestore, 아니면 로컬 JSON
try:
    from backend.auth_firebase import is_available as _fb_available, login as _fb_login, register as _fb_register
except ImportError:
    _fb_available = lambda: False
    _fb_login = _fb_register = None


def _use_firebase() -> bool:
    """Firebase 사용 여부"""
    if _fb_login is None or _fb_register is None:
        return False
    try:
        return _fb_available()
    except Exception:
        return False


def login(username: str, password: str) -> tuple[bool, str]:
    """로그인 검증. 성공 (True,""), 실패 (False, 에러메시지)"""
    if _use_firebase():
        return _fb_login(username, password)
    return _login_local(username, password)


def register(username: str, password: str) -> tuple[bool, str]:
    """회원가입. 성공 (True,""), 실패 (False, 에러메시지)"""
    ok, err = validate_password_strength(password)
    if not ok:
        return False, err
    if _use_firebase():
        return _fb_register(username, password)
    return _register_local(username, password)


# --- 비밀번호 강도 검사 ---
def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    비밀번호 복잡도 검사. (True, "") 또는 (False, 에러메시지)
    - 8자 이상
    - 영문·숫자 포함
    """
    if len(password) < 8:
        return False, "비밀번호는 8자 이상이어야 합니다."
    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not has_letter or not has_digit:
        return False, "비밀번호에 영문과 숫자를 모두 포함해 주세요."
    return True, ""


# --- 로컬 JSON 폴백 ---
import hashlib
import json
import secrets
from pathlib import Path

_USERS_FILE = Path(__file__).parent.parent / "users.json"


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + ":" + hashed.hex()


def _verify_password(stored: str, provided: str) -> bool:
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
    try:
        if _USERS_FILE.exists():
            with open(_USERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def _save_users(users: dict) -> None:
    with open(_USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def _register_local(username: str, password: str) -> tuple[bool, str]:
    username = str(username).strip().lower()
    if not username or len(username) < 2:
        return False, "아이디는 2자 이상이어야 합니다."
    users = _load_users()
    if username in users:
        return False, "이미 존재하는 아이디입니다."
    users[username] = _hash_password(password)
    _save_users(users)
    return True, ""


def _login_local(username: str, password: str) -> tuple[bool, str]:
    username = str(username).strip().lower()
    if not username or not password:
        return False, "아이디와 비밀번호를 입력해 주세요."
    users = _load_users()
    if username not in users:
        return False, "아이디 또는 비밀번호가 올바르지 않습니다."
    if not _verify_password(users[username], password):
        return False, "아이디 또는 비밀번호가 올바르지 않습니다."
    return True, ""
