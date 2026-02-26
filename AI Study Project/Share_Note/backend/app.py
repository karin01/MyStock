import os
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import datetime
import tempfile
import openai
import PyPDF2
import google.generativeai as genai
import hashlib
from functools import wraps
import secrets
import requests
# Google Gemini API 키를 직접 코드에 설정 (한글 주석)
genai.configure(api_key="AIzaSyCeLfdnl1LWzVOopu6Ab_sJYtr1bi-OKjk")

# 아래 코드는 테스트용이므로 주석 처리 (실서비스에서는 필요 없음)
# for m in genai.list_models():
#     print(m.name)

# .env 파일에서 환경변수 불러오기
load_dotenv()

app = Flask(__name__)
CORS(app)

# Firebase 서비스 계정 키 경로 (환경변수 또는 직접 입력)
FIREBASE_KEY_PATH = os.getenv('AIzaSyDS3rYUKOEH5qoO4V9E81Nl3JDFIxpRArA', 'firebase_config.json')
FIREBASE_STORAGE_BUCKET = os.getenv('FIREBASE_STORAGE_BUCKET', 'your-bucket-name.appspot.com')

try:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred, {
        'storageBucket': FIREBASE_STORAGE_BUCKET
    })
    db = firestore.client()
    bucket = storage.bucket()
except Exception as e:
    print('Firebase 초기화 실패:', e)
    db = None
    bucket = None

# 허용할 파일 확장자 목록
ALLOWED_EXTENSIONS = {'pdf', 'mp3', 'png', 'jpg', 'jpeg', 'gif'}

# 파일 확장자 체크 함수
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'sk-...')  # 실제 키는 .env에 입력
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')  # .env에 Gemini API 키 입력

openai.api_key = OPENAI_API_KEY

# 관리자 비밀번호(간단 예시, 실제 서비스는 환경변수로!)
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin1234')
ADMIN_TOKEN_SECRET = os.getenv('ADMIN_TOKEN_SECRET', 'supersecret')

# 관리자 인증 데코레이터
admin_tokens = set()
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': '인증 필요'}), 401
        token = auth.split(' ', 1)[1]
        if token not in admin_tokens:
            return jsonify({'error': '인증 실패'}), 403
        return f(*args, **kwargs)
    return decorated

@app.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    pw = data.get('password', '')
    if pw == ADMIN_PASSWORD:
        token = secrets.token_hex(24)
        admin_tokens.add(token)
        return jsonify({'token': token}), 200
    else:
        return jsonify({'error': '비밀번호가 틀렸습니다.'}), 403

@app.route('/admin/delete-all-notes', methods=['POST'])
@admin_required
def admin_delete_all_notes():
    try:
        notes = db.collection('notes').stream()
        count = 0
        for note in notes:
            data = note.to_dict()
            storage_path = data.get('storage_path')
            # Storage 파일 삭제
            if storage_path:
                try:
                    bucket.blob(storage_path).delete()
                except Exception:
                    pass
            # Firestore 문서 삭제
            note.reference.delete()
            count += 1
        return jsonify({'message': f'전체 노트 {count}개 삭제 완료'}), 200
    except Exception as e:
        return jsonify({'error': f'전체 삭제 오류: {str(e)}'}), 500

@app.route('/admin/reset-db', methods=['POST'])
@admin_required
def admin_reset_db():
    try:
        # notes 컬렉션 전체 삭제
        notes = db.collection('notes').stream()
        for note in notes:
            note.reference.delete()
        # 필요시 다른 컬렉션도 초기화 가능
        return jsonify({'message': 'DB 초기화 완료'}), 200
    except Exception as e:
        return jsonify({'error': f'DB 초기화 오류: {str(e)}'}), 500

@app.route('/admin/change-password', methods=['POST'])
@admin_required
def admin_change_password():
    data = request.get_json()
    new_pw = data.get('new_password', '')
    if not new_pw or len(new_pw) < 4:
        return jsonify({'error': '비밀번호는 4자 이상이어야 합니다.'}), 400
    # 환경변수 파일(.env) 또는 별도 저장소에 비밀번호를 저장하는 것이 안전하지만, 여기서는 메모리 변수로 예시 구현
    global ADMIN_PASSWORD
    ADMIN_PASSWORD = new_pw
    return jsonify({'message': '비밀번호가 성공적으로 변경되었습니다.'}), 200

@app.route('/admin/delete-note/<note_id>', methods=['DELETE'])
@admin_required
def admin_delete_note(note_id):
    try:
        note_ref = db.collection('notes').document(note_id)
        note = note_ref.get()
        if not note.exists:
            return jsonify({'error': '노트를 찾을 수 없습니다.'}), 404
        note_data = note.to_dict()
        storage_path = note_data.get('storage_path')
        # Storage에서 파일 삭제
        if storage_path:
            try:
                bucket.blob(storage_path).delete()
            except Exception:
                pass
        # Firestore에서 문서 삭제
        note_ref.delete()
        return jsonify({'message': '노트가 성공적으로 삭제되었습니다.'}), 200
    except Exception as e:
        return jsonify({'error': f'삭제 중 오류 발생: {str(e)}'}), 500

@app.route('/')
def index():
    # 프론트엔드 index.html을 반환 (한글 주석)
    return send_from_directory('../frontend', 'index.html')

@app.route('/upload', methods=['POST'])
def upload_note():
    # 파일, 제목, 태그 등 데이터 받기
    if 'file' not in request.files:
        return jsonify({'error': '파일이 첨부되지 않았습니다.'}), 400
    file = request.files['file']
    title = request.form.get('title', '')
    tags = request.form.get('tags', '')  # 콤마(,)로 구분된 태그 문자열
    uploader = request.form.get('uploader', '익명')
    delete_password = request.form.get('delete_password', '')
    if not delete_password:
        return jsonify({'error': '삭제 암호가 필요합니다.'}), 400
    # 암호 해시로 저장 (한글 주석)
    delete_password_hash = hashlib.sha256(delete_password.encode()).hexdigest()

    if file.filename == '':
        return jsonify({'error': '파일명이 비어 있습니다.'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': '허용되지 않는 파일 형식입니다.'}), 400

    # 파일명 안전하게 변환 (한글 주석)
    original_filename = file.filename
    filename = secure_filename(original_filename)
    # secure_filename이 한글 파일명에서 확장자를 날려버리는 경우를 보완 (한글 주석)
    if '.' not in filename and '.' in original_filename:
        ext = os.path.splitext(original_filename)[1]
        filename += ext
    # 업로드 경로(스토리지 내 폴더 구조, 한글 주석)
    now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    storage_path = f'notes/{uploader}_{now}_{filename}'

    try:
        # Firebase Storage에 파일 업로드 (한글 주석)
        blob = bucket.blob(storage_path)
        blob.upload_from_file(file, content_type=file.content_type)
        blob.make_public()  # 공개 URL 생성
        file_url = blob.public_url

        # Firestore에 메타데이터 저장 (한글 주석)
        note_data = {
            'title': title,
            'tags': [t.strip() for t in tags.split(',') if t.strip()],
            'uploader': uploader,
            'file_url': file_url,
            'filename': original_filename,  # 전체 파일명 저장
            'uploaded_at': datetime.datetime.now(),
            'storage_path': storage_path,
            'delete_password_hash': delete_password_hash  # 암호 해시 저장
        }
        db.collection('notes').add(note_data)
        return jsonify({'message': '노트 업로드 성공', 'file_url': file_url}), 200
    except Exception as e:
        return jsonify({'error': f'업로드 중 오류 발생: {str(e)}'}), 500

@app.route('/notes', methods=['GET'])
def list_notes():
    # 태그(복수 가능, 콤마로 구분)로 필터링
    tags = request.args.get('tags', '')
    tag_list = [t.strip() for t in tags.split(',') if t.strip()]
    try:
        notes_ref = db.collection('notes')
        if tag_list:
            # Firestore는 배열 필드에 대해 array_contains_any 지원
            notes_query = notes_ref.where('tags', 'array_contains_any', tag_list)
        else:
            notes_query = notes_ref
        # 최신순 정렬
        notes = notes_query.order_by('uploaded_at', direction='DESCENDING').stream()
        note_list = []
        for note in notes:
            data = note.to_dict()
            data['id'] = note.id
            # Firestore의 timestamp를 문자열로 변환
            if 'uploaded_at' in data:
                data['uploaded_at'] = str(data['uploaded_at'])
            note_list.append(data)
        return jsonify({'notes': note_list}), 200
    except Exception as e:
        return jsonify({'error': f'노트 목록 조회 중 오류 발생: {str(e)}'}), 500

@app.route('/download/<note_id>', methods=['GET'])
def download_note(note_id):
    # note_id로 Firestore에서 메타데이터 조회
    try:
        note_ref = db.collection('notes').document(note_id)
        note = note_ref.get()
        if not note.exists:
            return jsonify({'error': '노트를 찾을 수 없습니다.'}), 404
        note_data = note.to_dict()
        storage_path = note_data.get('storage_path')
        filename = note_data.get('filename', 'downloaded_file')
        # Storage에서 파일 다운로드
        blob = bucket.blob(storage_path)
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            blob.download_to_filename(temp_file.name)
            temp_file.flush()
            return send_file(temp_file.name, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': f'다운로드 중 오류 발생: {str(e)}'}), 500

@app.route('/delete/<note_id>', methods=['DELETE'])
def delete_note(note_id):
    # note_id로 Firestore 및 Storage에서 삭제
    try:
        note_ref = db.collection('notes').document(note_id)
        note = note_ref.get()
        if not note.exists:
            return jsonify({'error': '노트를 찾을 수 없습니다.'}), 404
        note_data = note.to_dict()
        storage_path = note_data.get('storage_path')
        # 암호 확인 (한글 주석)
        req_data = request.get_json()
        password = req_data.get('password', '') if req_data else ''
        if not password:
            return jsonify({'error': '삭제 암호를 입력하세요.'}), 400
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        if password_hash != note_data.get('delete_password_hash'):
            return jsonify({'error': '암호가 일치하지 않습니다.'}), 403
        # Storage에서 파일 삭제
        blob = bucket.blob(storage_path)
        blob.delete()
        # Firestore에서 문서 삭제
        note_ref.delete()
        return jsonify({'message': '노트가 성공적으로 삭제되었습니다.'}), 200
    except Exception as e:
        return jsonify({'error': f'삭제 중 오류 발생: {str(e)}'}), 500

@app.route('/generate-question', methods=['POST'])
def generate_question():
    # note_id를 받아서 해당 노트(PDF)에서 질문 생성
    data = request.get_json()
    note_id = data.get('note_id')
    if not note_id:
        return jsonify({'error': 'note_id가 필요합니다.'}), 400
    try:
        note_ref = db.collection('notes').document(note_id)
        note = note_ref.get()
        if not note.exists:
            return jsonify({'error': '노트를 찾을 수 없습니다.'}), 404
        note_data = note.to_dict()
        storage_path = note_data.get('storage_path')
        filename = note_data.get('filename', '')
        # PDF 파일만 지원
        if not filename.lower().endswith('.pdf'):
            return jsonify({'error': '현재는 PDF 파일만 지원합니다.'}), 400
        # Storage에서 PDF 다운로드
        blob = bucket.blob(storage_path)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            blob.download_to_filename(temp_file.name)
            temp_file.flush()
            # PDF에서 텍스트 추출
            with open(temp_file.name, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ''
                for page in reader.pages:
                    text += page.extract_text() or ''
        if not text.strip():
            return jsonify({'error': 'PDF에서 텍스트를 추출할 수 없습니다.'}), 400
        # Gemini API로 질문 생성 (한글 주석)
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"다음 학습 노트 내용을 바탕으로 5개의 퀴즈 문제(질문)와 정답을 만들어줘.\n\n{text[:1500]}"
        response = model.generate_content(prompt)
        result = response.text.strip()
        return jsonify({'questions': result}), 200
    except Exception as e:
        return jsonify({'error': f'질문 생성 중 오류 발생: {str(e)}'}), 500

# 로컬 LLM(OpenAI 호환)으로 요약 요청 함수 (한글 주석)
def summarize_with_local_llm(text):
    api_url = "http://localhost:11434/v1/chat/completions"  # Ollama/LM Studio 등 환경에 맞게 수정
    headers = {"Content-Type": "application/json"}
    data = {
        "model": "llama3",  # 사용 모델명에 맞게 수정
        "messages": [
            {"role": "system", "content": "아래 텍스트를 한글로 요약해줘."},
            {"role": "user", "content": text}
        ]
    }
    try:
        response = requests.post(api_url, headers=headers, json=data, timeout=120)
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return f"[요약 실패: {str(e)}]"

def get_available_gemini_model():
    try:
        models = [m for m in genai.list_models()]
        # 최신 권장 모델 우선순위
        for candidate in ['gemini-1.5-pro', 'gemini-1.5-flash']:
            for m in models:
                if m.name == candidate and 'generateContent' in getattr(m, 'supported_generation_methods', []):
                    return candidate
        # vision, 1.0 등 deprecated 모델 제외
        for m in models:
            if (
                'generateContent' in getattr(m, 'supported_generation_methods', [])
                and 'vision' not in m.name.lower()
                and '1.0' not in m.name.lower()
            ):
                return m.name
        return None
    except Exception as e:
        return None

def summarize_with_gemini(text):
    # Gemini API로 요약 (한글 주석)
    try:
        model_name = get_available_gemini_model()
        if not model_name:
            return '[Gemini 요약 실패: 사용 가능한 모델을 찾을 수 없습니다. 관리자에게 문의하세요.]'
        model = genai.GenerativeModel(model_name)
        prompt = f"아래 텍스트를 한글로 간결하게 요약해줘.\n\n{text[:4000]}"
        response = model.generate_content(prompt)
        return f"[모델: {model_name}]\n" + response.text
    except Exception as e:
        return f"[Gemini 요약 실패: {str(e)}]"

@app.route('/summarize-pdf', methods=['POST'])
def summarize_pdf():
    data = request.get_json()
    note_id = data.get('note_id')
    if not note_id:
        return jsonify({'error': 'note_id가 필요합니다.'}), 400
    try:
        note_ref = db.collection('notes').document(note_id)
        note = note_ref.get()
        if not note.exists:
            return jsonify({'error': '노트를 찾을 수 없습니다.'}), 404
        note_data = note.to_dict()
        storage_path = note_data.get('storage_path')
        # PDF 파일 다운로드 및 텍스트 추출 (한글 주석)
        blob = bucket.blob(storage_path)
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            blob.download_to_filename(temp_file.name)
            temp_file.flush()
            with open(temp_file.name, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = "\n".join(page.extract_text() or '' for page in reader.pages)
        if not text.strip():
            return jsonify({'error': 'PDF에서 텍스트를 추출할 수 없습니다.'}), 400
        # Gemini로 요약 요청
        summary = summarize_with_gemini(text)
        return jsonify({'summary': summary}), 200
    except Exception as e:
        return jsonify({'error': f'요약 중 오류 발생: {str(e)}'}), 500

@app.route('/<path:filename>')
def serve_static(filename):
    # 프론트엔드 폴더에서 정적 파일(css, js 등) 반환 (한글 주석)
    return send_from_directory('../frontend', filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 