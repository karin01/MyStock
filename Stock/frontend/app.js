const API_BASE = "http://localhost:8000/api";
let priceChartInstance = null;

// DOM Elements
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const periodSelect = document.getElementById('periodSelect');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultSection = document.getElementById('resultSection');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// Digital Clock
function updateClock() {
    const clock = document.getElementById('digital-clock');
    const now = new Date();
    clock.innerText = now.toLocaleString('ko-KR') + " (시뮬레이션 UI)";
}
setInterval(updateClock, 1000);
updateClock();

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.add('hidden'));

        // Add active class to clicked
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.remove('hidden');
    });
});

// Format helpers
function formatCurrency(val, currencyLabel) {
    if (val == null) return "—";
    if (currencyLabel && (currencyLabel.includes("원") || currencyLabel.includes("KRW"))) {
        return Math.round(val).toLocaleString('ko-KR') + "원";
    }
    return "$" + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function formatLargeValue(val, currencyLabel) {
    if (!val) return "—";
    if (val >= 1e9) {
        return (val / 1e9).toFixed(2) + "B " + currencyLabel;
    }
    return val.toLocaleString() + " " + currencyLabel;
}

function renderStockDetail(data) {
    var currency = (data.financials && data.financials.currency) || "USD";
    var curLabel = currency === "KRW" ? "원" : "USD";
    function fmtNum(v) { return v != null ? Number(v).toLocaleString() : "—"; }
    function fmtPct(v) { return v != null ? v + "%" : "—"; }
    function fmtBig(v) {
        if (v == null) return "—";
        var n = Number(v);
        if (n >= 1e12) return (n / 1e12).toFixed(2) + "조 " + curLabel;
        if (n >= 1e8) return (n / 1e8).toFixed(2) + "억 " + curLabel;
        if (n >= 1e6) return (n / 1e6).toFixed(2) + "M " + curLabel;
        if (n >= 1e3) return (n / 1e3).toFixed(2) + "K " + curLabel;
        return n.toLocaleString() + " " + curLabel;
    }
    var f = data.financials || {};
    var financialsHtml = "<div class=\"grid-3\" style=\"gap:0.75rem;\">" +
        "<div class=\"metric-card\"><span class=\"label\">매출(최근)</span><span class=\"value\">" + fmtBig(f.revenue) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">매출 성장률</span><span class=\"value\">" + fmtPct(f.revenue_growth) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">순이익(최근)</span><span class=\"value\">" + fmtBig(f.net_income) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">영업이익률</span><span class=\"value\">" + fmtPct(f.operating_margin) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">순이익률</span><span class=\"value\">" + fmtPct(f.profit_margin) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">ROE</span><span class=\"value\">" + fmtPct(f.roe) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">부채비율</span><span class=\"value\">" + fmtNum(f.debt_to_equity) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">유동비율</span><span class=\"value\">" + fmtNum(f.current_ratio) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">당좌비율</span><span class=\"value\">" + fmtNum(f.quick_ratio) + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">영업활동 현금흐름</span><span class=\"value\">" + fmtBig(f.free_cash_flow) + "</span></div>" +
        "</div>" + (f.note ? "<p style=\"font-size:0.85rem; color:var(--text-muted); margin-top:0.5rem;\">" + f.note + "</p>" : "");
    document.getElementById('detailFinancials').innerHTML = financialsHtml;

    var m = data.market_trend || {};
    var marketHtml = "<div class=\"grid-3\" style=\"gap:0.75rem;\">" +
        "<div class=\"metric-card\"><span class=\"label\">애널리스트 추천</span><span class=\"value\">" + (m.recommendation || "—") + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">목표가(평균)</span><span class=\"value\">" + (m.target_mean_price != null ? (currency === "KRW" ? m.target_mean_price.toLocaleString() + "원" : "$" + m.target_mean_price) : "—") + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">목표가 범위</span><span class=\"value\">" + (m.target_low != null && m.target_high != null ? (currency === "KRW" ? m.target_low.toLocaleString() + "~" + m.target_high.toLocaleString() + "원" : "$" + m.target_low + "~$" + m.target_high) : "—") + "</span></div>" +
        "<div class=\"metric-card\"><span class=\"label\">애널리스트 수</span><span class=\"value\">" + (m.num_analysts != null ? m.num_analysts + "명" : "—") + "</span></div>" +
        "</div>" + (m.note ? "<p style=\"font-size:0.85rem; color:var(--text-muted); margin-top:0.5rem;\">" + m.note + "</p>" : "");
    document.getElementById('detailMarketTrend').innerHTML = marketHtml;

    var o = data.industry_outlook || {};
    var industryHtml = "<p style=\"color:var(--text-muted); margin-bottom:0.5rem;\"><strong>섹터</strong> " + (o.sector || "—") + " &nbsp;|&nbsp; <strong>업종</strong> " + (o.industry || "—") + "</p>";
    if (o.summary) industryHtml += "<div style=\"background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:1rem; line-height:1.6; font-size:0.95rem; white-space:pre-wrap;\">" + escapeHtml(o.summary) + "</div>";
    else industryHtml += "<p style=\"color:var(--text-muted);\">해당 종목의 사업 요약 정보가 없습니다. (미국 주식 위주 제공)</p>";
    if (o.note) industryHtml += "<p style=\"font-size:0.85rem; color:var(--text-muted); margin-top:0.5rem;\">" + o.note + "</p>";
    document.getElementById('detailIndustryOutlook').innerHTML = industryHtml;
}
function escapeHtml(s) {
    if (!s) return "";
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Fetch Logic
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) {
        alert("종목명이나 티커를 입력해주세요.");
        return;
    }

    // UI Loading State
    loadingIndicator.classList.remove('hidden');
    resultSection.classList.add('hidden');
    searchBtn.disabled = true;

    try {
        // 1. Resolve Ticker (using parallel processing conceptual flow, though we await sequential due to dependency)
        const resolveRes = await fetch(`${API_BASE}/stock/resolve?query=${encodeURIComponent(query)}`);
        const resolveData = await resolveRes.json();
        const ticker = resolveData.ticker;

        // Fetch data in parallel to maximize speed
        const [infoRes, historyRes, newsRes, divRes, detailRes] = await Promise.all([
            fetch(`${API_BASE}/stock/info?ticker=${encodeURIComponent(ticker)}`),
            fetch(`${API_BASE}/stock/history?ticker=${encodeURIComponent(ticker)}&period=${periodSelect.value}`),
            fetch(`${API_BASE}/stock/news?ticker=${encodeURIComponent(ticker)}&limit=5`),
            fetch(`${API_BASE}/stock/dividend?ticker=${encodeURIComponent(ticker)}`),
            fetch(`${API_BASE}/stock/detail?ticker=${encodeURIComponent(ticker)}`)
        ]);

        const infoJson = await infoRes.json();
        const info = infoJson.data;

        if (!info) {
             alert("해당 종목을 찾을 수 없습니다.");
             return;
        }

        // --- Render Basic Info ---
        const cLabel = info.currency_label || "USD";
        document.getElementById('stockNameHeading').innerText = `${info.name || ticker} (${ticker})`;
        document.getElementById('basicPrice').innerText = formatCurrency(info.current_price, cLabel);
        document.getElementById('basicPrevPrice').innerText = formatCurrency(info.previous_close, cLabel);
        document.getElementById('basicPER').innerText = info.pe_ratio ? info.pe_ratio.toFixed(2) : "—";
        document.getElementById('basicMarketCap').innerText = formatLargeValue(info.market_cap, cLabel);
        document.getElementById('basicSector').innerText = `${info.sector || "N/A"} / ${info.industry || "N/A"}`;

        // --- Render News ---
        const newsJson = await newsRes.json();
        const newsListEl = document.getElementById('newsList');
        newsListEl.innerHTML = "";
        if (newsJson.data && newsJson.data.length > 0) {
            newsJson.data.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="${item.url}" target="_blank">${item.title}</a>`;
                newsListEl.appendChild(li);
            });
        } else {
            newsListEl.innerHTML = "<li>관련 뉴스가 없습니다.</li>";
        }

        // --- Render Dividend ---
        const divJson = await divRes.json();
        const divInfo = divJson.data || {};
        document.getElementById('divYield').innerText = divInfo.dividend_yield ? (divInfo.dividend_yield).toFixed(2) + "%" : "—";
        document.getElementById('divLast').innerText = divInfo.last_dividend ? `${divInfo.last_dividend.date} - ${divInfo.last_dividend.amount.toFixed(2)}` : "—";
        document.getElementById('divPayout').innerText = divInfo.payout_ratio ? (divInfo.payout_ratio * 100).toFixed(1) + "%" : "—";

        // --- Render 재무·시장·산업 ---
        const detailJson = await detailRes.json();
        if (detailJson.data) renderStockDetail(detailJson.data);

        // --- Render Chart ---
        const historyJson = await historyRes.json();
        const history = historyJson.data || [];
        
        if (priceChartInstance) {
            priceChartInstance.destroy();
        }

        if (history.length > 0) {
            const ctx = document.getElementById('priceChart').getContext('2d');
            const labels = history.map(item => item.date);
            const data = history.map(item => item.Close);

            priceChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '종가 (Close)',
                        data: data,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { display: true },
                        y: { display: true }
                    }
                }
            });
        } else {
            document.getElementById('tab-chart').innerHTML = "<p>차트 데이터가 없습니다.</p><canvas id='priceChart'></canvas>";
        }

        // Show UI
        resultSection.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert("데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
        loadingIndicator.classList.add('hidden');
        searchBtn.disabled = false;
    }
});

// Allow Enter key in search
searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// --- 거래순위 TOP50 ---
const top50Btn = document.getElementById('top50Btn');
const top50Section = document.getElementById('top50Section');
const top50TableBody = document.getElementById('top50TableBody');

function formatTop50Money(val) {
    if (val == null || isNaN(val)) return "—";
    var n = Number(val);
    if (n >= 1e8) return (n / 1e8).toFixed(2) + "억";
    if (n >= 1e4) return (n / 1e4).toFixed(1) + "만";
    return n.toLocaleString();
}

top50Btn.addEventListener('click', async () => {
    if (top50Section.classList.contains('hidden')) {
        top50TableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">불러오는 중...</td></tr>';
        top50Section.classList.remove('hidden');
        try {
            const [kospiRes, kosdaqRes] = await Promise.all([
                fetch(`${API_BASE}/market/top_traded?market=KOSPI&limit=25`),
                fetch(`${API_BASE}/market/top_traded?market=KOSDAQ&limit=25`)
            ]);
            const kospiJson = await kospiRes.json();
            const kosdaqJson = await kosdaqRes.json();
            if (!kospiRes.ok || !kosdaqRes.ok) {
                var errMsg = (kospiJson.detail || kosdaqJson.detail || "서버 오류") + "";
                top50TableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--loss);">' + escapeHtml(errMsg) + '</td></tr>';
                return;
            }
            const kospiList = kospiJson.data || [];
            const kosdaqList = kosdaqJson.data || [];
            var refDate = kospiJson.기준일 || kosdaqJson.기준일 || null;
            var criteriaEl = document.getElementById('top50Criteria');
            if (criteriaEl) {
                if (refDate) criteriaEl.innerHTML = '기준일: <strong>' + refDate + '</strong> (최근 영업일 종가·거래대금) — 종목을 클릭하면 하단에서 차트·정보를 조회합니다.';
                else criteriaEl.innerText = '종목을 클릭하면 하단에서 차트·정보를 조회합니다.';
            }
            var rows = [];
            kospiList.forEach(function(item, i) {
                rows.push({ rank: i + 1, market: "코스피", marketCode: "KOSPI", ticker: item.티커, name: item.종목명, close: item.종가, money: item.거래대금, pct: item.등락률 });
            });
            kosdaqList.forEach(function(item, i) {
                rows.push({ rank: i + 1, market: "코스닥", marketCode: "KOSDAQ", ticker: item.티커, name: item.종목명, close: item.종가, money: item.거래대금, pct: item.등락률 });
            });
            top50TableBody.innerHTML = "";
            if (rows.length === 0) {
                top50TableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">데이터가 없습니다. (비거래일이거나 KRX 연결을 확인해 주세요.)</td></tr>';
                return;
            }
            rows.forEach(function(r) {
                var tickerSuffix = r.marketCode === "KOSPI" ? ".KS" : ".KQ";
                var searchTicker = (r.ticker || "").trim();
                if (searchTicker && !searchTicker.endsWith(".KS") && !searchTicker.endsWith(".KQ")) searchTicker += tickerSuffix;
                var pctNum = r.pct != null ? Number(r.pct) : null;
                var pctClass = pctNum != null ? (pctNum >= 0 ? "profit" : "loss") : "";
                var pctStr = pctNum != null ? (pctNum >= 0 ? "+" : "") + pctNum.toFixed(2) + "%" : "—";
                var tr = document.createElement("tr");
                tr.setAttribute("data-ticker", searchTicker);
                tr.className = "top50-row";
                tr.innerHTML = "<td>" + r.rank + "</td><td>" + r.market + "</td><td class=\"top50-name\">" + escapeHtml(r.name || r.ticker) + "</td><td>" + (r.close != null ? Math.round(r.close).toLocaleString("ko-KR") + "원" : "—") + "</td><td>" + formatTop50Money(r.money) + "원</td><td class=\"" + pctClass + "\">" + pctStr + "</td>";
                top50TableBody.appendChild(tr);
            });
        } catch (e) {
            console.error("TOP50 load error", e);
            top50TableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--loss);">데이터를 불러오지 못했습니다.</td></tr>';
        }
    } else {
        top50Section.classList.add('hidden');
    }
});

top50TableBody.addEventListener('click', function(e) {
    var tr = e.target.closest('tr.top50-row');
    if (!tr) return;
    var ticker = tr.getAttribute('data-ticker');
    if (!ticker) return;
    searchInput.value = ticker;
    searchBtn.click();
});
async function fetchMarketOverview() {
    try {
        const res = await fetch(`${API_BASE}/market/overview`);
        const json = await res.json();
        const data = json.data || {};
        
        if (data["코스피"] && data["코스피"]["현재가"] !== undefined) {
            document.getElementById('kospiIndex').innerText = 
               `${data["코스피"]["현재가"].toLocaleString('ko-KR')} (${data["코스피"]["등락률"] > 0 ? '+':''}${data["코스피"]["등락률"].toFixed(2)}%)`;
        } else {
            document.getElementById('kospiIndex').innerText = "데이터 없음";
        }
        
        if (data["코스닥"] && data["코스닥"]["현재가"] !== undefined) {
            document.getElementById('kosdaqIndex').innerText = 
               `${data["코스닥"]["현재가"].toLocaleString('ko-KR')} (${data["코스닥"]["등락률"] > 0 ? '+':''}${data["코스닥"]["등락률"].toFixed(2)}%)`;
        } else {
            document.getElementById('kosdaqIndex').innerText = "데이터 없음";
        }
        
        if (data["환율"] && data["환율"]["현재가"] !== undefined) {
            document.getElementById('exchangeRate').innerText = 
               `${data["환율"]["현재가"].toLocaleString('ko-KR')}원 (${data["환율"]["등락률"] > 0 ? '+':''}${data["환율"]["등락률"].toFixed(2)}%)`;
        } else {
            document.getElementById('exchangeRate').innerText = "데이터 없음";
        }
    } catch (e) {
        console.error("Market Overview Error", e);
    }
}
window.addEventListener('DOMContentLoaded', () => {
    fetchMarketOverview();
    setInterval(fetchMarketOverview, 10000); // 10초마다 시장 지표 자동 갱신
});

// --- Auth & Portfolio ---
let currentUser = null;
let portfolioInterval = null; // 포트폴리오 실시간 갱신 타이머

const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authActions = document.getElementById('authActions');
const loggedInActions = document.getElementById('loggedInActions');
const portfolioContent = document.getElementById('portfolioContent');
const portfolioTableBody = document.getElementById('portfolioTableBody');

// 종목명 클릭 시 하단 검색창에 티커 넣고 자동 조회
portfolioTableBody.addEventListener('click', function(e) {
    var tr = e.target.closest('tr');
    if (!tr || !tr.getAttribute('data-ticker')) return;
    var firstTd = tr.querySelector('td:first-child');
    if (!firstTd || !firstTd.contains(e.target)) return;
    var ticker = tr.getAttribute('data-ticker').trim();
    if (!ticker) return;
    searchInput.value = ticker;
    searchBtn.click();
});

loginBtn.addEventListener('click', async () => {
    const user = document.getElementById('loginUsername').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();
    if (!user || !pass) return alert("아이디와 비밀번호를 입력해주세요");

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const json = await res.json();
        
        if (res.ok && json.status === "success") {
            currentUser = json.user_id;
            authActions.classList.add('hidden');
            loggedInActions.classList.remove('hidden');
            document.getElementById('loggedInUser').innerText = `${currentUser}님`;
            portfolioContent.classList.remove('hidden');
            loadPortfolio();
            // 실시간 갱신 폴링(5초 단위) 시작
            if (portfolioInterval) clearInterval(portfolioInterval);
            portfolioInterval = setInterval(updatePortfolioRealtime, 5000);
        } else {
            alert(json.detail || "로그인 실패");
        }
    } catch(e) {
        alert("로그인 에러");
    }
});

registerBtn.addEventListener('click', async () => {
    const user = document.getElementById('loginUsername').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();
    if (!user || !pass) return alert("아이디와 비밀번호를 입력해주세요");

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const json = await res.json();
        
        if (res.ok && json.status === "success") {
            alert("회원가입에 성공했습니다! 이제 로그인 버튼을 눌러주세요.");
        } else {
            alert(json.detail || "회원가입 실패");
        }
    } catch(e) {
        alert("회원가입 에러");
    }
});

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    if (portfolioInterval) {
        clearInterval(portfolioInterval);
        portfolioInterval = null;
    }
    authActions.classList.remove('hidden');
    loggedInActions.classList.add('hidden');
    portfolioContent.classList.add('hidden');
    document.getElementById('loginPassword').value = '';
});

function formatCurrency(value, currency) {
    if (value === undefined || value === null || isNaN(value)) return '—';
    // API는 currency_label로 "달러(USD)", "원(KRW)" 전달. 없거나 원이면 원화로 표시
    var isUsd = false;
    if (typeof currency === 'string' && currency) {
        isUsd = (currency === 'USD' || currency.indexOf('USD') !== -1 || currency.indexOf('달러') !== -1);
    }
    if (isUsd) {
        return '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' (USD)';
    }
    return Math.round(value).toLocaleString('ko-KR') + '원 (KRW)';
}

// 티커만 보고 미국 주식 여부 판별 (API 통화 값 없을 때 폴백)
function isUsTicker(ticker) {
    if (!ticker || typeof ticker !== 'string') return false;
    var t = ticker.toUpperCase().trim();
    if (t.endsWith('.KS') || t.endsWith('.KQ')) return false;
    if (t.length === 6 && /^\d{6}$/.test(t)) return false; // 한국 6자리
    return true;
}

async function loadPortfolio() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/portfolio?user_id=${currentUser}`);
        const json = await res.json();
        const holdings = json.data || [];
        
        portfolioTableBody.innerHTML = '';
        
        const summaryDiv = document.getElementById('portfolioSummary');
        const summaryTotalValue = document.getElementById('summaryTotalValue');
        const summaryTotalCost = document.getElementById('summaryTotalCost');
        const summaryTotalProfit = document.getElementById('summaryTotalProfit');

        if (holdings.length === 0) {
            summaryDiv.classList.add('hidden');
            portfolioTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1rem;">등록된 종목이 없습니다.</td></tr>';
            return;
        }

        let totalCostAcc = 0;
        let totalProfitAcc = 0;

        holdings.forEach(h => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid var(--border)";
            tr.setAttribute('data-ticker', (h.ticker || '').replace(/"/g, ''));
            
            if (h.total_cost !== undefined && h.total_cost !== null) totalCostAcc += h.total_cost;
            if (h.profit_loss !== undefined && h.profit_loss !== null) totalProfitAcc += h.profit_loss;

            const isProfit = h.profit_loss >= 0;
            const colorVar = isProfit ? 'var(--profit)' : 'var(--loss)';
            const plInner = h.profit_loss !== null ? `<span style="color:${colorVar}; font-weight: 700;">${isProfit ? '+' : ''}${formatCurrency(h.profit_loss, 'KRW')} <span style="font-size:0.85em;">(${h.profit_loss_pct > 0 ? '+':''}${h.profit_loss_pct.toFixed(2)}%)</span></span>` : "—";
            const displayName = h.name && h.name !== h.ticker ? `${h.name} <br><span style="font-size:0.85em; color:var(--text-muted);">${h.ticker}</span>` : h.ticker;
            // 현재가 통화: API currency_label 사용, 없으면 티커로 미국 주식 여부 판별
            var currentPriceCurrency = h.currency_label || (isUsTicker(h.ticker) ? '달러(USD)' : '원(KRW)');
            tr.innerHTML = `
                <td class="ticker-cell" style="padding: 0.8rem; cursor: pointer;" title="클릭하면 하단에서 종목 정보 조회">${displayName}</td>
                <td style="padding: 0.8rem;">${h.quantity}</td>
                <td style="padding: 0.8rem; color: var(--text-muted);">${formatCurrency(h.avg_purchase_price, '원(KRW)')}</td>
                <td id="price-${h.ids[0]}" style="padding: 0.8rem; font-weight: 700; color: var(--text-main);">${formatCurrency(h.current_price, currentPriceCurrency)}</td>
                <td id="pl-${h.ids[0]}" style="padding: 0.8rem;">${plInner}</td>
                <td style="padding: 0.8rem;"><button onclick="deletePortfolio('${h.ids ? h.ids[0] : ''}')" style="color:var(--loss); border:none; background:none; cursor:pointer; font-weight: bold;">X</button></td>
            `;
            portfolioTableBody.appendChild(tr);
        });

        // Update Summary Cards
        summaryDiv.classList.remove('hidden');
        const totalValue = totalCostAcc + totalProfitAcc;
        const totalPct = totalCostAcc > 0 ? (totalProfitAcc / totalCostAcc) * 100 : 0;

        summaryTotalValue.innerText = `${Math.round(totalValue).toLocaleString()}원`;
        summaryTotalCost.innerText = `${Math.round(totalCostAcc).toLocaleString()}원`;
        
        if (totalCostAcc > 0) {
            summaryTotalProfit.innerHTML = `${totalProfitAcc > 0 ? '+' : ''}${Math.round(totalProfitAcc).toLocaleString()}원 <span style="font-size: 0.9em;">(${totalPct > 0 ? '+':''}${totalPct.toFixed(2)}%)</span>`;
            summaryTotalProfit.className = `value ${totalProfitAcc >= 0 ? 'profit' : 'loss'}`;
        } else {
            summaryTotalProfit.innerText = "—";
            summaryTotalProfit.className = "value";
        }

    } catch (e) {
        console.error("Portfolio Load Error", e);
    }
}

// 실시간 포트폴리오 테이블 갱신 전용 함수 (DOM 재조립 없이 숫자만 변경)
async function updatePortfolioRealtime() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_BASE}/portfolio?user_id=${currentUser}`);
        const json = await res.json();
        const holdings = json.data || [];
        
        let totalCostAcc = 0;
        let totalProfitAcc = 0;

        holdings.forEach(h => {
             if (h.total_cost !== undefined && h.total_cost !== null) totalCostAcc += h.total_cost;
             if (h.profit_loss !== undefined && h.profit_loss !== null) totalProfitAcc += h.profit_loss;

             // DOM 업데이트 (현재가 및 손익)
             const priceEl = document.getElementById(`price-${h.ids[0]}`);
             if (priceEl) {
                 var currentPriceCurrency = h.currency_label || (isUsTicker(h.ticker) ? '달러(USD)' : '원(KRW)');
                 priceEl.innerText = formatCurrency(h.current_price, currentPriceCurrency);
             }

             const plEl = document.getElementById(`pl-${h.ids[0]}`);
             if (plEl) {
                 const isProfit = h.profit_loss >= 0;
                 const colorVar = isProfit ? 'var(--profit)' : 'var(--loss)';
                 const plInner = h.profit_loss !== null ? `<span style="color:${colorVar}; font-weight: 700;">${isProfit ? '+' : ''}${formatCurrency(h.profit_loss, 'KRW')} <span style="font-size:0.85em;">(${h.profit_loss_pct > 0 ? '+':''}${h.profit_loss_pct.toFixed(2)}%)</span></span>` : "—";
                 plEl.innerHTML = plInner;
             }
        });

        // 요약 카드 업데이트 (DOM 덮어씌움)
        const totalValue = totalCostAcc + totalProfitAcc;
        const totalPct = totalCostAcc > 0 ? (totalProfitAcc / totalCostAcc) * 100 : 0;
        
        const summaryTotalValue = document.getElementById('summaryTotalValue');
        const summaryTotalCost = document.getElementById('summaryTotalCost');
        const summaryTotalProfit = document.getElementById('summaryTotalProfit');
        
        if (summaryTotalValue) summaryTotalValue.innerText = `${Math.round(totalValue).toLocaleString()}원`;
        if (summaryTotalCost) summaryTotalCost.innerText = `${Math.round(totalCostAcc).toLocaleString()}원`;
        
        if (summaryTotalProfit) {
            if (totalCostAcc > 0) {
                summaryTotalProfit.innerHTML = `${totalProfitAcc > 0 ? '+' : ''}${Math.round(totalProfitAcc).toLocaleString()}원 <span style="font-size: 0.9em;">(${totalPct > 0 ? '+':''}${totalPct.toFixed(2)}%)</span>`;
                summaryTotalProfit.className = `value ${totalProfitAcc >= 0 ? 'profit' : 'loss'}`;
            } else {
                summaryTotalProfit.innerText = "—";
                summaryTotalProfit.className = "value";
            }
        }
    } catch(e) {
        // 백그라운드 폴링 중 실패해도 사용자 경험을 해치지 않게 조용히 에러 기록
        console.warn("Realtime Portfolio Update Warning", e);
    }
}

document.getElementById('addPortBtn').addEventListener('click', async () => {
    if (!currentUser) return;
    const ticker = document.getElementById('portTicker').value.trim();
    const qty = parseFloat(document.getElementById('portQty').value);
    const price = parseFloat(document.getElementById('portPrice').value);
    
    if (!ticker || !qty || !price) return alert("입력값을 확인하세요.");

    try {
        const res = await fetch(`${API_BASE}/portfolio`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: currentUser,
                ticker: ticker,
                quantity: qty,
                purchase_price: price,
                memo: ""
            })
        });
        if (res.ok) {
            alert("추가되었습니다.");
            loadPortfolio();
        } else {
            alert("추가 실패");
        }
    } catch (e) {
        alert("에러 발생");
    }
});

window.deletePortfolio = async function(pid) {
    if (!currentUser || !confirm("삭제하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_BASE}/portfolio/${currentUser}/${pid}`, { method: 'DELETE' });
        if (res.ok) loadPortfolio();
    } catch(e) {}
};

// --- AI Chatbot ---
const chatContainer = document.getElementById('aiChatbotContainer');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatHeader = document.getElementById('chatHeader');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const quickBtns = document.querySelectorAll('.quick-btn');

let chatHistory = [];

chatHeader.addEventListener('click', (e) => {
    if (e.target === chatInput || e.target === chatSendBtn || e.target.classList.contains('quick-btn')) return;
    chatContainer.classList.toggle('closed');
});

function formatChatText(text) {
    let html = text.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return html;
}

function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = formatChatText(content);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage(text) {
    if (!text) return;
    
    appendMessage('user', text);
    chatInput.value = '';
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant loading';
    loadingDiv.innerText = 'AI가 분석 중입니다...';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        const res = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                message: text,
                history: chatHistory
            })
        });
        
        chatMessages.removeChild(loadingDiv);
        
        const json = await res.json();
        if (res.ok && json.status === "success") {
            appendMessage('assistant', json.reply);
            chatHistory.push({role: "user", content: text});
            chatHistory.push({role: "assistant", content: json.reply});
            
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
        } else {
            appendMessage('assistant', '오류가 발생했습니다: ' + (json.detail || '알 수 없는 오류'));
        }
    } catch (e) {
        if(chatMessages.contains(loadingDiv)) chatMessages.removeChild(loadingDiv);
        appendMessage('assistant', '네트워크 오류가 발생했습니다.');
    }
}

chatSendBtn.addEventListener('click', () => sendMessage(chatInput.value.trim()));
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage(chatInput.value.trim());
});

quickBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (chatContainer.classList.contains('closed')) {
            chatContainer.classList.remove('closed');
        }
        sendMessage(btn.getAttribute('data-query'));
    });
});
