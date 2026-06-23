// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore.js';
import { useProjectStore } from './store/projectStore.js';
import { useCanvasStore } from './store/canvasStore.js';
import { Login } from './components/Login.js';
import { Landing } from './components/Landing.js';
import { Dashboard } from './components/Dashboard.js';
import { CanvasWorkspace } from './components/CanvasWorkspace.js';
import { Toast } from './components/Toast.js';

function App() {
  const { isAuthenticated, checkAuth, isLoading } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { clearCanvas } = useCanvasStore();
  const [showLogin, setShowLogin] = useState(false);

  // 최초 로드 시 로그인 세션 확인
  useEffect(() => {
    checkAuth();
  }, []);

  // 프로젝트 전환/이탈 시 캔버스 스토어 정리
  useEffect(() => {
    if (!currentProject) {
      clearCanvas();
    }
  }, [currentProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-dark-300">사용자 인증 확인 중...</span>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우 화면 분기 (랜딩 페이지 또는 로그인 페이지)
  if (!isAuthenticated) {
    if (showLogin) {
      return (
        <>
          <Login onBackToHome={() => setShowLogin(false)} />
          <Toast />
        </>
      );
    }
    return (
      <>
        <Landing onStart={() => setShowLogin(true)} />
        <Toast />
      </>
    );
  }

  // 로그인 상태에서 프로젝트가 선택되었을 때 캔버스 구동
  if (currentProject) {
    return (
      <div className="min-h-screen bg-transparent text-dark-800 flex flex-col w-full h-screen">
        <CanvasWorkspace />
        <Toast />
      </div>
    );
  }

  // 로그인 상태이며 프로젝트가 선택되지 않은 경우 대시보드 화면
  return (
    <>
      <Dashboard />
      <Toast />
    </>
  );
}

export default App;
