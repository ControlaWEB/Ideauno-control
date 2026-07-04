// lib/toast.ts
// Helper global para lanzar toasts desde cualquier parte (componentes o no).
import { useToastStore, type ToastVariant } from '@/store/toast.store';

interface NotifyOptions {
  title?: string;
  duration?: number;
}

function show(variant: ToastVariant, message: string, opts?: NotifyOptions): string {
  const defaultDuration = variant === 'error' ? 6000 : 4000;
  return useToastStore.getState().push({
    variant,
    message,
    title: opts?.title,
    duration: opts?.duration ?? defaultDuration,
  });
}

export const notify = {
  success: (message: string, opts?: NotifyOptions) => show('success', message, opts),
  error: (message: string, opts?: NotifyOptions) => show('error', message, opts),
  info: (message: string, opts?: NotifyOptions) => show('info', message, opts),
};
