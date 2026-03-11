import sys, os, traceback
sys.path.append(os.path.abspath('.'))
from backend.list_etfs import get_recommended_etfs

with open("error_log.txt", "w", encoding="utf-8") as f:
    try:
        print(get_recommended_etfs(limit=2))
    except Exception as e:
        traceback.print_exc(file=f)
