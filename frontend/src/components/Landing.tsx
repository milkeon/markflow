// frontend/src/components/Landing.tsx
import React from 'react';
import heroImg from '../assets/hero.png';
import { ArrowRight, BookOpen, GitFork, Users } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#172b4d] flex flex-col relative overflow-x-hidden">

      {/* 랜딩 헤더 */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-level2 shadow-sm">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-8 h-8 rounded-lg bg-[#00875a] flex items-center justify-center font-bold text-white shadow-md">
            이음
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#172b4d]">
            이음
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onStart}
            className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors text-gray-600"
          >
            로그인
          </button>
          <button
            onClick={onStart}
            className="px-4 py-2 rounded-xl bg-[#172b4d] hover:bg-[#091e42] text-white text-sm font-semibold transition-colors shadow-sm"
          >
            시작하기
          </button>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 pt-16 pb-12 flex flex-col items-center text-center gap-8 relative z-level2">
        <div className="space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-semibold shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-[#00875a] animate-pulse" />
            <span>마크다운 · 노드 캔버스 · AI 채팅</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight text-gray-900">
            마크다운으로 그리는<br />
            <span className="bg-gradient-to-r from-[#00875a] to-[#5bb974] bg-clip-text text-transparent">생각의 흐름</span>
          </h1>

          <p className="text-gray-500 font-medium text-base md:text-md leading-relaxed max-w-xl mx-auto">
            노드를 잇고, 마크다운으로 적고, AI와 대화하며 정리하세요. <strong>이음</strong>은 흩어진 메모를 하나의 캔버스 위 흐름으로 엮어주는 워크스페이스입니다.
          </p>

          <div className="pt-2 flex items-center justify-center gap-4">
            <button
              onClick={onStart}
              className="px-6 py-3.5 rounded-xl bg-[#172b4d] text-white font-bold hover:bg-[#091e42] active:scale-[0.98] transition-all flex items-center gap-2 shadow-md"
            >
              <span>무료로 시작하기</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onStart}
              className="px-6 py-3.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm"
            >
              <span>캔버스 둘러보기</span>
            </button>
          </div>
        </div>

        {/* 히어로 이미지 */}
        <div className="w-full max-w-3xl relative mt-4 shadow-2xl rounded-2xl overflow-hidden border border-gray-200 bg-white p-2">
          <img
            src={heroImg}
            alt="이음 Infinite Canvas Preview"
            className="w-full h-auto rounded-xl border border-gray-100"
          />
        </div>
      </main>

      {/* 특장점 섹션 */}
      <section className="bg-white border-t border-gray-200 py-16 relative z-level2">
        <div className="max-w-5xl w-full mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">

          <div className="p-6 rounded-2xl border border-gray-100 bg-[#f4f5f7]/50 space-y-4 text-left shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-[#00875a]" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">무한 노드 캔버스</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">
              드래그로 노드를 잇고 흐름을 만드세요. 아이디어·문서를 컬러칩·데이터 타입에 따라 색상으로 구분합니다.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-gray-100 bg-[#f4f5f7]/50 space-y-4 text-left shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <GitFork className="w-5 h-5 text-[#00875a]" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">마크다운 노드</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">
              모든 노드는 마크다운 문서입니다. 더블클릭해 에디터를 열고 실시간 미리보기로 편집하세요.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-gray-100 bg-[#f4f5f7]/50 space-y-4 text-left shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5 text-[#00875a]" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">AI 채팅 & 히스토리</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">
              캔버스로 이해하는 AI와 대화하며 정리하고, 모든 변경은 히스토리에 남아 되돌릴 수 있습니다.
            </p>
          </div>

        </div>
      </section>

      {/* 공용 푸터 */}
      <footer className="border-t border-gray-200 bg-white py-8 relative z-level2 px-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-400 font-semibold gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#00875a] flex items-center justify-center font-bold text-white text-[10px]">
            이음
          </div>
          <span className="font-bold text-gray-600">이음</span>
        </div>
        <p>© 2025 이음 · mingyu Lim</p>
      </footer>
    </div>
  );
};
