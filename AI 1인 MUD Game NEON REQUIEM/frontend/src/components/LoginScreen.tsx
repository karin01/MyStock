// 캐릭터 로그인 / 생성 화면
// WHY: 캐릭터 생성 시 직업 선택 및 보안 질문을 추가하여 게임성을 높이고 편의성을 제공한다.
import React, { useState, useMemo } from 'react';
import { 
  characterExists, 
  verifyPassword, 
  createNewCharacter, 
  type SavedCharacter, 
  getAllCharacterNames, 
  loadCharacter,
  verifyRecovery,
  saveCharacter,
  simpleHash
} from '../utils/saveSystem';
import { JOB_LIST, type JobData } from '../data/jobClasses';

interface LoginScreenProps {
  onLogin: (character: SavedCharacter, isNew: boolean) => void;
}

type LoginStep = 
| 'name' 
| 'password_new' 
| 'password_existing' 
| 'confirm_new' 
| 'recovery_setup' 
| 'job_select' 
| 'forgot_password' 
| 'reset_password';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [step, setStep] = useState<LoginStep>('name');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('가장 좋아하는 음식은?');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [error, setError] = useState('');
  const [isExisting, setIsExisting] = useState(false);
  
  const existingChars = getAllCharacterNames();

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('이름은 2글자 이상이어야 합니다.');
      return;
    }
    setError('');
    if (characterExists(trimmed)) {
      setIsExisting(true);
      setStep('password_existing');
    } else {
      setIsExisting(false);
      setStep('password_new');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExisting) {
      if (verifyPassword(name.trim(), password)) {
        const char = loadCharacter(name.trim());
        if (char) onLogin(char, false);
      } else {
        setError('❌ 비밀번호가 틀렸습니다.');
      }
    } else {
      if (password.length < 4) {
        setError('비밀번호는 4자 이상이어야 합니다.');
        return;
      }
      setStep('confirm_new');
      setError('');
    }
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('❌ 비밀번호가 일치하지 않습니다.');
      return;
    }
    setStep('recovery_setup');
    setError('');
  };

  const handleRecoverySetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryAnswer.trim()) {
      setError('복구 답변을 입력해주세요.');
      return;
    }
    setStep('job_select');
    setError('');
  };

  const handleJobSelect = (job: JobData) => {
    const char = createNewCharacter(name.trim(), password, job, recoveryQuestion, recoveryAnswer);
    onLogin(char, true);
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyRecovery(name.trim(), recoveryAnswer)) {
      setStep('reset_password');
      setError('');
    } else {
      setError('❌ 답변이 틀렸습니다.');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError('새 비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    const char = loadCharacter(name.trim());
    if (char) {
      char.passwordHash = simpleHash(password);
      saveCharacter(char);
      onLogin(char, false);
    }
  };

  const glitchParticles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 7) % 100}%`,
      top: `${(i * 23 + 11) % 100}%`,
      opacity: 0.1 + (i % 5) * 0.06,
      text: (i.toString(2).padStart(8, '0')).slice(0, 10),
    }))
  , []);

  return (
    <div className="min-h-screen bg-[#060912] flex flex-col items-center justify-center font-mono relative overflow-hidden text-gray-300">
      <div className="absolute inset-0 overflow-hidden opacity-5">
        {glitchParticles.map((p) => (
          <div key={p.id} className="absolute text-[#0ddff2]" style={{ left: p.left, top: p.top }}>{p.text}</div>
        ))}
      </div>

      <div className="text-center mb-10 z-10">
        <h1 className="text-5xl font-black tracking-tighter text-[#0ddff2] mb-1 italic"
          style={{ textShadow: '0 0 15px #0ddff2' }}>NEON REQUIEM</h1>
        <p className="text-[#ff9900] text-xs font-bold tracking-[0.5em] uppercase">2087 Seoul / Chrome Noir</p>
      </div>

      <div className="w-full max-w-md bg-[#0a0f1e]/80 border border-[#0ddff2]/20 rounded-xl p-8 backdrop-blur-md shadow-2xl z-10 transition-all">
        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-6">
            <h2 className="text-[#0ddff2] text-lg font-bold border-b border-[#0ddff2]/20 pb-2">&gt; 캐릭터 접속</h2>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-black/40 border border-[#0ddff2]/30 p-3 rounded text-[#0ddff2] outline-none focus:border-[#0ddff2]"
              placeholder="이름을 입력하세요..." />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-[#0ddff2]/10 border border-[#0ddff2]/50 p-3 rounded text-[#0ddff2] hover:bg-[#0ddff2]/20 font-bold transition-all">확인</button>
            {existingChars.length > 0 && (
              <div className="text-xs text-gray-500 mt-4">최근 접속: {existingChars.slice(0, 3).join(', ')}</div>
            )}
          </form>
        )}

        {step === 'password_existing' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <h2 className="text-[#39ff14] text-lg font-bold border-b border-[#39ff14]/20 pb-2">&gt; 보안 코드 입력: {name}</h2>
            <input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-[#39ff14]/30 p-3 rounded text-[#39ff14] outline-none focus:border-[#39ff14]"
              placeholder="패스워드..." />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-[#39ff14]/10 border border-[#39ff14]/50 p-3 rounded text-[#39ff14] hover:bg-[#39ff14]/20 font-bold transition-all">접속</button>
            <div className="flex justify-between items-center text-xs">
              <button type="button" onClick={() => setStep('name')} className="text-gray-500 hover:text-white">← 뒤로</button>
              <button type="button" onClick={() => setStep('forgot_password')} className="text-[#ff9900] hover:underline">비밀번호를 잊으셨나요?</button>
            </div>
          </form>
        )}

        {step === 'password_new' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <h2 className="text-[#ff9900] text-lg font-bold border-b border-[#ff9900]/20 pb-2">&gt; 새 러너 등록: {name}</h2>
            <p className="text-xs text-gray-500">당신의 기억 장치를 보호할 보안 코드를 설정하십시오.</p>
            <input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-[#ff9900]/30 p-3 rounded text-[#ff9900] outline-none focus:border-[#ff9900]"
              placeholder="새 비밀번호 (4자 이상)..." />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-[#ff9900]/10 border border-[#ff9900]/50 p-3 rounded text-[#ff9900] hover:bg-[#ff9900]/20 font-bold transition-all">다음 단계</button>
          </form>
        )}

        {step === 'confirm_new' && (
          <form onSubmit={handleConfirmSubmit} className="space-y-6">
            <h2 className="text-[#ff9900] text-lg font-bold border-b border-[#ff9900]/20 pb-2">&gt; 코드 재검증</h2>
            <input autoFocus type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-black/40 border border-[#ff9900]/30 p-3 rounded text-[#ff9900] outline-none focus:border-[#ff9900]"
              placeholder="다시 입력..." />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-[#ff9900]/10 border border-[#ff9900]/50 p-3 rounded text-[#ff9900] hover:bg-[#ff9900]/20 font-bold transition-all">확인</button>
          </form>
        )}

        {step === 'recovery_setup' && (
          <form onSubmit={handleRecoverySetupSubmit} className="space-y-6">
            <h2 className="text-[#0ddff2] text-lg font-bold border-b border-[#0ddff2]/20 pb-2">&gt; 복구 질문 설정</h2>
            <p className="text-xs text-gray-500">비밀번호를 잊었을 때를 대비한 질문입니다.</p>
            <input value={recoveryQuestion} onChange={e => setRecoveryQuestion(e.target.value)}
              className="w-full bg-black/40 border border-[#0ddff2]/30 p-3 rounded text-[#0ddff2] outline-none focus:border-[#0ddff2]"
              placeholder="질문 (예: 가장 친한 친구 이름은?)" />
            <input value={recoveryAnswer} onChange={e => setRecoveryAnswer(e.target.value)}
              className="w-full bg-black/40 border border-[#0ddff2]/30 p-3 rounded text-white outline-none focus:border-[#0ddff2]"
              placeholder="답변..." />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-[#0ddff2]/10 border border-[#0ddff2]/50 p-3 rounded text-[#0ddff2] hover:bg-[#0ddff2]/20 font-bold transition-all">저장 및 다음</button>
          </form>
        )}

        {step === 'job_select' && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-white text-xl font-black italic tracking-widest text-center">&gt; 직업 선택 (SELECT CLASS)</h2>
            <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {JOB_LIST.map(job => (
                <button key={job.id} onClick={() => handleJobSelect(job)}
                  className="group relative bg-[#0d1428] border border-gray-800 p-4 rounded-lg text-left hover:border-[#0ddff2] transition-all hover:scale-[1.02]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-lg font-bold text-white group-hover:text-[#0ddff2]">{job.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono uppercase bg-black px-2 py-0.5 rounded">{job.baseWeaponAttr} / {job.baseArmorAttr}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{job.description}</p>
                  <div className="flex gap-4 text-[10px] font-mono">
                    <span className="text-red-400">HP {job.baseHp}</span>
                    <span className="text-blue-400">MP {job.baseMp}</span>
                    <span className="text-orange-400">ATK {job.baseAtk}</span>
                    <span className="text-green-400">DEF {job.baseDef}</span>
                    <span className="text-[#bb88ff]">STR {job.baseStr}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'forgot_password' && (
          <form onSubmit={handleRecoverySubmit} className="space-y-6">
            <h2 className="text-[#ff9900] text-lg font-bold border-b border-[#ff9900]/20 pb-2">&gt; 비밀번호 복구</h2>
            <p className="text-xs text-white mb-2">질문: {loadCharacter(name)?.recoveryQuestion}</p>
            <input autoFocus value={recoveryAnswer} onChange={e => setRecoveryAnswer(e.target.value)}
              className="w-full bg-black/40 border border-[#ff9900]/30 p-3 rounded text-white outline-none focus:border-[#ff9900]"
              placeholder="답변을 입력하세요..." />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-[#ff9900]/10 border border-[#ff9900]/50 p-3 rounded text-[#ff9900] hover:bg-[#ff9900]/20 font-bold transition-all">확인</button>
            <button type="button" onClick={() => setStep('password_existing')} className="w-full text-xs text-gray-500 hover:text-white">← 뒤로</button>
          </form>
        )}

        {step === 'reset_password' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <h2 className="text-[#39ff14] text-lg font-bold border-b border-[#39ff14]/20 pb-2">&gt; 새 비밀번호 설정</h2>
            <input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-[#39ff14]/30 p-3 rounded text-[#39ff14] outline-none focus:border-[#39ff14]"
              placeholder="새 비밀번호..." />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button className="w-full bg-[#39ff14]/10 border border-[#39ff14]/50 p-3 rounded text-[#39ff14] hover:bg-[#39ff14]/20 font-bold transition-all">변경 및 접속</button>
          </form>
        )}
      </div>
      
      <div className="mt-10 text-[10px] text-gray-600 flex gap-10">
        <span>© 2087 ARCADIA CORP.</span>
        <span>ALL RIGHTS RESERVED.</span>
      </div>
    </div>
  );
};

export default LoginScreen;
