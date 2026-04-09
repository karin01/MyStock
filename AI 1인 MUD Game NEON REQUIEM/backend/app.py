# NEON REQUIEM 2087 — Flask 서버 진입점
# WHY: 프론트엔드(Vite)에서 API 호출 시 CORS를 허용하고, 추후 게임 API 확장용으로 사용합니다.

from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Vite 개발 서버(localhost:5173) 및 프론트엔드 출처 허용
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])


@app.route("/")
def index():
    """서버 상태 확인용 루트"""
    return jsonify({"status": "ok", "game": "NEON REQUIEM 2087"})


@app.route("/health")
def health():
    """헬스 체크 (프론트엔드에서 서버 연동 여부 확인용)"""
    return jsonify({"ok": True})


if __name__ == "__main__":
    # 기본 포트 5000. Windows에서 사용 중이면 5001 등으로 변경 가능
    app.run(host="0.0.0.0", port=5000, debug=True)
