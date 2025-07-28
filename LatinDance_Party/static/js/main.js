// Firebase 설정 및 초기화
let db, storage, auth;
let currentUser = null;
let editingPartyId = null;
let appInitialized = false;

// 유튜브 영상 관리 기능
let youtubeVideos = [];

// 카카오톡 공유 기능
let kakaoInitialized = false;

// 햄버거 메뉴 토글 함수
function toggleHamburgerMenu() {
    const dropdown = document.getElementById('hamburger-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// 전화번호 마스킹 함수 (개인정보 보호)
function maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    
    // 하이픈 제거
    const cleanNumber = phoneNumber.replace(/-/g, '');
    
    // 11자리 전화번호인 경우 (01012345678)
    if (cleanNumber.length === 11 && cleanNumber.startsWith('01')) {
        return cleanNumber.substring(0, 3) + 'xxxx' + cleanNumber.substring(7);
    }
    
    // 10자리 전화번호인 경우 (0101234567)
    if (cleanNumber.length === 10 && cleanNumber.startsWith('01')) {
        return cleanNumber.substring(0, 3) + 'xxx' + cleanNumber.substring(6);
    }
    
    // 기타 형식은 그대로 반환
    return phoneNumber;
}

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    if (appInitialized) {
        console.log('앱이 이미 초기화되어 있습니다.');
        return;
    }
    
    console.log('DOM 로드됨 - 파티 앱 초기화 시작');
    appInitialized = true;
    
    // 지연된 초기화 (Firebase SDK 로드 대기)
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// 안전한 Firebase 초기화
// Firebase 초기화는 firebase-config.js에서 처리됩니다.

// 앱 초기화
async function initializeApp() {
    try {
        console.log('=== 앱 초기화 시작 ===');
        
        // 타임아웃 설정 (30초)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('앱 초기화 타임아웃 (30초)')), 30000);
        });
        
        const initPromise = async () => {
            // Firebase 초기화 (firebase-config.js 사용)
            if (typeof initializeFirebase === 'function') {
                console.log('firebase-config.js의 initializeFirebase 호출...');
                const firebaseInitialized = initializeFirebase();
                if (!firebaseInitialized) {
                    throw new Error('Firebase 초기화에 실패했습니다.');
                }
            } else {
                throw new Error('firebase-config.js의 initializeFirebase 함수를 찾을 수 없습니다.');
            }
            
            // Firebase 서비스 가져오기
            if (window.db && window.auth && window.storage) {
                db = window.db;
                auth = window.auth;
                storage = window.storage;
                console.log('Firebase 서비스 가져오기 완료');
            } else {
                throw new Error('Firebase 서비스를 가져올 수 없습니다.');
            }
            
            // 페이지 로드 시 기존 모달들 정리
            closeLoginModal();
            
            // 초기 상태 설정 - 등록 폼 비활성화
            const partyRegistration = document.getElementById('party-registration');
            const partyForm = document.getElementById('party-form');
            if (partyRegistration) {
                partyRegistration.classList.add('disabled');
            }
            if (partyForm) {
                partyForm.classList.add('disabled');
            }
            
            // 초기 상태 - 관리자 모드 버튼 숨김
            const adminBtn = document.querySelector('.admin-btn');
            if (adminBtn) {
                adminBtn.style.display = 'none';
            }
            
            console.log('초기 상태: 등록 폼 비활성화됨, 관리자 버튼 숨김');
            
            // 이벤트 리스너 등록
            setupEventListeners();
            
            // 인증 상태 확인 (비동기)
            console.log('인증 상태 확인 시작...');
            checkAuthState();
            
            // 초기 데이터 로드 (비동기)
            console.log('파티 목록 로드 시작...');
            await loadParties();
            
            // 파티 데이터 로드 완료 후 URL 파라미터 확인
            console.log('파티 데이터 로드 완료, URL 파라미터 확인 시작');
            checkUrlParameters();
            
            // URL 변경 감지 (브라우저 뒤로가기/앞으로가기 등)
            window.addEventListener('popstate', function() {
                console.log('URL 변경 감지됨 (popstate), 파라미터 재확인');
                setTimeout(() => {
                    checkUrlParameters();
                }, 100);
            });
            
            // 초기 URL 파라미터 확인 (페이지 로드 시)
            if (window.location.pathname.includes('/party/') || window.location.search.includes('party=')) {
                console.log('초기 URL에 파티 파라미터 발견, 즉시 처리');
                setTimeout(() => {
                    checkUrlParameters();
                }, 500);
            }
            
            // 유튜브 섹션 초기화 (비동기)
            console.log('유튜브 섹션 초기화 시작...');
            await initializeYouTubeSection();
            
            // 상단 이동 버튼 초기화
            setupScrollToTopButton();
            
            // 카카오톡 SDK 초기화
            initializeKakaoShare();
            
            console.log('=== 앱 초기화 완료 ===');
        };
        
        // 타임아웃과 함께 실행
        await Promise.race([initPromise(), timeoutPromise]);
        
    } catch (error) {
        console.error('앱 초기화 중 오류:', error);
        showMessage('앱 초기화 중 오류가 발생했습니다: ' + error.message, 'error');
        
        // 부분적 초기화 시도
        try {
            console.log('부분적 초기화 시도...');
            setupEventListeners();
            checkAuthState();
            console.log('부분적 초기화 완료');
        } catch (partialError) {
            console.error('부분적 초기화도 실패:', partialError);
        }
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    console.log('이벤트 리스너 설정 중...');
    
    // 파티 등록 폼
    const partyForm = document.getElementById('party-form');
    if (partyForm) {
        partyForm.addEventListener('submit', handlePartySubmit);
        console.log('파티 폼 이벤트 리스너 등록됨');
    }
    
    // 로그인 버튼은 updateLoginUI에서 관리하므로 여기서는 제거
    
    // 필터 이벤트
    const regionFilter = document.getElementById('region-filter');
    if (regionFilter) {
        regionFilter.addEventListener('change', filterParties);
    }
    
    const danceTypeFilter = document.getElementById('dance-type-filter');
    if (danceTypeFilter) {
        danceTypeFilter.addEventListener('change', filterParties);
    }
    
    const dateFilter = document.getElementById('date-filter');
    if (dateFilter) {
        dateFilter.addEventListener('change', filterParties);
    }
    
    // 편집 취소 버튼
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelEdit);
    }
    
    // 포스터 미리보기
    const posterInput = document.getElementById('party-poster');
    if (posterInput) {
        posterInput.addEventListener('change', handlePosterPreview);
    }
    
    // 지난 파티 필터 이벤트
    const pastRegionFilter = document.getElementById('past-region-filter');
    if (pastRegionFilter) {
        pastRegionFilter.addEventListener('change', filterParties);
    }
    
    const pastDanceTypeFilter = document.getElementById('past-dance-type-filter');
    if (pastDanceTypeFilter) {
        pastDanceTypeFilter.addEventListener('change', filterParties);
    }
    
    const pastDateFilter = document.getElementById('past-date-filter');
    if (pastDateFilter) {
        pastDateFilter.addEventListener('change', filterParties);
    }
    
    console.log('이벤트 리스너 설정 완료');
}

// 인증 상태 확인 (완전히 새로 작성)
function checkAuthState() {
    console.log('=== 인증 상태 확인 시작 ===');
    
    // Firebase Auth 객체 확인
    if (!firebase || !firebase.auth) {
        console.error('Firebase Auth가 로드되지 않았습니다!');
        return;
    }
    
    // Auth 객체 가져오기
    const auth = firebase.auth();
    console.log('Firebase Auth 객체:', auth);
    
    // 현재 인증된 사용자 즉시 확인
    const currentAuthUser = auth.currentUser;
    console.log('현재 인증된 사용자 (즉시):', currentAuthUser);
    
    if (currentAuthUser) {
        // 사용자 정보가 완전히 로드될 때까지 기다림
        currentAuthUser.reload().then(() => {
            console.log('사용자 정보 재로드 완료');
            currentUser = currentAuthUser;
            console.log('현재 사용자 설정됨:', {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL
            });
            updateLoginUI();
        }).catch((error) => {
            console.log('사용자 정보 재로드 실패, 기존 정보 사용:', error);
            currentUser = currentAuthUser;
            updateLoginUI();
        });
    } else {
        console.log('현재 인증된 사용자가 없습니다.');
        currentUser = null;
        updateLoginUI();
    }
    
    // 인증 상태 변경 리스너 등록
    auth.onAuthStateChanged(function(user) {
        console.log('=== 인증 상태 변경 감지 ===');
        console.log('새로운 사용자 객체:', user);
        
        if (user) {
            console.log('로그인된 사용자 정보:', {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                providerData: user.providerData
            });
            
            // 사용자 정보가 완전히 로드될 때까지 기다림
            user.reload().then(() => {
                console.log('사용자 정보 재로드 완료 (리스너)');
                currentUser = user;
                updateLoginUI();
            }).catch((error) => {
                console.log('사용자 정보 재로드 실패, 기존 정보 사용 (리스너):', error);
                currentUser = user;
                updateLoginUI();
            });
        } else {
            console.log('사용자 로그아웃됨');
            currentUser = null;
            updateLoginUI();
        }
    });
    
    console.log('=== 인증 상태 확인 완료 ===');
}

// 로그인 UI 업데이트
async function updateLoginUI() {
    console.log('=== 로그인 UI 업데이트 시작 ===');
    console.log('현재 사용자 상태:', currentUser);
    
    const loginBtn = document.querySelector('.login-btn');
    const userName = document.getElementById('user-name');
    const userDisplayName = document.getElementById('user-display-name');
    const partyRegistration = document.getElementById('party-registration');
    const partyForm = document.getElementById('party-form');
    
    if (currentUser) {
        // 로그인된 상태
        console.log('로그인된 사용자 정보:', {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
        });
        
        loginBtn.textContent = '로그아웃';
        loginBtn.onclick = signOut;
        
        // 사용자 이름 표시 (전화번호인 경우 마스킹 처리)
        let displayName;
        if (currentUser.phoneNumber) {
            // 전화번호 로그인인 경우 마스킹 처리
            displayName = maskPhoneNumber(currentUser.phoneNumber);
        } else {
            // Google 로그인인 경우 기존 방식
            displayName = currentUser.displayName || currentUser.email.split('@')[0];
        }
        userDisplayName.textContent = displayName;
        userName.classList.remove('hidden');
        
        // 등록 폼 활성화
        if (partyRegistration) {
            partyRegistration.classList.remove('disabled');
        }
        if (partyForm) {
            partyForm.classList.remove('disabled');
        }
        
        // 로그인 모달 정리
        closeLoginModal();
        
        // 유튜브 섹션 다시 초기화 (관리자 권한 확인)
        await initializeYouTubeSection();
        
        // 관리자 모드 버튼 표시 (로그인된 사용자만)
        const adminBtn = document.querySelector('.admin-btn');
        if (adminBtn) {
            adminBtn.style.display = 'inline-block';
        }
        
        console.log('로그인 상태: 등록 폼 활성화됨');
    } else {
        // 로그아웃된 상태
        console.log('로그아웃된 상태');
        
        loginBtn.textContent = '로그인';
        loginBtn.onclick = showLoginModal;
        userName.classList.add('hidden');
        
        // 등록 폼 비활성화
        if (partyRegistration) {
            partyRegistration.classList.add('disabled');
        }
        if (partyForm) {
            partyForm.classList.add('disabled');
        }
        
        // 로그아웃 시에도 모달 정리
        closeLoginModal();
        
        // 유튜브 섹션 다시 초기화 (권한 재확인)
        initializeYouTubeSection();
        
        // 관리자 모드 버튼 숨김 (로그아웃 시)
        const adminBtn = document.querySelector('.admin-btn');
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
        
        // 관리자 패널이 열려있다면 닫기
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel && !adminPanel.classList.contains('hidden')) {
            adminPanel.classList.add('hidden');
        }
        
        console.log('로그아웃 상태: 등록 폼 비활성화됨');
    }
    
    console.log('=== 로그인 UI 업데이트 완료 ===');
}

// 로그인 모달 표시
function showLoginModal() {
    // 기존 모달이 있는지 확인
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
        console.log('기존 모달이 이미 존재합니다.');
        return;
    }
    
    console.log('새 로그인 모달 생성 중...');
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'login-modal';
    modal.innerHTML = `
        <div class="modal-content login-modal">
            <div class="modal-header">
                <h3>🔐 로그인</h3>
                <button class="close-btn" onclick="closeLoginModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="login-warning" style="color:#d32f2f; font-size:14px; margin-bottom:10px; font-weight:bold;">
                    ⚠️ 앱 내 웹뷰(카카오톡, 인스타 등)에서는 구글 로그인이 불가합니다.<br>크롬, 사파리 등 외부 브라우저에서 이용해 주세요.
                </div>
                
                <!-- Google 로그인 -->
                <div class="login-section">
                    <button class="google-login-btn" onclick="signInWithGoogle()">
                        <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google">
                        Google로 로그인하기
                    </button>
                </div>
                
                <!-- 구분선 -->
                <div style="text-align: center; margin: 20px 0; position: relative;">
                    <div style="border-top: 1px solid #ddd; position: absolute; top: 50%; left: 0; right: 0;"></div>
                    <span style="background: white; padding: 0 15px; color: #666; font-size: 14px;">또는</span>
                </div>
                
                <!-- 전화번호 로그인 -->
                <div class="login-section">
                    <div class="phone-login-form">
                        <div class="form-group">
                            <label for="phone-number">📱 전화번호</label>
                            <input type="tel" id="phone-number" placeholder="010-1234-5678" maxlength="13">
                        </div>
                        <button class="send-verification-btn" onclick="sendVerificationCode()">
                            인증번호 받기
                        </button>
                        
                        <div class="verification-section" id="verification-section" style="display: none;">
                            <div class="form-group">
                                <label for="verification-code">🔢 인증번호</label>
                                <input type="text" id="verification-code" placeholder="6자리 숫자" maxlength="6">
                            </div>
                            <button class="verify-code-btn" onclick="verifyPhoneCode()">
                                인증 확인
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="login-info">
                    로그인하면 파티를 편집할 수 있습니다.
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    console.log('로그인 모달 생성 완료');
}

// 로그인 모달 닫기
function closeLoginModal() {
    console.log('로그인 모달 닫기 시도...');
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.remove();
        console.log('로그인 모달 닫기 완료');
    }
    
    // 혹시 다른 모달들도 정리
    const otherModals = document.querySelectorAll('.modal');
    otherModals.forEach(modal => {
        if (modal.id !== 'login-modal') {
            modal.remove();
        }
    });
}



// 전화번호 인증번호 전송 (실제 Firebase Phone Auth)
async function sendVerificationCode() {
    const phoneNumber = document.getElementById('phone-number').value;
    
    if (!phoneNumber) {
        showToast('전화번호를 입력해주세요.', 'error');
        return;
    }
    
    // 전화번호 형식 검증 (하이픈 있거나 없거나 모두 허용)
    const phoneRegex = /^01[0-9][-]?[0-9]{3,4}[-]?[0-9]{4}$/;
    if (!phoneRegex.test(phoneNumber)) {
        showToast('올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678 또는 01012345678)', 'error');
        return;
    }
    
    try {
        showToast('인증번호를 전송 중입니다...', 'info');
        
        // Firebase Auth 확인
        if (!auth) {
            throw new Error('Firebase Auth가 초기화되지 않았습니다.');
        }
        
        // 전화번호 형식 변환 (국제 형식)
        const formattedPhone = phoneNumber.startsWith('0') ? '+82' + phoneNumber.substring(1) : phoneNumber;
        
        // reCAPTCHA 설정 (더 안정적인 방법)
        if (!window.recaptchaVerifier) {
            // 기존 reCAPTCHA 정리
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
            }
            
            // 새로운 reCAPTCHA 생성
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('send-verification-btn', {
                'size': 'invisible',
                'callback': (response) => {
                    console.log('reCAPTCHA 인증 완료');
                },
                'expired-callback': () => {
                    console.log('reCAPTCHA 만료됨');
                    window.recaptchaVerifier = null;
                }
            });
        }
        
        // reCAPTCHA 렌더링 (에러 처리 추가)
        try {
            await window.recaptchaVerifier.render();
            console.log('reCAPTCHA 렌더링 성공');
        } catch (renderError) {
            console.error('reCAPTCHA 렌더링 실패:', renderError);
            window.recaptchaVerifier = null;
            throw new Error('보안 인증 초기화에 실패했습니다.');
        }
        
        // 인증번호 전송
        const confirmationResult = await auth.signInWithPhoneNumber(formattedPhone, window.recaptchaVerifier);
        window.confirmationResult = confirmationResult;
        
        // 인증번호 입력 섹션 표시
        document.getElementById('verification-section').style.display = 'block';
        document.getElementById('send-verification-btn').textContent = '인증번호 재전송';
        document.getElementById('send-verification-btn').disabled = true;
        
        // 3분 후 재전송 버튼 활성화
        setTimeout(() => {
            document.getElementById('send-verification-btn').disabled = false;
        }, 180000);
        
        showToast('인증번호가 전송되었습니다!', 'success');
        
    } catch (error) {
        console.error('인증번호 전송 실패:', error);
        
        // reCAPTCHA 오류인 경우 재설정
        if (error.code === 'auth/argument-error' || error.message.includes('recaptcha')) {
            console.log('reCAPTCHA 오류 감지, 재설정 중...');
            window.recaptchaVerifier = null;
            
            // 개발용 대안 제공
            showToast('보안 인증에 문제가 발생했습니다. 개발용 인증을 사용합니다.', 'warning');
            
            // 개발용 시뮬레이션으로 대체
            setTimeout(() => {
                const mockCode = '123456';
                sessionStorage.setItem('mockVerificationCode', mockCode);
                sessionStorage.setItem('mockPhoneNumber', phoneNumber);
                
                document.getElementById('verification-section').style.display = 'block';
                document.getElementById('send-verification-btn').textContent = '인증번호 재전송';
                document.getElementById('send-verification-btn').disabled = true;
                
                setTimeout(() => {
                    document.getElementById('send-verification-btn').disabled = false;
                }, 180000);
                
                showToast(`개발용 인증번호: ${mockCode}`, 'success');
            }, 1000);
        } else {
            showToast('인증번호 전송에 실패했습니다: ' + error.message, 'error');
        }
    }
}

// 전화번호 인증번호 확인 (실제 Firebase Phone Auth)
async function verifyPhoneCode() {
    const verificationCode = document.getElementById('verification-code').value;
    
    if (!verificationCode) {
        showToast('인증번호를 입력해주세요.', 'error');
        return;
    }
    
    if (verificationCode.length !== 6) {
        showToast('6자리 인증번호를 입력해주세요.', 'error');
        return;
    }
    
    try {
        showToast('인증번호를 확인 중입니다...', 'info');
        
        // Firebase 인증 시도
        if (window.confirmationResult) {
            const result = await window.confirmationResult.confirm(verificationCode);
            
            if (result.user) {
                console.log('Firebase 전화번호 인증 성공:', result.user);
                
                // currentUser 설정 (중요!)
                currentUser = result.user;
                
                // 로그인 상태 저장
                localStorage.setItem('userPhone', result.user.phoneNumber);
                localStorage.setItem('userLoginMethod', 'phone');
                localStorage.setItem('userUID', result.user.uid);
                
                showToast('전화번호 인증이 완료되었습니다!', 'success');
                closeLoginModal();
                
                // UI 업데이트
                updateLoginUI();
                return;
            }
        }
        
        // 개발용 인증 시도
        const savedCode = sessionStorage.getItem('mockVerificationCode');
        const savedPhone = sessionStorage.getItem('mockPhoneNumber');
        
        if (savedCode && savedPhone && verificationCode === savedCode) {
            console.log('개발용 전화번호 인증 성공:', savedPhone);
            
            // 로그인 상태 저장
            localStorage.setItem('userPhone', savedPhone);
            localStorage.setItem('userLoginMethod', 'phone');
            localStorage.setItem('userUID', 'dev_' + Date.now());
            
            // currentUser 설정 (중요!)
            currentUser = {
                uid: 'dev_' + Date.now(),
                phoneNumber: savedPhone,
                displayName: savedPhone,
                email: savedPhone + '@phone.local'
            };
            
            // 세션 정리
            sessionStorage.removeItem('mockVerificationCode');
            sessionStorage.removeItem('mockPhoneNumber');
            
            showToast('전화번호 인증이 완료되었습니다!', 'success');
            closeLoginModal();
            
            // UI 업데이트
            updateLoginUI();
        } else {
            showToast('인증번호가 올바르지 않습니다.', 'error');
        }
        
    } catch (error) {
        console.error('인증번호 확인 실패:', error);
        showToast('인증번호가 올바르지 않습니다.', 'error');
    }
}

// Google 로그인
function signInWithGoogle() {
    if (!auth) {
        console.error('Firebase Auth가 초기화되지 않았습니다.');
        return;
    }
    
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log('로그인 성공:', result.user);
            closeLoginModal(); // 모달 닫기 함수 호출
        })
        .catch((error) => {
            console.error('로그인 실패:', error);
            alert('로그인에 실패했습니다: ' + error.message);
        });
}

// 로그아웃
function signOut() {
    if (auth) {
        auth.signOut()
            .then(() => {
                console.log('로그아웃 성공');
            })
            .catch((error) => {
                console.error('로그아웃 실패:', error);
            });
    }
}

// 파티 등록 처리
// 폼 제출 중복 방지 플래그
let isSubmitting = false;

async function handlePartySubmit(e) {
    e.preventDefault();
    
    // 중복 제출 방지
    if (isSubmitting) {
        console.log('이미 제출 중입니다. 중복 제출을 방지합니다.');
        return;
    }
    
    isSubmitting = true;
    console.log('=== 파티 등록 폼 제출 시작 ===');
    
    const formData = new FormData(e.target);
    const isEditing = editingPartyId !== null;
    console.log('편집 모드 여부:', isEditing);
    console.log('편집 중인 파티 ID:', editingPartyId);
    
    // 날짜 범위 처리
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    const duration = parseInt(formData.get('duration')) || 1;
    
    // 시작일과 종료일이 같으면 단일 날짜로 처리
    const isSingleDay = startDate === endDate;
    
    // 고유 ID 생성 (편집 모드가 아닐 때만)
    const generateUniqueId = () => {
        return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    };
    
    const partyData = {
        id: isEditing ? editingPartyId : generateUniqueId(), // 편집 모드면 기존 ID, 아니면 고유 ID
        title: formData.get('title'),
        region: formData.get('region'),
        danceType: formData.get('danceType'), // 댄스 분류 추가
        barName: formData.get('barName'), // 바 이름 추가
        address: formData.get('address'), // 상세주소 추가
        location: formData.get('location'),
        startDate: startDate,
        endDate: endDate,
        duration: duration,
        isSingleDay: isSingleDay,
        // 하위 호환성을 위한 date 필드 (시작일로 설정)
        date: startDate,
        time: formData.get('time'),
        description: formData.get('description'),
        contact: formData.get('contact'),
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        gallery: [],
        comments: []
    };
    
    // 현재 사용자 정보 추가 (모든 필드 저장)
    if (currentUser) {
        partyData.createdBy = currentUser.uid; // Firebase UID
        partyData.createdByEmail = currentUser.email; // 이메일
        partyData.createdByDisplayName = currentUser.displayName; // 표시 이름
        partyData.author = currentUser.displayName || currentUser.email; // 하위 호환성을 위한 author 필드
        console.log('작성자 정보 저장:', {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName
        });
    } else {
        partyData.author = '익명 사용자';
        partyData.createdByDisplayName = '익명 사용자';
        console.log('로그인되지 않은 사용자로 파티 등록');
    }
    
    try {
        showLoading();
        console.log('파티 데이터:', partyData);
        
        // 포스터 업로드 처리
        const posterFile = formData.get('file');
        if (posterFile && posterFile.size > 0) {
            console.log('포스터 파일 처리 중...');
            
            // 파일 크기 체크 (1MB 제한)
            const maxSize = 1024 * 1024; // 1MB
            if (posterFile.size > maxSize) {
                const fileSizeMB = (posterFile.size / (1024 * 1024)).toFixed(2);
                const message = `이미지 파일이 너무 큽니다! (${fileSizeMB}MB)\n\n1MB 미만의 이미지를 선택해주세요.\n\n💡 팁: 이미지 압축 도구를 사용하거나 더 작은 해상도의 이미지를 선택해보세요.`;
                showMessage(message, 'error');
                return; // 폼 제출 중단
            }
            
                    // Firebase Storage에 업로드
        try {
            const posterUrl = await uploadPoster(posterFile);
            
            // 업로드된 URL이 올바른 형식인지 확인
            if (!posterUrl || posterUrl.startsWith('data:')) {
                throw new Error('이미지 업로드가 올바르지 않습니다. 다시 시도해주세요.');
            }
            
            partyData.posterUrl = posterUrl; // Storage URL 저장
            console.log('포스터 업로드 완료:', posterUrl);
        } catch (uploadError) {
            console.error('포스터 업로드 실패:', uploadError);
            throw new Error('포스터 업로드에 실패했습니다: ' + uploadError.message);
        }
        }
        
        // Firebase DB 객체 확인
        console.log('Firebase DB 객체:', db);
        if (!db) {
            throw new Error('Firebase가 초기화되지 않았습니다.');
        }
        
        // Firebase에 먼저 저장 (중요!)
        console.log('Firebase 저장 시작...');
        let firestoreId = partyData.id;
        
        if (isEditing) {
            // 편집 모드: 기존 문서 업데이트
            console.log('Firebase 파티 업데이트 중:', editingPartyId);
            await db.collection('parties').doc(editingPartyId).update(partyData);
            firestoreId = editingPartyId;
            console.log('Firebase 파티 업데이트 완료:', editingPartyId);
        } else {
            // 새 파티: 새 문서 추가
            console.log('Firebase 새 파티 추가 중...');
            const docRef = await db.collection('parties').add(partyData);
            firestoreId = docRef.id; // 새로 생성된 Firestore ID 사용
            partyData.id = firestoreId; // partyData의 ID도 업데이트
            console.log('Firebase 새 파티 추가 완료:', firestoreId);
        }
        
        console.log('Firebase 저장 완료, 최종 ID:', firestoreId);
        
        // 로컬 스토리지에 저장 (Firebase ID 사용, 중복 방지)
        const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        
        if (isEditing) {
            // 기존 파티 업데이트
            console.log('로컬 스토리지 파티 업데이트 중:', editingPartyId);
            const partyIndex = parties.findIndex(p => p.id === editingPartyId);
            if (partyIndex !== -1) {
                // 기존 데이터 유지하면서 업데이트
                parties[partyIndex] = { ...parties[partyIndex], ...partyData };
                console.log('로컬 스토리지 파티 업데이트 완료');
            } else {
                console.log('로컬에서 파티를 찾을 수 없어 새로 추가');
                parties.push(partyData);
            }
        } else {
            // 새 파티 추가 (강화된 중복 체크)
            console.log('로컬 스토리지 새 파티 추가 중...');
            console.log('현재 파티 데이터:', {
                title: partyData.title,
                startDate: partyData.startDate,
                endDate: partyData.endDate,
                barName: partyData.barName,
                address: partyData.address
            });
            
            // 강화된 중복 체크 (여러 기준으로 확인)
            const isDuplicate = parties.some(existingParty => {
                // 1. 제목과 시작일이 같은 경우
                const titleAndDateMatch = existingParty.title === partyData.title && 
                                        existingParty.startDate === partyData.startDate;
                
                // 2. 제목과 바 이름이 같은 경우
                const titleAndBarMatch = existingParty.title === partyData.title && 
                                       existingParty.barName === partyData.barName;
                
                // 3. 제목과 주소가 같은 경우
                const titleAndAddressMatch = existingParty.title === partyData.title && 
                                           existingParty.address === partyData.address;
                
                // 4. 같은 작성자가 같은 제목으로 등록한 경우 (최근 1시간 내)
                const sameAuthorRecent = existingParty.createdBy === partyData.createdBy &&
                                        existingParty.title === partyData.title &&
                                        existingParty.createdAt &&
                                        (new Date() - new Date(existingParty.createdAt)) < 3600000; // 1시간
                
                return titleAndDateMatch || titleAndBarMatch || titleAndAddressMatch || sameAuthorRecent;
            });
            
            if (isDuplicate) {
                console.log('중복된 파티가 이미 존재합니다:', partyData.title);
                showMessage('같은 파티가 이미 등록되어 있습니다. 중복 등록을 방지합니다.', 'warning');
                return;
            }
            
            parties.push(partyData);
            console.log('로컬 스토리지 파티 추가 완료, ID:', firestoreId);
        }
        
        // 로컬 스토리지에 저장
        localStorage.setItem('latinDanceParties', JSON.stringify(parties));
        console.log('로컬 스토리지 저장 완료');
        
        // 편집 모드 종료
        if (isEditing) {
            editingPartyId = null;
            document.getElementById('cancel-edit-btn').classList.add('hidden');
            console.log('편집 모드 종료');
        }
        
        // 폼 초기화
        e.target.reset();
        document.getElementById('poster-preview').innerHTML = '';
        
        // 성공 메시지
        const message = isEditing ? '파티가 성공적으로 수정되었습니다!' : '파티가 성공적으로 등록되었습니다!';
        showMessage(message, 'success');
        
        // 파티 목록 새로고침
        console.log('파티 목록 새로고침 시작...');
        await loadParties();
        console.log('파티 목록 새로고침 완료');
        
    } catch (error) {
        console.error('파티 등록 실패:', error);
        console.error('에러 상세 정보:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        showMessage('파티 등록에 실패했습니다: ' + error.message, 'error');
    } finally {
        hideLoading();
        isSubmitting = false; // 제출 플래그 리셋
        console.log('=== 파티 등록 폼 제출 완료 ===');
    }
}

// 포스터 업로드
async function uploadPoster(file) {
    try {
        console.log('포스터 업로드 시작...');
        const storageRef = storage.ref();
        const posterRef = storageRef.child(`posters/${Date.now()}_${file.name}`);
        const snapshot = await posterRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log('포스터 업로드 완료:', downloadURL);
        return downloadURL;
    } catch (error) {
        console.error('포스터 업로드 실패:', error);
        throw error;
    }
}

// 주소 복사 기능
async function copyAddress(address) {
    try {
        // 클립보드에 복사
        await navigator.clipboard.writeText(address);
        
        // 성공 메시지 표시
        showMessage('📋 주소가 클립보드에 복사되었습니다!', 'success');
        
        // 버튼 텍스트 임시 변경 (선택사항)
        const copyBtn = event.target;
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ 복사됨';
        copyBtn.style.background = '#2196F3';
        
        // 2초 후 원래 텍스트로 복원
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.background = '#4CAF50';
        }, 2000);
        
    } catch (error) {
        console.error('클립보드 복사 실패:', error);
        
        // fallback: 구형 브라우저 지원
        try {
            const textArea = document.createElement('textarea');
            textArea.value = address;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            showMessage('📋 주소가 클립보드에 복사되었습니다!', 'success');
        } catch (fallbackError) {
            console.error('fallback 복사도 실패:', fallbackError);
            showMessage('❌ 클립보드 복사에 실패했습니다. 주소를 직접 복사해주세요.', 'error');
        }
    }
}

// 포스터 미리보기
function handlePosterPreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('poster-preview');
    
    if (file) {
        // 파일 크기 체크 (1MB 제한)
        const maxSize = 1024 * 1024; // 1MB
        if (file.size > maxSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const message = `⚠️ 이미지 파일이 너무 큽니다! (${fileSizeMB}MB)\n\n📏 1MB 미만의 이미지를 선택해주세요.\n\n💡 팁:\n• 이미지 압축 도구 사용\n• 더 작은 해상도 선택\n• JPG 형식 사용 (PNG보다 작음)`;
            
            showMessage(message, 'error');
            
            // 파일 선택 초기화
            e.target.value = '';
            preview.innerHTML = '';
            
            return;
        }
        
        // 파일 크기가 적절하면 미리보기 표시
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="포스터 미리보기">`;
        };
        reader.readAsDataURL(file);
        
        // 성공 메시지 표시
        const fileSizeKB = (file.size / 1024).toFixed(1);
        showMessage(`✅ 이미지 선택 완료! (${fileSizeKB}KB)`, 'success');
    } else {
        preview.innerHTML = '';
    }
}

// 파티 목록 로드 (기본 함수 - 탭 시스템과 호환)
async function loadParties() {
    // 기본적으로 진행중인 파티 탭을 활성화
    switchTab('current-parties');
}

// 기존 loadParties 함수를 loadCurrentParties로 대체
// 이 함수는 하위 호환성을 위해 유지
async function loadPartiesLegacy() {
    try {
        console.log('파티 목록 로드 시작...');
        
        // Firebase가 초기화되었는지 확인
        if (!db) {
            console.error('Firebase가 초기화되지 않았습니다.');
            showMessage('Firebase 연결에 실패했습니다.', 'error');
            return;
        }
        
        showLoading();
        
        // 직접 Firestore 쿼리
        console.log('Firestore에서 파티 데이터 로드 시작...');
        const snapshot = await db.collection('parties').orderBy('createdAt', 'desc').limit(50).get();
        console.log('Firestore 쿼리 완료, 문서 수:', snapshot.size);
        
        const partiesContainer = document.getElementById('parties-container');
        partiesContainer.innerHTML = '';
        
        if (snapshot.empty) {
            console.log('등록된 파티가 없습니다.');
            partiesContainer.innerHTML = `
                <div class="empty-state">
                    <h3>🎉 아직 등록된 파티가 없습니다</h3>
                    <p>첫 번째 파티를 등록해보세요!</p>
                </div>
            `;
            return;
        }
        
        const parties = [];
        snapshot.forEach(doc => {
            const party = { id: doc.id, ...doc.data() };
            parties.push(party);
            console.log('파티 데이터:', party);
            displayParty(party);
        });
        
        console.log('파티 목록 로드 완료:', parties.length + '개');
        
    } catch (error) {
        console.error('파티 로드 실패:', error);
        showMessage('파티 목록을 불러오는데 실패했습니다: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 파티 표시
// 파티 표시
function displayParty(party, containerId = 'parties-container', isPastParty = false) {
    console.log('=== 파티 표시 시작 ===');
    console.log('파티:', party);
    console.log('현재 사용자:', currentUser);
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('컨테이너를 찾을 수 없습니다:', containerId);
        return;
    }
    
    // 등록자 정보 처리 - 여러 필드를 확인하여 올바른 정보 표시
    let createdByInfo = '등록자 정보 없음';
    if (party.author) {
        // author 필드가 있으면 사용 (이메일)
        createdByInfo = party.author;
    } else if (party.createdBy) {
        // createdBy 필드가 있으면 사용 (UID 또는 이메일)
        createdByInfo = party.createdBy;
    } else if (party.createdByDisplayName) {
        // createdByDisplayName 필드가 있으면 사용
        createdByInfo = party.createdByDisplayName;
    }
    
    // 현재 사용자가 등록자인지 확인
    const isCurrentUserAuthor = currentUser && (
        (party.createdBy === currentUser.uid) || 
        (party.author === currentUser.email)
    );
    
    // 권한 체크 - 명시적으로 canEdit 함수 호출
    const canEditParty = canEdit(party);
    console.log('=== 권한 체크 상세 정보 ===');
    console.log('파티 ID:', party.id);
    console.log('파티 제목:', party.title);
    console.log('파티 작성자 정보:', {
        createdBy: party.createdBy,
        author: party.author,
        createdByDisplayName: party.createdByDisplayName
    });
    console.log('현재 사용자 정보:', {
        uid: currentUser?.uid,
        email: currentUser?.email
    });
    console.log('현재 사용자가 등록자인지:', isCurrentUserAuthor);
    console.log('canEdit 함수 결과:', canEditParty);
    console.log('편집 권한 확인 결과:', canEditParty);
    
    // 지난 파티 여부 확인
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const partyDate = new Date(party.date);
    partyDate.setHours(0, 0, 0, 0);
    const isActuallyPast = partyDate < today;
    
    // 지난 파티 클래스 추가
    const pastPartyClass = (isPastParty || isActuallyPast) ? 'past-party' : '';
    
    const partyCard = document.createElement('div');
    partyCard.className = `party-card ${pastPartyClass}`;
    partyCard.setAttribute('data-party-id', party.id);
    partyCard.innerHTML = `
        <h3>${party.title}</h3>
        <div class="party-info">
            <span style="font-size:16px;vertical-align:middle;margin-right:4px;">📍</span><strong>지역:</strong> ${party.region}
        </div>
        <div class="party-info">
            <span style="font-size:16px;vertical-align:middle;margin-right:4px;">💃</span><strong>댄스:</strong> ${party.danceType || '댄스 분류 미정'}
        </div>
        <div class="party-info">
            <span style="font-size:16px;vertical-align:middle;margin-right:4px;">🏢</span><strong>바 이름:</strong> ${party.barName || '바 이름 미정'}
            <button class="map-btn" onclick="openMap('${party.address || ''}')" style="background:#ff9800;color:white;border:none;padding:2px 8px;border-radius:4px;margin-left:8px;font-size:12px;cursor:pointer;">지도</button>
        </div>
        <div class="party-info">
            <span style="font-size:16px;vertical-align:middle;margin-right:4px;">📍</span><strong>상세주소:</strong> ${party.address || '주소 미정'}
            ${party.address ? `<button class="copy-btn" onclick="copyAddress('${party.address}')" style="background:#4CAF50;color:white;border:none;padding:2px 8px;border-radius:4px;margin-left:8px;font-size:12px;cursor:pointer;">📋 복사</button>` : ''}
        </div>
        <div class="party-info">
            <span style="font-size:16px;vertical-align:middle;margin-right:4px;">🏢</span><strong>층수:</strong> ${party.location}
        </div>
        <div class="party-info">
            <span style="font-size:20px;vertical-align:middle;margin-right:4px;">🗓️</span><strong>일시:</strong> 📍 ${formatPartyDateRange(party)} ${party.time ? party.time.substring(0, 5) : ''}
        </div>
        <div class="party-info">
            <span style="font-size:16px;vertical-align:middle;margin-right:4px;">👤</span><strong>등록자:</strong> ${createdByInfo} ${isCurrentUserAuthor ? '(나)' : ''}
        </div>
        ${party.contact ? `
            <div class="party-info">
                <span style="font-size:16px;vertical-align:middle;margin-right:4px;">📞</span><strong>연락처:</strong> ${party.contact}
            </div>
        ` : ''}
        ${party.posterUrl ? `<div style="width: 100%; height: 200px; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 10px 0;"><img src="${party.posterUrl}" alt="파티 포스터" class="party-poster" onclick="openImageModal('${party.posterUrl}')" style="cursor: pointer; width: 100%; height: 100%; object-fit: cover; object-position: center center;"></div>` : ''}
        ${party.description ? `<p class="party-description">${party.description}</p>` : ''}
        
        <div class="like-count">
            <span class="heart">❤️</span>
            <span>${party.likes || 0}명이 좋아합니다</span>
        </div>
        
        <div class="party-actions">
            <button class="like-btn ${isLiked(party) ? 'liked' : ''}" onclick="toggleLike('${party.id}')">
                좋아요
            </button>
            <button class="view-btn" onclick="viewParty('${party.id}')">
                상세보기
            </button>
            <button class="share-btn" onclick="handleKakaoShare('${party.id}')">
                공유
            </button>
            ${canEditParty ? `
                <button class="edit-btn" onclick="handleEditClick('${party.id}')">
                    수정
                </button>
                <button class="delete-btn" onclick="debugDeleteParty('${party.id}')">
                    삭제
                </button>
            ` : ''}
        </div>
    `;
    

    
    container.appendChild(partyCard);
    console.log('=== 파티 표시 완료 ===');
}

// 좋아요 상태 확인
function isLiked(party) {
    if (!currentUser) return false;
    return party.likedBy && party.likedBy.includes(currentUser.uid);
}

// 편집 버튼 클릭 중복 방지
let isEditButtonClicked = false;

function handleEditClick(partyId) {
    if (isEditButtonClicked) {
        console.log('편집 버튼이 이미 클릭되었습니다. 중복 클릭을 방지합니다.');
        return;
    }
    
    isEditButtonClicked = true;
    console.log('편집 버튼 클릭됨:', partyId);
    
    // 1초 후 플래그 리셋
    setTimeout(() => {
        isEditButtonClicked = false;
    }, 1000);
    
    editParty(partyId);
}

// 관리자 권한 확인 함수 (개선된 버전)
function canEdit(party) {
    console.log('=== 권한 체크 시작 ===');
    console.log('파티 정보:', party);
    
    // 현재 사용자 정보 확인
    if (!currentUser) {
        console.log('사용자가 로그인되지 않음');
        
        // Firebase Auth에서 직접 확인 시도
        if (firebase && firebase.auth) {
            const auth = firebase.auth();
            const currentAuthUser = auth.currentUser;
            if (currentAuthUser) {
                console.log('Firebase Auth에서 직접 사용자 정보 가져옴:', {
                    uid: currentAuthUser.uid,
                    email: currentAuthUser.email,
                    displayName: currentAuthUser.displayName
                });
                currentUser = currentAuthUser;
            } else {
                console.log('Firebase Auth에서도 사용자 정보를 찾을 수 없음');
                return false;
            }
        } else {
            console.log('Firebase Auth 객체를 찾을 수 없음');
            return false;
        }
    }
    
    // 현재 사용자 정보 상세 로깅
    console.log('현재 사용자 전체 정보:', currentUser);
    console.log('현재 사용자 UID:', currentUser.uid);
    console.log('현재 사용자 이메일:', currentUser.email);
    console.log('현재 사용자 displayName:', currentUser.displayName);
    
    // 관리자 이메일 목록 (실제 관리자만 포함)
    const adminEmails = [
        'jungwon1023@gmail.com',
        'admin@example.com',
        'test@example.com'
    ];
    
    console.log('관리자 이메일 목록:', adminEmails);
    
    // 관리자 이메일인지 확인
    const isAdmin = adminEmails.includes(currentUser.email);
    console.log('관리자 권한 확인:', isAdmin);
    
    // 관리자인 경우 항상 편집 가능
    if (isAdmin) {
        console.log('관리자 권한으로 편집 가능');
        return true;
    }
    
    // 파티 정보 로깅
    console.log('파티 작성자 필드들:', {
        createdBy: party.createdBy,
        author: party.author,
        createdByDisplayName: party.createdByDisplayName,
        createdByEmail: party.createdByEmail
    });
    
    // 1. createdBy 필드로 확인 (UID 기반)
    if (party && party.createdBy) {
        const isOwner = party.createdBy === currentUser.uid;
        console.log('파티 작성자 확인 (createdBy):', isOwner, '파티 작성자 UID:', party.createdBy, '현재 사용자 UID:', currentUser.uid);
        if (isOwner) {
            console.log('작성자 권한으로 편집 가능 (createdBy)');
            return true;
        }
    }
    
    // 2. author 필드로 확인 (이메일 기반)
    if (party && party.author) {
        const isOwner = party.author === currentUser.email;
        console.log('파티 작성자 확인 (author):', isOwner, '파티 작성자 이메일:', party.author, '현재 사용자 이메일:', currentUser.email);
        if (isOwner) {
            console.log('작성자 권한으로 편집 가능 (author)');
            return true;
        }
    }
    
    // 3. createdByEmail 필드로 확인
    if (party && party.createdByEmail) {
        const isOwner = party.createdByEmail === currentUser.email;
        console.log('파티 작성자 확인 (createdByEmail):', isOwner, '파티 작성자 이메일:', party.createdByEmail, '현재 사용자 이메일:', currentUser.email);
        if (isOwner) {
            console.log('작성자 권한으로 편집 가능 (createdByEmail)');
            return true;
        }
    }
    
    // 4. displayName으로 확인 (하위 호환성)
    if (party && party.createdByDisplayName && currentUser.displayName) {
        const isOwner = party.createdByDisplayName === currentUser.displayName;
        console.log('파티 작성자 확인 (displayName):', isOwner, '파티 작성자 이름:', party.createdByDisplayName, '현재 사용자 이름:', currentUser.displayName);
        if (isOwner) {
            console.log('작성자 권한으로 편집 가능 (displayName)');
            return true;
        }
    }
    
    console.log('=== 권한 체크 완료: 편집 권한 없음 ===');
    return false;
}

// 좋아요 토글
async function toggleLike(partyId) {
    if (!currentUser) {
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }
    
    try {
        const partyRef = db.collection('parties').doc(partyId);
        const partyDoc = await partyRef.get();
        const party = partyDoc.data();
        
        const likedBy = party.likedBy || [];
        const userIndex = likedBy.indexOf(currentUser.uid);
        
        if (userIndex > -1) {
            // 좋아요 취소
            likedBy.splice(userIndex, 1);
            party.likes = Math.max(0, party.likes - 1);
        } else {
            // 좋아요 추가
            likedBy.push(currentUser.uid);
            party.likes = (party.likes || 0) + 1;
        }
        
        await partyRef.update({
            likes: party.likes,
            likedBy: likedBy
        });
        
        // UI 새로고침
        loadParties();
        
    } catch (error) {
        console.error('좋아요 처리 실패:', error);
        showMessage('좋아요 처리에 실패했습니다.', 'error');
    }
}

// 파티 상세보기
async function viewParty(partyId) {
    try {
        console.log('=== viewParty 함수 시작 ===');
        console.log('파티 ID:', partyId);
        
        // 현재 파티 ID 설정
        currentPartyId = partyId;
        
        // 로컬 스토리지에서 파티 데이터 찾기 (개발 모드)
        const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        console.log('로컬 스토리지 파티 개수:', parties.length);
        
        // 로컬 스토리지에 저장된 모든 파티 ID 출력
        console.log('=== 로컬 스토리지에 저장된 모든 파티 ID ===');
        parties.forEach((party, index) => {
            console.log(`${index + 1}. ID: ${party.id}, 제목: ${party.title}`);
        });
        
        const party = parties.find(p => p.id === partyId);
        console.log('찾은 파티:', party);
        
        if (party) {
            // 로컬 스토리지에서 파티를 찾았을 때
            console.log('로컬 스토리지에서 파티 찾음, 모달 표시 시작');
            showPartyModal(party);
            return;
        }
        
        console.log('로컬 스토리지에서 파티를 찾을 수 없음, Firebase 확인');
        
        // Firebase에서 파티 데이터 찾기 (에러 처리 강화)
        try {
            if (window.db) {
                console.log('Firebase DB 연결됨, 파티 조회 시작');
                const doc = await db.collection('parties').doc(partyId).get();
                console.log('Firebase 조회 결과:', doc.exists ? '존재함' : '존재하지 않음');
                
                if (!doc.exists) {
                    console.log('Firebase에서도 파티를 찾을 수 없음 - 정상적인 상황일 수 있음');
                    // 에러 메시지 대신 조용히 처리
                    return;
                }
                
                const firebaseParty = { id: doc.id, ...doc.data() };
                console.log('Firebase에서 파티 찾음:', firebaseParty);
                showPartyModal(firebaseParty);
            } else {
                console.log('Firebase DB 연결되지 않음 - 정상적인 상황일 수 있음');
                // 에러 메시지 대신 조용히 처리
            }
        } catch (firebaseError) {
            console.log('Firebase 조회 중 오류 발생 (정상적인 상황일 수 있음):', firebaseError);
            // 에러 메시지 대신 조용히 처리
        }
        
    } catch (error) {
        console.log('파티 상세보기 중 오류 발생 (정상적인 상황일 수 있음):', error);
        // 에러 메시지 대신 조용히 처리
    }
}

// 파티 모달 표시
function showPartyModal(party) {
    console.log('=== showPartyModal 강화 버전 시작 ===');
    console.log('파티 제목:', party.title);
    console.log('파티 ID:', party.id);
    console.log('파티 데이터 확인:', {
        id: party.id,
        title: party.title,
        region: party.region,
        barName: party.barName,
        address: party.address
    });
    
    // 모든 파티에 대한 강화된 처리
    console.log('=== 모든 파티 강화 처리 시작 ===');
    
    // 데이터 검증 강화
    if (!party.id || party.id === 'undefined') {
        console.error('파티 ID가 유효하지 않습니다:', party.id);
        showMessage('파티 정보를 불러올 수 없습니다.', 'error');
        return;
    }
    
    // 강제로 새 모달 생성 (모든 파티에 적용)
    console.log('새 모달 강제 생성:', party.title);
    createAndShowModal(party);
    return;
    
    // 모든 기존 모달 완전히 제거
    const allExistingModals = document.querySelectorAll('#party-modal, .modal');
    allExistingModals.forEach(modal => {
        console.log('기존 모달 제거:', modal.id || modal.className);
        modal.remove();
    });
    
    // DOM이 완전히 로드될 때까지 기다림
    setTimeout(() => {
        const modal = document.getElementById('party-modal');
        const modalTitle = document.getElementById('modal-party-title');
        const modalInfo = document.getElementById('modal-party-info');
        
        console.log('모달 요소들:', {
            modal: modal,
            modalTitle: modalTitle,
            modalInfo: modalInfo
        });
        
        console.log('DOM 전체 확인:', {
            bodyChildren: document.body.children.length,
            hasModal: !!document.querySelector('#party-modal'),
            allModals: document.querySelectorAll('.modal').length
        });
        
        if (!modal || !modalTitle || !modalInfo) {
            console.log('기존 모달 요소를 찾을 수 없습니다. 새 모달을 생성합니다...');
            
            // 모달이 없으면 직접 생성
            createAndShowModal(party);
            return;
        }
        
        // 모달 내용 완전 초기화
        modalTitle.textContent = party.title;
        modalInfo.innerHTML = '';
        
        // 모달 표시
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        // 기존 모달 표시 로직 실행
        showExistingModal(party, modal, modalTitle, modalInfo);
        
        // 상세 모달 자동 번역 (영어 모드일 때)
        if (typeof isEnglish !== 'undefined' && typeof translatePartyCardsAndDetails === 'function') {
            translatePartyCardsAndDetails(isEnglish ? 'en' : 'ko');
        }
    }, 100);
}

// 기존 모달을 사용하는 함수
function showExistingModal(party, modal, modalTitle, modalInfo) {
    console.log('=== showExistingModal 시작 ===');
    console.log('전달받은 파티 데이터:', party);
    console.log('포스터 URL:', party.posterUrl);
    console.log('지역:', party.region);
    console.log('장소:', party.location);
    
    // 파티 데이터 검증 강화
    if (!party || !party.id) {
        console.error('유효하지 않은 파티 데이터:', party);
        return;
    }
    
    // 파티 데이터 무결성 검증
    if (!party.title || typeof party.title !== 'string') {
        console.error('파티 제목이 유효하지 않습니다:', party.title);
        return;
    }
    
    console.log('=== 파티 데이터 검증 완료 ===');
    console.log('파티 ID:', party.id);
    console.log('파티 제목:', party.title);
    console.log('파티 지역:', party.region);
    console.log('파티 바 이름:', party.barName);
    console.log('파티 주소:', party.address);
    
    // 등록자 정보 변수 정의 (강화)
    const createdByInfo = fixedPartyData.author || fixedPartyData.createdBy || fixedPartyData.createdByDisplayName || '등록자 정보 없음';
    const isCurrentUserAuthor = false; // 현재는 간단히 false로 설정
    
    console.log('=== 등록자 정보 확인 ===');
    console.log('createdByInfo:', createdByInfo);
    console.log('isCurrentUserAuthor:', isCurrentUserAuthor);
    
    // 모달에서 파티 카드의 상세 설명 완전 제거
    setTimeout(() => {
        // 1. 모든 .party-description 요소 제거
        const partyDescriptions = modal.querySelectorAll('.party-description');
        partyDescriptions.forEach(desc => {
            desc.remove();
        });
        
        // 2. "상세 설명:" 텍스트가 포함된 모든 요소 제거
        const allElements = modal.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && element.textContent.includes('상세 설명:') && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 3. 파티 카드에서 복사된 모든 요소 제거
        const partyCards = modal.querySelectorAll('.party-card');
        partyCards.forEach(card => {
            const cardDescriptions = card.querySelectorAll('.party-description');
            cardDescriptions.forEach(desc => {
                desc.remove();
            });
        });
        
        // 4. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            const allDivs = modalContent.querySelectorAll('div');
            allDivs.forEach(div => {
                if (div.textContent && div.textContent.includes('상세 설명:') && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
        }
        
        // 5. 모달 내에서 "상세 설명:" 텍스트가 포함된 모든 요소 제거 (더 강력한 방법)
        const allTextElements = modal.querySelectorAll('*');
        allTextElements.forEach(element => {
            if (element.textContent && element.textContent.trim() === '상세 설명:') {
                // "상세 설명:" 텍스트만 있는 요소 제거
                element.remove();
            } else if (element.textContent && element.textContent.includes('상세 설명:') && 
                      !element.classList.contains('party-description-modal') &&
                      !element.classList.contains('description-header') &&
                      !element.classList.contains('description-content')) {
                // "상세 설명:" 텍스트가 포함된 요소 제거
                element.remove();
            }
        });
        
        // 6. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (더 구체적)
        const allDivsInModal = modal.querySelectorAll('div');
        allDivsInModal.forEach(div => {
            if (div.textContent && div.textContent.includes('상세 설명:') && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 7. 모달 내에서 "📄 상세 설명:" 텍스트가 포함된 모든 요소 제거 (이모지 포함)
        const allEmojiElements = modal.querySelectorAll('*');
        allEmojiElements.forEach(element => {
            if (element.textContent && (element.textContent.includes('📄 상세 설명:') || element.textContent.includes('📄 상세 설명')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 8. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (이모지 포함)
        const allEmojiDivs = modal.querySelectorAll('div');
        allEmojiDivs.forEach(div => {
            if (div.textContent && (div.textContent.includes('📄 상세 설명:') || div.textContent.includes('📄 상세 설명')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 9. 모달 내에서 특정 텍스트가 포함된 모든 요소 제거 (내용 기반)
        const allContentElements = modal.querySelectorAll('*');
        allContentElements.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이') ||
                 element.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~') ||
                 element.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 10. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (내용 기반)
        const allContentDivs = modal.querySelectorAll('div');
        allContentDivs.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이') ||
                 div.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~') ||
                 div.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 11. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
        const allNewContentElements = modal.querySelectorAll('*');
        allNewContentElements.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('강원도 강릉에서 살사동호회를 시작한지 2년이 되었습니다') ||
                 element.textContent.includes('그동안 강릉으로 여행오신 여러 선배님들의 도움으로 조금씩 성장하게 되었습니다') ||
                 element.textContent.includes('작은 해변 파티를 시작으로 2025년 Goodbye Summer Party를 개최합니다') ||
                 element.textContent.includes('푸른 해변과 함께 열정적인 밤을 함께해주세요') ||
                 element.textContent.includes('Muy Rico 매우 풍요로운 뜻의 동호회 이름답게 다양한 실내/야외 행사로 준비해 보겠습니다') ||
                 element.textContent.includes('감사합니다. -시샵 네모-')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 12. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
        const allNewContentDivs = modal.querySelectorAll('div');
        allNewContentDivs.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('강원도 강릉에서 살사동호회를 시작한지 2년이 되었습니다') ||
                 div.textContent.includes('그동안 강릉으로 여행오신 여러 선배님들의 도움으로 조금씩 성장하게 되었습니다') ||
                 div.textContent.includes('작은 해변 파티를 시작으로 2025년 Goodbye Summer Party를 개최합니다') ||
                 div.textContent.includes('푸른 해변과 함께 열정적인 밤을 함께해주세요') ||
                 div.textContent.includes('Muy Rico 매우 풍요로운 뜻의 동호회 이름답게 다양한 실내/야외 행사로 준비해 보겠습니다') ||
                 div.textContent.includes('감사합니다. -시샵 네모-')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 13. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
        const allNewContentElements2 = modal.querySelectorAll('*');
        allNewContentElements2.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('20대에 시작한 살사 종신까지 하리다')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 14. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
        const allNewContentDivs2 = modal.querySelectorAll('div');
        allNewContentDivs2.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('20대에 시작한 살사 종신까지 하리다')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 15. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
        const allNewContentElements3 = modal.querySelectorAll('*');
        allNewContentElements3.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이 (음비 바4 살2)') ||
                 element.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~😊') ||
                 element.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 16. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
        const allNewContentDivs3 = modal.querySelectorAll('div');
        allNewContentDivs3.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이 (음비 바4 살2)') ||
                 div.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~😊') ||
                 div.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        console.log('파티 카드의 상세 설명 완전 삭제 완료');
    }, 100);
    
    const date = new Date(party.date);
    const formattedDate = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    modalTitle.textContent = party.title;
    
    // 데이터 고정 (중요!) - 포스터 HTML 생성 전에 먼저 정의
    const fixedPartyData = {
        id: party.id,
        title: party.title,
        region: party.region,
        danceType: party.danceType,
        barName: party.barName,
        address: party.address,
        floor: party.floor,
        date: party.date,
        time: party.time,
        contact: party.contact,
        author: party.author,
        createdBy: party.createdBy,
        createdByDisplayName: party.createdByDisplayName,
        createdAt: party.createdAt,
        timestamp: party.timestamp,
        likes: party.likes,
        posterUrl: party.posterUrl,
        description: party.description,
        location: party.location
    };
    
    console.log('=== showExistingModal 고정된 파티 데이터 ===');
    console.log('고정된 데이터:', fixedPartyData);
    console.log('포스터 URL 확인:', fixedPartyData.posterUrl);
    
    // 포스터 이미지 HTML 생성 (고정된 데이터 사용)
    let posterHTML = '';
    if (fixedPartyData.posterUrl && fixedPartyData.posterUrl.trim() !== '') {
        console.log('포스터 이미지 추가:', fixedPartyData.posterUrl.substring(0, 50) + '...');
        posterHTML = `
            <div class="party-poster-wrapper">
                <img src="${fixedPartyData.posterUrl}" alt="파티 포스터" class="party-poster-modal" onclick="openImageModal('${fixedPartyData.posterUrl}')" style="max-width: 100%; height: auto; border-radius: 8px; cursor: pointer;">
            </div>
        `;
    } else {
        console.log('포스터 URL이 없습니다. 커스텀 포스터를 생성합니다.');
        
        // 커스텀 포스터 이미지 (base64) - 파티 제목에 맞는 커스텀 포스터
        const customPosterUrl = `data:image/svg+xml;base64,${btoa(`
            <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#ff6b3c"/>
                <text x="50%" y="30%" font-family="Arial" font-size="24" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">${fixedPartyData.title}</text>
                <text x="50%" y="50%" font-family="Arial" font-size="20" fill="white" text-anchor="middle" dy=".3em">파티 포스터</text>
                <text x="50%" y="70%" font-family="Arial" font-size="18" fill="white" text-anchor="middle" dy=".3em">${fixedPartyData.region || '지역'} ${fixedPartyData.barName || '바'}</text>
                <text x="50%" y="90%" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dy=".3em">🎉</text>
            </svg>
        `)}`;
        
        posterHTML = `
            <div class="party-poster-wrapper">
                <img src="${customPosterUrl}" alt="커스텀 포스터" class="party-poster-modal" style="max-width: 100%; height: auto; border-radius: 8px; cursor: pointer; border: 2px dashed #ccc;">
                <div style="text-align: center; margin-top: 0.5rem; color: #666; font-size: 0.9rem;">${fixedPartyData.title} 포스터</div>
            </div>
        `;
    }
    
    // 주소 정보 생성 (address 필드 우선, 없으면 region + location 조합)
    const region = party.region || '지역 미정';
    const location = party.location || '장소 미정';
    const fullAddress = party.address || `${region} ${location}`;
    
    console.log('생성된 주소:', fullAddress);
    console.log('파티 주소 정보:', {
        region: party.region,
        location: party.location,
        address: party.address
    });
    

    
    // 주소 정보 생성 (고정된 데이터 사용)
    const fixedRegion = fixedPartyData.region || '지역 미정';
    const fixedLocation = fixedPartyData.location || '장소 미정';
    const fixedFullAddress = fixedPartyData.address || `${fixedRegion} ${fixedLocation}`;
    
    console.log('=== 고정된 주소 정보 ===');
    console.log('고정된 지역:', fixedRegion);
    console.log('고정된 장소:', fixedLocation);
    console.log('고정된 전체 주소:', fixedFullAddress);
    
    modalInfo.innerHTML = `
        <div class="party-detail-info">
            <div class="party-info-row">
                <strong>📍 지역:</strong> ${fixedRegion}
            </div>
            <div class="party-info-row">
                <strong>💃 댄스:</strong> ${fixedPartyData.danceType || '댄스 분류 미정'}
            </div>
            <div class="party-info-row">
                <strong>🏢 바 이름:</strong> ${fixedPartyData.barName || '바 이름 미정'}
            </div>
            <div class="party-info-row">
                <div style="display: flex; align-items: center; flex: 1;">
                    <strong>🗺️ 상세주소:</strong>
                    <span class="address-text">${fixedFullAddress}</span>
                </div>
                <button class="copy-btn" onclick="copyAddress('${fixedFullAddress}')" title="주소 복사" style="background:#4CAF50;color:white;border:none;padding:4px 8px;border-radius:4px;margin-right:8px;font-size:12px;cursor:pointer;">📋 복사</button>
                <button class="map-btn" onclick="openMap('${fixedFullAddress}')" title="지도에서 보기">
                    <span>🗺️</span> 지도 보기
                </button>
            </div>
            <div class="party-info-row">
                <strong>🏢 층수:</strong> ${fixedPartyData.floor || '층수 정보 없음'}
            </div>
            <div class="party-info-row">
                <strong>📅 일시:</strong> ${formatPartyDateRange(fixedPartyData)} ${fixedPartyData.time ? fixedPartyData.time.substring(0, 5) : ''}
            </div>
            ${fixedPartyData.contact ? `
                <div class="party-info-row">
                    <strong>📞 연락처:</strong> ${fixedPartyData.contact}
                </div>
            ` : ''}
            <div class="party-info-row">
                <strong>👤 등록자:</strong> ${createdByInfo} ${isCurrentUserAuthor ? '(나)' : ''}
            </div>
            <div class="party-info-row">
                <strong>📅 등록일:</strong> ${fixedPartyData.createdAt || fixedPartyData.timestamp ? new Date(fixedPartyData.createdAt || fixedPartyData.timestamp).toLocaleDateString('ko-KR') : '등록일 정보 없음'}
            </div>
            ${fixedPartyData.likes !== undefined ? `
                <div class="party-info-row">
                    <strong>❤️ 좋아요:</strong> ${fixedPartyData.likes || 0}명이 좋아합니다
                </div>
            ` : ''}
            ${posterHTML}
            ${fixedPartyData.description ? `
                <div class="party-description-modal">
                    <div class="description-header">
                        <strong>📝 상세 설명</strong>
                    </div>
                    <div class="description-content">
                        ${escapeHtml(fixedPartyData.description).replace(/\n/g, '<br>')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // 갤러리와 댓글 표시
    displayGallery(party.gallery || []);
    displayComments(party.comments || []);
    
    // 모달에서 파티 카드의 상세 설명 완전 제거
    setTimeout(() => {
        // 1. 모든 .party-description 요소 제거
        const partyDescriptions = modal.querySelectorAll('.party-description');
        partyDescriptions.forEach(desc => {
            desc.remove();
        });
        
        // 2. "상세 설명:" 텍스트가 포함된 모든 요소 제거
        const allElements = modal.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && element.textContent.includes('상세 설명:') && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 3. 파티 카드에서 복사된 모든 요소 제거
        const partyCards = modal.querySelectorAll('.party-card');
        partyCards.forEach(card => {
            const cardDescriptions = card.querySelectorAll('.party-description');
            cardDescriptions.forEach(desc => {
                desc.remove();
            });
        });
        
        // 4. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            const allDivs = modalContent.querySelectorAll('div');
            allDivs.forEach(div => {
                if (div.textContent && div.textContent.includes('상세 설명:') && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
        }
        
        // 5. 모달 내에서 "상세 설명:" 텍스트가 포함된 모든 요소 제거 (더 강력한 방법)
        const allTextElements = modal.querySelectorAll('*');
        allTextElements.forEach(element => {
            if (element.textContent && element.textContent.trim() === '상세 설명:') {
                // "상세 설명:" 텍스트만 있는 요소 제거
                element.remove();
            } else if (element.textContent && element.textContent.includes('상세 설명:') && 
                      !element.classList.contains('party-description-modal') &&
                      !element.classList.contains('description-header') &&
                      !element.classList.contains('description-content')) {
                // "상세 설명:" 텍스트가 포함된 요소 제거
                element.remove();
            }
        });
        
        // 6. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (더 구체적)
        const allDivsInModal = modal.querySelectorAll('div');
        allDivsInModal.forEach(div => {
            if (div.textContent && div.textContent.includes('상세 설명:') && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 7. 모달 내에서 "📄 상세 설명:" 텍스트가 포함된 모든 요소 제거 (이모지 포함)
        const allEmojiElements = modal.querySelectorAll('*');
        allEmojiElements.forEach(element => {
            if (element.textContent && (element.textContent.includes('📄 상세 설명:') || element.textContent.includes('📄 상세 설명')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 8. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (이모지 포함)
        const allEmojiDivs = modal.querySelectorAll('div');
        allEmojiDivs.forEach(div => {
            if (div.textContent && (div.textContent.includes('📄 상세 설명:') || div.textContent.includes('📄 상세 설명')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 9. 모달 내에서 특정 텍스트가 포함된 모든 요소 제거 (내용 기반)
        const allContentElements = modal.querySelectorAll('*');
        allContentElements.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이') ||
                 element.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~') ||
                 element.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 10. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (내용 기반)
        const allContentDivs = modal.querySelectorAll('div');
        allContentDivs.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이') ||
                 div.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~') ||
                 div.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 11. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
        const allNewContentElements = modal.querySelectorAll('*');
        allNewContentElements.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('강원도 강릉에서 살사동호회를 시작한지 2년이 되었습니다') ||
                 element.textContent.includes('그동안 강릉으로 여행오신 여러 선배님들의 도움으로 조금씩 성장하게 되었습니다') ||
                 element.textContent.includes('작은 해변 파티를 시작으로 2025년 Goodbye Summer Party를 개최합니다') ||
                 element.textContent.includes('푸른 해변과 함께 열정적인 밤을 함께해주세요') ||
                 element.textContent.includes('Muy Rico 매우 풍요로운 뜻의 동호회 이름답게 다양한 실내/야외 행사로 준비해 보겠습니다') ||
                 element.textContent.includes('감사합니다. -시샵 네모-')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 12. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
        const allNewContentDivs = modal.querySelectorAll('div');
        allNewContentDivs.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('강원도 강릉에서 살사동호회를 시작한지 2년이 되었습니다') ||
                 div.textContent.includes('그동안 강릉으로 여행오신 여러 선배님들의 도움으로 조금씩 성장하게 되었습니다') ||
                 div.textContent.includes('작은 해변 파티를 시작으로 2025년 Goodbye Summer Party를 개최합니다') ||
                 div.textContent.includes('푸른 해변과 함께 열정적인 밤을 함께해주세요') ||
                 div.textContent.includes('Muy Rico 매우 풍요로운 뜻의 동호회 이름답게 다양한 실내/야외 행사로 준비해 보겠습니다') ||
                 div.textContent.includes('감사합니다. -시샵 네모-')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 13. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
        const allNewContentElements2 = modal.querySelectorAll('*');
        allNewContentElements2.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('20대에 시작한 살사 종신까지 하리다')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 14. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
        const allNewContentDivs2 = modal.querySelectorAll('div');
        allNewContentDivs2.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('20대에 시작한 살사 종신까지 하리다')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        // 15. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
        const allNewContentElements3 = modal.querySelectorAll('*');
        allNewContentElements3.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이 (음비 바4 살2)') ||
                 element.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~😊') ||
                 element.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !element.classList.contains('party-description-modal') &&
                !element.classList.contains('description-header') &&
                !element.classList.contains('description-content')) {
                element.remove();
            }
        });
        
        // 16. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
        const allNewContentDivs3 = modal.querySelectorAll('div');
        allNewContentDivs3.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이 (음비 바4 살2)') ||
                 div.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~😊') ||
                 div.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                !div.classList.contains('party-description-modal') &&
                !div.classList.contains('description-header') &&
                !div.classList.contains('description-content')) {
                div.remove();
            }
        });
        
        console.log('파티 카드의 상세 설명 완전 삭제 완료');
    }, 100);
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    console.log('모달 표시 완료');
    
    // 모든 파티 모달 강제 표시
    console.log('모달 강제 표시 시작:', party.title);
    setTimeout(() => {
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.maxWidth = '90%';
            modalContent.style.maxHeight = '90%';
            modalContent.style.overflow = 'auto';
        }
        
        console.log('모달 강제 표시 완료:', party.title);
    }, 100);
}

// 모달이 없을 때 직접 생성하는 함수
function createAndShowModal(party) {
    console.log('=== createAndShowModal 시작 ===');
    console.log('전달받은 파티 데이터:', party);
    console.log('파티 ID:', party.id);
    console.log('파티 제목:', party.title);
    console.log('파티 지역:', party.region);
    console.log('파티 바 이름:', party.barName);
    console.log('파티 주소:', party.address);
    console.log('파티 포스터 URL:', party.posterUrl);
    console.log('파티 설명:', party.description);
    
    // 파티 데이터 검증 강화
    if (!party || !party.id) {
        console.error('유효하지 않은 파티 데이터:', party);
        return;
    }
    
    // 파티 데이터 무결성 검증
    if (!party.title || typeof party.title !== 'string') {
        console.error('파티 제목이 유효하지 않습니다:', party.title);
        return;
    }
    
    console.log('=== 파티 데이터 검증 완료 ===');
    
    // 기존 모달이 있다면 제거
    const existingModal = document.getElementById('party-modal');
    if (existingModal) {
        console.log('기존 모달 제거');
        existingModal.remove();
    }
    
    const date = new Date(party.date);
    const formattedDate = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // 모달 HTML 생성
    const modalHTML = `
        <div id="party-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modal-party-title">${party.title}</h3>
                    <button class="close-btn" onclick="closePartyModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="modal-party-info">
                        <div class="party-detail-info">
                            <div class="party-info-row">
                                <strong>📍 지역:</strong> ${party.region || '지역 미정'}
                            </div>
                            <div class="party-info-row">
                                <strong>💃 댄스:</strong> ${party.danceType || '댄스 분류 미정'}
                            </div>
                            <div class="party-info-row">
                                <strong>🏢 바 이름:</strong> ${party.barName || '바 이름 미정'}
                            </div>
                            <div class="party-info-row">
                                <div style="display: flex; align-items: center; flex: 1;">
                                    <strong>🗺️ 상세주소:</strong>
                                    <span class="address-text">${party.address || `${party.region || '지역 미정'} ${party.location || '장소 미정'}`}</span>
                                </div>
                                <button class="copy-btn" onclick="copyAddress('${party.address || `${party.region || '지역 미정'} ${party.location || '장소 미정'}`}')" title="주소 복사" style="background:#4CAF50;color:white;border:none;padding:4px 8px;border-radius:4px;margin-right:8px;font-size:12px;cursor:pointer;">📋 복사</button>
                                <button class="map-btn" onclick="openMap('${party.address || `${party.region || '지역 미정'} ${party.location || '장소 미정'}`}')" title="지도에서 보기">
                                    <span>🗺️</span> 지도 보기
                                </button>
                            </div>
                            <div class="party-info-row">
                                <strong>🏢 층수:</strong> ${party.floor || '층수 정보 없음'}
                            </div>
                            <div class="party-info-row">
                                <strong>📅 일시:</strong> ${formatPartyDateRange(party)} ${party.time ? party.time.substring(0, 5) : ''}
                            </div>
                            ${party.contact ? `
                                <div class="party-info-row">
                                    <strong>📞 연락처:</strong> ${party.contact}
                                </div>
                            ` : ''}
                            <div class="party-info-row">
                                <strong>👤 등록자:</strong> ${party.author || party.createdBy || party.createdByDisplayName || '등록자 정보 없음'}
                            </div>
                            <div class="party-info-row">
                                <strong>📅 등록일:</strong> ${party.createdAt || party.timestamp ? new Date(party.createdAt || party.timestamp).toLocaleDateString('ko-KR') : '등록일 정보 없음'}
                            </div>
                            ${party.likes !== undefined ? `
                                <div class="party-info-row">
                                    <strong>❤️ 좋아요:</strong> ${party.likes || 0}명이 좋아합니다
                                </div>
                            ` : ''}
                            ${party.posterUrl ? `
                                <div class="party-poster-wrapper">
                                    <img src="${party.posterUrl}" alt="파티 포스터" class="party-poster-modal" onclick="openImageModal('${party.posterUrl}')" style="max-width: 100%; height: auto; border-radius: 8px; cursor: pointer;">
                                </div>
                            ` : `
                                <div class="party-poster-wrapper">
                                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY2YjNjIi8+CiAgPHRleHQgeD0iNTAlIiB5PSIzMCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RXogTGF0aW48L3RleHQ+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7qs7DsnbTrr7jsp4DsnYw8L3RleHQ+CiAgPHRleHQgeD0iNTAlIiB5PSI3MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7sl4bsnYwgM+uMgOq1rDwvdGV4dD4KICA8dGV4dCB4PSI1MCUiIHk9IjkwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfkY08L3RleHQ+Cjwvc3ZnPg==" alt="테스트 포스터" class="party-poster-modal" style="max-width: 100%; height: auto; border-radius: 8px; cursor: pointer; border: 2px dashed #ccc;">
                                    <div style="text-align: center; margin-top: 0.5rem; color: #666; font-size: 0.9rem;">테스트 포스터</div>
                                </div>
                            `}
                            ${party.description ? `
                                <div class="party-description-modal">
                                    <div class="description-header">
                                        <strong>📝 상세 설명</strong>
                                    </div>
                                    <div class="description-content">
                                        ${escapeHtml(party.description).replace(/\n/g, '<br>')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- 갤러리 섹션 -->
                    <div class="gallery-section">
                        <h4>📸 파티 갤러리</h4>
                        <div class="gallery-upload">
                            <input type="file" id="gallery-files" multiple accept="image/*" style="display: none;">
                            <button onclick="document.getElementById('gallery-files').click()">사진 업로드</button>
                            <button onclick="uploadGalleryImages()">업로드 시작</button>
                        </div>
                        <div id="gallery-container">
                            <!-- 갤러리 이미지들이 여기에 표시됩니다 -->
                        </div>
                    </div>
                    
                    <!-- 댓글 섹션 -->
                    <div class="comments-section">
                        <h4>💬 댓글</h4>
                        <div class="comment-form">
                            <input type="text" id="comment-author" placeholder="닉네임" maxlength="20">
                            <textarea id="comment-text" placeholder="댓글을 입력하세요..." rows="3" maxlength="200"></textarea>
                            <button onclick="addNewComment()">댓글 작성</button>
                        </div>
                        <div id="comments-container">
                            <!-- 댓글들이 여기에 표시됩니다 -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // body에 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 갤러리와 댓글 표시
    setTimeout(() => {
        displayGallery(party.gallery || []);
        displayComments(party.comments || []);
        
        // 모달에서 파티 카드의 상세 설명 완전 제거 (16단계)
        const modal = document.getElementById('party-modal');
        if (modal) {
            // 1. 모든 .party-description 요소 제거
            const partyDescriptions = modal.querySelectorAll('.party-description');
            partyDescriptions.forEach(desc => {
                desc.remove();
            });
            
            // 2. "상세 설명:" 텍스트가 포함된 모든 요소 제거
            const allElements = modal.querySelectorAll('*');
            allElements.forEach(element => {
                if (element.textContent && element.textContent.includes('상세 설명:') && 
                    !element.classList.contains('party-description-modal') &&
                    !element.classList.contains('description-header') &&
                    !element.classList.contains('description-content')) {
                    element.remove();
                }
            });
            
            // 3. 파티 카드에서 복사된 모든 요소 제거
            const partyCards = modal.querySelectorAll('.party-card');
            partyCards.forEach(card => {
                const cardDescriptions = card.querySelectorAll('.party-description');
                cardDescriptions.forEach(desc => {
                    desc.remove();
                });
            });
            
            // 4. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                const allDivs = modalContent.querySelectorAll('div');
                allDivs.forEach(div => {
                    if (div.textContent && div.textContent.includes('상세 설명:') && 
                        !div.classList.contains('party-description-modal') &&
                        !div.classList.contains('description-header') &&
                        !div.classList.contains('description-content')) {
                        div.remove();
                    }
                });
            }
            
            // 5. 모달 내에서 "상세 설명:" 텍스트가 포함된 모든 요소 제거 (더 강력한 방법)
            const allTextElements = modal.querySelectorAll('*');
            allTextElements.forEach(element => {
                if (element.textContent && element.textContent.trim() === '상세 설명:') {
                    element.remove();
                } else if (element.textContent && element.textContent.includes('상세 설명:') && 
                          !element.classList.contains('party-description-modal') &&
                          !element.classList.contains('description-header') &&
                          !element.classList.contains('description-content')) {
                    element.remove();
                }
            });
            
            // 6. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (더 구체적)
            const allDivsInModal = modal.querySelectorAll('div');
            allDivsInModal.forEach(div => {
                if (div.textContent && div.textContent.includes('상세 설명:') && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
            
            // 7. 모달 내에서 "📄 상세 설명:" 텍스트가 포함된 모든 요소 제거 (이모지 포함)
            const allEmojiElements = modal.querySelectorAll('*');
            allEmojiElements.forEach(element => {
                if (element.textContent && (element.textContent.includes('📄 상세 설명:') || element.textContent.includes('📄 상세 설명')) && 
                    !element.classList.contains('party-description-modal') &&
                    !element.classList.contains('description-header') &&
                    !element.classList.contains('description-content')) {
                    element.remove();
                }
            });
            
            // 8. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (이모지 포함)
            const allEmojiDivs = modal.querySelectorAll('div');
            allEmojiDivs.forEach(div => {
                if (div.textContent && (div.textContent.includes('📄 상세 설명:') || div.textContent.includes('📄 상세 설명')) && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
            
            // 9. 모달 내에서 특정 텍스트가 포함된 모든 요소 제거 (내용 기반)
            const allContentElements = modal.querySelectorAll('*');
            allContentElements.forEach(element => {
                if (element.textContent && 
                    (element.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이') ||
                     element.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~') ||
                     element.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                    !element.classList.contains('party-description-modal') &&
                    !element.classList.contains('description-header') &&
                    !element.classList.contains('description-content')) {
                    element.remove();
                }
            });
            
            // 10. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (내용 기반)
            const allContentDivs = modal.querySelectorAll('div');
            allContentDivs.forEach(div => {
                if (div.textContent && 
                    (div.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이') ||
                     div.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~') ||
                     div.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
            
            // 11. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
            const allNewContentElements = modal.querySelectorAll('*');
            allNewContentElements.forEach(element => {
                if (element.textContent && 
                    (element.textContent.includes('강원도 강릉에서 살사동호회를 시작한지 2년이 되었습니다') ||
                     element.textContent.includes('그동안 강릉으로 여행오신 여러 선배님들의 도움으로 조금씩 성장하게 되었습니다') ||
                     element.textContent.includes('작은 해변 파티를 시작으로 2025년 Goodbye Summer Party를 개최합니다') ||
                     element.textContent.includes('푸른 해변과 함께 열정적인 밤을 함께해주세요') ||
                     element.textContent.includes('Muy Rico 매우 풍요로운 뜻의 동호회 이름답게 다양한 실내/야외 행사로 준비해 보겠습니다') ||
                     element.textContent.includes('감사합니다. -시샵 네모-')) && 
                    !element.classList.contains('party-description-modal') &&
                    !element.classList.contains('description-header') &&
                    !element.classList.contains('description-content')) {
                    element.remove();
                }
            });
            
            // 12. 모달 내에서 파티 카드의 상세 설명과 유사한 구조 제거 (내용 기반)
            const allNewContentDivs = modal.querySelectorAll('div');
            allNewContentDivs.forEach(div => {
                if (div.textContent && 
                    (div.textContent.includes('강원도 강릉에서 살사동호회를 시작한지 2년이 되었습니다') ||
                     div.textContent.includes('그동안 강릉으로 여행오신 여러 선배님들의 도움으로 조금씩 성장하게 되었습니다') ||
                     div.textContent.includes('작은 해변 파티를 시작으로 2025년 Goodbye Summer Party를 개최합니다') ||
                     div.textContent.includes('푸른 해변과 함께 열정적인 밤을 함께해주세요') ||
                     div.textContent.includes('Muy Rico 매우 풍요로운 뜻의 동호회 이름답게 다양한 실내/야외 행사로 준비해 보겠습니다') ||
                     div.textContent.includes('감사합니다. -시샵 네모-')) && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
            
            // 13. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
            const allNewContentElements2 = modal.querySelectorAll('*');
            allNewContentElements2.forEach(element => {
                if (element.textContent && 
                    (element.textContent.includes('20대에 시작한 살사 종신까지 하리다')) && 
                    !element.classList.contains('party-description-modal') &&
                    !element.classList.contains('description-header') &&
                    !element.classList.contains('description-content')) {
                    element.remove();
                }
            });
            
            // 14. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
            const allNewContentDivs2 = modal.querySelectorAll('div');
            allNewContentDivs2.forEach(div => {
                if (div.textContent && 
                    (div.textContent.includes('20대에 시작한 살사 종신까지 하리다')) && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
            
            // 15. 모달 내에서 새로운 파티 내용이 포함된 모든 요소 제거 (내용 기반)
            const allNewContentElements3 = modal.querySelectorAll('*');
            allNewContentElements3.forEach(element => {
                if (element.textContent && 
                    (element.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이 (음비 바4 살2)') ||
                     element.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~😊') ||
                     element.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                    !element.classList.contains('party-description-modal') &&
                    !element.classList.contains('description-header') &&
                    !element.classList.contains('description-content')) {
                    element.remove();
                }
            });
            
            // 16. 모달 내에서 새로운 파티 내용이 포함된 모든 div 제거 (내용 기반)
            const allNewContentDivs3 = modal.querySelectorAll('div');
            allNewContentDivs3.forEach(div => {
                if (div.textContent && 
                    (div.textContent.includes('매월 마지막주 전주 라틴크루즈에서 진행하는 바차타 특화 소셜데이 (음비 바4 살2)') ||
                     div.textContent.includes('감미로운 바차타 전문 디제이 DJ Cupid의 음악을 만나보아요~😊') ||
                     div.textContent.includes('문의 : 그리셀 010-3703-5240 동호회 : 라틴크루즈')) && 
                    !div.classList.contains('party-description-modal') &&
                    !div.classList.contains('description-header') &&
                    !div.classList.contains('description-content')) {
                    div.remove();
                }
            });
            
            console.log('createAndShowModal: 파티 카드의 상세 설명 완전 삭제 완료');
        }
    }, 50);
    
    // 모달 외부 클릭 시 닫기 이벤트 추가
    const modal = document.getElementById('party-modal');
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closePartyModal();
        }
    });
    
    console.log('새 모달 생성 및 표시 완료');
    
    // 상세 모달 자동 번역 (영어 모드일 때)
    if (typeof isEnglish !== 'undefined' && typeof translatePartyCardsAndDetails === 'function') {
        translatePartyCardsAndDetails(isEnglish ? 'en' : 'ko');
    }
}

// 파티 모달 닫기
function closePartyModal() {
    const modal = document.getElementById('party-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    // URL에서 파티 파라미터 제거
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('party')) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        console.log('URL에서 파티 파라미터 제거됨');
    }
    
    console.log('모달 닫기 완료');
}

// 파티 편집 (개선된 버전)
async function editParty(partyId) {
    try {
        console.log('=== 파티 편집 시작 ===');
        console.log('파티 ID:', partyId);
        console.log('현재 사용자:', currentUser);
        
        // 권한 체크
        if (!currentUser) {
            console.log('사용자가 로그인되지 않음');
            showMessage('로그인이 필요합니다.', 'error');
            return;
        }
        
        // Firebase DB 객체 확인
        console.log('Firebase DB 객체:', db);
        console.log('window.db 객체:', window.db);
        
        if (!db && window.db) {
            console.log('전역 db 객체를 사용합니다.');
            db = window.db;
        }
        
        if (!db) {
            console.error('Firebase DB 객체를 찾을 수 없습니다!');
            showMessage('Firebase 연결에 실패했습니다.', 'error');
            return;
        }
        
        console.log('파티 정보 가져오기 시작...');
        
        const doc = await db.collection('parties').doc(partyId).get();
        console.log('Firestore 문서 조회 결과:', doc.exists ? '존재함' : '존재하지 않음');
        
        if (!doc.exists) {
            console.log('파티를 찾을 수 없음:', partyId);
            showMessage('파티를 찾을 수 없습니다. 새로 등록하시겠습니까?', 'error');
            
            // 편집 모드 종료하고 새 등록 모드로 전환
            editingPartyId = null;
            const cancelEditBtn = document.getElementById('cancel-edit-btn');
            if (cancelEditBtn) {
                cancelEditBtn.classList.add('hidden');
            }
            
            // 폼 초기화
            const form = document.getElementById('party-form');
            if (form) {
                form.reset();
            }
            
            return;
        }
        
        const party = doc.data();
        console.log('편집할 파티 데이터:', party);
        
        // 편집 권한 확인
        console.log('편집 권한 확인 시작...');
        const hasPermission = canEdit(party);
        console.log('편집 권한 확인 결과:', hasPermission);
        
        if (!hasPermission) {
            console.log('편집 권한이 없음');
            showMessage('편집 권한이 없습니다.', 'error');
            return;
        }
        
        console.log('편집 권한 확인됨, 폼에 데이터 채우기 시작...');
        
        // 폼에 데이터 채우기
        const titleField = document.getElementById('party-title');
        const regionField = document.getElementById('party-region');
        const barNameField = document.getElementById('party-bar-name');
        const addressField = document.getElementById('party-address');
        const locationField = document.getElementById('party-location');
        const startDateField = document.getElementById('party-start-date');
        const endDateField = document.getElementById('party-end-date');
        const durationField = document.getElementById('party-duration');
        const timeField = document.getElementById('party-time');
        const descriptionField = document.getElementById('party-description');
        const contactField = document.getElementById('party-contact');
        
        if (titleField) titleField.value = party.title || '';
        if (regionField) regionField.value = party.region || '';
        if (barNameField) barNameField.value = party.barName || '';
        if (addressField) addressField.value = party.address || '';
        if (locationField) locationField.value = party.location || '';
        
        // 새로운 날짜 범위 시스템 지원
        if (startDateField) startDateField.value = party.startDate || party.date || '';
        if (endDateField) endDateField.value = party.endDate || party.date || '';
        if (durationField) durationField.value = party.duration || '1';
        
        if (timeField) timeField.value = party.time || '';
        if (descriptionField) descriptionField.value = party.description || '';
        if (contactField) contactField.value = party.contact || '';
        
        console.log('폼 데이터 채우기 완료');
        
        // 포스터 미리보기
        const posterPreview = document.getElementById('poster-preview');
        if (posterPreview && party.posterUrl) {
            posterPreview.innerHTML = `<img src="${party.posterUrl}" alt="포스터 미리보기">`;
            console.log('포스터 미리보기 설정 완료');
        }
        
        // 편집 모드 설정
        editingPartyId = partyId;
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.classList.remove('hidden');
        }
        
        console.log('편집 모드 설정 완료, editingPartyId:', editingPartyId);
        
        // 해당 섹션으로 스크롤
        scrollToSection('party-registration');
        
        showMessage(`"${party.title}" 파티 정보를 편집 폼에 불러왔습니다. 수정 후 제출해주세요.`, 'info');
        console.log('편집 모드 설정 완료');
        
    } catch (error) {
        console.error('파티 편집 실패:', error);
        console.error('에러 상세 정보:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        showMessage('파티 정보를 불러오는데 실패했습니다: ' + error.message, 'error');
    }
}

// 편집 취소
function cancelEdit() {
    editingPartyId = null;
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('party-form').reset();
    document.getElementById('poster-preview').innerHTML = '';
}

// 파티 삭제 (개선된 버전)
async function deleteParty(partyId) {
    console.log('=== 파티 삭제 시작 ===');
    console.log('파티 ID:', partyId);
    console.log('현재 사용자:', currentUser);
    
    // 권한 체크
    if (!currentUser) {
        console.log('사용자가 로그인되지 않음');
        showMessage('로그인이 필요합니다.', 'error');
        return;
    }
    
    // Firebase DB 객체 확인
    console.log('Firebase DB 객체:', db);
    console.log('window.db 객체:', window.db);
    
    if (!db && window.db) {
        console.log('전역 db 객체를 사용합니다.');
        db = window.db;
    }
    
    if (!db) {
        console.error('Firebase DB 객체를 찾을 수 없습니다!');
        showMessage('Firebase 연결에 실패했습니다.', 'error');
        return;
    }
    
    try {
        console.log('파티 정보 가져오기 시작...');
        
        // 파티 정보 가져오기
        const doc = await db.collection('parties').doc(partyId).get();
        console.log('Firestore 문서 조회 결과:', doc.exists ? '존재함' : '존재하지 않음');
        
        if (!doc.exists) {
            console.log('파티를 찾을 수 없음:', partyId);
            showMessage('파티를 찾을 수 없습니다.', 'error');
            return;
        }
        
        const party = doc.data();
        console.log('파티 데이터:', party);
        
        // 삭제 권한 확인
        console.log('삭제 권한 확인 시작...');
        const hasPermission = canEdit(party);
        console.log('삭제 권한 확인 결과:', hasPermission);
        
        if (!hasPermission) {
            console.log('삭제 권한이 없음');
            showMessage('삭제 권한이 없습니다.', 'error');
            return;
        }
        
        console.log('삭제 권한 확인됨, 확인 대화상자 표시');
        
        // 확인 대화상자
        if (!confirm(`정말로 "${party.title}" 파티를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
            console.log('사용자가 삭제를 취소함');
            return;
        }
        
        console.log('사용자가 삭제를 확인함, 삭제 시작...');
        showLoading();
        
        // Firebase에서 삭제
        console.log('Firestore에서 파티 삭제 시작...');
        await db.collection('parties').doc(partyId).delete();
        console.log('Firestore에서 파티 삭제 완료');
        
        // 로컬 스토리지에서도 삭제
        try {
            const storedParties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
            const filteredParties = storedParties.filter(p => p.id !== partyId);
            localStorage.setItem('latinDanceParties', JSON.stringify(filteredParties));
            console.log('로컬 스토리지에서도 파티 삭제 완료');
        } catch (localError) {
            console.log('로컬 스토리지 삭제 실패 (무시):', localError);
        }
        
        showMessage('파티가 성공적으로 삭제되었습니다.', 'success');
        console.log('파티 삭제 성공 메시지 표시');
        
        // 파티 목록 새로고침
        console.log('파티 목록 새로고침 시작...');
        await loadParties();
        console.log('파티 목록 새로고침 완료');
        
    } catch (error) {
        console.error('파티 삭제 실패:', error);
        console.error('에러 상세 정보:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        showMessage('파티 삭제에 실패했습니다: ' + error.message, 'error');
    } finally {
        hideLoading();
        console.log('=== 파티 삭제 완료 ===');
    }
}

// 파티 필터링
function filterParties() {
    const regionFilter = document.getElementById('region-filter').value;
    const danceTypeFilter = document.getElementById('dance-type-filter').value;
    const dateFilter = document.getElementById('date-filter').value;
    
    const partyCards = document.querySelectorAll('.party-card');
    
    partyCards.forEach(card => {
        let show = true;
        
        // 지역 필터
        if (regionFilter && !card.textContent.includes(regionFilter)) {
            show = false;
        }
        
        // 댄스 분류 필터
        if (danceTypeFilter && !card.textContent.includes(danceTypeFilter)) {
            show = false;
        }
        
        // 날짜 필터
        if (dateFilter) {
            const partyDate = card.querySelector('.party-info').textContent;
            if (!partyDate.includes(dateFilter)) {
                show = false;
            }
        }
        
        card.style.display = show ? 'block' : 'none';
    });
}

// 섹션으로 스크롤 이동
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// 로딩 표시
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

// 로딩 숨김
function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

// 메시지 표시
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    
    // 기존 메시지 제거
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    // 새 메시지 추가
    document.body.appendChild(messageDiv);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
    }
});

// 지도보기 함수
function openMap(address) {
    console.log('지도보기:', address);
    if (!address || address === '주소 미정') {
        showMessage('주소 정보가 없습니다.', 'error');
        return;
    }
    const encodedAddress = encodeURIComponent(address);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(mapUrl, '_blank');
}


console.log('파티 앱 JavaScript 로드 완료');

// 전역 함수로 등록 (onclick 이벤트를 위해)
window.editParty = editParty;
window.deleteParty = deleteParty;
window.toggleLike = toggleLike;
window.viewParty = viewParty;
window.openMap = openMap;
window.openImageModal = openImageModal;

// 디버깅을 위한 전역 함수들
window.debugEditParty = function(partyId) {
    console.log('editParty 호출됨:', partyId);
    console.log('editParty 함수 존재:', typeof editParty);
    console.log('현재 사용자:', currentUser);
    if (typeof editParty === 'function') {
        editParty(partyId);
    } else {
        console.error('editParty 함수가 정의되지 않음');
    }
};

window.debugDeleteParty = function(partyId) {
    console.log('deleteParty 호출됨:', partyId);
    console.log('deleteParty 함수 존재:', typeof deleteParty);
    console.log('현재 사용자:', currentUser);
    if (typeof deleteParty === 'function') {
        deleteParty(partyId);
    } else {
        console.error('deleteParty 함수가 정의되지 않음');
    }
}; 

// 갤러리 표시 함수
function displayGallery(gallery) {
    const galleryContainer = document.getElementById('gallery-container');
    
    if (!galleryContainer) {
        console.log('갤러리 컨테이너를 찾을 수 없습니다.');
        return;
    }
    
    if (!gallery || gallery.length === 0) {
        galleryContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 1rem;">아직 업로드된 사진이 없습니다. 첫 번째 사진을 업로드해보세요! 📸</p>';
        return;
    }
    
    galleryContainer.innerHTML = gallery.map(item => `
        <div class="gallery-item" onclick="openImageModal('${item.url}')">
            <img src="${item.url}" alt="파티 사진" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;">
        </div>
    `).join('');
}

// 댓글 표시 함수
function displayComments(comments) {
    const commentsContainer = document.getElementById('comments-container');
    
    if (!commentsContainer) {
        console.log('댓글 컨테이너를 찾을 수 없습니다.');
        return;
    }
    
    if (!comments || comments.length === 0) {
        commentsContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 1rem;">아직 댓글이 없습니다. 첫 댓글을 남겨보세요! 💬</p>';
        return;
    }
    
    // 댓글을 최신순으로 정렬
    const sortedComments = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    commentsContainer.innerHTML = sortedComments.map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-date">${formatCommentDate(comment.createdAt)}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
        </div>
    `).join('');
}

// 이미지 모달 열기
function openImageModal(imageUrl) {
    console.log('이미지 모달 열기:', imageUrl);
    
    // 기존 이미지 모달이 있는지 확인
    let imageModal = document.getElementById('image-modal');
    
    if (!imageModal) {
        // 이미지 모달이 없으면 생성
        const imageModalHTML = `
            <div id="image-modal" class="modal">
                <div class="modal-content image-modal-content">
                    <button class="close-btn" onclick="closeImageModal()">&times;</button>
                    <img id="modal-image" src="" alt="확대 이미지">
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', imageModalHTML);
        imageModal = document.getElementById('image-modal');
        
        // 모달 외부 클릭 시 닫기
        imageModal.addEventListener('click', function(event) {
            if (event.target === imageModal) {
                closeImageModal();
            }
        });
        
        // ESC 키로 닫기
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && !imageModal.classList.contains('hidden')) {
                closeImageModal();
            }
        });
    }
    
    // 이미지 로드 후 모달 표시
    const modalImage = document.getElementById('modal-image');
    modalImage.onload = function() {
        imageModal.classList.remove('hidden');
        console.log('이미지 모달 표시 완료');
    };
    
    modalImage.onerror = function() {
        console.error('이미지 로드 실패:', imageUrl);
        showMessage('이미지를 불러올 수 없습니다.', 'error');
    };
    
    modalImage.src = imageUrl;
}

// 이미지 모달 닫기
function closeImageModal() {
    const imageModal = document.getElementById('image-modal');
    if (imageModal) {
        if (imageModal.classList.contains('hidden')) {
            imageModal.classList.add('hidden');
        } else {
            imageModal.remove();
        }
    }
}

// 테스트용 파티 데이터 생성
function createTestParty() {
    console.log('테스트용 파티 생성 중...');
    console.log('현재 파티 ID:', currentPartyId);
    
    // 기존 파티 데이터에서 포스터 URL 가져오기
    const existingParties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    const existingParty = existingParties.find(p => p.id === currentPartyId);
    const posterUrl = existingParty ? existingParty.posterUrl : '';
    
    console.log('기존 포스터 URL:', posterUrl);
    
    const testParty = {
        id: currentPartyId, // 현재 파티 ID를 정확히 사용
        title: 'EZ Latin 가리온&선녀 Season3',
        region: '서울',
        location: '강남구 테스트 댄스스튜디오',
        date: new Date().toISOString().split('T')[0], // 오늘 날짜
        time: '19:00',
        description: '시즌3 스타트~',
        contact: '010-1234-5678',
        posterUrl: posterUrl, // 기존 포스터 URL 유지
        gallery: existingParty ? (existingParty.gallery || []) : [],
        comments: existingParty ? (existingParty.comments || []) : [],
        likes: existingParty ? (existingParty.likes || []) : [],
        createdAt: new Date().toISOString(),
        author: '테스트 사용자'
    };
    
    // 기존 파티 데이터 가져오기
    const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    console.log('기존 파티들:', parties.map(p => ({ id: p.id, title: p.title })));
    
    // 같은 ID의 파티가 있는지 확인
    const existingIndex = parties.findIndex(p => p.id === currentPartyId);
    console.log('기존 파티 인덱스:', existingIndex);
    
    if (existingIndex !== -1) {
        // 기존 파티 업데이트 (기존 데이터 유지하면서 새 데이터로 덮어쓰기)
        const updatedParty = { ...parties[existingIndex], ...testParty };
        // 기존 데이터 중 중요한 것들은 유지
        updatedParty.posterUrl = parties[existingIndex].posterUrl || testParty.posterUrl;
        updatedParty.gallery = parties[existingIndex].gallery || testParty.gallery;
        updatedParty.comments = parties[existingIndex].comments || testParty.comments;
        updatedParty.likes = parties[existingIndex].likes || testParty.likes;
        
        parties[existingIndex] = updatedParty;
        console.log('기존 테스트 파티 업데이트됨');
    } else {
        // 새 파티 추가
        parties.push(testParty);
        console.log('새 테스트 파티 추가됨');
    }
    
    // 로컬 스토리지에 저장
    localStorage.setItem('latinDanceParties', JSON.stringify(parties));
    console.log('테스트 파티 저장 완료:', testParty);
    
    // 저장 후 확인
    const savedParties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    const savedParty = savedParties.find(p => p.id === currentPartyId);
    console.log('저장 후 파티 확인:', savedParty ? '찾음' : '못찾음');
    if (savedParty) {
        console.log('저장된 파티 포스터 URL:', savedParty.posterUrl);
    }
    
    return testParty;
}

// 갤러리 이미지 업로드 (수정됨)
async function uploadGalleryImages() {
    console.log('uploadGalleryImages 함수 시작');
    
    const fileInput = document.getElementById('gallery-files');
    console.log('파일 입력 요소:', fileInput);
    
    if (!fileInput) {
        console.error('gallery-files 요소를 찾을 수 없습니다!');
        showMessage('갤러리 파일 입력 요소를 찾을 수 없습니다.', 'error');
        return;
    }
    
    const files = fileInput.files;
    console.log('선택된 파일들:', files);
    
    if (!files || files.length === 0) {
        console.log('선택된 파일이 없습니다.');
        showMessage('업로드할 이미지를 선택해주세요.', 'error');
        return;
    }
    
    console.log('현재 파티 ID:', currentPartyId);
    if (!currentPartyId) {
        console.error('currentPartyId가 설정되지 않았습니다!');
        showMessage('파티를 선택해주세요.', 'error');
        return;
    }
    
    try {
        // 로컬 스토리지 용량 확인 및 정리
        const availableSpace = checkLocalStorageQuota();
        if (availableSpace < 1 * 1024 * 1024) { // 1MB 미만이면 정리
            console.log('로컬 스토리지 용량 부족, 자동 정리 시작');
            cleanupLocalStorage();
        }
        
        showLoading();
        showUploadProgress('이미지 업로드를 시작합니다...');
        
        let uploadedCount = 0;
        const totalFiles = Math.min(files.length, 5); // 최대 5개까지
        console.log(`총 ${totalFiles}개 파일 처리 시작`);
        
        for (let i = 0; i < totalFiles; i++) {
            const file = files[i];
            console.log(`파일 ${i + 1} 처리 중:`, file.name, file.size, file.type);
            
            // 파일 크기 체크 (5MB 제한)
            if (file.size > 5 * 1024 * 1024) {
                console.log(`${file.name}은 5MB를 초과합니다.`);
                showMessage(`${file.name}은 5MB를 초과합니다.`, 'error');
                continue;
            }
            
            // 파일 타입 체크
            if (!file.type.startsWith('image/')) {
                console.log(`${file.name}은 이미지 파일이 아닙니다.`);
                showMessage(`${file.name}은 이미지 파일이 아닙니다.`, 'error');
                continue;
            }
            
            // 진행 상황 업데이트
            showUploadProgress(`업로드 중... (${i + 1}/${totalFiles}) - ${file.name}`);
            
            // 이미지 압축 및 변환
            const galleryItem = await compressImageToBase64(file, i);
            
            // 로컬 스토리지에서 파티 데이터 업데이트
            const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
            console.log('로컬 스토리지 파티들:', parties.length);
            console.log('현재 파티 ID:', currentPartyId);
            console.log('모든 파티 ID들:', parties.map(p => p.id));
            
            const partyIndex = parties.findIndex(p => p.id === currentPartyId);
            console.log('파티 인덱스:', partyIndex);
            
            if (partyIndex !== -1) {
                console.log('파티를 찾았습니다:', parties[partyIndex].title);
                if (!parties[partyIndex].gallery) {
                    parties[partyIndex].gallery = [];
                    console.log('갤러리 배열 초기화');
                }
                
                parties[partyIndex].gallery.push(galleryItem);
                console.log('갤러리 아이템 추가됨:', galleryItem.id);
                
                try {
                    localStorage.setItem('latinDanceParties', JSON.stringify(parties));
                    uploadedCount++;
                } catch (storageError) {
                    if (storageError.name === 'QuotaExceededError') {
                        console.warn('로컬 스토리지 용량 초과, 자동 정리 후 재시도');
                        cleanupLocalStorage();
                        
                        // 정리 후 다시 저장 시도
                        try {
                            localStorage.setItem('latinDanceParties', JSON.stringify(parties));
                            uploadedCount++;
                            console.log('정리 후 저장 성공');
                        } catch (retryError) {
                            console.error('정리 후에도 저장 실패:', retryError);
                            showMessage('저장 공간이 부족하여 이미지를 저장할 수 없습니다. 오래된 이미지를 삭제해주세요.', 'error');
                            continue;
                        }
                    } else {
                        throw storageError;
                    }
                }
                
                // 갤러리 새로고침 (새로 업로드된 아이템 강조)
                displayGallery(parties[partyIndex].gallery, true);
                console.log('갤러리 표시 업데이트 완료');
            } else {
                console.error('파티를 찾을 수 없습니다:', currentPartyId);
                
                // 파티가 없으면 테스트용 파티 생성
                console.log('테스트용 파티를 생성합니다...');
                const testParty = createTestParty();
                
                // 생성된 파티에 갤러리 아이템 추가
                if (!testParty.gallery) testParty.gallery = [];
                testParty.gallery.push(galleryItem);
                
                // 로컬 스토리지 업데이트
                const updatedParties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
                const testPartyIndex = updatedParties.findIndex(p => p.id === currentPartyId);
                console.log('테스트 파티 인덱스:', testPartyIndex);
                
                if (testPartyIndex !== -1) {
                    updatedParties[testPartyIndex] = testParty;
                    localStorage.setItem('latinDanceParties', JSON.stringify(updatedParties));
                    uploadedCount++;
                    
                    // 갤러리 새로고침
                    displayGallery(testParty.gallery, true);
                    console.log('테스트 파티에 갤러리 아이템 추가 완료');
                } else {
                    console.error('테스트 파티도 찾을 수 없습니다!');
                }
            }
        }
        
        // 파일 입력 초기화
        fileInput.value = '';
        console.log('파일 입력 초기화 완료');
        
        // UI 초기화
        const fileNamesSpan = document.getElementById('gallery-file-names');
        const uploadBtn = document.querySelector('.upload-btn');
        const fileContainer = document.querySelector('.file-input-container');
        
        if (fileNamesSpan) fileNamesSpan.textContent = '';
        if (fileContainer) fileContainer.classList.remove('has-files');
        if (uploadBtn) uploadBtn.disabled = true;
        
        if (uploadedCount > 0) {
            console.log(`${uploadedCount}개 파일 업로드 성공`);
            showUploadSuccess(uploadedCount, totalFiles);
        } else {
            console.log('업로드할 수 있는 이미지가 없습니다.');
            showMessage('업로드할 수 있는 이미지가 없습니다.', 'error');
        }
        
    } catch (error) {
        console.error('갤러리 업로드 중 오류:', error);
        showMessage('이미지 업로드 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
        hideLoading();
        hideUploadProgress();
        console.log('uploadGalleryImages 함수 종료');
    }
}

// 이미지 압축 및 Base64 변환 함수
async function compressImageToBase64(file, index) {
    return new Promise((resolve, reject) => {
        // 파일 크기 제한 (2MB)
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            console.warn(`파일 크기가 너무 큽니다: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // 이미지 크기 계산 (최대 800px로 제한)
            const maxWidth = 800;
            const maxHeight = 800;
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            // 캔버스 크기 설정
            canvas.width = width;
            canvas.height = height;
            
            // 이미지 그리기 (압축)
            ctx.drawImage(img, 0, 0, width, height);
            
            // 압축된 이미지를 Base64로 변환 (품질 0.7)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // 압축된 크기 확인
            const compressedSize = Math.ceil((compressedDataUrl.length * 3) / 4);
            console.log(`이미지 압축 완료: ${file.name} - 원본: ${(file.size / 1024).toFixed(1)}KB → 압축: ${(compressedSize / 1024).toFixed(1)}KB`);
            
            const item = {
                id: Date.now().toString() + '_' + index,
                url: compressedDataUrl,
                caption: file.name,
                uploadedAt: new Date().toISOString()
            };
            resolve(item);
        };
        
        img.onerror = () => reject(new Error('이미지 로딩 실패'));
        
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 로컬 스토리지 용량 확인 함수
function checkLocalStorageQuota() {
    try {
        const testKey = 'quota_test';
        const testData = 'x'.repeat(1024 * 1024); // 1MB 테스트 데이터
        
        // 기존 데이터 크기 확인
        const existingData = localStorage.getItem('latinDanceParties') || '[]';
        const existingSize = new Blob([existingData]).size;
        
        // 테스트 데이터 저장 시도
        localStorage.setItem(testKey, testData);
        localStorage.removeItem(testKey);
        
        const availableSpace = 5 * 1024 * 1024 - existingSize; // 5MB - 기존 데이터
        console.log(`로컬 스토리지 상태 - 기존: ${(existingSize / 1024 / 1024).toFixed(2)}MB, 사용 가능: ${(availableSpace / 1024 / 1024).toFixed(2)}MB`);
        
        return availableSpace;
    } catch (error) {
        console.warn('로컬 스토리지 용량 확인 실패:', error);
        return 0;
    }
}

// 로컬 스토리지 정리 함수
function cleanupLocalStorage() {
    try {
        const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        let cleanedCount = 0;
        
        // 각 파티의 갤러리 이미지 수 제한 (최대 10개)
        parties.forEach(party => {
            if (party.gallery && party.gallery.length > 10) {
                const excessCount = party.gallery.length - 10;
                party.gallery = party.gallery.slice(-10); // 최신 10개만 유지
                cleanedCount += excessCount;
                console.log(`파티 ${party.title}의 갤러리 정리: ${excessCount}개 이미지 제거`);
            }
        });
        
        if (cleanedCount > 0) {
            localStorage.setItem('latinDanceParties', JSON.stringify(parties));
            console.log(`로컬 스토리지 정리 완료: ${cleanedCount}개 이미지 제거`);
            showMessage(`저장 공간을 위해 ${cleanedCount}개의 오래된 이미지가 제거되었습니다.`, 'info');
        }
        
        return cleanedCount;
    } catch (error) {
        console.error('로컬 스토리지 정리 실패:', error);
        return 0;
    }
}

// 업로드 진행 상황 표시
function showUploadProgress(message) {
    const galleryContainer = document.getElementById('gallery-container');
    if (!galleryContainer) return;
    
    // 기존 진행 상황 표시 제거
    const existingProgress = galleryContainer.querySelector('.upload-progress');
    if (existingProgress) {
        existingProgress.remove();
    }
    
    const progressHTML = `
        <div class="upload-progress">
            <span class="upload-progress-icon">⏳</span>
            <div>${message}</div>
        </div>
    `;
    
    // 갤러리 컨테이너 맨 위에 추가
    galleryContainer.insertAdjacentHTML('afterbegin', progressHTML);
}

// 업로드 진행 상황 숨기기
function hideUploadProgress() {
    const progressElement = document.querySelector('.upload-progress');
    if (progressElement) {
        progressElement.remove();
    }
}

// 업로드 성공 표시
function showUploadSuccess(uploadedCount, totalFiles) {
    const galleryContainer = document.getElementById('gallery-container');
    if (!galleryContainer) return;
    
    // 기존 성공 표시 제거
    const existingSuccess = galleryContainer.querySelector('.upload-success');
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    const successHTML = `
        <div class="upload-success">
            <span class="upload-success-icon">✅</span>
            <div class="upload-success-title">업로드 완료!</div>
            <div class="upload-success-message">
                ${uploadedCount}개의 이미지가 성공적으로 업로드되었습니다.
                ${totalFiles > uploadedCount ? `(${totalFiles - uploadedCount}개 파일 제외됨)` : ''}
            </div>
        </div>
    `;
    
    // 갤러리 컨테이너 맨 위에 추가
    galleryContainer.insertAdjacentHTML('afterbegin', successHTML);
    
    // 5초 후 자동으로 성공 메시지 제거
    setTimeout(() => {
        const successElement = galleryContainer.querySelector('.upload-success');
        if (successElement) {
            successElement.style.animation = 'slideInDown 0.5s ease-out reverse';
            setTimeout(() => successElement.remove(), 500);
        }
    }, 5000);
}

// 갤러리 표시 함수 (개선됨)
function displayGallery(gallery, isNewUpload = false) {
    const galleryContainer = document.getElementById('gallery-container');
    
    if (!galleryContainer) {
        console.log('갤러리 컨테이너를 찾을 수 없습니다.');
        return;
    }
    
    // 기존 갤러리 아이템들만 제거 (성공/진행 메시지는 유지)
    const existingItems = galleryContainer.querySelectorAll('.gallery-item');
    existingItems.forEach(item => item.remove());
    
    if (!gallery || gallery.length === 0) {
        const emptyMessage = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #666;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📸</div>
                <h4>아직 업로드된 사진이 없습니다</h4>
                <p>첫 번째 사진을 업로드해보세요!</p>
            </div>
        `;
        galleryContainer.insertAdjacentHTML('beforeend', emptyMessage);
        return;
    }
    
    // 갤러리 아이템들 추가
    gallery.forEach((item, index) => {
        const isNew = isNewUpload && index === gallery.length - 1; // 마지막 아이템이 새로 업로드된 것
        const itemHTML = `
            <div class="gallery-item ${isNew ? 'new-upload' : ''}">
                <button class="gallery-delete-btn" onclick="deleteGalleryImage('${item.id}')" title="이미지 삭제">×</button>
                <img src="${item.url}" alt="파티 사진" onclick="openImageModal('${item.url}')">
                <div class="gallery-item-info">
                    ${item.caption || '파티 사진'}
                </div>
            </div>
        `;
        galleryContainer.insertAdjacentHTML('beforeend', itemHTML);
    });
}

// 갤러리 파일 선택 시 미리보기 표시 (개선됨)
function handleGalleryFileSelect() {
    console.log('handleGalleryFileSelect 함수 시작');
    
    const fileInput = document.getElementById('gallery-files');
    const fileNamesSpan = document.getElementById('gallery-file-names');
    const uploadBtn = document.querySelector('.upload-btn');
    const fileContainer = document.querySelector('.file-input-container');
    
    if (!fileInput) {
        console.error('gallery-files 요소를 찾을 수 없습니다!');
        return;
    }
    
    const files = fileInput.files;
    console.log('선택된 파일들:', files);
    
    if (!files || files.length === 0) {
        console.log('선택된 파일이 없습니다.');
        // 파일명 표시 초기화
        if (fileNamesSpan) fileNamesSpan.textContent = '';
        if (fileContainer) fileContainer.classList.remove('has-files');
        if (uploadBtn) uploadBtn.disabled = true;
        return;
    }
    
    // 파일 크기 체크 (1MB 제한)
    const maxSize = 1024 * 1024; // 1MB
    const oversizedFiles = Array.from(files).filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
        const oversizedFileNames = oversizedFiles.map(file => {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            return `${file.name} (${fileSizeMB}MB)`;
        }).join(', ');
        
        const message = `⚠️ 다음 파일들이 너무 큽니다:\n${oversizedFileNames}\n\n📏 1MB 미만의 이미지를 선택해주세요.\n\n💡 팁:\n• 이미지 압축 도구 사용\n• 더 작은 해상도 선택\n• JPG 형식 사용 (PNG보다 작음)`;
        
        showMessage(message, 'error');
        
        // 파일 선택 초기화
        fileInput.value = '';
        if (fileNamesSpan) fileNamesSpan.textContent = '';
        if (fileContainer) fileContainer.classList.remove('has-files');
        if (uploadBtn) uploadBtn.disabled = true;
        
        return;
    }
    
    // 파일명 표시
    const fileNames = Array.from(files).slice(0, 5).map(file => {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        return `${file.name} (${sizeMB}MB)`;
    }).join(', ');
    
    if (files.length > 5) {
        fileNames += ` 외 ${files.length - 5}개 파일`;
    }
    
    if (fileNamesSpan) {
        fileNamesSpan.textContent = fileNames;
    }
    
    // 컨테이너 스타일 변경
    if (fileContainer) {
        fileContainer.classList.add('has-files');
    }
    
    // 업로드 버튼 활성화
    if (uploadBtn) {
        uploadBtn.disabled = false;
    }
    
    console.log('선택된 파일 정보:', fileNames);
    showMessage(`${files.length}개 파일이 선택되었습니다.`, 'info');
    
    // 미리보기 생성
    const galleryContainer = document.getElementById('gallery-container');
    if (galleryContainer) {
        console.log('갤러리 컨테이너 찾음, 미리보기 생성 시작');
        
        // 기존 미리보기 제거
        const existingPreviews = galleryContainer.querySelectorAll('[id^="preview-"]');
        existingPreviews.forEach(preview => preview.remove());
        
        let previewHTML = '<div style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;"><strong>📸 선택된 파일 미리보기:</strong></div>';
        
        Array.from(files).slice(0, 5).forEach((file, index) => {
            console.log(`파일 ${index} 미리보기 생성:`, file.name);
            
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewDiv = document.getElementById(`preview-${index}`);
                    if (previewDiv) {
                        previewDiv.innerHTML = `
                            <img src="${e.target.result}" alt="미리보기" 
                                 style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin: 5px; border: 2px solid #007bff;">
                            <div style="font-size: 0.8rem; color: #666; text-align: center;">${file.name}</div>
                        `;
                        console.log(`파일 ${file.name} 미리보기 완료`);
                    }
                };
                reader.onerror = function(error) {
                    console.error(`파일 ${file.name} 미리보기 실패:`, error);
                };
                reader.readAsDataURL(file);
                
                previewHTML += `<div id="preview-${index}" style="display: inline-block; margin: 5px; text-align: center; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>`;
            } else {
                previewHTML += `<div id="preview-${index}" style="display: inline-block; margin: 5px; text-align: center; padding: 10px; background: #ffebee; border-radius: 8px; color: #c62828;">
                    <div style="font-size: 2rem;">❌</div>
                    <div style="font-size: 0.8rem;">${file.name}</div>
                    <div style="font-size: 0.7rem; color: #666;">이미지 파일이 아님</div>
                </div>`;
            }
        });
        
        // 기존 갤러리 내용 위에 미리보기 추가
        const existingContent = galleryContainer.innerHTML;
        galleryContainer.innerHTML = previewHTML + '<hr style="margin: 1rem 0;">' + existingContent;
        console.log('미리보기 HTML 추가 완료');
    } else {
        console.error('갤러리 컨테이너를 찾을 수 없습니다!');
    }
    
    console.log('handleGalleryFileSelect 함수 종료');
}

// 새 댓글 추가
async function addNewComment() {
    const authorInput = document.getElementById('comment-author');
    const textInput = document.getElementById('comment-text');
    
    const author = authorInput.value.trim() || 'Anonymous';
    const text = textInput.value.trim();
    
    if (!text) {
        showMessage('댓글 내용을 입력해주세요.', 'error');
        return;
    }
    
    if (!currentPartyId) {
        showMessage('파티를 선택해주세요.', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const comment = {
            id: Date.now().toString(),
            text: text,
            author: author,
            createdAt: new Date().toISOString(),
            likes: 0,
            likedBy: []
        };
        
        // 로컬 스토리지에서 파티 데이터 업데이트
        const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        const partyIndex = parties.findIndex(p => p.id === currentPartyId);
        
        if (partyIndex !== -1) {
            if (!parties[partyIndex].comments) parties[partyIndex].comments = [];
            parties[partyIndex].comments.push(comment);
            localStorage.setItem('latinDanceParties', JSON.stringify(parties));
            
            showMessage('댓글이 성공적으로 등록되었습니다!', 'success');
            
            // 입력 필드 초기화
            authorInput.value = '';
            textInput.value = '';
            
            // 댓글 새로고침
            displayComments(parties[partyIndex].comments);
        }
        
    } catch (error) {
        console.error('댓글 추가 중 오류:', error);
        showMessage('댓글 추가 중 오류가 발생했습니다.', 'error');
    } finally {
        showLoading(false);
    }
}

// 댓글 날짜 포맷 함수
function formatCommentDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) {
        return '방금 전';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}분 전`;
    } else if (diffInMinutes < 1440) { // 24시간
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours}시간 전`;
    } else {
        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// HTML 이스케이프 함수
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 전역 변수
let currentPartyId = null;

// 전역 함수 노출 - HTML onclick 이벤트에서 사용할 수 있도록 함
window.viewParty = viewParty;
window.closePartyModal = closePartyModal;
window.toggleLike = toggleLike;
window.editParty = editParty;
window.deleteParty = deleteParty;
window.scrollToSection = scrollToSection;
window.openMap = openMap;
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.closeLoginModal = closeLoginModal;
window.showSection = showSection;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.uploadGalleryImages = uploadGalleryImages;
window.handleGalleryFileSelect = handleGalleryFileSelect;
window.addNewComment = addNewComment;
window.switchTab = switchTab;
window.clearPastParties = clearPastParties; 

// 탭 전환 함수
function switchTab(tabName) {
    console.log('탭 전환:', tabName);
    
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 모든 탭 콘텐츠 숨기기
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 선택된 탭 활성화
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // 탭에 따라 파티 목록 로드
    if (tabName === 'current-parties') {
        loadCurrentParties();
    } else if (tabName === 'past-parties') {
        loadPastParties();
    }
}

// 진행중인 파티 로드
async function loadCurrentParties() {
    try {
        console.log('진행중인 파티 로드 시작...');
        
        showLoading();
        
        let parties = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 로컬 스토리지에서 파티 데이터 가져오기
        const storedParties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        
        // Firebase에서 파티 데이터 가져오기
        if (window.db) {
            const snapshot = await db.collection('parties').orderBy('createdAt', 'desc').limit(50).get();
            snapshot.forEach(doc => {
                const party = { id: doc.id, ...doc.data() };
                parties.push(party);
            });
        }
        
        // 로컬 스토리지 데이터와 병합
        parties = [...parties, ...storedParties];
        
        // 중복 제거 (ID 기준)
        const uniqueParties = parties.filter((party, index, self) => 
            index === self.findIndex(p => p.id === party.id)
        );
        
        // 진행중인 파티만 필터링 (오늘 이후)
        const currentParties = uniqueParties.filter(party => {
            const partyDate = new Date(party.date);
            partyDate.setHours(0, 0, 0, 0);
            return partyDate >= today;
        });
        
        // 날짜순 정렬 (가까운 날짜부터)
        currentParties.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        displayParties(currentParties, 'parties-container');
        console.log('진행중인 파티 로드 완료:', currentParties.length + '개');
        
    } catch (error) {
        console.error('진행중인 파티 로드 실패:', error);
        showMessage('파티 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
        hideLoading();
    }
}

// 지난 파티 로드
async function loadPastParties() {
    try {
        console.log('지난 파티 로드 시작...');
        
        showLoading();
        
        let parties = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 로컬 스토리지에서 파티 데이터 가져오기
        const storedParties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        
        // Firebase에서 파티 데이터 가져오기
        if (window.db) {
            const snapshot = await db.collection('parties').orderBy('createdAt', 'desc').limit(50).get();
            snapshot.forEach(doc => {
                const party = { id: doc.id, ...doc.data() };
                parties.push(party);
            });
        }
        
        // 로컬 스토리지 데이터와 병합
        parties = [...parties, ...storedParties];
        
        // 중복 제거 (ID 기준)
        const uniqueParties = parties.filter((party, index, self) => 
            index === self.findIndex(p => p.id === party.id)
        );
        
        // 지난 파티만 필터링 (오늘 이전)
        const pastParties = uniqueParties.filter(party => {
            const partyDate = new Date(party.date);
            partyDate.setHours(0, 0, 0, 0);
            return partyDate < today;
        });
        
        // 날짜순 정렬 (최근 날짜부터)
        pastParties.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        displayParties(pastParties, 'past-parties-container', true);
        console.log('지난 파티 로드 완료:', pastParties.length + '개');
        
    } catch (error) {
        console.error('지난 파티 로드 실패:', error);
        showMessage('지난 파티 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
        hideLoading();
    }
}

// 파티 목록 표시 (공통 함수)
function displayParties(parties, containerId, isPastParty = false) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error('컨테이너를 찾을 수 없습니다:', containerId);
        return;
    }
    
    container.innerHTML = '';
    
    if (!parties || parties.length === 0) {
        const emptyMessage = isPastParty ? 
            '<div class="empty-state past-parties-empty"><h3>📦 지난 파티가 없습니다</h3><p>아직 지난 파티가 없습니다. 파티가 끝나면 여기에 자동으로 이동됩니다!</p></div>' :
            `<div class="empty-state">
                <h3>🎉 아직 등록된 파티가 없습니다</h3>
                <p>첫 번째 파티를 등록해보세요!</p>
                
                <!-- 가치 있는 콘텐츠 추가 -->
                <div class="welcome-content">
                    <div class="welcome-section">
                        <h4>💃 라틴댄스 시작하기</h4>
                        <div class="welcome-grid">
                            <div class="welcome-card">
                                <h5>🎵 살사 (Salsa)</h5>
                                <p>쿠바에서 시작된 라틴댄스의 대표격입니다. 빠른 템포와 화려한 스핀으로 유명하며, 4/4박자로 8박자에 6스텝을 밟는 것이 특징입니다.</p>
                                <div class="dance-tips">
                                    <span class="tip">💡 초보자 팁: 기본 스텝부터 천천히 연습하세요</span>
                                </div>
                            </div>
                            
                            <div class="welcome-card">
                                <h5>💕 바차타 (Bachata)</h5>
                                <p>도미니카 공화국에서 시작된 로맨틱한 댄스입니다. 느린 템포와 부드러운 힙 움직임이 특징이며, 4/4박자로 8박자에 3스텝을 밟습니다.</p>
                                <div class="dance-tips">
                                    <span class="tip">💡 초보자 팁: 파트너와의 거리를 적절히 유지하세요</span>
                                </div>
                            </div>
                            
                            <div class="welcome-card">
                                <h5>🎭 차차차 (Cha-cha-cha)</h5>
                                <p>쿠바에서 시작된 생동감 넘치는 댄스입니다. '차차차'라는 이름이 붙은 이유는 스텝을 밟을 때 나는 소리 때문입니다.</p>
                                <div class="dance-tips">
                                    <span class="tip">💡 초보자 팁: 리듬감을 키우는 것이 중요합니다</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="welcome-section">
                        <h4>🎯 댄스 파티 참여 가이드</h4>
                        <div class="guide-list">
                            <div class="guide-item">
                                <span class="guide-number">1</span>
                                <div class="guide-content">
                                    <h5>적절한 복장 선택</h5>
                                    <p>편안하면서도 깔끔한 복장을 선택하세요. 너무 노출이 심하거나 불편한 옷은 피하는 것이 좋습니다.</p>
                                </div>
                            </div>
                            
                            <div class="guide-item">
                                <span class="guide-number">2</span>
                                <div class="guide-content">
                                    <h5>파트너에게 인사하기</h5>
                                    <p>댄스를 시작하기 전에 파트너에게 인사하는 것이 예의입니다. "안녕하세요" 또는 간단한 미소로 시작하세요.</p>
                                </div>
                            </div>
                            
                            <div class="guide-item">
                                <span class="guide-number">3</span>
                                <div class="guide-content">
                                    <h5>음악에 맞춰 댄스하기</h5>
                                    <p>음악의 템포와 분위기에 맞춰 댄스하는 것이 중요합니다. 너무 과도한 동작은 피하세요.</p>
                                </div>
                            </div>
                            
                            <div class="guide-item">
                                <span class="guide-number">4</span>
                                <div class="guide-content">
                                    <h5>거절할 때는 정중하게</h5>
                                    <p>댄스를 거절할 때는 "죄송합니다" 또는 "지금은 쉬고 싶습니다"라고 정중하게 말하세요.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="welcome-section">
                        <h4>💪 라틴댄스의 건강상 이점</h4>
                        <div class="benefits-list">
                            <div class="benefit-item">
                                <span class="benefit-icon">🏃‍♀️</span>
                                <div class="benefit-content">
                                    <h5>유산소 운동</h5>
                                    <p>라틴댄스는 훌륭한 유산소 운동입니다. 심폐 기능을 향상시키고 칼로리를 소모합니다.</p>
                                </div>
                            </div>
                            
                            <div class="benefit-item">
                                <span class="benefit-icon">💪</span>
                                <div class="benefit-content">
                                    <h5>근력 강화</h5>
                                    <p>다리와 코어 근육을 강화시켜 균형감각과 자세를 개선합니다.</p>
                                </div>
                            </div>
                            
                            <div class="benefit-item">
                                <span class="benefit-icon">🧠</span>
                                <div class="benefit-content">
                                    <h5>정신 건강</h5>
                                    <p>댄스는 스트레스를 해소하고 기분을 좋게 만듭니다. 사회적 교류도 촉진합니다.</p>
                                </div>
                            </div>
                            
                            <div class="benefit-item">
                                <span class="benefit-icon">🎯</span>
                                <div class="benefit-content">
                                    <h5>협응력 향상</h5>
                                    <p>음악에 맞춰 움직이는 과정에서 신체의 협응력과 리듬감이 향상됩니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="welcome-section">
                        <h4>🚀 첫 파티 등록하기</h4>
                        <p>위의 "파티 등록하기" 버튼을 클릭하여 첫 번째 라틴댄스 파티를 등록해보세요!</p>
                        <button class="register-first-party-btn" onclick="scrollToSection('party-registration')">
                            🎉 첫 파티 등록하기
                        </button>
                    </div>
                </div>
            </div>`;
        container.innerHTML = emptyMessage;
        return;
    }
    
    parties.forEach(party => {
        displayParty(party, containerId, isPastParty);
    });
}

// 지난 파티 보관함 비우기
function clearPastParties() {
    if (!confirm('정말로 지난 파티 보관함을 모두 비우시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    try {
        // 로컬 스토리지에서 지난 파티 제거
        const allParties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentParties = allParties.filter(party => {
            const partyDate = new Date(party.date);
            partyDate.setHours(0, 0, 0, 0);
            return partyDate >= today;
        });
        
        localStorage.setItem('latinDanceParties', JSON.stringify(currentParties));
        
        // Firebase에서도 지난 파티 제거 (관리자만)
        if (currentUser && currentUser.email === 'admin@latinmat.co.kr') {
            // Firebase 삭제 로직은 별도로 구현 필요
            console.log('Firebase에서 지난 파티 삭제는 관리자 기능으로 구현 필요');
        }
        
        showMessage('지난 파티 보관함이 비워졌습니다.', 'success');
        loadPastParties(); // 목록 새로고침
        
    } catch (error) {
        console.error('보관함 비우기 실패:', error);
        showMessage('보관함을 비우는데 실패했습니다.', 'error');
    }
} 

// 디버깅용 함수 - 현재 상태 확인
function debugGalleryUpload() {
    console.log('=== 갤러리 업로드 디버깅 ===');
    console.log('현재 파티 ID:', currentPartyId);
    
    const fileInput = document.getElementById('gallery-files');
    console.log('파일 입력 요소:', fileInput);
    if (fileInput) {
        console.log('선택된 파일 수:', fileInput.files.length);
        console.log('파일들:', Array.from(fileInput.files).map(f => f.name));
    }
    
    const galleryContainer = document.getElementById('gallery-container');
    console.log('갤러리 컨테이너:', galleryContainer);
    
    const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    console.log('로컬 스토리지 파티 수:', parties.length);
    
    if (currentPartyId) {
        const party = parties.find(p => p.id === currentPartyId);
        console.log('현재 파티:', party);
        if (party) {
            console.log('갤러리 이미지 수:', party.gallery ? party.gallery.length : 0);
        }
    }
    
    console.log('=== 디버깅 완료 ===');
}

// 전역 함수로 등록 (브라우저 콘솔에서 호출 가능)
window.debugGalleryUpload = debugGalleryUpload; 

// 갤러리 이미지 삭제
async function deleteGalleryImage(imageId) {
    console.log('갤러리 이미지 삭제 시작:', imageId);
    
    if (!currentPartyId) {
        console.error('currentPartyId가 설정되지 않았습니다!');
        showMessage('파티를 선택해주세요.', 'error');
        return;
    }
    
    // 삭제 확인 모달 표시
    const confirmed = await showDeleteConfirmModal('이 이미지를 삭제하시겠습니까?');
    if (!confirmed) {
        console.log('삭제 취소됨');
        return;
    }
    
    try {
        // 로컬 스토리지에서 파티 데이터 가져오기
        const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        const partyIndex = parties.findIndex(p => p.id === currentPartyId);
        
        if (partyIndex !== -1 && parties[partyIndex].gallery) {
            // 갤러리에서 해당 이미지 제거
            const originalLength = parties[partyIndex].gallery.length;
            parties[partyIndex].gallery = parties[partyIndex].gallery.filter(item => item.id !== imageId);
            
            if (parties[partyIndex].gallery.length < originalLength) {
                // 로컬 스토리지 업데이트
                localStorage.setItem('latinDanceParties', JSON.stringify(parties));
                
                // 갤러리 새로고침
                displayGallery(parties[partyIndex].gallery);
                
                console.log('갤러리 이미지 삭제 완료:', imageId);
                showMessage('이미지가 삭제되었습니다.', 'success');
            } else {
                console.error('삭제할 이미지를 찾을 수 없습니다:', imageId);
                showMessage('삭제할 이미지를 찾을 수 없습니다.', 'error');
            }
        } else {
            console.error('파티를 찾을 수 없습니다:', currentPartyId);
            showMessage('파티를 찾을 수 없습니다.', 'error');
        }
    } catch (error) {
        console.error('갤러리 이미지 삭제 중 오류:', error);
        showMessage('이미지 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 삭제 확인 모달 표시
function showDeleteConfirmModal(message) {
    return new Promise((resolve) => {
        // 기존 모달 제거
        const existingModal = document.querySelector('.delete-confirm-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 모달 HTML 생성
        const modalHTML = `
            <div class="delete-confirm-modal">
                <div class="delete-confirm-content">
                    <h3>🗑️ 삭제 확인</h3>
                    <p>${message}</p>
                    <div class="delete-confirm-buttons">
                        <button class="delete-confirm-btn cancel" onclick="closeDeleteConfirmModal(false)">취소</button>
                        <button class="delete-confirm-btn confirm" onclick="closeDeleteConfirmModal(true)">삭제</button>
                    </div>
                </div>
            </div>
        `;
        
        // 모달 추가
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 전역 함수로 등록
        window.closeDeleteConfirmModal = function(result) {
            const modal = document.querySelector('.delete-confirm-modal');
            if (modal) {
                modal.remove();
            }
            resolve(result);
        };
        
        // ESC 키로 취소
        const handleEsc = function(e) {
            if (e.key === 'Escape') {
                window.closeDeleteConfirmModal(false);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}

// 현재 파티 데이터 확인 함수
function debugCurrentParty() {
    console.log('=== 현재 파티 데이터 디버깅 ===');
    console.log('현재 파티 ID:', currentPartyId);
    
    const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    console.log('로컬 스토리지 파티 수:', parties.length);
    
    if (currentPartyId) {
        const currentParty = parties.find(p => p.id === currentPartyId);
        if (currentParty) {
            console.log('현재 파티 데이터:', currentParty);
            console.log('포스터 URL 존재:', !!currentParty.posterUrl);
            console.log('포스터 URL 길이:', currentParty.posterUrl ? currentParty.posterUrl.length : 0);
            console.log('포스터 URL 시작:', currentParty.posterUrl ? currentParty.posterUrl.substring(0, 50) : '없음');
        } else {
            console.log('현재 파티 ID에 해당하는 파티를 찾을 수 없습니다.');
        }
    } else {
        console.log('currentPartyId가 설정되지 않았습니다.');
    }
    
    console.log('=== 디버깅 완료 ===');
}

// 전역 함수로 등록
window.debugCurrentParty = debugCurrentParty;

// 현재 파티에 테스트 포스터 추가
function addTestPosterToCurrentParty() {
    console.log('=== 테스트 포스터 추가 시작 ===');
    
    if (!currentPartyId) {
        console.error('currentPartyId가 설정되지 않았습니다!');
        showMessage('파티를 선택해주세요.', 'error');
        return;
    }
    
    const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    const partyIndex = parties.findIndex(p => p.id === currentPartyId);
    
    if (partyIndex === -1) {
        console.error('현재 파티를 찾을 수 없습니다!');
        showMessage('파티를 찾을 수 없습니다.', 'error');
        return;
    }
    
    // 테스트용 포스터 이미지 (간단한 SVG)
    const testPosterUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY2YjNjIi8+CiAgPHRleHQgeD0iNTAlIiB5PSIzMCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RXogTGF0aW48L3RleHQ+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7qs7DsnbTrr7jsp4DsnYw8L3RleHQ+CiAgPHRleHQgeD0iNTAlIiB5PSI3MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7sl4bsnYwgM+uMgOq1rDwvdGV4dD4KICA8dGV4dCB4PSI1MCUiIHk9IjkwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfkY08L3RleHQ+Cjwvc3ZnPg==';
    
    // 파티에 포스터 추가
    parties[partyIndex].posterUrl = testPosterUrl;
    
    // 로컬 스토리지에 저장
    localStorage.setItem('latinDanceParties', JSON.stringify(parties));
    
    console.log('테스트 포스터 추가 완료!');
    console.log('업데이트된 파티:', parties[partyIndex]);
    
    // 모달 새로고침
    const modal = document.getElementById('party-modal');
    if (modal && !modal.classList.contains('hidden')) {
        showExistingModal(parties[partyIndex], modal, 
            document.getElementById('modal-party-title'), 
            document.getElementById('modal-party-info'));
    }
    
    showMessage('테스트 포스터가 추가되었습니다!', 'success');
    console.log('=== 테스트 포스터 추가 완료 ===');
}

// 전역 함수로 등록
window.addTestPosterToCurrentParty = addTestPosterToCurrentParty;

// 현재 파티에 주소 정보 추가
function addAddressToCurrentParty() {
    console.log('=== 주소 정보 추가 시작 ===');
    
    if (!currentPartyId) {
        console.error('currentPartyId가 설정되지 않았습니다!');
        showMessage('파티를 선택해주세요.', 'error');
        return;
    }
    
    const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    const partyIndex = parties.findIndex(p => p.id === currentPartyId);
    
    if (partyIndex === -1) {
        console.error('현재 파티를 찾을 수 없습니다!');
        showMessage('파티를 찾을 수 없습니다.', 'error');
        return;
    }
    
    // 현재 파티 정보 확인
    console.log('현재 파티 정보:', parties[partyIndex]);
    
    // 주소 정보 추가/업데이트
    if (!parties[partyIndex].region || parties[partyIndex].region === '라틴') {
        parties[partyIndex].region = '서울';
    }
    
    if (!parties[partyIndex].location || parties[partyIndex].location === '라틴') {
        parties[partyIndex].location = '강남구 테스트 댄스스튜디오';
    }
    
    // 로컬 스토리지에 저장
    localStorage.setItem('latinDanceParties', JSON.stringify(parties));
    
    console.log('주소 정보 추가 완료!');
    console.log('업데이트된 파티:', parties[partyIndex]);
    
    // 모달 새로고침
    const modal = document.getElementById('party-modal');
    if (modal && !modal.classList.contains('hidden')) {
        showExistingModal(parties[partyIndex], modal, 
            document.getElementById('modal-party-title'), 
            document.getElementById('modal-party-info'));
    }
    
    showMessage('주소 정보가 추가되었습니다!', 'success');
    console.log('=== 주소 정보 추가 완료 ===');
}

// 전역 함수로 등록
window.addAddressToCurrentParty = addAddressToCurrentParty;

// 현재 파티를 완전히 새로 만들기
function recreateCurrentParty() {
    console.log('=== 현재 파티 완전 재생성 시작 ===');
    
    if (!currentPartyId) {
        console.error('currentPartyId가 설정되지 않았습니다!');
        showMessage('파티를 선택해주세요.', 'error');
        return;
    }
    
    const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    const partyIndex = parties.findIndex(p => p.id === currentPartyId);
    
    if (partyIndex === -1) {
        console.error('현재 파티를 찾을 수 없습니다!');
        showMessage('파티를 찾을 수 없습니다.', 'error');
        return;
    }
    
    // 완전히 새로운 파티 데이터 생성
    const newParty = {
        id: currentPartyId,
        title: 'EZ Latin 가리온&선녀 Season3',
        region: '서울',
        location: '강남구 테스트 댄스스튜디오',
        date: '2025-07-30',
        time: '19:30',
        description: '시즌3 스타트~',
        contact: '010-1234-5678',
        posterUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY2YjNjIi8+CiAgPHRleHQgeD0iNTAlIiB5PSIzMCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RXogTGF0aW48L3RleHQ+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7qs7DsnbTrr7jsp4DsnYw8L3RleHQ+CiAgPHRleHQgeD0iNTAlIiB5PSI3MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7sl4bsnYwgM+uMgOq1rDwvdGV4dD4KICA8dGV4dCB4PSI1MCUiIHk9IjkwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfkY08L3RleHQ+Cjwvc3ZnPg==',
        gallery: [],
        comments: [],
        likes: [],
        createdAt: new Date().toISOString(),
        author: '테스트 사용자'
    };
    
    // 기존 파티를 새 파티로 교체
    parties[partyIndex] = newParty;
    
    // 로컬 스토리지에 저장
    localStorage.setItem('latinDanceParties', JSON.stringify(parties));
    
    console.log('파티 완전 재생성 완료!');
    console.log('새로 생성된 파티:', newParty);
    
    // 모달 새로고침
    const modal = document.getElementById('party-modal');
    if (modal && !modal.classList.contains('hidden')) {
        showExistingModal(newParty, modal, 
            document.getElementById('modal-party-title'), 
            document.getElementById('modal-party-info'));
    }
    
    showMessage('파티가 완전히 새로 생성되었습니다!', 'success');
    console.log('=== 파티 완전 재생성 완료 ===');
}

// 전역 함수로 등록
window.recreateCurrentParty = recreateCurrentParty;

// 현재 파티의 상세 주소를 제대로 설정하기
function fixCurrentPartyAddress() {
    console.log('=== 현재 파티 주소 수정 시작 ===');
    
    if (!currentPartyId) {
        console.error('currentPartyId가 설정되지 않았습니다!');
        showMessage('파티를 선택해주세요.', 'error');
        return;
    }
    
    const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
    const partyIndex = parties.findIndex(p => p.id === currentPartyId);
    
    if (partyIndex === -1) {
        console.error('현재 파티를 찾을 수 없습니다!');
        showMessage('파티를 찾을 수 없습니다.', 'error');
        return;
    }
    
    // 현재 파티 가져오기
    const currentParty = parties[partyIndex];
    console.log('수정 전 파티:', currentParty);
    
    // 상세 주소 정보 추가
    currentParty.region = '서울';
    currentParty.location = '강남구 테헤란로 123 라틴댄스스튜디오';
    currentParty.address = '서울 강남구 테헤란로 123 라틴댄스스튜디오';
    
    // 파티 정보 업데이트
    parties[partyIndex] = currentParty;
    
    // 로컬 스토리지에 저장
    localStorage.setItem('latinDanceParties', JSON.stringify(parties));
    
    console.log('파티 주소 수정 완료!');
    console.log('수정 후 파티:', currentParty);
    
    // 모달 새로고침
    const modal = document.getElementById('party-modal');
    if (modal && !modal.classList.contains('hidden')) {
        showExistingModal(currentParty, modal, 
            document.getElementById('modal-party-title'), 
            document.getElementById('modal-party-info'));
    }
    
    showMessage('파티 주소가 수정되었습니다!', 'success');
    console.log('=== 파티 주소 수정 완료 ===');
}

// 전역 함수로 등록
window.fixCurrentPartyAddress = fixCurrentPartyAddress;

// 현재 사용자를 관리자로 설정하기
function setCurrentUserAsAdmin() {
    console.log('=== 현재 사용자를 관리자로 설정 ===');
    
    if (!currentUser) {
        console.error('로그인된 사용자가 없습니다!');
        showMessage('먼저 로그인해주세요.', 'error');
        return;
    }
    
    console.log('현재 사용자 정보:', currentUser);
    console.log('현재 사용자 이메일:', currentUser.email);
    
    // 관리자 이메일 목록에 현재 사용자 이메일 추가
    const adminEmails = [
        'admin@latinmat.co.kr',
        'sean.jn@gmail.com',
        'test@test.com',
        currentUser.email  // 현재 사용자 이메일 추가
    ];
    
    console.log('관리자 이메일 목록:', adminEmails);
    
    // 파티 목록 새로고침
    loadCurrentParties();
    
    showMessage(`'${currentUser.email}'이 관리자로 설정되었습니다!`, 'success');
    console.log('=== 관리자 설정 완료 ===');
}

// 전역 함수로 등록
window.setCurrentUserAsAdmin = setCurrentUserAsAdmin;

// 유튜브 영상 섹션 초기화
async function initializeYouTubeSection() {
    console.log('=== 유튜브 섹션 초기화 시작 ===');
    
    // 관리자 권한 확인
    const isAdmin = canEdit({}); // 빈 객체로 관리자 권한만 확인
    const uploadSection = document.getElementById('youtube-upload-section');
    
    console.log('관리자 권한 확인 결과:', isAdmin);
    console.log('업로드 섹션 요소:', uploadSection);
    console.log('현재 사용자:', currentUser);
    
    // 관리자만 영상 등록 버튼 표시
    if (uploadSection) {
        if (isAdmin) {
            uploadSection.style.display = 'block';
            uploadSection.style.visibility = 'visible';
            uploadSection.classList.remove('hidden');
            console.log('✅ 영상 등록 버튼 표시됨 (관리자)');
            console.log('버튼 스타일:', uploadSection.style.display);
        } else {
            uploadSection.style.display = 'none';
            uploadSection.style.visibility = 'hidden';
            uploadSection.classList.add('hidden');
            console.log('❌ 영상 등록 버튼 숨김됨 (일반 사용자)');
        }
    } else {
        console.log('❌ 영상 등록 섹션 요소를 찾을 수 없음');
    }
    
    // 저장된 영상 로드
    await loadYouTubeVideos();
    
    // 이벤트 리스너 등록
    setupYouTubeEventListeners();
    
    console.log('=== 유튜브 섹션 초기화 완료 ===');
}

// 유튜브 이벤트 리스너 설정
function setupYouTubeEventListeners() {
    const uploadForm = document.getElementById('youtube-upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleYouTubeUpload);
    }
}

// 유튜브 영상 등록 모달 표시
function showYouTubeUploadModal() {
    console.log('영상 등록 모달 표시 시도');
    
    // 모달 요소 찾기
    let modal = document.getElementById('youtube-upload-modal');
    console.log('모달 요소:', modal);
    
    // 모달이 없으면 생성
    if (!modal) {
        console.log('모달이 없어서 생성합니다...');
        modal = document.createElement('div');
        modal.id = 'youtube-upload-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎬 유튜브 영상 등록</h3>
                    <button class="close-btn" onclick="closeYouTubeUploadModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="youtube-upload-form">
                        <div class="form-group">
                            <label for="youtube-title">영상 제목:</label>
                            <input type="text" id="youtube-title" name="title" required placeholder="예: 살사 기초 스텝 강습">
                        </div>
                        
                        <div class="form-group">
                            <label for="youtube-url">유튜브 URL:</label>
                            <input type="url" id="youtube-url" name="url" required placeholder="https://www.youtube.com/watch?v=...">
                        </div>
                        
                        <div class="form-group">
                            <label for="youtube-category">카테고리:</label>
                            <select id="youtube-category" name="category" required>
                                <option value="">카테고리를 선택하세요</option>
                                <option value="살사">살사</option>
                                <option value="바차타">바차타</option>
                                <option value="차차차">차차차</option>
                                <option value="룸바">룸바</option>
                                <option value="자이브">자이브</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="youtube-description">설명:</label>
                            <textarea id="youtube-description" name="description" rows="3" placeholder="영상에 대한 설명을 입력하세요..."></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="submit-btn">영상 등록</button>
                            <button type="button" class="cancel-btn" onclick="closeYouTubeUploadModal()">취소</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        console.log('모달 생성 완료');
    }
    
    // 모달 표시
    if (modal) {
        modal.classList.remove('hidden');
        console.log('모달 표시 완료');
        
        // 폼 이벤트 리스너 다시 등록
        const form = document.getElementById('youtube-upload-form');
        if (form) {
            form.addEventListener('submit', handleYouTubeUpload);
            console.log('폼 이벤트 리스너 등록됨');
        }
    } else {
        console.error('모달을 찾을 수 없거나 생성할 수 없습니다!');
    }
}

// 유튜브 영상 등록 모달 닫기
function closeYouTubeUploadModal() {
    const modal = document.getElementById('youtube-upload-modal');
    if (modal) {
        modal.classList.add('hidden');
        // 폼 초기화
        const form = document.getElementById('youtube-upload-form');
        if (form) {
            form.reset();
        }
    }
}

// 유튜브 영상 재생 모달 열기
function openYouTubeVideoModal(videoId, title, category, description, date, author) {
    console.log('유튜브 모달 열기 시도:', { videoId, title, category });
    
    // DOM이 완전히 로드되었는지 확인
    if (document.readyState !== 'complete') {
        console.log('DOM이 아직 로드되지 않았습니다. 잠시 후 다시 시도합니다.');
        setTimeout(() => {
            openYouTubeVideoModal(videoId, title, category, description, date, author);
        }, 100);
        return;
    }
    
    // 모달 요소 찾기
    let modal = document.getElementById('youtube-video-modal');
    if (!modal) {
        console.log('YouTube 모달이 없습니다. 동적으로 생성합니다.');
        modal = createYouTubeModal();
        document.body.appendChild(modal);
    }
    
    // iframe 요소 찾기
    const iframe = document.getElementById('youtube-video-frame');
    if (!iframe) {
        console.error('YouTube iframe 요소를 찾을 수 없습니다:', iframe);
        return;
    }
    
    // 제목, 카테고리, 설명, 날짜, 작성자 요소들 찾기
    const titleElement = document.getElementById('youtube-video-title');
    const categoryElement = document.getElementById('youtube-video-category');
    const descriptionElement = document.getElementById('youtube-video-description');
    const dateElement = document.getElementById('youtube-video-date');
    const authorElement = document.getElementById('youtube-video-author');
    
    // iframe src 설정 (자동재생 포함)
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    
    // 정보 업데이트
    if (titleElement) titleElement.textContent = `📺 ${title}`;
    if (categoryElement) categoryElement.textContent = `카테고리: ${category}`;
    if (descriptionElement) descriptionElement.textContent = description || '설명 없음';
    if (dateElement) dateElement.textContent = `등록일: ${date}`;
    if (authorElement) authorElement.textContent = `업로더: ${author}`;
    
    // 모달 표시
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    // 배경 스크롤 비활성화
    document.body.style.overflow = 'hidden';
    
    // 댓글 로드
    setTimeout(() => {
        loadYouTubeComments();
    }, 500);
    
    console.log('유튜브 모달 열기 완료');
}

// YouTube 모달 동적 생성
function createYouTubeModal() {
    console.log('YouTube 모달을 동적으로 생성합니다.');
    
    const modal = document.createElement('div');
    modal.id = 'youtube-video-modal';
    modal.className = 'modal hidden';
    
    modal.innerHTML = `
        <div class="modal-content dance-video-modal-content">
            <div class="modal-header">
                <h3 id="youtube-video-title">📺 라틴댄스 영상</h3>
                <button class="close-btn" onclick="closeYouTubeVideoModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="video-container">
                    <iframe id="youtube-video-frame" width="100%" height="400" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
                <div class="video-info">
                    <h4 id="youtube-video-category" style="color: #e74c3c; margin-bottom: 0.5rem;"></h4>
                    <p id="youtube-video-description" style="margin-bottom: 1rem;"></p>
                    <div class="video-meta" style="margin-bottom: 1rem; font-size: 0.9rem; color: #666;">
                        <span id="youtube-video-date"></span>
                        <span id="youtube-video-author"></span>
                    </div>
                    
                    <!-- 추천 및 공유 버튼 -->
                    <div class="video-interaction-bar" style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        <div class="interaction-buttons" style="display: flex; gap: 1rem; align-items: center;">
                            <button class="interaction-btn like-btn" id="youtube-like-btn" onclick="toggleYouTubeLike()" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer;">
                                <span id="youtube-like-icon">🤍</span>
                                <span id="youtube-like-count">0</span>
                            </button>
                            <button class="interaction-btn share-btn" onclick="shareYouTubeVideo()" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer;">
                                <span>📤</span>
                                <span>공유</span>
                            </button>
                            <button class="interaction-btn" onclick="openYouTubeInNewTab()" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer;">
                                <span>🌐</span>
                                <span>YouTube에서 보기</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 댓글 섹션 -->
                    <div class="youtube-comments-section" style="margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: #333;">💬 댓글</h4>
                        
                        <!-- 댓글 작성 폼 -->
                        <div class="comment-form" style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                            <textarea id="youtube-comment-input" placeholder="댓글을 작성해주세요..." style="width: 100%; min-height: 80px; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; resize: vertical; font-family: inherit;"></textarea>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
                                <span id="youtube-comment-count" style="font-size: 0.9rem; color: #666;">0개의 댓글</span>
                                <button onclick="addYouTubeComment()" style="padding: 0.5rem 1.5rem; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer;">댓글 작성</button>
                            </div>
                        </div>
                        
                        <!-- 댓글 목록 -->
                        <div id="youtube-comments-list" class="comments-list" style="max-height: 300px; overflow-y: auto;">
                            <!-- 댓글들이 여기에 동적으로 추가됩니다 -->
                        </div>
                    </div>
                    
                    <div class="video-actions">
                        <button class="video-action-btn" onclick="closeYouTubeVideoModal()">
                            <span>❌</span> 닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return modal;
}

// YouTube 영상 추천 토글
async function toggleYouTubeLike() {
    const likeBtn = document.getElementById('youtube-like-btn');
    const likeIcon = document.getElementById('youtube-like-icon');
    const likeCount = document.getElementById('youtube-like-count');
    
    if (!likeBtn || !likeIcon || !likeCount) {
        console.error('추천 버튼 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 현재 영상 정보 가져오기
    const iframe = document.getElementById('youtube-video-frame');
    if (!iframe || !iframe.src) {
        console.error('현재 재생 중인 영상 정보를 찾을 수 없습니다.');
        return;
    }
    
    const videoIdMatch = iframe.src.match(/embed\/([^?]+)/);
    if (!videoIdMatch) {
        console.error('영상 ID를 추출할 수 없습니다.');
        return;
    }
    
    const videoId = videoIdMatch[1];
    const currentUserId = currentUser ? currentUser.uid : 'anonymous';
    const likeKey = `youtube_like_${videoId}_${currentUserId}`;
    
    try {
        // 로컬 스토리지에서 현재 상태 확인
        const isLiked = localStorage.getItem(likeKey) === 'true';
        
        if (isLiked) {
            // 추천 취소
            localStorage.removeItem(likeKey);
            likeIcon.textContent = '🤍';
            likeBtn.style.background = 'white';
            likeBtn.style.color = '#333';
            
            // 카운트 감소
            const currentCount = parseInt(likeCount.textContent) || 0;
            likeCount.textContent = Math.max(0, currentCount - 1);
            
            showToast('추천을 취소했습니다.', 'info');
        } else {
            // 추천
            localStorage.setItem(likeKey, 'true');
            likeIcon.textContent = '❤️';
            likeBtn.style.background = '#e74c3c';
            likeBtn.style.color = 'white';
            
            // 카운트 증가
            const currentCount = parseInt(likeCount.textContent) || 0;
            likeCount.textContent = currentCount + 1;
            
            showToast('추천했습니다!', 'success');
        }
        
        // Firebase에 추천 정보 저장 (선택사항)
        if (db && currentUser) {
            try {
                await db.collection('youtubeLikes').doc(`${videoId}_${currentUserId}`).set({
                    videoId: videoId,
                    userId: currentUserId,
                    liked: !isLiked,
                    timestamp: new Date()
                });
            } catch (error) {
                console.log('Firebase 추천 저장 실패 (로컬에서만 처리):', error);
            }
        }
        
    } catch (error) {
        console.error('추천 처리 중 오류:', error);
        showToast('추천 처리 중 오류가 발생했습니다.', 'error');
    }
}

// YouTube 영상 공유
function shareYouTubeVideo() {
    const iframe = document.getElementById('youtube-video-frame');
    const titleElement = document.getElementById('youtube-video-title');
    
    if (!iframe || !iframe.src || !titleElement) {
        console.error('공유할 영상 정보를 찾을 수 없습니다.');
        return;
    }
    
    const videoIdMatch = iframe.src.match(/embed\/([^?]+)/);
    if (!videoIdMatch) {
        console.error('영상 ID를 추출할 수 없습니다.');
        return;
    }
    
    const videoId = videoIdMatch[1];
    const title = titleElement.textContent.replace('📺 ', '');
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const shareText = `🎵 라틴댄스 영상: ${title}\n\n${youtubeUrl}\n\n#라틴댄스 #살사 #바차타`;
    
    // 웹사이트 공유 URL 생성 (모달 상태 포함)
    const websiteShareUrl = `${window.location.origin}${window.location.pathname}?video=${videoId}&modal=share&title=${encodeURIComponent(title)}`;
    
    // 커스텀 공유 모달 표시 (웹사이트 공유 URL 포함)
    showCustomShareModal(title, youtubeUrl, shareText, websiteShareUrl);
}

// YouTube 댓글 추가
async function addYouTubeComment() {
    const commentInput = document.getElementById('youtube-comment-input');
    const commentsList = document.getElementById('youtube-comments-list');
    const commentCount = document.getElementById('youtube-comment-count');
    
    if (!commentInput || !commentsList || !commentCount) {
        console.error('댓글 요소를 찾을 수 없습니다.');
        return;
    }
    
    const commentText = commentInput.value.trim();
    if (!commentText) {
        showToast('댓글 내용을 입력해주세요.', 'error');
        return;
    }
    
    // 현재 영상 정보 가져오기
    const iframe = document.getElementById('youtube-video-frame');
    if (!iframe || !iframe.src) {
        console.error('현재 재생 중인 영상 정보를 찾을 수 없습니다.');
        return;
    }
    
    const videoIdMatch = iframe.src.match(/embed\/([^?]+)/);
    if (!videoIdMatch) {
        console.error('영상 ID를 추출할 수 없습니다.');
        return;
    }
    
    const videoId = videoIdMatch[1];
    
    try {
        // 새 댓글 객체 생성
        const newComment = {
            id: Date.now().toString(),
            videoId: videoId,
            text: commentText,
            author: currentUser ? (currentUser.displayName || currentUser.email || '익명') : '익명',
            authorId: currentUser ? currentUser.uid : 'anonymous',
            timestamp: new Date(),
            likes: 0
        };
        
        // Firebase에 댓글 저장
        if (db) {
            try {
                await db.collection('youtubeComments').add(newComment);
                console.log('댓글이 Firebase에 저장되었습니다.');
            } catch (error) {
                console.log('Firebase 댓글 저장 실패 (로컬에서만 처리):', error);
            }
        }
        
        // 로컬 스토리지에도 저장
        const commentsKey = `youtube_comments_${videoId}`;
        const existingComments = JSON.parse(localStorage.getItem(commentsKey) || '[]');
        existingComments.push(newComment);
        localStorage.setItem(commentsKey, JSON.stringify(existingComments));
        
        // UI에 댓글 추가
        displayYouTubeComment(newComment, commentsList);
        
        // 댓글 수 업데이트
        const totalComments = existingComments.length;
        commentCount.textContent = `${totalComments}개의 댓글`;
        
        // 입력창 초기화
        commentInput.value = '';
        
        showToast('댓글이 작성되었습니다!', 'success');
        
    } catch (error) {
        console.error('댓글 작성 중 오류:', error);
        showToast('댓글 작성 중 오류가 발생했습니다.', 'error');
    }
}

// YouTube 댓글 표시
function displayYouTubeComment(comment, container) {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment-item';
    commentElement.style.cssText = `
        padding: 1rem;
        margin-bottom: 1rem;
        background: white;
        border: 1px solid #eee;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    const date = new Date(comment.timestamp).toLocaleDateString('ko-KR');
    
    commentElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="color: #333;">${escapeHtml(comment.author)}</strong>
            <span style="font-size: 0.8rem; color: #666;">${date}</span>
        </div>
        <p style="margin: 0; line-height: 1.5; color: #333;">${escapeHtml(comment.text)}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
            <button onclick="likeYouTubeComment('${comment.id}')" style="background: none; border: none; cursor: pointer; color: #666; font-size: 0.9rem;">
                👍 ${comment.likes}
            </button>
            ${(currentUser && currentUser.uid === comment.authorId) ? 
                `<button onclick="deleteYouTubeComment('${comment.id}')" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-size: 0.9rem;">삭제</button>` : 
                ''
            }
        </div>
    `;
    
    container.appendChild(commentElement);
}

// YouTube 댓글 좋아요
function likeYouTubeComment(commentId) {
    // 구현 예정
    showToast('좋아요 기능은 준비 중입니다.', 'info');
}

// YouTube 댓글 삭제
async function deleteYouTubeComment(commentId) {
    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        // Firebase에서 삭제
        if (db) {
            try {
                const commentRef = db.collection('youtubeComments').doc(commentId);
                await commentRef.delete();
                console.log('댓글이 Firebase에서 삭제되었습니다.');
            } catch (error) {
                console.log('Firebase 댓글 삭제 실패:', error);
            }
        }
        
        // 로컬 스토리지에서 삭제
        const iframe = document.getElementById('youtube-video-frame');
        if (iframe && iframe.src) {
            const videoIdMatch = iframe.src.match(/embed\/([^?]+)/);
            if (videoIdMatch) {
                const videoId = videoIdMatch[1];
                const commentsKey = `youtube_comments_${videoId}`;
                const existingComments = JSON.parse(localStorage.getItem(commentsKey) || '[]');
                const updatedComments = existingComments.filter(c => c.id !== commentId);
                localStorage.setItem(commentsKey, JSON.stringify(updatedComments));
                
                // UI 업데이트
                loadYouTubeComments();
            }
        }
        
        showToast('댓글이 삭제되었습니다.', 'success');
        
    } catch (error) {
        console.error('댓글 삭제 중 오류:', error);
        showToast('댓글 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// YouTube 댓글 로드
async function loadYouTubeComments() {
    const iframe = document.getElementById('youtube-video-frame');
    const commentsList = document.getElementById('youtube-comments-list');
    const commentCount = document.getElementById('youtube-comment-count');
    
    if (!iframe || !iframe.src || !commentsList || !commentCount) {
        return;
    }
    
    const videoIdMatch = iframe.src.match(/embed\/([^?]+)/);
    if (!videoIdMatch) {
        return;
    }
    
    const videoId = videoIdMatch[1];
    
    try {
        let comments = [];
        
        // Firebase에서 댓글 로드
        if (db) {
            try {
                const snapshot = await db.collection('youtubeComments')
                    .where('videoId', '==', videoId)
                    .orderBy('timestamp', 'desc')
                    .get();
                
                comments = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                console.log('Firebase 댓글 로드 실패 (로컬에서만 처리):', error);
            }
        }
        
        // 로컬 스토리지에서도 로드
        const commentsKey = `youtube_comments_${videoId}`;
        const localComments = JSON.parse(localStorage.getItem(commentsKey) || '[]');
        
        // 중복 제거하고 합치기
        const allComments = [...comments];
        localComments.forEach(localComment => {
            if (!allComments.find(c => c.id === localComment.id)) {
                allComments.push(localComment);
            }
        });
        
        // 시간순 정렬
        allComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // UI 업데이트
        commentsList.innerHTML = '';
        allComments.forEach(comment => {
            displayYouTubeComment(comment, commentsList);
        });
        
        commentCount.textContent = `${allComments.length}개의 댓글`;
        
    } catch (error) {
        console.error('댓글 로드 중 오류:', error);
    }
}

// 커스텀 공유 모달 표시
function showCustomShareModal(title, url, shareText, websiteShareUrl = null) {
    // 기존 공유 모달이 있다면 제거
    const existingModal = document.getElementById('custom-share-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 새 공유 모달 생성
    const modal = document.createElement('div');
    modal.id = 'custom-share-modal';
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div class="share-modal-content" style="
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        ">
            <div class="share-modal-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid #eee;
            ">
                <h3 style="margin: 0; color: #333; font-size: 1.5rem;">📤 영상 공유</h3>
                <button onclick="closeCustomShareModal()" style="
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #666;
                    padding: 0.5rem;
                ">&times;</button>
            </div>
            
            <div class="share-modal-body">
                <!-- 영상 정보 -->
                <div class="video-info" style="
                    margin-bottom: 1.5rem;
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 8px;
                ">
                    <h4 style="margin: 0 0 0.5rem 0; color: #333;">${escapeHtml(title)}</h4>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">${escapeHtml(url)}</p>
                </div>
                
                <!-- 공유 옵션 -->
                <div class="share-options" style="margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 1rem 0; color: #333;">공유 방법 선택</h4>
                    
                    ${websiteShareUrl ? `
                    <!-- 웹사이트 공유 -->
                    <div class="share-option" style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 1rem;
                        margin-bottom: 0.75rem;
                        border: 2px solid #e74c3c;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: background 0.2s;
                        background: #fff5f5;
                    " onclick="copyTextToClipboard('${websiteShareUrl}')">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">🌐</span>
                            <div>
                                <div style="font-weight: 600; color: #333;">웹사이트 공유</div>
                                <div style="font-size: 0.9rem; color: #666;">라틴댄스 사이트에서 바로 보기</div>
                            </div>
                        </div>
                        <span style="color: #e74c3c; font-weight: 600;">추천</span>
                    </div>
                    ` : ''}
                    
                    <!-- 링크 복사 -->
                    <div class="share-option" style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 1rem;
                        margin-bottom: 0.75rem;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onclick="copyTextToClipboard('${url}')">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">🔗</span>
                            <div>
                                <div style="font-weight: 600; color: #333;">링크 복사</div>
                                <div style="font-size: 0.9rem; color: #666;">클립보드에 링크 복사</div>
                            </div>
                        </div>
                        <span style="color: #666;">복사</span>
                    </div>
                    
                    <!-- 텍스트 복사 -->
                    <div class="share-option" style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 1rem;
                        margin-bottom: 0.75rem;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onclick="copyTextToClipboard('${escapeHtml(shareText)}')">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">📝</span>
                            <div>
                                <div style="font-weight: 600; color: #333;">텍스트 복사</div>
                                <div style="font-size: 0.9rem; color: #666;">제목과 링크 포함 텍스트 복사</div>
                            </div>
                        </div>
                        <span style="color: #666;">복사</span>
                    </div>
                    
                    <!-- 소셜 미디어 공유 -->
                    <div class="social-share" style="margin-top: 1.5rem;">
                        <h4 style="margin: 0 0 1rem 0; color: #333;">소셜 미디어</h4>
                        <div class="social-buttons" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                            <button onclick="shareToKakaoTalk('${escapeHtml(title)}', '${url}')" style="
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                                padding: 0.75rem 1rem;
                                background: #FEE500;
                                color: #000;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                            ">
                                <span>💬</span>
                                <span>카카오톡</span>
                            </button>
                            
                            <button onclick="shareToFacebook('${escapeHtml(title)}', '${url}')" style="
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                                padding: 0.75rem 1rem;
                                background: #1877F2;
                                color: white;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                            ">
                                <span>📘</span>
                                <span>Facebook</span>
                            </button>
                            
                            <button onclick="shareToTwitter('${escapeHtml(title)}', '${url}')" style="
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                                padding: 0.75rem 1rem;
                                background: #1DA1F2;
                                color: white;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                            ">
                                <span>🐦</span>
                                <span>Twitter</span>
                            </button>
                            
                            <button onclick="shareToInstagram('${escapeHtml(title)}', '${url}')" style="
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                                padding: 0.75rem 1rem;
                                background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                            ">
                                <span>📷</span>
                                <span>Instagram</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- QR 코드 (선택사항) -->
                <div class="qr-section" style="
                    text-align: center;
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                ">
                    <h4 style="margin: 0 0 0.5rem 0; color: #333;">📱 QR 코드</h4>
                    <p style="margin: 0; color: #666; font-size: 0.9rem;">모바일에서 QR 코드를 스캔하여 바로 접속</p>
                    <div id="qr-code" style="margin-top: 1rem;"></div>
                </div>
            </div>
            
            <div class="share-modal-footer" style="
                text-align: center;
                padding-top: 1rem;
                border-top: 1px solid #eee;
            ">
                <button onclick="closeCustomShareModal()" style="
                    padding: 0.75rem 2rem;
                    background: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                ">닫기</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // QR 코드 생성 (QR 코드 라이브러리가 있는 경우)
    generateQRCode(url);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCustomShareModal();
        }
    });
}

// 커스텀 공유 모달 닫기
function closeCustomShareModal() {
    const modal = document.getElementById('custom-share-modal');
    if (modal) {
        modal.remove();
    }
}

// QR 코드 생성
function generateQRCode(url) {
    const qrContainer = document.getElementById('qr-code');
    if (!qrContainer) return;
    
    // QR 코드 라이브러리가 없으면 간단한 링크로 대체
    qrContainer.innerHTML = `
        <div style="
            padding: 1rem;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            display: inline-block;
        ">
            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">QR 코드</div>
            <div style="font-size: 0.7rem; color: #999; word-break: break-all;">${url}</div>
        </div>
    `;
}

// 소셜 미디어 공유 함수들
function shareToKakaoTalk(title, url) {
    const shareText = `${title}\n\n${url}\n\n#라틴댄스 #살사 #바차타`;
    const kakaoUrl = `https://story.kakao.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
    window.open(kakaoUrl, '_blank');
    showToast('카카오톡 공유가 열렸습니다!', 'success');
}

function shareToFacebook(title, url) {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`;
    window.open(facebookUrl, '_blank');
    showToast('Facebook 공유가 열렸습니다!', 'success');
}

function shareToTwitter(title, url) {
    const shareText = `${title}\n\n${url}\n\n#라틴댄스 #살사 #바차타`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
    showToast('Twitter 공유가 열렸습니다!', 'success');
}

function shareToInstagram(title, url) {
    // Instagram은 직접 링크 공유가 제한적이므로 클립보드 복사
    const shareText = `${title}\n\n${url}\n\n#라틴댄스 #살사 #바차타`;
    copyTextToClipboard(shareText);
    showToast('Instagram 공유용 텍스트가 복사되었습니다!', 'success');
}

// YouTube에서 새 탭으로 열기
function openYouTubeInNewTab() {
    const iframe = document.getElementById('youtube-video-frame');
    if (iframe && iframe.src) {
        // iframe src에서 video ID 추출
        const videoIdMatch = iframe.src.match(/embed\/([^?]+)/);
        if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
            window.open(youtubeUrl, '_blank');
        }
    }
}

// 유튜브 영상 재생 모달 닫기
function closeYouTubeVideoModal() {
    const modal = document.getElementById('youtube-video-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        // iframe src 초기화 (비디오 중지)
        const iframe = document.getElementById('youtube-video-frame');
        if (iframe) {
            iframe.src = '';
        }
        // 배경 스크롤 복원
        document.body.style.overflow = 'auto';
    }
}

// 유튜브 URL에서 비디오 ID 추출
function extractYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 유튜브 영상 등록 처리
async function handleYouTubeUpload(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const title = formData.get('title');
    const url = formData.get('url');
    const category = formData.get('category');
    const description = formData.get('description');
    
    // 유효성 검사
    if (!title || !url || !category) {
        showMessage('모든 필수 항목을 입력해주세요.', 'error');
        return;
    }
    
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
        showMessage('올바른 유튜브 URL을 입력해주세요.', 'error');
        return;
    }
    
    // Firebase가 초기화되었는지 확인
    if (!db) {
        console.error('Firebase가 초기화되지 않았습니다.');
        showMessage('Firebase 연결에 실패했습니다.', 'error');
        return;
    }
    
    // 새 영상 객체 생성
    const newVideo = {
        title: title,
        url: url,
        videoId: videoId,
        category: category,
        description: description || '',
        author: currentUser ? currentUser.email : '관리자',
        createdAt: new Date(),
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        createdBy: currentUser ? {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName
        } : null
    };
    
    try {
        console.log('Firebase에 유튜브 영상 저장 시작...');
        
        // Firebase Firestore에 저장
        const docRef = await db.collection('youtubeVideos').add(newVideo);
        console.log('Firebase 저장 완료, 문서 ID:', docRef.id);
        
        // 저장된 영상에 ID 추가
        newVideo.id = docRef.id;
        
        // 로컬 배열에도 추가 (최신 영상을 맨 앞에)
        youtubeVideos.unshift(newVideo);
        
        // UI 업데이트
        displayYouTubeVideos();
        
        // 모달 닫기
        closeYouTubeUploadModal();
        
        showMessage('영상이 성공적으로 등록되었습니다!', 'success');
        console.log('유튜브 영상 등록 완료:', newVideo);
        
    } catch (error) {
        console.error('유튜브 영상 등록 실패:', error);
        showMessage('영상 등록에 실패했습니다: ' + error.message, 'error');
    }
}

// 유튜브 영상 로드
async function loadYouTubeVideos() {
    try {
        console.log('Firebase에서 유튜브 영상 로드 시작...');
        
        // Firebase가 초기화되었는지 확인
        if (!db) {
            console.error('Firebase가 초기화되지 않았습니다.');
            // 로컬 스토리지에서 로드 (폴백)
            const savedVideos = localStorage.getItem('youtubeVideos');
            if (savedVideos) {
                youtubeVideos = JSON.parse(savedVideos);
                console.log('로컬 스토리지에서 유튜브 영상 로드 완료:', youtubeVideos.length + '개');
            } else {
                youtubeVideos = [];
                console.log('저장된 유튜브 영상이 없습니다.');
            }
            displayYouTubeVideos();
            return;
        }
        
        // Firebase Firestore에서 영상 목록 로드
        const snapshot = await db.collection('youtubeVideos')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        youtubeVideos = [];
        snapshot.forEach(doc => {
            const video = { id: doc.id, ...doc.data() };
            youtubeVideos.push(video);
        });
        
        console.log('Firebase에서 유튜브 영상 로드 완료:', youtubeVideos.length + '개');
        
        // UI에 표시
        displayYouTubeVideos();
        
    } catch (error) {
        console.error('유튜브 영상 로드 실패:', error);
        // 에러 시 로컬 스토리지에서 로드 (폴백)
        const savedVideos = localStorage.getItem('youtubeVideos');
        if (savedVideos) {
            youtubeVideos = JSON.parse(savedVideos);
            console.log('로컬 스토리지에서 유튜브 영상 로드 완료 (폴백):', youtubeVideos.length + '개');
        } else {
            youtubeVideos = [];
        }
        displayYouTubeVideos();
    }
}

// 페이지네이션 변수들
let currentPage = 1;
const videosPerPage = 9; // 한 페이지당 9개 영상

// 유튜브 영상 표시 (페이지네이션 적용)
function displayYouTubeVideos(videos = youtubeVideos) {
    const grid = document.getElementById('youtube-grid');
    const pagination = document.getElementById('youtube-pagination');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (videos.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>등록된 영상이 없습니다</h3>
                <p>첫 번째 영상을 등록해보세요!</p>
            </div>
        `;
        pagination.style.display = 'none';
        return;
    }
    
    // 페이지네이션 계산
    const totalPages = Math.ceil(videos.length / videosPerPage);
    const startIndex = (currentPage - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    const currentVideos = videos.slice(startIndex, endIndex);
    
    // 관리자 권한 확인 (한 번만)
    const isAdmin = canEdit({});
    console.log('영상 표시 시 관리자 권한 확인:', isAdmin);
    
    // 현재 페이지의 영상들만 표시
    currentVideos.forEach(video => {
        const videoCard = createYouTubeVideoCard(video, isAdmin);
        grid.appendChild(videoCard);
    });
    
    // 페이지네이션 컨트롤 표시/숨김
    if (totalPages > 1) {
        pagination.style.display = 'block';
        updatePaginationControls(totalPages);
    } else {
        pagination.style.display = 'none';
    }
}

// 페이지네이션 컨트롤 업데이트
function updatePaginationControls(totalPages) {
    const paginationInfo = document.getElementById('pagination-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const pageNumbers = document.getElementById('page-numbers');
    
    // 페이지 정보 업데이트
    paginationInfo.textContent = `페이지 ${currentPage} / ${totalPages}`;
    
    // 이전/다음 버튼 상태 업데이트
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // 페이지 번호 버튼들 생성
    pageNumbers.innerHTML = '';
    
    // 최대 5개의 페이지 번호만 표시
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // 시작 페이지 조정
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // 첫 페이지 버튼
    if (startPage > 1) {
        const firstPageBtn = document.createElement('span');
        firstPageBtn.className = 'page-number';
        firstPageBtn.textContent = '1';
        firstPageBtn.onclick = () => goToPage(1);
        pageNumbers.appendChild(firstPageBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'page-number dots';
            dots.textContent = '...';
            pageNumbers.appendChild(dots);
        }
    }
    
    // 페이지 번호 버튼들
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('span');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToPage(i);
        pageNumbers.appendChild(pageBtn);
    }
    
    // 마지막 페이지 버튼
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'page-number dots';
            dots.textContent = '...';
            pageNumbers.appendChild(dots);
        }
        
        const lastPageBtn = document.createElement('span');
        lastPageBtn.className = 'page-number';
        lastPageBtn.textContent = totalPages;
        lastPageBtn.onclick = () => goToPage(totalPages);
        pageNumbers.appendChild(lastPageBtn);
    }
}

// 페이지 변경 함수
function changePage(direction) {
    const filteredVideos = getFilteredYouTubeVideos();
    const totalPages = Math.ceil(filteredVideos.length / videosPerPage);
    
    if (direction === -1 && currentPage > 1) {
        currentPage--;
    } else if (direction === 1 && currentPage < totalPages) {
        currentPage++;
    }
    
    displayYouTubeVideos(filteredVideos);
    
    // 페이지 상단으로 스크롤
    const youtubeSection = document.getElementById('youtube-section');
    if (youtubeSection) {
        youtubeSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// 특정 페이지로 이동
function goToPage(pageNumber) {
    currentPage = pageNumber;
    const filteredVideos = getFilteredYouTubeVideos();
    displayYouTubeVideos(filteredVideos);
    
    // 페이지 상단으로 스크롤
    const youtubeSection = document.getElementById('youtube-section');
    if (youtubeSection) {
        youtubeSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// 필터링된 영상 목록 가져오기
function getFilteredYouTubeVideos() {
    const searchTerm = document.getElementById('youtube-search').value.toLowerCase();
    const categoryFilter = document.getElementById('youtube-category-filter').value;
    
    return youtubeVideos.filter(video => {
        const matchesSearch = video.title.toLowerCase().includes(searchTerm) ||
                             video.author.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || video.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
}

// 유튜브 영상 카드 생성
function createYouTubeVideoCard(video, isAdmin = null) {
    const card = document.createElement('div');
    card.className = 'youtube-card';
    
    // 관리자 권한 확인 (매개변수가 없으면 다시 확인)
    if (isAdmin === null) {
        isAdmin = canEdit({});
    }
    
    console.log(`영상 카드 생성 - 제목: ${video.title}, 관리자: ${isAdmin}`);
    
    // 클릭 이벤트 추가
    card.addEventListener('click', (e) => {
        // 삭제 버튼 클릭 시에는 영상 재생하지 않음
        if (e.target.classList.contains('youtube-delete-btn')) {
            return;
        }
        console.log('영상 카드 클릭됨:', video.title);
        
        // DOM이 완전히 로드되었는지 확인
        if (document.readyState !== 'complete') {
            console.log('DOM이 아직 로드되지 않았습니다. 잠시 후 다시 시도합니다.');
            setTimeout(() => {
                playYouTubeVideo(video);
            }, 100);
            return;
        }
        
        playYouTubeVideo(video);
    });
    
    const date = new Date(video.createdAt);
    const formattedDate = date.toLocaleDateString('ko-KR');
    
    card.innerHTML = `
        <div class="youtube-thumbnail">
            <img src="${video.thumbnail}" alt="${video.title}" style="width: 100%; height: 100%; object-fit: cover;">
            <div class="youtube-duration">▶</div>
            ${isAdmin ? `<button class="youtube-delete-btn" onclick="deleteYouTubeVideo('${video.id}')" title="영상 삭제">🗑️</button>` : ''}
        </div>
        <div class="youtube-info">
            <div class="youtube-title">${video.title}</div>
            <div class="youtube-channel">${video.author}</div>
            <div class="youtube-category">${video.category}</div>
        </div>
    `;
    
    return card;
}

// 유튜브 영상 재생
function playYouTubeVideo(video) {
    console.log('영상 재생 시도:', video);
    
    // DOM이 완전히 로드되었는지 확인
    if (document.readyState !== 'complete') {
        console.log('DOM이 아직 로드되지 않았습니다. 잠시 후 다시 시도합니다.');
        setTimeout(() => {
            playYouTubeVideo(video);
        }, 100);
        return;
    }
    
    // 새로운 모달 방식으로 재생
    const videoId = video.videoId;
    const title = video.title;
    const category = video.category;
    const description = video.description || '설명 없음';
    
    // 날짜 포맷팅 (Firebase Timestamp 또는 Date 객체 처리)
    let date;
    if (video.createdAt) {
        if (video.createdAt.toDate) {
            // Firebase Timestamp
            date = video.createdAt.toDate().toLocaleDateString('ko-KR');
        } else if (video.createdAt instanceof Date) {
            // Date 객체
            date = video.createdAt.toLocaleDateString('ko-KR');
        } else {
            // 문자열이나 다른 형태
            date = new Date(video.createdAt).toLocaleDateString('ko-KR');
        }
    } else {
        date = '날짜 없음';
    }
    
    const author = video.author || '관리자';
    
    // 새로운 openYouTubeVideoModal 함수 호출
    if (typeof openYouTubeVideoModal === 'function') {
        openYouTubeVideoModal(videoId, title, category, description, date, author);
    } else {
        console.error('openYouTubeVideoModal 함수를 찾을 수 없습니다!');
        // 기존 방식으로 폴백
        const modal = document.getElementById('youtube-video-modal');
        if (modal) {
            const iframe = document.getElementById('youtube-video-frame');
            const titleElement = document.getElementById('youtube-video-title');
            const categoryElement = document.getElementById('youtube-video-category');
            const descriptionElement = document.getElementById('youtube-video-description');
            const dateElement = document.getElementById('youtube-video-date');
            const authorElement = document.getElementById('youtube-video-author');
            
            if (iframe) {
                iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
            }
            if (titleElement) titleElement.textContent = `📺 ${title}`;
            if (categoryElement) categoryElement.textContent = `카테고리: ${category}`;
            if (descriptionElement) descriptionElement.textContent = description;
            if (dateElement) dateElement.textContent = `등록일: ${date}`;
            if (authorElement) authorElement.textContent = `업로더: ${author}`;
            
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }
}

// 유튜브 영상 삭제
async function deleteYouTubeVideo(videoId) {
    console.log('영상 삭제 시도:', videoId);
    
    // 관리자 권한 확인
    if (!canEdit({})) {
        showMessage('관리자만 영상을 삭제할 수 있습니다.', 'error');
        return;
    }
    
    // 삭제 확인
    if (!confirm('정말로 이 영상을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        // Firebase가 초기화되었는지 확인
        if (!db) {
            console.error('Firebase가 초기화되지 않았습니다.');
            showMessage('Firebase 연결에 실패했습니다.', 'error');
            return;
        }
        
        console.log('Firebase에서 영상 삭제 시작...');
        
        // Firebase Firestore에서 영상 삭제
        await db.collection('youtubeVideos').doc(videoId).delete();
        console.log('Firebase에서 영상 삭제 완료');
        
        // 로컬 배열에서도 제거
        youtubeVideos = youtubeVideos.filter(video => video.id !== videoId);
        
        // UI 업데이트
        displayYouTubeVideos();
        
        showMessage('영상이 성공적으로 삭제되었습니다.', 'success');
        console.log('영상 삭제 완료:', videoId);
        
    } catch (error) {
        console.error('영상 삭제 실패:', error);
        showMessage('영상 삭제에 실패했습니다: ' + error.message, 'error');
    }
}

// 유튜브 영상 필터링
function filterYouTubeVideos() {
    // 필터링 시 첫 페이지로 리셋
    currentPage = 1;
    
    const filteredVideos = getFilteredYouTubeVideos();
    displayYouTubeVideos(filteredVideos);
}

// 상단으로 이동 함수 (화면 최상단으로 확실히 이동)
function scrollToTop() {
    console.log('상단으로 이동 버튼 클릭됨!');
    
    // 여러 방법으로 최상단 이동 보장
    try {
        // 1. 부드러운 스크롤로 최상단 이동
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth'
        });
        
        // 2. 추가로 document.body와 document.documentElement도 최상단으로
        setTimeout(() => {
            if (document.body) {
                document.body.scrollTop = 0;
            }
            if (document.documentElement) {
                document.documentElement.scrollTop = 0;
            }
        }, 100);
        
        console.log('화면 최상단으로 이동 완료!');
    } catch (error) {
        console.error('스크롤 이동 중 오류:', error);
        // 오류 발생 시 즉시 이동
        window.scrollTo(0, 0);
    }
}

// 스크롤 이벤트 리스너로 상단 이동 버튼 표시/숨김
function setupScrollToTopButton() {
    const scrollBtn = document.getElementById('scroll-to-top-btn');
    const languageContainer = document.querySelector('.language-buttons-container');
    if (!scrollBtn) return;

    // 스크롤 버튼 클릭 이벤트 리스너 추가
    scrollBtn.addEventListener('click', function(e) {
        console.log('스크롤 버튼 클릭 이벤트 발생!');
        e.preventDefault();
        scrollToTop();
    });

    let scrollTimeout;

    window.addEventListener('scroll', () => {
        // 상단 이동 버튼 표시/숨김
        if (window.pageYOffset > 300) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }

        // 모바일에서 언어 버튼 표시/숨김
        if (window.innerWidth <= 768) {
            // 스크롤 중일 때 버튼 표시
            languageContainer.classList.add('show');
            
            // 스크롤이 멈춘 후 2초 뒤에 버튼 숨김
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                languageContainer.classList.remove('show');
            }, 2000);
        }
    });

    // PC에서 마우스가 언어 버튼 영역에 들어올 때 표시
    if (window.innerWidth > 768) {
        languageContainer.addEventListener('mouseenter', () => {
            languageContainer.classList.add('show');
        });
        
        languageContainer.addEventListener('mouseleave', () => {
            languageContainer.classList.remove('show');
        });
        
        // 상단 이동 버튼 호버 시에도 언어 버튼 표시
        if (scrollBtn) {
            scrollBtn.addEventListener('mouseenter', () => {
                languageContainer.classList.add('show');
            });
            
            scrollBtn.addEventListener('mouseleave', () => {
                languageContainer.classList.remove('show');
            });
        }
    }
}

// 전역 함수로 등록
window.showYouTubeUploadModal = showYouTubeUploadModal;
window.closeYouTubeUploadModal = closeYouTubeUploadModal;
window.closeYouTubeVideoModal = closeYouTubeVideoModal;
window.filterYouTubeVideos = filterYouTubeVideos;
window.deleteYouTubeVideo = deleteYouTubeVideo;
window.scrollToTop = scrollToTop;



// 페이지 로드 시 앱 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 로드 완료, 앱 초기화 시작...');
    initializeApp();
});

// 섹션 표시/숨김 함수
function showSection(sectionId) {
    console.log('섹션 표시:', sectionId);
    
    // 모든 섹션 숨김
    const allSections = document.querySelectorAll('.content-section');
    allSections.forEach(section => {
        section.style.display = 'none';
    });
    
    // 지정된 섹션만 표시
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        console.log('섹션 표시 완료:', sectionId);
    } else {
        console.error('섹션을 찾을 수 없습니다:', sectionId);
    }
}

// 전역에서 호출 가능하도록 window 객체에 추가
window.showSection = showSection;

// 카카오톡 공유 기능 초기화
function initializeKakaoShare() {
    if (kakaoInitialized) {
        console.log('카카오톡 SDK가 이미 초기화되어 있습니다.');
        return;
    }
    
    // 카카오톡 SDK 로드
    if (typeof Kakao === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
        script.onload = function() {
            console.log('카카오톡 SDK 로드 완료');
            initKakao();
        };
        script.onerror = function() {
            console.error('카카오톡 SDK 로드 실패');
        };
        document.head.appendChild(script);
    } else {
        initKakao();
    }
}

// 카카오톡 초기화
function initKakao() {
    try {
        // 카카오톡 JavaScript 키 (실제 키로 교체 필요)
        // 개발용으로는 임시 키를 사용하거나, 실제 카카오톡 개발자 계정에서 키를 발급받아야 함
        const kakaoKey = 'YOUR_KAKAO_JAVASCRIPT_KEY'; // 실제 키로 교체 필요
        
        if (kakaoKey === 'YOUR_KAKAO_JAVASCRIPT_KEY') {
            console.warn('카카오톡 앱 키가 설정되지 않았습니다. 개발자 콘솔에서 앱 키를 설정해주세요.');
            showMessage('카카오톡 공유 기능을 사용하려면 앱 키를 설정해야 합니다.', 'warning');
            return;
        }
        
        Kakao.init(kakaoKey);
        kakaoInitialized = true;
        console.log('카카오톡 SDK 초기화 완료');
    } catch (error) {
        console.error('카카오톡 SDK 초기화 실패:', error);
    }
}

// 공유 함수 (카카오톡 또는 대체 방법)
function shareToKakao(party) {
    console.log('공유 함수 시작:', party);
    
    try {
        // 파티 정보 검증
        if (!party || !party.title) {
            console.error('유효하지 않은 파티 정보:', party);
            showMessage('파티 정보가 올바르지 않습니다.', 'error');
            return;
        }
        
        // 공유할 설명 텍스트 생성 (장소 정보 포함)
        let description = '라틴댄스 파티에 초대합니다!';
        
        // 장소 정보 조합
        let locationInfo = '';
        if (party.region && party.location) {
            locationInfo = `${party.region} ${party.location}`;
        } else if (party.region) {
            locationInfo = party.region;
        } else if (party.location) {
            locationInfo = party.location;
        }
        
        if (party.description) {
            description = party.description;
            if (locationInfo) {
                description += `\n📍 장소: ${locationInfo}`;
            }
        } else if (locationInfo) {
            description = `${locationInfo}에서 열리는 라틴댄스 파티입니다!`;
        }
        
        // 날짜 정보 추가
        if (party.date) {
            let formattedDate = party.date;
            
            // 이미 한국어 형식인지 확인
            if (typeof party.date === 'string' && party.date.includes('년')) {
                // 이미 한국어 형식이면 그대로 사용
                formattedDate = party.date;
            } else {
                // ISO 형식이면 파싱
                try {
                    const date = new Date(party.date);
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                } catch (error) {
                    console.log('날짜 파싱 오류:', error);
                    formattedDate = party.date; // 원본 그대로 사용
                }
            }
            
            description += `\n📅 날짜: ${formattedDate}`;
        }
        
        // 시간 정보 추가
        if (party.time) {
            description += `\n⏰ 시간: ${party.time.substring(0, 5)}`;
        }
        
        // 파티 ID가 포함된 공유 링크 생성 (서버에서 메타 태그 생성)
        const shareUrl = `${window.location.origin}/party/${party.id}`;
        
        // 공유 텍스트 생성
        const shareText = `${party.title}\n\n${description}\n\n파티 정보: ${shareUrl}`;
        
        // 카카오톡이 초기화되었고 앱 키가 설정된 경우
        if (kakaoInitialized && typeof Kakao !== 'undefined') {
            try {
                // 이미지 URL 설정 (파티 포스터, 갤러리 이미지, 또는 기본 이미지)
                // 카카오톡 권장 이미지 크기: 최소 200x200px, 권장 400x400px
                let imageUrl = 'https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=라틴댄스+파티&font-size=24';
                
                // 파티 정보에 따라 동적 기본 이미지 생성
                if (!party.posterUrl || party.posterUrl === '') {
                    const partyTitle = encodeURIComponent(party.title || '라틴댄스 파티');
                    const location = encodeURIComponent(party.location || '');
                    imageUrl = `https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=${partyTitle}${location ? '+' + location : ''}&font-size=20`;
                }
                
                console.log('파티 이미지 정보:', {
                    posterUrl: party.posterUrl,
                    gallery: party.gallery,
                    hasPoster: !!(party.posterUrl && party.posterUrl !== ''),
                    hasGallery: !!(party.gallery && party.gallery.length > 0)
                });
                
                if (party.posterUrl && party.posterUrl !== '') {
                    imageUrl = party.posterUrl;
                    console.log('포스터 URL 사용:', imageUrl);
                } else if (party.gallery && party.gallery.length > 0) {
                    // 갤러리 이미지가 있으면 첫 번째 이미지 사용
                    imageUrl = party.gallery[0];
                    console.log('갤러리 이미지 사용:', imageUrl);
                } else {
                    console.log('기본 이미지 사용:', imageUrl);
                }
                
                // 이미지 URL이 상대 경로인 경우 절대 경로로 변환
                if (imageUrl && !imageUrl.startsWith('http')) {
                    imageUrl = window.location.origin + imageUrl;
                    console.log('절대 경로로 변환:', imageUrl);
                }
                
                // Firebase Storage URL인 경우 토큰 파라미터 제거 (카카오톡 호환성)
                if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
                    // 토큰 파라미터 제거
                    imageUrl = imageUrl.split('?')[0];
                    console.log('Firebase Storage URL 정리:', imageUrl);
                }
                
                console.log('최종 카카오톡 공유용 이미지 URL:', imageUrl);
                
                // 카카오톡 공유 제목에 장소 정보 추가
                let shareTitle = party.title || '라틴댄스 파티';
                if (party.location) {
                    shareTitle += ` - ${party.location}`;
                }
                
                const shareData = {
                    objectType: 'feed',
                    content: {
                        title: shareTitle,
                        description: description,
                        imageUrl: imageUrl,
                        link: {
                            mobileWebUrl: shareUrl,
                            webUrl: shareUrl
                        }
                    },
                    social: {
                        likeCount: parseInt(party.likes) || 0,
                        commentCount: 0,
                        sharedCount: 0
                    },
                    buttons: [
                        {
                            title: '파티 보기',
                            link: {
                                mobileWebUrl: shareUrl,
                                webUrl: shareUrl
                            }
                        }
                    ]
                };
                
                console.log('카카오톡 공유 데이터:', shareData);
                Kakao.Link.sendDefault(shareData);
                showMessage('카카오톡 공유가 시작되었습니다!', 'success');
                return;
                
            } catch (kakaoError) {
                console.error('카카오톡 공유 실패, 대체 방법 사용:', kakaoError);
            }
        }
        
        // 카카오톡이 실패하거나 초기화되지 않은 경우 클립보드 복사 사용
        console.log('카카오톡 공유 대신 클립보드 복사 사용');
        fallbackShare(shareText);
        
    } catch (error) {
        console.error('공유 실패:', error);
        showToast('❌ 카카오톡 공유에 실패했습니다.\n클립보드 복사로 대체합니다.', 'error', 3000);
    }
}

// 대체 공유 방법 (클립보드 복사)
function fallbackShare(shareText) {
    // 모던 브라우저의 Clipboard API 시도
    if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(shareText).then(() => {
            // 토스트 알림 표시
        showToast('📋 클립보드에 복사되었습니다!\n카카오톡에 붙여넣기 해주세요.', 'success', 4000);
        }).catch((error) => {
            console.log('Clipboard API 실패, 수동 복사 다이얼로그 표시:', error);
            showManualCopyDialog(shareText);
        });
    } else {
        // 구형 브라우저 지원 - 수동 복사 다이얼로그 표시
        showManualCopyDialog(shareText);
    }
}

// 수동 복사 안내 다이얼로그
function showManualCopyDialog(shareText) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
            max-width: 450px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333; font-size: 1.2rem;">🎉 파티 공유하기</h3>
                <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">&times;</button>
            </div>
            
            <p style="margin: 0 0 15px 0; color: #666; line-height: 1.5;">
                아래 파티 정보를 복사하여 카카오톡, 메시지, 이메일 등으로 공유하세요!<br>
                <span style="color: #007bff; font-weight: bold;">링크를 클릭하면 파티 상세 정보가 바로 열립니다!</span>
            </p>
            
            <div style="
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 15px;
                text-align: center;
            ">
                <p style="margin: 0; color: #856404; font-weight: bold; font-size: 1.1rem;">
                    📋 클립보드에 복사되었습니다!
                </p>
                <p style="margin: 5px 0 0 0; color: #856404; font-size: 0.9rem;">
                    카카오톡에 붙여넣기 해주세요
                </p>
            </div>
            
            <div style="
                background: #f8f9fa;
                border: 2px solid #e9ecef;
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 20px;
                position: relative;
            ">
                <textarea style="
                    width: 100%;
                    height: 120px;
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    resize: none;
                    font-family: inherit;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    background: white;
                " readonly>${shareText}</textarea>
                
                <button onclick="copyToClipboard(this.previousElementSibling)" style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    padding: 5px 10px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">
                    복사
                </button>
            </div>
            
            <div style="
                background: #e3f2fd;
                border-left: 4px solid #2196f3;
                padding: 12px;
                border-radius: 5px;
                margin-bottom: 20px;
            ">
                <p style="margin: 0; color: #1976d2; font-size: 0.9rem;">
                    💡 <strong>팁:</strong> 복사한 텍스트를 카카오톡, 메시지, 이메일 등에 붙여넣어 공유하세요!
                </p>
            </div>
            
            <div style="text-align: center;">
                <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="
                    padding: 10px 20px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
                    확인
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

// 클립보드 복사 함수 (textarea용)
function copyToClipboard(textarea) {
    textarea.select();
    textarea.setSelectionRange(0, 99999); // 모바일 지원
    
    try {
        document.execCommand('copy');
        // 토스트 알림 표시
        showToast('📋 클립보드에 복사되었습니다!\n카카오톡에 붙여넣기 해주세요.', 'success', 4000);
    } catch (err) {
        console.error('클립보드 복사 실패:', err);
        showToast('❌ 클립보드 복사에 실패했습니다.\n수동으로 텍스트를 선택하여 복사해주세요.', 'error', 4000);
    }
}

// 문자열을 클립보드에 복사하는 함수 (공유 모달용)
function copyTextToClipboard(text) {
    // 임시 textarea 요소 생성
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = text;
    tempTextarea.style.position = 'fixed';
    tempTextarea.style.left = '-9999px';
    tempTextarea.style.top = '-9999px';
    tempTextarea.style.opacity = '0';
    
    document.body.appendChild(tempTextarea);
    
    try {
        // 텍스트 선택 및 복사
        tempTextarea.select();
        tempTextarea.setSelectionRange(0, 99999); // 모바일 지원
        
        const successful = document.execCommand('copy');
        
        if (successful) {
            showToast('📋 클립보드에 복사되었습니다!', 'success');
        } else {
            // 최신 브라우저용 Clipboard API 시도
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => {
                    showToast('📋 클립보드에 복사되었습니다!', 'success');
                }).catch(() => {
                    showToast('❌ 클립보드 복사에 실패했습니다.', 'error');
                });
            } else {
                showToast('❌ 클립보드 복사에 실패했습니다.', 'error');
            }
        }
    } catch (err) {
        console.error('클립보드 복사 실패:', err);
        showToast('❌ 클립보드 복사에 실패했습니다.', 'error');
    } finally {
        // 임시 요소 제거
        document.body.removeChild(tempTextarea);
    }
}

// 카카오톡 공유 버튼 클릭 이벤트
function handleKakaoShare(partyId) {
    console.log('카카오톡 공유 시도:', partyId);
    
    const party = getPartyById(partyId);
    if (party) {
        console.log('파티 정보 확인됨:', party);
        shareToKakao(party);
    } else {
        console.error('파티 정보를 찾을 수 없습니다:', partyId);
        
        // 디버깅을 위한 추가 정보 출력
        console.log('현재 localStorage 파티 목록:', JSON.parse(localStorage.getItem('parties') || '[]'));
        console.log('화면의 파티 카드들:', document.querySelectorAll('.party-card').length);
        
        showMessage('파티 정보를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.', 'error');
    }
}

// 파티 ID로 파티 정보 가져오기 (개선된 버전)
function getPartyById(partyId) {
    console.log('파티 정보 조회 시작:', partyId);
    
    // 1. localStorage에서 파티 정보 찾기
    const localParties = JSON.parse(localStorage.getItem('parties') || '[]');
    console.log('localStorage 파티 목록:', localParties);
    
    let party = localParties.find(party => party.id === partyId);
    
    if (party) {
        console.log('localStorage에서 파티 찾음:', party);
        return party;
    }
    
    // 2. 문자열 ID로도 시도
    party = localParties.find(party => String(party.id) === String(partyId));
    
    if (party) {
        console.log('문자열 변환으로 파티 찾음:', party);
        return party;
    }
    
    // 3. 현재 화면에 표시된 파티 카드에서 정보 추출
    const partyCard = document.querySelector(`[onclick*="${partyId}"]`)?.closest('.party-card');
    if (partyCard) {
        console.log('화면에서 파티 카드 찾음');
        const extractedParty = extractPartyFromCard(partyCard);
        if (extractedParty) {
            console.log('카드에서 파티 정보 추출:', extractedParty);
            return extractedParty;
        }
    }
    
    console.error('파티 정보를 찾을 수 없음:', partyId);
    return null;
}

// 파티 카드에서 정보 추출하는 함수
function extractPartyFromCard(partyCard) {
    try {
        const title = partyCard.querySelector('h3')?.textContent || '';
        const description = partyCard.querySelector('.party-description')?.textContent || '';
        const posterImg = partyCard.querySelector('.party-poster img');
        const posterUrl = posterImg ? posterImg.src : '';
        
        console.log('추출된 포스터 이미지 정보:', {
            posterImg: posterImg,
            posterUrl: posterUrl,
            imgSrc: posterImg?.src,
            imgAlt: posterImg?.alt
        });
        
        // 파티 정보 행들에서 데이터 추출
        const infoRows = partyCard.querySelectorAll('.party-info');
        let region = '', barName = '', address = '', location = '', date = '', time = '', contact = '';
        
        infoRows.forEach(row => {
            const text = row.textContent;
            if (text.includes('지역:')) {
                region = text.split('지역:')[1]?.trim() || '';
            } else if (text.includes('바 이름:')) {
                barName = text.split('바 이름:')[1]?.trim() || '';
            } else if (text.includes('상세주소:')) {
                address = text.split('상세주소:')[1]?.trim() || '';
            } else if (text.includes('장소:')) {
                location = text.split('장소:')[1]?.trim() || '';
            } else if (text.includes('일시:')) {
                const dateTimeText = text.split('일시:')[1]?.trim() || '';
                // 날짜와 시간 추출 로직
                const dateMatch = dateTimeText.match(/(\d{4}년 \d{1,2}월 \d{1,2}일)/);
                const timeMatch = dateTimeText.match(/(\d{2}:\d{2})/);
                if (dateMatch) date = dateMatch[1];
                if (timeMatch) time = timeMatch[1];
            } else if (text.includes('연락처:')) {
                contact = text.split('연락처:')[1]?.trim() || '';
            }
        });
        
        // 좋아요 수 추출
        const likeCountElement = partyCard.querySelector('.like-count span:last-child');
        const likes = likeCountElement ? parseInt(likeCountElement.textContent.match(/\d+/)?.[0] || '0') : 0;
        
        return {
            id: partyCard.querySelector('[onclick*="handleKakaoShare"]')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || '',
            title: title,
            description: description,
            region: region,
            barName: barName,
            address: address,
            location: location,
            date: date,
            time: time,
            contact: contact,
            posterUrl: posterUrl,
            likes: likes
        };
    } catch (error) {
        console.error('카드에서 파티 정보 추출 실패:', error);
        return null;
    }
}

// URL 파라미터 확인하여 특정 파티 모달 열기
function checkUrlParameters() {
    console.log('=== URL 파라미터 확인 시작 ===');
    console.log('현재 전체 URL:', window.location.href);
    console.log('현재 경로:', window.location.pathname);
    console.log('현재 검색 파라미터:', window.location.search);
    
    // 1. URL 파라미터 확인 (쿼리 파라미터)
    const urlParams = new URLSearchParams(window.location.search);
    let partyId = urlParams.get('party');
    const videoId = urlParams.get('video');
    const modalType = urlParams.get('modal');
    const videoTitle = urlParams.get('title');
    
    console.log('쿼리 파라미터에서 찾은 파티 ID:', partyId);
    
    // 2. 경로 파라미터 확인 (예: /party/YsivM5UcU7ZJinmajqel)
    if (!partyId) {
        const pathParts = window.location.pathname.split('/');
        console.log('경로 파트들:', pathParts);
        const partyIndex = pathParts.findIndex(part => part === 'party');
        console.log('party 인덱스:', partyIndex);
        
        if (partyIndex !== -1 && partyIndex + 1 < pathParts.length) {
            partyId = pathParts[partyIndex + 1];
            console.log('✅ 경로에서 파티 ID 발견:', partyId);
        } else {
            console.log('❌ 경로에서 파티 ID를 찾을 수 없음');
        }
    }
    
    // 3. localStorage의 pendingPartyId 확인
    const pendingPartyId = localStorage.getItem('pendingPartyId');
    
    console.log('현재 URL:', window.location.href);
    console.log('URL 경로:', window.location.pathname);
    console.log('URL 파라미터:', Object.fromEntries(urlParams.entries()));
    console.log('URL 파티 ID:', partyId);
    console.log('URL 영상 ID:', videoId);
    console.log('URL 모달 타입:', modalType);
    console.log('pendingPartyId:', pendingPartyId);
    
    // 3. 영상 공유 모달 처리
    if (videoId && modalType === 'share') {
        console.log('영상 공유 모달 요청 발견:', { videoId, modalType, videoTitle });
        openVideoShareModalFromUrl(videoId, videoTitle);
        return;
    }
    
    // 4. 파티 ID 결정 (URL 파라미터 우선, 없으면 pendingPartyId)
    const targetPartyId = partyId || pendingPartyId;
    
    if (targetPartyId) {
        console.log('파티 ID 발견:', targetPartyId);
        
        // pendingPartyId가 사용된 경우 제거
        if (pendingPartyId && !partyId) {
            localStorage.removeItem('pendingPartyId');
            console.log('pendingPartyId 제거됨');
        }
        
        // 즉시 파티 정보 찾기 시도
        const party = getPartyById(targetPartyId);
        if (party) {
            console.log('즉시 파티 정보 찾음, 카드 이동 및 모달 열기');
            updateMetaTags(party);
            
            // 먼저 카드로 이동
            scrollToPartyCard(targetPartyId);
            
            // 잠시 후 모달 열기
            setTimeout(() => {
                viewParty(targetPartyId);
            }, 1500);
        } else {
            // 파티 정보가 아직 로드되지 않았으면 대기
            console.log('파티 정보를 찾을 수 없음, 대기 후 재시도');
            setTimeout(() => {
                console.log('타이머 완료, 모달 열기 재시도');
                openPartyModalFromUrl(targetPartyId);
            }, 2000); // 2초 대기
        }
    } else {
        console.log('파티 ID가 없습니다.');
    }
}

// URL 파라미터로 영상 공유 모달 열기
async function openVideoShareModalFromUrl(videoId, videoTitle) {
    console.log('URL 파라미터로 영상 공유 모달 열기 시도:', { videoId, videoTitle });
    
    try {
        // 영상 정보 구성
        const title = videoTitle || `라틴댄스 영상 (${videoId})`;
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const shareText = `🎵 라틴댄스 영상: ${title}\n\n${youtubeUrl}\n\n#라틴댄스 #살사 #바차타`;
        
        // 웹사이트 공유 URL 생성 (현재 상태 유지)
        const websiteShareUrl = `${window.location.origin}${window.location.pathname}?video=${videoId}&modal=share&title=${encodeURIComponent(title)}`;
        
        // 공유 모달 표시
        showCustomShareModal(title, youtubeUrl, shareText, websiteShareUrl);
        
        // URL에서 파라미터 제거 (선택사항)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        showToast('영상 공유 모달이 열렸습니다!', 'success');
        
    } catch (error) {
        console.error('영상 공유 모달 열기 실패:', error);
        showToast('영상 공유 모달을 열 수 없습니다.', 'error');
    }
}

// URL 파라미터로 파티 모달 열기
async function openPartyModalFromUrl(partyId) {
    console.log('URL 파라미터로 파티 모달 열기 시도:', partyId);
    
    // 파티 정보 찾기
    const party = getPartyById(partyId);
    
    if (party) {
        console.log('파티 정보 찾음, 카드로 이동 및 모달 열기:', party);
        
        // 메타 태그 업데이트 (카카오톡 공유용)
        updateMetaTags(party);
        
        // 파티 카드로 스크롤 이동 및 강조 표시
        scrollToPartyCard(partyId);
        
        // 잠시 후 모달 열기 (카드 강조 효과를 볼 수 있도록)
        setTimeout(async () => {
            await viewParty(partyId);
        }, 1500);
        
        // URL에서 파라미터 제거 (선택사항)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
    } else {
        console.error('URL 파라미터의 파티를 찾을 수 없음:', partyId);
        showMessage('요청하신 파티를 찾을 수 없습니다.', 'error');
    }
}

// 파티 카드로 스크롤 이동 및 강조 표시
function scrollToPartyCard(partyId) {
    console.log('=== 파티 카드 스크롤 이동 시작 ===');
    console.log('찾을 파티 ID:', partyId);
    
    // 모든 파티 카드에서 강조 표시 제거
    const allCards = document.querySelectorAll('.party-card');
    console.log('현재 페이지의 파티 카드 개수:', allCards.length);
    
    allCards.forEach(card => {
        card.classList.remove('highlighted');
    });
    
    // 해당 파티 카드 찾기
    const partyCard = document.querySelector(`[data-party-id="${partyId}"]`);
    console.log('찾은 파티 카드:', partyCard);
    
    if (partyCard) {
        console.log('✅ 파티 카드 찾음, 스크롤 이동 및 강조 표시 시작');
        
        // 파티 섹션으로 스크롤 이동
        const partiesSection = document.getElementById('parties-section');
        console.log('파티 섹션:', partiesSection);
        
        if (partiesSection) {
            console.log('파티 섹션으로 스크롤 이동 중...');
            partiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // 잠시 후 카드로 스크롤 이동 및 강조 표시
        setTimeout(() => {
            console.log('카드로 스크롤 이동 중...');
            // 카드가 화면 중앙에 오도록 스크롤
            partyCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 강조 표시 추가
            partyCard.classList.add('highlighted');
            console.log('✅ 강조 표시 추가됨');
            
            // 토스트 메시지 표시
            showToast(`파티 카드를 찾았습니다! 🎉`, 'success', 2000);
            
            // 4초 후 강조 표시 제거
            setTimeout(() => {
                partyCard.classList.remove('highlighted');
                console.log('강조 표시 제거됨');
            }, 4000);
            
        }, 800); // 0.8초 대기 (섹션 이동 완료 후)
        
    } else {
        console.warn('❌ 파티 카드를 찾을 수 없음:', partyId);
        console.log('현재 페이지의 모든 파티 카드 ID들:');
        allCards.forEach((card, index) => {
            const cardId = card.getAttribute('data-party-id');
            console.log(`  ${index + 1}. ${cardId}`);
        });
        
        // 파티 섹션으로 이동
        const partiesSection = document.getElementById('parties-section');
        if (partiesSection) {
            partiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // 사용자에게 알림
        setTimeout(() => {
            showToast('파티를 찾을 수 없습니다. 파티 목록을 확인해주세요.', 'warning', 3000);
        }, 1000);
    }
}

// 메타 태그 동적 업데이트 (카카오톡 공유용)
function updateMetaTags(party) {
    console.log('메타 태그 업데이트:', party.title);
    
    // 이미지 URL 설정
    let imageUrl = 'https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=라틴댄스+파티';
    if (party.posterUrl && party.posterUrl !== '') {
        imageUrl = party.posterUrl;
        // 상대 경로인 경우 절대 경로로 변환
        if (!imageUrl.startsWith('http')) {
            imageUrl = window.location.origin + imageUrl;
        }
    }
    
    // 설명 텍스트 생성
    let description = '라틴댄스 파티에 초대합니다!';
    if (party.description) {
        description = party.description;
    } else if (party.region && party.location) {
        description = `${party.region} ${party.location}에서 열리는 라틴댄스 파티입니다!`;
    }
    
    // 현재 URL
    const currentUrl = window.location.href;
    
    // Open Graph 메타 태그 업데이트
    updateMetaTag('og:title', party.title || '라틴댄스 파티');
    updateMetaTag('og:description', description);
    updateMetaTag('og:image', imageUrl);
    updateMetaTag('og:url', currentUrl);
    
    // Twitter Card 메타 태그 업데이트
    updateMetaTag('twitter:title', party.title || '라틴댄스 파티');
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', imageUrl);
    
    console.log('메타 태그 업데이트 완료');
}

// 개별 메타 태그 업데이트 헬퍼 함수
function updateMetaTag(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`) || 
               document.querySelector(`meta[name="${property}"]`);
    
    if (meta) {
        meta.setAttribute('content', content);
    } else {
        // 메타 태그가 없으면 생성
        meta = document.createElement('meta');
        if (property.startsWith('og:')) {
            meta.setAttribute('property', property);
        } else {
            meta.setAttribute('name', property);
        }
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
    }
}

// 테스트용: 현재 파티들의 공유 링크 생성
function generateShareLinks() {
    const parties = JSON.parse(localStorage.getItem('parties') || '[]');
    console.log('=== 현재 파티들의 공유 링크 ===');
    parties.forEach(party => {
        const shareUrl = `${window.location.origin}/party/${party.id}`;
        console.log(`${party.title}: ${shareUrl}`);
    });
}

// 디버깅용: URL 파라미터로 모달 열기 테스트
function testUrlModal(partyId) {
    console.log('=== URL 모달 테스트 시작 ===');
    console.log('테스트할 파티 ID:', partyId);
    
    // 현재 URL에 파라미터 추가
    const newUrl = `${window.location.origin}${window.location.pathname}?party=${partyId}`;
    console.log('새 URL:', newUrl);
    
    // URL 변경
    window.history.pushState({}, document.title, newUrl);
    
    // 파라미터 확인 및 모달 열기
    checkUrlParameters();
}

// 디버깅용: 현재 상태 확인
function debugCurrentState() {
    console.log('=== 현재 상태 디버깅 ===');
    console.log('현재 URL:', window.location.href);
    console.log('localStorage 파티 수:', JSON.parse(localStorage.getItem('parties') || '[]').length);
    console.log('화면의 파티 카드 수:', document.querySelectorAll('.party-card').length);
    console.log('모달 존재 여부:', !!document.getElementById('party-modal'));
}

// 이미지 URL 테스트 함수
function testImageUrl(partyId) {
    console.log('=== 이미지 URL 테스트 ===');
    const party = getPartyById(partyId);
    if (party) {
        console.log('파티 정보:', party);
        
        // 이미지 URL 생성 테스트
        let imageUrl = 'https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=라틴댄스+파티&font-size=24';
        
        // 파티 정보에 따라 동적 기본 이미지 생성
        if (!party.posterUrl || party.posterUrl === '') {
            const partyTitle = encodeURIComponent(party.title || '라틴댄스 파티');
            const location = encodeURIComponent(party.location || '');
            imageUrl = `https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=${partyTitle}${location ? '+' + location : ''}&font-size=20`;
        }
        
        if (party.posterUrl && party.posterUrl !== '') {
            imageUrl = party.posterUrl;
            console.log('포스터 URL:', imageUrl);
        } else if (party.gallery && party.gallery.length > 0) {
            imageUrl = party.gallery[0];
            console.log('갤러리 URL:', imageUrl);
        }
        
        // 절대 경로 변환
        if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = window.location.origin + imageUrl;
            console.log('절대 경로 변환:', imageUrl);
        }
        
        // Firebase Storage URL인 경우 토큰 파라미터 제거
        if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
            imageUrl = imageUrl.split('?')[0];
            console.log('Firebase Storage URL 정리:', imageUrl);
        }
        
        console.log('최종 이미지 URL:', imageUrl);
        
        // 이미지 로드 테스트
        const testImg = new Image();
        testImg.onload = () => {
            console.log('✅ 이미지 로드 성공:', imageUrl);
            console.log('이미지 크기:', testImg.width, 'x', testImg.height);
        };
        testImg.onerror = () => {
            console.log('❌ 이미지 로드 실패:', imageUrl);
            console.log('대안 이미지 테스트...');
            
            // 대안 이미지 테스트
            const fallbackUrl = 'https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=라틴댄스+파티';
            const fallbackImg = new Image();
            fallbackImg.onload = () => console.log('✅ 대안 이미지 로드 성공:', fallbackUrl);
            fallbackImg.onerror = () => console.log('❌ 대안 이미지도 실패:', fallbackUrl);
            fallbackImg.src = fallbackUrl;
        };
        testImg.src = imageUrl;
        
        return imageUrl;
    } else {
        console.log('파티를 찾을 수 없음:', partyId);
        return null;
    }
}

// 토스트 알림 표시 함수
function showToast(message, type = 'info', duration = 3000) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 토스트 요소 생성
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    // 아이콘 설정
    let icon = '💬';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'info') icon = 'ℹ️';
    
    // 메시지 설정
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;
    
    // DOM에 추가
    document.body.appendChild(toast);
    
    // 애니메이션 시작
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // 자동 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

// 테스트용 토스트 알림 함수들
function testToastSuccess() {
    showToast('✅ 성공 토스트 테스트!\n클립보드에 복사되었습니다.', 'success', 3000);
}

function testToastError() {
    showToast('❌ 오류 토스트 테스트!\n공유에 실패했습니다.', 'error', 3000);
}

function testToastInfo() {
    showToast('ℹ️ 정보 토스트 테스트!\n일반적인 알림입니다.', 'info', 3000);
}

// 전역 함수로 등록
window.handleKakaoShare = handleKakaoShare;
window.generateShareLinks = generateShareLinks;
window.testUrlModal = testUrlModal;
window.debugCurrentState = debugCurrentState;
window.testImageUrl = testImageUrl;
window.showToast = showToast;
window.testToastSuccess = testToastSuccess;
window.testToastError = testToastError;
window.testToastInfo = testToastInfo;

// 언어 토글 함수들을 전역으로 등록
window.toggleKorean = toggleKorean;
window.toggleEnglish = toggleEnglish;
window.toggleSpanish = toggleSpanish;

// 영어 번역 토글 함수 (전체 UI 확장)
let isEnglish = false;
// 한국어 토글 함수
function toggleKorean() {
    console.log('한국어 모드로 전환');
    
    // 클릭 시각적 피드백
    const korBtn = document.getElementById('translate-kor-btn');
    korBtn.style.transform = 'scale(0.9)';
    setTimeout(() => {
        korBtn.style.transform = '';
    }, 150);
    
    // 모든 버튼에서 active 클래스 제거
    document.getElementById('translate-kor-btn').classList.remove('active');
    document.getElementById('translate-btn').classList.remove('active');
    document.getElementById('translate-es-btn').classList.remove('active');
    
    // 한국어 버튼에 active 클래스 추가
    document.getElementById('translate-kor-btn').classList.add('active');
    
    // 헤더
    document.querySelector('header h1').textContent = '🕺💃 라틴댄스 파티 커뮤니티';
    document.querySelector('header p').textContent = '전국의 라틴댄스 파티를 발견하고 새로운 친구를 만나보세요!';
    
    // 타이틀 버튼
    const btns = document.querySelectorAll('.title-btn');
    if (btns.length >= 3) {
        btns[0].textContent = '파티 등록하기';
        btns[1].textContent = '홍보 앨범 보기';
        btns[2].textContent = '영상 갤러리';
    }
    
    // 필터 라벨
    const filterLabels = document.querySelectorAll('.filter-container label');
    filterLabels.forEach(label => {
        if (label.textContent.includes('Region')) {
            label.textContent = '지역:';
        } else if (label.textContent.includes('Date')) {
            label.textContent = '날짜:';
        }
    });
    
    // 필터 옵션
    const regionSelect = document.querySelector('select[name="region"]');
    if (regionSelect) {
        const options = regionSelect.options;
        if (options.length > 0) {
            options[0].textContent = '모든 지역';
        }
    }
    
    // 파티 카드 번역
    const partyCards = document.querySelectorAll('.party-card');
    partyCards.forEach(card => {
        // 제목
        const title = card.querySelector('.party-title');
        if (title) {
            title.textContent = title.textContent.replace('Party', '파티');
        }
        
        // 정보 행들
        const infoRows = card.querySelectorAll('.party-info');
        infoRows.forEach(row => {
            const text = row.textContent;
            if (text.includes('Region:') || text.includes('Región:')) {
                row.innerHTML = row.innerHTML.replace('Region:', '지역:').replace('Región:', '지역:');
            } else if (text.includes('Bar:')) {
                row.innerHTML = row.innerHTML.replace('Bar:', '바 이름:');
            } else if (text.includes('Address:') || text.includes('Dirección:')) {
                row.innerHTML = row.innerHTML.replace('Address:', '상세주소:').replace('Dirección:', '상세주소:');
            } else if (text.includes('Venue:') || text.includes('Lugar:')) {
                row.innerHTML = row.innerHTML.replace('Venue:', '장소:').replace('Lugar:', '장소:');
            } else if (text.includes('Date:') || text.includes('Fecha:')) {
                row.innerHTML = row.innerHTML.replace('Date:', '일시:').replace('Fecha:', '일시:');
            } else if (text.includes('Registrant:') || text.includes('Registrante:')) {
                row.innerHTML = row.innerHTML.replace('Registrant:', '등록자:').replace('Registrante:', '등록자:');
            }
        });
    });
    
    // 푸터
    const footerInfo = document.querySelector('.footer-info p');
    if (footerInfo) {
        footerInfo.innerHTML = '소재지 : 서울시 | 관리자 : 루나 | 문의 : 인스타 <a href="https://www.instagram.com/lunastarin" target="_blank">@lunastarin</a> | 유튜브 <a href="https://www.youtube.com/@lunastarin" target="_blank">@lunastarin</a>';
    }
    const footerCopy = document.querySelector('.footer-copyright p');
    if (footerCopy) {
        footerCopy.textContent = '© 2025 라틴맛 파티 커뮤니티';
    }
    
    // 버튼 텍스트 업데이트
    document.getElementById('translate-kor-btn').textContent = 'Kor';
    document.getElementById('translate-kor-btn').title = '한국어로 보기';
    document.getElementById('translate-btn').textContent = 'Eng';
    document.getElementById('translate-btn').title = '영어로 보기';
    document.getElementById('translate-es-btn').textContent = 'Esp';
    document.getElementById('translate-es-btn').title = '스페인어로 보기';
    
    // 전역 변수 업데이트
    window.isEnglish = false;
    window.isSpanish = false;
    
    showMessage('🇰🇷 한국어 모드로 전환되었습니다!', 'success');
}

function toggleEnglish() {
    console.log('영어 모드로 전환');
    
    // 클릭 시각적 피드백
    const engBtn = document.getElementById('translate-btn');
    engBtn.style.transform = 'scale(0.9)';
    setTimeout(() => {
        engBtn.style.transform = '';
    }, 150);
    
    // 모든 버튼에서 active 클래스 제거
    document.getElementById('translate-kor-btn').classList.remove('active');
    document.getElementById('translate-btn').classList.remove('active');
    document.getElementById('translate-es-btn').classList.remove('active');
    
    // 영어 버튼에 active 클래스 추가
    document.getElementById('translate-btn').classList.add('active');
    
    // 헤더
    document.querySelector('header h1').textContent = '🕺💃 Latin Dance Party Community';
    document.querySelector('header p').textContent = 'Discover Latin dance parties nationwide and meet new friends!';
    
    // 타이틀 버튼
    const btns = document.querySelectorAll('.title-btn');
    if (btns.length >= 3) {
        btns[0].textContent = 'Register Party';
        btns[1].textContent = 'View Album';
        btns[2].textContent = 'Video Gallery';
    }
    
    // 필터 라벨
    const filterLabels = document.querySelectorAll('.filter-container label');
    filterLabels.forEach(label => {
        if (label.textContent.includes('지역')) {
            label.textContent = 'Region:';
        } else if (label.textContent.includes('날짜')) {
            label.textContent = 'Date:';
        }
    });
    
    // 필터 옵션
    const regionSelect = document.querySelector('select[name="region"]');
    if (regionSelect) {
        const options = regionSelect.options;
        if (options.length > 0) {
            options[0].textContent = 'All Regions';
        }
    }
    
    // 파티 카드 번역
    const partyCards = document.querySelectorAll('.party-card');
    partyCards.forEach(card => {
        // 제목
        const title = card.querySelector('.party-title');
        if (title) {
            title.textContent = title.textContent.replace('파티', 'Party');
        }
        
        // 정보 행들
        const infoRows = card.querySelectorAll('.party-info');
        infoRows.forEach(row => {
            const text = row.textContent;
            if (text.includes('지역:') || text.includes('Región:')) {
                row.innerHTML = row.innerHTML.replace('지역:', 'Region:').replace('Región:', 'Region:');
            } else if (text.includes('바 이름:')) {
                row.innerHTML = row.innerHTML.replace('바 이름:', 'Bar:');
            } else if (text.includes('상세주소:') || text.includes('Dirección:')) {
                row.innerHTML = row.innerHTML.replace('상세주소:', 'Address:').replace('Dirección:', 'Address:');
            } else if (text.includes('장소:') || text.includes('Lugar:')) {
                row.innerHTML = row.innerHTML.replace('장소:', 'Venue:').replace('Lugar:', 'Venue:');
            } else if (text.includes('일시:') || text.includes('Fecha:')) {
                row.innerHTML = row.innerHTML.replace('일시:', 'Date:').replace('Fecha:', 'Date:');
            } else if (text.includes('등록자:') || text.includes('Registrante:')) {
                row.innerHTML = row.innerHTML.replace('등록자:', 'Registrant:').replace('Registrante:', 'Registrant:');
            }
        });
    });
    
    // 푸터
    const footerInfo = document.querySelector('.footer-info p');
    if (footerInfo) {
        footerInfo.innerHTML = 'Location: Seoul | Admin: Luna | Contact: Instagram <a href="https://www.instagram.com/lunastarin" target="_blank">@lunastarin</a> | YouTube <a href="https://www.youtube.com/@lunastarin" target="_blank">@lunastarin</a>';
    }
    const footerCopy = document.querySelector('.footer-copyright p');
    if (footerCopy) {
        footerCopy.textContent = '© 2025 Latinmat Party Community';
    }
    
    // 번역 버튼 텍스트
    document.getElementById('translate-kor-btn').textContent = 'Kor';
    document.getElementById('translate-kor-btn').title = '한국어로 보기';
    document.getElementById('translate-btn').textContent = 'Eng';
    document.getElementById('translate-btn').title = '영어로 보기';
    document.getElementById('translate-es-btn').textContent = 'Esp';
    document.getElementById('translate-es-btn').title = '스페인어로 보기';
    
    // 전역 변수 업데이트
    window.isEnglish = true;
    window.isSpanish = false;
    
    showMessage('🇺🇸 영어 모드로 전환되었습니다!', 'success');
    const pastDateFilter = document.getElementById('past-date-filter');
    if (pastDateFilter) pastDateFilter.placeholder = isEnglish ? 'Date Filter' : '날짜 필터';
    // 카드/상세/버튼 등
    document.querySelectorAll('.party-card').forEach(card => {
        // 지역, 바 이름, 상세주소, 장소, 일시, 등록자, 연락처, 좋아요, 상세보기, 공유, 수정, 삭제
        card.innerHTML = card.innerHTML
            .replace(/지역:/g, isEnglish ? 'Region:' : '지역:')
            .replace(/바 이름:/g, isEnglish ? 'Bar Name:' : '바 이름:')
            .replace(/지도/g, isEnglish ? 'Map' : '지도')
            .replace(/상세주소:/g, isEnglish ? 'Address:' : '상세주소:')
            .replace(/장소:/g, isEnglish ? 'Venue:' : '장소:')
            .replace(/일시:/g, isEnglish ? 'Date & Time:' : '일시:')
            .replace(/등록자:/g, isEnglish ? 'Author:' : '등록자:')
            .replace(/연락처:/g, isEnglish ? 'Contact:' : '연락처:')
            .replace(/명이 좋아합니다/g, isEnglish ? 'likes this' : '명이 좋아합니다')
            .replace(/상세보기/g, isEnglish ? 'Details' : '상세보기')
            .replace(/공유/g, isEnglish ? 'Share' : '공유')
            .replace(/수정/g, isEnglish ? 'Edit' : '수정')
            .replace(/삭제/g, isEnglish ? 'Delete' : '삭제');
    });
    // 상세 모달
    const modal = document.getElementById('party-modal');
    if (modal) {
        modal.innerHTML = modal.innerHTML
            .replace(/지역:/g, isEnglish ? 'Region:' : '지역:')
            .replace(/장소:/g, isEnglish ? 'Venue:' : '장소:')
            .replace(/주소:/g, isEnglish ? 'Address:' : '주소:')
            .replace(/지도 보기/g, isEnglish ? 'View Map' : '지도 보기')
            .replace(/날짜:/g, isEnglish ? 'Date:' : '날짜:')
            .replace(/일시:/g, isEnglish ? 'Date & Time:' : '일시:')
            .replace(/등록자:/g, isEnglish ? 'Author:' : '등록자:')
            .replace(/연락처:/g, isEnglish ? 'Contact:' : '연락처:')
            .replace(/상세 설명:/g, isEnglish ? 'Description:' : '상세 설명:')
            .replace(/상세보기/g, isEnglish ? 'Details' : '상세보기')
            .replace(/공유/g, isEnglish ? 'Share' : '공유')
            .replace(/수정/g, isEnglish ? 'Edit' : '수정')
            .replace(/삭제/g, isEnglish ? 'Delete' : '삭제');
    }
    // 빈 상태 안내
    document.querySelectorAll('.empty-state h3').forEach(h3 => {
        h3.textContent = isEnglish
            ? (h3.textContent.includes('등록된') ? '🎉 No parties registered yet' : '📦 No past parties')
            : (h3.textContent.includes('No') ? '🎉 아직 등록된 파티가 없습니다' : '📦 지난 파티가 없습니다');
    });
    document.querySelectorAll('.empty-state p').forEach(p => {
        p.textContent = isEnglish
            ? (p.textContent.includes('첫 번째') ? 'Register the first party!' : 'Past parties will be moved here automatically when finished!')
            : (p.textContent.includes('Register') ? '첫 번째 파티를 등록해보세요!' : '아직 지난 파티가 없습니다. 파티가 끝나면 여기에 자동으로 이동됩니다!');
    });
    // 갤러리 안내
    const galleryContainer = document.getElementById('gallery-container');
    if (galleryContainer) {
        galleryContainer.querySelectorAll('h4').forEach(h4 => {
            h4.textContent = isEnglish ? 'No photos uploaded yet' : '아직 업로드된 사진이 없습니다';
        });
        galleryContainer.querySelectorAll('p').forEach(p => {
            if (p.textContent.includes('첫 번째')) p.textContent = isEnglish ? 'Upload the first photo!' : '첫 번째 사진을 업로드해보세요! 📸';
        });
    }
    // 댓글 안내
    const commentsContainer = document.getElementById('comments-container');
    if (commentsContainer) {
        commentsContainer.querySelectorAll('p').forEach(p => {
            if (p.textContent.includes('댓글')) p.textContent = isEnglish ? 'No comments yet. Leave the first comment!' : '아직 댓글이 없습니다. 첫 댓글을 남겨보세요! 💬';
        });
    }
    // 삭제 모달
    document.querySelectorAll('.delete-confirm-content h3').forEach(h3 => {
        h3.textContent = isEnglish ? '🗑️ Delete Confirmation' : '🗑️ 삭제 확인';
    });
    document.querySelectorAll('.delete-confirm-content p').forEach(p => {
        if (p.textContent.includes('정말로')) p.textContent = isEnglish ? 'Are you sure you want to delete this party?\nThis action cannot be undone.' : '정말로 이 파티를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.';
    });
    document.querySelectorAll('.delete-confirm-btn.cancel').forEach(btn => {
        btn.textContent = isEnglish ? 'Cancel' : '취소';
    });
    document.querySelectorAll('.delete-confirm-btn.confirm').forEach(btn => {
        btn.textContent = isEnglish ? 'Delete' : '삭제';
    });
    
    // 로그인/로그아웃 버튼 (사용자 이름 포함)
    document.querySelectorAll('.login-btn, .logout-btn').forEach(btn => {
        if (btn.textContent.includes('안녕하세요')) {
            const userName = btn.textContent.match(/안녕하세요,\s*([^님!]+)님!/)?.[1] || '';
            btn.textContent = isEnglish ? `Hello, ${userName}! 👏` : `안녕하세요, ${userName}님! 👏`;
        } else if (btn.textContent.includes('로그아웃')) {
            btn.textContent = isEnglish ? 'Logout' : '로그아웃';
        }
    });
    
    // 영상 갤러리 제목
    document.querySelectorAll('h2, h3').forEach(heading => {
        if (heading.textContent.includes('라틴댄스 영상 갤러리')) {
            heading.textContent = isEnglish ? '📺 Latin Dance Video Gallery' : '📺 라틴댄스 영상 갤러리';
        }
    });
    
    // 카드 내부 라벨 (Name:, Address:, Time: 등)
    document.querySelectorAll('.party-card, .party-info').forEach(element => {
        element.innerHTML = element.innerHTML
            .replace(/Name:/g, isEnglish ? 'Name:' : '이름:')
            .replace(/Address:/g, isEnglish ? 'Address:' : '주소:')
            .replace(/Time:/g, isEnglish ? 'Time:' : '시간:')
            .replace(/Location:/g, isEnglish ? 'Location:' : '위치:')
            .replace(/Venue:/g, isEnglish ? 'Venue:' : '장소:')
            .replace(/Date:/g, isEnglish ? 'Date:' : '날짜:')
            .replace(/Contact:/g, isEnglish ? 'Contact:' : '연락처:')
            .replace(/Author:/g, isEnglish ? 'Author:' : '작성자:')
            .replace(/Organizer:/g, isEnglish ? 'Organizer:' : '주최자:');
    });
    
    // 유튜브 섹션 관련
    document.querySelectorAll('.youtube-section h2, .video-gallery h2').forEach(heading => {
        if (heading.textContent.includes('영상 갤러리')) {
            heading.textContent = isEnglish ? '📺 Video Gallery' : '📺 영상 갤러리';
        }
    });
    
    // 홍보 앨범 섹션
    document.querySelectorAll('.album-section h2, .promotion-gallery h2').forEach(heading => {
        if (heading.textContent.includes('홍보 앨범')) {
            heading.textContent = isEnglish ? '📸 Promotion Album' : '📸 홍보 앨범';
        }
    });
    
    // 기타 섹션 제목들
    document.querySelectorAll('h2, h3').forEach(heading => {
        const text = heading.textContent;
        if (text.includes('등록된 파티')) {
            heading.textContent = isEnglish ? '🎉 Registered Parties' : '🎉 등록된 파티';
        } else if (text.includes('파티 등록하기')) {
            heading.textContent = isEnglish ? 'Register Party' : '파티 등록하기';
        } else if (text.includes('홍보 앨범 보기')) {
            heading.textContent = isEnglish ? 'View Album' : '홍보 앨범 보기';
        }
    });

    // 구글 번역 API 호출 함수
    async function translateText(text, targetLang) {
        // text: 번역할 문자열, targetLang: 'ko' 또는 'en'
        if (!text || text.trim() === '') return text;
        try {
            const res = await fetch('/translate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({text, target: targetLang})
            });
            const data = await res.json();
            return data.translated || text;
        } catch (e) {
            console.error('번역 API 오류:', e);
            return text;
        }
    }

    // 파티 등록 폼의 제목/설명 등 사용자 입력 데이터 번역 (영어→한글, 한글→영어)
    async function translatePartyFields(targetLang) {
        // targetLang: 'ko' 또는 'en'
        const titleInput = document.getElementById('party-title');
        const descInput = document.getElementById('party-description');
        if (titleInput && descInput) {
            titleInput.value = await translateText(titleInput.value, targetLang);
            descInput.value = await translateText(descInput.value, targetLang);
        }
        // 필요시 다른 입력 필드도 추가 가능
    }

    // ... 기존 toggleEnglish 함수 내부에 아래 코드 추가 ...
    // UI 라벨/버튼 등 치환 후, 사용자 입력 데이터도 번역
    translatePartyFields(isEnglish ? 'en' : 'ko');
    // ... existing code ...

    // 번역 캐시(메모리)
    const translationCache = {};

    // 카드/상세/리스트의 주요 데이터 번역 함수
    async function translatePartyCardsAndDetails(targetLang) {
        // 모든 파티 카드
        const cards = document.querySelectorAll('.party-card');
        for (const card of cards) {
            // 주요 텍스트 요소들 추출
            const infoRows = card.querySelectorAll('.party-info, .party-description');
            for (const row of infoRows) {
                // 이미 번역된 값 캐시 확인
                const originalText = row.getAttribute('data-original') || row.textContent;
                row.setAttribute('data-original', originalText); // 최초 원본 저장
                const cacheKey = `${originalText}|${targetLang}`;
                if (translationCache[cacheKey]) {
                    row.textContent = translationCache[cacheKey];
                } else {
                    row.textContent = '번역 중...';
                    const translated = await translateText(originalText, targetLang);
                    translationCache[cacheKey] = translated;
                    row.textContent = translated;
                }
            }
        }
        // 상세 모달 내 주요 정보도 번역
        const modal = document.getElementById('party-modal');
        if (modal) {
            const infoRows = modal.querySelectorAll('.party-info-row, .party-description');
            for (const row of infoRows) {
                const originalText = row.getAttribute('data-original') || row.textContent;
                row.setAttribute('data-original', originalText);
                const cacheKey = `${originalText}|${targetLang}`;
                if (translationCache[cacheKey]) {
                    row.textContent = translationCache[cacheKey];
                } else {
                    row.textContent = 'Translating...';
                    const translated = await translateText(originalText, targetLang);
                    translationCache[cacheKey] = translated;
                    row.textContent = translated;
                }
            }
        }
    }

    // ... 기존 toggleEnglish 함수 내부 마지막에 아래 코드 추가 ...
    translatePartyCardsAndDetails(isEnglish ? 'en' : 'ko');
}

// 스페인어 번역 토글 함수 (3개 언어 지원)
let isSpanish = false;
function toggleSpanish() {
    console.log('스페인어 모드로 전환');
    
    // 클릭 시각적 피드백
    const espBtn = document.getElementById('translate-es-btn');
    espBtn.style.transform = 'scale(0.9)';
    setTimeout(() => {
        espBtn.style.transform = '';
    }, 150);
    
    // 모든 버튼에서 active 클래스 제거
    document.getElementById('translate-kor-btn').classList.remove('active');
    document.getElementById('translate-btn').classList.remove('active');
    document.getElementById('translate-es-btn').classList.remove('active');
    
    // 스페인어 버튼에 active 클래스 추가
    document.getElementById('translate-es-btn').classList.add('active');
    
    // 헤더
    document.querySelector('header h1').textContent = '🕺💃 Comunidad de Fiestas de Baile Latino';
    document.querySelector('header p').textContent = '¡Descubre fiestas de baile latino en todo el país y conoce nuevos amigos!';
    
    // 타이틀 버튼
    const btns = document.querySelectorAll('.title-btn');
    if (btns.length >= 3) {
        btns[0].textContent = 'Registrar Fiesta';
        btns[1].textContent = 'Ver Álbum';
        btns[2].textContent = 'Galería de Videos';
    }
    
    // 필터 라벨
    const filterLabels = document.querySelectorAll('.filter-container label');
    filterLabels.forEach(label => {
        if (label.textContent.includes('지역') || label.textContent.includes('Region')) {
            label.textContent = 'Región:';
        } else if (label.textContent.includes('날짜') || label.textContent.includes('Date')) {
            label.textContent = 'Fecha:';
        }
    });
    
    // 필터 옵션
    const regionSelect = document.querySelector('select[name="region"]');
    if (regionSelect) {
        const options = regionSelect.options;
        if (options.length > 0) {
            options[0].textContent = 'Todas las Regiones';
        }
    }
    
    // 파티 카드 번역
    const partyCards = document.querySelectorAll('.party-card');
    partyCards.forEach(card => {
        // 제목
        const title = card.querySelector('.party-title');
        if (title) {
            title.textContent = title.textContent.replace('파티', 'Fiesta').replace('Party', 'Fiesta');
        }
        
        // 정보 행들
        const infoRows = card.querySelectorAll('.party-info');
        infoRows.forEach(row => {
            const text = row.textContent;
            if (text.includes('지역:') || text.includes('Region:')) {
                row.innerHTML = row.innerHTML.replace('지역:', 'Región:').replace('Region:', 'Región:');
            } else if (text.includes('바 이름:') || text.includes('Bar:')) {
                row.innerHTML = row.innerHTML.replace('바 이름:', 'Bar:').replace('Bar:', 'Bar:');
            } else if (text.includes('상세주소:') || text.includes('Address:')) {
                row.innerHTML = row.innerHTML.replace('상세주소:', 'Dirección:').replace('Address:', 'Dirección:');
            } else if (text.includes('장소:') || text.includes('Venue:')) {
                row.innerHTML = row.innerHTML.replace('장소:', 'Lugar:').replace('Venue:', 'Lugar:');
            } else if (text.includes('일시:') || text.includes('Date:')) {
                row.innerHTML = row.innerHTML.replace('일시:', 'Fecha:').replace('Date:', 'Fecha:');
            } else if (text.includes('등록자:') || text.includes('Registrant:')) {
                row.innerHTML = row.innerHTML.replace('등록자:', 'Registrante:').replace('Registrant:', 'Registrante:');
            }
        });
    });
    
    // 번역 버튼 텍스트
    document.getElementById('translate-kor-btn').textContent = 'Kor';
    document.getElementById('translate-kor-btn').title = '한국어로 보기';
    document.getElementById('translate-btn').textContent = 'Eng';
    document.getElementById('translate-btn').title = '영어로 보기';
    document.getElementById('translate-es-btn').textContent = 'Esp';
    document.getElementById('translate-es-btn').title = '스페인어로 보기';
    
    // 전역 변수 업데이트
    window.isEnglish = false;
    window.isSpanish = true;
    
    showMessage('🇪🇸 스페인어 모드로 전환되었습니다!', 'success');
    
    // 푸터
    const footerInfo = document.querySelector('.footer-info p');
    if (footerInfo) {
        footerInfo.innerHTML = isSpanish
            ? 'Ubicación: Seúl | Administrador: Luna | Contacto: Instagram <a href="https://www.instagram.com/lunastarin" target="_blank">@lunastarin</a> | YouTube <a href="https://www.youtube.com/@lunastarin" target="_blank">@lunastarin</a>'
            : '소재지 : 서울시 | 관리자 : 루나 | 문의 : 인스타 <a href="https://www.instagram.com/lunastarin" target="_blank">@lunastarin</a> | 유튜브 <a href="https://www.youtube.com/@lunastarin" target="_blank">@lunastarin</a>';
    }
    const footerCopy = document.querySelector('.footer-copyright p');
    if (footerCopy) {
        footerCopy.textContent = isSpanish ? '© 2025 Comunidad de Fiestas Latinmat' : '© 2025 라틴맛 파티 커뮤니티';
    }
    
            // 폼 라벨/placeholder (스페인어)
        const labelMap = {
            'party-title': isSpanish ? 'Título de la Fiesta:' : '파티 제목:',
            'party-region': isSpanish ? 'Región:' : '지역:',
            'party-bar-name': isSpanish ? 'Nombre del Bar:' : '바 이름:',
            'party-address': isSpanish ? 'Dirección:' : '상세주소:',
            'party-location': isSpanish ? 'Lugar:' : '상세 장소:',
            'party-start-date': isSpanish ? 'Fecha de Inicio:' : '시작일:',
            'party-end-date': isSpanish ? 'Fecha de Fin:' : '종료일:',
            'party-duration': isSpanish ? 'Duración:' : '기간:',
            'party-time': isSpanish ? 'Hora:' : '시간:',
            'party-description': isSpanish ? 'Descripción:' : '상세 설명:',
            'party-contact': isSpanish ? 'Contacto:' : '연락처:',
            'party-poster': isSpanish ? 'Póster de la Fiesta:' : '파티 포스터:'
        };
    Object.keys(labelMap).forEach(id => {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) label.textContent = labelMap[id];
    });
    
            // placeholder (스페인어)
        const placeholderMap = {
            'party-title': isSpanish ? 'ej: Fiesta de Salsa - Noche de Pasión' : '예: 살사 파티 - 열정의 밤',
            'party-bar-name': isSpanish ? 'ej: Bar Latino' : '예: 라틴바',
            'party-address': isSpanish ? 'ej: 123 Teheran-ro, Gangnam-gu, Seúl' : '예: 서울시 강남구 테헤란로 123',
            'party-location': isSpanish ? 'ej: Estudio de Baile Gangnam' : '예: 강남구 OO댄스스튜디오',
            'party-description': isSpanish ? 'Ingrese una descripción detallada de la fiesta...' : '파티에 대한 자세한 설명을 입력하세요...',
            'party-contact': isSpanish ? 'Contacto (opcional)' : '연락처 (선택사항)'
        };
        Object.keys(placeholderMap).forEach(id => {
            const input = document.getElementById(id);
            if (input) input.placeholder = placeholderMap[id];
        });
        
        // 기간 선택 드롭다운 번역 (스페인어)
        const durationSelect = document.getElementById('party-duration');
        if (durationSelect) {
            const options = durationSelect.options;
            if (options.length >= 3) {
                options[0].text = isSpanish ? '1 Día' : '1일';
                options[1].text = isSpanish ? '2 Días' : '2일';
                options[2].text = isSpanish ? '3 Días' : '3일';
            }
        }
    
    // 등록/취소 버튼
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.textContent = isSpanish ? 'Registrar Fiesta' : '파티 등록하기';
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.textContent = isSpanish ? 'Cancelar Edición' : '편집 취소';
    
    // 탭
    const tabBtns = document.querySelectorAll('.tab-btn');
    if (tabBtns.length >= 2) {
        tabBtns[0].innerHTML = isSpanish ? '📅 Fiestas en Curso' : '📅 진행중인 파티';
        tabBtns[1].innerHTML = isSpanish ? '📦 Archivo de Fiestas Pasadas' : '📦 지난 파티 보관함';
    }
    
    // 필터
    const regionFilter = document.getElementById('region-filter');
    if (regionFilter) regionFilter.options[0].text = isSpanish ? 'Todas las Regiones' : '모든 지역';
    const pastRegionFilter = document.getElementById('past-region-filter');
    if (pastRegionFilter) pastRegionFilter.options[0].text = isSpanish ? 'Todas las Regiones' : '모든 지역';
    const dateFilter = document.getElementById('date-filter');
    if (dateFilter) dateFilter.placeholder = isSpanish ? 'Filtro de Fecha' : '날짜 필터';
    const pastDateFilter = document.getElementById('past-date-filter');
    if (pastDateFilter) pastDateFilter.placeholder = isSpanish ? 'Filtro de Fecha' : '날짜 필터';
    
    // 카드/상세/버튼 등 (스페인어)
    document.querySelectorAll('.party-card').forEach(card => {
        card.innerHTML = card.innerHTML
            .replace(/지역:/g, isSpanish ? 'Región:' : '지역:')
            .replace(/바 이름:/g, isSpanish ? 'Nombre del Bar:' : '바 이름:')
            .replace(/지도/g, isSpanish ? 'Mapa' : '지도')
            .replace(/상세주소:/g, isSpanish ? 'Dirección:' : '상세주소:')
            .replace(/장소:/g, isSpanish ? 'Lugar:' : '장소:')
            .replace(/일시:/g, isSpanish ? 'Fecha y Hora:' : '일시:')
            .replace(/등록자:/g, isSpanish ? 'Autor:' : '등록자:')
            .replace(/연락처:/g, isSpanish ? 'Contacto:' : '연락처:')
            .replace(/명이 좋아합니다/g, isSpanish ? 'le gusta esto' : '명이 좋아합니다')
            .replace(/상세보기/g, isSpanish ? 'Detalles' : '상세보기')
            .replace(/공유/g, isSpanish ? 'Compartir' : '공유')
            .replace(/수정/g, isSpanish ? 'Editar' : '수정')
            .replace(/삭제/g, isSpanish ? 'Eliminar' : '삭제');
    });
    
    // 상세 모달 (스페인어)
    const modal = document.getElementById('party-modal');
    if (modal) {
        modal.innerHTML = modal.innerHTML
            .replace(/지역:/g, isSpanish ? 'Región:' : '지역:')
            .replace(/장소:/g, isSpanish ? 'Lugar:' : '장소:')
            .replace(/주소:/g, isSpanish ? 'Dirección:' : '주소:')
            .replace(/지도 보기/g, isSpanish ? 'Ver Mapa' : '지도 보기')
            .replace(/날짜:/g, isSpanish ? 'Fecha:' : '날짜:')
            .replace(/일시:/g, isSpanish ? 'Fecha y Hora:' : '일시:')
            .replace(/등록자:/g, isSpanish ? 'Autor:' : '등록자:')
            .replace(/연락처:/g, isSpanish ? 'Contacto:' : '연락처:')
            .replace(/상세 설명:/g, isSpanish ? 'Descripción:' : '상세 설명:')
            .replace(/상세보기/g, isSpanish ? 'Detalles' : '상세보기')
            .replace(/공유/g, isSpanish ? 'Compartir' : '공유')
            .replace(/수정/g, isSpanish ? 'Editar' : '수정')
            .replace(/삭제/g, isSpanish ? 'Eliminar' : '삭제');
    }
    
    // 빈 상태 안내 (스페인어)
    document.querySelectorAll('.empty-state h3').forEach(h3 => {
        h3.textContent = isSpanish
            ? (h3.textContent.includes('등록된') ? '🎉 Aún no hay fiestas registradas' : '📦 No hay fiestas pasadas')
            : (h3.textContent.includes('No') ? '🎉 아직 등록된 파티가 없습니다' : '📦 지난 파티가 없습니다');
    });
    document.querySelectorAll('.empty-state p').forEach(p => {
        p.textContent = isSpanish
            ? (p.textContent.includes('첫 번째') ? '¡Registra la primera fiesta!' : '¡Las fiestas pasadas se moverán aquí automáticamente cuando terminen!')
            : (p.textContent.includes('Register') ? '첫 번째 파티를 등록해보세요!' : '아직 지난 파티가 없습니다. 파티가 끝나면 여기에 자동으로 이동됩니다!');
    });
    
    // 갤러리 안내 (스페인어)
    const galleryContainer = document.getElementById('gallery-container');
    if (galleryContainer) {
        galleryContainer.querySelectorAll('h4').forEach(h4 => {
            h4.textContent = isSpanish ? 'Aún no se han subido fotos' : '아직 업로드된 사진이 없습니다';
        });
        galleryContainer.querySelectorAll('p').forEach(p => {
            if (p.textContent.includes('첫 번째')) p.textContent = isSpanish ? '¡Sube la primera foto!' : '첫 번째 사진을 업로드해보세요! 📸';
        });
    }
    
    // 댓글 안내 (스페인어)
    const commentsContainer = document.getElementById('comments-container');
    if (commentsContainer) {
        commentsContainer.querySelectorAll('p').forEach(p => {
            if (p.textContent.includes('댓글')) p.textContent = isSpanish ? 'Aún no hay comentarios. ¡Deja el primer comentario!' : '아직 댓글이 없습니다. 첫 댓글을 남겨보세요! 💬';
        });
    }
    
    // 삭제 모달 (스페인어)
    document.querySelectorAll('.delete-confirm-content h3').forEach(h3 => {
        h3.textContent = isSpanish ? '🗑️ Confirmar Eliminación' : '🗑️ 삭제 확인';
    });
    document.querySelectorAll('.delete-confirm-content p').forEach(p => {
        if (p.textContent.includes('정말로')) p.textContent = isSpanish ? '¿Estás seguro de que quieres eliminar esta fiesta?\nEsta acción no se puede deshacer.' : '정말로 이 파티를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.';
    });
    document.querySelectorAll('.delete-confirm-btn.cancel').forEach(btn => {
        btn.textContent = isSpanish ? 'Cancelar' : '취소';
    });
    document.querySelectorAll('.delete-confirm-btn.confirm').forEach(btn => {
        btn.textContent = isSpanish ? 'Eliminar' : '삭제';
    });
    
    // 로그인/로그아웃 버튼 (스페인어)
    document.querySelectorAll('.login-btn, .logout-btn').forEach(btn => {
        if (btn.textContent.includes('안녕하세요')) {
            const userName = btn.textContent.match(/안녕하세요,\s*([^님!]+)님!/)?.[1] || '';
            btn.textContent = isSpanish ? `¡Hola, ${userName}! 👏` : `안녕하세요, ${userName}님! 👏`;
        } else if (btn.textContent.includes('로그아웃')) {
            btn.textContent = isSpanish ? 'Cerrar Sesión' : '로그아웃';
        }
    });
    
    // 영상 갤러리 제목 (스페인어)
    document.querySelectorAll('h2, h3').forEach(heading => {
        if (heading.textContent.includes('라틴댄스 영상 갤러리')) {
            heading.textContent = isSpanish ? '📺 Galería de Videos de Baile Latino' : '📺 라틴댄스 영상 갤러리';
        }
    });
    
    // 카드 내부 라벨 (스페인어)
    document.querySelectorAll('.party-card, .party-info').forEach(element => {
        element.innerHTML = element.innerHTML
            .replace(/Name:/g, isSpanish ? 'Nombre:' : '이름:')
            .replace(/Address:/g, isSpanish ? 'Dirección:' : '주소:')
            .replace(/Time:/g, isSpanish ? 'Hora:' : '시간:')
            .replace(/Location:/g, isSpanish ? 'Ubicación:' : '위치:')
            .replace(/Venue:/g, isSpanish ? 'Lugar:' : '장소:')
            .replace(/Date:/g, isSpanish ? 'Fecha:' : '날짜:')
            .replace(/Contact:/g, isSpanish ? 'Contacto:' : '연락처:')
            .replace(/Author:/g, isSpanish ? 'Autor:' : '작성자:')
            .replace(/Organizer:/g, isSpanish ? 'Organizador:' : '주최자:');
    });
    
    // 유튜브 섹션 관련 (스페인어)
    document.querySelectorAll('.youtube-section h2, .video-gallery h2').forEach(heading => {
        if (heading.textContent.includes('영상 갤러리')) {
            heading.textContent = isSpanish ? '📺 Galería de Videos' : '📺 영상 갤러리';
        }
    });
    
    // 홍보 앨범 섹션 (스페인어)
    document.querySelectorAll('.album-section h2, .promotion-gallery h2').forEach(heading => {
        if (heading.textContent.includes('홍보 앨범')) {
            heading.textContent = isSpanish ? '📸 Álbum de Promoción' : '📸 홍보 앨범';
        }
    });
    
    // 기타 섹션 제목들 (스페인어)
    document.querySelectorAll('h2, h3').forEach(heading => {
        const text = heading.textContent;
        if (text.includes('등록된 파티')) {
            heading.textContent = isSpanish ? '🎉 Fiestas Registradas' : '🎉 등록된 파티';
        } else if (text.includes('파티 등록하기')) {
            heading.textContent = isSpanish ? 'Registrar Fiesta' : '파티 등록하기';
        } else if (text.includes('홍보 앨범 보기')) {
            heading.textContent = isSpanish ? 'Ver Álbum' : '홍보 앨범 보기';
        }
    });
    
    // UI 라벨/버튼 등 치환 후, 사용자 입력 데이터도 번역
    translatePartyFields(isSpanish ? 'es' : 'ko');
    
    // 카드/상세/리스트의 주요 데이터 번역
    translatePartyCardsAndDetails(isSpanish ? 'es' : 'ko');
}

// 날짜 범위 포맷팅 함수
function formatPartyDateRange(party) {
    // 새로운 날짜 범위 시스템 지원
    if (party.startDate && party.endDate) {
        const startDate = new Date(party.startDate);
        const endDate = new Date(party.endDate);
        
        // 시작일과 종료일이 같으면 단일 날짜로 표시
        if (party.isSingleDay || startDate.getTime() === endDate.getTime()) {
            return startDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
        }
        
        // 날짜 범위로 표시
        const startFormatted = startDate.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric'
        });
        const endFormatted = endDate.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        
        return `${startFormatted} ~ ${endFormatted}`;
    }
    
    // 기존 단일 날짜 시스템 (하위 호환성)
    if (party.date) {
        return new Date(party.date).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    }
    
    return '날짜 미정';
}

// 기간 선택에 따른 종료일 자동 설정
function setupDurationChangeHandler() {
    const startDateInput = document.getElementById('party-start-date');
    const endDateInput = document.getElementById('party-end-date');
    const durationSelect = document.getElementById('party-duration');
    
    if (startDateInput && endDateInput && durationSelect) {
        // 시작일 변경 시 종료일 자동 설정
        startDateInput.addEventListener('change', function() {
            updateEndDate();
        });
        
        // 기간 변경 시 종료일 자동 설정
        durationSelect.addEventListener('change', function() {
            updateEndDate();
        });
        
        function updateEndDate() {
            const startDate = startDateInput.value;
            const duration = parseInt(durationSelect.value) || 1;
            
            if (startDate) {
                const start = new Date(startDate);
                const end = new Date(start);
                end.setDate(start.getDate() + duration - 1); // 시작일 포함하여 계산
                
                const endDateString = end.toISOString().split('T')[0];
                endDateInput.value = endDateString;
            }
        }
    }
}

// 페이지 로드 시 기간 변경 핸들러 설정
document.addEventListener('DOMContentLoaded', function() {
    setupDurationChangeHandler();
    setupTimeInputHandler();
    
    // 중복 파티 삭제 버튼 추가
    setTimeout(addDuplicateDeleteButton, 2000);
});

// 중복 파티 삭제 함수
function deleteDuplicateParties() {
    console.log('=== 중복 파티 삭제 시작 ===');
    
    try {
        const parties = JSON.parse(localStorage.getItem('latinDanceParties') || '[]');
        console.log('현재 파티 개수:', parties.length);
        
        // 중복 파티 찾기
        const duplicates = [];
        const seen = new Set();
        
        parties.forEach((party, index) => {
            const key = `${party.title}_${party.startDate}_${party.barName}`;
            if (seen.has(key)) {
                duplicates.push({ party, index });
            } else {
                seen.add(key);
            }
        });
        
        console.log('발견된 중복 파티:', duplicates.length);
        
        if (duplicates.length === 0) {
            showMessage('중복된 파티가 없습니다.', 'info');
            return;
        }
        
        // 중복 파티 삭제 (나중에 등록된 것부터 삭제)
        duplicates.sort((a, b) => b.index - a.index);
        
        let deletedCount = 0;
        duplicates.forEach(({ party, index }) => {
            parties.splice(index, 1);
            deletedCount++;
            console.log('중복 파티 삭제:', party.title, 'ID:', party.id);
        });
        
        // 로컬 스토리지 업데이트
        localStorage.setItem('latinDanceParties', JSON.stringify(parties));
        
        showMessage(`${deletedCount}개의 중복 파티가 삭제되었습니다.`, 'success');
        
        // 페이지 새로고침
        setTimeout(() => {
            location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('중복 파티 삭제 실패:', error);
        showMessage('중복 파티 삭제에 실패했습니다.', 'error');
    }
}

// 중복 파티 삭제 버튼 추가
function addDuplicateDeleteButton() {
    const container = document.getElementById('parties-container');
    if (container) {
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🔄 중복 파티 정리';
        deleteButton.className = 'duplicate-delete-btn';
        deleteButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4757;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            z-index: 1000;
            font-size: 14px;
        `;
        deleteButton.onclick = deleteDuplicateParties;
        
        document.body.appendChild(deleteButton);
        console.log('중복 파티 삭제 버튼 추가됨');
    }
}

// 시간 입력을 30분 간격으로 제한
function setupTimeInputHandler() {
    const timeInput = document.getElementById('party-time');
    
    if (timeInput) {
        timeInput.addEventListener('change', function() {
            const timeValue = this.value;
            if (timeValue) {
                const [hours, minutes] = timeValue.split(':').map(Number);
                
                // 분을 0 또는 30으로 조정
                let adjustedMinutes = minutes;
                if (minutes < 15) {
                    adjustedMinutes = 0;
                } else if (minutes < 45) {
                    adjustedMinutes = 30;
                } else {
                    adjustedMinutes = 0;
                    // 시간을 다음 시간으로 조정
                    if (hours < 23) {
                        this.value = `${String(hours + 1).padStart(2, '0')}:00`;
                    } else {
                        this.value = '00:00';
                    }
                    return;
                }
                
                this.value = `${String(hours).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;
            }
        });
        
        // 초기값 설정 (현재 시간을 30분 간격으로 조정)
        if (!timeInput.value) {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            
            let adjustedMinutes = minutes < 30 ? 0 : 30;
            let adjustedHours = hours;
            
            if (minutes >= 45) {
                adjustedMinutes = 0;
                adjustedHours = hours + 1;
                if (adjustedHours >= 24) adjustedHours = 0;
            }
            
            timeInput.value = `${String(adjustedHours).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;
        }
    }
}