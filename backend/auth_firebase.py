# -*- coding: utf-8 -*-
"""
Firebase Firestore 기반 로그인/회원가입
- 사용자 정보는 Firestore 'users' 컬렉션에 저장
- 비밀번호는 PBKDF2-SHA256 해싱 후 저장
- Firebase 미설정 시 None 반환 → auth.py가 로컬 JSON 사용
"""

import hashlib
import secrets
import os
from typing import Callable

# Firebase 초기화 여부
_firebase_initialized = False


def _get_firestore_client():
    """Firestore 클라이언트 반환. 실패 시 None"""
    global _firebase_initialized
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        return None

    if not _firebase_initialized:
        cred = None
        # 1) 환경변수: 서비스 계정 JSON 파일 경로
        path = os.environ.get("FIREBASE_CREDENTIALS_PATH") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if path and os.path.isfile(path):
            cred = credentials.Certificate(path)

        # 2) Streamlit secrets에서 firebase_credentials_path 또는 firebase dict
        if cred is None:
            try:
                import streamlit as st
                sc = getattr(st, "secrets", None)
                if sc:
                    path = sc.get("firebase_credentials_path", "")
                    if path and os.path.isfile(str(path)):
                        cred = credentials.Certificate(path)
                    elif sc.get("firebase"):
                        fb = sc.get("firebase")
                        if isinstance(fb, dict):
                            cred = credentials.Certificate(dict(fb))
            except Exception:
                pass

        if cred is None:
            return None

        try:
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
        except Exception:
            return None

    try:
        return firestore.client()
    except Exception:
        return None


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


def is_available() -> bool:
    """Firebase 사용 가능 여부"""
    return _get_firestore_client() is not None


def register(username: str, password: str) -> tuple[bool, str]:
    """회원가입. 성공 (True,""), 실패 (False, 에러메시지)"""
    db = _get_firestore_client()
    if db is None:
        return False, "Firebase가 설정되지 않았습니다."

    username = str(username).strip().lower()
    if not username or len(username) < 2:
        return False, "아이디는 2자 이상이어야 합니다."
    if not password or len(password) < 4:
        return False, "비밀번호는 4자 이상이어야 합니다."

    try:
        doc_ref = db.collection("users").document(username)
        if doc_ref.get().exists:
            return False, "이미 존재하는 아이디입니다."
        doc_ref.set({"password_hash": _hash_password(password)})
        return True, ""
    except Exception as e:
        return False, f"등록 실패: {e}"


def login(username: str, password: str) -> tuple[bool, str]:
    """로그인 검증. 성공 (True,""), 실패 (False, 에러메시지)"""
    db = _get_firestore_client()
    if db is None:
        return False, "Firebase가 설정되지 않았습니다."

    username = str(username).strip().lower()
    if not username or not password:
        return False, "아이디와 비밀번호를 입력해 주세요."

    try:
        doc = db.collection("users").document(username).get()
        if not doc.exists:
            return False, "아이디 또는 비밀번호가 올바르지 않습니다."
        data = doc.to_dict() or {}
        stored_hash = data.get("password_hash", "")
        if not _verify_password(stored_hash, password):
            return False, "아이디 또는 비밀번호가 올바르지 않습니다."
        return True, ""
    except Exception as e:
        return False, f"로그인 실패: {e}"
