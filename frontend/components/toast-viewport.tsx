'use client';

// components/toast-viewport.tsx
// Renderiza la pila de toasts flotantes en la esquina superior derecha.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastItem, type ToastVariant } from '@/store/toast.store';

const STYLES: Record<ToastVariant, { bg: string; border: string; color: string; Icon: typeof Info }> = {
  success: { bg: '#f0fdf4', border: '#86efac', color: '#166534', Icon: CheckCircle2 },
  error:   { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', Icon: AlertCircle },
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', Icon: Info },
};

function Toast({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { bg, border, color, Icon } = STYLES[toast.variant];

  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: bg, border: `1px solid ${border}`, color,
        borderRadius: 'var(--radius-md)', padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 280, maxWidth: 380,
        animation: 'toast-in 0.22s ease',
      }}
    >
      <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{toast.title}</div>}
        <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 550 }}>{toast.message}</div>
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        aria-label="Cerrar"
        style={{ background: 'transparent', border: 'none', color, cursor: 'pointer', padding: 0, opacity: 0.6, flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      <div
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast toast={t} />
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
