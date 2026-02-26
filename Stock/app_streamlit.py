# -*- coding: utf-8 -*-
"""
주식 뷰어 - Streamlit 웹 UI
실행: streamlit run app_streamlit.py
"""

from datetime import datetime, timedelta

import pandas as pd
import streamlit as st
from stock_viewer import get_stock_info, fetch_history, resolve_to_ticker
from data_sources import get_etf_holdings
from chart_analysis import analyze_chart
from trading_overview import get_market_overview, get_top_traded_stocks, get_top_traded_etfs, get_top_gainers_losers
from list_etfs import get_recommended_etfs, get_similar_etfs
from stock_ai import get_stock_ai_response
from portfolio import add_purchase, delete_purchase, get_holdings, get_holdings_with_profit_loss
from auth import login as auth_login, register as auth_register

st.set_page_config(page_title="주식 정보·차트 뷰어", layout="wide")

# 세션 초기화
if "stock_ai_messages" not in st.session_state:
    st.session_state.stock_ai_messages = []
if "user_id" not in st.session_state:
    st.session_state.user_id = None

# 디지털 시계 스타일 티커 (코스피, 코스닥, 원화환율) - 60초마다 자동 갱신
디지털_스타일 = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');
div.digital-ticker {
    background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-around;
    align-items: center;
    flex-wrap: wrap;
    gap: 24px;
}
div.digital-item {
    text-align: center;
}
div.digital-label {
    font-size: 12px;
    color: #8b949e;
    margin-bottom: 4px;
    font-family: 'Malgun Gothic', sans-serif;
}
div.digital-value {
    font-family: 'Orbitron', monospace;
    font-size: 28px;
    font-weight: 700;
    color: #00ff88;
    text-shadow: 0 0 10px rgba(0,255,136,0.5);
    letter-spacing: 2px;
}
div.digital-time {
    font-size: 11px;
    color: #6e7681;
    margin-top: 8px;
}
</style>
"""


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

    st.markdown(디지털_스타일, unsafe_allow_html=True)
    디지털_html = '<div class="digital-ticker">'
    for 이름, 값 in 디지털_값.items():
        디지털_html += f'<div class="digital-item"><div class="digital-label">{이름}</div><div class="digital-value">{값}</div></div>'
    디지털_html += f'<div class="digital-time">조회: {datetime.now().strftime("%Y-%m-%d %H:%M")} · 60초마다 자동 갱신</div>'
    디지털_html += "</div>"
    st.markdown(디지털_html, unsafe_allow_html=True)


디지털_시계_위젯()

st.title("주식 정보 및 차트 뷰어")
st.caption("주식명 입력 후 Enter. ? 또는 /? 입력 시 거래대금 상위 종목(약 20종) 표시")

# --- 사이드바: 주식 AI 채팅 ---
with st.sidebar:
    st.subheader("🤖 주식 AI")
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

# 거래 현황 (코스피/코스닥 시장 요약, 거래대금·등락률 상위) — 5시간마다만 리로딩
@st.cache_data(ttl=5 * 60 * 60)  # 5시간 = 18000초
def _거래_현황_데이터():
    """국내 시장 거래 현황. 5시간 캐시로 KRX API 호출 최소화"""
    try:
        시장요약 = get_market_overview()
        거래대금상위_코스피 = get_top_traded_stocks(limit=10, market="KOSPI")
        거래대금상위_코스닥 = get_top_traded_stocks(limit=10, market="KOSDAQ")
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
        st.warning(
            "거래 현황 데이터를 불러오지 못했습니다. "
            "KRX(data.krx.co.kr) 연결이 필요합니다. 네트워크·DNS·방화벽을 확인해 주세요."
        )

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
    """티커의 (현재가, 통화표시) 반환. 실패 시 (None, '—')"""
    # 종목명(한글)으로 저장된 경우 티커로 변환 (예: KG모빌리티 → 003620.KS)
    조회용_티커 = resolve_to_ticker(ticker) or ticker
    info = get_stock_info(조회용_티커)
    if info and info.get("current_price") is not None:
        통화 = info.get("currency_label", "달러(USD)")
        return (info["current_price"], 통화)
    df = fetch_history(조회용_티커, "5d")
    if df is not None and not df.empty and "Close" in df.columns:
        가격 = float(df["Close"].iloc[-1])
        # .KS/.KQ → 원화, 그 외 → 달러 추정
        통화 = "원(KRW)" if ticker.endswith((".KS", ".KQ")) else "달러(USD)"
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
    """통화에 맞게 금액 포맷 (원: 정수, 달러: 소수점 2자리)"""
    if val is None:
        return "—"
    if "원" in (currency_label or "") or "KRW" in (currency_label or "").upper():
        return f"{val:,.0f}원"
    return f"${val:,.2f}"  # USD

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
                    reg_password = st.text_input("비밀번호", type="password", placeholder="4자 이상")
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
                            "평균매수가(원)": _금액_포맷(h["avg_purchase_price"], "원(KRW)"),
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
                    st.info("등록된 보유 종목이 없습니다. 위 폼에서 구매 내역을 등록해 보세요.")

            보유종목_손익_표시()

_내_보유_종목_섹션()

with st.form("주식조회"):
    # 보유 종목에서 행 클릭 시 선택된 티커를 입력란에 표시
    기본입력값 = st.session_state.get("suggested_ticker", "삼성전자")
    ticker_input = st.text_input(
        "회사명 또는 티커 입력",
        value=기본입력값,
        placeholder="예: 삼성전자, 네이버, 200액티브, AAPL (또는 ? 입력 시 거래대금 상위 종목)",
        help="? 또는 /? 입력 시 거래대금 상위 종목(약 20종) 표시",
    )
    period = st.selectbox(
        "차트 기간",
        options=["1mo", "3mo", "6mo", "1y", "2y", "5y"],
        index=3,
    )
    submitted = st.form_submit_button("조회하기")

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
        종목명 = info.get("name") or ticker
        st.success(f"**{종목명}** ({ticker})을(를) 찾았습니다.")
        st.subheader("어떤 정보를 보시겠습니까?")
        holdings = get_etf_holdings(ticker)
        차트있음 = history_df is not None and not history_df.empty
        기본정보 = st.checkbox("기본 정보 (현재가, 시가총액, PER 등)", value=True)
        가격차트 = st.checkbox("가격 차트", value=차트있음, disabled=not 차트있음)
        기술적분석 = st.checkbox("기술적 분석 (매수 적합/위험 판단)", value=차트있음, disabled=not 차트있음)
        etf구성 = st.checkbox("ETF 구성종목", value=bool(holdings), disabled=not holdings)
        if not 차트있음:
            st.caption("※ 차트 데이터가 없어 가격 차트·기술적 분석은 비활성화됩니다.")

        if 기본정보:
            currency_label = info.get("currency_label", "달러(USD)")
            st.subheader(f"📌 기본 정보")
            col1, col2, col3 = st.columns(3)
            with col1:
                if info.get("current_price") is not None:
                    st.metric("현재가", f"{info['current_price']:,.2f} {currency_label}")
                if info.get("previous_close") is not None:
                    st.metric("전일 종가", f"{info['previous_close']:,.2f} {currency_label}")
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

        if 가격차트 and 차트있음:
            st.subheader("📈 가격 차트")
            st.caption(f"※ 최신 반영: {조회시점}")
            st.line_chart(history_df["Close"])

        if 기술적분석 and 차트있음:
            분석 = analyze_chart(history_df)
            판단색 = {"매수 적합": "🟢", "보류 (관망)": "🟡", "매수 위험": "🔴", "분석불가": "⚪"}
            st.subheader("📊 기술적 분석")
            st.caption("참고용입니다. 투자 판단은 본인 책임입니다.")
            col_a, col_b, col_c = st.columns(3)
            with col_a:
                st.metric("판단", f"{판단색.get(분석['판단'], '')} {분석['판단']}")
            with col_b:
                st.metric("위험도", 분석["위험도"])
            with col_c:
                st.metric("신뢰도", 분석.get("신뢰도", "-"))
            # 전망 (지지/저항, 시나리오)
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

        if etf구성 and holdings:
            st.subheader("📋 ETF 구성종목")
            st.caption("비중 상위 종목 (최대 20종)")
            표_df = pd.DataFrame(holdings[:20])
            st.dataframe(표_df, use_container_width=True, hide_index=True)

        if not (기본정보 or 가격차트 or 기술적분석 or etf구성):
            st.info("위에서 보고 싶은 정보를 선택해 주세요.")
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
            거래상위_코스피 = get_top_traded_stocks(limit=7, market="KOSPI")
            거래상위_코스닥 = get_top_traded_stocks(limit=7, market="KOSDAQ")
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
