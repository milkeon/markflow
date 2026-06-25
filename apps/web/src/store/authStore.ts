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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
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
      set({ error: err.message, isLoading: false });
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

      set({ isLoading: false });
      return { success: true, message: data.message };
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return { success: false, message: err.message };
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
