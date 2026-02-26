# -*- coding: utf-8 -*-
"""
차트 기술적 분석
- RSI, 이동평균선, MACD, 볼린저밴드, 추세·모멘텀
- 매수 적합/보류/위험 판단 + 전망·신뢰도 (참고용, 투자 권유 아님)
"""

import pandas as pd


def _calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """RSI(상대강도지수) 계산. 0~100, 70 이상 과매수, 30 이하 과매도."""
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, 1e-10)
    return 100 - (100 / (1 + rs))


def _calc_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple:
    """MACD, 시그널, 히스토그램 반환. (macd_line, signal_line, histogram)"""
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _calc_bollinger(series: pd.Series, period: int = 20, std_dev: float = 2.0) -> tuple:
    """볼린저밴드: (상단, 중간, 하단)"""
    middle = series.rolling(period).mean()
    std = series.rolling(period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    return upper, middle, lower


def analyze_chart(history_df: pd.DataFrame) -> dict:
    """
    차트 데이터를 정밀 분석해 매수 판단·전망·신뢰도 반환.
    ※ 참고용이며, 투자 판단은 본인 책임입니다.
    """
    if history_df is None or history_df.empty or "Close" not in history_df.columns:
        return {
            "판단": "분석불가", "위험도": "-", "신뢰도": "-",
            "전망": [], "근거": ["데이터 부족"], "근거_쉬운설명": ["차트 데이터가 없어 분석할 수 없습니다."],
            "지표": {}, "지표_쉬운설명": {},
        }

    df = history_df.copy()
    df = df.sort_index()
    close = df["Close"]
    volume = df["Volume"] if "Volume" in df.columns else None

    if len(close) < 5:
        return {
            "판단": "분석불가", "위험도": "-", "신뢰도": "-",
            "전망": [], "근거": ["데이터가 너무 적음 (5일 이상 필요)"],
            "근거_쉬운설명": ["거래일 5일치 이상 데이터가 있어야 분석할 수 있습니다."],
            "지표": {}, "지표_쉬운설명": {},
        }

    # === 기본 지표 ===
    ma5 = close.rolling(5).mean().iloc[-1] if len(close) >= 5 else None
    ma20 = close.rolling(20).mean().iloc[-1] if len(close) >= 20 else None
    ma60 = close.rolling(60).mean().iloc[-1] if len(close) >= 60 else None

    rsi_series = _calc_rsi(close, 14)
    rsi = float(rsi_series.iloc[-1]) if len(rsi_series.dropna()) > 0 else None

    현재가 = float(close.iloc[-1])
    최근고가 = float(close.tail(20).max()) if len(close) >= 20 else 현재가
    최근저가 = float(close.tail(20).min()) if len(close) >= 20 else 현재가
    고가대비 = ((최근고가 - 현재가) / 최근고가 * 100) if 최근고가 > 0 else 0
    저가대비 = ((현재가 - 최근저가) / 최근저가 * 100) if 최근저가 > 0 else 0

    # 5일·20일 변화율 (모멘텀)
    변화율_5일 = ((close.iloc[-1] / close.iloc[-6]) - 1) * 100 if len(close) >= 6 else None
    변화율_20일 = ((close.iloc[-1] / close.iloc[-21]) - 1) * 100 if len(close) >= 21 else None

    # 20일 추세
    if len(close) >= 20:
        최근5일평균 = close.tail(5).mean()
        이전15일평균 = close.tail(20).head(15).mean()
        추세상승 = 최근5일평균 > 이전15일평균
    else:
        추세상승 = close.iloc[-1] > close.iloc[0]

    # === MACD (26일 이상 필요) ===
    macd_val, signal_val, hist_val = None, None, None
    macd_골든크로스 = False
    macd_데드크로스 = False
    if len(close) >= 26:
        macd_line, sig_line, hist = _calc_macd(close)
        macd_val = float(macd_line.iloc[-1])
        signal_val = float(sig_line.iloc[-1])
        hist_val = float(hist.iloc[-1])
        if len(hist.dropna()) >= 2:
            이전_hist = float(hist.iloc[-2])
            if 이전_hist < 0 and hist_val > 0:
                macd_골든크로스 = True
            elif 이전_hist > 0 and hist_val < 0:
                macd_데드크로스 = True

    # === 볼린저밴드 (20일 이상) ===
    bb_상단, bb_중간, bb_하단 = None, None, None
    bb_위치 = None  # "상단근접", "중간", "하단근접"
    if len(close) >= 20:
        upper, mid, lower = _calc_bollinger(close, 20, 2.0)
        bb_상단 = float(upper.iloc[-1])
        bb_중간 = float(mid.iloc[-1])
        bb_하단 = float(lower.iloc[-1])
        밴드폭 = bb_상단 - bb_하단
        if 밴드폭 > 0:
            위치_pct = (현재가 - bb_하단) / 밴드폭 * 100
            if 위치_pct > 90:
                bb_위치 = "상단근접"
            elif 위치_pct < 10:
                bb_위치 = "하단근접"
            else:
                bb_위치 = "중간"

    # === 거래량 (5일 평균 대비) ===
    거래량_확대 = None
    if volume is not None and len(volume) >= 10:
        최근_vol = float(volume.iloc[-1])
        평균_vol = float(volume.tail(10).mean())
        if 평균_vol > 0:
            거래량_확대 = (최근_vol / 평균_vol - 1) * 100

    # === 지표 딕셔너리 ===
    지표 = {
        "현재가": round(현재가, 2),
        "RSI": round(rsi, 1) if rsi else None,
        "MA5": round(ma5, 2) if ma5 else None,
        "MA20": round(ma20, 2) if ma20 else None,
        "MA60": round(ma60, 2) if ma60 else None,
        "20일고가": round(최근고가, 2),
        "20일저가": round(최근저가, 2),
        "5일변화율(%)": round(변화율_5일, 2) if 변화율_5일 is not None else None,
        "20일변화율(%)": round(변화율_20일, 2) if 변화율_20일 is not None else None,
        "MACD": round(macd_val, 4) if macd_val is not None else None,
        "MACD시그널": round(signal_val, 4) if signal_val is not None else None,
        "볼린저상단": round(bb_상단, 2) if bb_상단 else None,
        "볼린저하단": round(bb_하단, 2) if bb_하단 else None,
    }
    지표_쉬운설명 = {
        "현재가": "지금 이 주식 한 주 값",
        "RSI": "0~100. 30 이하면 과매도(싸다), 70 이상이면 과매수(비싸다)",
        "MA5": "5일선(초단기 추세)",
        "MA20": "20일선(단기 추세)",
        "MA60": "60일선(중기 추세)",
        "5일변화율(%)": "최근 5일 가격 변동률",
        "20일변화율(%)": "최근 20일 가격 변동률",
        "MACD": "추세 전환 신호. 히스토그램이 +로 전환되면 상승 신호",
        "볼린저상단/하단": "가격 변동폭. 하단 근처면 저평가, 상단 근처면 고평가",
    }

    # === 점수화 (정밀) ===
    근거 = []
    근거_쉬운설명 = []
    점수 = 0.0
    긍정_지표수 = 0  # 매수 유리 신호
    부정_지표수 = 0  # 매도 유리 신호
    지표_총수 = 0

    # RSI (가중치 1.2)
    if rsi is not None:
        지표_총수 += 1
        if rsi < 25:
            근거.append(f"RSI {rsi:.1f} — 극단적 과매도 (25 미만)")
            근거_쉬운설명.append("📌 RSI가 25보다 낮음 → 많이 떨어진 상태. 반등 가능성 있으나 추가 하락도 주의.")
            점수 += 1.2
            긍정_지표수 += 1
        elif rsi < 30:
            근거.append(f"RSI {rsi:.1f} — 과매도 구간 (30 미만)")
            근거_쉬운설명.append("📌 RSI 30 미만 → 싸게 팔리는 구간. 매수 관점에서 유리할 수 있음.")
            점수 += 1.0
            긍정_지표수 += 1
        elif rsi > 75:
            근거.append(f"RSI {rsi:.1f} — 극단적 과매수 (75 초과)")
            근거_쉬운설명.append("📌 RSI 75 초과 → 많이 오른 상태. 조정(하락) 가능성 높음.")
            점수 -= 1.2
            부정_지표수 += 1
        elif rsi > 70:
            근거.append(f"RSI {rsi:.1f} — 과매수 구간 (70 초과)")
            근거_쉬운설명.append("📌 RSI 70 초과 → 비싸게 사고 있는 구간. 신규 매수는 위험.")
            점수 -= 1.0
            부정_지표수 += 1
        elif rsi < 45:
            근거.append(f"RSI {rsi:.1f} — 매수 관점 유리")
            근거_쉬운설명.append("📌 RSI 45 미만 → 아직 오르지 않은 구간. 매수 후보.")
            점수 += 0.5
            긍정_지표수 += 1
        elif rsi > 55:
            근거.append(f"RSI {rsi:.1f} — 매도 관점 유리")
            근거_쉬운설명.append("📌 RSI 55 초과 → 이미 오른 구간. 추가 상승은 제한적일 수 있음.")
            점수 -= 0.3
            부정_지표수 += 1
        else:
            근거.append(f"RSI {rsi:.1f} — 중립")

    # 이동평균선 (가중치 0.4~0.6)
    for ma, 이름, 가중치 in [(ma5, "5일선", 0.3), (ma20, "20일선", 0.5), (ma60, "60일선", 0.6)]:
        if ma is not None:
            지표_총수 += 1
            if 현재가 > ma:
                근거.append(f"현재가 > {이름} — 상승 추세")
                점수 += 가중치
                긍정_지표수 += 1
            else:
                근거.append(f"현재가 < {이름} — 하락 압력")
                점수 -= 가중치
                부정_지표수 += 1

    # MACD
    if hist_val is not None:
        지표_총수 += 1
        if macd_골든크로스:
            근거.append("MACD 골든크로스 — 상승 전환 신호")
            근거_쉬운설명.append("📌 MACD: 하락 추세에서 상승으로 전환되는 신호. 매수 관점 긍정적.")
            점수 += 0.8
            긍정_지표수 += 1
        elif macd_데드크로스:
            근거.append("MACD 데드크로스 — 하락 전환 신호")
            근거_쉬운설명.append("📌 MACD: 상승 추세에서 하락으로 전환되는 신호. 매도 관점.")
            점수 -= 0.8
            부정_지표수 += 1
        elif hist_val > 0:
            근거.append("MACD 히스토그램 양수 — 상승 모멘텀")
            점수 += 0.3
            긍정_지표수 += 1
        else:
            근거.append("MACD 히스토그램 음수 — 하락 모멘텀")
            점수 -= 0.3
            부정_지표수 += 1

    # 볼린저밴드
    if bb_위치:
        지표_총수 += 1
        if bb_위치 == "하단근접":
            근거.append("볼린저 하단 근접 — 저평가 구간")
            근거_쉬운설명.append("📌 볼린저: 가격이 하단 밴드 근처 → 평소보다 싼 구간. 반등 가능성.")
            점수 += 0.7
            긍정_지표수 += 1
        elif bb_위치 == "상단근접":
            근거.append("볼린저 상단 근접 — 고평가 구간")
            근거_쉬운설명.append("📌 볼린저: 가격이 상단 밴드 근처 → 평소보다 비싼 구간. 조정 주의.")
            점수 -= 0.7
            부정_지표수 += 1

    # 추세·모멘텀
    지표_총수 += 1
    if 추세상승:
        근거.append("단기 모멘텀 상승 (5일 > 15일 평균)")
        점수 += 0.5
        긍정_지표수 += 1
    else:
        근거.append("단기 모멘텀 하락 (5일 < 15일 평균)")
        점수 -= 0.5
        부정_지표수 += 1

    # 고점/저점 대비 (조정·반등 구간)
    if 고가대비 > 15:
        근거.append(f"20일 고점 대비 {고가대비:.1f}% 하락 — 깊은 조정, 반등 가능")
        점수 += 0.6
    elif 고가대비 > 8:
        근거.append(f"20일 고점 대비 {고가대비:.1f}% 하락 — 조정 구간")
        점수 += 0.4
    elif 저가대비 > 15:
        근거.append(f"20일 저점 대비 {저가대비:.1f}% 상승 — 고점 근접, 위험")
        점수 -= 0.6
    elif 저가대비 > 8:
        근거.append(f"20일 저점 대비 {저가대비:.1f}% 상승 — 상승 구간")
        점수 -= 0.4

    # 5일·20일 변화율
    if 변화율_5일 is not None and 변화율_5일 < -5:
        근거.append(f"5일간 {변화율_5일:.1f}% 하락 — 단기 과매도")
        점수 += 0.3
    elif 변화율_5일 is not None and 변화율_5일 > 10:
        근거.append(f"5일간 {변화율_5일:.1f}% 상승 — 단기 과열")
        점수 -= 0.3

    # 거래량
    if 거래량_확대 is not None and 거래량_확대 > 50:
        근거.append(f"거래량 10일 평균 대비 {거래량_확대:.0f}% 확대 — 관심 증가")
        if 점수 > 0:
            점수 += 0.2
        else:
            점수 -= 0.2

    # === 종합 판단 (정밀 기준) ===
    if 점수 >= 1.5:
        판단 = "매수 적합"
        위험도 = "낮음"
    elif 점수 >= 0.8:
        판단 = "매수 적합"
        위험도 = "낮음~중간"
    elif 점수 <= -1.5:
        판단 = "매수 위험"
        위험도 = "높음"
    elif 점수 <= -0.8:
        판단 = "매수 위험"
        위험도 = "중간~높음"
    else:
        판단 = "보류 (관망)"
        위험도 = "중간"

    # 신뢰도 (지표 방향 일치 비율: 판단과 같은 방향 지표 비율)
    if 지표_총수 > 0:
        if 점수 > 0.5:
            일치율 = 긍정_지표수 / 지표_총수 * 100
        elif 점수 < -0.5:
            일치율 = 부정_지표수 / 지표_총수 * 100
        else:
            일치율 = max(긍정_지표수, 부정_지표수) / 지표_총수 * 100
        if 일치율 >= 70:
            신뢰도 = "높음"
        elif 일치율 >= 50:
            신뢰도 = "보통"
        else:
            신뢰도 = "낮음"
    else:
        신뢰도 = "-"

    # === 전망 (시나리오 기반) ===
    전망 = []
    if 판단 == "매수 적합":
        전망.append(f"**단기 전망**: 기술적 지표 상 다수 긍정. 반등·상승 가능성 있음.")
        전망.append(f"**관심 구간**: 지지 {round(최근저가, 0):,.0f} / 저항 {round(최근고가, 0):,.0f}")
        if ma20:
            전망.append(f"**20일선**: {round(ma20, 0):,.0f} (이 선 유지 시 상승 추세 지속)")
        전망.append("**주의**: 20일 저가 이탈 시 추가 하락 가능. 손절선 참고.")
    elif 판단 == "매수 위험":
        전망.append(f"**단기 전망**: 과열·과매수 구간. 조정 가능성 있음.")
        전망.append(f"**관심 구간**: 지지 {round(ma20 or 최근저가, 0):,.0f} / 저항 {round(최근고가, 0):,.0f}")
        전망.append("**주의**: 신규 매수는 위험. 보유 시 20일선 이탈 시 매도 검토.")
    else:
        전망.append(f"**단기 전망**: 중립. 방향성 불확실. 관망 권장.")
        전망.append(f"**관심 구간**: 지지 {round(최근저가, 0):,.0f} / 저항 {round(최근고가, 0):,.0f}")
        전망.append("**참고**: RSI·MACD 등 전환 신호 나올 때까지 대기.")

    근거.append("※ 기술적 분석만 반영. 실적·뉴스·시장 상황은 미포함.")
    근거_쉬운설명.append("※ 위 분석은 차트(가격 흐름)만 본 것입니다. 회사 실적, 뉴스, 전체 시장은 따로 확인하세요.")

    return {
        "판단": 판단,
        "위험도": 위험도,
        "신뢰도": 신뢰도,
        "전망": 전망,
        "근거": 근거,
        "근거_쉬운설명": 근거_쉬운설명,
        "지표": 지표,
        "지표_쉬운설명": 지표_쉬운설명,
    }
