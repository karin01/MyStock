#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

# 현재 스크립트 위치로 이동
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

print("=" * 50)
print("🎉 라틴댄스 파티 서버 시작!")
print("=" * 50)
print(f"📁 현재 폴더: {os.getcwd()}")
print(f"📄 index.html 존재: {os.path.exists('index.html')}")
print("🌐 서버 주소: http://localhost:5000")
print("=" * 50)

PORT = 8888

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"🚀 서버가 포트 {PORT}에서 시작되었습니다...")
    print("⏹️  중지하려면 Ctrl+C를 누르세요")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 서버가 중지되었습니다.")
        sys.exit(0) 