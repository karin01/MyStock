// 학습 노트 공유 앱 프론트엔드 JS
// 한글 주석 포함, 백엔드 API 연동

const API_BASE = "http://localhost:5000"; // 백엔드 서버 주소로 수정

document.addEventListener('DOMContentLoaded', () => {
    // 노트 업로드
    const uploadForm = document.getElementById('uploadForm');
    const uploadResult = document.getElementById('uploadResult');
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        uploadResult.textContent = '업로드 중...';
        try {
            const res = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                uploadResult.textContent = '업로드 성공!';
                uploadForm.reset();
                loadNotes();
            } else {
                uploadResult.textContent = data.error || '업로드 실패';
            }
        } catch (err) {
            uploadResult.textContent = '네트워크 오류';
        }
    });

    // 노트 검색/목록
    const searchBtn = document.getElementById('searchBtn');
    const searchTags = document.getElementById('searchTags');
    searchBtn.addEventListener('click', loadNotes);
    loadNotes(); // 최초 로딩 시 전체 목록

    async function loadNotes() {
        const tags = searchTags.value.trim();
        let url = `${API_BASE}/notes`;
        if (tags) url += `?tags=${encodeURIComponent(tags)}`;
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = '불러오는 중...';
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) {
                if (data.notes.length === 0) {
                    notesList.innerHTML = '<p>노트가 없습니다.</p>';
                } else {
                    notesList.innerHTML = '';
                    data.notes.forEach(note => {
                        notesList.innerHTML += renderNoteCard(note);
                    });
                    bindNoteActions();
                }
            } else {
                notesList.innerHTML = `<p>${data.error || '목록 불러오기 실패'}</p>`;
            }
        } catch (err) {
            notesList.innerHTML = '<p>네트워크 오류</p>';
        }
    }

    // 노트 카드 렌더링
    function renderNoteCard(note) {
        // PDF 파일 여부 확인
        const isPdf = note.filename && note.filename.toLowerCase().endsWith('.pdf');
        return `
        <div class="note-card" data-id="${note.id}" data-file-url="${note.file_url || ''}" data-filename="${note.filename || ''}">
            <div class="note-title">${note.title}</div>
            <div class="note-meta">작성자: ${note.uploader || '익명'} | 태그: ${note.tags ? note.tags.join(', ') : ''} <br>업로드: ${note.uploaded_at ? note.uploaded_at.split('T')[0] : ''}</div>
            <div class="note-actions">
                ${isPdf ? '<button class="view-pdf">공부하기</button>' : ''}
                ${isPdf ? '<button class="summarize-pdf">정리하기</button>' : ''}
                <button class="download">다운로드</button>
                <button class="generate-question">질문 생성</button>
                <button class="delete">삭제</button>
            </div>
        </div>
        `;
    }

    // 노트 카드 내 버튼 이벤트 바인딩
    function bindNoteActions() {
        document.querySelectorAll('.note-card').forEach(card => {
            const noteId = card.getAttribute('data-id');
            const fileUrl = card.getAttribute('data-file-url');
            const filename = card.getAttribute('data-filename');
            // 다운로드
            card.querySelector('.download').onclick = () => {
                window.open(`${API_BASE}/download/${noteId}`, '_blank');
            };
            // 삭제
            card.querySelector('.delete').onclick = async () => {
                // 암호 입력 받기 (한글 주석)
                const password = prompt('이 노트를 삭제하려면 업로드 시 입력한 암호를 입력하세요:');
                if (!password) return;
                try {
                    const res = await fetch(`${API_BASE}/delete/${noteId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert('삭제 성공');
                        loadNotes();
                    } else {
                        alert(data.error || '삭제 실패');
                    }
                } catch (err) {
                    alert('네트워크 오류');
                }
            };
            // 질문 생성
            card.querySelector('.generate-question').onclick = async () => {
                card.querySelector('.generate-question').textContent = '생성 중...';
                try {
                    const res = await fetch(`${API_BASE}/generate-question`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ note_id: noteId })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        document.getElementById('questionResult').innerText = data.questions;
                        document.getElementById('questionModal').style.display = 'flex';
                    } else {
                        alert(data.error || '질문 생성 실패');
                    }
                } catch (err) {
                    alert('네트워크 오류');
                }
                card.querySelector('.generate-question').textContent = '질문 생성';
            };
            // PDF 보기 (PDF 파일만)
            const viewPdfBtn = card.querySelector('.view-pdf');
            if (viewPdfBtn && fileUrl && filename && filename.toLowerCase().endsWith('.pdf')) {
                viewPdfBtn.onclick = () => {
                    window.open(fileUrl, '_blank');
                };
            }

            // PDF 정리하기 버튼
            const summarizeBtn = card.querySelector('.summarize-pdf');
            if (summarizeBtn) {
                summarizeBtn.onclick = async () => {
                    summarizeBtn.textContent = '정리 중...';
                    try {
                        const res = await fetch(`${API_BASE}/summarize-pdf`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ note_id: noteId })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            // 팝업(모달)에 요약 결과 표시
                            document.getElementById('questionResult').innerText = data.summary;
                            document.getElementById('questionModal').style.display = 'flex';
                        } else {
                            alert(data.error || '정리 실패');
                        }
                    } catch (err) {
                        alert('네트워크 오류');
                    } finally {
                        summarizeBtn.textContent = '정리하기';
                    }
                };
            }
        });
    }

    // 팝업 파일 저장 기능 (한글 주석)
    // TXT 저장
    const txtBtn = document.getElementById('downloadTxtBtn');
    if (txtBtn) {
        txtBtn.onclick = function() {
            const text = document.getElementById('questionResult').innerText;
            const blob = new Blob([text], {type: 'text/plain'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = '질문_생성_결과.txt';
            link.click();
        };
    }

    // PDF 저장 (jsPDF 사용)
    const pdfBtn = document.getElementById('downloadPdfBtn');
    if (pdfBtn) {
        pdfBtn.onclick = function() {
            const text = document.getElementById('questionResult').innerText;
            if (window.jspdf && window.jspdf.jsPDF) {
                const doc = new window.jspdf.jsPDF();
                const lines = doc.splitTextToSize(text, 180);
                doc.text(lines, 10, 10);
                doc.save('질문_생성_결과.pdf');
            } else {
                alert('PDF 저장 라이브러리가 로드되지 않았습니다.');
            }
        };
    }

    // MD 저장
    const mdBtn = document.getElementById('downloadMdBtn');
    if (mdBtn) {
        mdBtn.onclick = function() {
            const text = document.getElementById('questionResult').innerText;
            const blob = new Blob([text], {type: 'text/markdown'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = '질문_생성_결과.md';
            link.click();
        };
    }

    // 모달 닫기 버튼 동작 추가
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.onclick = function() {
            document.getElementById('questionModal').style.display = 'none';
        };
    }

    // 관리자 기능 구현 (한글 주석)
    const adminBtn = document.getElementById('adminBtn');
    const adminModal = document.getElementById('adminModal');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminCancelBtn = document.getElementById('adminCancelBtn');
    const adminLoginMsg = document.getElementById('adminLoginMsg');
    const adminMenuModal = document.getElementById('adminMenuModal');
    const adminMenuCloseBtn = document.getElementById('adminMenuCloseBtn');
    const deleteAllNotesBtn = document.getElementById('deleteAllNotesBtn');
    const resetDbBtn = document.getElementById('resetDbBtn');
    const adminMenuMsg = document.getElementById('adminMenuMsg');

    let adminToken = null; // 간단한 토큰(세션)

    if (adminBtn) {
        adminBtn.onclick = function() {
            adminModal.style.display = 'flex';
            adminPasswordInput.value = '';
            adminLoginMsg.textContent = '';
        };
    }
    if (adminCancelBtn) {
        adminCancelBtn.onclick = function() {
            adminModal.style.display = 'none';
        };
    }
    if (adminLoginBtn) {
        adminLoginBtn.onclick = async function() {
            const pw = adminPasswordInput.value;
            if (!pw) {
                adminLoginMsg.textContent = '비밀번호를 입력하세요.';
                return;
            }
            // 관리자 로그인 API 호출
            try {
                const res = await fetch(`${API_BASE}/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: pw })
                });
                const data = await res.json();
                if (res.ok && data.token) {
                    adminToken = data.token;
                    adminModal.style.display = 'none';
                    adminMenuModal.style.display = 'flex';
                    adminMenuMsg.textContent = '';
                } else {
                    adminLoginMsg.textContent = data.error || '로그인 실패';
                }
            } catch (err) {
                adminLoginMsg.textContent = '네트워크 오류';
            }
        };
    }
    if (adminMenuCloseBtn) {
        adminMenuCloseBtn.onclick = function() {
            adminMenuModal.style.display = 'none';
        };
    }
    if (deleteAllNotesBtn) {
        deleteAllNotesBtn.onclick = async function() {
            if (!confirm('정말 전체 노트를 삭제하시겠습니까?')) return;
            try {
                const res = await fetch(`${API_BASE}/admin/delete-all-notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
                });
                const data = await res.json();
                if (res.ok) {
                    adminMenuMsg.textContent = '전체 노트 삭제 성공!';
                    loadNotes();
                } else {
                    adminMenuMsg.textContent = data.error || '삭제 실패';
                }
            } catch (err) {
                adminMenuMsg.textContent = '네트워크 오류';
            }
        };
    }
    if (resetDbBtn) {
        resetDbBtn.onclick = async function() {
            if (!confirm('정말 DB를 초기화하시겠습니까?')) return;
            try {
                const res = await fetch(`${API_BASE}/admin/reset-db`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
                });
                const data = await res.json();
                if (res.ok) {
                    adminMenuMsg.textContent = 'DB 초기화 성공!';
                    loadNotes();
                } else {
                    adminMenuMsg.textContent = data.error || '초기화 실패';
                }
            } catch (err) {
                adminMenuMsg.textContent = '네트워크 오류';
            }
        };
    }

    // 관리자 비밀번호 변경 기능
    const adminChangePwBtn = document.getElementById('adminChangePwBtn');
    const adminChangePwModal = document.getElementById('adminChangePwModal');
    const adminNewPwInput = document.getElementById('adminNewPwInput');
    const adminChangePwSubmit = document.getElementById('adminChangePwSubmit');
    const adminChangePwCancel = document.getElementById('adminChangePwCancel');
    const adminChangePwMsg = document.getElementById('adminChangePwMsg');
    const adminNotesList = document.getElementById('adminNotesList');

    if (adminChangePwBtn) {
        adminChangePwBtn.onclick = function() {
            adminChangePwModal.style.display = 'flex';
            adminNewPwInput.value = '';
            adminChangePwMsg.textContent = '';
        };
    }
    if (adminChangePwCancel) {
        adminChangePwCancel.onclick = function() {
            adminChangePwModal.style.display = 'none';
        };
    }
    if (adminChangePwSubmit) {
        adminChangePwSubmit.onclick = async function() {
            const newPw = adminNewPwInput.value;
            if (!newPw || newPw.length < 4) {
                adminChangePwMsg.textContent = '4자 이상 입력하세요.';
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/admin/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                    body: JSON.stringify({ new_password: newPw })
                });
                const data = await res.json();
                if (res.ok) {
                    adminChangePwMsg.textContent = '비밀번호 변경 성공!';
                    setTimeout(() => { adminChangePwModal.style.display = 'none'; }, 1200);
                } else {
                    adminChangePwMsg.textContent = data.error || '변경 실패';
                }
            } catch (err) {
                adminChangePwMsg.textContent = '네트워크 오류';
            }
        };
    }

    // 관리자 노트 목록 및 개별 삭제
    async function loadAdminNotes() {
        if (!adminNotesList) return;
        adminNotesList.innerHTML = '불러오는 중...';
        try {
            const res = await fetch(`${API_BASE}/notes`);
            const data = await res.json();
            if (res.ok && data.notes) {
                if (data.notes.length === 0) {
                    adminNotesList.innerHTML = '<div style="color:#888;">노트가 없습니다.</div>';
                    return;
                }
                adminNotesList.innerHTML = data.notes.map(note => `
                    <div style="display:flex; align-items:center; margin-bottom:6px;">
                        <span style="flex:1; font-size:14px;">${note.title} (${note.filename})</span>
                        <button class="admin-delete-note" data-id="${note.id}" style="background:#e57373; color:#fff; border:none; border-radius:4px; padding:2px 10px; margin-left:8px; font-size:13px;">삭제</button>
                    </div>
                `).join('');
                // 삭제 버튼 이벤트 바인딩
                adminNotesList.querySelectorAll('.admin-delete-note').forEach(btn => {
                    btn.onclick = async function() {
                        if (!confirm('정말 이 노트를 삭제하시겠습니까?')) return;
                        const noteId = btn.getAttribute('data-id');
                        try {
                            const res = await fetch(`${API_BASE}/admin/delete-note/${noteId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${adminToken}` }
                            });
                            const data = await res.json();
                            if (res.ok) {
                                btn.parentElement.remove();
                            } else {
                                alert(data.error || '삭제 실패');
                            }
                        } catch (err) {
                            alert('네트워크 오류');
                        }
                    };
                });
            } else {
                adminNotesList.innerHTML = '<div style="color:#e57373;">노트 목록 불러오기 실패</div>';
            }
        } catch (err) {
            adminNotesList.innerHTML = '<div style="color:#e57373;">네트워크 오류</div>';
        }
    }
    // 관리자 메뉴 진입 시 노트 목록 불러오기
    if (adminMenuModal) {
        const origShow = adminMenuModal.style.display;
        const observer = new MutationObserver(() => {
            if (adminMenuModal.style.display === 'flex') {
                loadAdminNotes();
            }
        });
        observer.observe(adminMenuModal, { attributes: true, attributeFilter: ['style'] });
    }
});