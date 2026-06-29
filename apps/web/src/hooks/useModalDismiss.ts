// frontend/src/hooks/useModalDismiss.ts
import { useEffect } from 'react';

// 모달 공용 키보드 동작: Esc=닫기, Enter=확인(선택)
export function useModalDismiss(isOpen: boolean, onClose: () => void, onConfirm?: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && onConfirm) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);
}
