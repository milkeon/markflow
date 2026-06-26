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
  invitedMembers?: string[];
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

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const LOCAL_PROJECTS_KEY = 'markflow.localProjects';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getLocalProjects = (): Project[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || '[]') as Project[];
  } catch {
    return [];
  }
};

const setLocalProjects = (projects: Project[]) => {
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
};

const upsertLocalProject = (project: Project) => {
  const projects = getLocalProjects();
  const exists = projects.some((item) => item.id === project.id);
  const updated = exists
    ? projects.map((item) => (item.id === project.id ? { ...item, ...project } : item))
    : [...projects, project];
  setLocalProjects(updated);
  return updated;
};

const updateLocalProject = (projectId: string, updater: (project: Project) => Project) => {
  const updated = getLocalProjects().map((project) => (project.id === projectId ? updater(project) : project));
  setLocalProjects(updated);
  return updated;
};

const getCurrentUser = () => useAuthStore.getState().user;
const getCurrentUserId = () => getCurrentUser()?.id || 'local-user';

const isVisibleToCurrentUser = (project: Project) => {
  const user = getCurrentUser();
  if (!user) return false;
  const currentEmail = normalizeEmail(user.email);
  if (project.ownerId === user.id) return true;
  return Boolean(currentEmail && project.invitedMembers?.some((email) => normalizeEmail(email) === currentEmail));
};

const toVisibleProject = (project: Project): Project => {
  const user = getCurrentUser();
  const role: Project['role'] = user && project.ownerId === user.id ? 'owner' : 'member';
  return { ...project, role };
};

const mergeVisibleProjects = (remoteProjects: Project[]) => {
  const localProjects = getLocalProjects();
  const localById = new Map(localProjects.map((project) => [project.id, project]));
  const merged = remoteProjects.map((project) => {
    const local = localById.get(project.id);
    if (!local) return project;

    return {
      ...project,
      deletedAt: project.deletedAt ?? local.deletedAt ?? null,
      invitedMembers: Array.from(new Set([...(project.invitedMembers || []).map(normalizeEmail), ...(local.invitedMembers || []).map(normalizeEmail)]))
    };
  });

  const remoteIds = new Set(remoteProjects.map((project) => project.id));
  const localOnly = localProjects.filter((project) => !remoteIds.has(project.id));

  return [...merged, ...localOnly]
    .filter((project) => !project.deletedAt && isVisibleToCurrentUser(project))
    .map(toVisibleProject);
};

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

  selectProject: (project) => {
    // 새로고침 후 복원을 위해 localStorage에 현재 프로젝트 ID 기록
    if (project) {
      localStorage.setItem('lastProjectId', project.id);
    } else {
      localStorage.removeItem('lastProjectId');
    }
    set({ currentProject: project });
  },

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '프로젝트 목록을 가져오지 못했습니다.');
      set({ projects: mergeVisibleProjects(data), isLoading: false, error: null });
    } catch (err: any) {
      const localProjects = getLocalProjects()
        .filter((project) => !project.deletedAt && isVisibleToCurrentUser(project))
        .map(toVisibleProject);
      set({ projects: localProjects, isLoading: false, error: null });
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
      
      const createdAt = data.project?.createdAt || new Date().toISOString();
      upsertLocalProject({
        id: data.project?.id || crypto.randomUUID(),
        name,
        ownerId: getCurrentUserId(),
        createdAt,
        role: 'owner',
        deletedAt: null,
        invitedMembers: []
      });
      await get().fetchProjects();
      get().showToast('새 프로젝트가 성공적으로 생성되었습니다.', 'success');
      return true;
    } catch (err: any) {
      const newProject: Project = {
        id: crypto.randomUUID(),
        name,
        ownerId: getCurrentUserId(),
        createdAt: new Date().toISOString(),
        role: 'owner',
        deletedAt: null
      };
      const localProjects = upsertLocalProject(newProject);
      set({
        projects: localProjects
          .filter((project) => !project.deletedAt && isVisibleToCurrentUser(project))
          .map(toVisibleProject),
        isLoading: false,
        error: null
      });
      get().showToast('로컬 테스트 프로젝트가 생성되었습니다.', 'success');
      return true;
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

      updateLocalProject(projectId, (project) => ({ ...project, name: newName }));
      await get().fetchProjects();
      const current = get().currentProject;
      if (current && current.id === projectId) {
        set({ currentProject: { ...current, name: newName } });
      }
      get().showToast('프로젝트 이름이 변경되었습니다.', 'success');
      return true;
    } catch (err: any) {
      const updatedProjects = updateLocalProject(projectId, (project) => ({ ...project, name: newName }));
      const current = get().currentProject;
      if (current && current.id === projectId) {
        set({ currentProject: { ...current, name: newName } });
      }
      set({
        projects: updatedProjects
          .filter((project) => !project.deletedAt && isVisibleToCurrentUser(project))
          .map(toVisibleProject),
        isLoading: false,
        error: null
      });
      get().showToast('로컬 프로젝트 이름을 변경했습니다.', 'success');
      return true;
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

      updateLocalProject(projectId, (project) => ({ ...project, deletedAt: new Date().toISOString() }));
      await get().fetchProjects();
      const current = get().currentProject;
      if (current && current.id === projectId) {
        set({ currentProject: null });
      }
      get().showToast('프로젝트를 휴지통으로 이동했습니다.', 'success');
      return true;
    } catch (err: any) {
      const deletedAt = new Date().toISOString();
      const updatedProjects = updateLocalProject(projectId, (project) => ({ ...project, deletedAt }));
      const current = get().currentProject;
      if (current && current.id === projectId) {
        set({ currentProject: null });
      }
      set({
        projects: updatedProjects
          .filter((project) => !project.deletedAt && isVisibleToCurrentUser(project))
          .map(toVisibleProject),
        trashProjects: updatedProjects
          .filter((project) => !!project.deletedAt && project.ownerId === getCurrentUserId())
          .map(toVisibleProject),
        isLoading: false,
        error: null
      });
      get().showToast('로컬 프로젝트를 휴지통으로 이동했습니다.', 'success');
      return true;
    }
  },

  inviteMember: async (projectId, email) => {
    const normalizedEmail = normalizeEmail(email);
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/invite`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ email: normalizedEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '멤버 초대에 실패했습니다.');

      updateLocalProject(projectId, (project) => ({
        ...project,
        invitedMembers: Array.from(new Set([...(project.invitedMembers || []).map(normalizeEmail), normalizedEmail]))
      }));
      await get().fetchProjects();
      get().showToast(data.message || '멤버를 초대했습니다.', 'success');
      return true;
    } catch (err: any) {
      const updatedProjects = updateLocalProject(projectId, (project) => ({
        ...project,
        invitedMembers: Array.from(new Set([...(project.invitedMembers || []).map(normalizeEmail), normalizedEmail]))
      }));
      set({
        projects: updatedProjects
          .filter((project) => !project.deletedAt && isVisibleToCurrentUser(project))
          .map(toVisibleProject),
        isLoading: false,
        error: null
      });
      get().showToast('로컬 프로젝트에 멤버 초대를 기록했습니다.', 'success');
      return true;
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
      const localTrash = getLocalProjects()
        .filter((project) => !!project.deletedAt && project.ownerId === getCurrentUserId())
        .map(toVisibleProject);
      set({ trashProjects: localTrash, isLoading: false, error: null });
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

      updateLocalProject(projectId, (project) => ({ ...project, deletedAt: null }));
      await get().fetchTrashProjects();
      await get().fetchProjects();
      get().showToast('프로젝트가 정상적으로 복구되었습니다.', 'success');
      return true;
    } catch (err: any) {
      const updatedProjects = updateLocalProject(projectId, (project) => ({ ...project, deletedAt: null }));
      set({
        projects: updatedProjects
          .filter((project) => !project.deletedAt && isVisibleToCurrentUser(project))
          .map(toVisibleProject),
        trashProjects: updatedProjects
          .filter((project) => !!project.deletedAt && project.ownerId === getCurrentUserId())
          .map(toVisibleProject),
        isLoading: false,
        error: null
      });
      get().showToast('로컬 프로젝트를 복구했습니다.', 'success');
      return true;
    }
  }
}));
