import os
import sys
import datetime

# 프로젝트 최상단 경로를 시스템 경로에 추가하여 'backend' 모듈을 인식하도록 함
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# OpenAI API Key는 코드에 하드코딩하지 않고
# 환경 변수(또는 .env, secrets.toml 등)로부터 주입되도록 함.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv가 없으면 환경 변수만 사용
    pass

from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# 백엔드 모듈 임포트
from backend.stock_viewer import get_stock_info, fetch_history, resolve_to_ticker
from backend.stock_news import get_stock_news, get_dividend_info
from backend.chart_analysis import analyze_chart
from backend.data_sources import get_etf_holdings
from backend.trading_overview import get_market_overview, get_top_traded_stocks, get_top_traded_etfs, get_top_gainers_losers
from backend.portfolio import add_purchase, delete_purchase, get_holdings, get_holdings_with_profit_loss
from backend.auth import login as auth_login, register as auth_register
from backend.watchlist import get_watchlist, add_to_watchlist, remove_from_watchlist
from backend.alerts import get_alerts, add_alert, delete_alert
from backend.stock_ai import get_stock_ai_response
from backend.stock_detail import get_stock_detail

app = FastAPI(title="Stock Viewer API", version="1.0.0")

# CORS 활성화 (프론트엔드 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 상용 환경에서는 특정 도메인으로 제한 필요
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- 모델 정의 ----
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class PurchaseRequest(BaseModel):
    user_id: str
    ticker: str
    quantity: float
    purchase_price: float
    memo: str = ""

class WatchlistRequest(BaseModel):
    user_id: str
    ticker: str

class AlertRequest(BaseModel):
    user_id: str
    ticker: str
    target_price: float
    direction: str

class ChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = []

# ---- 인증 API ----
@app.post("/api/auth/login")
def login(req: LoginRequest):
    ok, err = auth_login(req.username, req.password)
    if ok:
        return {"status": "success", "user_id": req.username.strip().lower()}
    raise HTTPException(status_code=401, detail=err)

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    ok, err = auth_register(req.username, req.password)
    if ok:
        return {"status": "success"}
    raise HTTPException(status_code=400, detail=err)

# ---- 주식 기본 정보 및 시장 API ----
@app.get("/api/stock/resolve")
def resolve_ticker(query: str):
    ticker = resolve_to_ticker(query) or query.upper()
    return {"ticker": ticker}

@app.get("/api/stock/info")
def stock_info(ticker: str):
    info = get_stock_info(ticker)
    if not info:
        raise HTTPException(status_code=404, detail="Info not found")
    return {"status": "success", "data": info}

@app.get("/api/stock/history")
def stock_history(ticker: str, period: str = "3mo"):
    df = fetch_history(ticker, period)
    if df is None or df.empty:
        return {"status": "success", "data": []}
    
    # DataFrame을 dict 리스트로 변환 (Date 인덱스를 컬럼으로 포함)
    data = []
    for idx, row in df.iterrows():
        item = {"date": idx.strftime("%Y-%m-%d")}
        for col in df.columns:
            import math
            val = row[col]
            item[col] = None if math.isnan(val) else val
        data.append(item)
    return {"status": "success", "data": data}

@app.get("/api/stock/analysis")
def stock_analysis(ticker: str, period: str = "3mo"):
    df = fetch_history(ticker, period)
    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="No history data for analysis")
    analysis = analyze_chart(df)
    return {"status": "success", "data": analysis}

@app.get("/api/stock/news")
def stock_news(ticker: str, limit: int = 5):
    news = get_stock_news(ticker, limit)
    return {"status": "success", "data": news}

@app.get("/api/stock/dividend")
def stock_dividend(ticker: str):
    div = get_dividend_info(ticker)
    # pandas Series 등이 포함되어 있을 수 있으므로 직렬화
    if div and "dividends_series" in div and div["dividends_series"] is not None:
        div["dividends_series"] = {str(k)[:10]: float(v) for k, v in div["dividends_series"].items()}
    return {"status": "success", "data": div or {}}

@app.get("/api/stock/detail")
def stock_detail(ticker: str):
    """재무 상태, 시장 동향, 산업 전망 통합 조회"""
    detail = get_stock_detail(ticker)
    return {"status": "success", "data": detail}

@app.get("/api/etf/holdings")
def etf_holdings(ticker: str):
    holdings = get_etf_holdings(ticker)
    return {"status": "success", "data": holdings or []}

@app.get("/api/market/overview")
def market_overview():
    try:
        overview = get_market_overview()
        return {"status": "success", "data": overview}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/top_traded")
def top_traded(market: str = "KOSPI", limit: int = 10, is_etf: bool = False):
    try:
        if is_etf:
            data = get_top_traded_etfs(limit)
            return {"status": "success", "data": data, "기준일": None}
        data, 기준일 = get_top_traded_stocks(limit, market)
        return {"status": "success", "data": data, "기준일": 기준일}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/gainers_losers")
def gainers_losers(market: str = "KOSPI", limit: int = 5):
    try:
        data = get_top_gainers_losers(limit, market)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---- 포트폴리오 API ----
@app.get("/api/portfolio")
def portfolio(user_id: str):
    # 의존성 함수들 제공 필요
    def _달러당_원화_환율() -> float | None:
        info = get_stock_info("KRW=X")
        if info and info.get("current_price") is not None:
            return float(info["current_price"])
        df = fetch_history("KRW=X", "5d")
        if df is not None and not df.empty and "Close" in df.columns:
            return float(df["Close"].iloc[-1])
        return None

    def _현재가_및_통화_조회(ticker: str):
        조회용_티커 = resolve_to_ticker(ticker) or ticker
        조회용_티커 = str(조회용_티커).strip().upper()
        info = get_stock_info(조회용_티커)
        이름 = ticker
        if info:
            if info.get("name"):
                이름 = info["name"]
            if info.get("current_price") is not None:
                통화 = info.get("currency_label", "달러(USD)")
                if not (조회용_티커.endswith((".KS", ".KQ")) or (len(조회용_티커) == 6 and 조회용_티커.isdigit())):
                    통화 = "달러(USD)"
                return (info["current_price"], 통화, 이름)
        df = fetch_history(조회용_티커, "5d")
        if df is not None and not df.empty and "Close" in df.columns:
            가격 = float(df["Close"].iloc[-1])
            통화 = "원(KRW)" if 조회용_티커.endswith((".KS", ".KQ")) else "달러(USD)"
            return (가격, 통화, 이름)
        return (None, "—", 이름)
        
    data = get_holdings_with_profit_loss(user_id, _현재가_및_통화_조회, _달러당_원화_환율)
    return {"status": "success", "data": data or []}

@app.post("/api/portfolio")
def add_portfolio(req: PurchaseRequest):
    try:
        purchase_date = datetime.datetime.now().strftime("%Y-%m-%d") # simplfy
        add_purchase(req.user_id, req.ticker, req.quantity, req.purchase_price, purchase_date, req.memo)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/portfolio/{user_id}/{purchase_id}")
def delete_portfolio(user_id: str, purchase_id: str):
    try:
        delete_purchase(user_id, purchase_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---- 워치리스트 및 알림 API ----
@app.get("/api/watchlist")
def watchlist(user_id: str):
    wl = get_watchlist(user_id)
    return {"status": "success", "data": wl or []}

@app.post("/api/watchlist")
def add_watchlist(req: WatchlistRequest):
    ok = add_to_watchlist(req.user_id, req.ticker)
    return {"status": "success", "added": ok}

@app.delete("/api/watchlist/{user_id}/{ticker}")
def delete_watchlist(user_id: str, ticker: str):
    remove_from_watchlist(user_id, ticker)
    return {"status": "success"}

@app.get("/api/alerts")
def alerts(user_id: str):
    al = get_alerts(user_id)
    return {"status": "success", "data": al or []}

@app.post("/api/alerts")
def post_alert(req: AlertRequest):
    add_alert(req.user_id, req.ticker, req.target_price, req.direction)
    return {"status": "success"}

@app.delete("/api/alerts/{user_id}/{alert_id}")
def delete_user_alert(user_id: str, alert_id: str):
    delete_alert(user_id, alert_id)
    return {"status": "success"}

# ---- AI 챗봇 API ----
@app.post("/api/ai/chat")
def ai_chat(req: ChatRequest):
    try:
        reply = get_stock_ai_response(req.message, req.history)
        return {"status": "success", "reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
