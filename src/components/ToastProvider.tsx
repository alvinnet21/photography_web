import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from './Toast';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastKind;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (t: Omit<ToastItem, 'id'>) => string; // returns id
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const useNotify = () => {
  const { addToast } = useToast();
  return {
    success: (message: string, duration?: number) => addToast({ type: 'success', message, duration }),
    error: (message: string, duration?: number) => addToast({ type: 'error', message, duration }),
    info: (message: string, duration?: number) => addToast({ type: 'info', message, duration }),
    warning: (message: string, duration?: number) => addToast({ type: 'warning', message, duration }),
  };
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Replace any existing toasts with the newest one (cancel older toasts)
    setToasts([{ id, ...t }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Stack container (top-right) */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <Toast
            key={t.id}
            type={t.type}
            message={t.message}
            duration={t.duration ?? 2500}
            onClose={() => removeToast(t.id)}
            position="top-right"
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
