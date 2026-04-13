# 로또 6/45 확률 기반 번호 생성기

1회차부터의 **당첨 기록**을 가져와 번호별 **출현 확률**을 계산하고, 그 확률에 따라 6개 번호를 생성합니다.

## 구조

- **lotto_data.py** — 동행복권 API로 당첨 기록 수집, 로컬 `lotto_history.json` 캐시
- **lotto_probability.py** — 번호별 출현 횟수·확률 계산 (전체 회차 / 최근 N회 가중)
- **lotto_generator.py** — 확률 기반 6개 번호 생성 (중복 없음, 오름차순)
- **main.py** — CLI 진입점

## 설치

```bash
pip install -r requirements.txt
```

`requests`는 API로 당첨 기록을 받을 때만 필요합니다. 캐시 파일만 쓸 거면 생략 가능합니다.

## 사용법

### 1) 1등 당첨 기록 수집 (1회차~현재)

동행복권 API에서 **1등 당첨 번호**(본당첨 6개+보너스)를 회차별로 받아 `lotto_history.json`에 저장합니다.  
(접속 제한이 있으면 실패할 수 있습니다.)

```bash
python main.py fetch
```

### 2) 확률 통계 보기

저장된 당첨 기록으로 번호별 출현 횟수·확률을 봅니다.

```bash
# 전체 회차 기준
python main.py stats

# 최근 50회만 가중 확률
python main.py stats --recent 50
```

### 3) 확률 기반 번호 생성

계산된 확률로 6개 번호를 여러 세트 생성합니다.

```bash
# 기본 5세트, 전체 회차 확률
python main.py generate

# 10세트, 최근 100회 가중 확률
python main.py generate --count 10 --recent 100

# 시드 고정 (재현)
python main.py generate --count 5 --seed 42

# API 호출 없이 캐시만 사용
python main.py generate --no-api
```

## 데이터가 없을 때

- `lotto_history.json`이 없고 API도 실패하면, **lotto_history_sample.json** (1~5회차 샘플)을 사용해 동작을 확인할 수 있습니다.
- 실제 확률 반영이 필요하면 한 번은 `python main.py fetch`로 전체 회차를 받아 두는 것을 권장합니다.

## 주의

- 동행복권 API는 비공식이며, 접속 제한·변경 가능성이 있습니다.
- **과거 출현 확률이 미래 당첨을 보장하지 않습니다.** 재미와 참고용으로만 사용하세요.

## Git 기반 배포 (Render/Railway)

이 프로젝트는 Flask API 기반이라, 정적 페이지 전용 GitHub Pages만으로는 완전 동작하지 않습니다.  
그래서 **Git 저장소 연동 자동 배포**는 Render/Railway 방식이 가장 안정적입니다.

### 1) Render 배포 (권장)

이 폴더에는 이미 `render.yaml`이 포함되어 있어, 아래 순서로 바로 배포할 수 있습니다.

1. GitHub에 `SuperBall Lotto` 코드 푸시
2. Render에서 **New + > Blueprint** 선택
3. GitHub 저장소 연결 후 배포
4. 배포 완료 후 발급 URL 접속

배포 시 실행 명령은 내부적으로 다음과 같습니다.

```bash
gunicorn server:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120
```

### 2) Railway 배포

`Procfile`도 포함되어 있어 Railway에서도 Git 연결만 하면 자동으로 실행 명령을 인식합니다.

### 3) 왜 GitHub Pages 단독 배포가 어려운가?

현재 앱은 `/api/generate`, `/api/weekly_summary` 같은 서버 API가 필수입니다.  
GitHub Pages는 정적 파일만 호스팅하므로 Flask API를 직접 실행할 수 없습니다.

## [roeniss/dhlottery-api](https://github.com/roeniss/dhlottery-api) (dhapi)와의 관계

- **dhapi**는 동행복권 **비공식 API**로, **로또 구매·예치금 조회·가상계좌 설정** 등에 쓰입니다. (`pip install dhapi`)
- **당첨번호 조회**는 dhapi에 포함되어 있지 않습니다. 이 프로젝트는 동행복권 사이트에서 널리 쓰이는 **당첨번호 조회 URL**(`common.do?method=getLottoNumber&drwNo=회차`)을 직접 호출해 1회차~최신 회차를 수집합니다.
- 로또를 **구매**까지 하려면 dhapi와 계정 설정(`~/.dhapi/credentials`)을 사용하는 별도 도구가 필요합니다.
