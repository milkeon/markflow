// frontend/src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from './store/authStore.js';
import { useProjectStore } from './store/projectStore.js';
import { useCanvasStore } from './store/canvasStore.js';
import { Login } from './components/Login.js';
import { Landing } from './components/Landing.js';
import { Dashboard } from './components/Dashboard.js';
import { CanvasWorkspace } from './components/CanvasWorkspace.js';
import { Toast } from './components/Toast.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

function App() {
  const { isAuthenticated, checkAuth, isLoading, user, token } = useAuthStore();
  const { currentProject, fetchProjects, selectProject } = useProjectStore();
  const { clearCanvas } = useCanvasStore();
  const [showLogin, setShowLogin] = useState(false);
  const projectsSocketRef = useRef<Socket | null>(null);

  // 최초 로드 시 로그인 세션 확인 및 마지막 프로젝트 복원
  useEffect(() => {
    const restore = async () => {
      await checkAuth();
      const { isAuthenticated: authed } = useAuthStore.getState();
      if (!authed) return;

      // 프로젝트 목록 로드 후 마지막 프로젝트 복원
      await fetchProjects();
      const lastId = localStorage.getItem('lastProjectId');
      if (lastId) {
        const { projects } = useProjectStore.getState();
        const found = projects.find(p => p.id === lastId && !p.deletedAt);
        if (found) {
          selectProject(found);
        }
      }
    };
    restore();
  }, []);

  // 프로젝트 변경은 실시간으로 다시 불러와서 초대/이름변경/삭제가 즉시 보이도록 동기화
  useEffect(() => {
    if (!isAuthenticated || !user || !token) {
      projectsSocketRef.current?.disconnect();
      projectsSocketRef.current = null;
      return;
    }

    const socket = io(SOCKET_URL, { transports: ['websocket'], forceNew: true });
    projectsSocketRef.current = socket;

    const syncProjects = async ({ actorEmail }: { actorEmail?: string } = {}) => {
      if (actorEmail && actorEmail.trim().toLowerCase() === user.email.trim().toLowerCase()) {
        return;
      }

      await Promise.all([
        useProjectStore.getState().fetchProjects(),
        useProjectStore.getState().fetchTrashProjects(),
      ]);
    };

    socket.on('projects-updated', syncProjects);

    return () => {
      socket.off('projects-updated', syncProjects);
      socket.disconnect();
      projectsSocketRef.current = null;
    };
  }, [isAuthenticated, user, token]);

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
      <div className="min-h-screen bg-dark-900 text-white flex flex-col w-full h-screen">
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
