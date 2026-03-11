import sys, os
sys.path.append(os.path.abspath('.'))
from backend.stock_news import get_stock_news

try:
    news = get_stock_news("005930.KS")
    print("Items found:", len(news))
    for n in news:
        print(n['title'])
except Exception as e:
    import traceback
    traceback.print_exc()
