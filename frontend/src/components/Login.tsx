// frontend/src/components/Login.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useProjectStore } from '../store/projectStore.js';
import { Mail, Lock, LogIn, UserPlus, User } from 'lucide-react';

interface LoginProps {
  onBackToHome: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBackToHome }) => {
  const { login, register, error, clearError } = useAuthStore();
  const { showToast } = useProjectStore();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  
  const emailInputRef = useRef<HTMLInputElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  // 기본 커서 설정
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
    clearError();
  }, [isRegisterMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegisterMode && !nickname)) {
      showToast('모든 필수 입력값을 채워주세요.', 'error');
      return;
    }

    if (isRegisterMode) {
      const res = await register(email, password, nickname);
      if (res.success) {
        showToast(res.message, 'success');
        setIsRegisterMode(false);
        setPassword('');
        setNickname('');
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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f5f7] relative overflow-hidden">
      <div className="w-full max-w-md p-8 rounded-2xl border border-gray-200 bg-white shadow-2xl relative z-level2">

        {/* 로고 (누르면 리프레시 혹은 초기 로그인화면으로) */}
        <div className="flex flex-col items-center mb-8">
          <div
            onClick={() => {
              setIsRegisterMode(false);
              setEmail('');
              setPassword('');
              onBackToHome();
            }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#00875a] flex items-center justify-center font-bold text-lg text-white shadow-lg group-hover:scale-105 transition-transform">
              이음
            </div>
            <span className="font-extrabold text-2xl text-gray-900">
              이음
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            {isRegisterMode ? '실시간 협업을 위한 계정 생성' : '마크다운 협업 캔버스 로그인'}
          </p>
        </div>

        {/* 로그인/회원가입 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">이메일 주소</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                ref={emailInputRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@e-im.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00875a] focus:ring-2 focus:ring-[#00875a]/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">비밀번호</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00875a] focus:ring-2 focus:ring-[#00875a]/10 transition-all font-medium"
              />
            </div>
          </div>

          {isRegisterMode && (
            <div className="space-y-1">
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">닉네임</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <User className="w-5 h-5" />
                </span>
                <input
                  ref={nicknameInputRef}
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="홍길동"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00875a] focus:ring-2 focus:ring-[#00875a]/10 transition-all font-medium"
                />
              </div>
            </div>
          )}

          {/* 에러 피드백 */}
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* 제출 버튼 (엔터와 연동됨) */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-[#172b4d] hover:bg-[#091e42] text-white font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md"
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
            className="text-sm text-[#00875a] hover:text-[#006644] font-semibold transition-colors focus:outline-none"
          >
            {isRegisterMode ? '이미 계정이 있으신가요? 로그인하기' : '아직 계정이 없으신가요? 회원가입하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
