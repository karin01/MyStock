# -*- coding: utf-8 -*-
"""
API 재시도 유틸리티
- 일시적 네트워크 오류 시 자동 재시도
"""

import time
from functools import wraps


def retry_on_failure(max_retries: int = 2, delay: float = 0.5, exceptions: tuple = (Exception,)):
    """
    실패 시 재시도 데코레이터.
    max_retries: 최대 재시도 횟수 (총 시도 = 1 + max_retries)
    delay: 재시도 전 대기 시간(초)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_err = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_err = e
                    if attempt < max_retries:
                        time.sleep(delay)
            raise last_err
        return wrapper
    return decorator
