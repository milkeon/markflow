// frontend/src/components/Login.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useProjectStore } from '../store/projectStore.js';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';

interface LoginProps {
  onBackToHome: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBackToHome }) => {
  const { login, register, error, clearError } = useAuthStore();
  const { showToast } = useProjectStore();
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const emailInputRef = useRef<HTMLInputElement>(null);

  // 기본 커서 설정
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
    clearError();
  }, [isRegisterMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('이메일과 비밀번호를 모두 입력해주세요.', 'error');
      return;
    }

    if (isRegisterMode) {
      const res = await register(email, password);
      if (res.success) {
        showToast(res.message, 'success');
        setIsRegisterMode(false);
        setPassword('');
      } else {
        showToast(res.message, 'error');
      }
    } else {
      const success = await login(email, password);
      if (success) {
        showToast('반갑습니다! 로그인에 성공했습니다.', 'success');
      } else {
        showToast(error || '로그인 정보를 다시 확인해주세요.', 'error');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent relative overflow-hidden">
      {/* 백그라운드 데코레이션 그라데이션 버블 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-2xl border border-dark-300 bg-white/80 backdrop-blur-xl shadow-2xl relative z-level2 text-dark-800">
        
        {/* 로고 (누르면 리프레시 혹은 초기 로그인화면으로) */}
        <div className="flex flex-col items-center mb-8">
          <div 
            onClick={() => {
              setIsRegisterMode(false);
              setEmail('');
              setPassword('');
              onBackToHome();
            }}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              M
            </div>
            <span className="font-extrabold text-2xl bg-gradient-to-r from-white via-dark-100 to-dark-400 bg-clip-text text-transparent">
              MarkFlow
            </span>
          </div>
          <p className="text-sm text-dark-400 mt-2 font-medium">
            {isRegisterMode ? '실시간 협업을 위한 계정 생성' : '마크다운 협업 캔버스 로그인'}
          </p>
        </div>

        {/* 로그인/회원가입 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs text-dark-300 font-semibold uppercase tracking-wider">이메일 주소</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-dark-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                ref={emailInputRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@markflow.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-dark-300 font-semibold uppercase tracking-wider">비밀번호</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-dark-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* 에러 피드백 */}
          {error && (
            <div className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 p-3 rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* 제출 버튼 (엔터와 연동됨) */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold hover:from-brand-500 hover:to-indigo-500 shadow-lg shadow-brand-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isRegisterMode ? (
              <>
                <UserPlus className="w-5 h-5" />
                <span>계정 등록 완료</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>로그인</span>
              </>
            )}
          </button>
        </form>

        {/* 모드 전환 링크 */}
        <div className="text-center mt-6">
          <button
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            className="text-sm text-brand-400 hover:text-brand-300 font-semibold transition-colors focus:outline-none"
          >
            {isRegisterMode ? '이미 계정이 있으신가요? 로그인하기' : '아직 계정이 없으신가요? 회원가입하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
