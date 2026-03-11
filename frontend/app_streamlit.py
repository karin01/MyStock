# -*- coding: utf-8 -*-
"""
주식 뷰어 - Streamlit 웹 UI
실행: streamlit run app_streamlit.py
"""

from datetime import datetime, timedelta

import pandas as pd
import streamlit as st
import sys
import os

# 백엔드 모듈들을 임포트할 수 있도록 현재 파일의 부모 디렉토리를 경로에 추가합니다.
# (Rule.md 폴더 구조 분리 원칙 적용)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.stock_viewer import get_stock_info, fetch_history, resolve_to_ticker
from backend.data_sources import get_etf_holdings
from backend.chart_analysis import analyze_chart
from backend.trading_overview import get_market_overview, get_top_traded_stocks, get_top_traded_etfs, get_top_gainers_losers
from backend.list_etfs import get_recommended_etfs, get_similar_etfs
from backend.stock_ai import get_stock_ai_response
from backend.portfolio import add_purchase, delete_purchase, get_holdings, get_holdings_with_profit_loss
from backend.auth import login as auth_login, register as auth_register
from backend.watchlist import get_watchlist, add_to_watchlist, remove_from_watchlist
from backend.alerts import get_alerts, add_alert, delete_alert
from backend.stock_news import get_stock_news, get_dividend_info
from backend.fee_tax import estimate_holdings_sell_summary
from backend.portfolio_analysis import get_diversity_score, get_rebalance_suggestions
from backend.stock_screeners import get_dividend_stocks, get_low_per_stocks
from backend.fee_tax import simulate_sell

st.set_page_config(page_title="주식 정보·차트 뷰어", layout="wide", initial_sidebar_state="expanded")

# 프리미엄 대시보드 스타일 (Glassmorphism & 매끄러운 애니메이션)
st.markdown("""
<style>
/* 프리미엄 웹폰트 (Pretendard & Orbitron) */
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&display=swap');

/* 전체 배경 (Subtle Mesh Gradient 느낌) - 화사하고 세련된 라이트 모드용 */
.stApp {
    background-color: #fafcff;
    background-image: 
        radial-gradient(at 40% 20%, rgba(14, 165, 233, 0.05) 0px, transparent 50%),
        radial-gradient(at 80% 0%, rgba(99, 102, 241, 0.05) 0px, transparent 50%),
        radial-gradient(at 0% 50%, rgba(14, 165, 233, 0.05) 0px, transparent 50%);
    background-attachment: fixed;
}

/* 전역 폰트 및 등장 애니메이션 */
@keyframes fadeSlideUp {
    0% { opacity: 0; transform: translateY(15px); }
    100% { opacity: 1; transform: translateY(0); }
}
html, body, [class*="css"] {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif !important;
}
.main .block-container { 
    padding-top: 2.5rem; 
    padding-bottom: 4rem; 
    max-width: 1400px;
    animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 제목 타이포그래피 강화 (그라데이션 텍스트) */
h1, h2 { 
    font-weight: 800 !important; 
    letter-spacing: -0.04em !important; 
    background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 1rem;
}
h3 {
    font-weight: 700 !important;
    color: #1e293b;
}

/* 디지털 시계 (사이버틱 & 네온 글로우 룩) */
div.digital-ticker {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #020617 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 24px 32px;
    margin: 1.5rem 0 2.5rem 0;
    box-shadow: 0 10px 30px -5px rgba(14, 165, 233, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
    display: flex;
    justify-content: space-around;
    align-items: center;
    flex-wrap: wrap;
    gap: 30px;
    position: relative;
    overflow: hidden;
}
div.digital-ticker::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(34, 211, 238, 0.05) 0%, transparent 60%);
    pointer-events: none;
}
div.digital-item { 
    text-align: center; 
    flex: 1;
    min-width: 150px;
    position: relative;
    z-index: 1;
}
div.digital-label { 
    font-size: 13px; 
    color: #94a3b8; 
    margin-bottom: 8px; 
    text-transform: uppercase; 
    letter-spacing: 0.1em; 
    font-weight: 600;
}
div.digital-value { 
    font-family: 'Orbitron', monospace; 
    font-size: 34px; 
    font-weight: 700; 
    color: #22d3ee; 
    text-shadow: 0 0 12px rgba(34, 211, 238, 0.5);
    letter-spacing: 0.02em;
}
div.digital-time { 
    font-size: 12px; 
    color: #64748b; 
    margin-top: 15px; 
    width: 100%;
    text-align: right;
    font-style: italic;
    z-index: 1;
}

/* 세련된 Expander(아코디언) 카드 디자인 */
[data-testid="stExpander"] {
    background: rgba(255, 255, 255, 0.6) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255, 255, 255, 0.8) !important;
    border-radius: 20px !important;
    margin-bottom: 1.2rem !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02), inset 0 0 0 1px rgba(255, 255, 255, 0.5) !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    overflow: hidden;
}
[data-testid="stExpander"]:hover {
    box-shadow: 0 12px 25px -5px rgba(0, 0, 0, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.8) !important;
    transform: translateY(-2px);
}
.streamlit-expanderHeader { 
    font-weight: 700 !important; 
    font-size: 1.1rem !important;
    padding: 1.2rem !important;
    color: #1e293b !important;
}

/* 사이드바 프리미엄 스타일링 */
[data-testid="stSidebar"] {
    background: rgba(248, 250, 252, 0.85) !important;
    backdrop-filter: blur(20px) !important;
    border-right: 1px solid rgba(226, 232, 240, 0.8) !important;
}

/* 메트릭(지표) 카드 입체감 부여 */
[data-testid="stMetric"] { 
    background: linear-gradient(145deg, #ffffff, #f8fafc) !important;
    padding: 20px 24px !important; 
    border-radius: 20px !important; 
    border: 1px solid rgba(226, 232, 240, 0.6) !important; 
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.02), inset 0 2px 0 rgba(255, 255, 255, 1) !important;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
[data-testid="stMetric"]:hover {
    transform: translateY(-4px) !important;
    box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.06), inset 0 2px 0 rgba(255, 255, 255, 1) !important;
}
[data-testid="stMetricValue"] {
    font-weight: 800 !important;
    color: #0f172a !important;
    font-size: 2rem !important;
    letter-spacing: -0.02em !important;
}

/* 터치 친화적이며 매끄러운 3D 버튼 */
.stButton > button {
    border-radius: 12px !important;
    font-weight: 700 !important;
    padding: 0.6rem 1.2rem !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    border: 1px solid rgba(203, 213, 225, 0.6) !important;
    background: linear-gradient(to bottom, #ffffff, #f8fafc) !important;
    color: #334155 !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02), inset 0 1px 0 #ffffff !important;
}
.stButton > button:hover { 
    transform: translateY(-2px) !important; 
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.06), inset 0 1px 0 #ffffff !important;
    border-color: #94a3b8 !important;
    color: #0f172a !important;
}
.stButton > button:active {
    transform: translateY(1px) !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02) !important;
}

/* 폼 입력창: 모던 애플 룩 */
.stTextInput > div > div > input, .stNumberInput > div > div > input, .stSelectbox > div > div > div {
    border-radius: 12px !important;
    border: 1px solid rgba(203, 213, 225, 0.8) !important;
    padding: 0.6rem 1rem !important;
    transition: all 0.3s ease !important;
    background: rgba(255, 255, 255, 0.9) !important;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.01) !important;
}
.stTextInput > div > div > input:focus, .stNumberInput > div > div > input:focus, .stSelectbox > div > div > div:focus {
    border-color: #0ea5e9 !important;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15), inset 0 2px 4px rgba(0,0,0,0.01) !important;
    background: #ffffff !important;
}

/* 탭(Tabs) 영역 프리미엄 세그먼트 컨트롤 스타일 */
[data-testid="stTabs"] {
    background: rgba(241, 245, 249, 0.6);
    padding: 6px;
    border-radius: 16px;
}
[data-testid="stTabs"] button[role="tab"] {
    font-size: 1rem !important;
    font-weight: 600 !important;
    color: #64748b !important;
    padding: 0.5rem 1rem !important;
    border: none !important;
    border-radius: 10px !important;
    transition: all 0.3s ease !important;
    background: transparent !important;
    margin-right: 4px;
}
[data-testid="stTabs"] button[role="tab"]:hover {
    color: #334155 !important;
    background: rgba(255, 255, 255, 0.5) !important;
}
[data-testid="stTabs"] button[role="tab"][aria-selected="true"] {
    color: #0ea5e9 !important;
    font-weight: 700 !important;
    background: #ffffff !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
}

/* 데이터프레임 둥근 모서리 감싸기 */
[data-testid="stDataFrame"] {
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.8);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
}

/* Hero section styles */
.hero {
    text-align: center;
    padding: 2rem 1rem 1.5rem 1rem;
    animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.hero-title {
    font-size: 2.8rem !important;
    font-weight: 800 !important;
    letter-spacing: -0.05em !important;
    background: linear-gradient(135deg, #0f172a 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
}
.hero-subtitle {
    font-size: 1.15rem;
    color: #64748b;
    font-weight: 500;
    margin-bottom: 1.5rem;
}

/* 커스텀 스크롤바 */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
::-webkit-scrollbar-track {
    background: transparent;
}
::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}
</style>
""", unsafe_allow_html=True)

# 세션 초기화
if "stock_ai_messages" not in st.session_state:
    st.session_state.stock_ai_messages = []
if "user_id" not in st.session_state:
    st.session_state.user_id = None
if "recent_tickers" not in st.session_state:
    st.session_state.recent_tickers = []  # 최근 조회 종목 (최대 10개)

@st.fragment(run_every=timedelta(seconds=60))
def 디지털_시계_위젯():
    """코스피·코스닥·환율을 60초마다 자동 갱신"""
    디지털_표시목록 = [("^KS11", "코스피"), ("^KQ11", "코스닥"), ("KRW=X", "1달러(원)")]
    디지털_값 = {}
    for 티커, 이름 in 디지털_표시목록:
        info = get_stock_info(티커)
        if info and info.get("current_price") is not None:
            v = info["current_price"]
            디지털_값[이름] = f"{v:,.2f}"
        else:
            df = fetch_history(티커, "5d")
            if df is not None and not df.empty and "Close" in df.columns:
                v = float(df["Close"].iloc[-1])
                디지털_값[이름] = f"{v:,.2f}"
            else:
                디지털_값[이름] = "—"

    디지털_html = '<div class="digital-ticker">'
    for 이름, 값 in 디지털_값.items():
        디지털_html += f'<div class="digital-item"><div class="digital-label">{이름}</div><div class="digital-value">{값}</div></div>'
    디지털_html += f'<div class="digital-time">조회: {datetime.now().strftime("%Y-%m-%d %H:%M")} · 60초마다 자동 갱신</div>'
    디지털_html += "</div>"
    st.markdown(디지털_html, unsafe_allow_html=True)


디지털_시계_위젯()

# 헤더 (Hero Section)
st.markdown("""
<div class="hero">
    <div class="hero-title">주식 정보·차트 뷰어</div>
    <div class="hero-subtitle">시장 지표부터 개별 종목 분석까지, 한눈에 확인하세요</div>
</div>
""", unsafe_allow_html=True)

with st.expander("💡 빠른 사용법", expanded=False):
    st.markdown("""
- **주식 조회**: 삼성전자, AAPL, 005930.KS 등 입력 후 조회
- **거래대금 상위**: ? 또는 /? 입력 시 인기 종목 목록 표시
- **로그인**: 보유 종목·관심종목·목표가 알림 (본인 데이터만)
- **비밀번호**: 8자 이상, 영문+숫자 포함
    """)

# --- 사이드바: 주식 AI 채팅 ---
with st.sidebar:
    st.markdown("### 🤖 주식 AI")
    st.caption("종목명을 언급하면 실시간 데이터를 반영해 답변합니다.")
    st.caption("예: 삼성전자 주가 어때? / 하이닉스 매수 적합해?")

    # 채팅 기록 표시
    for msg in st.session_state.stock_ai_messages:
        with st.chat_message(msg["role"], avatar="🧑" if msg["role"] == "user" else "🤖"):
            st.markdown(msg["content"])

    # 채팅 입력
    if prompt := st.chat_input("종목·투자 질문 입력"):
        st.session_state.stock_ai_messages.append({"role": "user", "content": prompt})
        with st.chat_message("user", avatar="🧑"):
            st.markdown(prompt)

        with st.chat_message("assistant", avatar="🤖"):
            with st.spinner("답변 생성 중..."):
                try:
                    api_key = st.secrets.get("OPENAI_API_KEY", None)
                except Exception:
                    api_key = None
                response = get_stock_ai_response(
                    prompt,
                    st.session_state.stock_ai_messages[:-1],
                    api_key=api_key,
                )
                st.markdown(response)
        st.session_state.stock_ai_messages.append({"role": "assistant", "content": response})
        st.rerun()

    if st.button("대화 초기화", use_container_width=True):
        st.session_state.stock_ai_messages = []
        st.rerun()

# 국내·해외 주요 지수 차트 (항상 최신 반영)
조회시점 = datetime.now().strftime("%Y-%m-%d %H:%M")
국내_지수 = [
    ("^KS11", "코스피"),
    ("^KQ11", "코스닥"),
    ("^KS200", "코스피200"),
]
해외_지수 = [("SPY", "S&P500"), ("QQQ", "나스닥100"), ("VOO", "Vanguard S&P500")]
with st.expander("📊 국내·해외 주요 지수 차트 (클릭하여 펼치기)", expanded=True):
    st.caption(f"조회 시점: {조회시점} | 매 조회 시 최신 데이터 반영")
    with st.spinner("지수 차트 로딩 중..."):
        전체_차트데이터 = {}
        for 티커, 이름 in 국내_지수 + 해외_지수:
            df = fetch_history(티커, "3mo")
            if df is not None and not df.empty:
                s = df["Close"].copy()
                # 시작일 기준 100으로 정규화 → 수익률 비교 가능 (스케일 차이 해소)
                if len(s) > 0 and s.iloc[0] and s.iloc[0] != 0:
                    s = (s / s.iloc[0]) * 100
                전체_차트데이터[이름] = s
    if 전체_차트데이터:
        차트_df = pd.DataFrame(전체_차트데이터)
        # 비거래일 등 결측치: 전일 종가로 채움 (연속 선 유지)
        차트_df = 차트_df.ffill().bfill()
        st.caption("※ 시작일 기준 100으로 정규화 (수익률 비교용)")
        st.line_chart(차트_df)
    else:
        st.caption("지수 차트 데이터를 불러오지 못했습니다. 네트워크를 확인해 주세요.")

# 종목 비교 차트 (2~3개 종목을 시작일 100 기준으로 정규화하여 수익률 비교)
with st.expander("🔄 종목 비교 차트 (2~3개 종목 수익률 비교)", expanded=False):
    st.caption("비교할 종목을 입력하면, 시작일 기준 100으로 정규화한 차트로 수익률을 비교할 수 있습니다. (예: 삼성전자 vs 하이닉스 vs 애플)")
    with st.form("종목비교폼"):
        col_a, col_b, col_c = st.columns(3)
        with col_a:
            비교_종목1 = st.text_input("종목 1", placeholder="예: 삼성전자, 005930.KS, AAPL", key="compare_1")
        with col_b:
            비교_종목2 = st.text_input("종목 2", placeholder="예: 하이닉스, 000660.KS", key="compare_2")
        with col_c:
            비교_종목3 = st.text_input("종목 3 (선택)", placeholder="예: AAPL", key="compare_3")
        비교_기간 = st.selectbox("차트 기간", options=["1mo", "3mo", "6mo", "1y", "2y"], index=2, key="compare_period")
        비교_제출 = st.form_submit_button("비교하기")
    if 비교_제출:
        입력목록 = [x.strip() for x in [비교_종목1, 비교_종목2, 비교_종목3] if x and x.strip()]
        if len(입력목록) < 2:
            st.warning("비교할 종목을 최소 2개 입력해 주세요.")
        else:
            with st.spinner("종목 비교 데이터 로딩 중..."):
                전체_비교데이터 = {}
                for 입력값 in 입력목록:
                    티커 = resolve_to_ticker(입력값) or 입력값.upper()
                    df = fetch_history(티커, 비교_기간)
                    if df is not None and not df.empty and "Close" in df.columns:
                        s = df["Close"].copy()
                        if len(s) > 0 and s.iloc[0] and s.iloc[0] != 0:
                            s = (s / s.iloc[0]) * 100
                            # 차트 범례: 종목명(티커) 형태로 표시
                            info = get_stock_info(티커)
                            이름 = (info.get("name") or 티커) if info else 티커
                            전체_비교데이터[f"{이름} ({티커})"] = s
                if 전체_비교데이터:
                    차트_df = pd.DataFrame(전체_비교데이터)
                    차트_df = 차트_df.ffill().bfill()
                    st.caption("※ 시작일 기준 100으로 정규화 (수익률 비교용)")
                    st.line_chart(차트_df)
                else:
                    st.warning("입력한 종목 중 데이터를 불러올 수 있는 종목이 없습니다. 티커를 확인해 주세요.")

# 차별화: 배당주·저PER 스크리너
@st.cache_data(ttl=60 * 60)
def _스크리너_데이터():
    return {"배당": get_dividend_stocks(8), "저PER": get_low_per_stocks(8, max_per=15)}

with st.expander("📋 종목 스크리너 (배당주·저PER)", expanded=False):
    st.caption("대형주 중심 배당률·PER 스크리닝. 참고용입니다.")
    with st.spinner("스크리너 로딩 중..."):
        스크 = _스크리너_데이터()
    tab_div, tab_per = st.tabs(["💰 배당률 상위", "📉 저PER (15 이하)"])
    with tab_div:
        if 스크["배당"]:
            df_d = pd.DataFrame(스크["배당"])
            st.dataframe(df_d[["name", "ticker", "dividend_yield", "price"]].rename(
                columns={"name": "종목", "ticker": "티커", "dividend_yield": "배당률(%)", "price": "현재가"}
            ), use_container_width=True, hide_index=True)
        else:
            st.caption("배당 데이터가 없습니다.")
    with tab_per:
        if 스크["저PER"]:
            df_p = pd.DataFrame(스크["저PER"])
            st.dataframe(df_p[["name", "ticker", "pe_ratio", "sector"]].rename(
                columns={"name": "종목", "ticker": "티커", "pe_ratio": "PER", "sector": "섹터"}
            ), use_container_width=True, hide_index=True)
        else:
            st.caption("저PER 데이터가 없습니다.")

# 거래 현황 (코스피/코스닥 시장 요약, 거래대금·등락률 상위) — 5시간마다만 리로딩
@st.cache_data(ttl=5 * 60 * 60)  # 5시간 = 18000초
def _거래_현황_데이터():
    """국내 시장 거래 현황. 5시간 캐시로 KRX API 호출 최소화"""
    try:
        시장요약 = get_market_overview()
        거래대금상위_코스피, _ = get_top_traded_stocks(limit=10, market="KOSPI")
        거래대금상위_코스닥, _ = get_top_traded_stocks(limit=10, market="KOSDAQ")
        거래대금상위_ETF = get_top_traded_etfs(limit=10)
        등락률_코스피 = get_top_gainers_losers(limit=5, market="KOSPI")
        등락률_코스닥 = get_top_gainers_losers(limit=5, market="KOSDAQ")
        return 시장요약, 거래대금상위_코스피, 거래대금상위_코스닥, 거래대금상위_ETF, 등락률_코스피, 등락률_코스닥
    except Exception:
        return None, [], [], [], {"상승": [], "하락": []}, {"상승": [], "하락": []}


with st.expander("📈 거래 현황 (국내 시장)", expanded=True):
    with st.spinner("거래 현황 로딩 중..."):
        시장요약, 거래대금상위_코스피, 거래대금상위_코스닥, 거래대금상위_ETF, 등락률_코스피, 등락률_코스닥 = _거래_현황_데이터()

    if 시장요약 and 시장요약.get("조회일"):
        st.caption(f"조회일: {시장요약['조회일']} (pykrx 기준)")
        col1, col2 = st.columns(2)
        with col1:
            if 시장요약.get("코스피"):
                k = 시장요약["코스피"]
                st.subheader("코스피")
                st.metric("거래대금", f"{k.get('거래대금', 0) / 1e12:.2f}조원")
                st.caption(f"상승 {k.get('상승', 0)} / 하락 {k.get('하락', 0)} / 보합 {k.get('보합', 0)}")
        with col2:
            if 시장요약.get("코스닥"):
                k = 시장요약["코스닥"]
                st.subheader("코스닥")
                st.metric("거래대금", f"{k.get('거래대금', 0) / 1e12:.2f}조원")
                st.caption(f"상승 {k.get('상승', 0)} / 하락 {k.get('하락', 0)} / 보합 {k.get('보합', 0)}")

        st.subheader("거래대금 상위")
        tab1, tab2, tab3 = st.tabs(["코스피", "코스닥", "ETF"])
        with tab1:
            if 거래대금상위_코스피:
                df_k = pd.DataFrame(거래대금상위_코스피)
                df_k["거래대금(억)"] = (df_k["거래대금"] / 1e8).round(1)
                st.dataframe(
                    df_k[["종목명", "티커", "종가", "거래대금(억)", "등락률"]],
                    use_container_width=True,
                    hide_index=True,
                )
            else:
                st.caption("데이터 없음")
        with tab2:
            if 거래대금상위_코스닥:
                df_q = pd.DataFrame(거래대금상위_코스닥)
                df_q["거래대금(억)"] = (df_q["거래대금"] / 1e8).round(1)
                st.dataframe(
                    df_q[["종목명", "티커", "종가", "거래대금(억)", "등락률"]],
                    use_container_width=True,
                    hide_index=True,
                )
            else:
                st.caption("데이터 없음")
        with tab3:
            if 거래대금상위_ETF:
                df_e = pd.DataFrame(거래대금상위_ETF)
                df_e["거래대금(억)"] = (df_e["거래대금"] / 1e8).round(1)
                st.dataframe(
                    df_e[["종목명", "티커", "종가", "거래대금(억)", "등락률"]],
                    use_container_width=True,
                    hide_index=True,
                )
            else:
                st.caption("데이터 없음")

        st.subheader("등락률 상위/하위")
        tab3, tab4 = st.tabs(["코스피", "코스닥"])
        with tab3:
            c1, c2 = st.columns(2)
            with c1:
                st.caption("상승률 상위")
                if 등락률_코스피.get("상승"):
                    for r in 등락률_코스피["상승"]:
                        st.write(f"🟢 {r['종목명']} ({r['티커']}) +{r['등락률']:.2f}%")
                else:
                    st.caption("데이터 없음")
            with c2:
                st.caption("하락률 상위")
                if 등락률_코스피.get("하락"):
                    for r in 등락률_코스피["하락"]:
                        st.write(f"🔴 {r['종목명']} ({r['티커']}) {r['등락률']:.2f}%")
                else:
                    st.caption("데이터 없음")
        with tab4:
            c1, c2 = st.columns(2)
            with c1:
                st.caption("상승률 상위")
                if 등락률_코스닥.get("상승"):
                    for r in 등락률_코스닥["상승"]:
                        st.write(f"🟢 {r['종목명']} ({r['티커']}) +{r['등락률']:.2f}%")
                else:
                    st.caption("데이터 없음")
            with c2:
                st.caption("하락률 상위")
                if 등락률_코스닥.get("하락"):
                    for r in 등락률_코스닥["하락"]:
                        st.write(f"🔴 {r['종목명']} ({r['티커']}) {r['등락률']:.2f}%")
                else:
                    st.caption("데이터 없음")
    else:
        # pykrx 실패 시 yfinance로 코스피·코스닥 지수만 표시 (대체 안내)
        st.warning(
            "KRX 거래 현황(거래대금·등락률)을 불러오지 못했습니다. "
            "pykrx와 KRX 사이트 호환 이슈가 있을 수 있습니다."
        )
        st.caption("아래는 Yahoo Finance 기준 코스피·코스닥 지수입니다.")
        col1, col2 = st.columns(2)
        for col, 티커, 이름 in [(col1, "^KS11", "코스피"), (col2, "^KQ11", "코스닥")]:
            with col:
                info = get_stock_info(티커)
                if info and info.get("current_price") is not None:
                    st.subheader(이름)
                    st.metric("지수", f"{info['current_price']:,.2f}")
                else:
                    df = fetch_history(티커, "5d")
                    if df is not None and not df.empty and "Close" in df.columns:
                        v = float(df["Close"].iloc[-1])
                        st.subheader(이름)
                        st.metric("지수", f"{v:,.2f}")

# 내 보유 종목 (구매 등록, 손익 추적)
def _달러당_원화_환율() -> float | None:
    """1달러당 원화 환율 (KRW=X). 미국 주식 손익 계산용."""
    info = get_stock_info("KRW=X")
    if info and info.get("current_price") is not None:
        return float(info["current_price"])
    df = fetch_history("KRW=X", "5d")
    if df is not None and not df.empty and "Close" in df.columns:
        return float(df["Close"].iloc[-1])
    return None


def _현재가_및_통화_조회(ticker: str):
    """티커의 (현재가, 통화표시) 반환. 실패 시 (None, '—'). 미국 티커는 항상 달러(USD)로 표시."""
    # 종목명(한글)으로 저장된 경우 티커로 변환 (예: KG모빌리티 → 003620.KS)
    조회용_티커 = resolve_to_ticker(ticker) or ticker
    조회용_티커 = str(조회용_티커).strip().upper()
    info = get_stock_info(조회용_티커)
    if info and info.get("current_price") is not None:
        통화 = info.get("currency_label", "달러(USD)")
        # 미국 주식은 티커 기준으로 통화 강제 (API가 KRW를 준 경우 대비)
        if not (조회용_티커.endswith((".KS", ".KQ")) or (len(조회용_티커) == 6 and 조회용_티커.isdigit())):
            통화 = "달러(USD)"
        return (info["current_price"], 통화)
    df = fetch_history(조회용_티커, "5d")
    if df is not None and not df.empty and "Close" in df.columns:
        가격 = float(df["Close"].iloc[-1])
        통화 = "원(KRW)" if 조회용_티커.endswith((".KS", ".KQ")) else "달러(USD)"
        return (가격, 통화)
    return (None, "—")


def _종목명_조회(ticker: str) -> str:
    """티커의 종목명 반환. 없으면 티커 그대로."""
    # 한국 6자리만 있으면 .KS 보완
    t = str(ticker).strip()
    if len(t) == 6 and t.isdigit():
        t = f"{t}.KS"
    info = get_stock_info(t)
    if info and info.get("name"):
        return str(info["name"]).strip()
    return ticker


def _금액_포맷(val: float, currency_label: str) -> str:
    """통화에 맞게 금액 포맷. 원화: 정수+원(KRW), 달러: $+소수2자리(USD)"""
    if val is None:
        return "—"
    if "원" in (currency_label or "") or "KRW" in (currency_label or "").upper():
        return f"{val:,.0f}원 (KRW)"
    return f"${val:,.2f} (USD)"

# ※ @st.fragment: 로그인/로그아웃 시 이 섹션만 리로드. 국내 거래 현황·지수 차트 등은 리로드 안 함
@st.fragment
def _내_보유_종목_섹션():
    with st.expander("💰 내 보유 종목 (구매 등록·손익)", expanded=True):
        st.caption("구매한 종목을 등록하면 현재가 기준 손익을 확인할 수 있습니다. 매수가는 원화 기준. 미국 주식 손익은 환율(KRW=X)로 평가금액을 원화 환산 후 계산합니다. **로그인한 본인만** 등록한 종목을 볼 수 있습니다. 데이터는 로컬 JSON 파일에 저장됩니다. **60초마다 자동 갱신**")

        user_id = st.session_state.get("user_id")

        if user_id is None:
            # 로그인/회원가입
            tab_login, tab_register = st.tabs(["로그인", "회원가입"])
            with tab_login:
                with st.form("로그인폼"):
                    login_username = st.text_input("아이디", placeholder="아이디 입력")
                    login_password = st.text_input("비밀번호", type="password", placeholder="비밀번호 입력")
                    if st.form_submit_button("로그인"):
                        ok, err = auth_login(login_username, login_password)
                        if ok:
                            st.session_state.user_id = login_username.strip().lower()
                            st.success(f"{st.session_state.user_id}님, 로그인되었습니다.")
                            # st.rerun() 제거 → fragment만 리로드되어 거래 현황 등은 다시 안 불러옴
                        else:
                            st.error(err)
            with tab_register:
                with st.form("회원가입폼"):
                    reg_username = st.text_input("아이디", placeholder="2자 이상")
                    reg_password = st.text_input("비밀번호", type="password", placeholder="8자 이상, 영문+숫자", help="8자 이상, 영문과 숫자를 모두 포함해 주세요.")
                    reg_confirm = st.text_input("비밀번호 확인", type="password", placeholder="비밀번호 재입력")
                    if st.form_submit_button("회원가입"):
                        if reg_password != reg_confirm:
                            st.error("비밀번호가 일치하지 않습니다.")
                        else:
                            ok, err = auth_register(reg_username, reg_password)
                            if ok:
                                st.success("회원가입되었습니다. 로그인 탭에서 로그인해 주세요.")
                                # st.rerun() 제거 → fragment만 리로드
                            else:
                                st.error(err)
            # ※ 'default' 안내 문구 제거: 누구나 default로 가입하면 마이그레이션된 타인 데이터 접근 가능한 보안 취약점
        else:
            # 로그인됨 — 보유 종목 UI
            col_user, col_logout = st.columns([3, 1])
            with col_logout:
                if st.button("로그아웃", use_container_width=True):
                    st.session_state.user_id = None
                    # st.rerun() 제거 → fragment만 리로드되어 거래 현황 등은 다시 안 불러옴
            with col_user:
                st.caption(f"**{user_id}**님으로 로그인 중")

            # 구매 등록 폼
            with st.form("구매등록"):
                구매_종목 = st.text_input("종목명 또는 티커", placeholder="예: 삼성전자, 005930.KS, AAPL")
                구매_수량 = st.number_input("수량", min_value=0.01, value=1.0, step=0.01, format="%.2f")
                구매_가격 = st.number_input("매수가 (원화)", min_value=0.01, value=1000.0, step=1.0, format="%.2f", help="원화 기준으로 입력")
                구매_일자 = st.date_input("매수일", value=datetime.now().date())
                구매_메모 = st.text_input("메모 (선택)", placeholder="예: 1차 매수")
                등록_클릭 = st.form_submit_button("등록하기")
            if 등록_클릭:
                티커 = resolve_to_ticker(구매_종목) if 구매_종목 else None
                if 티커 and 구매_수량 > 0 and 구매_가격 > 0:
                    try:
                        add_purchase(
                            user_id=user_id,
                            ticker=티커,
                            quantity=구매_수량,
                            purchase_price=구매_가격,
                            purchase_date=구매_일자.strftime("%Y-%m-%d"),
                            memo=구매_메모 or "",
                        )
                        st.success(f"{티커} {구매_수량}주 @ {구매_가격:,.0f}원 등록되었습니다.")
                        # st.rerun() 제거 → fragment만 리로드
                    except Exception as e:
                        st.error(f"등록 실패: {e}")
                else:
                    st.warning("종목명, 수량, 매수가를 올바르게 입력해 주세요.")

            # 보유 종목 + 손익 표시 — 60초마다 자동 갱신 (현재가·환율 반영)
            @st.fragment(run_every=timedelta(seconds=60))
            def 보유종목_손익_표시():
                uid = st.session_state.get("user_id")
                if uid is None:
                    return
                holdings_with_pl = get_holdings_with_profit_loss(
                    uid,
                    _현재가_및_통화_조회,
                    get_usd_krw_rate_func=_달러당_원화_환율,
                )
                if holdings_with_pl:
                    # 통화별 합산 (원화/달러 혼합 보유 시 구분 표시)
                    통화별 = {}
                    for h in holdings_with_pl:
                        c = h.get("currency_label") or "—"
                        if c not in 통화별:
                            통화별[c] = {"cost": 0, "value": 0, "profit_loss": 0}
                        통화별[c]["cost"] += h["total_cost"]
                        통화별[c]["value"] += h["market_value"] or 0
                        if h.get("profit_loss") is not None:
                            통화별[c]["profit_loss"] += h["profit_loss"]
                    # 요약 메트릭 (통화별) — 매수금액·손익은 항상 원화
                    for 통화, 합계 in 통화별.items():
                        if 통화 == "—":
                            continue
                        cost, value = 합계["cost"], 합계["value"]
                        pl = 합계["profit_loss"] if cost else None
                        pl_pct = (pl / cost * 100) if cost and pl is not None else None
                        st.caption(f"**{통화}** (평가금액 기준)")
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.metric("총 매수금액", _금액_포맷(cost, "원(KRW)"))
                        with col2:
                            st.metric("총 평가금액", _금액_포맷(value, 통화))
                        with col3:
                            if pl is not None and pl_pct is not None:
                                색 = "🟢" if pl >= 0 else "🔴"
                                st.metric("총 손익", f"{색} {pl:+,.0f}원 ({pl_pct:+.2f}%)")
                            else:
                                st.metric("총 손익", "—")
                    # 포트폴리오 리스크·분산도
                    div_info = get_diversity_score(holdings_with_pl)
                    if div_info.get("count", 0) > 0:
                        st.caption("**분산도** " + f"점수 {int(div_info['diversity_score'])}/100 · 상위 3종목 집중도 {div_info['concentration_top3']}%")
                    # 리밸런싱 제안
                    if div_info.get("count", 0) >= 2:
                        with st.expander("🔄 리밸런싱 제안 (균등 비중 기준)", expanded=False):
                            rebal = get_rebalance_suggestions(holdings_with_pl, "equal")
                            for r in rebal:
                                if r["액션"] != "유지":
                                    st.caption(f"{r['ticker']}: 현재 {r['현재비중']}% → 목표 {r['목표비중']}% | {r['액션']} {abs(r['차이금액']):,.0f}원")
                    # 예상 수수료·세금 (매도 시)
                    with st.expander("🧮 예상 수수료·세금 (매도 시)", expanded=False):
                        환율 = _달러당_원화_환율()
                        fee_summary = estimate_holdings_sell_summary(holdings_with_pl, 환율)
                        st.caption("※ 국내주식 기준 근사치 (증권거래세, 투자자보호기금, 증권사수수료 0.02%). 실제는 증권사·연도에 따라 다를 수 있습니다.")
                        col_f1, col_f2, col_f3 = st.columns(3)
                        with col_f1:
                            st.metric("매도 예상 총액(원화)", f"{fee_summary['total_sell_amount_krw']:,.0f}원")
                        with col_f2:
                            st.metric("매도 수수료·거래세", f"{fee_summary['sell_fee_tax_krw']:,.0f}원")
                        with col_f3:
                            st.metric("양도소득세(참고)", f"{fee_summary['capital_gains_tax_krw']:,.0f}원")
                        st.caption(f"양도소득세: {fee_summary['capital_gains_note']}")
                    # 매도 시뮬레이터
                    with st.expander("🧮 매도 시뮬레이터 (예상 손익)", expanded=False):
                        st.caption("종목 선택 후 매도가를 입력하면 수수료·세금 반영 순손익을 확인할 수 있습니다.")
                        선택_종목 = st.selectbox(
                            "종목",
                            options=range(len(holdings_with_pl)),
                            format_func=lambda i: f"{_종목명_조회(holdings_with_pl[i]['ticker'])} ({holdings_with_pl[i]['ticker']})",
                            key="sim_sell_select",
                        )
                        h = holdings_with_pl[선택_종목]
                        sim_price = st.number_input("예상 매도가 (1주당)", value=float(h.get("current_price") or h["avg_purchase_price"]), min_value=0.01, step=100.0, key="sim_sell_price")
                        if st.button("계산", key="sim_sell_btn"):
                            is_krw = "원" in (h.get("currency_label") or "") or "KRW" in (h.get("currency_label") or "").upper()
                            환율 = _달러당_원화_환율() if not is_krw else None
                            res = simulate_sell(
                                quantity=h["quantity"],
                                avg_cost_krw=h["avg_purchase_price"],
                                sell_price_per_share=sim_price,
                                is_krw=is_krw,
                                usd_to_krw=환율,
                            )
                            if "error" in res:
                                st.warning(res["error"])
                            else:
                                st.metric("순손익 (수수료·세금 후)", f"{res['순손익']:+,.0f}원")
                                st.caption(f"세전 손익 {res['손익_세전']:+,.0f}원 · 매도 수수료 {res['매도수수료']:,}원 · 양도세 {res['양도세']:,}원")

                    # 포트폴리오 비중 파이 차트 (Plotly — 마우스 호버 시 종목명·평가금액 표시)
                    with st.expander("📊 보유 비중 차트", expanded=False):
                        labels = []
                        sizes = []
                        for h in holdings_with_pl:
                            mv = h.get("market_value") or 0
                            if mv and mv > 0:
                                이름 = _종목명_조회(h["ticker"])
                                labels.append(f"{이름} ({h['ticker']})")
                                sizes.append(mv)
                        if labels and sizes:
                            import plotly.express as px
                            total = sum(sizes)
                            fig = px.pie(
                                values=sizes, names=labels,
                                hole=0.35,
                            )
                            fig.update_traces(rotation=90)  # 시작 각도 90도
                            # 호버 툴팁: 종목명, 평가금액, 비중
                            통화목록 = [(h.get("currency_label") or "원") for h in holdings_with_pl if (h.get("market_value") or 0) > 0]
                            custom = [[f"{v:,.0f} {c}", f"{100*v/total:.1f}%"] for v, c in zip(sizes, 통화목록)]
                            fig.update_traces(
                                textinfo="percent",
                                textposition="inside",
                                customdata=custom,
                                hovertemplate="<b>%{label}</b><br>평가금액: %{customdata[0]}<br>비중: %{customdata[1]}<extra></extra>"
                            )
                            fig.update_layout(
                                margin=dict(t=30, b=30, l=30, r=30),
                                showlegend=True,
                                legend=dict(orientation="h", yanchor="top", y=-0.1, xanchor="center", x=0.5),
                                font=dict(family="Malgun Gothic, sans-serif")
                            )
                            st.plotly_chart(fig, use_container_width=True)
                        else:
                            st.caption("평가금액 데이터가 없어 차트를 표시할 수 없습니다.")
                    표데이터 = []
                    for h in holdings_with_pl:
                        통화 = h.get("currency_label") or "—"
                        손익표시 = "—"
                        if h.get("profit_loss") is not None and h.get("profit_loss_pct") is not None:
                            이모지 = "🟢" if h["profit_loss"] >= 0 else "🔴"
                            손익표시 = f"{이모지} {h['profit_loss']:+,.0f}원 ({h['profit_loss_pct']:+.2f}%)"
                        종목명 = _종목명_조회(h["ticker"])
                        종목표시 = f"{종목명}({h['ticker']})" if 종목명 != h["ticker"] else h["ticker"]
                        표데이터.append({
                            "종목(티커)": 종목표시,
                            "통화(현재가)": 통화,
                            "수량": h["quantity"],
                            "구매단가(원)": _금액_포맷(h["avg_purchase_price"], "원(KRW)"),
                            "현재가": _금액_포맷(h.get("current_price"), 통화),
                            "평가금액": _금액_포맷(h.get("market_value"), 통화),
                            "손익": 손익표시,
                        })
                    표_df = pd.DataFrame(표데이터)
                    st.caption("💡 종목 행을 **클릭**하면 아래 조회 영역에 자동으로 표시됩니다.")
                    holdings_event = st.dataframe(
                        표_df,
                        use_container_width=True,
                        hide_index=True,
                        on_select="rerun",
                        selection_mode="single-row",
                        key="holdings_df",
                    )
                    # 행 선택 시 해당 티커로 아래 조회 영역에 자동 표시
                    if holdings_event.selection and holdings_event.selection.rows:
                        row_idx = holdings_event.selection.rows[0]
                        if 0 <= row_idx < len(holdings_with_pl):
                            선택_티커 = holdings_with_pl[row_idx]["ticker"]
                            # 이미 처리한 선택이면 st.rerun() 생략 → 무한 리로드 방지
                            if st.session_state.get("_last_holdings_selection") != 선택_티커:
                                st.session_state["suggested_ticker"] = 선택_티커
                                st.session_state["_last_holdings_selection"] = 선택_티커
                                st.rerun()
                    # 구매 내역 상세 (삭제 가능)
                    with st.expander("📋 구매 내역 상세 (삭제)"):
                        raw = get_holdings(uid)
                        for r in raw:
                            col_a, col_b = st.columns([3, 1])
                            with col_a:
                                가격표시 = f"{r['purchase_price']:,.0f}원"
                                st.caption(f"{r['ticker']} | {r['quantity']}주 @ {가격표시} | {r['purchase_date']}" + (f" | {r.get('memo','')}" if r.get("memo") else ""))
                            with col_b:
                                if st.button("삭제", key=f"del_{r['id']}"):
                                    delete_purchase(uid, r["id"])
                                    # st.rerun() 제거 → fragment만 리로드
                else:
                    st.info("등록된 보유 종목이 없습니다. 위 폼에서 구매 내역을 등록해 보세요. 💡 종목명(삼성전자) 또는 티커(005930.KS, AAPL)로 입력할 수 있습니다.")

            보유종목_손익_표시()

_내_보유_종목_섹션()

# 관심종목(워치리스트) — 로그인 사용자만
watchlist_uid = st.session_state.get("user_id")
if watchlist_uid:
    with st.expander("⭐ 관심종목 (워치리스트)", expanded=False):
        if st.session_state.get("flash_watchlist"):
            st.success(st.session_state.pop("flash_watchlist"))
        st.caption("관심 종목을 등록하면 한눈에 현재가를 모니터링할 수 있습니다.")
        wl_tickers = get_watchlist(watchlist_uid)
        if wl_tickers:
            # 현재가 조회 후 표시
            wl_data = []
            for wt in wl_tickers:
                가격, 통화 = _현재가_및_통화_조회(wt)
                이름 = _종목명_조회(wt)
                wl_data.append({
                    "종목": f"{이름} ({wt})",
                    "현재가": _금액_포맷(가격, 통화) if 가격 else "—",
                    "티커": wt,
                })
            for i, r in enumerate(wl_data):
                col_a, col_b = st.columns([3, 1])
                with col_a:
                    if st.button(r["종목"], key=f"wl_btn_{r['티커']}_{i}"):
                        st.session_state["suggested_ticker"] = r["티커"]
                        st.rerun()
                with col_b:
                    st.caption(r["현재가"])
                    if st.button("삭제", key=f"wl_del_{r['티커']}_{i}"):
                        remove_from_watchlist(watchlist_uid, r["티커"])
                        st.rerun()
        with st.form("관심종목추가"):
            add_ticker = st.text_input("추가할 종목명 또는 티커", placeholder="예: 삼성전자, AAPL", key="wl_add")
            if st.form_submit_button("관심종목에 추가"):
                res_ticker = resolve_to_ticker(add_ticker) if add_ticker else None
                if res_ticker:
                    if add_to_watchlist(watchlist_uid, res_ticker):
                        st.session_state["flash_watchlist"] = f"{res_ticker} 관심종목에 추가되었습니다."
                    else:
                        st.session_state["flash_watchlist"] = "이미 관심종목에 있습니다."
                    st.rerun()
                else:
                    st.warning("올바른 종목을 입력해 주세요.")

# 목표가·알림 — 로그인 사용자만
if watchlist_uid:
    with st.expander("🔔 목표가·알림 설정", expanded=False):
        st.caption("목표가 도달 시 앱에서 알림을 확인할 수 있습니다. (접속 시 표시)")
        alerts_list = get_alerts(watchlist_uid)
        if alerts_list:
            # 현재가와 비교해 도달 여부 표시
            for a in alerts_list:
                가격, 통화 = _현재가_및_통화_조회(a["ticker"])
                목표 = a["target_price"]
                방향 = a["direction"]
                도달 = False
                if 가격 is not None:
                    if 방향 == "above" and 가격 >= 목표:
                        도달 = True
                    elif 방향 == "below" and 가격 <= 목표:
                        도달 = True
                col_x, col_y = st.columns([3, 1])
                with col_x:
                    msg = f"{a['ticker']} | 목표 {목표:,.0f} {'이상' if 방향 == 'above' else '이하'} | 현재 {_금액_포맷(가격, 통화)}"
                    if 도달:
                        st.success(f"✅ {msg}")
                    else:
                        st.caption(msg)
                with col_y:
                    if st.button("삭제", key=f"alert_del_{a['id']}"):
                        delete_alert(watchlist_uid, a["id"])
                        st.rerun()
        with st.form("알림추가"):
            alt_ticker = st.text_input("종목", placeholder="예: 삼성전자", key="alert_ticker")
            alt_price = st.number_input("목표가", min_value=0.01, value=10000.0, step=100.0, key="alert_price")
            alt_dir = st.radio("도달 조건", ["이상 (가격 상승 시)", "이하 (가격 하락 시)"], key="alert_dir")
            if st.form_submit_button("알림 추가"):
                res_t = resolve_to_ticker(alt_ticker) if alt_ticker else None
                if res_t and alt_price > 0:
                    add_alert(watchlist_uid, res_t, alt_price, "above" if "이상" in alt_dir else "below")
                    st.success("알림이 추가되었습니다.")
                else:
                    st.warning("종목과 목표가를 입력해 주세요.")

# 최근 조회 종목 (클릭 시 바로 조회)
최근목록 = st.session_state.get("recent_tickers", [])
if 최근목록:
    with st.expander("🕐 최근 조회 종목", expanded=False):
        cols = st.columns(min(5, len(최근목록)))
        for i, t in enumerate(최근목록[:10]):
            with cols[i % 5]:
                if st.button(t, key=f"recent_{t}_{i}"):
                    st.session_state["suggested_ticker"] = t
                    st.rerun()

with st.form("주식조회", clear_on_submit=False):
    기본입력값 = st.session_state.get("suggested_ticker", "삼성전자")
    st.markdown("#### 🔍 종목 검색")
    col_input, col_period = st.columns([4, 1])
    with col_input:
        ticker_input = st.text_input(
            "회사명 또는 티커 입력",
            value=기본입력값,
            placeholder="예: 삼성전자, 네이버, AAPL, 005930.KS (또는 ? 입력)",
            help="? 또는 /? 입력 시 거래대금 상위 종목(약 20종) 표시",
            label_visibility="collapsed"
        )
    with col_period:
        period = st.selectbox(
            "차트 기간",
            options=["1mo", "3mo", "6mo", "1y", "2y", "5y"],
            index=3,
            label_visibility="collapsed"
        )
    submitted = st.form_submit_button("조회하기", use_container_width=True)

# 버튼 클릭으로 제안된 종목이 있으면 해당으로 조회
제안종목 = st.session_state.pop("suggested_ticker", None)
입력값 = (제안종목 or (ticker_input.strip() if ticker_input else "")).strip()
도움말요청 = 입력값 in ("?", "/?", "??")

if (submitted or 입력값 or 제안종목) and 입력값 and not 도움말요청:
    ticker = resolve_to_ticker(입력값) or 입력값.upper()
    with st.spinner("데이터 조회 중..."):
        info = get_stock_info(ticker)
        history_df = fetch_history(ticker, period=period)

    if info:
        # 최근 조회 목록에 추가 (중복 제거, 최대 10개)
        recent = st.session_state.get("recent_tickers", [])
        if ticker in recent:
            recent.remove(ticker)
        recent.insert(0, ticker)
        st.session_state["recent_tickers"] = recent[:10]

        종목명 = info.get("name") or ticker
        st.success(f"**{종목명}** ({ticker})을(를) 찾았습니다.")
                # 로그인 시 관심종목 추가·목표가 설정 버튼
        detail_uid = st.session_state.get("user_id")
        if detail_uid:
            st.caption("---")
            btn_col1, btn_col2 = st.columns(2)
            with btn_col1:
                if st.button("⭐ 관심종목에 추가", key="detail_add_watch"):
                    if add_to_watchlist(detail_uid, ticker):
                        st.session_state["flash_watchlist"] = f"{ticker} 관심종목에 추가되었습니다."
                    else:
                        st.session_state["flash_watchlist"] = "이미 관심종목에 있습니다."
                    st.rerun()
            with btn_col2:
                with st.popover("🔔 목표가 알림 설정"):
                    ap = st.number_input("목표가", value=float(info.get("current_price") or 0), min_value=0.01, step=100.0, key="popover_price")
                    ad = st.radio("조건", ["이상 도달 시", "이하 도달 시"], key="popover_dir")
                    if st.button("알림 추가", key="popover_add"):
                        add_alert(detail_uid, ticker, ap, "above" if "이상" in ad else "below")
                        st.success("알림 추가됨")
                        st.rerun()

        st.markdown("<br>", unsafe_allow_html=True)
        holdings = get_etf_holdings(ticker)
        차트있음 = history_df is not None and not history_df.empty
        if not 차트있음:
            st.caption("※ 차트 데이터가 없어 가격 차트·기술적 분석 표시는 제한됩니다.")

        tab_titles = ["📌 기본 정보", "📰 관련 뉴스", "💰 배당 정보", "📈 가격 차트", "📊 기술적 분석"]
        if holdings:
            tab_titles.append("📋 ETF 구성종목")
            
        tabs = st.tabs(tab_titles)

        with tabs[0]:
            currency_label = info.get("currency_label", "달러(USD)")
            st.caption("※ 데이터: Yahoo Finance, KRX 등 (참고용)")
            col1, col2, col3 = st.columns(3)
            with col1:
                if info.get("current_price") is not None:
                    st.metric("현재가", _금액_포맷(info["current_price"], currency_label))
                if info.get("previous_close") is not None:
                    st.metric("전일 종가", _금액_포맷(info["previous_close"], currency_label))
            with col2:
                if info.get("pe_ratio") is not None:
                    st.metric("PER(추이)", f"{info['pe_ratio']:.2f}")
                if info.get("market_cap") is not None:
                    cap = info["market_cap"]
                    cap_str = f"{cap/1e9:.2f}B" if cap >= 1e9 else f"{cap:,.0f}"
                    st.metric("시가총액", f"{cap_str} {currency_label}")
            with col3:
                if info.get("sector"):
                    st.write("**섹터**", info["sector"])
                if info.get("industry"):
                    st.write("**산업**", info["industry"])

        with tabs[1]:
            news_list = get_stock_news(ticker, limit=7)
            if news_list:
                for n in news_list:
                    title = n.get("title", "제목 없음")
                    url = n.get("url", "")
                    st.markdown(f"• **[{title}]({url})**" if url else f"• {title}")
            else:
                st.caption("뉴스 데이터를 불러올 수 없습니다. (Google News 제공)")

        with tabs[2]:
            div_info = get_dividend_info(ticker)
            if div_info:
                if div_info.get("dividend_yield") is not None:
                    st.metric("배당 수익률", f"{div_info['dividend_yield']:.2f}%")
                if div_info.get("last_dividend"):
                    ld = div_info["last_dividend"]
                    st.caption(f"최근 배당: {ld.get('date', '')} - {ld.get('amount', 0):.2f}")
                if div_info.get("payout_ratio") is not None:
                    pr = div_info["payout_ratio"]
                    pr_pct = pr * 100 if pr and pr <= 1 else pr
                    st.caption(f"배당성향(Payout): {pr_pct:.1f}%")
                if not any([div_info.get("dividend_yield"), div_info.get("last_dividend")]):
                    st.caption("배당 정보가 없거나 제공되지 않는 종목입니다.")
            else:
                st.caption("배당 데이터를 불러올 수 없습니다. (yfinance 제공)")

        with tabs[3]:
            if 차트있음:
                st.caption(f"※ 최신 반영: {조회시점}")
                st.line_chart(history_df["Close"])
            else:
                st.info("가격 차트 데이터가 없습니다.")

        with tabs[4]:
            if 차트있음:
                분석 = analyze_chart(history_df)
                판단색 = {"매수 적합": "🟢", "보류 (관망)": "🟡", "매수 위험": "🔴", "분석불가": "⚪"}
                st.caption("참고용입니다. 투자 판단은 본인 책임입니다.")
                col_a, col_b, col_c = st.columns(3)
                with col_a:
                    st.metric("판단", f"{판단색.get(분석['판단'], '')} {분석['판단']}")
                with col_b:
                    st.metric("위험도", 분석["위험도"])
                with col_c:
                    st.metric("신뢰도", 분석.get("신뢰도", "-"))
                if 분석.get("전망"):
                    with st.expander("📈 단기 전망 및 관심 구간", expanded=True):
                        for 문단 in 분석["전망"]:
                            st.markdown(문단)
                with st.expander("분석 근거 및 지표 (주린이용 설명 포함)"):
                    if 분석.get("근거_쉬운설명"):
                        st.caption("💡 주식 초보자도 이해할 수 있도록 쉽게 풀어 쓴 설명입니다.")
                        for 쉬운 in 분석["근거_쉬운설명"]:
                            st.write(쉬운)
                    else:
                        for 근거 in 분석["근거"]:
                            st.write(f"• {근거}")
                    if 분석.get("지표_쉬운설명") and 분석.get("지표"):
                        st.write("**지표 뜻 (주린이용)**")
                        for 키, 뜻 in 분석["지표_쉬운설명"].items():
                            값 = 분석["지표"].get(키)
                            if 값 is not None:
                                st.caption(f"• **{키}** = {값} → {뜻}")
                    with st.expander("📊 전문가용 지표 수치"):
                        if 분석.get("지표"):
                            st.json(분석["지표"])
                        st.caption("— 기술적 근거 —")
                        for 근거 in 분석.get("근거", [])[:-1]:
                            st.caption(f"• {근거}")
            else:
                st.info("차트 데이터가 없어 기술적 분석이 비활성됩니다.")

        if holdings:
            with tabs[5]:
                st.caption("비중 상위 종목 (최대 20종)")
                표_df = pd.DataFrame(holdings[:20])
                st.dataframe(표_df, use_container_width=True, hide_index=True)
    else:
        st.warning(f"'{입력값}'에 대한 정보를 가져오지 못했습니다. 회사명 또는 티커를 확인해 주세요.")
        # 유사한 ETF 검색 (키워드 매칭)
        유사목록 = get_similar_etfs(입력값, limit=10)
        if 유사목록:
            st.subheader("🔍 유사한 종목")
            st.caption("아래 중 찾으시는 종목이 있으면 클릭해 보세요.")
            cols = st.columns(2)
            for i, (티커, 이름) in enumerate(유사목록):
                with cols[i % 2]:
                    if st.button(f"{이름} ({티커}.KS)", key=f"similar_{티커}_{i}"):
                        st.session_state["suggested_ticker"] = f"{티커}.KS"
                        st.rerun()
        else:
            st.info("예: 하이닉스, 삼성전자, 000660.KS | ? 입력 시 거래대금 상위 종목")

elif 도움말요청:
    st.subheader("📋 거래대금 상위 종목 (약 20종)")
    st.caption("? 또는 /? 입력 시 코스피·코스닥·ETF 거래대금 상위 종목을 보여줍니다. 클릭하면 바로 조회합니다.")
    with st.spinner("거래대금 상위 종목 로딩 중..."):
        try:
            거래상위_코스피, _ = get_top_traded_stocks(limit=7, market="KOSPI")
            거래상위_코스닥, _ = get_top_traded_stocks(limit=7, market="KOSDAQ")
            거래상위_ETF = get_top_traded_etfs(limit=6)
        except Exception:
            거래상위_코스피 = []
            거래상위_코스닥 = []
            거래상위_ETF = []
    목록 = []
    for r in (거래상위_코스피 or []):
        목록.append((r["티커"] + ".KS", r["종목명"]))
    for r in (거래상위_코스닥 or []):
        목록.append((r["티커"] + ".KQ", r["종목명"]))
    for r in (거래상위_ETF or []):
        목록.append((r["티커"] + ".KS", r["종목명"]))
    if 목록:
        st.success(f"거래대금 상위 {len(목록)}종을 찾았습니다.")
        cols = st.columns(2)
        for i, (티커, 이름) in enumerate(목록):
            with cols[i % 2]:
                if st.button(f"{이름} ({티커})", key=f"vol_{티커}_{i}"):
                    st.session_state["suggested_ticker"] = 티커
                    st.rerun()
        st.caption("※ 위 버튼을 클릭하면 해당 종목을 바로 조회합니다.")
    else:
        st.warning("거래대금 상위 종목을 불러오지 못했습니다. KRX 연결을 확인해 주세요.")
