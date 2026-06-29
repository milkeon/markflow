// frontend/src/store/confirmStore.ts
import { create } from 'zustand';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolver: ((value: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

// window.confirm() 대체: Promise<boolean>으로 결과를 받고, 전역 모달 1개를 공유한다
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  resolver: null,

  request: (options) => {
    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, options, resolver: resolve });
    });
  },

  handleConfirm: () => {
    get().resolver?.(true);
    set({ isOpen: false, options: null, resolver: null });
  },

  handleCancel: () => {
    get().resolver?.(false);
    set({ isOpen: false, options: null, resolver: null });
  }
}));

export const confirmDialog = (options: ConfirmOptions) => useConfirmStore.getState().request(options);
