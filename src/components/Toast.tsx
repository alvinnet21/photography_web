import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  type?: ToastType;
  message: string;
  duration?: number; // ms
  onClose?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const bgByType: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-yellow-600',
};

const iconByType: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  warning: <AlertCircle className="w-5 h-5" />,
};

const positionClass = (pos: NonNullable<ToastProps['position']>) => {
  const base = 'fixed z-50';
  switch (pos) {
    case 'top-left':
      return `${base} top-4 left-4`;
    case 'bottom-right':
      return `${base} bottom-4 right-4`;
    case 'bottom-left':
      return `${base} bottom-4 left-4`;
    case 'top-right':
    default:
      return `${base} top-4 right-4`;
  }
};

const Toast: React.FC<ToastProps> = ({ type = 'info', message, duration = 2500, onClose, position = 'top-right' }) => {
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div className={`${positionClass(position)} px-4 py-3 rounded-lg shadow-lg text-white ${bgByType[type]} transition-opacity`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center space-x-2">
        <span className="shrink-0">{iconByType[type]}</span>
        <span>{message}</span>
        {onClose && (
          <button onClick={onClose} className="ml-2 p-1/2 rounded hover:opacity-80" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;

