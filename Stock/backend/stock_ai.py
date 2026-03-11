# -*- coding: utf-8 -*-
"""
주식 AI 채팅 모듈
- 사용자 질문에 실시간 주식 데이터를 반영해 답변
- OpenAI API 사용 (OPENAI_API_KEY 환경변수 또는 Streamlit secrets)
"""

import os
import re
from typing import Optional

from backend.stock_viewer import resolve_to_ticker, COMPANY_NAME_TO_TICKER
from backend.data_sources import get_stock_info, fetch_history, get_etf_holdings
from backend.chart_analysis import analyze_chart
from backend.list_etfs import get_recommended_etfs


def _메시지에서_종목_추출(메시지: str) -> list[tuple[str, str]]:
    """
    사용자 메시지에서 언급된 종목명/티커를 추출합니다.
    반환: [(종목명_or_티커, 티커), ...]
    """
    메시지_정규화 = 메시지.replace(" ", "").lower()
    발견 = []
    처리된_티커 = set()

    # 1) 매핑된 한글/영문명 검색 (긴 이름 우선)
    for 이름, 티커 in sorted(COMPANY_NAME_TO_TICKER.items(), key=lambda x: -len(x[0])):
        검색키 = 이름.replace(" ", "").lower()
        if 검색키 in 메시지_정규화 and 티커 not in 처리된_티커:
            발견.append((이름, 티커))
            처리된_티커.add(티커)

    # 2) 티커 패턴: 6자리.KS/.KQ, ^KS11, AAPL 등
    단어들 = re.findall(r"[\w.^]+", 메시지)
    for w in 단어들:
        t = w.strip().upper()
        if len(t) < 2:
            continue
        if re.match(r"^\d{6}\.(KS|KQ)$", t) or (t.startswith("^") and len(t) >= 4):
            if t not in 처리된_티커:
                발견.append((t, t))
                처리된_티커.add(t)
        elif re.match(r"^[A-Z]{2,5}(\.(KS|KQ))?$", t):
            resolved = resolve_to_ticker(t)
            if resolved and resolved not in 처리된_티커:
                발견.append((t, resolved))
                처리된_티커.add(resolved)

    return 발견


def _투자_추천_질문인가(메시지: str) -> bool:
    """투자 추천/어디에 투자할지 질문인지 판별"""
    키워드 = ["어디에투자", "어디에 투자", "투자추천", "투자 추천", "추천해줘", "추천해주", "뭐사", "뭐 살", "좋은종목"]
    m = 메시지.replace(" ", "").lower()
    return any(k.replace(" ", "") in m for k in 키워드)


def _보유_유지_질문인가(메시지: str) -> bool:
    """보유/유지 여부 질문인지 판별 (가지고 있는데, 유지할까 등)"""
    키워드 = ["가지고있", "가지고있는", "보유중", "보유중인", "유지", "계속가지", "계속가지고", "팔아야", "매도", "보관"]
    m = 메시지.replace(" ", "").lower()
    return any(k.replace(" ", "") in m for k in 키워드)


def _판단별_권고문(판단: str) -> str:
    """기술적 분석 판단에 따른 보유/유지 권고 문구"""
    권고 = {
        "매수 적합": "✅ **유지하세요.** 기술적 분석상 매수 적합 구간으로 보입니다.",
        "보류 (관망)": "🟡 **당분간 유지하되 추이를 지켜보세요.** 관망 구간입니다.",
        "매수 위험": "⚠️ **보유 중이라면 탈락 시점을 고려해 보세요.** 과열 구간일 수 있습니다.",
        "분석불가": "⚪ 데이터가 부족해 판단이 어렵습니다. 참고만 하세요.",
    }
    return 권고.get(판단, f"판단: {판단}")


def _ETF_구성종목_포함_질문인가(메시지: str) -> bool:
    """ETF 구성종목/포함 회사 질문인지 판별"""
    키워드 = [
        "어떤회사", "어떤 회사", "어떤회사가", "포함", "구성종목", "구성 종목",
        "뭐가 들어", "무엇이 들어", "들어있", "포함되어", "회사리스트", "회사 리스트",
        "리스트알려", "리스트 알려", "포함되어있는회사",
    ]
    m = 메시지.replace(" ", "").lower()
    return any(k.replace(" ", "") in m for k in 키워드)


def _ETF_구성종목_응답(티커: str, 종목명: str) -> str | None:
    """ETF 구성종목 목록을 보기 좋게 반환. ETF가 아니거나 데이터 없으면 None."""
    holdings = get_etf_holdings(티커)
    if not holdings:
        return None
    lines = [f"📋 **{종목명}** ({티커}) 구성종목\n"]
    for i, h in enumerate(holdings[:25], 1):
        lines.append(f"{i:2}. {h['종목명']:<20} {h['비중']:>6}%")
    if len(holdings) > 25:
        lines.append(f"... 외 {len(holdings) - 25}종")
    return "\n".join(lines)


def _종목_데이터_문자열(티커: str, 종목명: str) -> str:
    """종목 정보·차트 분석을 문자열로 반환 (AI 컨텍스트용)"""
    info = get_stock_info(티커)
    history_df = fetch_history(티커, "3mo")
    holdings = get_etf_holdings(티커)

    lines = [f"\n### {종목명} ({티커})"]
    if info:
        cur = info.get("current_price")
        prev = info.get("previous_close")
        currency = info.get("currency_label", "달러(USD)")
        if cur is not None:
            lines.append(f"- 현재가: {cur:,.2f} {currency}")
        if prev is not None:
            lines.append(f"- 전일 종가: {prev:,.2f} {currency}")
        if info.get("market_cap") is not None:
            cap = info["market_cap"]
            cap_str = f"{cap/1e9:.2f}B" if cap >= 1e9 else f"{cap:,.0f}"
            lines.append(f"- 시가총액: {cap_str} {currency}")
        if info.get("pe_ratio") is not None:
            lines.append(f"- PER: {info['pe_ratio']:.2f}")
        if info.get("sector"):
            lines.append(f"- 섹터: {info['sector']}")

    if history_df is not None and not history_df.empty:
        분석 = analyze_chart(history_df)
        lines.append(f"- 기술적 분석 판단: {분석['판단']} (위험도: {분석['위험도']}, 신뢰도: {분석.get('신뢰도', '-')})")
        lines.append("- 근거: " + "; ".join(분석.get("근거_쉬운설명", 분석.get("근거", []))[:3]))
        if 분석.get("전망"):
            lines.append("- 전망: " + " | ".join(분석["전망"][:2]))
        if 분석.get("지표"):
            지표_요약 = [f"{k}={v}" for k, v in 분석["지표"].items() if v is not None]
            lines.append("- 지표: " + ", ".join(지표_요약[:6]))

    if holdings:
        구성목록 = "\n  ".join([f"{i}. {h['종목명']} {h['비중']}%" for i, h in enumerate(holdings[:20], 1)])
        lines.append(f"- ETF 구성종목(비중순):\n  {구성목록}")

    return "\n".join(lines)


# API 키 없을 때 일반 용어 질문에 대한 간단 답변 (AI 대체)
_일반_용어_사전 = {
    "etf": "**ETF**(상장지수펀드)는 주식처럼 거래소에서 사고팔 수 있는 펀드예요. "
    "여러 주식을 한 번에 묶어서 하나의 상품처럼 거래합니다. "
    "예: KODEX 200, TIGER 미국나스닥100. 개별 주식보다 분산 투자에 유리해요.",
    "per": "**PER**(주가수익비율)은 주가를 1주당 순이익으로 나눈 값이에요. "
    "낮으면 상대적으로 저평가, 높으면 고평가로 볼 수 있지만 절대 기준은 아닙니다.",
    "rsi": "**RSI**(상대강도지수)는 0~100 지표예요. "
    "30 이하면 과매도(싸다고 봄), 70 이상이면 과매수(비싸다고 봄) 구간으로 해석합니다.",
    "코스피": "**코스피**는 한국 증시의 대표 지수예요. "
    "유가증권시장(메인보드)에 상장된 주요 종목들의 시세를 반영합니다.",
    "코스닥": "**코스닥**은 한국 성장주·벤처 시장 지수예요. "
    "코스피보다 중소·벤처 기업 비중이 높고 변동성이 클 수 있어요.",
    "시가총액": "**시가총액**은 (주가 × 발행주식수)로, 그 회사 전체의 시장 가치를 나타냅니다.",
    "배당": "**배당**은 회사가 이익의 일부를 주주에게 나눠 주는 거예요. "
    "배당 수익률은 (연 배당금 ÷ 주가)×100 으로 계산합니다.",
    "주식": "**주식**은 회사의 일부를 소유한다는 증권이에요. "
    "주가가 오르면 차익, 배당으로 수익을 얻을 수 있습니다.",
    "이동평균선": "**이동평균선**(MA)은 일정 기간 주가의 평균을 이어 그린 선이에요. "
    "5일선, 20일선, 60일선 등이 있고, 추세 파악에 쓰입니다.",
}

# K방산주 등 섹터별 대표 종목 (질문 시 목록 반환)
_섹터_종목_사전 = {
    "k방산주": [
        ("012450.KS", "한화에어로스페이스"),
        ("079550.KS", "LIG넥스원"),
        ("047810.KS", "KAI 한국항공우주"),
        ("064350.KS", "현대로템"),
    ],
    "방산주": [
        ("012450.KS", "한화에어로스페이스"),
        ("079550.KS", "LIG넥스원"),
        ("047810.KS", "KAI 한국항공우주"),
        ("064350.KS", "현대로템"),
    ],
    "방산": [
        ("012450.KS", "한화에어로스페이스"),
        ("079550.KS", "LIG넥스원"),
        ("047810.KS", "KAI 한국항공우주"),
        ("064350.KS", "현대로템"),
    ],
}


def _API키없이_종목정보_응답(종목목록: list[tuple[str, str]], 메시지: str = "") -> str:
    """API 키 없을 때 종목 데이터 또는 용어 사전으로 답변 생성 (AI 대체)"""
    if 종목목록:
        # ETF 구성종목 질문인 경우 → 구성종목 목록 우선 표시
        if _ETF_구성종목_포함_질문인가(메시지):
            for 종목명, 티커 in 종목목록[:1]:  # 첫 번째 종목만 (보통 하나만 물음)
                구성응답 = _ETF_구성종목_응답(티커, 종목명)
                if 구성응답:
                    return 구성응답 + "\n\n---\n※ AI가 풀어서 설명하려면 **OPENAI_API_KEY**를 설정해 주세요."

        # 보유/유지 질문인 경우 → 권고 문구를 맨 위에 표시
        권고_문구 = ""
        if _보유_유지_질문인가(메시지) and 종목목록:
            종목명, 티커 = 종목목록[0]
            history_df = fetch_history(티커, "3mo")
            if history_df is not None and not history_df.empty:
                분석 = analyze_chart(history_df)
                권고_문구 = _판단별_권고문(분석.get("판단", ""))
                if 분석.get("전망"):
                    권고_문구 += "\n\n**전망**: " + " ".join(분석["전망"][:2])
                권고_문구 += "\n\n"

        블록들 = []
        for 종목명, 티커 in 종목목록[:3]:
            블록 = _종목_데이터_문자열(티커, 종목명)
            블록들.append(블록)
        return (
            권고_문구
            + "📊 **실시간 조회 결과**\n\n"
            + "\n\n".join(블록들)
            + "\n\n---\n※ AI가 풀어서 설명하려면 **OPENAI_API_KEY**를 설정해 주세요."
        )

    # 투자 추천 질문 → 위험도 낮은(매수 적합) ETF 추천
    if _투자_추천_질문인가(메시지):
        추천목록 = get_recommended_etfs(limit=10)
        if 추천목록:
            lines = ["📌 **위험도 낮은 ETF 추천** (기술적 분석 기준 '매수 적합')\n"]
            for i, (티커, 이름) in enumerate(추천목록, 1):
                lines.append(f"{i}. {이름} ({티커}.KS)")
            lines.append("\n※ 위 종목을 검색창에 입력하면 상세 정보를 볼 수 있습니다.")
            lines.append("※ 참고용이며, 투자 판단은 본인 책임입니다.")
            return "\n".join(lines) + "\n\n---\n※ AI가 풀어서 설명하려면 **OPENAI_API_KEY**를 설정해 주세요."
        return (
            "현재 매수 적합으로 판단된 ETF가 없습니다. 시장 상황에 따라 달라질 수 있어요.\n\n"
            "종목명을 직접 입력해 보시거나, ? 를 입력하면 매수 적합 ETF 목록을 볼 수 있습니다.\n\n"
            "※ AI 답변을 쓰려면 **OPENAI_API_KEY**를 설정해 주세요."
        )

    # K방산주 등 섹터/테마 질문 → 해당 종목 목록 반환
    메시지_정규화 = 메시지.replace(" ", "").lower()
    for 섹터키, 종목목록 in _섹터_종목_사전.items():
        if 섹터키 in 메시지_정규화:
            제목 = "K방산주" if "방산" in 섹터키 else 섹터키
            lines = [f"📋 **{제목}** 대표 종목\n"]
            for i, (티커, 이름) in enumerate(종목목록, 1):
                lines.append(f"{i}. {이름} ({티커})")
            lines.append("\n※ 위 종목명을 검색창에 입력하면 상세 정보를 볼 수 있습니다.")
            return "\n".join(lines) + "\n\n---\n※ AI가 풀어서 설명하려면 **OPENAI_API_KEY**를 설정해 주세요."

    # 일반 용어 질문 → 사전에서 찾기
    for 키워드, 설명 in _일반_용어_사전.items():
        if 키워드 in 메시지_정규화:
            제목 = 키워드.upper() if len(키워드) <= 5 and 키워드.isascii() else 키워드
            return (
                f"📖 **{제목}**\n\n{설명}\n\n"
                "---\n※ 더 자세한 설명은 **OPENAI_API_KEY** 설정 후 AI에게 물어보세요."
            )

    return (
        "종목명(예: 삼성전자, 하이닉스)을 적어주시면 실시간 정보를 보여드립니다. "
        "또는 ETF, PER, RSI, 코스피 등 용어를 물어보세요.\n\n"
        "※ AI 답변을 쓰려면 **OPENAI_API_KEY**를 환경변수 또는 `.streamlit/secrets.toml`에 설정해 주세요."
    )
def get_stock_ai_response(
    user_message: str,
    chat_history: list[dict],
    api_key: Optional[str] = None,
) -> str:
    """
    사용자 메시지에 대해 주식 데이터를 반영한 AI 응답을 반환합니다.
    chat_history: [{"role": "user"|"assistant", "content": "..."}, ...]
    API 키 없으면 종목 언급 시 실시간 데이터만 표시.
    """
    api_key = api_key or os.environ.get("OPENAI_API_KEY")

    # 메시지에서 언급된 종목 추출
    종목목록 = _메시지에서_종목_추출(user_message)

    # API 키 없으면 종목 데이터만 표시 (AI 대체)
    if not api_key:
        return _API키없이_종목정보_응답(종목목록, user_message)

    # 종목 데이터 컨텍스트 수집
    컨텍스트_블록 = []
    for 종목명, 티커 in 종목목록[:3]:  # 최대 3종목
        블록 = _종목_데이터_문자열(티커, 종목명)
        컨텍스트_블록.append(블록)

    데이터_컨텍스트 = ""
    if 컨텍스트_블록:
        데이터_컨텍스트 = (
            "\n\n[아래는 실시간 조회된 주식 데이터입니다. 이 데이터를 바탕으로 한글로 답변해 주세요.]\n"
            + "\n".join(컨텍스트_블록)
        )
    elif _투자_추천_질문인가(user_message):
        추천목록 = get_recommended_etfs(limit=10)
        if 추천목록:
            추천_텍스트 = "\n".join([f"- {이름} ({티커}.KS)" for 티커, 이름 in 추천목록])
            데이터_컨텍스트 = (
                "\n\n[위험도 낮은 ETF (기술적 분석 '매수 적합' 기준):]\n"
                + 추천_텍스트
                + "\n\n[위 목록을 바탕으로 3~5종목을 추천하고, 참고용이며 투자 판단은 본인 책임임을 안내하세요.]"
            )

    보유질문_힌트 = ""
    if _보유_유지_질문인가(user_message) and 종목목록:
        보유질문_힌트 = "\n- '가지고 있는데 유지할까?' 같은 보유 질문이면, 기술적 분석 판단(매수 적합/보류/매수 위험)에 따라 '유지하세요', '당분간 유지하되 관망', '탈락 시점 고려' 등을 **첫 문장에서 명확히** 안내하세요."
    if _투자_추천_질문인가(user_message):
        추천목록 = get_recommended_etfs(limit=10)
        if 추천목록:
            추천_텍스트 = ", ".join([f"{n}({t}.KS)" for t, n in 추천목록[:5]])
            보유질문_힌트 += f"\n- '어디에 투자하면 좋을지 추천해줘' 같은 질문이면, 위험도 낮은(매수 적합) ETF를 추천하세요. 예: {추천_텍스트} 등. 참고용이며 투자 판단은 본인 책임임을 안내하세요."

    system_prompt = """당신은 친절한 주식 정보 AI 어시스턴트입니다.
- 사용자 질문에 실시간 주식 데이터가 제공되면 그 데이터를 활용해 답변합니다.
- 데이터가 없으면 일반적인 주식·투자 개념을 쉽게 설명합니다.
- 한글로 답변하고, 주린이도 이해할 수 있도록 쉽게 풀어 씁니다.
- 투자 권유·추천은 하지 않습니다. (참고용 정보만 제공)
- 답변은 2~5문장 정도로 간결하게 합니다.""" + 보유질문_힌트

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        messages = [
            {"role": "system", "content": system_prompt},
            *[
                {"role": m["role"], "content": m["content"]}
                for m in chat_history[-10:]  # 최근 10턴만
            ],
            {
                "role": "user",
                "content": user_message + 데이터_컨텍스트,
            },
        ]
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.5,
            max_tokens=800,
        )
        return response.choices[0].message.content or "응답을 생성하지 못했습니다."
    except Exception as e:
        return f"❌ AI 응답 오류: {str(e)}\n\n(API 키 확인, 네트워크 연결 확인)"