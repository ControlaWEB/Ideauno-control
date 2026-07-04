'use client';

// components/notifications-bell.tsx
// Campana de notificaciones: muestra los últimos movimientos del sistema (audit logs).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, UserPlus, UserCog, Landmark, FileSignature, Lock, Unlock,
  XCircle, RefreshCw, CheckCircle2, DollarSign, ThumbsDown, Activity,
} from 'lucide-react';
import { auditApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency } from '@/lib/utils';

interface AuditEntry {
  id: string;
  user_email: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: string;
}

const ADMIN_ROLES = ['Super Admin', 'Admin'];
const LAST_SEEN_KEY = 'audit-last-seen';

const money = (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v ?? ''));

// Mapa acción → { texto legible, icono, color }
function describe(entry: AuditEntry): { text: string; Icon: typeof Bell; color: string } {
  const d = entry.details ?? {};
  switch (entry.action) {
    case 'CREATE_ADVISOR':
      return { text: `Alta de asesor: ${d.name ?? ''}`, Icon: UserPlus, color: 'var(--color-success)' };
    case 'UPDATE_ADVISOR_STATUS':
      return { text: `Estatus de asesor → ${d.newStatus ?? ''}`, Icon: UserCog, color: 'var(--color-primary)' };
    case 'UPDATE_ADVISOR_BANK':
      return { text: 'Datos bancarios de asesor actualizados', Icon: Landmark, color: 'var(--color-primary)' };
    case 'UPDATE_ADVISOR':
      return { text: 'Asesor editado', Icon: UserCog, color: 'var(--color-primary)' };
    case 'CREATE_OPERATION':
      return { text: `Nueva operación (${d.type ?? ''}) · comisión ${money(d.montoComision)}`, Icon: FileSignature, color: 'var(--color-success)' };
    case 'RELEASE_COMMISSION':
      return { text: 'Comisión liberada', Icon: Unlock, color: 'var(--color-success)' };
    case 'BLOCK_COMMISSION':
      return { text: `Comisión bloqueada${d.motivo ? `: ${d.motivo}` : ''}`, Icon: Lock, color: 'var(--color-error)' };
    case 'UNBLOCK_COMMISSION':
      return { text: 'Comisión desbloqueada', Icon: Unlock, color: 'var(--color-primary)' };
    case 'CANCEL_OPERATION':
      return { text: `Operación cancelada${d.motivo ? `: ${d.motivo}` : ''}`, Icon: XCircle, color: 'var(--color-error)' };
    case 'UPDATE_OPERATION_STATUS':
      return { text: `Estatus de operación → ${d.newStatus ?? ''}`, Icon: RefreshCw, color: 'var(--color-primary)' };
    case 'AUTHORIZE_PAYMENT':
      return { text: 'Pago autorizado', Icon: CheckCircle2, color: 'var(--color-success)' };
    case 'MARK_PAYMENT_PAID':
      return { text: `Pago realizado (${d.formaPago ?? ''}) · ${money(d.monto)}`, Icon: DollarSign, color: 'var(--color-success)' };
    case 'REJECT_PAYMENT':
      return { text: `Pago rechazado${d.observaciones ? `: ${d.observaciones}` : ''}`, Icon: ThumbsDown, color: 'var(--color-error)' };
    default:
      return { text: entry.action, Icon: Activity, color: 'var(--color-on-surface-variant)' };
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-MX');
}

export function NotificationsBell() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const hasAccess = ADMIN_ROLES.includes(user?.role ?? '');

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LAST_SEEN_KEY) : null;
    setLastSeen(raw ? Number(raw) : 0);
  }, []);

  const { data, isLoading } = useQuery<{ data: AuditEntry[] }>({
    queryKey: ['audit', 'notifications'],
    queryFn: () => auditApi.getAll({ page: 1, limit: 12 }).then((r) => r.data),
    enabled: hasAccess,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const entries = useMemo(() => data?.data ?? [], [data]);

  const unread = useMemo(
    () => entries.filter((e) => new Date(e.timestamp).getTime() > lastSeen).length,
    [entries, lastSeen],
  );

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && entries.length) {
      const newest = new Date(entries[0].timestamp).getTime();
      localStorage.setItem(LAST_SEEN_KEY, String(newest));
      setLastSeen(newest);
    }
  };

  if (!hasAccess) return null;

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div className="tooltip-wrapper">
        <button
          className="btn-ghost"
          style={{ padding: 8, borderRadius: '50%', position: 'relative' }}
          onClick={toggle}
        >
          <Bell size={18} />
          {unread > 0 && <span className="notif-dot" />}
        </button>
        {!open && <span className="tooltip">Movimientos</span>}
      </div>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 380, maxWidth: '90vw',
            background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.15))',
            zIndex: 200, overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--color-on-surface)' }}>Movimientos recientes</span>
            {unread > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)' }}>{unread} nuevo(s)</span>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 44, borderRadius: 'var(--radius-md)' }} />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 13 }}>
                Sin movimientos por ahora
              </div>
            ) : (
              entries.map((entry) => {
                const { text, Icon, color } = describe(entry);
                const actor = entry.user_email && entry.user_email !== 'system' ? entry.user_email : null;
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex', gap: 10, padding: '11px 16px', alignItems: 'flex-start',
                      borderBottom: '1px solid var(--color-outline-variant)',
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--color-on-surface)', lineHeight: 1.35 }}>{text}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                        {actor ? `${actor} · ` : ''}{relativeTime(entry.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => { setOpen(false); router.push('/audit'); }}
            style={{
              width: '100%', padding: '11px 16px', border: 'none', background: 'transparent',
              color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Ver toda la auditoría
          </button>
        </div>
      )}
    </div>
  );
}
