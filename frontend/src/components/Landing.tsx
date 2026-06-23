// frontend/src/components/Landing.tsx
import React from 'react';
import heroImg from '../assets/hero.png';
import { ArrowRight, BookOpen, GitFork, Users } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col relative overflow-x-hidden">
      {/* 백그라운드 그라데이션 광원 */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[180px] pointer-events-none" />

      {/* 랜딩 헤더 */}
      <header className="border-b border-dark-700/60 bg-dark-800/20 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-level2">
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md">
            M
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-dark-100 to-dark-400 bg-clip-text text-transparent">
            MarkFlow
          </span>
        </div>

        <button 
          onClick={onStart}
          className="px-5 py-2 rounded-xl bg-dark-800 border border-dark-700 hover:bg-dark-700 font-bold text-sm transition-colors"
        >
          로그인 / 시작하기
        </button>
      </header>

      {/* 히어로 섹션 */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-16 flex flex-col lg:flex-row items-center gap-12 relative z-level2">
        <div className="flex-1 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-950/60 border border-brand-500/30 text-brand-300 text-xs font-bold">
            ⚡ 실시간 협업 마크다운 화이트보드
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight bg-gradient-to-r from-white via-dark-100 to-dark-300 bg-clip-text text-transparent">
            흩어진 아이디어를,<br />
            <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">흐름</span>으로.
          </h1>
          <p className="text-dark-300 font-medium text-base md:text-lg leading-relaxed max-w-lg">
            MarkFlow는 마크다운 노드를 무한 캔버스 위에 자유롭게 펼치고 연결해, 팀이 실시간으로 함께 생각을 정리하는 협업 도구입니다. 스티키 메모보다 깊게, 문서보다 가볍게 — 접으면 요약, 펼치면 상세인 .md 노드로 아이디어의 밀도와 흐름을 동시에 잡으세요.
          </p>
          <div className="pt-2">
            <button
              onClick={onStart}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold hover:from-brand-500 hover:to-indigo-500 shadow-xl shadow-brand-600/25 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span>MarkFlow 무료로 시작하기</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 히어로 이미지 */}
        <div className="flex-1 w-full max-w-xl relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 to-indigo-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 pointer-events-none" />
          <img 
            src={heroImg} 
            alt="MarkFlow Infinite Canvas Preview" 
            className="w-full h-auto rounded-2xl border border-dark-700 shadow-2xl relative z-level2 transition-transform duration-500 group-hover:scale-[1.01]" 
          />
        </div>
      </main>

      {/* 특장점 섹션 */}
      <section className="bg-dark-800/30 border-t border-dark-700/50 py-16 relative z-level2">
        <div className="max-w-6xl w-full mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-6 rounded-2xl border border-dark-700/60 bg-dark-800/40 space-y-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-brand-950/60 border border-brand-500/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="font-bold text-lg text-white">마크다운 노드</h3>
            <p className="text-sm text-dark-400 leading-relaxed font-medium">
              노드는 마크다운(.md) 문서로 작성됩니다. 접으면 제목과 1줄 요약으로 복잡성을 줄이고, 펼치면 코드 블록, 표, 목록이 담긴 풍부한 문서를 열람할 수 있습니다.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-dark-700/60 bg-dark-800/40 space-y-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center">
              <GitFork className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="font-bold text-lg text-white">흐름 연결</h3>
            <p className="text-sm text-dark-400 leading-relaxed font-medium">
              각 노드들을 화살표 선(Edge)으로 연결해 유저 플로우, 기능 흐름도, 브레인스토밍 맵을 손쉽게 만드세요. 연결선들이 모여 하나의 직관적인 플로우차트가 됩니다.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-dark-700/60 bg-dark-800/40 space-y-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-pink-950/60 border border-pink-500/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="font-bold text-lg text-white">실시간 협업</h3>
            <p className="text-sm text-dark-400 leading-relaxed font-medium">
              같은 프로젝트 캔버스에서 동료들의 마우스 커서 위치를 실시간으로 확인하고 소통해 보세요. 노드별 동시 편집 충돌을 막아주는 소프트 락과 실시간 대화가 기본 지원됩니다.
            </p>
          </div>

        </div>
      </section>

      {/* 공용 푸터 */}
      <footer className="border-t border-dark-700/60 bg-dark-900 py-8 relative z-level2 text-center text-xs text-dark-500 font-semibold space-y-2">
        <p>스티키 메모보다 깊게, 문서보다 가볍게 — MarkFlow</p>
        <p>© 2026 MarkFlow. All rights reserved.</p>
      </footer>
    </div>
  );
};
