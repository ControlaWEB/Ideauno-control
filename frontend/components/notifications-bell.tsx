'use client';

// components/notifications-bell.tsx
// Campana de notificaciones.
//  · Admin / Super Admin  → últimos movimientos del sistema (audit logs).
//  · Asesor               → su bandeja personal (comisiones, pagos, operaciones).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, UserPlus, UserCog, Landmark, FileSignature, Lock, Unlock,
  XCircle, RefreshCw, CheckCircle2, DollarSign, ThumbsDown, Activity,
} from 'lucide-react';
import { auditApi, notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency } from '@/lib/utils';

const ADMIN_ROLES = ['Super Admin', 'Admin'];
const ASESOR_ROLE = 'Asesor';
const LAST_SEEN_KEY = 'audit-last-seen';

const money = (v: unknown) => (typeof v === 'number' ? formatCurrency(v) : String(v ?? ''));

interface FeedItem {
  id: string;
  text: string;
  sub: string;
  Icon: typeof Bell;
  color: string;
  ts: number;
  href?: string;
}

// ── Iconos/colores por tipo (compartido entre audit y notificaciones) ──
const TYPE_STYLE: Record<string, { Icon: typeof Bell; color: string }> = {
  CREATE_ADVISOR:          { Icon: UserPlus,     color: 'var(--color-success)' },
  UPDATE_ADVISOR_STATUS:   { Icon: UserCog,      color: 'var(--color-primary)' },
  UPDATE_ADVISOR_BANK:     { Icon: Landmark,     color: 'var(--color-primary)' },
  UPDATE_ADVISOR:          { Icon: UserCog,      color: 'var(--color-primary)' },
  CREATE_OPERATION:        { Icon: FileSignature, color: 'var(--color-success)' },
  OPERATION_CREATED:       { Icon: FileSignature, color: 'var(--color-success)' },
  RELEASE_COMMISSION:      { Icon: Unlock,       color: 'var(--color-success)' },
  COMMISSION_RELEASED:     { Icon: Unlock,       color: 'var(--color-success)' },
  BLOCK_COMMISSION:        { Icon: Lock,         color: 'var(--color-error)' },
  COMMISSION_BLOCKED:      { Icon: Lock,         color: 'var(--color-error)' },
  UNBLOCK_COMMISSION:      { Icon: Unlock,       color: 'var(--color-primary)' },
  COMMISSION_UNBLOCKED:    { Icon: Unlock,       color: 'var(--color-primary)' },
  CANCEL_OPERATION:        { Icon: XCircle,      color: 'var(--color-error)' },
  OPERATION_CANCELLED:     { Icon: XCircle,      color: 'var(--color-error)' },
  UPDATE_OPERATION_STATUS: { Icon: RefreshCw,    color: 'var(--color-primary)' },
  AUTHORIZE_PAYMENT:       { Icon: CheckCircle2, color: 'var(--color-success)' },
  PAYMENT_AUTHORIZED:      { Icon: CheckCircle2, color: 'var(--color-success)' },
  MARK_PAYMENT_PAID:       { Icon: DollarSign,   color: 'var(--color-success)' },
  PAYMENT_PAID:            { Icon: DollarSign,   color: 'var(--color-success)' },
  REJECT_PAYMENT:          { Icon: ThumbsDown,   color: 'var(--color-error)' },
  PAYMENT_REJECTED:        { Icon: ThumbsDown,   color: 'var(--color-error)' },
};

const styleOf = (type: string) => TYPE_STYLE[type] ?? { Icon: Activity, color: 'var(--color-on-surface-variant)' };

// ── Audit log → texto legible (vista admin) ──
interface AuditEntry {
  id: string; user_email: string; action: string;
  details: Record<string, unknown>; timestamp: string;
}
function auditText(e: AuditEntry): string {
  const d = e.details ?? {};
  // Nombre del asesor / código de operación involucrado (para "para quién").
  const who = (d.advisorName as string) || '';
  const code = (d.operationCode as string) || (d.operationId as string) || '';
  const w = who ? ` · ${who}` : '';

  switch (e.action) {
    case 'CREATE_ADVISOR': return `Alta de asesor: ${d.name ?? who ?? ''}`;
    case 'UPDATE_ADVISOR_STATUS': return `Estatus de asesor${w} → ${d.newStatus ?? ''}`;
    case 'UPDATE_ADVISOR_BANK': return `Datos bancarios actualizados${w}`;
    case 'UPDATE_ADVISOR': return `Asesor editado${w}`;
    case 'CREATE_OPERATION': return `Nueva operación (${d.type ?? ''})${w} · comisión ${money(d.montoComision)}`;
    case 'RELEASE_COMMISSION': return `Comisión liberada${w}`;
    case 'BLOCK_COMMISSION': return `Comisión bloqueada${w}${d.motivo ? ` — ${d.motivo}` : ''}`;
    case 'UNBLOCK_COMMISSION': return `Comisión desbloqueada${w}`;
    case 'CANCEL_OPERATION': return `Operación cancelada${code ? ` ${code}` : ''}${w}${d.motivo ? ` — ${d.motivo}` : ''}`;
    case 'UPDATE_OPERATION_STATUS': return `Estatus de operación${code ? ` ${code}` : ''}${w} → ${d.newStatus ?? ''}`;
    case 'AUTHORIZE_PAYMENT': return `Pago autorizado${w}`;
    case 'MARK_PAYMENT_PAID': return `Pago realizado (${d.formaPago ?? ''})${w} · ${money(d.monto)}`;
    case 'REJECT_PAYMENT': return `Pago rechazado${w}${d.observaciones ? ` — ${d.observaciones}` : ''}`;
    default: return e.action;
  }
}

// ── Ruta de destino al hacer clic (vista admin/audit) ──
function auditHref(action: string, d: Record<string, unknown>): string | undefined {
  const advisorId = d.advisorId as string | undefined;
  const operationId = d.operationId as string | undefined;
  if (action.includes('ADVISOR') && advisorId) return `/advisors/${advisorId}`;
  if (['CREATE_OPERATION', 'CANCEL_OPERATION', 'UPDATE_OPERATION_STATUS'].includes(action) && operationId) {
    return `/operations/${operationId}`;
  }
  if (action.includes('COMMISSION')) return '/commissions';
  if (action.includes('PAYMENT')) return '/payments';
  return undefined;
}

// ── Ruta de destino para notificaciones de asesor ──
function notifHref(type: string, entityId?: string): string | undefined {
  if (type.startsWith('OPERATION') && entityId) return `/operations/${entityId}`;
  if (type.startsWith('COMMISSION')) return '/commissions';
  if (type.startsWith('PAYMENT')) return '/payments';
  return undefined;
}

// ── Notificación de asesor ──
interface AdvisorNotification {
  id: string; type: string; title: string; body: string;
  read: boolean; created_at: string; entity_id?: string;
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? '';
  const isAdmin = ADMIN_ROLES.includes(role);
  const isAsesor = role === ASESOR_ROLE;

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LAST_SEEN_KEY) : null;
    setLastSeen(raw ? Number(raw) : 0);
  }, []);

  // ── Fuente ADMIN: audit ──
  const auditQuery = useQuery<{ data: AuditEntry[] }>({
    queryKey: ['audit', 'notifications'],
    queryFn: () => auditApi.getAll({ page: 1, limit: 12 }).then((r) => r.data),
    enabled: isAdmin,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  // ── Fuente ASESOR: notifications ──
  const notifQuery = useQuery<{ data: AdvisorNotification[]; unread: number }>({
    queryKey: ['notifications', 'me'],
    queryFn: () => notificationsApi.getAll(15).then((r) => r.data),
    enabled: isAsesor,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const isLoading = isAdmin ? auditQuery.isLoading : notifQuery.isLoading;

  const items: FeedItem[] = useMemo(() => {
    if (isAdmin) {
      return (auditQuery.data?.data ?? []).map((e) => {
        const { Icon, color } = styleOf(e.action);
        const actor = e.user_email && e.user_email !== 'system' ? `${e.user_email} · ` : '';
        return { id: e.id, text: auditText(e), sub: `${actor}${relativeTime(e.timestamp)}`, Icon, color, ts: new Date(e.timestamp).getTime(), href: auditHref(e.action, e.details ?? {}) };
      });
    }
    if (isAsesor) {
      return (notifQuery.data?.data ?? []).map((n) => {
        const { Icon, color } = styleOf(n.type);
        return { id: n.id, text: n.title, sub: `${n.body ? `${n.body} · ` : ''}${relativeTime(n.created_at)}`, Icon, color, ts: new Date(n.created_at).getTime(), href: notifHref(n.type, n.entity_id) };
      });
    }
    return [];
  }, [isAdmin, isAsesor, auditQuery.data, notifQuery.data]);

  const unread = useMemo(() => {
    if (isAdmin) return items.filter((i) => i.ts > lastSeen).length;
    if (isAsesor) return notifQuery.data?.unread ?? 0;
    return 0;
  }, [isAdmin, isAsesor, items, lastSeen, notifQuery.data]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    if (isAdmin && items.length) {
      const newest = items[0].ts;
      localStorage.setItem(LAST_SEEN_KEY, String(newest));
      setLastSeen(newest);
    }
    if (isAsesor && unread > 0) {
      try {
        await notificationsApi.markAllRead();
        queryClient.invalidateQueries({ queryKey: ['notifications', 'me'] });
      } catch { /* best-effort */ }
    }
  };

  if (!isAdmin && !isAsesor) return null;

  const title = isAdmin ? 'Movimientos recientes' : 'Mis notificaciones';
  const emptyText = isAdmin ? 'Sin movimientos por ahora' : 'No tienes notificaciones';

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
        {!open && <span className="tooltip">Notificaciones</span>}
      </div>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 380, maxWidth: '90vw',
            background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            zIndex: 200, overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--color-on-surface)' }}>{title}</span>
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
            ) : items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 13 }}>
                {emptyText}
              </div>
            ) : (
              items.map((item) => {
                const { Icon } = item;
                const clickable = !!item.href;
                return (
                  <div
                    key={item.id}
                    onClick={clickable ? () => { setOpen(false); router.push(item.href!); } : undefined}
                    style={{
                      display: 'flex', gap: 10, padding: '11px 16px', alignItems: 'flex-start',
                      borderBottom: '1px solid var(--color-outline-variant)',
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = 'var(--color-surface-container-low)'; } : undefined}
                    onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = 'transparent'; } : undefined}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${item.color}18`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--color-on-surface)', lineHeight: 1.35, fontWeight: 550 }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>{item.sub}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {isAdmin && (
            <button
              onClick={() => { setOpen(false); router.push('/audit'); }}
              style={{
                width: '100%', padding: '11px 16px', border: 'none', background: 'transparent',
                color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Ver toda la auditoría
            </button>
          )}
        </div>
      )}
    </div>
  );
}
