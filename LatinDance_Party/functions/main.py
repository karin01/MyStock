# Firebase Functions용 HTTP 함수들
from firebase_functions import https_fn
from firebase_admin import initialize_app, credentials, firestore
import os
import csv
import requests
import json

# Firebase Admin SDK 초기화
cred = credentials.Certificate("share-note-ef791-firebase-adminsdk-fbsvc-36ee9ed360.json")
initialize_app(cred)

# Firestore 클라이언트 생성
db = firestore.client()

# 1. 파티 등록
@https_fn.on_request()
def add_party(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        data = req.get_json()
        
        # posterUrl 필드 검증 (Base64 데이터 방지)
        if 'posterUrl' in data and data['posterUrl']:
            poster_url = data['posterUrl']
            # Base64 데이터인지 확인
            if poster_url.startswith('data:image'):
                return https_fn.Response(
                    json.dumps({
                        "result": "error", 
                        "message": "이미지는 Firebase Storage에 업로드 후 URL만 저장해야 합니다. Base64 데이터는 저장할 수 없습니다."
                    }),
                    status=400,
                    headers={'Content-Type': 'application/json'}
                )
            
            # URL 길이 체크 (1MB 제한)
            if len(poster_url.encode('utf-8')) > 1048487:
                return https_fn.Response(
                    json.dumps({
                        "result": "error", 
                        "message": "포스터 URL이 너무 깁니다. 이미지를 다시 업로드해주세요."
                    }),
                    status=400,
                    headers={'Content-Type': 'application/json'}
                )
        
        doc_ref = db.collection('parties').add(data)
        return https_fn.Response(
            json.dumps({"result": "success", "party_id": doc_ref[1].id}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 2. 파티 목록 조회 (필터: 지역, 날짜)
@https_fn.on_request()
def get_parties(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'GET':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        region = req.args.get('region')
        date = req.args.get('date')
        parties_ref = db.collection('parties')
        query = parties_ref
        if region:
            query = query.where('party-region', '==', region)
        if date:
            query = query.where('party-date', '==', date)
        docs = query.stream()
        parties = []
        for doc in docs:
            party = doc.to_dict()
            party['id'] = doc.id
            parties.append(party)
        return https_fn.Response(
            json.dumps({"result": "success", "parties": parties}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 3. 파티 상세 조회
@https_fn.on_request()
def get_party(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'GET':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        # URL에서 party_id 추출
        path_parts = req.path.split('/')
        party_id = path_parts[-1] if path_parts else None
        
        if not party_id:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "파티 ID가 필요합니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        doc = db.collection('parties').document(party_id).get()
        if doc.exists:
            party = doc.to_dict()
            party['id'] = doc.id
            return https_fn.Response(
                json.dumps({"result": "success", "party": party}),
                status=200,
                headers={'Content-Type': 'application/json'}
            )
        else:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "파티를 찾을 수 없습니다."}),
                status=404,
                headers={'Content-Type': 'application/json'}
            )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 4. 파티 정보 수정
@https_fn.on_request()
def update_party(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'PUT':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        # URL에서 party_id 추출
        path_parts = req.path.split('/')
        party_id = path_parts[-1] if path_parts else None
        
        if not party_id:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "파티 ID가 필요합니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        data = req.get_json()
        
        # posterUrl 필드 검증 (Base64 데이터 방지)
        if 'posterUrl' in data and data['posterUrl']:
            poster_url = data['posterUrl']
            # Base64 데이터인지 확인
            if poster_url.startswith('data:image'):
                return https_fn.Response(
                    json.dumps({
                        "result": "error", 
                        "message": "이미지는 Firebase Storage에 업로드 후 URL만 저장해야 합니다. Base64 데이터는 저장할 수 없습니다."
                    }),
                    status=400,
                    headers={'Content-Type': 'application/json'}
                )
            
            # URL 길이 체크 (1MB 제한)
            if len(poster_url.encode('utf-8')) > 1048487:
                return https_fn.Response(
                    json.dumps({
                        "result": "error", 
                        "message": "포스터 URL이 너무 깁니다. 이미지를 다시 업로드해주세요."
                    }),
                    status=400,
                    headers={'Content-Type': 'application/json'}
                )
        
        db.collection('parties').document(party_id).update(data)
        return https_fn.Response(
            json.dumps({"result": "success"}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 5. 파티 삭제
@https_fn.on_request()
def delete_party(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'DELETE':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        # URL에서 party_id 추출
        path_parts = req.path.split('/')
        party_id = path_parts[-1] if path_parts else None
        
        if not party_id:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "파티 ID가 필요합니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        db.collection('parties').document(party_id).delete()
        return https_fn.Response(
            json.dumps({"result": "success"}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 6. 파티별 댓글 등록
@https_fn.on_request()
def add_comment(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        # URL에서 party_id 추출
        path_parts = req.path.split('/')
        party_id = path_parts[-1] if path_parts else None
        
        if not party_id:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "파티 ID가 필요합니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        data = req.get_json()
        db.collection('parties').document(party_id).collection('comments').add(data)
        return https_fn.Response(
            json.dumps({"result": "success"}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 7. 파티별 댓글 목록 조회
@https_fn.on_request()
def get_comments(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'GET':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        # URL에서 party_id 추출
        path_parts = req.path.split('/')
        party_id = path_parts[-1] if path_parts else None
        
        if not party_id:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "파티 ID가 필요합니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        comments_ref = db.collection('parties').document(party_id).collection('comments')
        docs = comments_ref.stream()
        comments = []
        for doc in docs:
            comment = doc.to_dict()
            comment['id'] = doc.id
            comments.append(comment)
        return https_fn.Response(
            json.dumps({"result": "success", "comments": comments}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 8. 파티별 댓글 삭제
@https_fn.on_request()
def delete_comment(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'DELETE':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        # URL에서 party_id와 comment_id 추출
        path_parts = req.path.split('/')
        if len(path_parts) < 2:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "파티 ID와 댓글 ID가 필요합니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        party_id = path_parts[-2]
        comment_id = path_parts[-1]
        
        db.collection('parties').document(party_id).collection('comments').document(comment_id).delete()
        return https_fn.Response(
            json.dumps({"result": "success"}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 9. 새 빠 추가 (CSV 파일에 저장)
@https_fn.on_request()
def add_bar(req: https_fn.Request) -> https_fn.Response:
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    try:
        data = req.get_json()
        if not data:
            return https_fn.Response(
                json.dumps({"result": "error", "message": "데이터가 없습니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
            
        region = data.get('region', '')
        name = data.get('name', '')
        address = data.get('address', '')
        extra = data.get('extra', '')
        
        if not all([region, name, address]):
            return https_fn.Response(
                json.dumps({"result": "error", "message": "지역, 빠 이름, 주소는 필수입니다."}),
                status=400,
                headers={'Content-Type': 'application/json'}
            )
        
        # Firebase Functions에서는 파일 시스템 접근이 제한적이므로
        # Firestore에 저장하는 방식으로 변경
        bar_data = {
            'region': region,
            'name': name,
            'address': address,
            'extra': extra,
            'created_at': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('bars').add(bar_data)
        
        return https_fn.Response(
            json.dumps({"result": "success", "message": f"{name}이(가) 성공적으로 추가되었습니다."}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
        
    except Exception as e:
        return https_fn.Response(
            json.dumps({"result": "error", "message": str(e)}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )

# 구글 번역 API 키 (보안상 실제 서비스에서는 환경변수로 관리 권장)
GOOGLE_API_KEY = 'AIzaSyANAoSBtvO4yUBQi-ljSzK-d0IYSMSbACA'

# 번역 엔드포인트 추가
@https_fn.on_request()
def translate_text(req: https_fn.Request) -> https_fn.Response:
    """구글 번역 API를 이용해 텍스트를 번역하는 엔드포인트"""
    if req.method != 'POST':
        return https_fn.Response('Method not allowed', status=405)
    
    data = req.get_json()
    text = data.get('text')
    target = data.get('target', 'ko')
    if not text:
        return https_fn.Response(
            json.dumps({'error': 'No text provided'}),
            status=400,
            headers={'Content-Type': 'application/json'}
        )
    
    url = 'https://translation.googleapis.com/language/translate/v2'
    params = {
        'q': text,
        'target': target,
        'key': GOOGLE_API_KEY
    }
    response = requests.post(url, data=params)
    result = response.json()
    if 'data' in result and 'translations' in result['data']:
        translated = result['data']['translations'][0]['translatedText']
        return https_fn.Response(
            json.dumps({'translated': translated}),
            status=200,
            headers={'Content-Type': 'application/json'}
        )
    else:
        return https_fn.Response(
            json.dumps({'error': 'Translation failed', 'detail': result}),
            status=500,
            headers={'Content-Type': 'application/json'}
        ) 