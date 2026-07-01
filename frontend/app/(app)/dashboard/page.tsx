'use client';

import { Header } from '@/components/header';
import { useQuery } from '@tanstack/react-query';
import { api, dashboardApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Building2, FileText, DollarSign, Users, CheckCircle2, Clock,
  AlertCircle, TrendingUp, ArrowRight, ShieldAlert, Lock, Cake,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

function KpiCard({ label, value, sub, icon, iconBg, iconColor, alert }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; iconBg: string; iconColor: string; alert?: boolean;
}) {
  return (
    <div className="kpi-card" style={alert ? { borderLeft: '3px solid var(--color-error)' } : {}}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ marginTop: 6, color: alert ? 'var(--color-error)' : undefined }}>{value}</div>
          {sub && <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Advisor personal dashboard ───────────────────────────────────────────────

function AdvisorDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['advisor-dashboard'],
    queryFn: () => api.get('/dashboard/advisor').then(r => r.data),
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="page-content animate-fade-in">
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </>
    );
  }

  const s = stats ?? {};
  const ama = s.amaData ?? null;
  const amaPct = Number(ama?.avance_pct || 0);
  const amaAlcanzada = ama?.ama_alcanzada === true || ama?.ama_alcanzada === 'true';
  const ops: any[] = s.ultimasCuatroOps ?? [];

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        {/* ─── Page header ─── */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title">Mi Dashboard</h1>
            <p className="page-desc">Bienvenido, {user?.name}</p>
          </div>
        </div>

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
    </>
  );
}

// ─── Admin dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const router = useRouter();

  const { data: kpis, isLoading: kLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.getKpis().then(r => r.data),
    staleTime: 30000,
  });

  const { data: charts, isLoading: cLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => dashboardApi.getCharts().then(r => r.data),
    staleTime: 30000,
  });

  if (kLoading || cLoading) {
    return (
      <>
        <Header />
        <div className="page-content animate-fade-in">
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
          </div>
          <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </>
    );
  }

  const k = kpis ?? {};
  const ch = charts ?? {};

  const topAsesores: any[] = ch.topAsesores ?? [];
  const ultimosCierres: any[] = ch.ultimosCierres ?? [];
  const amaAsesores: any[] = ch.amaAsesores ?? [];
  const propSinContrato: any[] = ch.propiedadesSinContrato ?? [];
  const topCaptadores: any[] = ch.topCaptadores ?? [];
  const cumpleanios: any[] = ch.cumpleaniosProximos ?? [];
  const topRentas: any[] = ch.topRentas ?? [];
  const topInvitadores: any[] = ch.topInvitadores ?? [];

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        {/* ─── KPI Row ─── */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <KpiCard
            label="Propiedades activas"
            value={k.propiedadesActivas ?? 0}
            sub={`${k.propiedadesTotal ?? 0} en total`}
            icon={<Building2 size={18} />}
            iconBg="#dbeafe" iconColor="#1e40af"
          />
          <KpiCard
            label="Cierres pendientes validación"
            value={k.cierresPendientesValidacion ?? 0}
            sub={`${k.cierresTotal ?? 0} totales`}
            icon={<Clock size={18} />}
            iconBg="#fef3c7" iconColor="#78350f"
            alert={(k.cierresPendientesValidacion ?? 0) > 0}
          />
          <KpiCard
            label="Comisiones por liberar"
            value={formatCurrency(k.comisionesPorLiberar ?? 0)}
            sub={`${k.comisionesPorLiberarCount ?? 0} solicitudes`}
            icon={<DollarSign size={18} />}
            iconBg="#d1fae5" iconColor="#006c49"
            alert={(k.comisionesPorLiberar ?? 0) > 0}
          />
          <KpiCard
            label="Asesores activos"
            value={k.asesoresActivos ?? 0}
            sub={`${k.asesoresMentoria ?? 0} en mentoría`}
            icon={<Users size={18} />}
            iconBg="#ede9fe" iconColor="#7c3aed"
          />
        </div>

        {/* ─── Row 2: KPIs secundarios ─── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="stat-chip"><CheckCircle2 size={13} /> {k.cierresValidados ?? 0} cierres validados</div>
          <div className="stat-chip" style={{ color: k.ingresoInmobiliaria > 0 ? 'var(--color-secondary)' : undefined }}>
            <TrendingUp size={13} /> Ingreso inmobiliaria: {formatCurrency(k.ingresoInmobiliaria ?? 0)}
          </div>
          {(k.propiedadesSinContrato ?? 0) > 0 && (
            <div className="stat-chip" style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
              <AlertCircle size={13} /> {k.propiedadesSinContrato} prop. sin contrato firmado
            </div>
          )}
          {(k.comisionesBloqueadasCount ?? 0) > 0 && (
            <div className="stat-chip" style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
              <Lock size={13} /> {k.comisionesBloqueadasCount} comisión(es) bloqueada(s) — {formatCurrency(k.comisionesBloqueadasMonto ?? 0)}
            </div>
          )}
        </div>

        {/* ─── Row 3: Alertas importantes ─── */}
        {propSinContrato.length > 0 && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: '#c2410c', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={14} /> Propiedades sin Contrato de Comisión Mercantil
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {propSinContrato.map((p: any) => (
                <div key={p.id} style={{ fontSize: 12.5, color: '#92400e', display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{p.owner_name || '—'}</span>
                  <span style={{ opacity: 0.7 }}>{p.address || p.city}</span>
                  <span className="badge" style={{ background: '#ffedd5', color: '#c2410c', fontSize: 10 }}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Row 4: Top asesores + Últimos cierres ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Top asesores */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Top Asesores</div>
                <div className="card-subtitle">Por comisión total generada</div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push('/advisors')}>
                Ver todos <ArrowRight size={12} />
              </button>
            </div>
            {topAsesores.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <Users size={24} />
                <p style={{ fontSize: 13 }}>Sin cierres registrados aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topAsesores.map((a: any, i: number) => {
                  const pct = a.comision_total > 0 ? Math.min(100, (a.comision_total / (topAsesores[0]?.comision_total || 1)) * 100) : 0;
                  return (
                    <div key={a.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#d97706' : 'var(--color-on-surface-variant)', width: 16 }}>#{i+1}</span>
                          <span style={{ fontSize: 13, fontWeight: 550 }}>{a.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{a.cierres} cierres</span>
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-secondary)' }}>
                          {formatCurrency(Number(a.comision_total))}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: i === 0 ? '#d97706' : 'var(--color-secondary)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Últimos cierres */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Últimos Cierres</div>
                <div className="card-subtitle">Registros más recientes</div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push('/operations')}>
                Ver todos <ArrowRight size={12} />
              </button>
            </div>
            {ultimosCierres.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <FileText size={24} />
                <p style={{ fontSize: 13 }}>Sin cierres registrados aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {ultimosCierres.map((op: any, i: number) => {
                  const statusColor: Record<string, string> = {
                    'Solicitado': '#f59e0b',
                    'En revisión': '#3b82f6',
                    'Validado por administración': '#10b981',
                    'Liberado para pago': '#059669',
                    'Pagado': '#065f46',
                    'Cancelado': '#6b7280',
                  };
                  const color = statusColor[op.status] ?? '#6b7280';
                  return (
                    <div key={op.id} style={{ padding: '9px 0', borderBottom: i < ultimosCierres.length - 1 ? '1px solid var(--color-outline-variant)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {op.code} — {op.asesor_name || 'Sin asesor'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 1 }}>
                            {op.type} · {op.fecha_cierre ? formatDate(op.fecha_cierre) : '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{formatCurrency(Number(op.monto_comision_generada || 0))}</div>
                          <div style={{ fontSize: 10.5, color, fontWeight: 600 }}>{op.status}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Row 4b: Top captadores + Cumpleaños ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Top captadores */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Top Captadores</div>
                <div className="card-subtitle">Por propiedades captadas en inventario</div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push('/advisors')}>
                Ver todos <ArrowRight size={12} />
              </button>
            </div>
            {topCaptadores.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <Building2 size={24} />
                <p style={{ fontSize: 13 }}>Sin captaciones registradas aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topCaptadores.map((a: any, i: number) => {
                  const pct = Number(a.total_captaciones) > 0
                    ? Math.min(100, (Number(a.total_captaciones) / Number(topCaptadores[0]?.total_captaciones || 1)) * 100)
                    : 0;
                  return (
                    <div key={a.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#d97706' : 'var(--color-on-surface-variant)', width: 16 }}>#{i+1}</span>
                          <span style={{ fontSize: 13, fontWeight: 550 }}>{a.name}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', display: 'flex', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{a.total_captaciones} total</span>
                          {Number(a.captaciones_venta) > 0 && <span>{a.captaciones_venta}V</span>}
                          {Number(a.captaciones_renta) > 0 && <span>{a.captaciones_renta}R</span>}
                        </div>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: i === 0 ? '#d97706' : 'var(--color-primary)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cumpleaños próximos */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Cumpleaños Próximos</div>
                <div className="card-subtitle">Asesores activos — próximos 30 días</div>
              </div>
              <Cake size={18} style={{ color: 'var(--color-secondary)' }} />
            </div>
            {cumpleanios.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <Cake size={24} />
                <p style={{ fontSize: 13 }}>Sin cumpleaños en los próximos 30 días</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {cumpleanios.map((a: any, i: number) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < cumpleanios.length - 1 ? '1px solid var(--color-outline-variant)' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700 }}>
                      {a.cumpleanos_dia_mes}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 550 }}>{a.name}</div>
                      {a.phone && <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{a.phone}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Row 4c: Top rentas + Top invitadores ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Top asesores en rentas */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Top Asesores en Rentas</div>
                <div className="card-subtitle">Por operaciones de renta cerradas</div>
              </div>
            </div>
            {topRentas.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <Building2 size={24} />
                <p style={{ fontSize: 13 }}>Sin operaciones de renta registradas</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topRentas.map((a: any, i: number) => {
                  const pct = Number(a.rentas_cerradas) > 0
                    ? Math.min(100, (Number(a.rentas_cerradas) / Number(topRentas[0]?.rentas_cerradas || 1)) * 100)
                    : 0;
                  return (
                    <div key={a.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#d97706' : 'var(--color-on-surface-variant)', width: 16 }}>#{i+1}</span>
                          <span style={{ fontSize: 13, fontWeight: 550 }}>{a.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{a.rentas_cerradas} rentas</span>
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-secondary)' }}>
                          {formatCurrency(Number(a.comision_neta))}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: i === 0 ? '#d97706' : 'var(--color-success)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top invitadores */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Top Invitadores</div>
                <div className="card-subtitle">Por asesores incorporados y gratificaciones generadas</div>
              </div>
            </div>
            {topInvitadores.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <Users size={24} />
                <p style={{ fontSize: 13 }}>Sin asesores invitados registrados</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topInvitadores.map((a: any, i: number) => {
                  const pct = Number(a.asesores_invitados) > 0
                    ? Math.min(100, (Number(a.asesores_invitados) / Number(topInvitadores[0]?.asesores_invitados || 1)) * 100)
                    : 0;
                  return (
                    <div key={a.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#d97706' : 'var(--color-on-surface-variant)', width: 16 }}>#{i+1}</span>
                          <span style={{ fontSize: 13, fontWeight: 550 }}>{a.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{a.asesores_invitados} asesores</span>
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-secondary)' }}>
                          {formatCurrency(Number(a.gratificaciones_generadas))}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: i === 0 ? '#d97706' : '#7c3aed' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Row 5: Avance AMA ─── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Avance AMA — Meta Anual por Asesor</div>
              <div className="card-subtitle">Meta: $180,000 MXN en comisiones netas</div>
            </div>
          </div>
          {amaAsesores.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <TrendingUp size={24} />
              <p style={{ fontSize: 13 }}>Sin asesores activos o sin periodos AMA iniciados</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {amaAsesores.map((a: any) => {
                const pct = Number(a.avance_pct || 0);
                const alcanzada = a.ama_alcanzada === true || a.ama_alcanzada === 'true';
                const barColor = alcanzada ? '#059669' : pct >= 80 ? '#d97706' : 'var(--color-secondary)';
                return (
                  <div key={a.id} style={{ padding: '12px 14px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>
                        {pct.toFixed(1)}%{alcanzada && ' 🎯'}
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: 8, marginBottom: 6 }}>
                      <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                      <span>{formatCurrency(Number(a.monto_acumulado || 0))}</span>
                      <span>Meta: {formatCurrency(Number(a.meta_ama || 180000))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Acciones rápidas ─── */}
        <div className="card">
          <div className="card-header"><div className="card-title">Acciones rápidas</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { label: 'Registrar Cierre', desc: 'Nuevo registro de venta/renta', href: '/operations/new', color: '#006c49', bg: '#d1fae5' },
              { label: 'Captación en Venta', desc: 'Nueva propiedad en inventario', href: '/properties/new', color: '#1e40af', bg: '#dbeafe' },
              { label: 'Captación en Renta', desc: 'Nueva propiedad en renta', href: '/rentals/new', color: '#7c3aed', bg: '#ede9fe' },
              { label: 'Nuevo Asesor', desc: 'Alta de asesor inmobiliario', href: '/advisors/new', color: '#c2410c', bg: '#ffedd5' },
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
    </>
  );
}

// ─── Root page: role-aware dispatch ───────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  if (user?.role === 'Asesor') return <AdvisorDashboard />;
  return <AdminDashboard />;
}
