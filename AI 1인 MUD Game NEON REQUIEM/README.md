# NEON REQUIEM 2087 — 받아서 플레이하기

이 폴더는 **AI 1인 MUD 게임** 클라이언트(프론트)와 선택용 Flask 백엔드가 들어 있습니다.  
아래 방법 중 하나로 **소스를 받은 뒤** PC에서 실행할 수 있습니다.

## 저장소에서 받기

| 방법 | 설명 |
|------|------|
| **Git 클론** | 저장소 전체를 받습니다. 게임 경로만 쓰면 됩니다. |
| **ZIP 다운로드** | GitHub에서 소스 ZIP을 받아 압축을 풉니다. |

- **저장소 주소:** `https://github.com/karin01/TEXT-Mud-Gane`
- **이 게임 폴더(저장소 안 경로):** `AI 1인 MUD Game NEON REQUIEM/`
- **ZIP으로 받기(브라우저):** [master 브랜치 ZIP](https://github.com/karin01/TEXT-Mud-Gane/archive/refs/heads/master.zip)  
  압축 해제 후 `MyStock-master` 등 상위 폴더 안에서 **`AI 1인 MUD Game NEON REQUIEM`** 폴더로 들어갑니다.

### Git으로 클론하는 경우

```bash
git clone https://github.com/karin01/TEXT-Mud-Gane.git
cd TEXT-Mud-Gane
cd "AI 1인 MUD Game NEON REQUIEM"
```

---

## 필요한 것

- **Node.js** (LTS 권장) — [https://nodejs.org/](https://nodejs.org/)
- **Python 3** — 백엔드(Flask)를 켤 때 필요합니다. [https://www.python.org/downloads/](https://www.python.org/downloads/)

터미널에서 다음으로 설치 여부를 확인할 수 있습니다.

```bash
node -v
npm -v
python --version
```

---

## Windows에서 가장 쉬운 실행

1. 위에서 받은 폴더에서 **`AI 1인 MUD Game NEON REQUIEM`** 까지 이동합니다.
2. **`게임시작.bat`** 을 더블클릭합니다.

스크립트가 **백엔드(Flask, 포트 5000)** 를 새 창에서 띄우고, **`frontend`** 에서 `npm install` 후 **`npm run dev`** 로 개발 서버(기본 포트 5173)를 띄웁니다.  
브라우저가 열리지 않으면 주소창에 `http://localhost:5173` 을 입력해 보세요.

PowerShell을 쓰는 경우: 같은 폴더에서 `.\게임시작.ps1` 실행.

---

## macOS / Linux (수동 실행)

`게임시작.bat`은 Windows 전용이므로, 터미널에서 순서대로 실행합니다.

**터미널 1 — 백엔드**

```bash
cd "AI 1인 MUD Game NEON REQUIEM/backend"
python3 -m venv venv
source venv/bin/activate   # Windows cmd: venv\Scripts\activate.bat
pip install -r requirements.txt
python app.py
```

**터미널 2 — 프론트**

```bash
cd "AI 1인 MUD Game NEON REQUIEM/frontend"
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

---

## 자세한 설명

- 내부 동작·주의사항: [`docs/게임시작-가이드.md`](docs/게임시작-가이드.md)

---

## 문제가 날 때

- Node/Python을 **방금 설치했다면** 터미널을 닫았다가 다시 열고 실행합니다.
- 포트 **5173** 또는 **5000**이 이미 쓰이 중이면 다른 프로그램을 종료하거나 Vite/Flask 설정에서 포트를 바꿉니다.
- 방화벽이 로컬 서버를 막는 경우 예외를 허용합니다.
