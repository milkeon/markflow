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

const API_URL = 'http://localhost:5000/api';
const LOCAL_USERS_KEY = 'markflow.localUsers';
const LOCAL_TOKEN_PREFIX = 'local-token:';

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

const findLocalUserByToken = (token: string | null): LocalUser | null => {
  if (!token?.startsWith(LOCAL_TOKEN_PREFIX)) return null;
  const id = token.replace(LOCAL_TOKEN_PREFIX, '');
  return getLocalUsers().find((user) => user.id === id) || null;
};

const toPublicUser = ({ password: _password, ...user }: LocalUser): User => user;

export const useAuthStore = create<AuthState>((set) => ({
  user: findLocalUserByToken(localStorage.getItem('token')),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
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
        user: data.user,
        isAuthenticated: true,
        isLoading: false
      });
      return true;
    } catch (err: any) {
      const localUser = getLocalUsers().find((user) => user.email === email && user.password === password);
      if (localUser) {
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

      const user = data.user || { id: data.id || crypto.randomUUID(), email, nickname };
      const token = data.token || createLocalSession(user);
      localStorage.setItem('token', token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      return { success: true, message: data.message || '회원가입이 완료되었습니다.' };
    } catch (err: any) {
      const users = getLocalUsers();
      if (users.some((user) => user.email === email)) {
        const message = '이미 가입된 이메일입니다. 로그인해주세요.';
        set({ error: message, isLoading: false });
        return { success: false, message };
      }

      const localUser: LocalUser = {
        id: crypto.randomUUID(),
        email,
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
        user: data.user,
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
