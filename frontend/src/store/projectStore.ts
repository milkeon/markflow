// frontend/src/store/projectStore.ts
import { create } from 'zustand';
import { useAuthStore } from './authStore.js';

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  role: 'owner' | 'member';
  deletedAt?: string | null;
}

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ProjectState {
  projects: Project[];
  trashProjects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  toast: Toast | null;

  // Toast 노출
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // 프로젝트 목록 가져오기
  fetchProjects: () => Promise<void>;
  // 새 프로젝트 생성
  createProject: (name: string) => Promise<boolean>;
  // 이름 변경
  renameProject: (projectId: string, newName: string) => Promise<boolean>;
  // 프로젝트 소프트 삭제 (휴지통행)
  deleteProject: (projectId: string) => Promise<boolean>;
  // 멤버 초대
  inviteMember: (projectId: string, email: string) => Promise<boolean>;
  // 휴지통 목록 조회
  fetchTrashProjects: () => Promise<void>;
  // 프로젝트 복구
  restoreProject: (projectId: string) => Promise<boolean>;
  // 현재 프로젝트 선택
  selectProject: (project: Project | null) => void;
}

const API_URL = 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  trashProjects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  toast: null,

  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    // 3초 후 자동 소멸
    setTimeout(() => {
      get().clearToast();
    }, 3000);
  },

  clearToast: () => set({ toast: null }),

  selectProject: (project) => set({ currentProject: project }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로젝트 목록을 가져오지 못했습니다.');
      set({ projects: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createProject: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로젝트 생성에 실패했습니다.');
      
      await get().fetchProjects();
      get().showToast('새 프로젝트가 성공적으로 생성되었습니다.', 'success');
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      get().showToast(err.message, 'error');
      return false;
    }
  },

  renameProject: async (projectId, newName) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({ name: newName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로젝트 이름 변경에 실패했습니다.');

      await get().fetchProjects();
      // 현재 선택된 프로젝트 갱신
      const current = get().currentProject;
      if (current && current.id === projectId) {
        set({ currentProject: { ...current, name: newName } });
      }
      get().showToast('프로젝트 이름이 변경되었습니다.', 'success');
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      get().showToast(err.message, 'error');
      return false;
    }
  },

  deleteProject: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로젝트 삭제에 실패했습니다.');

      await get().fetchProjects();
      const current = get().currentProject;
      if (current && current.id === projectId) {
        set({ currentProject: null });
      }
      get().showToast('프로젝트를 휴지통으로 이동했습니다.', 'success');
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      get().showToast(err.message, 'error');
      return false;
    }
  },

  inviteMember: async (projectId, email) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/invite`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '멤버 초대에 실패했습니다.');

      get().showToast(data.message || '멤버를 초대했습니다.', 'success');
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      get().showToast(err.message, 'error');
      return false;
    }
  },

  fetchTrashProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects/trash`, {
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '휴지통 조회를 실패했습니다.');
      set({ trashProjects: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  restoreProject: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/restore`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로젝트 복구에 실패했습니다.');

      await get().fetchTrashProjects();
      await get().fetchProjects();
      get().showToast('프로젝트가 정상적으로 복구되었습니다.', 'success');
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      get().showToast(err.message, 'error');
      return false;
    }
  }
}));
