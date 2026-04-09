# -*- coding: utf-8 -*-
"""
런타임 환경 보정 (yfinance / curl_cffi / requests SSL)

가상환경이 G:\\내 드라이브\\... 처럼 한글·공백 경로에 있으면,
certifi 의 cacert.pem 전체 경로를 libcurl 이 제대로 못 읽어
curl: (77) error setting certificate verify locations 가 난다.
→ ASCII-only 경로(%LOCALAPPDATA%\\StockViewer\\cacert.pem)로 복사 후
  SSL_CERT_FILE / REQUESTS_CA_BUNDLE / CURL_CA_BUNDLE 설정.
"""

from __future__ import annotations

import os
import shutil


def configure_ssl_cert_bundle_env() -> None:
    try:
        import certifi
    except ImportError:
        return

    src = certifi.where()
    if not src or not os.path.isfile(src):
        return

    local = os.environ.get("LOCALAPPDATA")
    if not local:
        return

    safe_root = os.path.join(local, "StockViewer")
    try:
        os.makedirs(safe_root, exist_ok=True)
    except OSError:
        return

    dst = os.path.join(safe_root, "cacert.pem")
    try:
        need_copy = True
        if os.path.isfile(dst):
            try:
                need_copy = (os.path.getmtime(src) > os.path.getmtime(dst)) or (
                    os.path.getsize(src) != os.path.getsize(dst)
                )
            except OSError:
                need_copy = True
        if need_copy:
            shutil.copy2(src, dst)
    except OSError:
        return

    os.environ["SSL_CERT_FILE"] = dst
    os.environ["REQUESTS_CA_BUNDLE"] = dst
    os.environ["CURL_CA_BUNDLE"] = dst


configure_ssl_cert_bundle_env()
