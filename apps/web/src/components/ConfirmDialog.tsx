// frontend/src/components/ConfirmDialog.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModalDismiss } from '../hooks/useModalDismiss.js';
import { useConfirmStore } from '../store/confirmStore.js';

// 전역 공용 확인/취소 다이얼로그: 바깥 클릭=취소, Enter=확인, Esc=취소
// App 최상단에 1번만 마운트하고, 어디서든 confirmDialog({message})로 호출한다
export const ConfirmDialog: React.FC = () => {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();
  useModalDismiss(isOpen, handleCancel, handleConfirm);

  if (!isOpen || !options) return null;

  const {
    title = '확인',
    message,
    confirmText = '확인',
    cancelText = '취소',
    danger = false
  } = options;
  const onConfirm = handleConfirm;
  const onCancel = handleCancel;

  return (
    <div
      className="fixed inset-0 z-level5 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm p-6 rounded-3xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className={`p-2 rounded-xl shrink-0 ${danger ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-600 whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition-colors shadow-sm ${
              danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[#172b4d] hover:bg-[#091e42]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
