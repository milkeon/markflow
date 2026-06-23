// frontend/src/components/Toast.tsx
import React from 'react';
import { useProjectStore } from '../store/projectStore.js';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useProjectStore();

  if (!toast) return null;

  const bgColors = {
    success: 'bg-emerald-950/80 border-emerald-500 text-emerald-200',
    error: 'bg-rose-950/80 border-rose-500 text-rose-200',
    info: 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
  };

  const Icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-indigo-400 shrink-0" />
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 ${bgColors[toast.type]}`}>
        {Icons[toast.type]}
        <span className="text-sm font-medium pr-2">{toast.message}</span>
        <button 
          onClick={clearToast}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
