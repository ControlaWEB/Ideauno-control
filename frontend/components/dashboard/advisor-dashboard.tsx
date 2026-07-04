'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import {
  Building2, FileText, DollarSign, TrendingUp, CheckCircle2, ArrowRight, Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { KpiCard } from './kpi-card';

interface Props {
  advisorId?: string;
  advisorName?: string;
  viewingAsAdmin?: boolean;
  headerExtra?: React.ReactNode;
}

export function AdvisorDashboard({ advisorId, advisorName, viewingAsAdmin, headerExtra }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['advisor-dashboard', advisorId ?? 'self'],
    queryFn: () => dashboardApi.getAdvisorStats(advisorId).then(r => r.data),
    staleTime: 30000,
    enabled: viewingAsAdmin ? !!advisorId : true,
  });

  if (viewingAsAdmin && !advisorId) {
    return (
        <div className="page-content animate-fade-in">
          <div className="page-header" style={{ marginBottom: 20 }}>
            <div>
              <h1 className="page-title">Mi Dashboard</h1>
              <p className="page-desc">Vista de administrador</p>
            </div>
            {headerExtra}
          </div>
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <Users size={24} />
            <p style={{ fontSize: 13 }}>Selecciona un asesor para ver su dashboard.</p>
          </div>
        </div>
    );
  }

  if (isLoading) {
    return (
        <div className="page-content animate-fade-in">
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
        </div>
    );
  }

  const s = stats ?? {};
  const ama = s.amaData ?? null;
  const amaPct = Number(ama?.avance_pct || 0);
  const amaAlcanzada = ama?.ama_alcanzada === true || ama?.ama_alcanzada === 'true';
  const ops: any[] = s.ultimasCuatroOps ?? [];
  const adv = s.advisor ?? null;
  const statusBadge: Record<string, string> = {
    Activo: 'badge-success',
    'En mentoría': 'badge-warning',
    Inactivo: 'badge-neutral',
    'Baja definitiva': 'badge-error',
  };

  return (
      <div className="page-content animate-fade-in">

        {/* ─── Page header ─── */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title">{viewingAsAdmin ? `Dashboard de ${advisorName ?? 'asesor'}` : 'Mi Dashboard'}</h1>
            <p className="page-desc">{viewingAsAdmin ? 'Vista de administrador' : `Bienvenido, ${user?.name}`}</p>
          </div>
          {headerExtra}
        </div>

        {/* ─── Encabezado de perfil del asesor ─── */}
        {adv && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 18, flexShrink: 0 }}>
                {getInitials(adv.name)}
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface)' }}>{adv.name}</span>
                  {adv.status && <span className={`badge ${statusBadge[adv.status] ?? 'badge-neutral'}`}>{adv.status}</span>}
                  {amaAlcanzada && (
                    <span className="badge" style={{ background: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700 }}>
                      🏆 AMA Alcanzada
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--color-on-surface-variant)' }}>
                  {adv.email && <span>✉ {adv.email}</span>}
                  {adv.phone && <span>📞 {adv.phone}</span>}
                  {adv.specialty && <span>🏷 {adv.specialty}</span>}
                </div>
              </div>
              <div style={{ width: 260, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Avance AMA</span>
                  <span style={{ fontWeight: 700, color: amaAlcanzada ? 'var(--color-success)' : 'var(--color-primary)' }}>{amaPct.toFixed(1)}%</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--color-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, amaPct)}%`, background: amaAlcanzada ? 'var(--color-success)' : 'var(--color-primary)', borderRadius: 4, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 5 }}>
                  <span>{formatCurrency(Number(ama?.monto_acumulado || 0))}</span>
                  <span>Meta: {formatCurrency(Number(ama?.meta_ama || 180000))}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── KPI Row 1: 4 cards ─── */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <KpiCard
            label="Comisión neta este mes"
            value={formatCurrency(s.comisionNetaMes ?? 0)}
            icon={<DollarSign size={18} />}
            iconBg="#d1fae5" iconColor="#006c49"
          />
          <KpiCard
            label="Comisión neta total año"
            value={formatCurrency(s.comisionNetaTotal ?? 0)}
            icon={<TrendingUp size={18} />}
            iconBg="#ede9fe" iconColor="#7c3aed"
          />
          <KpiCard
            label="Cierres este mes"
            value={s.cierresMes ?? 0}
            sub={`${s.cierresAnio ?? 0} en el año`}
            icon={<CheckCircle2 size={18} />}
            iconBg="#dbeafe" iconColor="#1e40af"
          />
          <div className="kpi-card">
            <div className="kpi-label">Avance AMA</div>
            <div className="kpi-value" style={{ marginTop: 6 }}>{amaPct.toFixed(1)}%</div>
            <div style={{
              marginTop: 10, width: 200, height: 8,
              background: 'var(--color-secondary)', borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${Math.min(100, amaPct)}%`,
                background: 'var(--color-primary)', borderRadius: 4, transition: 'width 0.4s',
              }} />
            </div>
          </div>
        </div>

        {/* ─── KPI Row 2: 4 cards ─── */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <KpiCard
            label="Propiedades activas"
            value={s.propiedadesActivas ?? 0}
            sub={`${s.propiedadesTotal ?? 0} en total`}
            icon={<Building2 size={18} />}
            iconBg="#dbeafe" iconColor="#1e40af"
          />
          <KpiCard
            label="Asesores invitados"
            value={s.asesoresInvitados ?? 0}
            icon={<Users size={18} />}
            iconBg="#fef3c7" iconColor="#78350f"
          />
          <KpiCard
            label="Gratificaciones recibidas"
            value={formatCurrency(s.gratificacionesRecibidas ?? 0)}
            icon={<DollarSign size={18} />}
            iconBg="#d1fae5" iconColor="#006c49"
          />
          <KpiCard
            label="Pagos por mentoría"
            value={formatCurrency(s.pagosMentoria ?? 0)}
            sub="Recibidos de mis mentoreados"
            icon={<TrendingUp size={18} />}
            iconBg="#ede9fe" iconColor="#7c3aed"
          />
        </div>

        {/* ─── Últimas operaciones + AMA detail ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Últimas operaciones */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Últimas Operaciones</div>
                <div className="card-subtitle">Mis últimos 4 cierres</div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push('/operations')}>
                Ver todos <ArrowRight size={12} />
              </button>
            </div>
            {ops.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <FileText size={24} />
                <p style={{ fontSize: 13 }}>Sin operaciones registradas aún</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                    {['Fecha', 'Tipo', 'Dirección', 'Comisión neta'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11.5, color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ops.map((op: any, i: number) => (
                    <tr key={op.id} style={{ borderBottom: i < ops.length - 1 ? '1px solid var(--color-outline-variant)' : 'none' }}>
                      <td style={{ padding: '8px 8px', fontSize: 12 }}>{op.fecha_cierre ? formatDate(op.fecha_cierre) : '—'}</td>
                      <td style={{ padding: '8px 8px', fontSize: 12 }}>{op.type || '—'}</td>
                      <td style={{ padding: '8px 8px', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.property_address || '—'}</td>
                      <td style={{ padding: '8px 8px', fontSize: 12, fontWeight: 700, color: 'var(--color-secondary)' }}>{formatCurrency(Number(op.monto_neto_asesor || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* AMA detail */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Meta AMA Anual</div>
                <div className="card-subtitle">Acumulado de comisiones netas</div>
              </div>
              {amaAlcanzada && (
                <span className="badge" style={{ background: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700 }}>
                  AMA Alcanzada
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ama?.fecha_inicio_periodo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Inicio de periodo:</span>
                  <span style={{ fontWeight: 600 }}>{formatDate(ama.fecha_inicio_periodo)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Meta:</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(Number(ama?.meta_ama || 180000))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Acumulado:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>{formatCurrency(Number(ama?.monto_acumulado || 0))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Avance:</span>
                <span style={{ fontWeight: 700, color: amaAlcanzada ? 'var(--color-success)' : 'var(--color-primary)' }}>{amaPct.toFixed(1)}%</span>
              </div>
              <div style={{ marginTop: 4, width: '100%', height: 10, background: 'var(--color-secondary)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.min(100, amaPct)}%`,
                  background: amaAlcanzada ? 'var(--color-success)' : 'var(--color-primary)',
                  borderRadius: 5, transition: 'width 0.4s',
                }} />
              </div>
              {!ama && (
                <p style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 8 }}>
                  Sin periodo AMA iniciado.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Quick links ─── */}
        <div className="card">
          <div className="card-header"><div className="card-title">Acciones rápidas</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { label: 'Nueva Captación Venta', desc: 'Registrar propiedad en venta', href: '/properties/new', color: '#1e40af', bg: '#dbeafe' },
              { label: 'Nueva Captación Renta', desc: 'Registrar propiedad en renta', href: '/rentals/new', color: '#7c3aed', bg: '#ede9fe' },
              { label: 'Nuevo Cierre', desc: 'Registrar operación de cierre', href: '/operations/new', color: '#006c49', bg: '#d1fae5' },
              { label: 'Mis Pagos', desc: 'Ver historial de comisiones', href: '/payments', color: '#c2410c', bg: '#ffedd5' },
              { label: 'Inventario General', desc: 'Ver todas las propiedades', href: '/properties', color: '#213a55', bg: '#e2e8f0' },
            ].map(a => (
              <a key={a.href} href={a.href} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-outline-variant)', textDecoration: 'none', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = a.bg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-container-low)'; }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: a.bg, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowRight size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-on-surface)' }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{a.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
  );
}
