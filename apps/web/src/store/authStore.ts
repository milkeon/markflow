// frontend/src/store/authStore.ts
import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  nickname: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 로그인
  login: (email: string, password: string) => Promise<boolean>;
  // 회원가입
  register: (email: string, password: string, nickname: string) => Promise<{ success: boolean; message: string }>;
  // 로그아웃
  logout: () => void;
  // 세션 복구
  checkAuth: () => Promise<void>;
  // 프로필 수정
  updateProfile: (nickname: string) => Promise<boolean>;
  // 에러 초기화
  clearError: () => void;
}

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const LOCAL_USERS_KEY = 'markflow.localUsers';
const LOCAL_TOKEN_PREFIX = 'local-token:';
const LOCAL_PROJECTS_KEY = 'markflow.localProjects';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

interface LocalUser extends User {
  password: string;
}

const getLocalUsers = (): LocalUser[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]') as LocalUser[];
  } catch {
    return [];
  }
};

const setLocalUsers = (users: LocalUser[]) => {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
};

const createLocalSession = (user: User) => {
  const token = `${LOCAL_TOKEN_PREFIX}${user.id}`;
  localStorage.setItem('token', token);
  return token;
};

const toApiUser = (user: { id: string; email: string; nickname?: string; name?: string }): User => ({
  id: user.id,
  email: normalizeEmail(user.email),
  nickname: user.nickname || user.name || normalizeEmail(user.email).split('@')[0] || '사용자'
});

const tryMigrateLocalUser = async (localUser: LocalUser) => {
  try {
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: localUser.email,
        password: localUser.password,
        nickname: localUser.nickname
      })
    });
    const registerData = await registerRes.json();

    if (registerRes.ok) {
      const apiUser = toApiUser(registerData.user || { id: registerData.id || crypto.randomUUID(), email: localUser.email, nickname: localUser.nickname });
      return { token: registerData.token || registerData.accessToken, user: apiUser };
    }

    if (registerRes.status === 409) {
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: localUser.email,
          password: localUser.password
        })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        const apiUser = toApiUser(loginData.user || { id: loginData.id || crypto.randomUUID(), email: localUser.email, nickname: localUser.nickname });
        return { token: loginData.token || loginData.accessToken, user: apiUser };
      }
    }
  } catch {
    // 서버 마이그레이션 실패 시 로컬 세션으로 계속 진행
  }

  return null;
};

const migrateLocalProjectsOwner = (fromUserId: string, toUserId: string) => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return;
    const projects = JSON.parse(raw) as Array<{ ownerId?: string; invitedMembers?: string[] }>;
    const migrated = projects.map((project) => {
      if (project.ownerId !== fromUserId) return project;
      return {
        ...project,
        ownerId: toUserId,
        invitedMembers: Array.isArray(project.invitedMembers)
          ? project.invitedMembers.map((email) => normalizeEmail(email))
          : project.invitedMembers
      };
    });
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(migrated));
  } catch {
    // 프로젝트 마이그레이션 실패는 로그인 자체를 막지 않음
  }
};

const migrateLocalProjectsByEmail = (email: string, toUserId: string) => {
  const normalized = normalizeEmail(email);
  const users = getLocalUsers().filter((user) => normalizeEmail(user.email) === normalized);
  users.forEach((user) => migrateLocalProjectsOwner(user.id, toUserId));
};

const findLocalUserByToken = (token: string | null): LocalUser | null => {
  if (!token?.startsWith(LOCAL_TOKEN_PREFIX)) return null;
  const id = token.replace(LOCAL_TOKEN_PREFIX, '');
  return getLocalUsers().find((user) => user.id === id) || null;
};

const toPublicUser = ({ password: _password, ...user }: LocalUser): User => ({
  ...user,
  email: normalizeEmail(user.email)
});

export const useAuthStore = create<AuthState>((set) => ({
  user: findLocalUserByToken(localStorage.getItem('token')),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    const normalizedEmail = normalizeEmail(email);
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '로그인에 실패했습니다.');
      }

      localStorage.setItem('token', data.token);
      set({
        token: data.token,
        user: data.user ? { ...data.user, email: normalizeEmail(data.user.email) } : data.user,
        isAuthenticated: true,
        isLoading: false
      });
      return true;
    } catch (err: any) {
      const localUser = getLocalUsers().find((user) => normalizeEmail(user.email) === normalizedEmail && user.password === password);
      if (localUser) {
        const migrated = await tryMigrateLocalUser(localUser);
        if (migrated?.token) {
          migrateLocalProjectsByEmail(localUser.email, migrated.user.id);
          localStorage.setItem('token', migrated.token);
          set({ token: migrated.token, user: migrated.user, isAuthenticated: true, isLoading: false, error: null });
          return true;
        }

        const publicUser = toPublicUser(localUser);
        const token = createLocalSession(publicUser);
        set({ token, user: publicUser, isAuthenticated: true, isLoading: false, error: null });
        return true;
      }

      const message = err?.message === 'Failed to fetch'
        ? '로컬 테스트 계정을 찾지 못했습니다. 먼저 회원가입을 완료해주세요.'
        : err.message;
      set({ error: message, isLoading: false });
      return false;
    }
  },

  register: async (email, password, nickname) => {
    const normalizedEmail = normalizeEmail(email);
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '회원가입에 실패했습니다.');
      }

      const user = data.user || { id: data.id || crypto.randomUUID(), email: normalizedEmail, nickname };
      const token = data.token || createLocalSession(user);
      localStorage.setItem('token', token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      return { success: true, message: data.message || '회원가입이 완료되었습니다.' };
    } catch (err: any) {
      const users = getLocalUsers();
      if (users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
        const message = '이미 가입된 이메일입니다. 로그인해주세요.';
        set({ error: message, isLoading: false });
        return { success: false, message };
      }

      const localUser: LocalUser = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        nickname,
        password
      };
      setLocalUsers([...users, localUser]);
      const publicUser = toPublicUser(localUser);
      const token = createLocalSession(publicUser);
      set({ token, user: publicUser, isAuthenticated: true, isLoading: false, error: null });
      return { success: true, message: '로컬 테스트 계정으로 회원가입이 완료되었습니다.' };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    const localUser = findLocalUserByToken(token);
    if (localUser) {
      const migrated = await tryMigrateLocalUser(localUser);
      if (migrated?.token) {
        migrateLocalProjectsByEmail(localUser.email, migrated.user.id);
        localStorage.setItem('token', migrated.token);
        set({ token: migrated.token, user: migrated.user, isAuthenticated: true, isLoading: false });
        return;
      }

      set({ token, user: toPublicUser(localUser), isAuthenticated: true, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error('인증 토큰이 유효하지 않습니다.');
      }

      set({
        user: data.user ? { ...data.user, email: normalizeEmail(data.user.email) } : data.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (err) {
      localStorage.removeItem('token');
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  updateProfile: async (nickname) => {
    set({ isLoading: true, error: null });
    const token = localStorage.getItem('token');

    const localUser = findLocalUserByToken(token);
    if (localUser) {
      const updatedUser = { ...localUser, nickname };
      setLocalUsers(getLocalUsers().map((user) => user.id === localUser.id ? updatedUser : user));
      set({ user: toPublicUser(updatedUser), isLoading: false });
      return true;
    }

    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nickname })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '프로필 수정에 실패했습니다.');
      }

      set({
        user: data.user,
        isLoading: false
      });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null })
}));
